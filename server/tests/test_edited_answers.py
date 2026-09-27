"""Edited answers, `talkthrough_02.md` §6: a user's rewrite of a turn, beside the original."""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.edited_answers import edited_answers_dir
from app.main import create_app
from app.prompts import PROMPT_VERSION

PASSWORD = "let-me-draw"
TURN = "0f5c2a8e-1b2c-4d3e-8f90-123456789abc"
BODY: dict[str, Any] = {
    "question": "Why?", "question_edited": "Why, exactly?",
    "answer": "Because `CR1`.", "answer_edited": "Because `CR1` is open.", "model": "sonnet",
}


@pytest.fixture
def editor(settings: Settings):
    edits = settings.model_copy(update={"allow_edits": True, "editor_password": PASSWORD})
    with TestClient(create_app(edits)) as c:
        yield c


def put(
    client: TestClient, body: dict[str, Any], turn: str = TURN, password: str | None = PASSWORD
):
    headers = {"X-Editor-Password": password} if password else {}
    return client.put(f"/api/edited-answers/{turn}", json=body, headers=headers)


def test_an_edit_is_kept_beside_its_original_and_listed(editor, settings: Settings) -> None:
    response = put(editor, BODY)
    assert response.status_code == 200 and response.json()["saved"] is True
    saved = json.loads((edited_answers_dir(settings.drawing_dir) / f"{TURN}.json").read_text())
    assert saved["answer"] == {"original": "Because `CR1`.", "edited": "Because `CR1` is open."}
    assert saved["question"] == {"original": "Why?", "edited": "Why, exactly?"}
    assert saved["prompt_version"] == PROMPT_VERSION and saved["model"] == "sonnet"
    # Beside the extraction, never inside it.
    assert edited_answers_dir(settings.drawing_dir).parent.parent == settings.drawing_dir.parent
    listed = editor.get("/api/edited-answers", headers={"X-Editor-Password": PASSWORD}).json()
    assert [r["turn_id"] for r in listed["records"]] == [TURN]


def test_reverting_both_halves_deletes_the_record(editor, settings: Settings) -> None:
    put(editor, BODY)
    response = put(editor, {**BODY, "question_edited": None, "answer_edited": None})
    assert response.json() == {"saved": False, "record": None}
    assert not (edited_answers_dir(settings.drawing_dir) / f"{TURN}.json").exists()


def test_it_needs_the_editor_password(editor) -> None:
    assert put(editor, BODY, password=None).status_code == 401
    assert put(editor, BODY, password="wrong").status_code == 401


@pytest.mark.parametrize("turn", ["..%2F..%2Fevil", "not-a-uuid", TURN.upper(), TURN + "0"])
def test_a_turn_id_that_is_not_one_is_refused(editor, turn: str) -> None:
    assert put(editor, BODY, turn=turn).status_code in (400, 404)


def test_a_read_only_server_has_no_such_route(settings: Settings) -> None:
    with TestClient(create_app(settings)) as reader:
        assert put(reader, BODY).status_code in (404, 405)


def test_the_record_takes_model_and_prompt_from_the_turn_archive(
    editor, settings: Settings
) -> None:
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    meta = {"type": "_meta", "turn_id": TURN, "model": "opus", "prompt_version": "v0.9"}
    (settings.log_dir / f"{TURN}.jsonl").write_text(json.dumps(meta) + "\n", encoding="utf-8")
    record = put(editor, BODY).json()["record"]
    assert (record["model"], record["prompt_version"]) == ("opus", "v0.9")
