"""Past turns, `talkthrough_03.md` §7: listed and reopened from the archives, editor only."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.edited_answers import edited_answers_dir
from app.main import create_app

PASSWORD = "let-me-draw"
HEADERS = {"X-Editor-Password": PASSWORD}
OLD = "0f5c2a8e-1b2c-4d3e-8f90-123456789abc"
NEW = "1a2b3c4d-1b2c-4d3e-8f90-123456789abc"
COMPOSED = "2b3c4d5e-1b2c-4d3e-8f90-123456789abc"


def delta(text: str) -> dict[str, Any]:
    return {"type": "stream_event",
            "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": text}}}


def archive(settings: Settings, turn: str, *, question: str | None, texts: list[str],
            mtime: float, drawing_dir: str | None = None) -> None:
    meta: dict[str, Any] = {"type": "_meta", "turn_id": turn, "model": "sonnet",
                            "prompt_version": "v1.3",
                            "drawing_dir": drawing_dir or str(settings.drawing_dir)}
    if question is not None:
        meta["question"] = question
    # The complete `assistant` message repeats the text; only the deltas count (`translate`).
    lines = [meta, *map(delta, texts),
             {"type": "assistant", "message": {"content": [{"type": "text", "text": "DUP"}]}}]
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    path = settings.log_dir / f"{turn}.jsonl"
    path.write_text("".join(json.dumps(line) + "\n" for line in lines), encoding="utf-8")
    os.utime(path, (mtime, mtime))


def record(settings: Settings, turn: str, **halves: Any) -> Path:
    folder = edited_answers_dir(settings.drawing_dir)
    folder.mkdir(parents=True, exist_ok=True)
    body = {"turn_id": turn, "saved_at": "2026-10-01T00:00:00Z", "model": "composed",
            "prompt_version": "v1.3", **halves}
    path = folder / f"{turn}.json"
    path.write_text(json.dumps(body), encoding="utf-8")
    return path


@pytest.fixture
def editor(settings: Settings):
    edits = settings.model_copy(update={"allow_edits": True, "editor_password": PASSWORD})
    with TestClient(create_app(edits)) as c:
        yield c


def test_turns_are_listed_newest_first_with_their_questions(editor, settings: Settings) -> None:
    archive(settings, OLD, question=None, texts=["Old ", "answer."], mtime=1_000)
    archive(settings, NEW, question="Why `CR1`?", texts=["Because ", "`CR1` is open."], mtime=2_000)
    turns = editor.get("/api/turns", headers=HEADERS).json()["turns"]
    assert [t["turn_id"] for t in turns] == [NEW, OLD]
    assert turns[0]["question"] == "Why `CR1`?" and turns[0]["preview"] == "Because `CR1` is open."
    # Asked before the question was recorded: listed, and says so by having none.
    assert turns[1]["question"] is None and turns[1]["preview"] == "Old answer."
    assert turns[0]["saved"] == "1970-01-01T00:33:20Z" and turns[0]["edited"] is False


def test_a_turn_reads_back_whole_with_its_saved_edit(editor, settings: Settings) -> None:
    archive(settings, NEW, question="Why?", texts=["Because ", "`CR1`."], mtime=2_000)
    record(settings, NEW, question={"original": "Why?", "edited": "Why, exactly?"},
           answer={"original": "Because `CR1`.", "edited": "Because `CR1` is open."})
    turn = editor.get(f"/api/turns/{NEW}", headers=HEADERS).json()
    assert (turn["question"], turn["answer"]) == ("Why?", "Because `CR1`.")
    assert turn["edit"]["answer"]["edited"] == "Because `CR1` is open."
    listed = editor.get("/api/turns", headers=HEADERS).json()["turns"][0]
    assert listed["question"] == "Why, exactly?" and listed["edited"] is True


def test_a_composed_answer_has_no_archive_and_is_listed_from_its_record(
    editor, settings: Settings
) -> None:
    record(settings, COMPOSED, question={"original": "", "edited": "How is 24 V made?"},
           answer={"original": "", "edited": "`PS1` makes it."})
    [listed] = editor.get("/api/turns", headers=HEADERS).json()["turns"]
    assert (listed["turn_id"], listed["model"], listed["preview"]) == (
        COMPOSED, "composed", "`PS1` makes it.")
    turn = editor.get(f"/api/turns/{COMPOSED}", headers=HEADERS).json()
    assert turn["answer"] == "" and turn["edit"]["answer"]["edited"] == "`PS1` makes it."


def test_another_drawings_turns_are_not_listed(editor, settings: Settings) -> None:
    archive(settings, OLD, question="Elsewhere?", texts=["No."], mtime=1_000,
            drawing_dir="/somewhere/else/extracted_docs")
    assert editor.get("/api/turns", headers=HEADERS).json()["turns"] == []
    assert editor.get(f"/api/turns/{OLD}", headers=HEADERS).status_code == 404


def test_the_list_is_capped(settings: Settings) -> None:
    from app.turns import list_turns

    for k in range(5):
        archive(settings, f"{k:08x}-1b2c-4d3e-8f90-123456789abc", question="Q", texts=["A"],
                mtime=1_000 + k)
    assert len(list_turns(settings.log_dir, settings.drawing_dir, limit=3)) == 3


def test_both_routes_need_the_editor_password(editor, settings: Settings) -> None:
    archive(settings, NEW, question="Why?", texts=["Because."], mtime=2_000)
    assert editor.get("/api/turns").status_code == 401
    wrong = {"X-Editor-Password": "wrong"}
    assert editor.get(f"/api/turns/{NEW}", headers=wrong).status_code == 401


@pytest.mark.parametrize("turn", ["..%2F..%2Fevil", "not-a-uuid", NEW.upper(), NEW + "0"])
def test_a_turn_id_that_is_not_one_is_refused(editor, turn: str) -> None:
    assert editor.get(f"/api/turns/{turn}", headers=HEADERS).status_code in (400, 404)


def test_an_unknown_turn_is_not_found(editor) -> None:
    assert editor.get(f"/api/turns/{NEW}", headers=HEADERS).status_code == 404


def test_a_read_only_server_has_no_such_routes(settings: Settings) -> None:
    with TestClient(create_app(settings)) as reader:
        assert reader.get("/api/turns").status_code in (404, 405)
