# Highlighting wires and nets

**Version 2 — 2026-08-23.** Reworked after the review in `claude.md`. Version 1 (2026-08-19) was a
report to argue with; this is the plan to execute.

> **Progress. Sessions 1 and 2 landed on 2026-08-24; Sessions 3 and 4 on 2026-08-25** — Phases **0**,
> **A**, **B**, **C** and **F**. `Ctrl+Z` and the keyboard nudge, a net highlighted as the terminals it
> is made of, an end label at every wire end and net terminal with `locations.json` at **schema 2**,
> the Drawing tab's list of all 275 designators with five layer switches over the sheet, and the
> **`Review`** tab over the 664 readings the extraction lifted off the paper — with
> `label_corrections.json` as the third authored file. **The next session is 5, Phases D + G**: wire
> paths in the file, in the API and painted on the sheet. `change_history.md` has the four dated
> entries; `08_results_log.md` says what the user has walked. Everything below is as written on
> 2026-08-23 except the per-session notes in §13 and the amendments recorded there.
>
> **The `Review` queue has been worked end to end, 2026-09-01/02.** `label_corrections.json` holds
> **654** decisions over 664 readings, and the thing Phase E is built on moved a long way: the nets
> with at least one printed conductor to match against went **17 of 26 → 24 of 26** (70 of the 149
> runs carry a usable name), and the two that are left are `NET-PB1` and `NET-PB2`, which is
> **`K10`** rather than a reading — **both of those nets now have a run carrying their *printed*
> name (`PB1`, `PB2`), so `K10` alone is worth 26 of 26 to Phase E's matcher.** The user then
> asked 23 questions about that screen; the answers are
> `_claude_notes/review_tab_questions.md` and they produced two things this plan now carries: **the
> small batch between Sessions 5 and 6** at the end of §13, and four rejected ideas recorded there
> with their reasons. Read that document before touching the `Review` tab; do not read it to build
> Phases D and G.

**Status of the gate.** Version 1 said *"nothing in this plan proceeds until you accept the §7
amendment"*. **You accepted it as written on 2026-08-23**, so §3 below is now the rule and every
phase is unblocked.

**How to read this.** §0 is for the session doing the work — start there. §1–§4 are what was decided
and why. §5–§10 are the work, phase by phase, written for a reader who has not seen the conversation
that produced them. §11 is the test-and-lesson documents to be delivered with it, §12 is what I
decided on your behalf and how to flip each one, and **§13 is the six sessions this splits into** —
the phases are grouped by subject below, and §13 groups them by sitting.

---

## 0. Before you start — read this, then §1

**You are a fresh session. Read, in this order:**

1. this document, whole;
2. `_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md` — the index, whole,
   especially **§5a** (what is actually in the files) and **§7** (known issues `K1`–`K8`);
3. `_claude_notes/locate_tab_testing/06_code_map.md` — behaviour → file and symbol, and the hazards
   `H1`–`H11`. Read this before writing anything;
4. `_claude_notes/locate_tab_testing/07_drawing_facts.md` — the real ids and coordinates.

**Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.**
`07_drawing_facts.md` exists so that never becomes necessary. When this plan needs a number out of
either file, get it with a `python3 -c` one-liner that prints a summary, not by reading the file.

**Running it:**

    cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/

Editor password `edit-1234` (`SWUI_EDITOR_PASSWORD` in `server/.env`). Three facts that have each
cost a session already:

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab.** It is true in `server/.env` now. With it false the
   editing routes are never registered — deliberate, not a bug. Anything you add behind
   `settings.allow_edits` inherits that.
2. **`python -m app` has no reloader.** Any change under `server/app/` needs a restart.
3. **The client is a built bundle.** Any change under `webui/src/` needs `cd webui && npm run build`,
   *and* a server restart if the server changed too. A rebuilt bundle against an unrestarted server
   is the dangerous combination — the new client can send fields the old validator ignores.

**Start from green.** `test_the_committed_artifact_is_exactly_what_the_generator_writes` is red
whenever `locations.json` is ahead of `circuit_logic.json`. Clear it **first**, so you can tell your
own breakage from the inherited kind:

    cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs && python author_circuit_logic.py

**This is a six-session project, and §13 is the schedule. Read §13 before you start.** Find out which
session you are in — the index's §5a and `08_results_log.md` say what has already landed — and **build
that session only.** Do not run on into the next phase: the user walks the lessons and tests between
sessions, and the next phase assumes they have.

**What "done" means for your session:** the four checks in §10 green · its automated tests written ·
**its numbered test-and-lesson document written** (§11 says which one, §13 what it covers) · the
index's §5a and §7 updated · a `change_history.md` entry · and a plain-words report of what landed and
what did not. The numbered lessons are the acceptance, and **they are written for a person, not for
CI** — a session that ships code and no lessons has not finished.

**Committing.** Commit at phase boundaries, and note that `locations.json` is **authored content git
cannot regenerate** — if a phase changes it, say so in the message. Do not commit
`circuit_logic.json` without re-running the generator.

---

## 1. The decisions on record

| | Decision | Consequence |
|---|---|---|
| **1** | **The §7 amendment, accepted as written.** A route may be lifted from the PDF's own vector strokes, or traced by a person. A route synthesised from endpoints stays forbidden by name. | Phases D and E are unblocked. `locate_tab_instruction_and_test_manual.md` §8 is rewritten and three tests are renamed. |
| **2** | **End labels: default on, author the exceptions.** Every wire end and every net terminal gets a label automatically, anchored to the terminal point you already placed, on a computed side. `locations.json` stores only your overrides. | No 269-row queue, so **K7 cannot repeat**. The compass control still works on any one of them. |
| **3** | **Label corrections: the flagged ones are the queue, but anything is editable.** *"A combination of options one and two — correct the ones flagged by the model, but editing all of them should be possible."* | Phase F. The queue defaults to the 278 items the extractor already flagged; a switch widens it to every label on the sheet. |
| **4** | **Five layer switches on the Drawing tab:** `Components` `Terminals` `Wires` `Nets` `Labels`. | The list on the left gets **four** filter buttons, not five — a label is never a row of its own. |
| **5** | **Added 2026-08-24: undo.** *"If there was an undo function for the occasions when markers are moved accidentally, that would be helpful."* | **Phase 0**, now the first thing built: `Ctrl+Z`, plus `Shift`+arrows to nudge a point precisely. See the head of §9. |
| **6** | **Narrowed 2026-08-24: no minimum-drag threshold, and no `rev` counter.** Small moves are legitimate; the two-writers guard is deferred. | Phase 0 is two parts, not three. Both rejections are recorded with their reasons at the end of Phase 0 so they do not creep back. |
| **7** | **The four deleted label points stay deleted**, and whether a wire needs a `label_point` at all after end labels exist is **left open on purpose**. | §6 keeps the field and makes nothing depend on it. Answer it by using the new thing, not by guessing now. |

---

## 2. A correction I owe you about the duplicates

You asked whether the duplicate entities I mentioned are a problem, and whether the model should
collect the suspects for a human to correct. I went and measured it rather than remembering it, and
**the premise is not quite right, in a way that changes the answer.**

**The index has no duplicate entities.** Measured today:

| | |
|---|---|
| `circuit_logic.json` nets | **26**, no twins |
| `circuit_logic.json` terminals / components | **131** / **47**, no twins |
| `custom_kg.json` entities | **291**. Normalising every name aggressively — case, punctuation, and `I`/`1`, `O`/`0`, `L`/`1` folded together — collapses **no** pair. The single hit was `PS1` against `PS1:+`, a component and one of its terminals. Both real. |

And the pair that looks most like a misread is not one: **`L1-A` and `L1-A1` are genuinely two
different nets.** `L1-A` is `DISC1:T1 → CB1:1`; `L1-A1` is `CB1:2 → PS1:L1`. The circuit breaker
sits between them. Merging them would be the error.

**What does have twins is the extraction layer** — the raw text read off the sheet, one level below
the index. Of the 34 distinct printed net labels sitting beside conductors in `geometry.json`, about
nine are misreads:

| Printed label as read | Almost certainly |
|---|---|
| `LI-A`, `LI-A1` | `L1-A`, `L1-A1` — capital I for the digit 1. **This is the `a1` / `al` pair you remember.** |
| `TINSP1`, `TINSP2` | `IINSP1`, `IINSP2` |
| `130.`, `OV.` | `130`, `0V` — trailing ink taken for a full stop |
| `"GND` | `GND` |
| `PB2` | `NET-PB2` — the sheet prints the short form; the index gave it a prefix |
| `C4E-1` | `24E-1` |

The rest — `+4`, `4`, `50`, `A`, `U`, `YY`, `NOT CONNECTED` — are partial reads of things that are
not net names at all.

So, to your two questions:

**Is it a problem?** *Not for any answer the model gives today.* Those strings never became
entities; `author_circuit_logic.py` produced a curated netlist and the twins never got into it. But
it **is** the thing that limits this project: Phase E ranks candidate conductors by comparing a
conductor's printed `net_label` against a wire's net id, and that comparison is why only **17 of 26**
nets match a printed conductor group. Nine of the nine misses are the table above. Correcting them
is not repairing the index — it is unlocking the matcher.

**Should the model collect the suspects for a human?** **It already does, and nothing reads it.**
`geometry.json` `pages[0].review_queue` holds **278 items**:

| Kind | Count | What each carries |
|---|---|---|
| `low_confidence_label` | **159** | `id` (`T0012`), `bbox`, `raw_ocr`, `text`, `confidence` |
| `incomplete_conductor` | **119** | `id` (`C0008`), `endpoints`, and `missing`: which of `net_label`, `spec_label`, `unbound_endpoints` it lacks |

Of the 502 text labels on the sheet, 431 were read and **159 were flagged low-confidence** — 71 of
those came back empty. The extractor has been handing you a ranked suspect list since 2026-08-03.
What has never existed is a screen to review it and a file to record your corrections in. That is
**Phase F**, and it is built the way you asked: the flagged items are the queue, and a switch widens
the same screen to every label on the sheet so nothing is unreachable just because the machine was
confident about it.

---

## 3. The amendment, as it will be written into the manual

This replaces §8 of `locate_tab_testing/locate_tab_instruction_and_test_manual.md`, keeping the
section title **"The one thing that must stay true"**:

