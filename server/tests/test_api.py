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
    assert body["counts"]["components"] == 4
    assert body["references"] == ["MXCS-M9", "MXCS-M11"]


def test_source_drawing_is_absent_until_a_pdf_sits_beside_the_extraction(client) -> None:
    assert client.get("/api/drawing").json()["source"] is None
    assert client.get("/api/source").status_code == 404


def test_source_drawing_is_served_inline(client, drawing_dir) -> None:
    pdf = drawing_dir.parent / "source_docs" / "PS20115MLM4-2.pdf"
    pdf.parent.mkdir()
    pdf.write_bytes(b"%PDF-1.4\n% stand-in for the sheet\n")

    assert client.get("/api/drawing").json()["source"] == {
        "name": "PS20115MLM4-2.pdf",
        "bytes": pdf.stat().st_size,
        "media_type": "application/pdf",
    }

    response = client.get("/api/source")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline")
    # It is opened in a new browser tab, never framed — so it gets the same blanket policy as
    # everything else. The `frame-ancestors 'self'` exception that used to live here went away
    # with the iframe.
    csp = response.headers["content-security-policy"]
    assert "frame-ancestors 'none'" in csp
    assert "script-src 'self'" in csp


def test_source_drawing_follows_the_tile_manifest(client, drawing_dir) -> None:
    """Several PDFs in one `source_docs/` is the real state of `ModLinx/`, and `tiles.json`
    already records which one was rendered — so it decides, rather than alphabetical order."""
    source_dir = drawing_dir.parent / "source_docs"
    source_dir.mkdir()
    for name in ("PS10115MLC2-2.pdf", "Troubleshooting Mod-Linx Conveyors.pdf"):
        (source_dir / name).write_bytes(b"%PDF-1.4\n")
    (drawing_dir / "tiles").mkdir()
    (drawing_dir / "tiles" / "tiles.json").write_text(
        json.dumps({"source_file": "PS10115MLC2-2.pdf"}), encoding="utf-8"
    )

    assert client.get("/api/drawing").json()["source"]["name"] == "PS10115MLC2-2.pdf"


def test_source_drawing_declines_to_guess_between_unrelated_pdfs(client, drawing_dir) -> None:
    source_dir = drawing_dir.parent / "source_docs"
    source_dir.mkdir()
    for name in ("some-other-machine.pdf", "a-manual.pdf"):
        (source_dir / name).write_bytes(b"%PDF-1.4\n")

    assert client.get("/api/drawing").json()["source"] is None
    assert client.get("/api/source").status_code == 404


#: A one-pixel PNG. Enough for `FileResponse` and for the manifest to consider the file real.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000a49444154789c6300010000050001"
    "0d0a2db40000000049454e44ae426082"
)


def write_tiles(drawing_dir, extra=None) -> None:
    """A 1×2 grid, the same shape as the real 4×4 manifest."""
    tiles = drawing_dir / "tiles"
    tiles.mkdir(exist_ok=True)
    for name in ("tile_r1c1.png", "tile_r1c2.png"):
        (tiles / name).write_bytes(PNG)
    manifest = {
        "source_file": "PS20115MLM4-2.pdf",
        "page_size": [1224.0, 792.0],
        "dpi": 400,
        "grid": {"rows": 1, "cols": 2},
        "tiles": [
            {"file": "tile_r1c1.png", "row": 1, "col": 1,
             "pdf_rect": [0.0, 0.0, 642.0, 792.0], "pixels": [3567, 4400]},
            {"file": "tile_r1c2.png", "row": 1, "col": 2,
             "pdf_rect": [582.0, 0.0, 1224.0, 792.0], "pixels": [3567, 4400]},
        ],
        **(extra or {}),
    }
    (tiles / "tiles.json").write_text(json.dumps(manifest), encoding="utf-8")


def test_tiles_are_absent_until_the_sheet_has_been_rendered(client) -> None:
    assert client.get("/api/drawing").json()["tiles"] is None
    assert client.get("/api/tiles/tile_r1c1.png").status_code == 404


