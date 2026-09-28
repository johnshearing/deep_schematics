# Highlighting wires and nets, 04 — *the rest of the authoring surface, and five ways to mark a thing*

**Written 2026-09-26, from the user's own words on 2026-09-25. This document is self-contained on
purpose: `claude.md` may be empty or about something else by the time it is executed, so
everything a session needs to do this work is here.** Its predecessor
`highlighting_wires_and_nets_03.md` is **finished** — every phase in it either shipped or was
retired by the user's own authoring run — and is a **grep target, never a read**.

---

## §0 How to use this document

**Read this file whole. It is the reading list, the traps, the budget and the plan.** Then read
`goals_01.md` (~16 KB), which is the definition of *done* and which this plan implements. Then read
**only** the reading list of the phase you are executing. Nothing else from `_claude_notes`.

**One phase per session.** When a phase's acceptance criteria are met, write it up and stop, even
if there is context left. The write-up is part of the phase, not an extra.

**Do not execute more than one phase because they look small.** Every phase in plan 03 that was
"small" was small *because* its plan had already made the decisions. Making decisions at 150 K
context is what costs $100.

**If a phase's first measurement contradicts this document, the measurement wins.** Every count
below was taken on 2026-09-26 and the user authors between sessions. Recompute; never quote the
page.

---

## §1 Why this plan exists

### 1.1 The goal, in the user's words

> *"we are making a WebUI that is supposed to allow a human make any required edits to the
> highlighted wiring, terminals, commoning, paths, nets and other features of the drawing that is
> tracked in the json. If I had made those edits to the file then we lose the opportunity to create
> the use and utility required to make something that other humans will be able to use."*

And the end of it:

> *"The ai model will highlight notes, components, terminals, paths, path_nets, path_cables,
> labels, and symbols as it speaks answers to the user."*

`PS20115MLM4-2` is the **test specimen, not the goal**. The goal is a library of indexed drawings
and a system that works on any of them.

### 1.2 What the user asked for on 2026-09-25, in their own words

> *"I think at some point I will need the ability to add, edit, delete, retire, and position the
> following: Notes, Components, Terminals, Wires, Paths, Labels, Symbols."*
>
> *"this work is already complete for wires and paths. And this work does not apply to Nets, and
> Path_nets because these are derived from the Wires and the Paths. So that means we only need to
> enable authoring for Notes, Components, Terminals, Labels, and Symbols. This will allow a human
> to insert these features on the drawing in case the ai misses them during the indexing process,
> and it also allows the human to make changes to the drawing in the case that the actual circuit
> in the real world has been modified."*
>
> *"Also, I will need the ability to draw bounding boxes, polylines, circles, and eclipses around
> Notes, Components, Labels, and Symbols. Then you (the ai model) can use these shapes to highlight
> these features on the drawings when you provide your answers in the same way that you already
> highlight polylines for Paths and Path_nets."*
>
> *"Currently we are marking components with a blue dot surrounded by a circle which we place on or
> near the component. This works well for identifying small components such as relay coils and
> relay contacts but for larger components it would be better to mark these with bounding boxes,
> enclosing polylines, circles, or ellipses. So we need the ability to mark and highlight
> components in 5 possible ways: Bounding boxes, Enclosing Polylines for oddly shaped Components,
> Circles, Ellipses, or Blue Dots surrounded by a Circle. It seems reasonable to make it possible
> to highlight Notes, Labels, and Symbols by using the same 5 methods."*
>
> *"With regard to Symbols, we will need a way to draw these onto the schematic, and we will need a
> way to highlight these Symbols in much the same way that we are already highlighting paths. To
> this end, it might be good to give the user access to a pallet of shapes that you might find in
> any drawing application such as Paint."*

**That is the whole of this plan.** It is the content of plan 03's `§7` and `§8`, which were
deliberately left as *plan documents, not sessions* — plus the five marks, which are new.

### 1.3 One correction to the framing, and it matters for §4 and §5

The user wrote that this work *"does not apply to Nets… because these are derived from the Wires
and the Paths."* **Half right, and the half that is wrong is the sharpest gap in the whole
surface.**

- **`path_nets` are derived and must stay derived.** A net's highlight is the union of its member
  wires' runs plus the buses of the blocks its members sit on — `pathsFor` (`webui/src/lib/paths.ts`)
  is the one rule, and `draftRuns` reads the same map. Authoring a second grouping would be a
  second draft of connectivity. **Nothing to build. Do not build it.**
- **A net's *membership* is not derived from wires.** It is the `net` field on each **terminal**, in
  the `author_circuit_logic.py` tables. Two terminals are on one net because a person typed the same
  net name against both, and today the only way to fix a net a reader can see is wrong is to edit a
  **Python file**.

**So nets need no screen of their own, and the user's instinct is right — the way you author a net
is by setting the `net` field on a terminal.** That makes net membership a *terminal* property,
which §5 delivers as part of *what a terminal is*. Say it in those words when it comes up; it is
the reconciliation, not a contradiction.

### 1.4 Why every editor so far had to be built twice, and what that buys this plan

Every editor before 2026-09-11 was a **confirmation surface**, not an **authoring surface**: each
panel took its list of objects from something the machine found, and its edit control from a
proposal the machine computed. **Where the machine found nothing there was no row and no button.**
On 2026-09-11 the answer to two of the user's authoring questions was *hand-edit the JSON*, and they
deliberately did not do it:

> *"a hand edit produces correct data and destroys the finding."*

**An un-authorable thing is a named gap in a panel, not a file edit.** That rule is the reason this
plan exists, and it applies to every phase in it: **if a phase cannot author something, it must put
a row on the screen saying so, by name.** Never offer the user a hand edit.

---

## §2 The goal test

A phase in this plan is done when **a person with the sheet in front of them can put a thing on
the drawing that the extraction missed, and the model can point at it while it answers.** Both
halves. One without the other is half a feature:

| | |
|---|---|
| **authorable and not citable** | the person did work the model cannot use — which is where `commoning` still sits, deliberately |
| **citable and not authorable** | the model can point at whatever the machine happened to find, which is every editor built before 2026-09-11 |

And the standing constraint that outranks both: **a feature the model must point at needs an id in
`circuit_logic.json`.** That is the whole reason notes, printed labels, symbols and cables cannot be
cited today, and it is why `§4` comes before everything else in this plan.

---

## §3 What exists that you will reuse — measured 2026-09-26

**Take these again before you build on them.** The one-liner habits are in `§13`.

### 3.1 The generated netlist — what the model reasons over

| `circuit_logic.json` | |
|---|---|
| components | 47 |
| terminals | 131 |
| nets | 26 |
| wires | 71 — **all `endpoints.source: "human"`**, 13 carrying `was` |
| cables | 8, each with `member_wires` |
| subsystems | 7 |
| relationships | 402 |
| `drawing.notes` | **9 note strings, with no ids and no geometry** |

### 3.2 The extraction's geometry — what the app draws and the model never reads

`geometry.json` is **606 KB, ~150 k tokens, one `pages[0]` object. NEVER READ IT.** Everything
below came out of `python3 -c` one-liners costing a few hundred tokens each.

