"""How the user wants things said aloud. `_claude_notes/talkthrough_03.md` §5.

Two authored lists, both the user's data and never the code's:

- **global**, `schematic_extraction/pronunciations.json`, for every drawing
- **per drawing**, `schematic_extraction/<drawing>/walkthrough/pronunciations.json`

Each entry says *when you meet exactly this, say that*: `{"match": "DISC1", "say": "disconnect 1"}`.
A `match` is exact and case-sensitive (a whole identifier or a whole word), **never a pattern**,
for the reason `Citation.tsx` gives. The client applies them, the per-drawing list over the
global one, and a one-off notation in an answer over both.

Read by anyone (a visitor's talkthrough should say it right too). Written only behind
`allow_edits` and the editor password, whole and atomic, like `edited_answers.py`.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Scope = Literal["global", "drawing"]
SCOPES: tuple[Scope, ...] = ("global", "drawing")


class PronunciationsUnreadable(Exception):
    """A list exists but is not one. Names the file, so the user knows which to look at."""


class Entry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    match: str = Field(min_length=1, max_length=200)
    #: Empty is allowed and means *show it, say nothing*, as the one-off `""` does.
    say: str = Field(max_length=200)
    by: str | None = Field(default=None, max_length=100)
    at: str | None = Field(default=None, max_length=40)


def pronunciations_path(drawing_dir: Path, scope: Scope) -> Path:
    """`drawing_dir` is `…/<drawing>/extracted_docs`, so the global list sits two levels up."""
    if scope == "global":
        return drawing_dir.parent.parent / "pronunciations.json"
    return drawing_dir.parent / "walkthrough" / "pronunciations.json"


def load_pronunciations(path: Path) -> list[dict[str, Any]]:
    """The entries of one list. A missing file is an empty list; anything else wrong is refused."""
    try:
        document = json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        return []
    except (OSError, json.JSONDecodeError) as exc:
        raise PronunciationsUnreadable(f"{path} could not be read: {exc}") from exc
    if not isinstance(document, dict) or not isinstance(document.get("entries"), list):
        raise PronunciationsUnreadable(f'{path} is not {{"schema": 1, "entries": [...]}}.')
    try:
        return [Entry.model_validate(e).model_dump(exclude_none=True) for e in document["entries"]]
    except ValueError as exc:
        raise PronunciationsUnreadable(f"{path} has an entry that is not one: {exc}") from exc


def save_pronunciations(path: Path, entries: list[Entry]) -> list[dict[str, Any]]:
    """Replace the whole list, atomically. Refuses two entries for the same `match`."""
    seen: set[str] = set()
    for entry in entries:
        if entry.match in seen:
            raise ValueError(f"{entry.match!r} is listed twice.")
        seen.add(entry.match)
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    written = [{**e.model_dump(exclude_none=True), "at": e.at or now} for e in entries]
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp")
    try:
        text = json.dumps({"schema": 1, "entries": written}, indent=2, ensure_ascii=False)
        temp.write_text(text + "\n", encoding="utf-8")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)
    return written
