"""`wiring.json` — the fourth authored file, and the one that says *what connects to what*.

    circuit_logic.json      generated       what each thing is, and what joins what
    locations.json          authored        where it is drawn
    label_corrections.json  authored        what the ink says
    wiring.json             authored        which two terminals each wire joins

### Why this is a fourth file and not part of `locations.json`

`label_corrections.py`'s docstring gives three reasons for a separate file. Run them against a
wire's endpoints and **two of the three hold, plus a fourth that settles it**:

- *"It keys on a different id space."* **It does not** — a wiring record keys on `W###` and
  terminal designators, the same curated names `locations.json` uses. This is the one reason to
  fold in, and it is the weakest of them.
- *"It is written from a different screen."* **It holds.** A wiring run and a placement run are
  different sittings, and folding in would widen the `H1` whole-document-save window across two
  more workflows.
- *"It is a different claim."* **It holds, and it is decisive.** `locations.json` has never made a
  connectivity statement. Every rule that keeps a highlight honest — *a route is never computed*
  above all — depends on *where a thing is drawn* and *what it connects to* being two claims a
  person makes separately. A file holding both cannot tell you which one you changed.
- **Regeneration**, which `label_corrections.json` never needed. A path must **not** make
  `circuit_logic.json` stale and an endpoint **must**: that is the difference between display
  geometry and netlist content. Two files, and the rule is one sentence each — *touch
  `wiring.json`, re-run the generator; touch `locations.json`, do not.*

### What one record says

    "wires": {
      "W063": { "from": "INFEED1:3", "to": "TB-120:1", "source": "human",
                "by": "js", "at": "2026-09-07T14:22:03.118Z",
                "was": ["INFEED1:3", "TB-120:2"],
                "note": "the ink runs C0091 west along y=563.4 and stops at point 1" },
      "W072": { "from": null, "to": null, "source": "human", "by": "js", "at": "..." },
      "W099": { "retired": "duplicated W014" }
    }

- **`from` / `to`** are terminal designators, or **`null`** for an end nobody has set. `null` is a
  real state and the only honest one for a wire added on screen before its second click.
- **`source`** is `index` or `human` — the indexing pass's own answer, or a person who looked.
  There is no third value and deliberately no `derived`: an endpoint is read or it is guessed, and
  the file has to be able to tell you which. This is `locations.json`'s two-provenance rule in a
  fourth file.
- **`was`** keeps the two endpoints this record replaced, forever, for the same reason a label
  correction keeps `was`: the `W` table in `author_circuit_logic.py` is hand-maintained and a
  future edit there would destroy the original. Absent where nothing was replaced.
- **No `net`.** A wire's net is derived from its two ends' own `net` fields, and a wire whose ends
  sit on different nets is **flagged and not fixed** — `W019` corrected is a 0 V-to-ground bond
  that reads `0V` at one end and `GND` at the other, and that is the finding.
- **No colour, gauge or cable.** Those stay in the `W` table: they were read off the printed
  callouts, which is a reading of the ink rather than a claim about connectivity.
- **`retired`** is a tombstone with a reason, in place of `from`/`to`, so an id is never reused and
  a stale path or a stale citation gets an answer rather than silence.

**There are no coordinates in this file, and that is what will make it survive a circuit that needs
several sheets**: `CR-BP:A2` names the same terminal whichever page prints it. The one thing that
will need a page is `commoning`, because that stores polylines — see below.

### `commoning` — a terminal block's own bus, and the only coordinates in this file

    "commoning": {
      "TB-0V": {
        "runs": [[[954.4, 267.3], [954.4, 546.9]]],
        "conductors": ["C0105"],
        "geometry": "extracted",
        "attribution": "human",
        "page": 1,
        "by": "js", "at": "..."
      }
    }

Keyed on the **component id of the block**, and a key that is not a component in the netlist is
refused **by name** in `resolve_wiring` — its symptom would otherwise be nothing at all.

- **`runs` is a list of polylines and not just a list of conductor ids**, and that is the whole
  reason this record has a shape of its own. `C0105` is one conductor holding `DISCHARGE1:2`'s
  wire **and** all 279.6 pt of `TB-0V`'s vertical, because the extractor splits a conductor at a
  crossover hop and a T-junction is not one. Pointing at the whole conductor would highlight that
  wire as though it were the bus. `conductors` records which runs the polylines were lifted from,
  which is a different claim and a weaker one.
- **`geometry` and `attribution` mean what they mean on a path**, and **`derived` is refused by
  name on both** — the same rule `locations.py` `_paths` enforces. A bus lifted from the ink is
  the PDF's own strokes; a bus a person traced says so forever; a bus *computed from where the
  block's pins happen to line up* is the thing neither of them may quietly become.
- **`page` is optional and is the one page number in this file.** Everything else here is a
  terminal designator, which names the same terminal whichever sheet prints it — but a polyline
  only means something on a sheet. It costs nothing on a one-page drawing and would be a schema
  change on the first two-page one, so it is here now.
- **It is display geometry and never enters the netlist.** No `W###`, no `CONNECTS_TO` edge, no
  entity: `author_circuit_logic.py` does not read this section at all, and
  `test_commoning_does_not_reach_the_netlist` compares the generator's bytes with and without one.
  A commoning save therefore leaves `circuit_logic.json` current, exactly as a path does.

**The unit of refusal is the whole record**, unlike a wire, and it is `_paths`'s reasoning: half a
bus is a line that stops in the middle of a terminal block and claims to be its commoning.

### The duplication with the generator, and how the two stay honest

`read_wiring()` and `_wiring_record()` in
`schematic_extraction/PS20115MLM4-2/extracted_docs/author_circuit_logic.py` validate this same
file for the generator, and **that duplication is deliberate and is the established shape here** —
`read_locations()` and this package's `locations.py` have lived that way since the beginning. The
generator cannot import from `server/`: it is a standalone script that ships inside an extraction
directory and is copied to the next drawing with the tables replaced.

The risk is exact and worth naming: **if the two ever disagree about what a valid record is, this
editor will write something the generator refuses and nothing else in the project will notice.**
The symptom would be a `REFUSED:` from a command a person runs hours later, about an edit they have
forgotten making. So the guard is a test rather than a comment —
`test_the_editor_cannot_write_a_record_the_generator_refuses` in `server/tests/test_wiring.py`
puts the same records through both validators and asserts they agree, one record at a time, and it
is the reason this docstring can be a paragraph instead of a plea.

### Where each check lives, and why the split matters

The same three layers `locations.py` uses. `parse()` checks **shape** and knows nothing about this
drawing. `resolve_wiring()` is handed the **netlist** and refuses by name an endpoint that is not a
terminal in it, a wire id that is not a wire in it, and a `commoning` key that is not a component
— because a wiring entry keyed on something that does not exist is the one hand-edit mistake here
whose symptom would otherwise be *nothing at all*. Same reasoning as `H14`.

**And one asymmetry against the generator, on purpose.** `read_wiring()` **raises** and writes no
netlist. This module **reports**, into a `problems` list the editor shows in its red strip — the
same treatment `locations.py` gives a malformed point. Both are right for their caller: a
generator that guessed past a broken endpoint would write a netlist the model answers from, while
an editor that refused to open would leave a person with a file they can no longer reach the screen
to fix.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

#: One, and no migration to think about yet. A reader that meets a 2 refuses it whole rather than
#: applying half of it — the same rule `locations.py` and `label_corrections.py` have.
SCHEMA = 1
READABLE = (1,)

FILENAME = "wiring.json"

#: The two sections. `wires` is what this session writes; `commoning` is Phase C's and is carried
#: through.
WIRES_SECTION = "wires"
COMMONING_SECTION = "commoning"

#: Who says these are the two terminals. See the module docstring on why there is no third value.
SOURCES = ("index", "human")

#: The two endpoint keys, in the order the netlist records them. That order is content: a wire's
#: `[from, to]` is what the two end slots are headed with, and swapping them would relabel both.
ENDS = ("from", "to")

#: The two axes a block's commoning carries, and they are the two a path carries, spelled the same
#: way in `locations.py`. `geometry` is where the line came from; `attribution` is who says it is
#: this block's bus rather than field wire.
GEOMETRIES = ("extracted", "human")
ATTRIBUTIONS = ("printed", "human")

#: Refused by name on **both** axes, as it is on a path. Not merely *not one of the two*: a value
#: spelled out in the refusal is a value somebody has to argue for before it comes back. A bus
#: derived from where a block's pins line up is the shape rule's *proposal*, and a proposal that
#: could be written into the file as though somebody had looked would undo the only thing the file
#: is for.
DERIVED = "derived"


class WiringRefused(ValueError):
    """A write that would make the whole file meaningless. Never raised by the read path."""


@dataclass(frozen=True)
class Wire:
    """One wire's two ends, and who says so.

    `from_terminal` and `to_terminal` are `None` for an end nobody has set — a real state, and the
    only honest one for a wire somebody started and has not finished. `retired` is the tombstone,
    and a retired wire has no ends at all rather than keeping the ones it used to have: saying
    where a wire went while saying it does not exist is two claims at once.
    """

    from_terminal: str | None = None
    to_terminal: str | None = None
    source: str = "index"
    #: The two endpoints this record replaced, kept forever. See the module docstring.
    was: tuple[str | None, str | None] | None = None
    note: str | None = None
    by: str | None = None
    at: str | None = None
    retired: str | None = None

    @property
    def confirmed(self) -> bool:
        """*A person looked at this one.* **Including where the endpoints did not change** —
        `I looked and it was right` is a decision, and 47 of this sheet's 71 wires are that case.
        It is the whole reason the file distinguishes `index` from `human`."""
        return self.retired is None and self.source == "human"

    @property
    def settled(self) -> bool:
        """Both ends named. A confirmed wire with a `null` end is a wire somebody started."""
        if self.retired is not None:
            return False
        return self.from_terminal is not None and self.to_terminal is not None

    @property
    def corrected(self) -> bool:
        """A confirmation that moved an endpoint, as opposed to one that agreed with the index."""
        return self.confirmed and self.was is not None


@dataclass(frozen=True)
class Commoning:
    """One terminal block's own bus: where it runs, and the two axes saying how we know.

    `runs` is a tuple of polylines — plural for the same reason a path's is, and one more besides.
    A path is a list because a crossover hop is a real gap; a bus is a list because `TB-110`'s is
    two short pieces meeting at point 3, and because the stretch of `C0105` that is `TB-0V`'s bus
    is a *part* of a conductor rather than the whole of it.

    `conductors` names the runs the polylines were lifted from and is empty on a hand trace.
    `page` is absent on a single-sheet drawing and is the only page number in this file.
    """

    runs: tuple[tuple[tuple[float, float], ...], ...]
    geometry: str
    attribution: str
    conductors: tuple[str, ...] = ()
    page: int | None = None
    note: str | None = None
    by: str | None = None
    at: str | None = None


@dataclass(frozen=True)
class Wiring:
    """The parsed file. `present` is *no such file* against *a file that said nothing*, because
    the first is the normal state of a fresh extraction and the second is a mistake."""

    present: bool = False
    wires: dict[str, Wire] = field(default_factory=dict)
    #: A block's own bus, keyed on the block's component id. Display geometry: it never reaches
    #: the netlist, and the generator does not read this section at all.
    commoning: dict[str, Commoning] = field(default_factory=dict)
    problems: tuple[str, ...] = ()

    def counts(self) -> dict[str, int]:
        live = [w for w in self.wires.values() if w.retired is None]
        return {
            "wires": len(self.wires),
            # The number the queue counts up to its own total, and the reason decision 4 asked for
            # `0 of 71` on the first run: a record nobody has looked at says `index`.
            "confirmed": sum(1 for w in live if w.confirmed),
            "corrected": sum(1 for w in live if w.corrected),
            "unset": sum(1 for w in live if not w.settled),
            "retired": sum(1 for w in self.wires.values() if w.retired is not None),
            "commoning": len(self.commoning),
        }

    def report(self) -> dict[str, Any]:
        return {"file": self.present, **self.counts(), "problems": list(self.problems)}


EMPTY = Wiring()


def wiring_path(drawing_dir: Path) -> Path:
    return drawing_dir / FILENAME


@lru_cache(maxsize=8)
def load_wiring(drawing_dir: Path) -> Wiring:
    """Parse and validate, or explain why not.

    Cached like `load_locations` and `load_corrections`, which means **any writer must call
    `load_wiring.cache_clear()`** or it will save an endpoint and be handed the old one back.
    `save_wiring()` does, and is the only supported way to write this file from the server. That is
    `H2` for the third time.
    """
    path = wiring_path(drawing_dir)
    try:
        raw = json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        return EMPTY
    except (OSError, json.JSONDecodeError) as exc:
        return Wiring(present=True, problems=(f"{FILENAME} could not be read: {exc}",))
    return parse(raw)


def parse(raw: Any) -> Wiring:
    """Shape only. See the module docstring on why the ids are checked elsewhere."""
    if not isinstance(raw, dict):
        return Wiring(present=True, problems=(f"{FILENAME} is not an object",))
    if raw.get("schema") not in READABLE:
        return Wiring(
            present=True,
            problems=(
                f"{FILENAME} declares schema {raw.get('schema')!r}, not one of {READABLE}",
            ),
        )

    problems: list[str] = []
    wires: dict[str, Wire] = {}
    section = raw.get(WIRES_SECTION)
    if section is not None and not isinstance(section, dict):
        problems.append(f"{WIRES_SECTION} is not an object")
    elif isinstance(section, dict):
        for identifier, body in section.items():
            wire = _wire(identifier, body, problems)
            if wire is not None:
                wires[identifier] = wire

    commoning: dict[str, Commoning] = {}
    block = raw.get(COMMONING_SECTION)
    if block is not None and not isinstance(block, dict):
        problems.append(f"{COMMONING_SECTION} is not an object")
    elif isinstance(block, dict):
        for identifier, body in block.items():
            bus = _commoning(identifier, body, problems)
            if bus is not None:
                commoning[identifier] = bus

    return Wiring(present=True, wires=wires, commoning=commoning, problems=tuple(problems))


def _wire(identifier: Any, body: Any, problems: list[str]) -> Wire | None:
    """One record, refused per record like everything else in this project.

    **The unit of refusal is one wire.** A malformed `W063` costs `W063` and leaves the other 70
    alone, because a file whose every endpoint is thrown away over one typo would be the worst
    possible answer to a typo — and because the editor holding this document has to be able to
    show the person the record that is wrong.
    """
    where = f"{WIRES_SECTION}[{identifier!r}]"
    if not isinstance(identifier, str) or not identifier.strip():
        problems.append(f"{where} is not a wire id")
        return None
    if not isinstance(body, dict):
        problems.append(f"{where} is not an object")
        return None

    for key in ("note", "by", "at"):
        value = body.get(key)
        if value is not None and not isinstance(value, str):
            problems.append(f"{where} has {key} {value!r}, which is not a string")
            return None

    retired = body.get("retired")
    if retired is not None:
        if not isinstance(retired, str) or not retired.strip():
            problems.append(
                f"{where} is retired with {retired!r}: a tombstone needs a reason, in words"
            )
            return None
        if body.get("from") is not None or body.get("to") is not None:
            problems.append(
                f"{where} is retired and still names endpoints; a retired wire joins nothing"
            )
            return None
        return Wire(retired=retired.strip(), source=str(body.get("source") or "human"))

    ends: list[str | None] = []
    for key in ENDS:
        if key not in body:
            problems.append(
                f"{where} has no {key!r}. Use null for an end nobody has set — the file has to be "
                "able to say *this is not settled yet*."
            )
            return None
        end = body[key]
        if end is None:
            ends.append(None)
            continue
        if not isinstance(end, str) or ":" not in end:
            problems.append(f"{where} has {key} {end!r}, which is not a COMPONENT:PIN id")
            return None
        ends.append(end)

    source = body.get("source")
    if source not in SOURCES:
        problems.append(f"{where} has source {source!r}, not one of {SOURCES}")
        return None

    was = body.get("was")
    if was is not None:
        if not (
            isinstance(was, list)
            and len(was) == 2
            and all(w is None or isinstance(w, str) for w in was)
        ):
            problems.append(
                f"{where} has was {was!r}: it keeps the two endpoints this record replaced, or is "
                "absent where nothing was replaced"
            )
            return None
        was = (was[0], was[1])

    return Wire(
        from_terminal=ends[0],
        to_terminal=ends[1],
        source=source,
        was=was,
        note=body.get("note"),
        by=body.get("by"),
        at=body.get("at"),
    )


def _commoning(identifier: Any, body: Any, problems: list[str]) -> Commoning | None:
    """One block's bus: the polylines, and the two axes saying how we know them.

    **The unit of refusal is the whole record**, unlike a wire and like a path, and for `_paths`'s
    reason: a bad `note` on one wire costs that wire because the other 70 are separate decisions,
    while half a bus is a line that stops in the middle of a terminal block and claims to be its
    commoning — which is exactly the wrong thing to draw.

    Six ways to be refused, and each is a thing a hand edit does:

    - `geometry` or `attribution` **`derived`**, named as such. The shape rule in
      `features/locate/wiring.ts` *finds* a block's bus by seeing two of one component's terminals
      on one run, and that answer is a **proposal**: `TB-130` has two points 71 pt apart with no
      conductor joining them and `TB-120:3` sits off the end of `C0092`, so the rule is already
      known to be incomplete on this sheet. A file that could record the proposal as though a
      person had accepted it would stop being a record of who said what.
    - a polyline of fewer than two points, or `runs` empty. A bus with no runs says nothing.
    - a point that is not two numbers.
    - a `page` that is not a positive whole number.
    - `conductors` that is not a list of extraction ids.

    **There is no page-size check here, and that is deliberate rather than an omission.**
    `save_locations` refuses a path point off the page because a path is on the sheet this server
    is serving. A commoning record carries its own `page`, and this format is meant to survive a
    circuit that needs several of them: measuring page 2's coordinates against page 1's size would
    refuse a legitimate record. The symptom of a mistyped coordinate here is a highlight in the
    wrong place, which is visible; the symptom of refusing page 2 would be a bus that can never be
    authored at all.
    """
    where = f"{COMMONING_SECTION}[{identifier!r}]"
    if not isinstance(identifier, str) or not identifier.strip():
        problems.append(f"{where} is not a component id")
        return None
    if not isinstance(body, dict):
        problems.append(f"{where} is not an object")
        return None

    for key in ("note", "by", "at"):
        value = body.get(key)
        if value is not None and not isinstance(value, str):
            problems.append(f"{where} has {key} {value!r}, which is not a string")
            return None

    axes: dict[str, str] = {}
    for key, allowed in (("geometry", GEOMETRIES), ("attribution", ATTRIBUTIONS)):
        word = body.get(key)
        if word == DERIVED:
            problems.append(
                f"{where} has {key} {DERIVED!r}: a block's bus is lifted from the ink or traced "
                "by a person, never derived from where its pins line up"
            )
            return None
        if word not in allowed:
            problems.append(f"{where} has {key} {word!r}, not one of {allowed}")
            return None
        axes[key] = word

    raw_runs = body.get("runs")
    if not isinstance(raw_runs, list) or not raw_runs:
        problems.append(f"{where}.runs is not a list of at least one polyline")
        return None

    runs: list[tuple[tuple[float, float], ...]] = []
    for index, raw_run in enumerate(raw_runs):
        at = f"{where}.runs[{index}]"
        if not isinstance(raw_run, list) or len(raw_run) < 2:
            problems.append(f"{at} has fewer than two points: a run of one point is not a bus")
            return None
        points: list[tuple[float, float]] = []
        for point in raw_run:
            pair = _pair(point)
            if pair is None:
                problems.append(f"{at} has a point that is not two numbers: {point!r}")
                return None
            points.append(pair)
        runs.append(tuple(points))

    conductors = body.get("conductors")
    if conductors is not None and not (
        isinstance(conductors, list) and all(isinstance(c, str) for c in conductors)
    ):
        problems.append(f"{where}.conductors is not a list of extraction ids")
        return None

    page = body.get("page")
    if page is not None and (not isinstance(page, int) or isinstance(page, bool) or page < 1):
        problems.append(
            f"{where} has page {page!r}: a polyline only means something on a sheet, and a sheet "
            "is numbered from 1"
        )
        return None

    return Commoning(
        runs=tuple(runs),
        geometry=axes["geometry"],
        attribution=axes["attribution"],
        conductors=tuple(conductors or ()),
        page=page,
        note=body.get("note"),
        by=body.get("by"),
        at=body.get("at"),
    )


def _pair(value: Any) -> tuple[float, float] | None:
    """Two numbers, and `bool` is not one of them — `True` is an `int` in Python and a coordinate
    of `true` is a typo rather than a point at x = 1."""
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        return None
    out: list[float] = []
    for number in value:
        if isinstance(number, bool) or not isinstance(number, (int, float)):
            return None
        out.append(float(number))
    return (out[0], out[1])


# -- writing -------------------------------------------------------------------------------


def save_wiring(drawing_dir: Path, raw: Any, *, drawing_number: str | None = None) -> Wiring:
    """Replace `wiring.json`, atomically, and invalidate the parse.

    The same shape of write as `save_locations` and `save_corrections`: whole-file, so there is no
    patch protocol to get wrong; atomic through `os.replace` in the same directory, so a reader
    sees the whole old file or the whole new one; and everything not fatal is written and *then*
    reported, so what the editor is told was refused is exactly what the next read will refuse.

    **Two refusals, and still no `page_size_pt` check.** A payload that is not an object, and an
    unknown schema — plus a `drawing_number` naming a different drawing, which is the mistake
    somebody with two tabs open will actually make.

    Since Phase C one section of this file *does* hold coordinates, and the argument for not
    measuring them has changed rather than gone away. A `commoning` record carries its own `page`
    precisely so this format survives a circuit that needs several sheets, and checking page 2's
    polyline against the page size of the sheet this server happens to be serving would refuse a
    legitimate record. `_commoning` says the same thing at more length.
    """
    if not isinstance(raw, dict):
        raise WiringRefused(f"{FILENAME} must be a JSON object.")
    if raw.get("schema") not in READABLE:
        raise WiringRefused(
            f"{FILENAME} declares schema {raw.get('schema')!r}; this server writes {SCHEMA}."
        )
    named = raw.get("drawing_number")
    if drawing_number and named and named != drawing_number:
        raise WiringRefused(
            f"This payload is for {named!r} and the server is serving {drawing_number!r}. "
            "What one sheet's wires join says nothing about another's."
        )

    path = wiring_path(drawing_dir)
    # Indented and newline-terminated because this is authored content: it lives in git beside
    # `author_circuit_logic.py`, and a one-endpoint diff should be a one-line diff.
    body = json.dumps(raw, indent=2, ensure_ascii=False) + "\n"
    temp = path.with_name(f".{path.name}.tmp")
    try:
        temp.write_text(body, encoding="utf-8")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)

    load_wiring.cache_clear()
    return load_wiring(drawing_dir)


def skeleton(drawing_number: str | None) -> dict[str, Any]:
    """What `GET /api/wiring` answers for a drawing nobody has a wiring file for.

    An empty document rather than a 404, so the editor's load path has one shape — the same
    argument as `locations.skeleton`. **It is not what the generator will accept**, and that is
    correct: `read_wiring()` refuses an absent file by name and tells you to run
    `bootstrap_wiring.py`, because a netlist written from an empty wiring file would silently fall
    back to 71 guesses. This skeleton exists so the *screen* opens, not so the generator runs.
    """
    return {
        "drawing_number": drawing_number,
        "schema": SCHEMA,
        WIRES_SECTION: {},
        COMMONING_SECTION: {},
    }


# -- resolution ----------------------------------------------------------------------------


def resolve_wiring(drawing_dir: Path, doc: dict[str, Any]) -> Wiring:
    """Lay the file over the netlist, and name every record that lands on nothing.

    The analogue of `resolve_geometry` and `resolve_corrections`, and the same three-layer split:
    `parse` knows this file's shape, the netlist knows what exists, and this is the only function
    that knows the two are about the same drawing.

    Three refusals, all **by name**, and every one of them has a symptom that would otherwise be
    nothing at all:

    - **an endpoint that is not a terminal in the netlist.** It connects nothing, is never drawn,
      and the generator would refuse it hours later in a command about an edit nobody remembers.
    - **a record for a wire the netlist does not have.** Adding a wire is Phase E; until then an id
      the netlist has never heard of is a typo, and a typo here would invent a connection.
    - **a `commoning` key that is not a component.** A block's bus keyed on nothing would be
      authored, saved, and never highlighted.

    The refused record is **dropped** and reported, so the screen shows the person exactly what the
    next reader will ignore.
    """
    stored = load_wiring(drawing_dir)
    terminals = {t.get("id") for t in doc.get("terminals", []) if isinstance(t, dict)}
    wire_ids = {w.get("id") for w in doc.get("wires", []) if isinstance(w, dict)}
    components = {c.get("id") for c in doc.get("components", []) if isinstance(c, dict)}

    problems = list(stored.problems)
    wires: dict[str, Wire] = {}
    for identifier, wire in stored.wires.items():
        if identifier not in wire_ids:
            problems.append(
                f"{FILENAME} has a record for {identifier!r}, which is not a wire in this netlist"
            )
            continue
        bad = [
            end
            for end in (wire.from_terminal, wire.to_terminal)
            if end is not None and end not in terminals
        ]
        if bad:
            problems.append(
                f"{FILENAME} lands {identifier} on "
                + " and ".join(repr(end) for end in bad)
                + ", which is not a terminal in this netlist"
            )
            continue
        wires[identifier] = wire

    commoning: dict[str, Commoning] = {}
    for identifier, body in stored.commoning.items():
        if identifier not in components:
            problems.append(
                f"{FILENAME} records commoning for {identifier!r}, which is not a component in "
                "this netlist"
            )
            continue
        commoning[identifier] = body

    return Wiring(
        present=stored.present, wires=wires, commoning=commoning, problems=tuple(problems)
    )