| `geometry.json` → `pages[0]` | |
|---|---|
| `labels` | **515**, each with an `id` (`T####`), `text`, `bbox`, `center`, `confidence`, `kind` — 160 `text`, 99 `wire_spec`, 84 `empty`, 73 `terminal_number`, 57 `designator`, 17 `voltage`, 16 `net_number`, **9 `note`** |
| `symbols` | **98**, each `{id: "S####", kind, center, diameter, layer}` — 88 `terminal_point`, 10 `device_circle`. **No oval, and no rotation field** |
| `conductors` | 149, `C####` |
| **`boxes`** | **29**, each `{id: "B####", bbox, point_count, closed: true}` — **closed rectangles the extractor already found, and nothing in the application reads them** |
| `rects` | 128, **no ids**, mostly 1.6 × 3.5 pt glyph and furniture artifacts. **Not useful as proposals — do not chase them** |
| `junctions` | 2 |
| PDF layers | `SCHEMATIC` 6166 · `0` 183 · `FORMAT` 157 · `REVNOTE` 92 |

**Three of those lines change this plan, and they are the most valuable thing in this document:**

1. **A printed label already has a bounding box.** All 515 of them. So *highlighting* a printed
   label needs **no new geometry at all** — only a **binding** from `T0031` to *whose name this is*.
   That is `§8`, and it is much smaller than it looks.
2. **The extractor already found 29 closed boxes with ids.** So a component's bounding box is
   **proposable from the ink** rather than drawn from scratch — the same shape as every other
   proposal in this project: rank it, show it, let the person accept it, **never auto-accept**.
   That is `§7`, and it is why `§7` is a confirmation surface *and* an authoring one.
3. **A symbol is already a circle with a centre and a diameter.** So the 98 extracted symbols are
   paintable today with the `circle` mark and no conversion. Only **person-drawn** symbols need the
   palette, which is `§9`.

### 3.3 The authored files — what a person has already put in

| file | what it holds | state on 2026-09-26 |
|---|---|---|
| `locations.json` | where everything is drawn | 41 components at 47 sites · 131 placed terminals · **71 of 71 wires have a route**, 52 `extracted` + 19 `human`, **0 stale** · 114 end-label overrides on 56 wires, **0 orphaned** |
| `wiring.json` | which two terminals each wire joins, and each block's bus | 71 records, **all `source: human`** · **7 commoning blocks**, 2 drawn by hand |
| `label_corrections.json` | what the ink says | 654 decisions, keyed on `T####` |
| `author_circuit_logic.py` | **what each thing is** — 80 KB of Python tables | **no screen at all. This plan is that screen** |

**The user's authoring run on this drawing is finished.** All 71 wires are confirmed, all 71 have a
route, nothing is stale and nothing is orphaned. **So this plan has no queue to serve on this
sheet** — its phases are judged on *drawing number two* and on the two cases the user named:
*the indexing pass missed something*, and *the real circuit changed*.

### 3.4 The code you will reuse, by name

| what | where | why it matters |
|---|---|---|
| the canvas sheet and every overlay | `webui/src/features/drawing/TileSheet.tsx` | **a new overlay is four edits here** — trap 7 |
| the marker layer (dots, rings, end labels) | `webui/src/features/drawing/MarkerLayer.tsx` | today's *blue dot in a circle* is here; the `dot` mark is this, unchanged |
| the one union rule for *what does this paint* | `webui/src/lib/paths.ts` — `pathsFor`, `blocksOf`, `pickPath` | `lib/` may not import from `features/` — trap 10 |
| the armed row's overlay on the Locate tab | `webui/src/features/locate/paths.ts` — `draftRuns` | prefers the draft; reads blocks from the published index |
| the citation loop | `webui/src/lib/designators.ts` · `components/Citation.tsx` · `components/Markdown.tsx` | **an exact, case-insensitive allowlist match of a whole backticked span** — this is what `§10` widens |
| the authored-file write path | `server/app/locations.py` · `wiring.py` · `label_corrections.py` | three implementations of *validate, refuse by name, stamp provenance*. `§4` is the fourth and must look like them |
| the generator | `schematic_extraction/PS20115MLM4-2/extracted_docs/author_circuit_logic.py` | it already folds `wiring.json` over its own wire table. `§4` makes it fold a second overlay the same way |
| the drawing endpoints | `server/app/drawing.py` — `/api/designators`, `/api/paths`, `/api/conductors` | **geometry is free, connectivity is not** — trap 6 |
| the hazard book | `_claude_notes/locate_tab_testing/06_code_map.md` — `H1`–`H31` | **grep it for the `H` a phase names; do not read it whole** |

---

## §4 Phase 4a — the fifth authored file, and the generator that folds it in

**No screen. Server and generator only. This is the keystone: nothing else in this plan works
without it, and every later phase is small because this one is right.**

### 4a.1 Why a fifth file and not a screen over the Python

`author_circuit_logic.py` is 80 KB of Python holding the tables the vision pass wrote when the
drawing was first read. A WebUI cannot edit a Python file: there is no schema to validate against,
no way to refuse a bad write by name, and a botched write breaks the generator rather than raising
a banner. **And the file is evidence** — its wire table still holds the endpoints the machine
originally guessed, which is exactly what `was` preserves one level down, and which the Ask tab is
now warned about by name (`server/app/prompts.py`, v1.3).

**So the Python stays, unedited, as the machine's original reading — and a fifth authored JSON file
overrides it, exactly as `wiring.json` already overrides its wire table.** That mechanism is built,
tested and understood; this phase is a second instance of it, not a new idea.

**Name it `objects.json`.** *"What each thing is, and whether it exists at all."* Alternatives
considered and rejected: `netlist.json` (collides with `circuit_logic.json`, which *is* the
netlist), `features.json` (collides with `webui/src/features/`, and this project reads code
constantly). **This is the one naming decision in the plan the user may want to veto — ask in the
session's first message and do not spend a call on it later** (`§16`, question 1).

### 4a.2 The schema

```json
{
  "drawing_number": "PS20115MLM4-2",
  "schema": 1,
  "notes":      { "N001": { "text": "POWER IN LEV261 …", "label": "T0001",
                            "source": "human", "by": "js", "at": "…" } },
  "components": { "CR-NEW": { "class": "relay", "description": "…", "ratings": {},
                              "part_number": null, "added": true,
                              "source": "human", "by": "js", "at": "…" } },
  "terminals":  { "CR-NEW:A1": { "function": "coil", "net": "110", "added": true,
                                 "source": "human", "by": "js", "at": "…" } },
  "symbols":    { "Z001": { "kind": "device_circle", "about": "CR-NEW", "added": true,
                            "geometry": "human", "source": "human", "by": "js", "at": "…" } },
  "labels":     { "T0031": { "about": "W048", "role": "wire_spec",
                             "source": "human", "by": "js", "at": "…" } },
  "retired":    { "CR-OLD": { "reason": "removed from the machine 2026-09-30",
                              "by": "js", "at": "…" } }
}
```

**Six decisions in that shape, each of which has already cost this project a session somewhere
else:**

1. **A record is an *override*, not a replacement.** Absent file, absent section and absent key all
   mean *the Python table's answer stands*. A field present and `null` means *this field has been
   deliberately emptied*. The same three-way distinction `label_corrections.json` uses for *not a
   label*, and for the same reason.
2. **`added: true` is the `H25` treatment and it is not optional.** A record for an id the Python
   tables do not have is a thing **the user put there**; an id the tables do not have and that does
   **not** carry `added` is still a **typo** and must be **refused by name**. `H25` is written for
   wires and generalises unchanged. Grep `H25` before writing the validator.