def test_tile_rectangles_are_published_in_pdf_points(client, drawing_dir) -> None:
    """Points, not pixels, and unconverted — `components[].location` and the `geometry.json`
    bboxes are in the same space, so the overlay that comes next needs no registration."""
    write_tiles(drawing_dir)

    tiles = client.get("/api/drawing").json()["tiles"]
    assert tiles["page_size_pt"] == [1224.0, 792.0]
    assert tiles["dpi"] == 400
    assert (tiles["rows"], tiles["cols"], tiles["count"]) == (1, 2, 2)
    assert tiles["tiles"][1] == {
        "file": "tile_r1c2.png", "row": 1, "col": 2,
        "pdf_rect": [582.0, 0.0, 1224.0, 792.0], "pixels": [3567.0, 4400.0],
    }

    response = client.get("/api/tiles/tile_r1c2.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == PNG


def test_a_tile_that_is_not_on_disk_is_dropped_rather_than_served_broken(
    client, drawing_dir
) -> None:
    write_tiles(drawing_dir)
    (drawing_dir / "tiles" / "tile_r1c2.png").unlink()

    tiles = client.get("/api/drawing").json()["tiles"]
    assert [t["file"] for t in tiles["tiles"]] == ["tile_r1c1.png"]
    assert tiles["count"] == 1
    assert client.get("/api/tiles/tile_r1c2.png").status_code == 404


def test_a_manifest_without_a_page_size_means_no_viewer(client, drawing_dir) -> None:
    """`test_source_drawing_follows_the_tile_manifest` writes exactly this shape — a manifest
    that names its source PDF and nothing else. It must not produce a half-built viewer."""
    write_tiles(drawing_dir, extra={"page_size": None})
    assert client.get("/api/drawing").json()["tiles"] is None


@pytest.mark.parametrize(
    "name",
    [
        "../circuit_logic.json",
        "..%2Fcircuit_logic.json",
        "tiles.json",
        "tile_r9c9.png",
        "circuit_logic.json",
    ],
)
def test_only_a_tile_the_manifest_names_can_be_fetched(client, drawing_dir, name) -> None:
    write_tiles(drawing_dir)
    assert client.get(f"/api/tiles/{name}").status_code in (404, 405)


def designators(client) -> dict:
    body = client.get("/api/designators").json()
    return {entry["id"]: entry for entry in body["entries"]}


def test_the_designator_index_lists_every_citable_id(client) -> None:
    """The allowlist behind a clickable citation. It has to be *complete* — a missing id is a
    citation that silently stays plain text — and it has to be an allowlist rather than a
    pattern, because everything matched against it is model output."""
    body = client.get("/api/designators").json()
    assert body["counts"] == {"component": 4, "terminal": 3, "net": 1, "wire": 1}
    index = designators(client)
    assert set(index) == {
        "CR1", "CB1", "TB-110", "UPSTREAM-MACHINE",
        "CR1:A1", "CB1:2", "TB-110:1",
        "110", "W047",
    }


def test_a_component_carries_its_own_point_and_its_aliases(client) -> None:
    entry = designators(client)["CR1"]
    assert entry["point"] == [100.0, 200.0]
    assert entry["label"].startswith("relay — Run relay.")
    # Aliases are how "the run relay" in an answer reaches CR1. The id repeats among them in
    # the real extraction, so the client has to tolerate that rather than the server pruning it.
    assert entry["aliases"] == ["run relay", "CR1"]


def test_a_terminal_borrows_the_point_of_the_component_it_is_on(client) -> None:
    """A terminal has no geometry of its own in this extraction, and pretending otherwise
    would put a marker at the origin — the worst kind of wrong, because it looks deliberate."""
    assert designators(client)["CB1:2"]["point"] == [300.0, 80.0]
    assert designators(client)["CB1:2"]["members"] == ["CB1"]


def test_a_net_and_a_wire_get_a_rectangle_spanning_what_they_touch(client) -> None:
    net = designators(client)["110"]
    assert net["members"] == ["CR1", "CB1", "TB-110"]
    # Frames all three: x from 100 to 300, y from 80 to 250. `point` is its centre.
    assert net["rect"] == [100.0, 80.0, 300.0, 250.0]
    assert net["point"] == [200.0, 165.0]
    assert net["label"] == "control 24VDC, 3 terminals"

    wire = designators(client)["W047"]
    assert wire["rect"] == [100.0, 80.0, 300.0, 200.0]
    assert wire["label"] == "BLUE 18AWG wire, CR1:A1 → CB1:2"


def test_a_net_names_every_member_terminal_in_order_with_its_own_placement(client) -> None:
    """The fault this prevents: a net highlight that marks *components*.

    `members` is the parent components of a net's terminals, and marking those put the ring in
    the wrong place — on the real sheet net 120's `CR2` is a coil 630 pt from `CR2:14`, the
    contact actually on the net, and `TB-120:1/2/3` collapse into one component so seven members
    showed as five dots. So the entry has to publish the membership itself, and each member has
    to carry **its own** placement: a net of two placed pins and one nobody has touched is three
    different claims and one field could only lie about two of them.
    """
    net = designators(client)["110"]
    assert [m["id"] for m in net["terminals"]] == ["CR1:A1", "CB1:2", "TB-110:1"]
    # Nothing is placed in this fixture, so all three are their parents' points, said in words.
    assert [m["placement"] for m in net["terminals"]] == ["parent", "parent", "parent"]
    assert net["terminals"][0]["point"] == [100.0, 200.0]
    # And the coarser list is still there, still the parents. Both, because the card demotes the
    # components to `runs through` rather than dropping them.
    assert net["members"] == ["CR1", "CB1", "TB-110"]


def test_a_wire_names_its_two_ends_in_from_to_order(client) -> None:
    """Order is the content here: a two-ended compass on the Locate tab heads its controls with
    these ids, and swapping them would label both ends of every wire wrongly with nothing on
    screen to show it."""
    wire = designators(client)["W047"]
    assert [m["id"] for m in wire["terminals"]] == ["CR1:A1", "CB1:2"]


def test_a_component_and_a_terminal_are_not_made_of_anything(client) -> None:
    """The field says what a thing *consists of*. A component does not consist of terminals in
    this sense — its pins are its own rows — so publishing an empty list there would invite a
    reader to draw a roster with nothing in it."""
    index = designators(client)
    assert "terminals" not in index["CR1"]
    assert "terminals" not in index["CR1:A1"]


def test_every_member_a_net_rings_is_inside_the_rectangle_it_frames(client) -> None:
    """Asserted rather than assumed, because the two are computed from the same list *today* and
    a later change to either could quietly put a ringed dot off screen after the flight."""
    for identifier in ("110", "W047"):
        entry = designators(client)[identifier]
        x0, y0, x1, y1 = entry["rect"]
        for member in entry["terminals"]:
            if member["point"] is None:
                continue
            x, y = member["point"]
            assert x0 <= x <= x1 and y0 <= y <= y1, f"{member['id']} is outside {identifier}"


def test_ids_the_extraction_invented_are_marked_as_ours(client) -> None:
    """`prompts.py` makes the model put these in parentheses after a description, because the
    reader is holding the sheet and cannot find them on it. The UI has to say the same thing,
    so the flag travels with the id."""
    index = designators(client)
    assert index["W047"]["on_sheet"] is False  # the sheet labels runs by colour and gauge
    assert index["TB-110:1"]["on_sheet"] is False  # point numbers are assigned in drawing order
    assert index["CR1"]["on_sheet"] is True
    assert index["110"]["on_sheet"] is True


def test_an_id_with_nowhere_to_point_is_still_in_the_index(client) -> None:
    """Six components in the real extraction have no location — the two off-page machines and
    the four referenced drawings. Dropping them would make a legitimate citation unresolvable;
    keeping them with a null point makes it citable but not clickable, which is the truth."""
    entry = designators(client)["UPSTREAM-MACHINE"]
    assert entry["point"] is None
    assert entry["rect"] is None
    assert client.get("/api/designators").json()["located"] == 8


def test_the_designator_index_is_unavailable_without_an_extraction(tmp_path, settings) -> None:
    empty = create_app(settings.model_copy(update={"drawing_dir": tmp_path / "nothing"}))
    with TestClient(empty) as client:
        assert client.get("/api/designators").status_code == 503


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


def test_empty_anonymous_models_gates_every_question(settings: Settings, fake_mode) -> None:
    """The deployment this repo actually runs: no model is anonymous, so nothing is free.

    `anonymous_models=[]` is the difference between "the password protects Opus" and "the
    password protects the server", which is what a publicly reachable port needs.
    """
    fake_mode("ok")
    guarded = settings.model_copy(update={"demo_password": "1234", "anonymous_models": []})
    with TestClient(create_app(guarded)) as client:
        denied = client.post("/api/ask", json={"question": "q"})
        assert denied.status_code == 403
        # With no anonymous model to fall back to, the message must not trail off into
        # "you can use: ." — it has to tell the visitor what to actually do.
        assert "Unlock" in denied.json()["detail"]
        ok = client.post(
            "/api/ask", json={"question": "q"}, headers={"X-Demo-Password": "1234"}
        )
        assert ok.status_code == 200


def test_unlock_checks_the_password_without_spending(settings: Settings) -> None:
    """A typo must fail here, not at question time — nothing else can tell the browser."""
    guarded = settings.model_copy(update={"demo_password": "1234", "anonymous_models": []})
    with TestClient(create_app(guarded)) as client:
        assert client.post("/api/unlock", json={"password": "wrong"}).status_code == 401
        assert client.post("/api/unlock", json={"password": ""}).status_code == 401
        good = client.post("/api/unlock", json={"password": "1234"})
        assert good.status_code == 200
        assert good.json() == {"unlocked": True, "password_required": True}


def test_unlock_is_open_when_no_password_is_configured(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        r = client.post("/api/unlock", json={"password": ""})
        assert r.status_code == 200
        assert r.json()["password_required"] is False


def test_unlock_has_its_own_rate_limit(settings: Settings) -> None:
    """Guessing is the attack on a short password, and /api/ask's bucket does not cover it."""
    guarded = settings.model_copy(
        update={
            "demo_password": "1234",
            "rate_limit_enabled": True,
            "unlock_rate_limit": "2/minute",
        }
    )
    with TestClient(create_app(guarded)) as client:
        assert client.post("/api/unlock", json={"password": "a"}).status_code == 401
        assert client.post("/api/unlock", json={"password": "b"}).status_code == 401
        assert client.post("/api/unlock", json={"password": "c"}).status_code == 429


def test_index_is_revalidated_but_hashed_assets_are_cached(settings: Settings) -> None:
    """A cached index.html pins the previous bundle name, so the browser runs the old UI
    against the new server. That is how a shipped password prompt failed to appear."""
    from app.config import STATIC_DIR

    if not (STATIC_DIR / "index.html").exists():
        pytest.skip("no built frontend; run `npm run build` in webui/")

    with TestClient(create_app(settings)) as client:
        assert client.get("/webui/").headers["cache-control"] == "no-cache"
        asset = next(iter((STATIC_DIR / "assets").iterdir())).name
        cached = client.get(f"/webui/assets/{asset}").headers["cache-control"]
        assert "immutable" in cached and "max-age=31536000" in cached


def test_unlock_succeeds_while_rate_limiting_is_on(settings: Settings) -> None:
    """The live path, which the disabled-limiter tests cannot reach.

    slowapi writes `X-RateLimit-*` onto whatever the endpoint returned and raises if that is
    not a `Response`, so a correct password 500'd in production while every test passed.
    """
    guarded = settings.model_copy(
        update={"demo_password": "1234", "rate_limit_enabled": True}
    )
    with TestClient(create_app(guarded)) as client:
        r = client.post("/api/unlock", json={"password": "1234"})
        assert r.status_code == 200, r.text
        assert r.json()["unlocked"] is True


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
