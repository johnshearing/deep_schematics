"""HTTP-level tests: the free endpoints, and every guard on the one that spends money."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client(settings: Settings, fake_mode):
    fake_mode("ok")
    with TestClient(create_app(settings)) as c:
        yield c


def ndjson(response) -> list[dict]:
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


def test_health_reports_spend_and_config(client) -> None:
    body = client.get("/api/health").json()
    assert body["ok"] is True
    assert body["drawing_dir_present"] is True
    assert body["spend"]["ceiling_usd"] == 5.0
    assert body["models"] == ["opus", "sonnet"]


def test_drawing_is_free_and_names_the_revision_trap(client) -> None:
    """§12 Q21 is a trap: `D` is the sheet size, not a revision. Saying so on the front page
    is the cheapest correct answer in the whole application."""
    body = client.get("/api/drawing").json()
    assert body["drawing_number"] == "PS20115MLM4-2"
    assert body["revision"] is None
    assert "sheet size" in body["revision_note"]
    assert body["counts"]["components"] == 2
    assert body["references"] == ["MXCS-M9", "MXCS-M11"]


def test_starter_questions_do_not_leak_their_expected_answers(client) -> None:
    questions = client.get("/api/questions").json()["questions"]
    assert len(questions) == 5
    assert any("Net 110" in q["text"] for q in questions)
    # The acceptance text is a test oracle. Handing it to the browser would let a visitor
    # paste the expected answer back into the question.
    assert all("acceptance" not in q for q in questions)


def test_ask_streams_ndjson_and_records_spend(client) -> None:
    response = client.post("/api/ask", json={"question": "How many wires are in net 110?"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")

    events = ndjson(response)
    assert events[0]["t"] == "start"
    assert events[-1]["t"] == "done"
    assert events[-1]["daily_spend_usd"] == pytest.approx(0.0123)

    # The ledger moved, and health reflects it.
    assert client.get("/api/health").json()["spend"]["spent_usd"] == pytest.approx(0.0123)


def test_second_turn_resumes_the_same_session(client, tmp_path, monkeypatch) -> None:
    dump = tmp_path / "call2.json"
    first = ndjson(client.post("/api/ask", json={"question": "q1"}))
    session_id = first[0]["session_id"]

    monkeypatch.setenv("FAKE_DUMP", str(dump))
    client.post("/api/ask", json={"question": "q2", "session_id": session_id})

    argv = json.loads(dump.read_text())["argv"]
    assert "--resume" in argv and argv[argv.index("--resume") + 1] == session_id
    assert "--session-id" not in argv


def test_unknown_model_is_rejected(client) -> None:
    r = client.post("/api/ask", json={"question": "q", "model": "gpt-9"})
    assert r.status_code == 400


def test_overlong_question_is_rejected(client, settings: Settings) -> None:
    r = client.post("/api/ask", json={"question": "x" * (settings.max_question_chars + 1)})
    assert r.status_code == 413


def test_daily_ceiling_disables_the_endpoint_with_a_clear_message(
    settings: Settings, fake_mode
) -> None:
    """Plan §3.2: *disable* with a clear message rather than silently degrading."""
    fake_mode("ok")
    app = create_app(settings.model_copy(update={"daily_spend_ceiling_usd": 0.001}))
    with TestClient(app) as client:
        client.post("/api/ask", json={"question": "q1"})  # spends 0.0123, over the ceiling
        r = client.post("/api/ask", json={"question": "q2"})
    assert r.status_code == 503
    assert "daily budget" in r.json()["detail"]
    assert "resets tomorrow" in r.json()["detail"]


def test_concurrency_cap_refuses_rather_than_queues(settings: Settings, fake_mode) -> None:
    """Queueing would leave a visitor watching a spinner behind two two-minute answers."""
    fake_mode("ok")
    app = create_app(settings.model_copy(update={"max_concurrent_turns": 0}))
    with TestClient(app) as client:
        r = client.post("/api/ask", json={"question": "q"})
    assert r.status_code == 503
    assert "busy" in r.json()["detail"]


def test_password_gates_the_expensive_model_when_enabled(settings: Settings, fake_mode) -> None:
    """Plan §3.5 — built, and off by default. Turning it on is a config change."""
    fake_mode("ok")
    guarded = settings.model_copy(
        update={"demo_password": "hunter2", "anonymous_models": ["sonnet"]}
    )
    with TestClient(create_app(guarded)) as client:
        assert client.post("/api/ask", json={"question": "q", "model": "opus"}).status_code == 403
        ok = client.post(
            "/api/ask",
            json={"question": "q", "model": "opus"},
            headers={"X-Demo-Password": "hunter2"},
        )
        assert ok.status_code == 200
        # Sonnet stays open to anonymous visitors — it still answers the hard question.
        assert client.post("/api/ask", json={"question": "q"}).status_code == 200


def test_rate_limit_applies_to_ask_only(settings: Settings, fake_mode) -> None:
    fake_mode("ok")
    limited = settings.model_copy(
        update={"rate_limit_enabled": True, "rate_limit": "2/minute"}
    )
    with TestClient(create_app(limited)) as client:
        assert client.post("/api/ask", json={"question": "q1"}).status_code == 200
        assert client.post("/api/ask", json={"question": "q2"}).status_code == 200
        assert client.post("/api/ask", json={"question": "q3"}).status_code == 429
        # The free endpoints are unaffected — they are the fallback we point people at.
        assert client.get("/api/drawing").status_code == 200
        assert client.get("/api/health").status_code == 200


def test_cancel_of_an_unknown_turn_is_not_an_error(client) -> None:
    body = client.post("/api/turns/does-not-exist/cancel").json()
    assert body["cancelled"] is False


def test_security_headers_are_set(client) -> None:
    headers = client.get("/api/health").headers
    csp = headers["content-security-policy"]
    assert "script-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp
    assert headers["x-content-type-options"] == "nosniff"