3. **Delete is absent by design; `retired` is a tombstone with a reason in words.** A component
   that existed and does not now is a *tombstone*, not an absence — the machine may have read it
   correctly and the machine it describes may have been rebuilt, and a reader needs to know which.
   This is settled: `Retire this wire` shipped 2026-09-08 and the argument has not moved.
   **A tombstone is reversible.**
4. **Person-drawn symbols get their own id space, `Z####`, and never a `S####`.** `S####` is the
   extractor's. Two id spaces that can never collide is what lets a re-extraction renumber `S####`
   without touching a single authored record — and a re-extraction **will** happen on drawing two
   (trap 13).
5. **`notes[].label` and `labels[].about` are the bindings, and they are the whole point of the
   file.** A note needs an **id** (so the model can cite it) and a **bbox** (so something can be
   painted); `geometry.json` has the bbox on `T0001` and `drawing.notes` has the text, and
   **nothing joins them.** One field does.
6. **Every record carries `source`/`by`/`at`, and `geometry: "human"` where it has a shape.** The
   same envelope as every other authored record here. The Ask tab's prompt now reads
   `endpoints.source` and says who confirmed what; anything this file adds should be readable the
   same way.

### 4a.3 The generator's side

`author_circuit_logic.py` gains one fold, beside the one it already does for `wiring.json`, and it
must **refuse rather than guess**:

- an `added` id that the tables **already have** → `REFUSED: One id, two different things: <id>`
- a non-`added` id the tables **do not** have → `REFUSED: Unknown id <id>; add "added": true if you
  meant to create it`
- a terminal whose `net` names a net no terminal is on → **allowed**; a net is a set of terminals
  and a new net begins with its first member
- a terminal on a component that does not exist → `REFUSED`, by name
- a `retired` id **still referenced** by a live wire → `REFUSED`, naming the wire. Retiring a
  component is not a way to delete wiring.
- the file **absent** → the generator behaves exactly as it does today, byte for byte

**`H23`: the generator refuses to run without `wiring.json`.** Anything you write that runs it must
supply both files.

### 4a.4 The server's side