> **A wire's route is never computed.** It is either **lifted from the ink** — one or more conductor
> polylines out of `geometry.json`, which are the PDF's own vector strokes rather than a reading of
> them — or **traced by a person along the printed conductor**. It carries which of those it was,
> forever, and a hand-traced path says so on screen.
>
> What stays forbidden is a route **synthesised from its endpoints**: no straight line between two
> terminals, no interpolation, no path derived from anything but ink. A highlight computed from
> terminal positions is the bug, whatever else it fixes.

Provenance gains a second axis, because a lifted conductor is **exact geometry with uncertain
attribution**, and that pair is precisely what a human is confirming:

| Axis | Values | Means |
|---|---|---|
| `geometry` | `extracted` | the polyline is a conductor from `geometry.json` — the PDF's own strokes |
| | `human` | a person traced it corner by corner on the sheet |
| `attribution` | `printed` | the net name printed beside that conductor matches this wire's net |
| | `human` | a person said this run is this wire |

`derived` is a **rejected** value on both axes and a test refuses it by name. Three existing tests
are renamed from *"never a route"* to *"never a route derived from its endpoints"*, which is what
they always tested:

- `server/tests/test_locations.py::test_a_wire_gets_a_label_position_and_never_a_route`
- `server/tests/test_extraction_generator.py::test_a_wire_gets_where_its_name_is_written_and_never_a_route`
- the `_labels` docstring in `server/app/locations.py`, which states the rule for the next reader

### Why the geometry objection was real, kept here so nobody re-opens it

A schematic conductor does not run diagonally from pin to pin. It runs orthogonally, with corners,
and where it crosses another wire it is drawn with a crossover hop — this sheet has 88 of those
circles, and mistaking them for terminals was the hardest-won lesson of the extraction. Take `W052`,
`CR2:14 → TB-120:1`, BLUE 18AWG, on net 120:

| | |
|---|---|
| A straight chord would claim | (861, 381) → (300, 600) — a diagonal ~600 pt long, across the entire relay column and four unrelated circuits |
| The ink actually says | `C0080`: one horizontal run at y = 663.7, from x = 379.8 to x = 301.8 |

The chord is not slightly wrong; it is somewhere else, crossing conductors it has no business
touching, on a sheet where being one 16 pt row out already names a different circuit. For a
highlighter whose whole job is *"which of these lines is the one I care about"*, a wrong line is
worse than no line. That is why the answer was never "a human cannot be trusted to place a wire" —
it was *"a wire needs more than its two ends to be drawn, and the sheet already contains the
corners."*

---

## 4. The measured facts this plan rests on

All re-measured 2026-08-23 against the shipped files, not remembered.

**The netlist** (`circuit_logic.json`):

| | |
|---|---|
| Wires | **71**, each with `from_terminal` and `to_terminal` |
| Wire endpoints | **142**, every one a well-formed `COMPONENT:PIN`, **0 dangling** |
| Wires with a colour and gauge | **69** of 71 |
| Nets | **26**, **127** member terminals between them |
| Terminals / components | **131** / **47** (41 component ids over 47 drawn sites) |
| Designator entries the API publishes | **275** = 47 + 131 + 26 + 71 |

**What you have already placed** (`locations.json`, schema 1) — this has moved a long way since the
manual's §5 was written and the manual now understates it:

| | |
|---|---|
| Components | **41 ids over 47 sites**, every one `source: human` |
| Multi-site components | `CR-BP`, `CR-SW`, `CR-ON`, `CR1`, `CR2` |
| Terminals | **131 — all of them**, every one `source: human` |
| Terminals carrying a chosen label side | **52** of 131; the other 79 sit at the default |
| Wire label points | **0** (`"wires": {}`) — three existed at commit `8f1ae5d` and **were deleted on purpose**. Not a fault, not work waiting |
| Net label points | **0** (`"nets": {}`) — one existed, deleted with them |

**This is the single most important fact in the plan.** Every one of the 131 terminals now has a
point a human confirmed. So:

- Every wire has **two confirmed ends**. All 71 of them, today.
- Every net's members resolve to confirmed points. All 127 of them.
- **An end label needs no coordinate.** It needs a *side* relative to a point that already exists —
  which is why decision 2 is cheap and why 269 end labels are not 269 pieces of work.

**The ink** (`geometry.json` `pages[0]`, in the same PDF-point space as the tiles and every marker —
no registration step):

| | |
|---|---|
| `conductors` | **149** polylines, each with `points`, `endpoints`, `node_ids`, `length` |
| of those, multi-segment | **50**, up to 5 segments — `C0008` is a real 4-corner orthogonal route |
| with a printed `net_label` | **70** conductors, **34** distinct label strings |
| with a `spec_label` | **67** (e.g. `BLUE 18AWG`) |
| `endpoint_bindings` | per endpoint: the `terminal_point` symbol it lands on, and how far away in points |
| `nets` (conductor groups) | **111**, of which **34** labelled |
| `symbols` | 98, of which **88** `terminal_point` · `junctions` **2** |
| `review_queue` | **278** — see §2 |

**How much of the tracing is picking rather than drawing.** Matching each wire against conductors
whose printed `net_label` equals the wire's net *and* whose `spec_label` equals its colour and gauge:

| Wires (71) | Candidates | What you do |
|---|---|---|
| **19** | exactly 1 | glance and confirm — one click |
| **33** | 2 or 3 | say which is which — one click from two or three lit on the sheet |
| **19** | 0 | choose from the 79 unlabelled conductors ranked by proximity; hand-trace only if nothing fits |

Phase F is expected to move wires out of the third row and into the first two, because seven of the
nine label misreads are on nets that carry wires.

**Connectivity growth does not help.** This sheet has 2 junctions and walking shared `node_ids` adds
exactly 0 conductors. Measured, not assumed.

**Test baseline, run today:**

| | |
|---|---|
| Server | **106 tests: 105 pass, 1 fails** — `test_the_committed_artifact_is_exactly_what_the_generator_writes`. That is **K6/H9 doing its job**: `locations.json` is 2 lines ahead of `circuit_logic.json` in the working tree. `cd schematic_extraction/PS20115MLM4-2/extracted_docs && python author_circuit_logic.py` clears it. |
| Web | **127 pass** |
| `ruff` / `tsc -b --noEmit` | clean |

---

## 5. Paths, and the model's file

**Wire paths do not go into `circuit_logic.json`.** Decided in v1, unchanged.

- The netlist answers *what connects to what*, and `from_terminal`/`to_terminal` already says it. A
  polyline adds nothing the model can reason with.
- 149 polylines, half multi-segment, would inflate the one file the model reads end to end.
  `prompts.py` already forbids it `geometry.json` for exactly this reason.
- **The daily benefit:** because the generator never reads paths, saving a path does **not** make
  `circuit_logic.json` stale. No banner, and the artifact test stays green. Paths and end labels are
  the only authored things that cost you no regeneration.

For the simulator on the roadmap (`webui_ideas.md` §3): the boolean network is solved from the
netlist — nets, `COIL_CONTROLS_CONTACT`, `normal_state`. The paths are what lets you *watch* it:
net 121 going dead, then 120, then CR-BP picking up, each drawn on conductors a technician can see.
Paths are display geometry, and display is the right layer for them.

---

## 6. `locations.json` schema 1 → 2

One file, not a new one: one editor, one validator, one lock, one thing to commit. Three additions,
all inside the existing `wires` and `nets` sections. **Nothing in `components` or `terminals`
changes**, so every point you have placed survives untouched.

```json
{
  "drawing_number": "PS20115MLM4-2",
  "schema": 2,
  "wires": {
    "W052": {
      "label_point": [340.2, 655.1],
      "labels": {
        "CR2:14":   { "dir": "ne" },
        "TB-120:1": { "hidden": true }
      },
      "path": {
        "runs": [[[379.8, 663.7], [301.8, 663.7]]],
        "conductors": ["C0080"],
        "geometry": "extracted",
        "attribution": "human",
        "by": "js",
        "at": "2026-08-23T18:04:11.512Z"
      },
      "no_path_on_this_sheet": false
    }
  },
  "nets": {
    "120": {
      "label_point": [null],
      "labels": { "CR2:14": { "dir": "s" } }
    }
  }
}
```

**`labels`** — the end-label overrides, keyed by **terminal id**. One key for both sections so there
is one validator. Values carry `dir` (one of the eight compass sides) and `hidden`. Both optional;
an entry with neither is refused as meaningless. **Only overrides are stored** — an empty `labels`
means every end label is where the default rule put it, which is the normal case and the reason 269
labels cost nothing to keep.

Validation, refusing per field into `problems` like everything else:

- the key must be one of that wire's two endpoint terminals, or one of that net's `member_terminals`.
  A label on a terminal the wire does not touch is refused **by name** — it is the one mistake a
  hand edit can make here that has no visible symptom.
- `dir` must be one of the eight sides `_label_dir()` already accepts. One list, one validator.

**`label_point`** — unchanged, still optional, still *"where the name is printed on the run"*. It is
a different thing from an end label and both may exist: the printed `BLUE 18AWG` sits mid-run, and
the end labels sit at the pins. It stops being work (it never was) and keeps its compass control.

**Whether it is wanted at all is an open question, deliberately left open** (2026-08-24): the four
that existed were deleted on purpose, and *"after the current plan has been executed we may find there
is no more need for labels in their current form. I don't know yet."* So the field is kept, reading it
stays optional everywhere, and **nothing in this plan may depend on one existing** — an absent
`label_point` is never a missing-data state, never a count, never a row in a queue. That is what keeps
it cheap to drop: dropping it later would be a deletion from the schema rather than an unpicking of
features built on top of it.

**`path`** — §3's structure. `runs` is a **list of polylines**, not one, because a crossover hop is a
real gap in the ink and a path spanning two conductors should show the gap rather than close it.
`conductors` records which extracted runs it was lifted from and is **absent on a hand trace**.
Each polyline: ≥2 points, numbers, on the page, rounded to one decimal.

**`no_path_on_this_sheet`** — the explicit "there is nothing here to trace" state, so the Phase E
count can reach 71. This is the **K7 defence**, put in deliberately rather than discovered later.

