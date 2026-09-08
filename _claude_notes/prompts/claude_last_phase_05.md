This document was written by the previous Claude Code session on my (John's) behalf.
These are the instructions for the current session.

Greetings.

**This session builds Phases A and B of `_claude_notes/authoring_the_wires.md` — the wiring queue
and the ink's proposal.** Phase 0 landed on 2026-09-07 and is committed (`f2cccb4`). There is a
fourth authored file now and no screen that can write it; your job is that screen.

**Build this session only.** The plan's §13 has four sessions plus my own authoring run, and it says
why they are separate: I walk the lessons between them and the next phase assumes I have.

---

## Where the project is, in one paragraph

`circuit_logic.json` is generated from three authored inputs: the tables in `author_circuit_logic.py`
(what each thing *is*), `locations.json` (where it is drawn — 131 terminal points, 47 component
sites, 58 wire routes, all placed by me), and — since 2026-09-07 — **`wiring.json`** (which two
terminals each wire *joins*). `label_corrections.json` is a fourth authored file the generator does
**not** read; it corrects readings of the ink and a test asserts it in bytes.

The thing this plan exists to fix: for the 40 wires that land on a multi-point terminal block, the
block end of the wire was **allocated rather than read** — one screw number after another as the `W`
table was typed. **11 of the 71 are on the wrong screw, 13 more cannot be settled from the ink, and
47 are right.** Nothing is corrected yet. All 71 records say `source: index`, which is *this is what
the machine guessed*, and the queue you build this session will read **`0 of 71 wires confirmed`** on
its first run. That is the honest number and it is what decision 4 asks for.

---

## What to read, in this order

1. **`_claude_notes/authoring_the_wires.md`** — whole. It is the plan. **§7** is the two screens,
   **§4 q4** is the wiring panel in detail, **§4 q5** is how the two meanings of a terminal click
   stay apart, **§6** is the file format, **§9** is the phases, **§11** is the document you deliver,
   and **§15 is the record of what Session 1 actually did**, including four places where the
   execution departed from the plan and why. Read §15 before you trust §8 or §9 literally.
2. **`_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md`** — the index,
   whole. **§5h** is Session 1. **§5a** is what is in the files. **§7** is the known issues, and
   **`K12`** is new and is yours to pick up if it gets in your way. **§8** is the rule about routes.
3. **`_claude_notes/locate_tab_testing/06_code_map.md`** — behaviour → file and symbol, and hazards
   `H1`–`H23`. **`H23` is new and is the shape of the file you are about to build an editor for.**
   `H10` and `H22` are the ones Phase A can break. Read it before writing anything.
4. **`_claude_notes/locate_tab_testing/14_tests_path_editor.md`** — T-900–T-960. **This is the
   document your new one is a sibling of**, and the panel you are building is `PathPanel`'s shape.
   Read it for the shape of the lessons, not for the feature.
5. **`_claude_notes/locate_tab_testing/07_drawing_facts.md`** — the real ids and coordinates.
   **Note the correction §4 q10 of the plan makes to its `W063` row**, which is still uncorrected on
   purpose (see *What not to do*).

**Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** The
plan's §3 and `07_drawing_facts.md` exist so you do not have to. If you need a number, get it with a
`python3 -c` one-liner that prints a summary.

---

## What Session 2 is

### Phase A — the wiring queue and the endpoint editor

**Server.** `server/app/wiring.py`, a new module beside `locations.py` and `label_corrections.py`,
with the same three-layer split: `parse()` checks shape and knows nothing about this drawing;
`resolve()` is handed the netlist and refuses **by name** an endpoint that is not a terminal in it,
or a `commoning` key that is not a component. `GET`/`PUT /api/wiring`, both **behind the editor
password** and inside the same `if settings.allow_edits:` block as `/api/locations`. **Restart
needed.**

`read_wiring()` in `author_circuit_logic.py` already validates the same file for the generator, and
that duplication is the established shape here — `read_locations()` and `locations.py` have lived
that way since the beginning. **Say so in a comment and keep the two honest**, the way
`test_extraction_generator.py`'s header keeps the precedence honest: if the two ever disagree about
what a valid record is, the editor will write something the generator refuses and nothing else in
the project will notice.

**Client.** A sixth toolbar filter, **`Wiring`**, beside `Paths`, and a queue reading
`n of 71 wires confirmed`. Arm a wire and the panel shows two end slots, each naming the terminal it
holds and **where that came from** — `from the index` or `you, on 2026-09-07` — reusing
`PLACEMENT_LABEL`'s vocabulary in `webui/src/lib/designators.ts` rather than inventing a second set
of words. `Pick from the sheet` per end. The `was` stamp on a correction. The two ends' nets side by
side with a **flag** where they differ, never a fix. `Escape` takes an armed slot **before** the
armed row, exactly as it takes a trace before the row.

**Acceptance:** *confirming a wire whose endpoints do not change still writes a record and moves the
count.* **`I looked and it was right` is a decision**, and this is the phase where that becomes
storable. 47 of the 71 are that case.

### Phase B — the ink proposes an endpoint

`webui/src/features/locate/wiring.ts`, pure, the sibling of `paths.ts`'s `candidates()`: for an
armed wire, what the ink says each end lands on. **This is where the plan's §3 measurement becomes
shipped code**, and it must carry the commoning-aware landing rule from §3's method paragraph — **a
run's landing is where it *leaves* the commoning geometry, not where its polyline ends.** Get that
wrong and it mis-proposes four wires, which is exactly how `07_drawing_facts.md` came to have
`W063` wrong.

**Acceptance, and it is the phase's whole point:** fixtures built from plan §3.2 and §3.5. The
proposal reproduces **all eleven** corrections, agrees with the netlist on **all 47** confirmed
wires, and **offers nothing for `W042`** rather than offering `TB-0V:1`. `W042` is the case where
the ink is wrong and the data is right — the run stops at the west side of the block instead of
reaching the commoning line, and that is the drawing's error. A screen that trains me to accept the
proposal is worse than no screen.

### Two smaller things that belong in this session

- **`path may be stale`.** Every path now carries `for` — the two endpoints it was accepted against
  — and nothing reads it yet. The moment this screen can change an endpoint, that comparison is
  worth one word on a row and one predicate in `rowState`. Plan §4 q9.
- **`K12`**, if it gets in your way. Two files can now make the artifact test red and the banner
  does not say which. Manual §7.

---

## Anchors, so you do not start with a search

| What | Where |
|---|---|
| The toolbar filters, including `Paths` — add `Wiring` beside it | `webui/src/features/locate/LocateTab.tsx`, the `FILTERS` list ~line 95 |
| The counts, including `settled` — the one that reaches its own total | `features/locate/model.ts` `coverage`, and `pathSettled`, which the filter and the count share |
| The panel to copy the shape of | `features/locate/PathPanel.tsx` — `CandidateRow`, `WHY`, `SHOWN`, `data-path-panel` |
| The ranking to be a sibling of | `features/locate/paths.ts` — `candidates`, `Reason`, `NEAR_PT`, `endsOf`, `endPinsOf` |
| The three placement words, in one place | `webui/src/lib/designators.ts` `PLACEMENT_LABEL` |
| The editor routes and the gate | `server/app/main.py`, inside `if settings.allow_edits:` ~line 339 |
| The two authored-file modules to model `wiring.py` on | `server/app/locations.py`, `server/app/label_corrections.py` — read the second one's docstring |
| The generator's own reader of the same file | `author_circuit_logic.py` — `read_wiring`, `_wiring_record`, `build_wires`, `_net_across`, `WiringRefused` |
| The 149 conductor polylines Phase B ranks over | `GET /api/conductors`; `server/app/ink.py` `Conductor.points`, `Binding` |

---

## Traps, each of which has cost a session

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env`.
   Editor password `edit-1234`.
2. **`python -m app` has no reloader.** A change under `server/app/` needs a restart, and this
   session has a server change.
3. **The client is a built bundle.** A change under `webui/src/` needs `cd webui && npm run build`.
   **A rebuilt bundle against an unrestarted server is the dangerous combination** — the new client
   sends fields the old validator ignores in silence.
4. **`H1`/`K2` — the whole-document draft.** This session adds a **third** store over a **fourth**
   file. Keep it its own store over its own document, the way `reviewStore` is; the two must not
   learn about each other. `H18` is the reasoning.
5. **`H10`/`H22` — four `window` key listeners and an `activeTabId` guard between them.** An armed
   end slot is a fifth thing that wants `Escape`. The escalation is text field → slot → trace →
   target, and it wants writing down in `H22` rather than discovering.
6. **`H23` — the generator refuses to run without `wiring.json`.** Anything you write that runs it
   must supply the file. Two tests already do.

Running it, if you need to look at something:

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**If you start the server, stop it in the same turn. The console is mine.**

The four checks, currently green at **184 server · 320 web · ruff clean · tsc clean**:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

**Start from green.** A red check in a session that has written no code means something else is
wrong — say so loudly. The plan's §10 expects roughly 35 new server tests and 55 new web tests
across all of Phases A–E; Session 1 spent 12 and 2 of those.

---

## What not to do

- **Do not correct any endpoint.** Not `W019`, not `W014`, not the other nine, however obvious §3.2
  makes them. Nothing in `wiring.json` may say `source: human` unless **I** clicked it. Phase F is
  mine, and thirteen one-line fixes would leave 47 confirmations unrecorded and the screen
  unfinished — which is the same instinct the last session was told to resist about `W014`.
- **Do not touch the `W063` fixture in `paths.test.ts` or the `W063` row in `07_drawing_facts.md`.**
  Plan §4 q10 has the correction and warns that **both of that test's assertions still hold after
  it**, so the suite will not catch a careless one. It goes with Phase C's commoning work and the
  assertion that carries it — *`C0092` is `TB-120`'s commoning and no wire may claim it*.
- **Do not start Phase C or D.** The plan's §13 stopping point for this session is *you can confirm
  all 71 wires* — and it says explicitly **do not start the authoring run yet**, because Phase C
  changes what a net looks like and I will want to see the commoning while I work.
- **Do not auto-accept anything**, not for the 47 the ink confirms and least of all for `W042`.
  Same rule Session 6 wrote for paths, same reason.
- **Do not renumber anything.** Decision 3, proved unnecessary in plan §3.4 and confirmed by me: 48
  placed `TB-*` points and 111 end-label overrides stay exactly where they are.

---

## Two things I want built *for*, not just built

These are mine, from 2026-09-07, and Session 1 honoured them in the file format. Keep honouring
them in the screen.

1. **This has to generalise to other drawings.** The long-term goal is a library of indexed
   schematics — a whole factory or sort centre — that a model can answer troubleshooting questions
   about. So the drawing-specific half stays in the extraction's own tables, and everything in
   `server/app/` and `webui/src/` knows only shapes. If you find yourself typing `TB-0V` into the
   server or the client, stop.
2. **This has to generalise to circuits that need several pages.** A wire's endpoints are terminal
   designators and not coordinates, which is why `wiring.json` has no page in it — `CR-BP:A2` names
   the same terminal whichever sheet prints it. The one thing that *will* need a page is Phase C's
   `commoning`, because that stores polylines. Leave room for it; do not build it.

And one that is not this session's, named so it is not lost: **the Ask tab should be able to reason
about the highlighted wires, and to turn highlighting on for the wires it is explaining.** That
lands after Phase D, when a terminal's wires and the commoning are on the sheet. If you see a cheap
way to keep the door open for it while building Phase A, take it; do not build it.

---

## Questions only I can answer — ask them early, do not model around them

The plan's §14 lists three that need my eyes, and all three are for the authoring run rather than
for you. But two of them may change what your Phase B proposal should *offer*, so ask if it matters:

1. **`TB-130` has two points, three wires and no commoning conductor at all** — its points are 71 pt
   apart with nothing joining them. If your ranking wants to know whether `W049` and `W069` can both
   land on `TB-130:1`, ask me and I will zoom in.
2. **`TB-120:3` sits 24 pt below `:2`, off the end of `C0092`.** It may be a third landing rather
   than a separate point. Same offer.

And ask me anything where the answer is mine to **decide** rather than mine to look up. The *"what I
decided on your behalf"* table is the right home for the small calls, not for one that changes what
I have to click 71 times.

---

## What "done" means for this session

1. **Phases A and B built**, both acceptance criteria met — a confirmation of an unchanged wire is
   storable and moves the count; the proposal reproduces all eleven corrections, agrees on the 47,
   and offers nothing for `W042`.
2. **The four checks green**, and the new tests named after the properties they defend rather than
   after the functions they call.
3. **`_claude_notes/locate_tab_testing/15_tests_wiring_editor.md`**, T-1000–T-1090, per the plan's
   §11: the `Wiring` filter and the count that reaches 71 · the two end slots and what
   `from the index` means · the ink's proposal and its tag words · `Pick from the sheet`, and
   `Escape` taking the slot before the row · confirming a wire that was already right · **`W042`,
   where the ink is wrong and the data is right** · the net-mismatch flag on `W019` · `was`.
   **Editor password and a restart.** A session that ships code and no lessons has not finished, and
   the lessons are written for a person.
4. **The manual's §3 table, §5 (a new `5i`), §1 counts, and `06_code_map.md`** updated; a dated
   entry in **`change_history.md`** and its **`NEXT UP`** rewritten around Session 3; and the plan's
   **§15** appended with what Session 2 actually did and where it departed.
5. **Report to me in plain words:** what you built, what you are least sure about, and what I should
   click first to find out whether it is right.

---

## Two standing instructions

**I do all the git work myself.** Do not commit and do not push. Read git freely — `git status`,
`git diff`, `git show`, `git log` are all useful and often the fastest answer. When something ought
to be committed, name the files and say so.

**There are three authored files git cannot regenerate**, and `author_circuit_logic.py` is a fourth
— it is a Python file, but the `W` table and the component, terminal and net tables in it are *my*
data, not code:

    locations.json           where everything is drawn
    label_corrections.json   what the ink says
    wiring.json              what each wire joins
    author_circuit_logic.py  what each thing is

Treat all four that way. Do not hand-edit `circuit_logic.json` or `custom_kg.json`; both are
generated, and the recipe is two commands:

    cd schematic_extraction/PS20115MLM4-2/extracted_docs
    python author_circuit_logic.py
    python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

**This session should need neither.** Phase 0 changed no endpoint, so both files are current, and
nothing you build should move them until I have used it.
