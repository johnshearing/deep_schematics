"""Where things are drawn on the sheet — the half of the extraction a human owns.

`circuit_logic.json` says what is connected; `locations.json` says where it is drawn. They are
separate files because they are edited at different times, by different tools, with different
authority: the netlist comes out of `author_circuit_logic.py` and is regenerated wholesale, while
a coordinate is put there by a person looking at the drawing and must survive that regeneration.

**This is an authored file, not a cache.** `author_circuit_logic.py` reads it too and folds what
it finds into `circuit_logic.json`, so the project's original rule still holds — hand-maintained
files are the source, everything else is generated. There are now two hand-maintained files, one
per question: what connects, and where it is.

### Two provenances, and deliberately no third

`confirmed` is a person in the Locate editor. `seed` is the extraction's own vision estimate —
the `x=`/`y=` arguments in `author_circuit_logic.py`, made by the pass that was actually looking
at the pixels — and it is never dressed up as knowledge. `parent`, which only the resolver
produces and the file cannot contain, is a terminal being shown at its component's point because
nobody has placed the pin itself.

There is **no `derived` tier and no derivation in this module**, and that is a decision rather
than an omission. A previous attempt proposed coordinates here by matching printed net labels in
`geometry.json` against the netlist; measured against the sheet its median error was 11 pt on a
drawing whose conductor rows are 16 pt apart, so it was a coin flip on the only question that
matters — which row. A guess that accurate converts a human's placing work into auditing work of
the same size, and costs *more* on the cases where it is confidently wrong. Claude gets its one
chance to guess when the schematic is indexed; after that a human owns the positions, and this
file records who said what.

### Why a component has *sites*

A component is not drawn in one place. `CR-SW` appears twice on PS20115MLM4-2 — its coil in the
right-hand column, its contact eight inches away — and `CR-BP` appears three times, because its
NC contact (`11`/`12`) and its NO contact (`21`/`24`) are drawn in different circuits. So a
component owns a *list* of sites, each with a point and the terminals drawn at it, and the length
of that list is per-drawing data. Anything shaped like "a coil point and a contact point" is
already wrong on this sheet, never mind the next one.

Terminals are assigned to a site **explicitly**, never inferred from their function: `CR-BP` has
two terminals whose function is `common` (`11` and `21`) at different sites, so function cannot
disambiguate them. A terminal may also carry its own point, which is how `A1` and `A2` end up 20
pt apart as printed rather than sharing the coil's.

### Why wires and nets get label positions and nothing else

    components   sites, each with a point and the pins drawn there
    terminals    a point of its own, which beats the site claiming that pin
    wires        label_point — where `BLUE 18AWG` is written
                 labels      — which side of each end's pin its end label sits on
    nets         label_point — where the net number is written beside its conductor
                 labels      — the same, per member terminal

A wire has no place of its own. Its geometry is its two endpoint terminals, and drawing a line
between them because no conductor in `geometry.json` joined them would be **inventing a wire
route** — the one thing the netlist's authority rests on never doing. So placing 131 terminals
gives all 71 wires their positions for free, and no `wires` entry can ever say where a wire goes.

But the *text* is printed somewhere specific, and a reader following a citation of `W048` wants to
land on it rather than on the midpoint of a rectangle. `label_point` is that, and the key is named
after what it holds so the next reader is not tempted to treat it as the wire's location. It is
optional in a way a terminal's point is not: a terminal with no point is missing data, a wire with
no label point is merely unpolished, and the editor counts them separately for that reason.

### End labels, and why the file holds almost none of them

Schema 2 adds `labels`, keyed by **terminal id**, to both sections. It is the answer to a different
question from `label_point`: not *where is this wire's name printed on the run* but *which side of
each of its two ends does its name hang off*. Both may exist at once and neither implies the other.

**Every wire end and every net terminal has an end label by default**, computed by the viewer from
points that already exist — away from the wire's other end, away from the net's centroid — so 269
labels appear on this drawing and **none of them is work**. This file stores only the exceptions: a
side a person chose, or a label they hid. An empty `labels` therefore means *every default is
right*, which is the normal case, and it is what keeps a queue of 269 rows from existing. (That
queue is `K7` in the manual, and not repeating it was a design requirement rather than an accident.)

A default is **never** written in as though a human had chosen it. Storing the value the rule would
have produced anyway makes the file stop distinguishing *nobody has looked at this* from *a person
decided this*, which is the distinction the whole file exists for — so *Reset to default* deletes
the override rather than writing the computed side.

The key is validated against the netlist rather than here: a side on a terminal the wire does not
touch is refused **by name** in `resolve_geometry`, because it is the one mistake a hand edit can
make here that has no visible symptom on screen.

### Three layers, and why they are separate functions

`load_locations()` validates *shape*: a point is two numbers, a source is a word we know, a label
direction is a compass point. It knows nothing about this drawing.

`resolve_geometry()` is handed the parsed netlist and layers the file over it — checking that every
id named actually exists, that no pin is claimed by two sites, and falling back to the vision-pass
estimate where nothing is confirmed. It is the only place that decides where anything is, which is
why `drawing.py` calls it rather than reimplementing the precedence.

`save_locations()` is the editor's write path: whole-file, atomic, and cache-invalidating. It
refuses only the four things that would make the whole file meaningless — a payload that is not an
object, an unknown schema, another drawing's number, another page size — and lets everything else
through to the same per-field validation the reader applies, so that what the editor is told was
refused is exactly what the next read will refuse.

Everything rejected by any of the three lands in `problems` with a reason rather than raising. A
bad locations file has to mean "no confirmed geometry", exactly as a bad tile manifest means "no
viewer" — the alternative is an extraction that cannot be served at all. The Locate editor shows
that list, because a coordinate a human typed and the server silently ignored is the worst outcome
available here.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

#: Bumped only for a change old readers must not silently misinterpret. A file declaring anything
#: outside `READABLE` is refused whole — half-understood coordinates are worse than none.
#:
#: **2 adds `labels`** to the `wires` and `nets` sections: the end-label overrides. Nothing in
#: `components` or `terminals` changed, which is why 1 is still readable — a schema-1 file has no
#: new keys to convert, so the upgrade is the version number and nothing else. The editor stamps
#: `SCHEMA` onto the draft when it loads one, so the next save writes 2.
SCHEMA = 2

#: The versions this server understands. A 2 read by a server that only knows 1 is refused loudly
#: by that server's own check, which is correct: it would drop every end label silently otherwise.
READABLE = (1, 2)

FILENAME = "locations.json"

#: The eight sides a label may sit on, relative to its dot. `e` is the default and is what the
#: viewer does when nothing is stored.
COMPASS = ("n", "ne", "e", "se", "s", "sw", "w", "nw")

#: Who put a point here, as the *file* spells it. Two values and no more: a person placed it, or
#: it is the indexing pass's estimate. See the module docstring on why there is no third.
SOURCES = ("human", "seed")


class LocationsRefused(ValueError):
    """A write that would make the whole file meaningless. Never raised by the read path."""


@dataclass(frozen=True)
class Placed:
    """A point somebody put somewhere, with who says so."""

    point: tuple[float, float]
    source: str
    label_dir: str | None = None


@dataclass(frozen=True)
class EndLabel:
    """One end label a person has taken a decision about, and nothing else is stored.

    `dir` is the side they chose; `hidden` is *"do not draw this one at all"*. Both optional and at
    least one present — an entry with neither says nothing, and a record that says nothing is a
    mistake worth reporting rather than a fact worth keeping.
    """

    dir: str | None = None
    hidden: bool = False


@dataclass(frozen=True)
class Site:
    """One place a component is drawn, and the terminals drawn there (bare pin names)."""

    id: str
    placed: Placed
    terminals: tuple[str, ...] = ()


@dataclass(frozen=True)
class Locations:
    """The parsed file. `present` distinguishes "no such file" from "a file that said nothing",
    because the first is the normal state of a fresh extraction and the second is a mistake."""

    present: bool = False
    page_size_pt: tuple[float, float] | None = None
    sites: dict[str, tuple[Site, ...]] = field(default_factory=dict)
    terminals: dict[str, Placed] = field(default_factory=dict)
    #: Where a wire's or a net's *name* is written on the sheet, keyed by wire or net id. See
    #: the module docstring: this is a label position and never a route.
    labels: dict[str, Placed] = field(default_factory=dict)
    #: The end-label exceptions: wire or net id → terminal id → what a person decided. Only
    #: overrides are here; everything absent is at the side the viewer's rule computes.
    end_labels: dict[str, dict[str, EndLabel]] = field(default_factory=dict)
    problems: tuple[str, ...] = ()

    def site_for(self, component: str, pin: str) -> Site | None:
        """The site that claims this pin, or None. First claim wins; a pin claimed twice is
        reported by `resolve_geometry` rather than arbitrated here."""
        for site in self.sites.get(component, ()):
            if pin in site.terminals:
                return site
        return None

    def counts(self) -> dict[str, int]:
        sites = [s for group in self.sites.values() for s in group]
        return {
            "components": len(self.sites),
            "sites": len(sites),
            "confirmed_sites": sum(1 for s in sites if s.placed.source == "human"),
            "terminals": len(self.terminals),
            "confirmed_terminals": sum(
                1 for p in self.terminals.values() if p.source == "human"
            ),
            "labels": len(self.labels),
            "confirmed_labels": sum(1 for p in self.labels.values() if p.source == "human"),
            # Overrides, not labels: every wire end and net terminal has one already. This is
            # how many a person has moved or hidden, which is the only part anybody authored.
            "end_labels": sum(len(ends) for ends in self.end_labels.values()),
        }


EMPTY = Locations()


def locations_path(drawing_dir: Path) -> Path:
    return drawing_dir / FILENAME


@lru_cache(maxsize=8)
def load_locations(drawing_dir: Path) -> Locations:
    """Parse and validate, or explain why not.

    Cached like `load_circuit_logic`, and for the same reason — it is read on every
    `/api/designators` — which means **any writer must call `load_locations.cache_clear()`**, or it
    will save a point and be handed back the old one. `save_locations()` below does exactly that,
    and is the only supported way to write the file from the server.
    """
    path = locations_path(drawing_dir)
    try:
        raw = json.loads(path.read_text("utf-8"))
    except FileNotFoundError:
        return EMPTY
    except (OSError, json.JSONDecodeError) as exc:
        return Locations(present=True, problems=(f"{FILENAME} could not be read: {exc}",))
    return parse(raw)


def parse(raw: Any) -> Locations:
    """The shape validation, split out so the write path can apply it to a payload that is not
    on disk yet and answer with the same words the next read will use."""
    if not isinstance(raw, dict):
        return Locations(present=True, problems=(f"{FILENAME} is not an object",))
    if raw.get("schema") not in READABLE:
        return Locations(
            present=True,
            problems=(
                f"{FILENAME} declares schema {raw.get('schema')!r}, not one of {READABLE}",
            ),
        )

    problems: list[str] = []
    page = _page_size(raw.get("page_size_pt"), problems)
    sites = _sites(raw.get("components"), problems)
    terminals = _terminals(raw.get("terminals"), problems)
    labels, end_labels = _labels(raw, problems)
    return Locations(
        present=True,
        page_size_pt=page,
        sites=sites,
        terminals=terminals,
        labels=labels,
        end_labels=end_labels,
        problems=tuple(problems),
    )


def _page_size(value: Any, problems: list[str]) -> tuple[float, float] | None:
    if value is None:
        return None
    pair = _floats(value, 2)
    if pair is None or pair[0] <= 0 or pair[1] <= 0:
        problems.append(f"page_size_pt is not two positive numbers: {value!r}")
        return None
    return pair[0], pair[1]


def _sites(value: Any, problems: list[str]) -> dict[str, tuple[Site, ...]]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        problems.append("components is not an object")
        return {}

    out: dict[str, tuple[Site, ...]] = {}
    for cid, body in value.items():
        if not isinstance(cid, str) or not isinstance(body, dict):
            problems.append(f"components[{cid!r}] is not an object")
            continue
        raw_sites = body.get("sites")
        if not isinstance(raw_sites, list):
            problems.append(f"{cid}: sites is not a list")
            continue

        sites: list[Site] = []
        for index, entry in enumerate(raw_sites):
            site = _site(cid, index, entry, problems)
            if site is None:
                continue
            if any(s.id == site.id for s in sites):
                problems.append(f"{cid}: two sites are both called {site.id!r}")
                continue
            sites.append(site)
        if sites:
            out[cid] = tuple(sites)
    return out


def _site(cid: str, index: int, entry: Any, problems: list[str]) -> Site | None:
    where = f"{cid}: sites[{index}]"
    if not isinstance(entry, dict):
        problems.append(f"{where} is not an object")
        return None

    sid = entry.get("id")
    if not isinstance(sid, str) or not sid.strip():
        problems.append(f"{where} has no id")
        return None
    placed = _placed(where, entry, problems)
    if placed is None:
        return None

    pins: list[str] = []
    for pin in entry.get("terminals") or []:
        # Numbers are what the sheet prints, so `11` will be written as an int sooner or later.
        if isinstance(pin, str | int) and not isinstance(pin, bool):
            text = str(pin).strip()
            if text and text not in pins:
                pins.append(text)
        else:
            problems.append(f"{where} lists a terminal that is not a name: {pin!r}")
    return Site(id=sid.strip(), placed=placed, terminals=tuple(pins))


def _terminals(value: Any, problems: list[str]) -> dict[str, Placed]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        problems.append("terminals is not an object")
        return {}

    out: dict[str, Placed] = {}
    for tid, body in value.items():
        if not isinstance(tid, str) or ":" not in tid:
            problems.append(f"terminals[{tid!r}] is not a COMPONENT:PIN id")
            continue
        if not isinstance(body, dict):
            problems.append(f"terminals[{tid}] is not an object")
            continue
        placed = _placed(f"terminals[{tid}]", body, problems)
        if placed is not None:
            out[tid] = placed
    return out


#: The two sections that hold label positions. Kept separate in the *file* because a person reads
#: it and `"wires"` beside `"nets"` is how they would have written it; merged into one dict here
#: because the resolver only ever asks "does this id have a label point".
LABEL_SECTIONS = ("wires", "nets")

#: Wires and nets store the position of their *name*, under a key that says so. Calling it
#: `point` would invite the next reader to treat it as the wire's location, which is the one
#: thing it is not — see the module docstring.
LABEL_KEY = "label_point"


#: The key holding the end-label overrides, and the two things one of them may say.
END_LABELS_KEY = "labels"


def _labels(
    raw: dict[str, Any], problems: list[str]
) -> tuple[dict[str, Placed], dict[str, dict[str, EndLabel]]]:
    """`wires` and `nets`, holding where the name is written and which way each end's label faces.

    A wire has no place of its own here. A route **synthesised from its two endpoint terminals** is
    the one thing the netlist's authority rests on never inventing — a straight chord between two
    pins no conductor joined is not slightly wrong, it is somewhere else, across circuits the wire
    never touches. (A route *lifted from the PDF's own conductor strokes*, or traced by a person
    along the printed conductor, is a different thing and is not in this schema yet; when it arrives
    it will say which of the two it was. `derived` is a rejected value in that vocabulary as it is
    in this one.) But the *text* — `BLUE 18AWG`, or a net number beside a conductor — is printed
    somewhere specific on the sheet, and a reader following a citation wants to land on it. So
    `label_point` is one of the two things either section can carry, and `labels` is the other.

    **`label_point` is required only when there is nothing else.** A record with end-label
    overrides and no point is a complete, sensible thing to say — *this wire's ends face these
    ways, and nobody has said where its printed name is* — and demanding a point would report it
    as broken. A record with neither is a record that says nothing, and that is still reported
    naming `label_point`, because on a schema-1 file that is the only key it could have meant.
    """
    out: dict[str, Placed] = {}
    ends: dict[str, dict[str, EndLabel]] = {}
    seen: set[str] = set()
    for section in LABEL_SECTIONS:
        value = raw.get(section)
        if value is None:
            continue
        if not isinstance(value, dict):
            problems.append(f"{section} is not an object")
            continue
        for identifier, body in value.items():
            if not isinstance(identifier, str) or not identifier.strip():
                problems.append(f"{section}[{identifier!r}] is not an id")
                continue
            if not isinstance(body, dict):
                problems.append(f"{section}[{identifier}] is not an object")
                continue
            if identifier in seen:
                # Only reachable if a wire and a net share an id, which this drawing's do not.
                # Reported rather than arbitrated: silently preferring one would move a label.
                problems.append(f"{identifier!r} has a label in both wires and nets")
                continue
            seen.add(identifier)
            where = f"{section}[{identifier}]"

            overrides = _end_labels(where, body.get(END_LABELS_KEY), problems)
            if overrides:
                ends[identifier] = overrides
            # Only demanded when the record has no end labels to justify its existence.
            if LABEL_KEY in body or END_LABELS_KEY not in body:
                placed = _placed(where, body, problems, key=LABEL_KEY)
                if placed is not None:
                    out[identifier] = placed
    return out, ends


def _end_labels(
    where: str, value: Any, problems: list[str]
) -> dict[str, EndLabel]:
    """The `labels` map: terminal id → the decision a person took about that end.

    Per field, like everything else here, and the unit is **one end label**: a bad `dir` costs that
    end and leaves the wire's other end alone. Whether the terminal is one this wire or net
    actually touches is not knowable from the file alone and is checked in `resolve_geometry`.
    """
    if value is None:
        return {}
    if not isinstance(value, dict):
        problems.append(f"{where}.{END_LABELS_KEY} is not an object")
        return {}

    out: dict[str, EndLabel] = {}
    for terminal, body in value.items():
        at = f"{where}.{END_LABELS_KEY}[{terminal!r}]"
        if not isinstance(terminal, str) or ":" not in terminal:
            problems.append(f"{at} is not a COMPONENT:PIN id")
            continue
        if not isinstance(body, dict):
            problems.append(f"{at} is not an object")
            continue

        direction = body.get("dir")
        if direction is not None and direction not in COMPASS:
            problems.append(f"{at} has dir {direction!r}, not one of {COMPASS}")
            continue
        hidden = body.get("hidden")
        if hidden is not None and not isinstance(hidden, bool):
            problems.append(f"{at} has hidden {hidden!r}, which is not true or false")
            continue
        if direction is None and not hidden:
            # Nothing decided. Refused rather than kept, because a file full of empty records is
            # a file that can no longer tell you what a person actually chose — and `hidden:
            # false` is the shape *Reset to default* must never leave behind.
            problems.append(f"{at} says nothing: an end label needs a dir or hidden")
            continue
        out[terminal] = EndLabel(dir=direction, hidden=bool(hidden))
    return out


def _placed(
    where: str, entry: dict[str, Any], problems: list[str], key: str = "point"
) -> Placed | None:
    point = _floats(entry.get(key), 2)
    if point is None:
        problems.append(f"{where} has no usable {key}: {entry.get(key)!r}")
        return None

    source = entry.get("source")
    if source not in SOURCES:
        problems.append(f"{where} has source {source!r}, not one of {SOURCES}")
        return None

    return Placed(
        point=(point[0], point[1]),
        source=source,
        label_dir=_label_dir(where, entry, problems),
    )


def _label_dir(where: str, entry: dict[str, Any], problems: list[str]) -> str | None:
    label = entry.get("label")
    if label is None:
        return None
    if not isinstance(label, dict):
        problems.append(f"{where} has a label that is not an object")
        return None
    direction = label.get("dir")
    if direction is None:
        return None
    if direction not in COMPASS:
        problems.append(f"{where} has label dir {direction!r}, not one of {COMPASS}")
        return None
    return direction


def _floats(value: Any, count: int) -> list[float] | None:
    if not isinstance(value, list) or len(value) != count:
        return None
    try:
        return [float(v) for v in value]
    except (TypeError, ValueError):
        return None


# -- writing -------------------------------------------------------------------------------


def save_locations(
    drawing_dir: Path,
    raw: Any,
    *,
    drawing_number: str | None = None,
    page_size_pt: tuple[float, float] | list[float] | None = None,
) -> Locations:
    """Replace `locations.json` with `raw`, atomically, and invalidate the parse.

    **Whole-file, not a patch.** The editor holds the document it loaded and sends it back, so
    there is no merge to get wrong and no partial state to recover from — and a text file a human
    can also open in an editor stays the source of truth rather than becoming a database with a
    JSON skin.

    Four refusals, and each of them would otherwise destroy work in exchange for something the
    reader will throw away anyway: a payload that is not an object, an unknown `schema`, a
    `drawing_number` that names a different drawing, and a `page_size_pt` that does not match the
    page this extraction renders at. Everything else is written and then reported: the returned
    `Locations` is the fresh parse, so the caller publishes exactly the `problems` the next read
    will produce.

    The temp file is created in the same directory so `os.replace` stays on one filesystem, which
    is what makes it atomic — a reader either sees the whole old file or the whole new one, never
    a truncated one.
    """
    if not isinstance(raw, dict):
        raise LocationsRefused(f"{FILENAME} must be a JSON object.")
    # Every version this server can read, it can also write back. The editor stamps `SCHEMA` onto
    # the draft as it loads, so in practice a save arrives as 2 and the file is upgraded by being
    # written — but a browser holding a cached bundle from before the bump must not have every one
    # of its saves refused, which would turn a stale tab into silent, total data loss.
    if raw.get("schema") not in READABLE:
        raise LocationsRefused(
            f"{FILENAME} declares schema {raw.get('schema')!r}; this server writes {SCHEMA}."
        )

    named = raw.get("drawing_number")
    if drawing_number and named and named != drawing_number:
        raise LocationsRefused(
            f"This payload is for {named!r} and the server is serving {drawing_number!r}. "
            "Points from one drawing are meaningless on another."
        )

    declared = _floats(raw.get("page_size_pt"), 2) if raw.get("page_size_pt") is not None else None
    if declared and page_size_pt and list(declared) != list(page_size_pt):
        raise LocationsRefused(
            f"This payload was measured on a {declared[0]}×{declared[1]} pt page and this "
            f"drawing renders at {page_size_pt[0]}×{page_size_pt[1]} pt."
        )

    path = locations_path(drawing_dir)
    # Indented and newline-terminated because this is an authored file: it lives in git beside
    # `author_circuit_logic.py`, and a one-line diff should be one line.
    body = json.dumps(raw, indent=2, ensure_ascii=False) + "\n"
    temp = path.with_name(f".{path.name}.tmp")
    try:
        temp.write_text(body, encoding="utf-8")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)

    # The one bug this design can have, and the whole reason this function exists rather than
    # the route writing the file itself.
    load_locations.cache_clear()
    return load_locations(drawing_dir)


def skeleton(
    drawing_number: str | None, page_size_pt: tuple[float, float] | list[float] | None
) -> dict[str, Any]:
    """What `GET /api/locations` answers for an extraction nobody has placed anything on yet.

    An empty document rather than a 404, so the editor's load path has one shape: a fresh drawing
    and a half-placed one differ in content and not in kind.
    """
    return {
        "drawing_number": drawing_number,
        "schema": SCHEMA,
        "page_size_pt": list(page_size_pt) if page_size_pt else None,
        "components": {},
        "terminals": {},
        "wires": {},
        "nets": {},
    }


# -- resolution ----------------------------------------------------------------------------
#
# Everything below answers one question — "where is this drawn?" — for the whole application.

#: What the API calls a point's provenance. `confirmed`/`seed` map from the file's `source`;
#: `parent` is the fallback and has no counterpart in the file, because it is not a stored fact
#: but the absence of one.
PLACEMENT = {"human": "confirmed", "seed": "seed"}


@dataclass(frozen=True)
class Spot:
    """A resolved point, ready to publish: where, how well we know it, and which site it came
    from (`None` for a terminal falling back to its parent, or a component with no sites)."""

    point: tuple[float, float]
    placement: str
    site: str | None = None
    label_dir: str | None = None

    @classmethod
    def of(cls, placed: Placed, site: str | None) -> Spot:
        return cls(placed.point, PLACEMENT[placed.source], site, placed.label_dir)


@dataclass(frozen=True)
class Geometry:
    """The resolved answer for one drawing. Built once per request by `resolve_geometry()`."""

    components: dict[str, tuple[Spot, ...]]
    terminals: dict[str, Spot]
    problems: tuple[str, ...]
    counts: dict[str, int]
    #: Where a wire's or net's name is written, for the ones somebody has placed. Not geometry:
    #: `rect` still frames the run, and this is only where the text sits.
    labels: dict[str, Spot] = field(default_factory=dict)
    #: The end-label overrides that survived the check against the netlist: wire or net id →
    #: terminal id → what a person decided. Absent means *the computed default*, which is the
    #: normal state of 269 of this drawing's end labels.
    end_labels: dict[str, dict[str, EndLabel]] = field(default_factory=dict)
    #: Whether there is a `locations.json` at all. A fresh extraction has none, which is not a
    #: problem; a file that parsed to nothing is.
    present: bool = False

    def component(self, component_id: str) -> list[Spot]:
        """Every place this component is drawn, in file order. Empty if it has none — the two
        off-page machines and the four referenced drawings."""
        return list(self.components.get(component_id, ()))

    def terminal(self, terminal_id: str | None) -> Spot | None:
        return self.terminals.get(terminal_id) if terminal_id else None

    def label(self, identifier: str | None) -> Spot | None:
        return self.labels.get(identifier) if identifier else None

    def end_label(self, identifier: str | None, terminal_id: str | None) -> EndLabel | None:
        """What a person decided about this one end of this one wire or net, or None for *nobody
        has said anything, use the default*."""
        if not identifier or not terminal_id:
            return None
        return self.end_labels.get(identifier, {}).get(terminal_id)

    def report(self) -> dict[str, Any]:
        return {"file": self.present, **self.counts, "problems": list(self.problems)}


def resolve_geometry(
    drawing_dir: Path,
    doc: dict[str, Any],
    page_size_pt: tuple[float, float] | list[float] | None = None,
) -> Geometry:
    """Layer `locations.json` over the netlist's own estimates.

    `page_size_pt` is the rendered sheet size from the tile manifest, when there is one. A stored
    point is meaningless against a different page, so a file that disagrees is refused whole
    rather than applied at an offset — the caller passes the size in because the manifest lives in
    `drawing.py` and this module must not import it back.
    """
    stored = load_locations(drawing_dir)
    problems = list(stored.problems)

    if stored.page_size_pt and page_size_pt and list(stored.page_size_pt) != list(page_size_pt):
        problems.append(
            f"{FILENAME} was written for a {stored.page_size_pt[0]}×{stored.page_size_pt[1]} pt "
            f"page and this drawing renders at {page_size_pt[0]}×{page_size_pt[1]} pt — "
            "every point in it is ignored"
        )
        stored = Locations(present=True)

    components = [c for c in (doc.get("components") or []) if isinstance(c, dict)]
    terminals = [t for t in (doc.get("terminals") or []) if isinstance(t, dict)]
    known_components = {c["id"] for c in components if isinstance(c.get("id"), str)}
    known_terminals = {t["id"] for t in terminals if isinstance(t.get("id"), str)}
    # What each wire or net is *made of*, which is what an end label may be keyed on. A wire's is
    # its two endpoint terminals and a net's is its members; anything else is a label on a pin the
    # thing does not touch, which draws nothing and is invisible on screen.
    touches: dict[str, set[str]] = {}
    for item in doc.get("wires") or []:
        if isinstance(item, dict) and isinstance(item.get("id"), str):
            pair = (item.get("from_terminal"), item.get("to_terminal"))
            touches[item["id"]] = {t for t in pair if isinstance(t, str)}
    for item in doc.get("nets") or []:
        if isinstance(item, dict) and isinstance(item.get("id"), str):
            touches[item["id"]] = {
                t for t in (item.get("member_terminals") or []) if isinstance(t, str)
            }
    known_labels = set(touches)
    owner_of = {
        t["id"]: t.get("parent_component") for t in terminals if isinstance(t.get("id"), str)
    }

    for cid in stored.sites:
        if cid not in known_components:
            problems.append(f"{FILENAME} places {cid!r}, which is not in circuit_logic.json")
    for tid in stored.terminals:
        if tid not in known_terminals:
            problems.append(f"{FILENAME} places terminal {tid!r}, which is not in the netlist")
    for lid in stored.labels:
        if lid not in known_labels:
            problems.append(
                f"{FILENAME} places a label for {lid!r}, which is not a wire or net in the netlist"
            )

    # The end labels, checked against the membership. This is the only refusal in the file whose
    # symptom would otherwise be *nothing at all*: a side stored against a pin the wire does not
    # touch is never drawn, never reported, and looks exactly like a compass control that does not
    # work. So it is named, and the label is dropped rather than kept as a fact about nowhere.
    resolved_end_labels: dict[str, dict[str, EndLabel]] = {}
    for lid, overrides in stored.end_labels.items():
        if lid not in known_labels:
            problems.append(
                f"{FILENAME} labels the ends of {lid!r}, which is not a wire or net in the netlist"
            )
            continue
        kept = {}
        for tid, override in overrides.items():
            if tid not in touches[lid]:
                problems.append(
                    f"{FILENAME} puts a label on {tid!r} for {lid}, which {lid} does not touch"
                )
                continue
            kept[tid] = override
        if kept:
            resolved_end_labels[lid] = kept

    resolved_components: dict[str, tuple[Spot, ...]] = {}
    for component in components:
        cid = component.get("id")
        if not isinstance(cid, str):
            continue
        sites = stored.sites.get(cid, ())
        if sites:
            resolved_components[cid] = tuple(Spot.of(s.placed, s.id) for s in sites)
            continue
        # No stored site: the vision pass's own estimate, said to be an estimate.
        estimate = _point(component.get("location"))
        if estimate is not None:
            resolved_components[cid] = (Spot(estimate, "seed"),)

    resolved_terminals: dict[str, Spot] = {}
    for terminal in terminals:
        tid = terminal.get("id")
        if not isinstance(tid, str):
            continue
        owner = owner_of.get(tid)
        pin = tid.split(":", 1)[1] if ":" in tid else None

        own = stored.terminals.get(tid)
        if own is not None:
            resolved_terminals[tid] = Spot.of(own, None)
            continue

        site = stored.site_for(owner, pin) if isinstance(owner, str) and pin else None
        if site is not None:
            resolved_terminals[tid] = Spot.of(site.placed, site.id)
            continue

        # The fallback, and the reason `placement` exists: the component's point is not the pin's.
        primary = resolved_components.get(owner if isinstance(owner, str) else "", ())
        if primary:
            resolved_terminals[tid] = Spot(primary[0].point, "parent", None, primary[0].label_dir)

    # Checked over the sites rather than over the terminals, because `site_for` answers with the
    # first claim and would hide the second — which is the whole thing being looked for here.
    for cid, sites in stored.sites.items():
        claimed: dict[str, str] = {}
        for site in sites:
            for pin in site.terminals:
                if f"{cid}:{pin}" not in known_terminals:
                    problems.append(
                        f"{cid} site {site.id!r} lists terminal {pin!r}, which {cid} does not have"
                    )
                first = claimed.setdefault(pin, site.id)
                if first != site.id:
                    problems.append(
                        f"{cid}:{pin} is claimed by two sites ({first!r} and {site.id!r}); "
                        f"using {first!r}"
                    )

    return Geometry(
        components=resolved_components,
        terminals=resolved_terminals,
        problems=tuple(problems),
        counts=stored.counts(),
        labels={i: Spot.of(p, None) for i, p in stored.labels.items()},
        end_labels=resolved_end_labels,
        present=stored.present,
    )


def _point(location: Any) -> tuple[float, float] | None:
    """`components[].location` as written by `author_circuit_logic.py`: `{x, y, zone}`, where
    `x`/`y` are absent for the six components that are referenced but not drawn."""
    if not isinstance(location, dict):
        return None
    try:
        return float(location["x"]), float(location["y"])
    except (KeyError, TypeError, ValueError):
        return None
