"""Answers, and questions, that the user has rewritten. `talkthrough_02.md` §6.

The Ask tab lets the user edit an answer in place — to present it, or to replace it with one of
their own — and then talk it through. The screen then shows only the edit. This keeps each edit
beside what the model originally wrote, so the two can be compared later (the steering plan,
`_claude_notes/talkthrough_03.md` §8–§10).

**This is the user's prose, never drawing data.** It is written to a directory of its own beside
the extraction, `walkthrough/edited_answers/`, one file per turn, and nothing here reads or
writes an authored file. Behind `allow_edits` and the editor password, like every other write.
"""

from __future__ import annotations

import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

#: A turn id is the server's own `uuid4`. Checking the shape is what keeps a crafted id from
#: naming a path outside the directory.
TURN_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def edited_answers_dir(drawing_dir: Path) -> Path:
    """`<extraction>/walkthrough/edited_answers/`, beside `extracted_docs/`, not inside it."""
    return drawing_dir.parent / "walkthrough" / "edited_answers"


def save_edit(
    drawing_dir: Path,
    turn_id: str,
    *,
    question: str,
    question_edited: str | None,
    answer: str,
    answer_edited: str | None,
    model: str | None,
    prompt_version: str,
) -> dict[str, Any] | None:
    """Write the record for one turn, or delete it when nothing is edited any more.

    Whole and atomic, through `os.replace` in the same directory. Returns what was written, or
    None when the file was removed.
    """
    if not TURN_ID.match(turn_id):
        raise ValueError(f"{turn_id!r} is not a turn id.")
    path = edited_answers_dir(drawing_dir) / f"{turn_id}.json"
    if question_edited is None and answer_edited is None:
        path.unlink(missing_ok=True)
        return None

    record = {
        "turn_id": turn_id,
        "saved_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": model,
        # The caller passes the turn archive's own record where there is one (`turn_meta`), and
        # the prompt this server runs now only when the archive is gone.
        "prompt_version": prompt_version,
        "question": {"original": question, "edited": question_edited},
        "answer": {"original": answer, "edited": answer_edited},
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp")
    try:
        temp.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)
    return record


def turn_meta(log_dir: Path, turn_id: str) -> dict[str, Any]:
    """The `_meta` line a turn's archive starts with: its model and prompt version, as asked.
    Empty when the archive is missing or unreadable."""
    if not TURN_ID.match(turn_id):
        return {}
    try:
        with (log_dir / f"{turn_id}.jsonl").open(encoding="utf-8") as handle:
            first = json.loads(handle.readline())
    except (OSError, json.JSONDecodeError):
        return {}
    return first if isinstance(first, dict) and first.get("type") == "_meta" else {}


def list_edits(drawing_dir: Path) -> list[dict[str, Any]]:
    """Every saved record, newest first. An unreadable file is skipped, not fatal."""
    records = []
    for path in edited_answers_dir(drawing_dir).glob("*.json"):
        try:
            records.append(json.loads(path.read_text("utf-8")))
        except (OSError, json.JSONDecodeError):
            continue
    return sorted(records, key=lambda r: r.get("saved_at", ""), reverse=True)
