"""Past turns, reopened. `talkthrough_03.md` §7.

Every answer is already kept in its turn archive (`claude_runner._open_archive`), and since
2026-10-01 so is its question. This reads them back for the Ask tab's *Past answers*, joined with
the user's saved rewrite (`edited_answers.py`) where there is one. An answer the user **composed**
has a rewrite and no archive, and is listed from its record alone.

Read-only, and behind `allow_edits` and the editor password like everything that reads a
visitor's words. Only this drawing's turns are listed: an archive names its `drawing_dir`.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .claude_runner import TurnStats, translate
from .edited_answers import TURN_ID, edited_answers_dir, turn_meta

#: The list is a menu, not an export.
LIMIT = 200
PREVIEW = 120


def _answer(path: Path, cwd: Path) -> str:
    """The answer's text, exactly as the stream delivered it: `translate()`'s text events only.
    Only lines that can hold a text delta are parsed, so a long tool transcript is cheap."""
    parts: list[str] = []
    stats = TurnStats()
    try:
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                if '"text_delta"' not in line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                parts.extend(e["d"] for e in translate(event, cwd, stats) if e.get("t") == "text")
    except OSError:
        return ""
    return "".join(parts)


def _record(drawing_dir: Path, turn_id: str) -> dict[str, Any] | None:
    try:
        return json.loads((edited_answers_dir(drawing_dir) / f"{turn_id}.json").read_text("utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _ours(meta: dict[str, Any], drawing_dir: Path) -> bool:
    # An archive that predates `drawing_dir` in `_meta` cannot say, and is listed.
    return meta.get("drawing_dir") in (None, str(drawing_dir))


def _iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _entry(turn_id: str, saved: str, meta: dict[str, Any], record: dict[str, Any] | None,
           answer: str) -> dict[str, Any]:
    question = (record or {}).get("question") or {}
    edited = (record or {}).get("answer") or {}
    shown = edited.get("edited") or answer
    return {
        "turn_id": turn_id,
        "saved": saved,
        "model": meta.get("model") or (record or {}).get("model"),
        "prompt_version": meta.get("prompt_version") or (record or {}).get("prompt_version"),
        # What the user would recognise: their rewrite if there is one.
        "question": question.get("edited") or meta.get("question") or question.get("original"),
        "preview": " ".join(shown.split())[:PREVIEW],
        "edited": record is not None,
    }


def list_turns(log_dir: Path, drawing_dir: Path, limit: int = LIMIT) -> list[dict[str, Any]]:
    """This drawing's turns, newest first, capped at `limit`. Composed answers included."""
    found: list[tuple[float, str, Path | None]] = []
    for path in log_dir.glob("*.jsonl"):
        if TURN_ID.match(path.stem):
            try:
                found.append((path.stat().st_mtime, path.stem, path))
            except OSError:
                continue
    archived = {turn_id for _, turn_id, _ in found}
    for path in edited_answers_dir(drawing_dir).glob("*.json"):
        if TURN_ID.match(path.stem) and path.stem not in archived:
            try:
                found.append((path.stat().st_mtime, path.stem, None))
            except OSError:
                continue
    found.sort(reverse=True)

    turns: list[dict[str, Any]] = []
    for mtime, turn_id, path in found:
        meta = turn_meta(log_dir, turn_id) if path else {}
        if path and not _ours(meta, drawing_dir):
            continue
        record = _record(drawing_dir, turn_id)
        if path is None and record is None:
            continue
        answer = _answer(path, drawing_dir) if path else ""
        turns.append(_entry(turn_id, _iso(mtime), meta, record, answer))
        if len(turns) >= limit:
            break
    return turns


def read_turn(log_dir: Path, drawing_dir: Path, turn_id: str) -> dict[str, Any] | None:
    """One turn whole, or None. Raises `ValueError` on an id that is not one."""
    if not TURN_ID.match(turn_id):
        raise ValueError(f"{turn_id!r} is not a turn id.")
    path = log_dir / f"{turn_id}.jsonl"
    record = _record(drawing_dir, turn_id)
    meta = turn_meta(log_dir, turn_id) if path.exists() else {}
    if path.exists() and not _ours(meta, drawing_dir):
        return None
    if not path.exists() and record is None:
        return None
    return {
        "turn_id": turn_id,
        "model": meta.get("model") or (record or {}).get("model"),
        "prompt_version": meta.get("prompt_version") or (record or {}).get("prompt_version"),
        "question": meta.get("question") or ((record or {}).get("question") or {}).get("original"),
        "answer": _answer(path, drawing_dir) if path.exists() else "",
        "edit": record,
    }
