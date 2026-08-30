"""What the extractor read off the paper — the layer *below* the netlist.

`circuit_logic.json` says what connects and `locations.json` says where it is drawn. Both are
curated: a human wrote the first through `author_circuit_logic.py` and places every point in the
second. **This module is the uncurated layer underneath them** — the strings the OCR pass lifted
off the sheet, and the polylines the vector pass lifted out of the PDF — and it exists because
that layer has doubts nobody has ever read.

`geometry.json` records them itself, in `pages[0].review_queue`, and has since 2026-08-03:

    low_confidence_label   159   a string the reader is not sure of, 71 of them blank
    incomplete_conductor   119   a run with no net name, no spec, or a loose end

The file's own `text_source` field says why there are so many:

> OCR of stroked glyph geometry - this PDF has no embedded font text, so every label must be
> verified with the vision pass.

### Why this is a reduced read, and not a parse

`geometry.json` is **608 KB, about 150,000 tokens**, and two rules about it are older than this
module. `prompts.py` §3 forbids the model from reading it. And nothing has ever sent it to a
browser. Both would be broken by a loader that handed back the raw parse and let each caller take
what it liked, so this one **keeps only the fields a caller has a use for** and drops the rest at
the boundary: `symbols`, `boxes`, `rects`, `junctions`, the conductor `points` polylines, the
per-endpoint `endpoint_bindings`, `stats`, `params`. What is left is 664 small records.

That is hazard **H17** in `06_code_map.md`, and it is structural rather than a rule to remember:
there is no code path from here to the whole file, so no route can leak it by accident. When Phase
E needs the conductor polylines for `/api/conductors` it adds them **here**, named, behind the same
cache, and that route decides what to publish — the loader still never returns the file.

### The two things a reading can be about

A **label** is a string with a box round it: `T0012`, `LI-A`, confidence 0.4. Its reading is its
`text`.

A **conductor** is a run of ink: `C0080`, and what the extractor tried to read *for* it is the net
name printed beside it. Its reading is its `net_label`, which for 79 of the 149 runs on this sheet
is missing altogether — not misread, never bound. So a conductor's reading is a blank rather than a
mistake, which is why the review screen sorts the two differently.

Both are `(id, what the machine read, how sure it was)`, which is what lets one authored file
correct either — see `label_corrections.py`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

FILENAME = "geometry.json"

#: `review_queue` kinds, as the extractor writes them.
FLAG_LABEL = "low_confidence_label"
FLAG_CONDUCTOR = "incomplete_conductor"


@dataclass(frozen=True)
class Label:
    """One string the OCR pass lifted off the sheet, with how sure it was.

    `text` is what the extraction settled on and `raw_ocr` is what came back before its own
    tidying; they differ on 30 of this drawing's 515 (`P0WER` for `POWER`), and both are published
    because the difference is sometimes the clue. An empty `text` with `ocr_status: "empty"` is the
    71 it could not read at all — a blank rather than a guess, and a different kind of work.
    """

    id: str
    text: str
    raw_ocr: str
    confidence: float
    #: The extractor's guess at what sort of string this is: `net_number`, `wire_spec`,
    #: `terminal_number`, `designator`, `voltage`, `text`, `note`, `empty`. A hint for the reader,
    #: never a filter this server applies.
    kind: str
    ocr_status: str
    bbox: tuple[float, float, float, float]

    @property
    def blank(self) -> bool:
        return not self.text.strip()


@dataclass(frozen=True)
class Conductor:
    """One run of ink, and the names printed beside it.

    `points` is deliberately **absent**. It is the polyline Phase E will lift a wire's path from,
    it is half the weight of `geometry.json`, and nothing in Phase F draws a route — so it is not
    read here yet. `endpoints` is enough to frame the run on screen, which is all the review screen
    needs in order to show you the ink you are naming.
    """

    id: str
    endpoints: tuple[tuple[float, float], ...]
    net_label: str | None
    spec_label: str | None
    #: The labels the extractor bound to this run — the net name, the spec, and anything else that
    #: happened to sit beside it. Every one of this sheet's 70 net names is the `text` of one of
    #: them, which is what lets a correction to a *label* fix every conductor that reads it.
    label_ids: tuple[str, ...] = ()

    @property
    def rect(self) -> tuple[float, float, float, float] | None:
        if not self.endpoints:
            return None
        xs = [x for x, _ in self.endpoints]
        ys = [y for _, y in self.endpoints]
        return (min(xs), min(ys), max(xs), max(ys))


@dataclass(frozen=True)
class Flag:
    """One `review_queue` entry: the extractor saying *"look at this one"*.

    Kept as its own record rather than folded onto the label or the conductor, because *being
    flagged* is a judgement the extraction made and *what was read* is a fact — and the review
    screen shows the flagged ones by default while letting you reach any of the rest.
    """

    id: str
    kind: str
    #: `incomplete_conductor` only: which of `net_label`, `spec_label`, `unbound_endpoints` it
    #: lacks. As written, so `unbound_endpoints:[0]` keeps the index it names.
    missing: tuple[str, ...] = ()


@dataclass(frozen=True)
class Ink:
    """The reduced read of one sheet's `geometry.json`.

    `present` distinguishes *no such file* from *a file that said nothing*, exactly as
    `Locations.present` does: a bare extraction with no vector pass is not broken, and the review
    screen has to be able to say so instead of showing an empty queue.
    """

    present: bool = False
    page_size_pt: tuple[float, float] | None = None
    labels: dict[str, Label] = field(default_factory=dict)
    conductors: dict[str, Conductor] = field(default_factory=dict)
    #: In file order, which is the extractor's own order and means nothing in particular. The
    #: review screen sorts.
    flags: tuple[Flag, ...] = ()
    problems: tuple[str, ...] = ()

    def flagged(self) -> set[str]:
        return {flag.id for flag in self.flags}

    def missing_of(self) -> dict[str, tuple[str, ...]]:
        """Which of `net_label`, `spec_label`, `unbound_endpoints` each flagged run lacks."""
        return {flag.id: flag.missing for flag in self.flags if flag.missing}

    def counts(self) -> dict[str, int]:
        return {
            "labels": len(self.labels),
            "conductors": len(self.conductors),
            "flagged": len(self.flags),
            "blank_labels": sum(1 for label in self.labels.values() if label.blank),
            "conductors_without_a_net_name": sum(
                1 for c in self.conductors.values() if not c.net_label
            ),
        }

    def net_label_sources(self) -> set[str]:
        """The label ids some conductor's net name is read *from*.

        Computed by matching the conductor's `net_label` against the `text` of each label it is
        bound to, because the extraction records the string and not which label it came from. It
        matches for all 70 on this sheet and 0 conductors are left unexplained, which is what makes
        this safe to rely on — and it is what the review screen's `Net labels` filter is: correcting
        one of these 70 corrects every run that reads it, and that is the comparison Phase E's
        candidate ranking is built on.
        """
        out: set[str] = set()
        for conductor in self.conductors.values():
            if not conductor.net_label:
                continue
            for label_id in conductor.label_ids:
                label = self.labels.get(label_id)
                if label is not None and label.text == conductor.net_label:
                    out.add(label_id)
        return out

    def conductors_of(self, label_id: str) -> list[str]:
        """Which runs read their net name from this label. Empty for the other 445."""
        label = self.labels.get(label_id)
        if label is None or not label.text:
            return []
        return [
            c.id
            for c in self.conductors.values()
            if c.net_label == label.text and label_id in c.label_ids
        ]

    def net_label_source_of(self, conductor_id: str) -> str | None:
        """The label this run's net name was read *from*, if any — the other direction of
        `conductors_of`, and the link a correction travels along.

        It is what makes one edit worth more than one row: `LI-A` → `L1-A` on `T0012` is not a note
        about `T0012`, it is a statement about every run whose net name that label supplies. Without
        this the run would go on reading `LI-A` while the label beside it read `L1-A`, and the path
        matcher — which compares the *run's* name against a wire's net — would be no better off,
        which is the entire reason Phase F comes before Phase E.

        The first bound label whose text matches wins. On this sheet every one of the 70 matches
        exactly once, so there is nothing to arbitrate; a hypothetical run with two labels of the
        same text would be corrected by either, identically.
        """
        conductor = self.conductors.get(conductor_id)
        if conductor is None or not conductor.net_label:
            return None
        for label_id in conductor.label_ids:
            label = self.labels.get(label_id)
            if label is not None and label.text == conductor.net_label:
                return label_id
        return None


EMPTY = Ink()


def ink_path(drawing_dir: Path) -> Path:
    return drawing_dir / FILENAME


@lru_cache(maxsize=4)
def load_ink(drawing_dir: Path) -> Ink:
    """Parse `geometry.json` once per directory and keep only the reduced form.

    Cached because the reduction is the expensive part — a 608 KB parse for a screen that is
    otherwise a few hundred dictionary lookups — and because `GET /api/review` is polled by the
    editor. Nothing writes this file, so unlike `load_locations` there is no cache to invalidate:
    `geometry.json` changes when the extraction is re-run, and that is a deploy.
    """
    path = ink_path(drawing_dir)
    try:
        raw = json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        return EMPTY
    except (OSError, json.JSONDecodeError) as exc:
        return Ink(present=True, problems=(f"{FILENAME} could not be read: {exc}",))
    return reduce(raw)


def reduce(raw: Any) -> Ink:
    """The whole of the boundary: what comes out of here is what a caller may have.

    Split out from the loader so it can be applied to a payload that is not on disk, and so that
    the one place the file narrows is a function with a name.
    """
    if not isinstance(raw, dict):
        return Ink(present=True, problems=(f"{FILENAME} is not an object",))
    pages = raw.get("pages")
    if not isinstance(pages, list) or not pages or not isinstance(pages[0], dict):
        return Ink(present=True, problems=(f"{FILENAME} has no pages",))
    page = pages[0]

    problems: list[str] = []
    labels: dict[str, Label] = {}
    for entry in page.get("labels") or []:
        label = _label(entry, problems)
        if label is not None:
            labels[label.id] = label

    conductors: dict[str, Conductor] = {}
    for entry in page.get("conductors") or []:
        conductor = _conductor(entry, problems)
        if conductor is not None:
            conductors[conductor.id] = conductor

    flags: list[Flag] = []
    for entry in page.get("review_queue") or []:
        flag = _flag(entry, problems)
        if flag is not None:
            flags.append(flag)

    return Ink(
        present=True,
        page_size_pt=_size(page.get("page_size")),
        labels=labels,
        conductors=conductors,
        flags=tuple(flags),
        problems=tuple(problems),
    )


def _label(entry: Any, problems: list[str]) -> Label | None:
    if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
        problems.append(f"{FILENAME}: a label has no id")
        return None
    bbox = _rect(entry.get("bbox"))
    if bbox is None:
        problems.append(f"{FILENAME}: label {entry['id']} has no usable bbox")
        return None
    return Label(
        id=entry["id"],
        text=_text(entry.get("text")),
        raw_ocr=_text(entry.get("raw_ocr")),
        confidence=_number(entry.get("confidence")) or 0.0,
        kind=_text(entry.get("kind")) or "text",
        ocr_status=_text(entry.get("ocr_status")) or "ok",
        bbox=bbox,
    )


def _conductor(entry: Any, problems: list[str]) -> Conductor | None:
    if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
        problems.append(f"{FILENAME}: a conductor has no id")
        return None
    ends = tuple(
        point
        for point in (_point(p) for p in (entry.get("endpoints") or []))
        if point is not None
    )
    return Conductor(
        id=entry["id"],
        endpoints=ends,
        net_label=_optional_text(entry.get("net_label")),
        spec_label=_optional_text(entry.get("spec_label")),
        label_ids=tuple(i for i in (entry.get("label_ids") or []) if isinstance(i, str)),
    )


def _flag(entry: Any, problems: list[str]) -> Flag | None:
    if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
        problems.append(f"{FILENAME}: a review_queue item has no id")
        return None
    return Flag(
        id=entry["id"],
        kind=_text(entry.get("kind")) or FLAG_LABEL,
        missing=tuple(m for m in (entry.get("missing") or []) if isinstance(m, str)),
    )


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _optional_text(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value)


def _point(value: Any) -> tuple[float, float] | None:
    if not isinstance(value, list) or len(value) != 2:
        return None
    try:
        return float(value[0]), float(value[1])
    except (TypeError, ValueError):
        return None


def _rect(value: Any) -> tuple[float, float, float, float] | None:
    if not isinstance(value, list) or len(value) != 4:
        return None
    try:
        x0, y0, x1, y1 = (float(v) for v in value)
    except (TypeError, ValueError):
        return None
    return x0, y0, x1, y1


def _size(value: Any) -> tuple[float, float] | None:
    if not isinstance(value, dict):
        return None
    try:
        return float(value["width"]), float(value["height"])
    except (KeyError, TypeError, ValueError):
        return None