**Migration.** A schema-1 file is read and upgraded in memory on load — no new keys means nothing to
convert — and the next save writes `2`. `parse()` accepts 1 and 2 and refuses anything else, as it
does now. A schema-2 file read by an older server is refused loudly by the existing check, which is
the correct behaviour and worth a test.

---

## 7. End labels: the rule, in one place

The whole of decision 2 comes down to one pure function, and it belongs in one new module —
`webui/src/features/drawing/endLabels.ts`, unit-tested like `model.ts`, imported by both tabs so
they cannot drift.

```
defaultSide(anchor, awayFrom, taken) → 'n' | 'ne' | 'e' | ... | 'nw'
```

- **For a wire end:** the side pointing *away from the wire's other end*, snapped to the nearest of
  the eight. A label on `CR2:14` for the run heading west sits east, clear of its own conductor.
- **For a net terminal:** the side pointing away from the centroid of the net's other members.
- **Then de-collide.** A terminal can carry up to three texts: its own pin name, one wire label and
  one net label. Precedence is fixed and not negotiable per-terminal, because a rule a reader cannot
  predict is worse than a collision:
  1. the terminal's **own** label keeps its authored side (52 of 131 have one; the rest are at the
     default),
  2. the **wire** label takes its computed side, moved to the next free side clockwise if taken,
  3. the **net** label takes what is left.
- **Every step is deterministic and depends on nothing but the points.** Same input, same output, no
  state, no order-of-render dependency. That is what makes it testable and what stops a label
  wandering when an unrelated terminal moves.

Drawing rules:

- End labels are governed by the **`Labels`** switch on the Drawing tab and by the wire/net switches
  of the thing they belong to: no `Wires`, no wire end labels.
- They obey the **existing 30% zoom floor** for label text. With 269 more strings on the sheet this
  matters more than it did; the floor is one constant and it stays one constant.
- The **selection is exempt from the layer switch**, exactly as `located` already is: the labels of a
  selected wire or net draw even with `Labels` off, because you asked for that one thing by name.
  This is the `H11` shape of bug and the plan says so out loud so it does not get re-introduced.

**What an end label says.** A wire's id is **ours** — `WIRE_IDS_ARE_OURS` is `True` in
`drawing.py`, so all 71 of them are `on_sheet: false` and you will not find `W052` printed anywhere.
So the end label shows **the wire's spec** (`BLUE 18AWG`), which is what is printed and what a
technician verifies with their eyes, and the `W052` stays in the roster and the tooltip where the
list already shows it with its `our id` badge. A net's label shows **the net id** (`120`), with the
same `our id` badge on the invented ones (`INVENTED_NET_PREFIX`, e.g. `NET-PB1`, `NET-PB2`).
Flippable — §12.

---

## 8. The two screens, as they will be

### The Locate tab

Only what changes. Everything else — the target panel, the sites, the pins, the advance, the flight
ceiling — is untouched.

1. **`Wire & net labels` becomes two filters: `Wires` and `Nets`.** `Filter` and `FILTERS` in
   `LocateTab.tsx`; the third toolbar count splits into two. The `computed` row state stays but its
   words change (§9, Phase B) because *"route from its terminals"* is exactly the sentence §3 just
   made false.
2. **A wire's panel gains a two-ended compass.** Two compass controls side by side, headed with the
   endpoint terminal ids, each writing `labels[terminal].dir`. Plus `hidden` per end and a
   **Reset to default** that deletes the override rather than writing the value the rule would have
   chosen — storing a default as an override is how a file stops telling you what a human decided.
3. **A net's panel gains one compass per member terminal**, in `member_terminals` order, scrollable —
   net 130 has the most. Same three controls each.
4. **`K4` is fixed here rather than worked around.** The eight-way control currently does nothing
   until a point exists; an end label's anchor is a terminal point that already exists in all 269
   cases, so the control is live the moment the row is armed. `K4` stops applying to wires and nets
   and stands only for the old `label_point`.
5. **The path controls** arrive in Phase E, in this same panel, below the labels.

### The Drawing tab

**Five layer switches, top right** (decision 4): `Components` `Terminals` `Wires` `Nets` `Labels`.
Independent, filled when on — the 2026-08-19 rule, because any combination is legal and *which
filters are in effect* has to be readable on all five at once. `Components` starts on and the rest
off, so the tab looks as it does today until you ask for more. A group with nothing to draw still has
no button at all.

**A list down the left**, new, and it is a *reader's* list:

| | |
|---|---|
| Rows | all 275 designators, alphabetical by id, exactly the Locate tab's order |
| **Read-only** | no compass, no site controls, no place button, no editing of anything. Clicking a row **selects** it — the same `select(kind, id)` the Ask tab's citations call, so the two entry points cannot drift |
| Four filter buttons above it | `Components` `Terminals` `Wires` `Nets` — **these filter the list only, never the sheet.** No fifth `Labels` button: a label is not a row |
| A text box above those | substring match on id and on the one-line label, case-insensitive, live |
| Collapse | a chevron in its header collapses it to a thin rail with a reopen button; the state persists across the `F2` trip and a reload |

**The division of labour, which is the point of the design and belongs in the manual in these
words:** the buttons *top right* change **what the drawing shows**; the buttons *over the list*
change **what the list shows**; the text box narrows the list further. Neither set touches the other.
A wire can be selected from the list and highlighted on the sheet while `Wires` is off, because the
selection is a mode and always draws — the same exemption as `Labels` in §7.

**Reuse, not a second list.** `WorkList.tsx` is already fully presentational —
`{entries, stateOf, targetId, onPick}` — including the `scrollIntoView` behaviour a reader wants for
free. It moves to `webui/src/components/DesignatorList.tsx` and both tabs import it; `WorkList.tsx`
becomes a thin editor-flavoured wrapper or disappears. The reader's `stateOf` is computed from
`Designator.placement`, which `/api/designators` already publishes, so **the Drawing tab needs
nothing from the locate store and stays readable with `SWUI_ALLOW_EDITS` false.** That last clause is
the load-bearing one: this list must work for a reader who has no editor password.

**The selection card becomes a roster** (Phase A), and Phase D's `Nets` panel from v1 is **deleted
from the plan** — this list replaces it, and one list beats a list plus a panel that does 80% of the
same thing.

---

## 9. The phases

**Build them in this order, which is not the order they are written in below** — and in the six
sessions of §13, not in one run:

> **0 + A** ·│· **B** ·│· **C** ·│· **F** ·│· **D + G** ·│· **E**
> &nbsp;&nbsp;&nbsp;session 1 &nbsp; 2 &nbsp;&nbsp; 3 &nbsp;&nbsp; 4 &nbsp;&nbsp;&nbsp; 5 &nbsp;&nbsp;&nbsp;&nbsp; 6

The sections that follow are grouped by subject rather than by sequence, because D and E are one
subject read together. Where they disagree with the arrow above, **the arrow wins**, and §13 says the
same thing again as a list of stopping points. Why this order: 0 protects the editor you will be
living in; A fixes a live bug and needs nothing new; B and C are the screens and need no new file
format beyond the label overrides; F corrects the printed labels that E's ranking reads, and E works
without it but works worse; D must precede E because E has nothing to write into until `path` exists.

Each phase is separately shippable and separately testable.

Run the four checks at every phase boundary (§10). **Do not carry a red suite into the next phase**
— except the known K6 artifact test, and re-run the generator rather than tolerating it.

---

### Phase 0 — undo, and a precise way to move a marker a little

*Added 2026-08-24, then narrowed the same day by two decisions from you. Read the "rejected" notes at
the end before proposing either idea again.*

**Why it exists.** You asked for it, after `BYPASS-CB:1` moved 0.1 pt by accident: *"If there was an
undo function for the occasions when markers are moved accidentally, that would be helpful."* It is
**`K8`** in the manual. Today a drag writes the new point into the draft, autosave persists it, and
the coordinate it replaced is gone from the running program — git recovers the last **commit**, never
the last **action**.

Two parts, and **the second is what replaces the threshold I originally proposed.**

**Where it goes, verified 2026-08-24 rather than assumed** — this is the fact that makes Phase 0
small, so check it still holds before designing anything else:

- The draft lives in **`webui/src/stores/locateStore.ts`** (note: `stores/`, **not**
  `features/locate/`), as `document: LocationsDocument | null`.
- **Every mutation funnels through one function: `edit(change)`.** It is the *only* place in the file
  that writes the document — `set({ document: ... })` appears exactly once, at `locateStore.ts:133`.
  `place`, `clear` and every label and site action call `edit` with a pure function from
  `features/locate/model.ts` (`place`, `setTerminalPoint`, `setSitePoint`, `setLabelPoint`,
  `setLabelDir`, `renameSite`, `removeSite`, `assignTerminal`, `clear`). The store's own header says
  the rule out loud: *"The draft is the whole file. Every mutation returns a new document."*