`server/app/objects.py`, modelled line-for-line on `wiring.py`: `GET` free, `PUT` behind the editor
password, a validating write, `cache_clear()` on write, and a `problems` report computed **off the
file it has just written** — that last is how the three existing editors make a banner go the
moment a save lands (`main.py`'s `PUT /api/locations` is the worked example).

**And build in `H31` from the start rather than discovering it again.** `H31` is the newest hazard
in the book: *an authored decision can outlive the thing it was about, and a panel built from the
machine's list cannot show it.* Three unreachable red banners and a whole phase (plan 03 `§5`) came
out of learning that late. So: **every key this file holds that the netlist no longer knows gets a
row and a reset in the panel that owns it, from the first version.** Write the test for it in this
phase even though the panel is `§5`.

### 4a.5 Reading list (and nothing else)

`server/app/wiring.py` **whole** (it is the template) · `server/app/locations.py`, the
`resolve_geometry` function only · `author_circuit_logic.py`: `grep -n "wiring.json\|REFUSED\|def "`
and then **only** the fold function and the two tables named in its output · `06_code_map.md`:
`grep -n "H14\|H23\|H25\|H31" -A 12`.

**Do not read `author_circuit_logic.py` whole. It is 80 KB.**

### 4a.6 Acceptance criteria

The file absent leaves `circuit_logic.json` **byte-identical** — proved with `md5sum` · an `added`
component with one `added` terminal appears in the netlist with no `W###` and no relationships it
did not earn · each of the five refusals above fires **by name** in a test · a tombstone keeps the
record and marks it, and un-retiring restores it · `GET /api/objects` works with
`SWUI_ALLOW_EDITS=false` and `PUT` does not exist · **`git status --short schematic_extraction/` is
unchanged from how you found it** · the four checks green.

**Tests: T-1800–T-1819**, in a new `server/tests/test_objects.py` plus the generator's existing
`test_extraction_generator.py`. **Needs a server restart** (trap 2).

**Estimate: one session, $18–30.** It is the largest phase here and the one that must not be
rushed.

---

## §5 Phase 4b — the netlist screen: notes, existence, and which net a terminal is on

**This is plan 03 `§7`, which was always *"a plan document, not a session"*. `§4` is what made it a
session.** Client only, plus whatever `§4` already shipped on the server.

### 5.1 What goes on the screen

| | where it goes | the control |
|---|---|---|
| **Notes** — the drawing's 9 note strings | a new `Notes` filter on the Locate tab's queue | add · edit the text · retire · **bind to a printed `note` label**, which is what gives it a place on the paper |
| **Component existence** and what it is | the existing component panel gains a section | `Add a component` (stamping `added: true`) · class, description, ratings, part number · `Retire` with a reason |
| **Terminal existence**, its `function`, and **its `net`** | the existing terminal panel gains a section | `Add a terminal` · `function` · **`net`, as a combo over today's 26 net names plus free text**, because a new net begins with its first member |
| the leftovers | every panel above | **a row and a reset for every key `objects.json` holds that the netlist no longer knows** — `H31`, designed in rather than discovered |

### 5.2 The one hard part, and it is not the form

**A net a reader can see is wrong can only be fixed in a Python file today, and net membership is
what the highlight paints.** So the `net` combo on a terminal is the highest-value control in this
whole plan, and it is also the most dangerous: changing a terminal's net **moves the net
highlight**, **moves the commoning gate** (*two or more of this component's terminals on one net* is
what decides whether a block gets a commoning panel), and **can strand an authored bus**. The
screen must say so before the save, and the `problems` report must name what it stranded after it.

**Never auto-accept and never cascade.** Changing `TB-0V:7`'s net does not change `TB-0V:8`'s, even
though they are screws on one block, because a block whose screws are on different nets is a real
thing and the person looking at the paper is the only one who can say.

### 5.3 Reading list (and nothing else)

`webui/src/features/locate/TargetPanel.tsx` — **trap 4: a panel's plumbing is three edits and this
file is all three** (the props interface, the sub-panel, the call site) · the same file's
`LabelPanel` orphan block, as the worked example of an `H31` row · `webui/src/features/locate/LocateTab.tsx`,
the filter row and the queue's predicate · `webui/src/stores/locateStore.ts` for how a mutation
takes a note in words · `06_code_map.md`: `grep -n "H31" -A 15`.

### 5.4 Acceptance criteria

A note can be added, edited, retired and bound to a `T####`, and the generator folds it into
`drawing.notes` · a component and one of its terminals can be added and appear in
`/api/designators` without a restart of the browser · **a terminal's net can be changed, and the
net highlight follows on both tabs** · a stranded bus or a stranded override gets a **row with a
reset**, never a hand edit · every count on the screen is **computed from the payload**, never from
a fixture's memory — **trap 3, which has bitten five times** · the four checks green ·
`git status --short schematic_extraction/` unchanged.

**Tests: T-1820–T-1849.** Lesson document: **new**, `22_tests_the_netlist_screen.md`.

**Estimate: one session, $20–32.** Cut it by shipping notes and existence first and the `net`
combo second if the budget is tight — they are independent.

---

## §6 Phase 4c — the `Mark` schema, and painting the five shapes

**Read-only: paint marks that exist, author none.** It is the cheapest phase in the plan and it is
deliberately before the editor, because it makes the extraction's own 29 boxes, 98 symbol circles
and 515 label bboxes visible on the sheet for almost no code — and looking at them is what will
tell the user what the editor in `§7` should feel like.

### 6.1 One schema, five kinds

```ts
type Mark =
  | { kind: 'dot';     point: [number, number] }
  | { kind: 'box';     rect: [number, number, number, number] }
  | { kind: 'circle';  center: [number, number]; r: number }
  | { kind: 'ellipse'; center: [number, number]; rx: number; ry: number; rot?: number }
  | { kind: 'polygon'; points: [number, number][] }   // the enclosing polyline, closed
```

plus the envelope every authored shape here carries: `geometry: 'extracted' | 'human'`,
`source`, `by`, `at`, and an optional `about` for what it encloses.

**Five kinds, one schema, one renderer, one editor.** The alternative — a type per feature — is a
schema change and a server change every time a kind is added, and `§10`'s whole argument is that a
new kind must be cheap. `dot` is **today's blue dot in a circle, unchanged**: it stays the default
and it stays right for a relay coil.

### 6.2 Where marks live, and the composite key

**`locations.json` gains exactly one new top-level section, `marks`, keyed `"<kind>:<id>"`:**

```json
"marks": {
  "component:CR-BP":          { "kind": "box", "rect": [479.0, 108.19, 499.09, 137.92],
                                "geometry": "extracted", "from_box": "B0001", … },
  "note:N001":                { "kind": "box", "rect": [113.27, 28.68, 205.28, 40.65], … },
  "cable:CABLE-POWER-IN":     { "kind": "ellipse", … },
  "symbol:Z001":              { "kind": "circle", … }
}
```

**One section rather than four, and the composite key is the reason.** A section per kind means a
schema change, a `locations.py` change and a renderer change for every kind that is ever added;
one section means a new kind costs **a string**. `locations.json` is already keyed by id inside
each section, so the composite key is the only new idea, and it is worth it.

**And it hands `path_cables` over for free.** `goals_01.md` `§5` row 6 has been waiting for *the
oval has no geometry in the extraction, so a cable boundary is a shape a person draws.* That shape
is `marks["cable:CABLE-POWER-IN"]`. **Plan 03 `§8`'s cable half is retired by this schema** — say so
in the write-up.

### 6.3 The overlay

**A new canvas overlay is four edits in `TileSheet.tsx` — the prop, the paint call in the layout
effect, the `data-` attribute a test reads it through, and the effect's dependency array.** The
fourth is silent: a missed dependency is a stale frame, not an error. **This is trap 7 and it has
cost a session.**

Paint order and colour are decisions, not taste: the mark is **under** the selection highlight and
**over** the authored-paths field, it is one colour for *this is the thing you asked about*, and a
`box` is a stroke and never a fill — a filled rectangle over a schematic hides the drawing, which
is the one thing the sheet exists to show.

### 6.4 Reading list (and nothing else)

`webui/src/features/drawing/TileSheet.tsx` — the layout effect and **its dependency array** ·
`MarkerLayer.tsx:100-190` for how the dot and ring are drawn today · `webui/src/lib/paths.ts`
`pathsFor` for the shape of *what does this selection paint* · `server/app/drawing.py`, the
`/api/designators` entry builder, for where a mark rides to the client ·
`06_code_map.md`: `grep -n "H11\|H22\|H28" -A 8`.

### 6.5 Acceptance criteria

All five kinds render at the right place and the right size at three zooms · a selection with a
mark paints the mark **and** keeps its dot, because the dot is what says *this is the point we
placed* · a mark on an id nothing knows about is **reported in `problems` and drawn nowhere** ·
nothing is authored and `git status --short schematic_extraction/` is unchanged · **a test proves
the dependency array**: change the marks prop and assert the canvas repainted · the four checks
green.

**Tests: T-1850–T-1869.** Lesson document: **new**, `23_tests_marks.md`.

**Estimate: half a session, $10–18.**

---

## §7 Phase 4d — the mark editor, and the extractor's 29 boxes as proposals

**Now a person can draw one.** Locate tab, editor password, and **a mode of its own**.

### 7.1 The mode is not optional

**On the Locate tab a click already has four meanings and the fourth is behind a mode** — in order:
tracing takes a corner · an armed end slot ignores paper · with `Authored paths` on, a path within
`PICK_PT` arms its owner's row · otherwise `put(at)` writes the armed row's point. **Adding a fifth
meaning by nearness alone would arm a wire when somebody placed a terminal onto ink that carries a
path.** So drawing a mark is **`Mark this` — an explicit mode with a shape picker**, and while it is
on, the sheet's click means *draw*, and nothing else. **This is trap 12, it is `H30`, and the user
asked in writing not to have it replaced by a modifier key or a nearness heuristic without being
asked.**

### 7.2 Propose before you draw

**The extractor found 29 closed boxes with ids and nothing reads them.** So the editor opens with
a ranked list, not an empty canvas:

- a `B####` whose bbox **contains the component's placed point** ranks first
- a `B####` whose bbox contains **two or more of the component's terminals** ranks beside it
- a printed `designator` label's own bbox is offered for a **label** mark
- an `S####`'s centre and diameter is offered for a **symbol** mark
- **and `Draw it by hand` is always there**, because 29 boxes will not cover 47 components

**Never auto-accept.** `W042` is the standing reason: the user once pressed *I looked and it was
right* on a wire the ink says nothing about, and **that was the correct answer**. The same applies
to a box that merely happens to enclose a dot.

### 7.3 The gestures, and how few of them there should be

| kind | drawing it | editing it |
|---|---|---|
| `box` | drag a rectangle | drag a corner; arrow keys nudge 0.1 pt |
| `circle` | click the centre, drag the radius | drag the edge |
| `ellipse` | drag a rectangle, then one handle for rotation | drag a handle |
| `polygon` | click corners, `Enter` closes, `Backspace` takes one back, `Escape` abandons | drag a corner |
| `dot` | it is the existing placement gesture and is **not** re-built | — |

**`polygon` reuses the trace's four keys exactly** (`Trace by hand`, shipped 2026-09-12) — the same
keys for the same gesture, and `H26` is the hazard beside it. **Do not write a second polyline
editor**, and **do not write a second distance function**: `project` (`webui/src/lib/polyline.ts`)
is the only point-to-polyline measurement in the app and `PICK_PT = 6` lives beside it with a
comment explaining why 6 and not 4 or 8 (trap 11).

### 7.4 Acceptance criteria

Each of the five kinds can be drawn, saved, re-opened and dragged · a proposed `B####` accepted
stores `geometry: "extracted"` **and the box's id**, so the provenance survives · a hand-drawn one
stores `geometry: "human"` · `Escape` abandons a drawing in progress **before** it clears the armed
row (the established escalation — `H22`) · the mode is off by default and **every other meaning of
a click is unchanged**, proved by a test per meaning · the four checks green ·
`git status --short schematic_extraction/` unchanged.

**Tests: T-1870–T-1899**, appended to `23_tests_marks.md`.

**Estimate: one session, $20–30.**

---

## §8 Phase 4e — labels: binding a printed label to what it is about

**The smallest phase with the biggest ratio, because the geometry already exists.** All 515 printed
labels have a `bbox`. What is missing is one sentence the data cannot say today: ***this `wire_spec`
is `W048`'s name.***

- `objects.json`'s `labels` section is the binding: `{"T0031": {"about": "W048", "role": "wire_spec"}}`
- **propose it, do not invent it.** A `wire_spec` label whose text matches a wire's colour and
  gauge *and* whose bbox sits within `NEAR_PT` of that wire's route is a proposal worth ranking
  first. A `designator` label whose text **is** a component id is nearly free. A `terminal_number`
  beside a placed pin is the third. **The `Review` tab has already read all 654 of them**, so the
  text side of this is done and committed.
- once bound, a label is **paintable** (its own bbox, via `§6`'s `box` mark) and **citable** (`§10`)

**What this fixes, in the user's terms:** today the app paints the end labels it places itself, and
**a printed label's own bbox is never lit**. After this, *"the wire's printed name is here"* is a
thing the model can point at.

### 8.1 Reading list (and nothing else)

`server/app/label_corrections.py` for how a `T####` is already keyed and validated ·
`webui/src/features/review/model.ts` for the reading the Review tab settled · the label-matching
signals in `webui/src/features/locate/paths.ts` — `candidates` and `netNames`, which already match
a printed name to a wire and are the template for the proposal.

### 8.2 Acceptance criteria

A binding can be added, changed and removed from the screen · the proposal ranks the three signals
above and **offers nothing where it has none**, which is the correct answer and must not become a
guess · a bound label lights on the sheet · the netlist carries the binding so the model can cite
it · **`label_corrections.json` is not touched** — what a label *says* and what it is *about* are
two files and two questions · the four checks green.

**Tests: T-1900–T-1919.** Lesson document: **new**, `24_tests_label_binding.md`.

**Estimate: half a session, $12–20.**

---

## §9 Phase 4f — symbols: the palette, and drawing one onto the sheet

### 9.1 What a symbol is here, and what it is not

The extraction found **98 symbols: 88 `terminal_point` and 10 `device_circle`. No oval, no
rotation, no contact, no coil, no earth.** The user wants two different things and they must not be
confused:

1. **Bind the 98 that exist** to what they are about, so a highlight can be aimed at a symbol —
   `objects.json`'s `symbols` section, `about: "CR-NEW"`. Same shape as `§8`, and mostly free once
   `§8` is built.
2. **Draw one that does not exist**, for the two cases the user named: the indexing pass missed it,
   or the real machine changed. This is the palette.

**A person-drawn symbol is an annotation over the paper and never a claim about what is printed.**
Say that plainly on the screen. The precedent is settled and is the strongest argument this project
has: a hand-traced path stores `geometry: "human"` and `attribution: "human"`, `TB-130`'s bus is a
line a person drew where the ink says nothing, and **both are honest because they say who drew
them**. Drawing a symbol is the same act. What remains forbidden is **inventing ink and calling it
extracted** — struck three times, and the rule has not moved.

### 9.2 The palette, and the order to build it in

The user asked for *"a pallet of shapes that you might find in any drawing application such as
Paint."* **Build it in two layers, and the second is what makes it useful:**

1. **Primitives** — line, polyline, rectangle, circle, ellipse, arc. These are `§6`'s `Mark` kinds
   plus `line` and `arc`, so most of this is already built. A symbol record is a **group** of
   primitives with one id, one `about`, and one bounding box computed from its members.
2. **A starter library of stamps** — a named group you place at a point with a rotation: at minimum
   `device_circle` and `terminal_point`, because those are the 98 the extractor already knows, and
   then the three this drawing would actually want next: a contact (NO and NC) and an earth.

**Layer 2 is why this is worth doing at all.** A person assembling a relay contact out of four
lines every time will not use the feature twice. A person pressing *contact, NO* and clicking will.
**If the budget only covers one layer, ship layer 1 and stop** — it is honest and it is
composable — **and say in the write-up that layer 2 is what makes it usable.**

### 9.3 Acceptance criteria

The 98 extracted symbols can be bound and lit · a symbol can be drawn from primitives, saved,
re-opened and moved as a unit · a drawn symbol reads **`geometry: "human"`** everywhere it is shown
and is never reported as extracted · a stamp places a named group with a rotation · **the PDF and
`geometry.json` are not modified** and `md5sum` proves it · the four checks green.

**Tests: T-1920–T-1949.** Lesson document: **new**, `25_tests_symbols.md`.

**Estimate: one to one-and-a-half sessions, $25–45.** **The largest and the most deferrable phase
in this plan.** If anything is cut, cut layer 2 first and the whole phase second — `§10` is worth
more, and `§10` does not depend on it.

---

## §10 Phase 4g — widening the citation loop, which is what all of it was for

> *"The ai model will highlight notes, components, terminals, paths, path_nets, path_cables,
> labels, and symbols as it speaks answers to the user."*

**Four of those eight cannot be cited today**, and the reason is one sentence: **no id in
`circuit_logic.json`, so nothing to cite.** `§4` through `§9` create the ids. This phase spends
them, and it is **last** for exactly that reason.

### 10.1 What the loop is, so it is not re-derived

`server/app/prompts.py` makes the model spell ids in backticks → `Markdown.tsx` renders every
backticked span → `lib/designators.ts` looks the span up **verbatim** in `/api/designators`, an
**exact, case-insensitive allowlist match of the whole span** → `Citation.tsx` calls
`select(kind, id)` and switches tabs → the Drawing tab flies there and paints.

**The allowlist is a security property, not a convenience.** It is why a pattern match was refused:
a viewer that guessed would send a reader at 2 a.m. to the wrong circuit. Keep
`lib/designators.ts` and `components/Citation.tsx` in step, which the prompt's own header says.

### 10.2 The four edits

1. **`/api/designators` publishes four new kinds** — `note`, `symbol`, `label`, `cable` — each with
   its `point`, its `rect` or its `mark`, so the existing fly-to and the new mark overlay work
   without a special case.
2. **`Citation.tsx` needs no new logic** if the kinds arrive in the index. **Verify that claim with
   a test rather than assuming it** — this is the phase's one pleasant surprise if it holds and its
   only real work if it does not.
3. **`prompts.py` is told the new kinds exist**, in the same voice as the existing citation section:
   which ids are printed on the sheet and which are ours (`N001`, `Z001` and `T0031` are **ours**;
   a cable's name is ours too, and `goals_01.md` already says `CABLE-…` has *"no counterpart on the
   sheet at all"*, so it must be described before it is cited). **Bump `PROMPT_VERSION`.**
4. **The Drawing tab's list and its five switches** gain whatever the new kinds need — and
   remember **trap 8: a control is documented in three places and the third is prose.** The tab's
   own help paragraph names its switches by name, and deleting `Unclaimed ink` in 2026-09-15 left a
   sentence about it behind, found only by grepping the string.

### 10.3 Acceptance criteria

An answer naming `` `N001` `` pans to that note and lights its mark · the same for a symbol, a
printed label and a cable · **a cable paints its member wires' runs *and* its boundary mark**, which
is the first time `path_cables` has existed · a bare, unbound id stays **plain text**, which is
correct and must be asserted · `PROMPT_VERSION` bumped and the archived turns record it · the four
checks green.

**Tests: T-1950–T-1979.** Lesson document: **new**, `26_tests_citation_loop.md`. **Needs a server
restart.**

**Estimate: one session, $18–28.**

---

## §11 Deliberately **not** in this plan

- **A conductor editor, or another view over conductors.** Struck **three times** — 2026-09-13 as a
  thing to author, 2026-09-15 as a thing to view, 2026-09-17 as a thing to click. *"The conductors
  are the model's notion of where the ink is, and I can see the ink itself."* The extractor missed
  41 lines, about 90 of the 149 conductors are leader lines and symbol strokes nothing will ever
  claim, and one place on the sheet is drawn wrong. **The code stays in the tree as a diagnostic
  behind `?unclaimed=1`; do not rebuild it and do not defend it.** The demotion pattern — leave the
  code, take the control off the screen, gate it on a query, keep every test by setting the query
  instead of clicking — is settled, reusable, and written down in `H29`.
- **Authoring `path_nets`.** Derived, and `§1.3` says why.
- **Re-extracting `geometry.json`.** A re-extraction renumbers every `C####`, and there are ~957
  mentions of one across 30+ files. Authored work survives it — every route and bus stores
  polylines, with conductor ids as provenance only — **but the fixtures do not.** Re-extract when
  drawing number two forces a re-run anyway. The extractor's layer-`"0"` fix (41 lines of ≥6 pt on
  PDF layer `"0"` never became conductors, 16 of them landing on placed terminals) was plan 03
  `§6`, is **still unbuilt**, and is **not** in this plan: its reading list is
  `extract.py:385-465` and `1150-1200`, and it needs `/home/js/schematics/.venv/bin/python`, the
  only venv with `pymupdf`.
- **Anything that writes the user's data.** See `§14.3`.
- **A button in the WebUI that runs the generator**, unless the user asks for it in the session.
  `main.py`'s own comment reads *"This server does not run Python on request, and should not start
  now."* The objection weakens once the netlist cache is keyed on mtime — a separate, ten-line
  change the user has been told about — but it is **their call, not the plan's.**

---

## §12 Order, sessions, and the budget

| # | Phase | What it unlocks | Estimate |
|---|---|---|---|
| 1 | **`§4` 4a — `objects.json` and the generator** | **everything.** No screen, all the decisions | one session, **$18–30** |
| 2 | **`§6` 4c — paint the five marks, read-only** | the 29 boxes, 98 symbols and 515 label boxes become visible for almost no code, and looking at them tells you what `§7` should feel like | half a session, **$10–18** |
| 3 | **`§5` 4b — the netlist screen** | notes, existence, and **which net a terminal is on** — the sharpest gap in the surface | one session, **$20–32** |
| 4 | **`§7` 4d — the mark editor** | the user's five ways to mark a thing, with the extractor's boxes as proposals | one session, **$20–30** |
| 5 | **`§8` 4e — label binding** | a printed label becomes paintable and citable. Best ratio in the plan | half a session, **$12–20** |
| 6 | **`§10` 4g — the citation loop** | **the thing all of it was for.** Notes, labels, symbols and cables paintable from an answer | one session, **$18–28** |
| 7 | **`§9` 4f — symbols and the palette** | drawing what the extraction missed. Last because it is biggest and nothing depends on it | 1–1.5 sessions, **$25–45** |

**Total: $123–203 over six to eight sessions.** On 2026-09-19 about **$16 of the user's funded
$150** remained. **So this plan does not fit, and saying so is the instruction being followed
rather than bad news.**

**If only one phase is ever funded, it is `§4`** — without it nothing else can exist, and its
output is a file format and a generator, both of which outlive any screen.

**If two, `§4` then `§6`** — the second is cheap, it is read-only, and it puts something on the
screen the same day.

**The cheapest complete slice that delivers the user's stated goal** is `§4` → `§6` → **notes only**
from `§5` → **notes only** from `§10`. That is *the model paints a note while it answers*, end to
end, for about **$45–70**, and it proves the whole pipeline before a mark editor or a palette is
written. **Offer this slice at the start of the session; it may be the right answer.**

---

## §13 The token strategy — read this before opening a file

**Cost ≈ $0.50 × (context in millions of tokens) × (number of calls).** Nothing else is close. The
saving is in **not reading**, not in thinking less. Measured over 31 transcripts to 2026-09-19:
about **$1,112** spent on this project; the two worst sessions ran at 407 K context over ~400 calls
with cache reads at 84% of the bill.

### 13.1 Do not read these

| file | size | why not |
|---|---|---|
| `geometry.json` | 606 KB | ~150 k tokens. **Never.** One `python3 -c` one-liner answers any question about it |
| `circuit_logic.json` | 222 KB | generated; never whole. One-liner for any count |
| `custom_kg.json` | 468 KB | generated from the above |
| `author_circuit_logic.py` | 80 KB | **a grep target.** `grep -n "def \|REFUSED\|wiring.json"` and then one function |
| `archive/authoring_the_wires.md` | 91 KB | finished. `grep -n` returns the row you want for ~200 tokens |
| `archive/change_history.md` | 233 KB | ~58 k tokens |
| `archive/highlighting_wires_and_nets_01.md`, `archive/…_02.md`, **`highlighting_wires_and_nets_03.md`** | 99 + 32 + 83 KB | shipped and superseded — `_01` and `_02` were moved into `archive/` on 2026-09-26; `_03` is still beside this file. **This document carries what still matters; grep them if you must** |
| `locate_tab_testing/*_tests_*.md` | 7–30 KB each | **a lesson document is the output of a phase, never its input.** The glob reaches `21_` |
| `06_code_map.md` | large | **grep the `H` numbers a phase names, with `-A 12`. Never read it whole** |

### 13.2 The habits that made the cheapest sessions cheap

Plan 03's `§4B` cost **$10.53 at 115 K over 88 calls** — code, tests and three documents. Copy
these five things:

1. **Measure the data with a one-liner before reading the code that renders it.** Four one-liners
   answered every measurement question in `§3` of this document for a few hundred tokens each. The
   same questions asked by reading files would have been the whole budget.
2. **Re-locate the whole reading list in one or two batched `grep -n` calls**, not one call per line
   number. Line numbers in this document were taken on 2026-09-26 and **will have drifted** —
   `grep -n` each before trusting it.
3. **Read regions, not files.** Every reading list above gives a function or a range.
4. **Batch independent calls into one message.** Six greps in one block cost one call's context.
5. **Run the four checks twice — at the start and at the end** — backgrounded and in parallel, never
   between edits. And **never re-read a file you just edited**: `Edit` fails loudly if it did not
   apply.

And two more, learned the hard way:

6. **Write each document in a single call**, from notes taken while the code was written — never by
   re-reading the code to describe it. Five documents at 150 K context was about half of a $23
   session's bill.
7. **Write the tests from the fixtures the suite already has.** `stubServer`, `clickSheet`,
   `endRows`, `saved`, `clickAtMarker` exist. And **compute click coordinates from the documented
   fit rather than guessing** — a guess costs a test run per try, and a test run at 115 K context is
   about a dollar.

### 13.3 Sanity marks while working

At 60 calls you should be around **$3–6**. Past **$25** before the tests are written means the
reading list grew — **cut the phase rather than push it through, and say so.** A phase should land
near **$20** at ≤120 K context and ≤200 calls. **Say what the session cost at the end**, and **end
the session in the write-up, not in a conversation**: the discussion after plan 03's `§4A` cost
**$13**, which is most of a phase.

**Tell the user at the start if you think the phase will not fit, and whether it should be cut
rather than squeezed.**

Price a session:

```
ls -t ~/.claude/projects/-home-js-schematics/*.jsonl | head -1
# then sum message.usage over the file: input ×$5, output ×$25,
# cache_creation ×$6.25, cache_read ×$0.50, per 1M tokens (Opus 5)
```

---

## §14 Standing rules — every one of these has cost a session

### 14.1 Running it

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**If you start the server, stop it in the same turn. The console is the user's.** **How (learned 2026-09-27, when an orphaned server held the port):** check `ss -ltnp | grep :9700` first and never touch a listener that is already there; `cd` as its own command, then `.venv/bin/python -m app & SRV=$!` (backgrounding `cd … && python …` makes `$!` a subshell and orphans the server); after `kill $SRV`, `ss` must show nothing on 9700; never `pkill -f`.

The four checks:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

**Background them in parallel — but a worker error is not a red test.** A vitest run beside pytest
has twice died with `Serialized Error: { code: 'ERR_IPC_CHANNEL_CLOSED' }` and come back green when
re-run alone. **Only a named failing test is a failure.** They stood at **263 server · 520 web** on
2026-09-26; **read the counts off your own run, never off this page.**

**Start from green.** A red check in a session that has written no code means something else is
wrong — **say so loudly.** The one exception is
`test_the_committed_artifact_is_exactly_what_the_generator_writes`, which goes red whenever
`locations.json` or `wiring.json` is ahead of `circuit_logic.json`, and **names which**. That is
`K6` doing its job; clear it by running the generator first, so you can tell your breakage from the
user's.

**Two venvs, and only one has `pymupdf`:** `/home/js/schematics/.venv/bin/python` can read the PDF
(`page.get_drawings()` with a clip is cheap and exact); `server/.venv` cannot, and neither can
system `python3`. *Is the ink there, or did we miss it?* has cost this project three open items.

### 14.2 The traps

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env`.
   Editor password `edit-1234`. The routes are registered inside an `if`, so with it false there is
   nothing there to be wrong about — deliberate, not a bug.
2. **`python -m app` has no reloader.** A change under `server/app/` needs a restart. **`§4`, `§5`
   and `§10` change the server; `§6`, `§7`, `§8` and `§9` are client-only.**
3. **The client is a built bundle.** A change under `webui/src/` needs `cd webui && npm run build`.
   **A rebuilt bundle against an unrestarted server is the dangerous combination.**
4. **A test asserting an absolute count against an authored file goes red as the user authors.**
   **This has now bitten five times.** The cure is always the same: **reconstruct the indexing
   pass's own answer from `was`, and assert against that.** `INDEXED` in
   `test_extraction_generator.py` and `loadReal` in `wiring.test.ts` are the two implementations and
   both carry the reasoning. **A count or a length on a card comes off the payload, never out of a
   fixture's memory, and expect it to move under you.**
5. **A panel's plumbing is three edits, and `TargetPanel.tsx` is all three** — the props interface,
   the sub-panel that renders it, and the call site. **Assume the same gap in every reading list.**
6. **`H20` — geometry is free and connectivity is not.** `GET /api/paths` and `GET /api/conductors`
   have no editor password, on purpose. A block's commoning is published to a reader with no
   password because *net `0V` is eleven wire runs **and** the 279.6 pt vertical they all land on*.
7. **A new canvas overlay is four edits in `TileSheet.tsx`** — the prop, the paint call in the
   layout effect, the `data-` attribute a test reads it through, **and the effect's dependency
   array.** The fourth is silent: a missed dependency is a stale frame, not an error.
8. **A control is documented in *three* places, and the third is prose.** The button, its tests,
   **and the tab's own help paragraph.** Grep the user-visible name before you call a removal done.
9. **The test file for a panel is not named after the panel.** Commoning is tested in
   `WiringPanel.test.tsx`; the Drawing tab's overlays in `DrawingTab.test.tsx`. **Look before
   starting a new spec file.**
10. **`lib/` may not import from `features/`.** It is why `PICK_PT` had to move rather than be
    imported, and why `blocksOf` was exported from `lib/paths.ts` on 2026-09-25 rather than copied.
    **Check the direction before putting a shared function in `lib/`.**
11. **Do not write a second distance function.** `project` (`webui/src/lib/polyline.ts`) is the only
    point-to-polyline measurement in the app; `PICK_PT = 6` lives beside it and the comment explains
    why 6 and not 4 or 8. Ties go to the shorter run, which is why a click near a pin takes the stub
    rather than the bus.
12. **On the Locate tab a click has four meanings and the fourth is behind a mode.** In order:
    tracing takes a corner · an armed end slot ignores paper · with `Authored paths` on, a path
    within `PICK_PT` arms its owner's row · otherwise `put(at)` writes the armed row's point.
    **The mode is what keeps them apart. Do not add a fifth meaning without a mode of its own**, and
    do not replace one with a modifier key or a nearness heuristic without asking.
13. **A re-extraction renumbers every `C####`.** ~957 mentions across 30+ files. This is why
    person-drawn symbols get `Z####` and never `S####` (`§4a.2`).
14. **`H18` — three whole-document drafts over three authored files, and they must not learn about
    each other.** `wiringModel.pathStale` and the trace's target tag are the only two places two of
    them meet, and both meet them *as arguments*. **An overlay reads the published index, never a
    second draft.** `§6`'s marks make `locations.json` a fourth; keep it alone.
15. **`H24` — the landing rule has three parts and only the first is obvious.** Read it before
    touching `features/locate/wiring.ts`.
16. **Two cards can be open at once and the corners are the rule.** `bottom-3 left-3` is the
    selection card *and* the conductor card, with a precedence comment; `bottom-3 right-3` is the
    path card. **`Escape` takes the path card and the conductor pick together, then the selection.**
    `H22` is the escalation, and any new card joins that order rather than inventing one.
17. **A Locate-tab screen test's harness re-stubs the designator index on every save.**
    `LocateTab.test.tsx`'s `stubServer` takes an `index` option for exactly that reason: a locations
    save calls `refreshDesignators`, which re-reads `/api/designators` **and** `/api/paths`.
18. **A screen test can only click where a marker is drawn.** `clickAtMarker` reads a marker's CSS
    position, because that is the only place a test can learn where a PDF point lands. Testing a
    click on a **shape** means putting a confirmed pin *on* it in the fixture — `ON_ROUTE` and
    `ON_BUS` in `DrawingTab.test.tsx` exist for this. **Do not calibrate by guessing pixels.**
19. **A phase about a state the screen cannot create needs a fixture option before it needs a
    test.** `LocateTab.test.tsx`'s `stubServer` gained a `locations` option in plan 03 `§5` for
    exactly this. **Every phase in this plan is about such a state.**
20. **A handler's own guard runs before its branches, and a reading list will give you the
    branches.** Plan 03 `§4B`'s plan named the four meanings of the sheet's click and not the
    `if (!target || !from) return` two lines above them. **Read the top of the handler, not just the
    branch you are adding to.**
21. **Never restart the server, or close the tab, while a save badge is not `saved`.** The wiring
    editor autosaves 900 ms after the last edit; it now has a **`Save`** button beside its badge
    (added 2026-09-19) and the locations badge has had one all along. **A stranded draft looks
    identical to a saved one on the panel.** The proven diagnostic is `md5sum` and
    `git status --short schematic_extraction/`, **never the screen**.
22. **When the user reports that something does not work, measure before theorising.** On 2026-09-18
    the file's **mtime** and an `md5sum` settled in one call what four rounds of reasoning about the
    code could not: the save had run and written byte-identical bytes. **`ls -l`, `md5sum`,
    `git status --short`, and a real `PUT` through the running server** — that sequence is the
    debugger for this project.
23. **T-numbers spent reach T-1560.** **This plan starts at T-1800** (moved up 200 on 2026-09-28, at the user's request: `28_tests_talkthrough.md` had already spent T-1600–T-1700, and `talkthrough_03.md` holds T-1705–T-1795), with the blocks named in each
    phase. **Do not reuse a number and do not renumber one** — spent numbers stay spent even where
    the feature was demoted.
24. **The netlist cache is not invalidated.** `server/app/drawing.py`'s
    `@lru_cache load_circuit_logic` has no writer inside the server, so **nothing ever clears it**:
    regenerating `circuit_logic.json` requires a **server restart** before the app sees it. The
    three authored files each clear their own cache on write. **This is a known ten-line fix the
    user has been told about; do not fix it as a side effect of a phase.**

### 14.3 What not to do

- **Do not author anything in the user's authored files. The run is theirs.** To verify a write loop
  end to end: back the file up, write one record through the running server, check the generator
  folds it in, restore, and prove it with `md5sum` — **`git status --short schematic_extraction/`
  coming back unchanged from how you found it is the proof.** Every session since Session 2 has done
  it this way. **The files are:**

      locations.json           where everything is drawn
      label_corrections.json   what the ink says
      wiring.json              what each wire joins, and each block's bus
      objects.json             what each thing is  (created by §4 — the fifth)
      author_circuit_logic.py  the machine's original tables (historical; never edited by anyone)

- **Do not hand-edit `circuit_logic.json` or `custom_kg.json`.** Both are generated:

      cd schematic_extraction/PS20115MLM4-2/extracted_docs
      python3 author_circuit_logic.py
      python3 ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

  **The server must then be restarted** — trap 24. No phase in this plan moves the artifact.
- **Do not offer the user a hand edit.** `§1.4`. An un-authorable thing is a named gap in a panel.
- **Do not auto-accept anything.** Not a proposed box, not a candidate route, not a label binding
  the text matcher found, not a symbol the palette guessed at. **`W042` is the standing reason:** the
  user pressed *I looked and it was right* on a wire the ink says nothing about, and that was the
  correct answer.
- **Do not renumber anything.** Not terminals, not `C####`, not `T####`, not spent T-numbers.
- **Do not correct the user's data for them, ever — even when you can see it is wrong.** They asked
  for this in writing on 2026-09-18: *"These problems are exactly what I need to test the WebUI,
  learn what needs to be done and learn how to use it."* **List them, explain them, fix the screen —
  never do the run.**
- **Do not commit and do not push.** The user does all the git work. **Read git freely** —
  `git status`, `git diff`, `git show`, `git log` are often the fastest answer. **Say at the end
  which files want committing**, and remember that anything the user authors while walking a lesson
  lands in the same commit as the code unless they are told to separate them.

### 14.4 Three things to build *for*, not just build

1. **This has to generalise to other drawings.** The drawing-specific half stays in the extraction's
   own tables; everything in `server/app/` and `webui/src/` knows only shapes. **If you find
   yourself typing `TB-`, `W019` or `C0060` into the server or the client, stop.** The commoning
   gate — *two or more of this component's terminals on one net* — is the worked example, and
   `§6`'s *one mark schema, five kinds* is meant to be the next one.
2. **This has to generalise to circuits that need several pages.** `wiring.json` holds terminal
   designators and no coordinates, which is what makes it survive a second sheet — except
   `commoning`, which stores polylines and already carries an optional `page` for exactly that day.
   **Every mark in `§6` stores coordinates, so `marks` needs the same optional `page` from the
   start.** It is one field now and a migration later.
3. **Build for the model's highlight.** Every feature the model must point at needs **an id in
   `circuit_logic.json`**. That is the whole reason this plan is ordered the way it is.

---

## §15 Documents to write, and where

**Each phase writes its own, in one call, from notes taken while the tests were written.**

| phase | lesson document | index and hazards |
|---|---|---|
| `§4` 4a | **new** `22_tests_the_netlist_screen.md` header + T-1800–T-1819 | a new `H` for *the fifth authored file and the fold*; a row in `locate_tab_instruction_and_test_manual.md` |
| `§5` 4b | same document, T-1820–T-1849 | a troubleshooting row for a stranded net |
| `§6` 4c | **new** `23_tests_marks.md`, T-1850–T-1869 | a new `H` for *one mark schema, five kinds, one renderer* |
| `§7` 4d | same document, T-1870–T-1899 | extend `H30` — the fifth meaning and its mode |
| `§8` 4e | **new** `24_tests_label_binding.md`, T-1900–T-1919 | a new `H` for *what a label says and what it is about are two files* |
| `§9` 4f | **new** `25_tests_symbols.md`, T-1920–T-1949 | a new `H` for *a drawn symbol is an annotation, never a claim about the print* |
| `§10` 4g | **new** `26_tests_citation_loop.md`, T-1950–T-1979 | update the citation section of `06_code_map.md` |

**And update `goals_01.md` §4, §5 and §7 at the end of every phase.** It is the definition of done
and it is the document the next session reads first. **A phase that ships without moving those three
tables has left its most valuable output on the floor.**

**Tell the user afterwards** which files they asked you to read that did not earn their tokens, and
which you needed that they did not name. **Say it even when the answer is *the list was right*** —
that is worth knowing too. Traps 5 and 20 in this document came out of that answer.

---

## §16 Open questions — ask these in the session's first message, not at the end

1. **Is `objects.json` the right name for the fifth authored file?** `§4a.1` names the two
   alternatives and why they were rejected. **A rename after `§4` ships is cheap in code and
   expensive in documents**, so ask before writing, not after.
2. **Which slice is funded?** `§12` offers a $45–70 end-to-end slice — `§4` → `§6` → notes in `§5` →
   notes in `§10` — against $123–203 for the whole plan. **Offer the slice.**
3. **Does a bounding box replace a component's dot, or join it?** This plan assumes **joins**: the
   dot says *this is the point we placed* and the box says *this is the extent of the thing*, and
   they answer different questions. **But the user asked for five ways to mark a component, which
   reads as a choice rather than a stack.** One sentence from them settles it and it changes
   `§6.5`'s acceptance criterion.
4. **Should a mark be per-site or per-component?** A component has several sites — `CR-BP` has a
   coil and contacts drawn in different places — so *one box per component* may be wrong for exactly
   the components the feature exists for. **The schema in `§6.2` can key on `component:CR-BP@coil`
   with no change to anything else**, and this is the one place a wrong guess would need a
   migration.
5. **Layer 1 or layer 2 of the palette?** `§9.2`. Primitives alone are honest and composable;
   nobody will use them twice. **The user should see layer 1 before layer 2 is funded.**

**None of these blocks starting `§4`.**