- **So the undo stack is a push inside `edit()`** — capture `current` before replacing it — and every
  existing mutation becomes undoable at once, with no per-action work and nothing to forget. The
  three sites that set `document` for other reasons (`load`, `save`'s reconciliation, `reset`) must
  **clear** the stack rather than push to it, and that is the one distinction to get right.

**(a) An undo stack over the draft.** `Ctrl+Z` / `Cmd+Z`, and `Ctrl+Shift+Z` to redo.

- **What it undoes: document mutations only** — a point placed, a dot dragged, a label side chosen,
  a site added, renamed or removed, a pin assigned, and (from Phase F) a label correction. **Not**
  pan, **not** zoom, **not** the armed target, **not** the filter. An undo that also walks back
  navigation is worse than no undo, because the two interleave and you can no longer predict what the
  key will do.
- **How: a capped stack of whole-document snapshots**, 50 deep. The store already holds the draft as
  one document, the document is 38 KB, and 50 of them is under 2 MB — so this needs no patch algebra
  to be correct. That is the point: an inverse-patch scheme that is wrong once loses work, which is
  the thing being fixed. Correctness beats cleverness in the one place where the bug *is* data loss.
- **It must announce itself.** A silent undo on a 275-row document is invisible. The save badge says
  what was undone — *"undid: moved `BYPASS-CB:1`"* — and the list arms that row and scrolls it into
  view, reusing the `scrollIntoView` effect that already exists for the armed row.
- **It autosaves like any other mutation.** An undo that does not persist is a lie after a reload.
- **Guarded by `isTextField`** (`webui/src/lib/keys.ts`, already there), so a `Ctrl+Z` with the caret
  in the site-name box undoes *typing* and never un-places a dot. And note it is a **third** `window`
  key listener beside the two `Escape` ones: hazard **`H10`** applies, the `activeTabId` guard is what
  keeps them apart, and this is written down before the listener exists rather than after.
- **In-memory, cleared on load.** Cross-session recovery stays git's job, and the manual now says so
  in as many words.

**(b) `Shift` + arrow keys nudge the armed point.** Your suggestion, and it is the right shape: the
cure for an accidental small move is not to forbid small moves, it is to make a small move something
you can do exactly, without a mouse, and undo cleanly.

- **The keys are not free, so check before writing.** Plain arrows already **pan the sheet** —
  `ArrowLeft/Right/Up/Down → panBy(KEY_PAN)`, `KEY_PAN = 60` CSS px, in
  `webui/src/features/drawing/useTileViewport.ts` `onKeyDown`, shared by both tabs. Nothing nudges a
  marker today. (An earlier draft of this plan said arrow keys already nudged. It was wrong; the
  Drawing tab's footer says *"arrow keys nudge"* about the **view**.)
- **So nudging takes a modifier, and plain arrows keep panning.** `Shift`+arrow moves the armed
  point; the sheet still pans with a bare arrow. **Do not make the bare arrow change meaning
  depending on whether something is armed** — the moment you are working on a dot is exactly the
  moment you also want to pan, and a key that silently means two things is worse than a modifier.
- **Step size in points, not pixels**, so a nudge is the same correction at 11% and at 400%:
  **`Shift`+arrow = 1.0 pt**, **`Shift`+`Alt`+arrow = 0.1 pt** — one tenth being exactly the
  precision `locations.json` records, so the finest nudge is the finest thing the file can say.
  Against 16 pt conductor rows, 1 pt is a comfortable correction and 0.1 pt is the last word.
- **Only an armed, placed point moves.** No target, or a target with no point yet, and the keys do
  nothing rather than inventing a placement — placing is a click, and it stays a click.
- **A run of nudges is one undo.** Consecutive nudges on the same point coalesce into a single stack
  entry while they keep coming, the way a text editor coalesces typing. Ten presses then one `Ctrl+Z`
  puts the dot back where it started, not one tenth of the way back.
- **It writes and autosaves like a drag**, and it is the same mutation, so it needs no new validator:
  it calls `edit()` with `model.setTerminalPoint` or `model.setSitePoint` according to the armed
  target's kind — the same functions a drag already goes through — so it inherits the stamp, the
  rounding and the undo entry for free.

**Rejected, with reasons, so neither comes back by accident:**

- ~~**A minimum-drag threshold**~~ — *rejected by you, 2026-08-24:* *"I do not want a twitch threshold
  at this time. That is because sometimes I need to move a marker only a small amount."* Correct, and
  it is the deeper answer: a threshold cannot tell a twitch from a deliberate 0.1 pt correction,
  because on this drawing both are real. Undo plus a keyboard nudge covers the accident without ever
  refusing an intention.
- ~~**A `rev` counter on `locations.json`, refused on mismatch**~~ (the `K2` fix) — *deferred by you,
  2026-08-24.* In plain terms it was: a number in the file that goes up by one on every save; the
  editor remembers which number it loaded; if the file on disk has a different number, the save is
  **refused** with *"reload first"* instead of quietly overwriting whatever changed it. It only ever
  matters when two things write the file — two browser tabs, or a hand edit while a tab is open — and
  you work in one tab. `K2` stays a known issue and stays theoretical.

  **And it does not make the system multi-user** — asked and answered 2026-08-24, recorded because it
  is an easy thing to assume. `rev` detects a collision; it does not let two people work. Four things
  would be needed, and the concurrency is not the hard one:

  1. **Identity.** `by` comes from `SWUI_EDITOR_NAME` in `server/.env` — one server-wide string,
     currently `js` — and there is one shared `SWUI_EDITOR_PASSWORD`. So every writer stamps every
     point with the same name, and under multi-user `by` becomes **a lie**. That matters more than
     any lock: the whole design rests on *a named human confirmed this*, which is why the vision
     guesser was rejected. Provenance that cannot tell two people apart undercuts the system's only
     claim. This is accounts, not a counter.
  2. **`rev`** — the concurrency floor, i.e. this item.
  3. **Per-entity writes.** The save is a whole-document `PUT`, so with `rev` alone a second person is
     refused for editing a terminal the first never touched: no data lost, plenty of work lost. `PATCH`
     one terminal and a refusal means a real conflict.
  4. **Awareness** — some sign that another editor is in the file.

  **What makes this cheaper than it sounds:** `locations.json` is **per drawing**. Two people on
  different sheets never touch the same file, so the unit of isolation already exists. Realistic
  multi-user for a library of many drawings is *several people, each on their own sheet* — identity
  and per-file ownership, not merge algorithms. Two people on the *same* sheet at once is the rare
  hard case, and that is what 2 and 3 are for.

  **One live fact for whoever picks this up:** `SWUI_HOST=0.0.0.0`, so the server is already reachable
  from the network, and `SWUI_EDITOR_PASSWORD` is still the default `edit-1234`. A second writer is
  one shared password away, and the `.env` comment says as much.

Why Phase 0 still goes first: it is small, it is the thing you asked for, and Phase E asks you to sit
in this editor for 71 wires. Undo before a long authoring run, not after it.

---

### Phase A — make the highlight tell the truth about membership

*Fixes the bug in your other report. No new file format, nothing gated.*

Your report — *"clicking `120` marks Bypass-CB, DISCHARGE1, INFEED1 and TB-120, but not CR2"* — is
real, and it is not about paths. Traced through the live index: CR2 **is** in the highlight set and a
dot **is** drawn. Two things are wrong at once.

1. **The ring is on the wrong one of CR2's drawn places.** The highlight set is `entry.members`,
   which the server builds as the **parent components** of the net's terminals. Net 120's actual
   membership is *terminals*: `BYPASS-CB:1, CR2:14, DISCHARGE1:3, INFEED1:3, TB-120:1, TB-120:2,
   TB-120:3`. `CR2:14` is CR2's NO contact. (When that report was written nobody had placed it and it
   fell back to CR2's coil seed 480 pt away; **all 131 terminals are placed now, so the dot will land
   right the moment the ring moves to the terminal.**)
2. **The same disagreement, quieter, on `DISCHARGE1`** — its ring on the component point while the
   net's member is `DISCHARGE1:3`. And `TB-120:1/2/3` collapse onto one dot, so 7 members show as at
   most 5.

Fix — highlight **the terminals a net is made of**, each carrying its own provenance:

- **`server/app/drawing.py` `_entry()`** — wire and net entries gain
  `terminals: [{id, point|null, placement|null, site?}]`, **undeduped and in order**: `[from, to]`
  for a wire, `member_terminals` for a net. `members`, `places`, `point` and `rect` are untouched, so
  nothing existing breaks. ~269 small objects onto a payload that already carries 275 entries.
- **`webui/src/api/types.ts`** — the matching optional field on `Designator`, documented as *the
  members, not their parents*.
- **`DrawingTab.tsx`** — when the selection is a net or a wire, render **terminal** markers for its
  members alongside the component markers, ringed, each styled by its own `placement` through the
  existing `MarkerLayer` (filled = confirmed, hollow = seed or parent).
- **`SelectionCard.tsx`** — becomes a roster: one row per member terminal with its state in the
  words the list already uses (`placed`, `estimate`, `on its component`, `nowhere`), clickable to fly
  there, plus a *place it* link that arms that terminal on the Locate tab **when editing is enabled**.
  The component chips stay, demoted.
- Framing already boxes every member's point (`rect` is their bbox) so nothing ringed can be off
  screen once the rings are on the terminals — **assert that in a test rather than assume it.**

---

### Phase B — wires and nets become two things, and their labels appear

*The Locate tab changes of §8, the schema-2 `labels` key, and the end-label rule of §7.*

- **`server/app/locations.py`** — `SCHEMA = 2`; `parse()` accepts 1 and 2. A new `_end_labels()`
  beside `_labels()`, validating as §6 says and refusing per field into `problems`. The resolved
  structure hangs off the wire/net entry; `Placed` and `Spot` gain nothing, so **no existing
  precedence changes.** `save_locations` and its atomic write are untouched.
- **`server/app/drawing.py`** — publish each end label's resolved side on the wire/net entry, beside
  the `terminals` array Phase A added. The lesson of change 12 applies exactly: *`label_dir` lives
  nowhere else in the payload*, so a side that is not published is a side the reader cannot see. One
  test per direction of that mistake.
- **`webui/src/features/drawing/endLabels.ts`** — new, pure, the §7 rule, unit-tested first.
- **`LocateTab.tsx`** — `Wires` and `Nets` as separate filters; the count splits in two.
- **`TargetPanel.tsx`** — the two-ended compass for a wire, the per-member compass for a net, each
  with `hidden` and **Reset to default**.
- **`MarkerLayer.tsx`** — draw end labels through the existing `LABEL_SIDE` machinery, honouring the
  precedence and the zoom floor. One label renderer, not two.
- **The `computed` row state is re-worded.** *"route from its terminals"* is the sentence §3 makes
  false. It becomes *"ends known, no path"* until Phase D, and then reports the path state.

---

### Phase C — the Drawing tab's list

*Pure client. No server change, no schema change. Works with `SWUI_ALLOW_EDITS` false — that is the
acceptance criterion, not a nicety.*

- **`webui/src/components/DesignatorList.tsx`** — `WorkList.tsx` promoted, unchanged in behaviour,
  including the `scrollIntoView` effect.
- **`webui/src/features/drawing/DrawingList.tsx`** — the header: four filter buttons, the text box,
  the collapse chevron. Filter and text state live in `DrawingTab`, collapse state in the app store
  so it survives `F2` and a reload.
- **`DrawingTab.tsx`** — `LAYERS` becomes five (`Wires` and `Nets` split out of
  `Wire & net labels`, `Labels` added). Two-column layout, list left and sheet right.
- **The two hazards to write down while building it, because both have bitten already:**
  - `located` must keep being built from the components group **regardless of its switch** (`H11`), or
    turning `Components` off kills every `runs through` chip. Five switches is five chances to get
    this wrong instead of three.
  - a click on a row and a click on a dot must reach the **same** `select(kind, id)` with the marker's
    **own** `kind` — never a hard-coded `'component'`. That was the invisible half of change 10.

---

### Phase D — wire paths: the file, the API, the painting

*Unblocked by decision 1.*

- **`locations.py`** — `_paths()` beside `_labels()`, validating as §6 says, refusing per field.
- **`GET /api/paths`** (new, uncached, beside `/api/designators`) →
  `{"wires": {"W052": {"runs": [...], "geometry": "...", "attribution": "..."}},
   "nets": {"120": ["W052","W053","W063","W068"]}}`.
  The `nets` map is net → wire, computed from `wire.net`, which the client does not otherwise have.
  **A net stores nothing: its highlight is the union of its wires' paths** — your *"a net is just a
  collection of wire paths"*.
- **`paint.ts`** — `polylineToDevice(points, viewport, dpr)` and
  `paintRuns({ctx, dpr, viewport, runs, style})`, routed through the **same** `tileDestRect`
  arithmetic as `pointToCss`, so a highlight can never disagree with the tiles. `MarkerLayer`'s own
  header already prescribes this: *"149 conductor polylines… are far cheaper painted, so they will go
  into `paint.ts`."*
- **`TileSheet.tsx`** — an optional `runs` prop painted in the same rAF pass, after the tiles and
  under the DOM markers. One highlighter stroke: width in **points** so it tracks the zoom, clamped
  in device pixels so it survives an 11% fit, translucent, round caps, one colour per selection.
  **One net or one wire at a time.**
- **Drawing tab reads `appStore.selection`; Locate tab reads its own `target`.** Deliberately not
  shared — hazard `H10` is what two coupled `window` listeners already cost us.

---

### Phase F — the label corrections review

*Decision 3, and it comes before E because it feeds E's ranking. E works without it.*

- **A new file, `label_corrections.json`, beside `locations.json`** — authored, human-owned, and
  **not** `locations.json`. Three reasons and they are all decisive: it keys on extraction ids
  (`T0012`, `C0080`) rather than designators; it is written from a different screen, so folding it in
  would widen the `K2` last-write-wins window across two workflows instead of one; and it is a
  *correction to a reading of the sheet*, where `locations.json` is a *statement about positions*.
  Different claims, different files.

  ```json
  {
    "drawing_number": "PS20115MLM4-2",
    "schema": 1,
    "labels": {
      "T0012": { "text": "L1-A",   "was": "LI-A",  "by": "js", "at": "..." },
      "T0018": { "text": "L1-A1",  "was": "LI-A1", "by": "js", "at": "..." },
      "T0104": { "text": null,     "was": "YY",    "note": "not a net label",
                 "by": "js", "at": "..." }
    }
  }
  ```

  `was` is kept so a correction can be audited against the original reading forever, and `text:
  null` is how you say *"this is not a label at all"* — which seven of the 34 need.
- **`GET /api/review`** and **`PUT /api/review`**, both registered only under
  `settings.allow_edits`. The GET publishes each item with its `bbox`, `raw_ocr`, `text`,
  `confidence`, any correction already made, and — for a conductor label — the conductor's endpoints
  so the screen can fly to the ink. `geometry.json` is parsed once behind an `lru_cache` and only the
  subset is kept: **the file itself never reaches the browser and never reaches the model.** That is
  a new hazard for `06_code_map.md`.
- **A new tab, `Review`,** enabled by the same `isEnabled` rule as Locate. Not a panel on the Locate
  tab — that screen is already the densest in the app.
  - The sheet on the right, one item's `bbox` framed and ringed, so you are reading the ink and not
    a transcription of it.
  - The queue on the left: **the 278 flagged items by default**, ordered worst-confidence first,
    with the 71 empty reads grouped at the end since they need a decision rather than a correction.
  - **A switch to `All labels`** — every one of the 502, flagged or not — which is the half of
    decision 3 that says *"editing all of them should be possible."* Same rows, same editor, no
    second screen.
  - One text box per item, `Enter` to accept, and a **not a label** button that writes `text: null`.
  - **A `Net labels` filter**, because that is the 34 that unlock Phase E, and finishing those first
    is worth doing before the other 244.
- **`drawing.py` and the Phase E matcher read the corrections**, and a corrected label is badged as
  corrected wherever it is shown. `author_circuit_logic.py` **does not** read this file — the netlist
  is already right and nothing here changes it. Worth a test that says so, so a later session does
  not wire it in and quietly move the index.

---

### Phase E — the path editor: propose, check, modify, create

*Your three requirements. On the Locate tab, behind the editor password like everything else that
writes.*

- **`GET /api/conductors`** — registered only under `settings.allow_edits`, so a reader never
  downloads it. The 149 conductors reduced to what tracing needs: `id`, `points`, `net_label` (with
  any Phase F correction applied), `color`, `gauge`, and each endpoint's bound `terminal_point` and
  distance. Same `lru_cache`, same rule: `geometry.json` never reaches the browser whole.
- **`webui/src/features/locate/paths.ts`** — pure, unit-tested like `model.ts`:
  `candidates(wire, conductors, geometry)` → a **ranked** list. Worst assumptions first: printed
  `net_label` equals the wire's net → `spec_label` equals its colour and gauge → endpoint bindings
  closest to the wire's two resolved terminal points → total length plausible. **Never auto-accepts.**
  19 of 71 come back with a single candidate and still want a click — that is the rejected guesser's
  lesson, and it is the whole reason this project is trustworthy.
- **The wire panel**, below the label controls:
  - *Requirement 1 — where information exists:* the ranked candidates, each lighting on the sheet as
    you hover. Click to accept. Multi-select to assemble a path from several conductors across a hop.
  - *Requirement 2 — check and modify:* an accepted path shows its two provenance badges, its
    conductor ids and its length; **Clear**; re-pick; and drag a vertex of a hand-traced run. **An
    extracted run is not draggable** — editing lifted ink would silently turn it into something else,
    so the UI makes you say so by converting it to `geometry: human` first, with the conversion
    stated on screen.
  - *Requirement 3 — create where information does not exist:* **Trace** — click each corner,
    `Enter` to finish, `Esc` to abandon, `Backspace` to undo a corner — stamped `geometry: human` and
    badged as hand-drawn everywhere it appears. Offered **after** the proximity-ranked unlabelled
    conductors, so hand-drawing is the last resort: 79 unlabelled conductors are real ink and beat a
    hand trace every time.
- **Counts and filters.** A `Paths` filter and a count — `… · 0 of 71 wire paths`. This reverses
  `04_tests_labels.md` T-300's *"wires are not work"*, so it needs the explicit
  **no path on this sheet** state from §6 or the count can never reach 71. **That is the K7 mistake,
  avoided deliberately this time.**
- **The quiet win.** Arm net 120, see its four runs lit, and place a pin on the end of a conductor
  instead of by eye. The highlighter is a placement aid, and placement accuracy is what the whole
  project rests on.

---

### Phase G — the triggers

**Build this straight after D** — it is written last only because it is the smallest thing here, and
version 1 had it as a phase of its own with more in it. Two small items.

- **Ask tab hyperlink** — already works end to end: `Citation.tsx` calls `select(entry.kind,
  entry.id)` then `setActiveTab('drawing')`. A net or wire citation now paints runs and the roster,
  with **no change beyond A and D**. One thing to know: `Citation.tsx` only makes a citation
  clickable when `entry.point` is non-null, so a net with no positioned member is deliberately dead
  text. That stays.
- **Locate tab list row** — arming a wire or net highlights it. `target` already exists and the rows
  already exist under the new `Wires` and `Nets` filters. Small.
- **v1's Phase D "Nets button and panel" is deleted** — Phase C's list does it better and once.

---

### Not in this plan, and why

- **Paths in `circuit_logic.json`** — §5. Explicitly out.
- **Net-level path storage** — a net is the union of its wires' paths. Nothing to author.
- **More than one net highlighted at a time** — one at a time, one colour.
- **Auto-accepting the 17 exact net matches** — proposals only. The machine ranks, you confirm.
- **Corrections feeding `author_circuit_logic.py`** — Phase F fixes readings of the ink, not the
  netlist. The netlist is already right; a test asserts the generator ignores the file.
- **Fixing `K2`/`H1`** (whole-file save, last write wins) — **still out**, deferred by you on
  2026-08-24 once it was clear it has never actually bitten. Noted only so the next reader knows it
  was weighed and not forgotten: this plan does put more authored work into that file, and adds a
  second authored file written from a second screen.
- **A persistent undo history across sessions.** The stack is in memory and dies with the page. A
  journal of every mutation on disk would survive a reload and give you a timeline, and it is a
  bigger idea than this project — the `by`/`at` stamps on every point are already most of the data it
  would need. Git is the answer for now, and it is the only cross-session undo there is.

---

## 10. Verification

At every phase boundary, from the manual §1:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

**Baseline measured 2026-08-23: 106 server (105 green + the K6 artifact test, red because
`locations.json` is 2 lines ahead), 127 web, ruff and tsc clean.** Re-run
`author_circuit_logic.py` first so you start from all green and can tell your own breakage from the
inherited kind.

New tests, in the house style — one `it` per behaviour, named for the fault it prevents:

| Where | Test |
|---|---|
| `webui/src/stores/locateStore.test.ts` (Phase 0, new) | undo restores the exact previous coordinate, to the tenth of a point · undo of a site rename restores the old name · **undo does not change the pan, the zoom, the armed target or the filter** · the stack caps at 50 and drops the oldest · redo after undo returns to the newer value · undo with the caret in a text field is not intercepted (`isTextField`) · an undone mutation is autosaved · the badge names what was undone |
| `webui/…/LocateTab.test.tsx` (Phase 0) | `Shift`+arrow moves the armed point 1.0 pt and **`Shift`+`Alt`+arrow moves it 0.1 pt, at every zoom** · a **bare** arrow still pans and does not move the point · no armed point, or an armed row with no point, and `Shift`+arrow does nothing at all · **ten nudges then one `Ctrl+Z` returns to the starting coordinate**, not to the ninth · a nudge autosaves |
| `server/tests/test_api.py` | a net entry names every member terminal, in order, undeduped, each with its placement · a wire entry names `[from, to]` in that order · every ringed member is inside the entry's `rect` |
| `server/tests/test_locations.py` | schema 1 is read and schema 3 is refused · an end label on a terminal the wire does not touch is refused **by name** · a bad `dir` costs that label only · a `labels` entry with neither `dir` nor `hidden` is refused · a path of one point is refused and costs that path only · a path off the page is refused · `geometry: derived` is refused **by name** · the three renamed *"never a route derived from its endpoints"* tests |
| `server/tests/test_paths.py` (new) | net 120 resolves to the paths of `W052/W053/W063/W068` · a wire with no path is absent rather than null · `/api/conductors` is 404 with `allow_edits` false · `geometry.json` is parsed once for N requests |
| `server/tests/test_review.py` (new) | a correction is written with its `was` and read back · `text: null` means *not a label* and is not confused with an empty correction · `/api/review` is 404 with `allow_edits` false · **`author_circuit_logic.py` output is byte-identical with and without a corrections file** |
| `webui/…/endLabels.test.ts` (new) | a wire's end label sits away from its own run · a net terminal's sits away from the net's centroid · a terminal carrying a pin label, a wire label and a net label gets three distinct sides · the same input twice gives the same three sides · **Reset to default deletes the override rather than writing the computed value** |
| `webui/…/paint.test.ts` | every vertex of a projected polyline agrees with `pointToCss` on the same point — the existing agreement idiom, which is what keeps one projection |
| `webui/…/paths.test.ts` (new) | `candidates()` ranks the printed-label match first · returns 2 for `W052` and picks neither · falls back to the unlabelled-by-proximity list when the label matches nothing · a Phase F correction changes the ranking |
| `webui/…/DrawingTab.test.tsx` | selecting net 120 draws a dot for `CR2:14` and the roster names all seven members · a net whose wires have no path says so instead of drawing · **the list renders with edits disabled** · a list filter button does not change what the sheet draws, and a sheet switch does not change the list · the text box filters on id and on label · turning `Components` off leaves the `runs through` chips alive (`H11`) · a row click and a dot click raise the same selection with the marker's own `kind` · the selection's labels draw with `Labels` off |
| `webui/…/LocateTab.test.tsx` | `Wires` and `Nets` filter separately · accepting a candidate writes `path.runs` and `conductors` and **nothing that looks like a `point`** · a hand trace writes `geometry: human` · a wire's two compasses write two different `labels` keys |
| `webui/…/ReviewTab.test.tsx` (new) | the queue defaults to the flagged items, worst confidence first · the `All labels` switch reaches an unflagged label · a correction shows the original reading beside it |

**One thing whoever runs these must know:** `test-setup.ts` forces `getContext('2d') → null`, so
**the canvas highlight cannot be asserted through the DOM.** It is tested as pure geometry in
`paint.test.ts` plus the runs handed to `TileSheet`. That split is deliberate and is the same one
`paint.ts` already has.

Then walk it by hand, server on `localhost:9700`. **This is the end-to-end walk for after Session 6**
— each session has its own numbered lessons in §11, and those are what the user walks between
sessions. This list is the proof that the whole thing works together:

1. Ask a question whose answer cites `120`; click it. The roster names all seven member terminals and
   every ring is on a **terminal**, `CR2:14` on CR2's NO contact and not on its coil.
2. On the Drawing tab, collapse the list, reopen it, press `F2` twice: still open, same filter, same
   text, same scroll.
3. Turn `Wires` off with net 120 selected: the highlight stays. Turn `Components` off: the
   `runs through` chips stay alive.
4. `F2` to Locate, arm `W052`, set one end's label north-east, **Reset to default** the other. Paste
   `locations.json`: exactly **one** `labels` entry, and it is the one you set.
5. Accept `C0080` for `W052`, watch the badge go `saved`. Confirm the block has `runs` and **no**
   `point`.
6. **Re-run nothing.** `circuit_logic.json` stays current and the artifact test stays green — the
   proof that paths and end labels are display geometry.
7. Trace one wire by hand from the 19 with no candidate; confirm it is badged hand-drawn on both tabs.
8. On the Review tab, correct `LI-A` → `L1-A`; confirm net `L1-A` gains conductor candidates it did
   not have, and that `author_circuit_logic.py` output does not change.
9. Restart the server, reload: everything comes back.

---

## 11. The test manual to deliver with it

You asked for tests in the shape of `_claude_notes/locate_tab_testing/` — every test a numbered
lesson that says what to click and what should happen, so working through them teaches the screen.
Same house style, same reporting block, added to the same directory so the index stays the one door
in.

**One document per session** (§13), numbered so the directory reads in the order the work happened,
and each one written *by the session that ships the phase* — never left for later.

| File | Tests | Session | Covers |
|---|---|---|---|
| `05_tests_save_and_recover.md` (extended, not new) | **T-470–T-490** | 1 | `Ctrl+Z` after an accidental drag puts the dot back to the tenth of a point · undo of a rename, a site, a pin, a label side · undo leaves the view and the armed row alone · redo · **`Shift`+arrow and `Shift`+`Alt`+arrow, walked at 30% and at 400% to show the step is in points** · a bare arrow still panning · a run of nudges undone in one press · and how to recover a point from git, which is still the only cross-session undo |
| `09_tests_net_membership.md` | **T-500–T-520** | 1 | selecting net `120` rings seven **terminals** and not five components · `CR2:14` gets its own dot at its NO contact rather than a ring on CR2's coil · the roster names every member and its state · *place it* arms that pin on the Locate tab · every ringed dot is on screen after the flight |
| `10_tests_end_labels.md` | **T-550–T-590** | 2 | `Wires` and `Nets` as separate filters · the two-ended compass · the per-member net compass · `hidden` · **Reset to default** deleting rather than writing · three labels on one terminal getting three sides · the 30% floor · the side surviving to the Drawing tab |
| `11_tests_drawing_list.md` | **T-600–T-650** | 3 | the list, its four filter buttons, the text box, collapse surviving `F2` and a reload · **the list filters the list and the switches filter the sheet, and neither touches the other** · five switches · it all working with editing disabled |
| `12_tests_label_corrections.md` | **T-700–T-740** | 4 | the flagged queue worst-confidence first · the `All labels` switch reaching an unflagged label · `not a label` · `was` surviving · correcting `LI-A` → `L1-A` · **the netlist not moving** |
| `13_tests_paths_highlight.md` | **T-800–T-840** | 5 | a wire's runs painted from the ink · a net as the union of its wires' · the highlight surviving its own layer switch · the stroke at 11% and at 400% · one at a time · a citation landing on a net and painting it |
| `14_tests_path_editor.md` | **T-900–T-960** | 6 | candidates and their order · accept · multi-select across a hop · Clear · re-pick · the extracted-run conversion · Trace with all four keys · the `no path on this sheet` state · the count reaching 71 |

Existing documents to amend **in the same change, or the next session pays for it**:

- **the index** — **§5a, §6 and §7 were already corrected on 2026-08-24**: the file counts are right
  now, §5a records that the four empty label slots were emptied **on purpose**, `K2` is restated as
  still-theoretical, `K8` is written down, and two symptom rows point at them. What is still owed
  there: §6 rows for the five switches and the two new screens, §7 with
  **K4** narrowed and **K7** noted as deliberately avoided in Phase E, `K8` struck through when
  Phase 0 lands, and **§8 replaced** with §3 above;
- `01_screen_and_vocabulary.md` — the list, the five switches, the highlighter stroke, the two
  provenance axes, the end-label precedence rule, the new counts;
- `02_tests_place_and_drag.md` — **T-190** now describes five switches;
- `04_tests_labels.md` — **T-300 no longer stands as written** (wires are work now, in one specific
  way); T-335 extended to end labels;
- `06_code_map.md` — the new files and symbols, and four new hazards: `geometry.json` must never
  reach the browser whole; a hand-traced path must never be silently converted; `located` must not be
  built from the visible markers now that there are five switches; a default must never be written
  into `labels` as though a human chose it;
- `08_results_log.md` — rows for **T-470 through T-960**, added by the session that ships each range
  rather than all at once, so the log never lists a test nobody can run yet;
- `change_history.md` — the whole thing.

Also worth deciding while the directory is open: **it is not the "locate tab testing" directory any
more.** I would **keep the name** — dozens of cross-references point at it and a rename costs more
than it buys — and change only the index's title to say it covers both tabs plus Review. Flip it if
you would rather have the honest name.

---

## 12. What I decided on your behalf, and how to flip it

Each is a real fork; I picked one and said why. Say the word and it changes.

| Decision | Taken | Flip it to |
|---|---|---|
| Where end labels and paths live | `locations.json`, schema 2 | a separate `paths.json` — untouched existing tests, but two authored files and two save races |
| Where label corrections live | a separate `label_corrections.json` | fold into `locations.json` — one file to commit, but two screens writing one document through a `K2` window |
| What a wire's end label says | the spec (`BLUE 18AWG`) — what is printed and what you can verify | our id (`W052`), badged `our id` as the list does |
| Order of the last two phases | F before E, so corrections improve the matcher | E first and re-rank later; E works either way |
| The `Review` screen | its own tab | a panel on the Locate tab — fewer tabs, on the densest screen in the app |
| Reusing `WorkList` | promote it to `components/DesignatorList.tsx`, both tabs import it | a second list on the Drawing tab — no refactor, two lists to keep in step |
| The escape hatch for the 19 no-candidate wires | proximity-ranked unlabelled conductors first, hand trace last | hand-trace those 19 directly — simpler, more hand-drawn geometry in the file |
| Paths as work | a `Paths` count plus an explicit *no path on this sheet* state | leave them uncounted like labels; T-300 stands and the count never reaches 71 |
| Editing a lifted run | must convert to `geometry: human` first | allow dragging extracted vertices in place |
| Fixing `K2` (the `rev` counter) | **out — deferred by you 2026-08-24**, and `K2` has never been observed | put it back: a counter in the file, save refused on mismatch. Worth it the day a second tab or a hand-edit habit appears |
| A minimum-drag threshold | **out — rejected by you 2026-08-24**, because small moves are real | not recommended; it cannot distinguish a twitch from a deliberate 0.1 pt correction |
| How undo remembers | 50 whole-document snapshots — cannot be subtly wrong | inverse patches — smaller, and a bug in it loses work |
| What undo covers | document mutations only; never the view or the armed row | include navigation, so `Ctrl+Z` also walks back where you were looking |
| The nudge keys | `Shift`+arrow = 1.0 pt, `Shift`+`Alt`+arrow = 0.1 pt; bare arrows keep panning | bare arrows nudge when something is armed and pan otherwise — fewer keys to learn, one key with two meanings |
| The old per-wire `label_point` | kept, optional, and nothing depends on it | drop it in the schema-2 migration — decide only after using end labels |
| The directory name | keep `locate_tab_testing/` | rename, and update every cross-reference |

---

## 13. The six sessions

**This is more than one session's work**, and pretending otherwise is how a plan produces a
half-finished screen with no tests. Two new API endpoints, a new tab, a schema bump, a new authored
file, a list, an undo stack, seven test documents and roughly 60 new tests.

So it is **six sessions**, each one ending in something you can drive and understand. Every session
has the same contract:

> **A session is not finished until:** the four checks in §10 are green · its new automated tests are
> written · **its numbered test-and-lesson document is written**, in the house style, every test a
> lesson that says what to click and what should happen · the index's §5a and §7 are brought up to
> date · `change_history.md` has an entry · and the session has reported to you, in plain words, what
> it built and what it did not.
>
> **Then stop.** Do not start the next phase in the same session. You walk the lessons, mark up
> `08_results_log.md`, and the next session begins by reading your results.

The point of the pause is not caution about the code. It is that **each document teaches you the thing
that was just built**, and the next phase assumes you know it. Session 5 asks you to judge whether a
highlighted conductor is the right one; that judgement is built out of Sessions 1–4.

---

### Session 1 — the editor stops punishing mistakes, and a net tells the truth
**Phases 0 + A.** Together because both make what already exists correct, and neither adds a screen.

> **Landed 2026-08-24.** One thing was corrected the same day: Phase A kept the parent components in
> a net's highlight and the user reported it as clutter, so they are named on the card and no longer
> marked on the sheet. See Session 2's note.

| | |
|---|---|
| **You will be able to** | press `Ctrl+Z` and get the coordinate you just lost back · nudge an armed dot exactly 1.0 pt or 0.1 pt with `Shift`(+`Alt`)+arrows · click net `120` and see **seven terminal dots** ringed instead of five component dots, with `CR2:14` on CR2's NO contact rather than on its coil 630 pt away · read a roster naming every member and its state |
| **Touches** | `stores/locateStore.ts` (undo in `edit()`), `LocateTab.tsx` (the keys), `server/app/drawing.py` `_entry`, `api/types.ts`, `DrawingTab.tsx`, `SelectionCard.tsx` |
| **Writes** | `05_tests_save_and_recover.md` T-470–T-490 · `09_tests_net_membership.md` T-500–T-520 · a new `stores/locateStore.test.ts` |
| **Safe to stop after** | completely. Nothing is half-built; the file format has not moved |
| **Why first** | you are about to spend five sessions in this editor, and the bug in your report gets fixed before anything is built on top of it |

### Session 2 — wires and nets become two things, with a label at every end
**Phase B.** The first schema change. On its own because it is the largest single phase and the one
that touches the file.

> **Landed 2026-08-24**, with three corrections the user asked for after Session 1 — a net marks only
> its terminals, a roster row has a way back, and the Ask tab keeps the reader's place across `F2`.
> **265 end labels appeared and `locations.json` did not change**, which is the lesson below coming
> out exactly as predicted. Four things went differently from the plan and are worth knowing:
>
> - **the count did not "split into two".** §8.1 said the third toolbar count becomes two, but §6 also
>   forbids `label_point` from ever being a count — and it was one. So it was **removed**: the header
>   reads `71 wires · 26 nets · 0 end labels moved by hand`, where the last number counts *decisions*.
>   A progress bar over something optional is `K7`'s shape and this plan says so in three places.
> - **the panel is handed the planned labels rather than recomputing the rule.** A compass that
>   disagreed with the label beside it on screen would be worse than no compass.
> - **`spec` is a new field on the wire entry.** §7 says an end label shows `BLUE 18AWG`; the payload
>   had that only inside a human sentence, and string-surgery on a display label is not a source.
> - **§8 of the index was replaced with §3's amendment here**, which Session 6 was holding. The
>   `computed` row state now reads `ends known, no path`, so the manual had to stop saying the
>   opposite in the same breath.
>
> Also landed: `READABLE = (1, 2)` on **both** the read and the write path. The plan only asked for
> `parse` to accept 1; refusing a schema-1 *write* would make a cached browser bundle into a tab whose
> every save is silently rejected.

| | |
|---|---|
| **You will be able to** | filter `Wires` and `Nets` separately · see a label at both ends of every wire and at all 127 net terminals, on by default, anchored to points you already placed · set any one of them with the compass, hide it, or **Reset to default** — and see that the file records only what you changed |
| **Touches** | `locations.py` (`SCHEMA = 2`, `_end_labels`), `drawing.py`, a new pure `endLabels.ts`, `LocateTab.tsx`, `TargetPanel.tsx`, `MarkerLayer.tsx` |
| **Writes** | `10_tests_end_labels.md` T-550–T-590 · new cases in `test_locations.py`, `endLabels.test.ts` |
| **Safe to stop after** | yes — and this is the session to be most careful about, because it writes a new schema number. A schema-2 file cannot be read by an older server, by design |
| **The lesson that matters** | 269 labels appear and **none of them was work.** That is the payoff of every terminal you placed |

### Session 3 — the Drawing tab gets its list
**Phase C.** Pure client, no file format, no server. The easiest session to verify and the one that
changes your day-to-day most.

> **Landed 2026-08-25**, and it cost nothing measurable: no server change, `/api/designators`
> untouched, `locations.json` untouched, `circuit_logic.json` not even stale. **`K9` is struck** — a
> net is now a row you click. Four things went differently from the plan and are worth knowing:
>
> - **the list's four filters are independent and additive, and none of them on means everything.**
>   §8 said four buttons and did not say which idiom; exclusive filters with no *All* would have left
>   no way back to 275 rows, and the row of five switches directly above them is already additive.
>   Teaching two idioms for two rows of identical-looking buttons was the thing to avoid.
> - **`WorkList.tsx` is gone rather than reduced to a wrapper.** §12's fork said "promote it, both
>   tabs import it"; there was nothing editor-flavoured left in it once it moved, so the Locate tab
>   imports `components/DesignatorList.tsx` directly. `RowState` went with it, down into
>   `lib/designators.ts` beside the new `readerRowState`, which is the function that keeps the
>   reader's list off the editor's draft.
> - **`Labels` gates the text and the owner's switch gates its kind — two switches for one mark.**
>   §7 says an end label is governed by `Labels` *and* by the wire/net switch, and that is what
>   landed; it is worth restating because "press Labels" is the instruction a reader will expect.
> - **a new hazard, `H16`.** Two rows of buttons now carry the same four words, so each row is a
>   labelled `role="group"` (`Layers on the sheet`, `Filter the list`). Without those labels anything
>   that finds a button by name — a screen reader, fifteen existing tests — cannot tell which row it
>   is holding.

| | |
|---|---|
| **You will be able to** | find any of the 275 designators from the Drawing tab, by typing · filter the **list** with four buttons while the **sheet** is filtered by five switches, and prove to yourself that neither touches the other · collapse the list and get the screen back · do all of it as a reader, with editing switched off |
| **Touches** | `WorkList.tsx` → `components/DesignatorList.tsx`, a new `DrawingList.tsx`, `DrawingTab.tsx` (five `LAYERS`, two-column layout), `appStore.ts` (the collapse) |
| **Writes** | `11_tests_drawing_list.md` T-600–T-650 |
| **Safe to stop after** | completely |
| **Verify with edits off** | set `SWUI_ALLOW_EDITS=false`, restart, and check the list still works. That is the acceptance criterion, not a nicety |

### Session 4 — the review screen
**Phase F.** Before paths, because it corrects the labels the path matcher reads.

> **Landed 2026-08-25.** The queue, the `All labels` switch, the `Net labels` filter, `not a label`,
> `was`, and the netlist asserted immovable **in bytes**. Six things went differently from the plan
> and are worth knowing:
>
> - **the queue is 664 readings, not 502 labels.** §Phase F said *"every one of the 502"*, which is
>   `stats.text_labels`; the file holds **515** label objects and — the substantive part — **149
>   conductors**, which are the other half of the review queue's 278. A run's reading is the **net
>   name printed beside it**, so it belongs in the same queue under the same validator. Measured:
>   515 strings + 149 runs = 664, of which 278 are flagged.
> - **a correction to a label propagates to the runs that read it.** Not in the plan, and without it
>   the phase would have unlocked nothing: Session 6 compares the **run's** name against a wire's net
>   id, so correcting `T0012` and leaving `C0030` reading `LI-A` would have been a fixed row and an
>   unfixed matcher. `ink.net_label_source_of` is the link, matched on text, and all 70 of this
>   sheet's net names match with 0 runs unexplained.
> - **`""` is refused by name and `text` is required.** The plan's schema showed `text: null` for
>   *not a label*; it did not say what an empty string means, and the two claims are different —
>   *there is no text here* is about the ink, *this is not a label* is about the item. One string for
>   both would make the file unable to say the second, which seven of the 34 printed net names need.
> - **a *confirmation* is stored**, and it is the one thing in this project that agrees with a
>   computed value. Invariant 10 forbids that for an end label's side; the line is that a side would
>   have been produced anyway with nobody looking, and **nothing produces *a person checked this* but
>   a person.** Written into `06_code_map.md` invariant 10 rather than left as a judgement call.
> - **the `Net labels` filter is 149, not 34.** The plan said *"the 34 that unlock Phase E"*, which is
>   the count of distinct printed strings. As rows it is **70 labels + 149 runs = 219** across all
>   readings, or **30 + 119 = 149** inside the flagged scope — and the 30 are exactly the §2 misread
>   table, every one at confidence 0.4.
> - **no search box**, deliberately, unlike the Drawing tab's list: `T0247` means nothing to anybody,
>   so the way in is the order and the scope. And **no undo stack** — `Ctrl+Z` is the text box's,
>   which is what typing a string expects; the reasoning is in `reviewStore.ts`'s header.
>
> Also found, and worth having before Session 6: **51 labels have a reading that differs from their own
> raw OCR and only 2 are flagged.** Some of that tidying is right and some is a step backwards
> (`BLACK 22 AWG` → `BLACK 22 AW6`, 0.83, unflagged). That whole class is reachable only through
> `All readings`, which makes decision 3 load-bearing rather than generous.

| | |
|---|---|
| **You will be able to** | work a queue of the 278 things the extractor was unsure about, worst first, with the ink on screen beside each one · correct `LI-A` to `L1-A` and see the original reading kept beside it · say *not a label* for the seven that are not · switch to **All labels** and edit any of the 502, flagged or not · and confirm the netlist does not move when you do |
| **Touches** | a new authored `label_corrections.json`, `GET`/`PUT /api/review` behind `allow_edits`, a new `Review` tab, `tabs.ts` |
| **Writes** | `12_tests_label_corrections.md` T-700–T-740 · a new `test_review.py` |
| **Safe to stop after** | completely. Nothing downstream requires it — it makes Session 6 better, not possible |
| **The lesson that matters** | the extractor has been collecting its own doubts since 2026-08-03 and nothing had ever read them |

### Session 5 — paths appear on the sheet
**Phases D + G.** Storing and drawing a route, plus the citation and list triggers.

| | |
|---|---|
| **You will be able to** | see a wire highlighted along **the PDF's own vector strokes**, not a line between its ends · see a net as the union of its wires' runs · click a `120` citation in an answer and watch it paint · confirm the highlight survives its own layer switch being off |
| **Touches** | `locations.py` `_paths`, `GET /api/paths`, `paint.ts` (`polylineToDevice`, `paintRuns`), `TileSheet.tsx`, both tabs |
| **Authoring, this session only** | there is **no path editor yet**, so the test document must include **a worked hand-edit** — the exact `W052` block from §6 to paste into `locations.json` with the server stopped — or you would have nothing to look at. That is the one session whose lesson involves a text editor, and the document must say plainly that this is temporary scaffolding, not the workflow |
| **Writes** | `13_tests_paths_highlight.md` T-800–T-840 · a new `test_paths.py`, cases in `paint.test.ts` |
| **Safe to stop after** | **only if you accept that authoring is hand-editing until Session 6.** If that is not acceptable, treat 5 and 6 as one long session and do not stop between them |
| **The proof to look for** | after saving a path, `circuit_logic.json` stays current and the artifact test stays green. That is paths being display geometry, demonstrated rather than asserted |

### Between Sessions 5 and 6 — the small batch
**Not a phase, and not a session of its own.** Six items that came out of the user working the whole
`Review` queue on 2026-09-01 and asking 23 questions about it; the answers are in
`_claude_notes/review_tab_questions.md`, which is the reasoning for every line below and should be
read before touching any of them.

**Do these at the head of Session 6, before Phase E**, or as a short sitting of their own if
Session 5 runs long. Not before Session 5 — Phases D and G are the queued work and none of this
blocks them. Together they are perhaps half a session; individually none is worth a session, which
is exactly why they are listed together and why the list exists at all rather than living in a
console message nobody kept.

**Why before Phase E rather than after:** the first four change what a person sees while making 71
judgements about conductors, and the fifth is the one that let 34 net names be lost by accident. A
tool you are about to spend a long authoring run inside is worth sharpening first — the same
argument that put Phase 0 in front of everything.

| | What | Where | Why |
|---|---|---|---|
| **1** | **Recompute the `kind` badge from the settled text.** The row prints the extraction-time `kind`, so after `125,` → `125` the badge still says `text` where `classify_label()` would now say `net_number`. | `ReviewTab.tsx` `{item.kind === 'label' ? item.label_kind ?? 'text' : 'run'}`, or publish it recomputed from `main.py` | `kind` is a pure function of the text (`classify_label` in `extract.py`) and `ink.py` calls it *"a hint for the reader, never a filter this server applies"*. So a badge that disagrees with the text beside it is the only defect there is here — and it made the user ask three separate times for a way to edit a field that **must not exist**. There is nothing to author; there is a stale display |
| **2** | **A third scope on the queue: `not a label`.** Beside `Flagged` and `All readings`. | `features/review/model.ts` `SCOPES` and the filter; it is a predicate over `stored.text === null`, which the payload already carries | *Not a label* is 279 decisions and there is no way back to them. The user asked for exactly this (question 11) and the need is proven: finding the 36 runs that needed revisiting took a database query rather than a click. **No search box** — `reviewStore.ts` explains why and the reasoning holds: `T0247` means nothing to anybody |
| **3** | **A `note` box on each row.** A second, wider input under the reading, writing `note`. | `ReviewTab.tsx`; `setCorrection` in `features/review/model.ts` already **preserves** a `note` it did not write | **No schema change** (schema stays 1), no new validator — `note` is already an optional string in `label_corrections.py` and already round-trips. Today it can only be written by hand-editing with the server stopped. The user asked whether they should put an asterisk in the *text* box and describe the problem there (question 23); the answer is no, because the text box is a claim about the ink that Phase E's matcher reads — and the right answer is to give the note somewhere honest to live |
| **4** | **Reword the ✖ button on a run row.** Its tooltip is written entirely about labels; on a conductor it must say *"no net name is printed on this run"*. | `ReviewTab.tsx`, the `Ban` button's `title` | **This wording cost 34 net names.** Used as a bookmark it is free on a label row and destructive on a run row, because `corrected_text()` drops a `null` and Session 6's matcher never sees that run again. The code comment beside the button already says the right sentence; the tooltip the user reads does not |
| **5** | **Frame a run with its polyline, not the box round its endpoints.** The `InkRing` for a conductor should follow the ink. | `ink.py` `Conductor` (+ `points`, + a `rect` over all of them) and `InkRing` in `ReviewTab.tsx` | `C0002` is a three-segment L and its ring is a 206 × 215 pt rectangle over a quarter of the sheet, with a dozen unrelated runs inside it. Questions 16 and 17. **Do this with Phase E, not Phase D** — `points` is deliberately absent from `ink.py` and arrives when `/api/conductors` needs it, which is Phase E; `ink.py`'s own docstring says *"it adds them **here**, named, behind the same cache"*. Phase D reads authored paths out of `locations.json` and never touches the ink loader, so there is nothing to reuse until E. Once `points` are loaded this is a few lines |
| **6** | **Re-run `build_kg.py`**, and say in the manual's §5a that it is part of the recipe. | `cd schematic_extraction/PS20115MLM4-2/extracted_docs && python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate` | `custom_kg.json` is generated from `circuit_logic.json` and is **behind it by a placement run**. `K6` and the artifact test cover `author_circuit_logic.py` and say nothing about the second half of the recipe that `EXTRACTION_NOTES.md` prescribes. `prompts.py` ranks the file fourth and *"never as the primary source"*, so the exposure is small — but it is real staleness that nothing tests |

**Rejected while answering the same 23 questions, with reasons, so none of them creeps back in:**

- ~~**A bounding-box editor**~~ — move and re-dimension a label's box. A label bbox is read by
  **one** thing: the ring you look at while reviewing. Phase E's ranking never touches it,
  `author_circuit_logic.py` never touches it, and the model never sees `geometry.json` at all. So it
  is wrong in the cheapest possible place — the one place where a person is already looking at the
  paper. Against that: `geometry.json` is **generated**, so the corrections would have to be a fourth
  authored file with its own schema, validator, cache and lock, plus a rubber-band drawing surface.
  A session and a half whose whole payoff is a better ring. **Where a wrong box means a reading is
  *missing*, correct the run instead** — that already works, and it puts the string where the matcher
  looks. `T0338`/`C0059` is the worked example (question 18).
- ~~**A `kind` editor**~~ — item 1 above is the whole of the real problem. `kind` is computed.
- ~~**A "needs repair" category** on the queue~~ — a queue over a repair we have decided not to
  build, and a category nobody can act on is `K7`'s exact shape. Item 3 is what the user actually
  wanted.
- ~~**Symbol classification on the `Review` tab**~~ — that screen answers one question, *what does
  the ink say here*. Moved to `webui_ideas.md` §6, where it belongs, and gated on drawing number two.

### Session 6 — the path editor
**Phase E.** The last one, and the one that spends your judgement rather than your patience.

| | |
|---|---|
| **You will be able to** | arm a wire, see its ranked candidate conductors lit on the sheet, hover to compare and click to accept · assemble a path across a crossover hop from several conductors · clear and re-pick · convert a lifted run to hand-traced before editing it · trace one of the 19 no-candidate wires corner by corner · mark a wire *no path on this sheet* so the count can reach 71 |
| **Touches** | `GET /api/conductors` behind `allow_edits`, a new pure `paths.ts`, `TargetPanel.tsx`, the counts and the `Paths` filter |
| **Writes** | `14_tests_path_editor.md` T-900–T-960 · a new `paths.test.ts` |
| **Expect** | **19** wires to come back with one candidate and still ask for a click, **33** with two or three, **19** with none. Those numbers are the shape of the work, and if the first two are much smaller than that, the ranking is wrong |
| **Also do here** | **`K10`, and it is now worth two nets rather than two labels.** Publish each net's *printed* form beside its id and have `candidates()` compare against **both** — `NET-PB1`/`NET-PB2` are the only two nets of 26 with no match, and since 2026-09-02 both have a run carrying the printed `PB1`/`PB2`. Nothing else on the sheet is waiting on anything. Manual §7 `K10` has the reasoning · **plus the small batch above, at the head of the session** |
| **Then** | §3's amendment is fully in force: rewrite the index's §8 with it, if Session 2 has not already |

---

### If even that is too much

Sessions **1, 2 and 3** are the coherent smaller project: the bug fixed, labels everywhere, a list to
find things with, no new tab and no new authored file. Session 1 alone is worth shipping — it is the
thing you asked for by name.

Sessions **5 and 6** are the pair that must not be split casually. Everything else stands alone.
