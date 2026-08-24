# Change history

What changed, when, and **why** — the reason being the part that is expensive to reconstruct
later. Newest first. One entry per working session, not per commit; `git log` already has the
commits.

Scope is the whole repository: the extraction skill, the server, the WebUI and these notes.
`webui_ideas.md` is the road map (where we are going), `webui_v1_plan.md` is the v1 design
(why the server looks the way it does), and this file is the record of what actually landed.

**One exception to "newest first": the very first section is forward-looking.** `NEXT UP — Job
B, attempt 2` is the plan for the work in progress, written to stand alone so a new session can
start from it and nothing else. Everything after it is history. When that work lands, it becomes
a dated entry like the rest and the section goes.

---

## NEXT UP — Session 2 of the wires-and-nets plan

**Superseded as of 2026-08-24.** The work in progress is
**`_claude_notes/highlighting_wires_and_nets.md`** — a six-session plan whose §0 says what to read
and whose §13 is the schedule. **Session 1 (Phases 0 + A) landed 2026-08-24**; see the dated entry
below for what it built and the two things a person must do afterwards. **The next session is
Session 2, Phase B**, and it should begin by reading `08_results_log.md` for how the user got on with
T-470–T-520.

Job E below is done — the placement run finished on 2026-08-20 and all 131 terminals are placed. Job
F is still the runner-up and still worth doing as its own piece of work. **The rest of this section
is kept as it was written on 2026-08-17**, because the state block and the three facts about
restarting are still exactly right and cost a session each to learn.

---

### Job E, then Job F *(as written 2026-08-17)*

**This section is the plan, not the record. It is written to be the only thing a new session
needs to read before starting. Everything below it is history.**

> **Testing or troubleshooting the Locate tab? Read
> `_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md` instead of this
> file.** It is a standalone index over eight leaf documents — how to drive every feature, 28
> numbered tests with expected results, a behaviour-to-symbol code map, the drawing's concrete
> facts, and the known issues. It exists so a troubleshooting session can hold one small document
> set rather than the whole feature, and so a failure can be reported as *"T-142 failed, and here
> is what happened"*.

The editor is finished as specified: dots and wire/net labels can be placed and dragged, it
persists, and the user has driven it in a browser. What is left of
`_claude_notes/drawing_fixes_plan_01.md` is two jobs, and the second is the one that serves the
library goal.

### State of the repository, verified 2026-08-17

    main    a9cda29, tracks origin/main. NOTHING HAS BEEN PUSHED.
            Uncommitted in the working tree: Job B attempt 2 plus the 2026-08-17 additions,
            all green — and, now, real authored content in locations.json.
    job-b-attempt-1   beb85a7 / 7003dfb  — the rejected attempt. Study only. Local only.

- Tests: **105 server**, **100 web**; `ruff` and `tsc -b` clean; bundle rebuilt.
- `server/.env` (gitignored) now carries `SWUI_ALLOW_EDITS=true`, `SWUI_EDITOR_PASSWORD` and
  `SWUI_EDITOR_NAME=js`. **Without the first of those there is no Locate tab at all** — that is
  the whole point of the flag, and it is also how a whole session was lost to "nothing shipped".
- **`server/app/static/` is gitignored** *and* `python -m app` has no reloader, so a client change
  needs `npm run build` **and** a server restart. A rebuilt bundle against an unrestarted server
  is the dangerous combination: the new client sends fields the old validator ignores silently.
- The remote is the last known-good state. Do not push until the user says so.

### Job E — keep placing, and regenerate when you stop

Partly begun. `locations.json` exists with four entries placed by hand through the editor:
`TB-PB2SP:block` at (154.5, 348.3) — the point the user's own screenshot identified — plus
terminals `TB-110:4`, `TB-120:1` and `TB-IINSP1:1`. **Do not edit that file by hand and do not
overwrite it**; it is authored content now, and the editor is how it grows.

What remains of Job E:

- `CR-SW`'s two sites — the coil near (861, 704) and the contact carrying `11`/`14` near
  (569, 473). This is the fault-3 case and the one that proves sites are worth having.
- `CR-ON:A2` its own point, near (870, 468) — fault 2's data half.
- `TB-PB1SP` shows the same error as `TB-PB2SP`, and 16 other components were screened as
  suspicious. **They are not edited blind.** They are what the editor is for.

Then re-run `python author_circuit_logic.py` in the extraction directory.
`test_the_committed_artifact_is_exactly_what_the_generator_writes` **fails while that is
outstanding**, which is deliberate: the staleness the editor puts a banner up about is now also a
red test, so it cannot be forgotten.

### Job F — teach `schematic_skills` that the authored tier is two files

This is the part that makes drawing number two cheap, and the library is the whole goal.

1. `SKILL.md`: the authored tier is **two** files — `author_circuit_logic.py` (what connects) and
   `locations.json` (where it is drawn, owned by a human and the Locate editor). Everything else
   in `extracted_docs/` is generated.
2. Emit a seed `locations.json` per new drawing: every component the vision pass located, as one
   site with `"source": "seed"`. Never `"human"`. The format is documented in
   `server/app/locations.py`'s docstring and the schema is `1`; that module is the only validator
   and the skill must not grow a second one.
3. `EXTRACTION_NOTES.md`: a line on what a human still owes the drawing — how many components and
   terminals are unplaced, and that a `seed` point is out by about 11 pt on a sheet whose
   conductor rows are 16 pt apart.

Worth saying in the skill itself, because it is the decision the whole design rests on: **the
indexing pass gets one chance to guess, and after that a human owns the positions.** A skill that
starts proposing coordinates a second time rebuilds the thing that was rejected.

**There is still no second drawing to prove any of this against.**
`schematic_extraction/ModLinx/extracted_docs/` is **empty**, though
`ModLinx/source_docs/PS10115MLC2-2.pdf` is sitting there waiting. Extracting it is the honest test
of the library claim, and until someone does, "it works on other drawings" is an argument from the
code rather than a fact. The code's side of that argument: no thresholds and no per-drawing
constants anywhere in `locations.py` or `features/locate/`, `drawing_dir` is still the single knob,
and a locations file is refused whole against a different `drawing_number` or `page_size_pt`.

### Files to read before starting

| File | Why |
|---|---|
| the two entries directly below | The editor in full: the format, the seams, and what is deliberately absent. |
| `server/app/locations.py` | The format's docstring — two sources, three placements, and why wires get a label and never a route. The only validator. |
| `webui/src/features/locate/model.ts` | Every rule the editor applies, as pure functions. `PLACEABLE` versus `LABELLABLE` is the distinction to understand first. |
| `schematic_extraction/PS20115MLM4-2/extracted_docs/author_circuit_logic.py` | `read_locations`, `fold_in_locations`, `fold_in_labels`. |
| `_claude_notes/drawing_fixes_plan_01.md` | The approved six-job plan. A–D are done; E and F are its own §E and §F. |

Do **not** read `geometry.json` (608 KB, ~150,000 tokens) or `circuit_logic.json` in full unless
a specific question needs them.

### Verification, in one command

    cd server && .venv/bin/python -m pytest -q; .venv/bin/python -m ruff check .; \
      cd ../webui && npx vitest run; npx tsc -b --noEmit

Semicolons, not `&&`, so one failure does not hide the state of the other three. Run
`npm run build` **and restart the server** at the end; see the state block above for why both.

---

## 2026-08-24 — Session 1 of the wires-and-nets plan: the editor stops punishing mistakes, and a net tells the truth

**Phases 0 and A of `_claude_notes/highlighting_wires_and_nets.md`.** That document is a six-session
plan and §13 is the schedule; this is the first sitting and it stops here on purpose — the user walks
the lessons between sessions, and Session 2 assumes they have. Nothing is half-built: the file format
has not moved.

The two changes belong together because neither adds a screen. Both make something that already
existed **correct**.

### 1. `Ctrl+Z`, and `Shift`+arrows to nudge a marker precisely — `K8` fixed

**Why.** On 2026-08-24 `BYPASS-CB:1` moved from y 663.8 to 663.7 during a placement run — a tenth of
a point, a 160th of a conductor row, invisible on screen — and the coordinate it replaced was gone
from the running program. A drag writes into the draft, autosave persists it, and git recovers the
last *commit*, never the last *action*. The user asked for undo by name.

**What landed.** An undo stack over the draft in `webui/src/stores/locateStore.ts`: `Ctrl+Z`,
`Ctrl+Shift+Z`, fifty steps, in memory, cleared on load. Plus `Shift`+arrow to move the armed point
1.0 pt and `Shift`+`Alt`+arrow 0.1 pt.

**The fact that made it small, and it is worth keeping.** Every mutation in this editor already
funnelled through one function — `edit(change)` — and `set({ document: … })` appeared in exactly one
other place. So the stack is a **push inside `edit`**, and every existing mutation became undoable at
once with no per-action work and nothing to forget: a point, a drag, a rename, a pin assignment, a
label side, an unplace, a wire's label point. The three writers that are *not* user actions (`load`,
`save`'s reconciliation, `reset`) **clear** the stack instead — a stack that survived a load would
undo this document's points into the coordinates of the file open before it. That distinction is the
one thing to get right and it is now hazard **H13**.

**Six decisions in it that are not obvious:**

- **Whole-document snapshots, not inverse patches.** 38 KB × 50 is under 2 MB, next to 2.2 MB of
  tiles already on the page. A patch scheme would be smaller and could be *subtly* wrong, and the
  bug it would produce is losing a coordinate — the exact thing being fixed. Correctness beats
  cleverness in the one place where the failure mode is data loss.
- **It announces itself.** A document mutation reverted silently on a 275-row file is
  indistinguishable from a key that did nothing, so the toolbar says *"undid: moved `BYPASS-CB:1`"*
  and the list arms and scrolls to the row it changed. Every call site passes a note in a person's
  words; *"undid: an edit"* would tell you nothing at the moment you most need telling.
- **It arms the row it changed, and never restores the row that was armed before.** The plan's own
  test table said *"undo does not change the armed target"* while its design body said *"the list
  arms that row"*. Resolved in favour of the body, with the reason written down: arming the affected
  row is **announcement**, not history. Undo that walked back navigation as well as content would
  interleave with panning and become unpredictable, which is the thing the plan was actually
  guarding. In the common case they coincide anyway, because a drag arms the row it drags. **The
  automated test was written the honest way rather than the way the plan phrased it** —
  `arms the row whose value changed, rather than restoring what was armed before` — and T-480 walks
  it in those words.
- **A run is one step.** A drag calls `edit` on every pointer move and a nudge on every keypress, so
  both pass a coalescing key: ten arrow presses, or one drag however many frames long, goes back in a
  single `Ctrl+Z`. Without it one gesture would fill a fifty-deep stack with itself and shove the
  thing you wanted off the end. `endRun()` closes a drag when the pointer lets go.
- **The step is in points, not pixels.** So a nudge is the same correction at 11% as at 400% — one
  point against 16 pt rows is a sixteenth of a row wherever you are standing. A pixel step would be
  twenty times coarser at fit zoom with nothing on screen to say so.
- **Only a point the draft already owns will move**, via a new pure `model.ts` `draftPoint` —
  deliberately not `editorPlaces`, which falls back to the server's resolved answer. A terminal drawn
  on its parent's dot has a dot on screen and no point of its own; nudging it would turn *"we guessed
  `CR-BP:12` is at the coil"* into *"a human confirmed it is 1 pt from the coil"*, which is a
  `derived` tier by the back door. **Placing is a click and stays a click.** This became invariant 8
  in the code map.

**Bare arrows still pan, on both tabs.** `useTileViewport`'s key handler now declines a *modified*
arrow — otherwise a nudge would move the dot 1 pt while the sheet slid 60 px underneath it and the
correction would be invisible. The guard is narrowed to `event.key.startsWith('Arrow')` on purpose:
`+` needs `Shift` to type, and a blanket `shiftKey` guard would have quietly stopped zooming in.

**Two ideas rejected, and the reasons are recorded in the plan §9 so they do not creep back.** A
minimum-drag threshold — rejected by the user, because on this drawing a twitch and a deliberate
0.1 pt correction are the same gesture and no threshold can tell them apart; refusing an intention is
worse than allowing an accident you can undo. And a `rev` counter on the file (the `K2` fix) —
deferred, because it has never been observed to bite in a single-tab workflow.

### 2. A net or a wire is highlighted as the terminals it is made of

**The report.** *"Clicking `120` marks Bypass-CB, DISCHARGE1, INFEED1 and TB-120, but not CR2."*

**It was real, and it was two faults wearing one coat.** CR2 *was* in the highlight set and a dot
*was* drawn — on CR2's **coil**, at (861.0, 381.3). The terminal actually on net 120 is `CR2:14`, its
NO contact, at (236.1, 563.4): most of a sheet away, which reads exactly like a missing mark. The
cause is that a net's highlight was `entry.members`, and `members` is the **parent components** of
its terminals. The same disagreement, quieter, put `DISCHARGE1`'s ring on the component rather than
on `DISCHARGE1:3` — and `TB-120:1/2/3` share a parent, so **seven members were being shown as at most
five dots**.

**What landed.** `/api/designators` publishes `terminals` on every wire and net: the membership
itself, **in order and undeduped**, each member with its own point and its own `placement`.
`[from, to]` for a wire, `member_terminals` for a net. Measured against the real drawing: 127 members
over 26 nets, 142 ends over 71 wires, every one `confirmed` — because all 131 terminals are placed,
which is what makes this worth doing at all.

**Three distinctions the payload now keeps apart, and hazard H12 exists so they stay apart:**

- **`terminals` is undeduped; `places` is deduplicated.** Two members on one coordinate is one dot
  *and* two members, and both are facts. A roster that showed five rows for seven members because
  three share a block would under-report the net.
- **A wire's order is content, not presentation.** Session 2's two-ended compass heads its controls
  with those ids; swapping them would mislabel both ends of all 71 wires with nothing visible to show
  it.
- **Each member carries its own `placement`.** A net of two placed pins and one nobody has touched is
  three claims, and one field on the net could only lie about two of them.

**On the client:** `DrawingTab`'s `relatedIds` now includes the member terminal ids, which does two
jobs with one set — the rings land on terminals, and (because a switched-off group only contributes
what is in `relatedIds`, which is H11) **a selected net's pins draw even with `Terminals` off.** The
parent components stay marked, because a relay drawn in two places is genuinely part of the net in
both.

**The selection card becomes a roster.** One row per member, in order, each saying how well its own
point is known and each a click away from being flown to — through the same `select(kind, id)` a
citation calls, so the two entry points cannot drift. It scrolls rather than truncating. The
component chips stay, demoted to `runs through`. And a row that is not `placed` carries a **place it**
link that arms that pin on the Locate tab — the roster is where somebody *notices* a pin has no point
of its own, and making them then find that row in a 275-entry list on another tab is exactly the
searching this project exists to remove. It is offered only when `health.editing.enabled`, so a
reader's copy is unaffected.

**The three placement words now live in one place.** `placed`, `estimate`, `on its component` and
`nowhere` moved into `webui/src/lib/designators.ts` as `PLACEMENT_LABEL`, imported by both the Locate
tab's list and the Drawing tab's roster. A reader who learns *"on its component"* in the editor has to
meet the same phrase on the reader's side, and two copies of four words is two copies too many.

**One deliberate coupling.** `DrawingTab` imports `useLocateStore` — the only place outside the
Locate feature that touches it, and the store's header now records the exception. It sets the armed
target and nothing else.

**What it cost, said out loud:** `/api/designators` grew from **90.0 KB to 110.1 KB** — 269 small
objects, about 20 KB, 22%. Fetched once per page load and again after each save, against 2.2 MB of
tiles. Recorded because *"it is only a few fields"* is how a payload doubles over six sessions.

### One new known issue, found while writing the lesson

**`K9`: a net cannot be selected from the sheet.** Nothing a reader can click raises a net or a wire —
the dots are components, terminals and label points — so the only route to a net's highlight is a
citation in an answer, which costs a question. T-500 says so and offers the choice of walking it after
Session 3, whose Drawing-tab list removes the need. Noted so nobody reports it as a bug in the
meantime.

### Tests and documents

**111 server (was 106), 155 web (was 127), `ruff` and `tsc` clean.** The artifact test was cleared by
re-running the generator first, as the plan instructs, so that inherited red could not be confused
with our own.

| Where | Added |
|---|---|
| `webui/src/stores/locateStore.test.ts` | **New, 12 tests.** The code map had said in as many words that an undo stack would need this file. It reads the *draft document* rather than the screen, because the document is the deliverable |
| `webui/src/features/locate/LocateTab.test.tsx` | 9 — both step sizes at two zooms, the bare arrow still panning, `Shift`+`+` still zooming, ten nudges in one undo, the text-field guard, the zoom and filter left alone, the `activeTabId` guard |
| `webui/src/features/drawing/DrawingTab.test.tsx` | 5 — rings on terminals at their own points, the roster's rows and words, a row flying, pins surviving `Terminals` off, *place it* present only with an editor |
| `webui/src/features/locate/model.test.ts` | 2 — `draftPoint` answers only for what the draft owns |
| `server/tests/test_api.py` | 4 — a net's members in order with their own placements, a wire's `[from, to]`, no `terminals` on a component or a terminal, every ringed member inside the rectangle |
| `server/tests/test_locations.py` | 1 — two coincident members are **one dot and two members**, which is the undedup rule stated as a test |

Documents, all in `_claude_notes/locate_tab_testing/`:

- **`05_tests_save_and_recover.md`** extended with **T-470–T-490** — undo, what it covers and
  deliberately does not, and the nudge walked at two zooms;
- **`09_tests_net_membership.md`**, new, **T-500–T-520** — the fault in the words it was reported in,
  then the rings, the frame, the roster, the flight and *place it*;
- **the index**: §3 gains the new document, §5b is the two changes, §6 gains seven symptom rows, §7
  strikes **`K8`** and adds **`K9`**, and the test counts are refreshed;
- **`06_code_map.md`**: twelve new symbols, hazards **H12** and **H13**, invariant **8**, and the
  *"there is no test file for the store"* note struck because there is one now;
- **`01_screen_and_vocabulary.md`**: the undo line in the toolbar, a key table for the sheet, and a
  section on the other screen's roster — because the words have to be the same words;
- **`08_results_log.md`**: blank rows for T-470–T-520.

### Two things a person must do, not a session

**Restart the server** — `drawing.py` changed and `python -m app` has no reloader. The bundle was
rebuilt (`npm run build`), so a restart picks up both halves; a rebuilt bundle against an
unrestarted server is the dangerous combination.

**`circuit_logic.json` is modified in the working tree** — the plan's "start from green" step
re-ran `author_circuit_logic.py`, which is the correct way to clear `K6`. It is a generated file and
belongs in the same commit.

---

## 2026-08-19 — Three things a real placement run asked for

Three requests, from the user, after driving the manual and then doing an actual run of
placements. None of them is a new capability; all three are the same complaint in three places —
**the screen knew something and was not saying it, or said something nobody asked it to.**

### 1. The Drawing tab's three switches say which ones are on

They were ghost buttons carrying `aria-pressed` and, when on, a slightly brighter word. That is a
state a screen reader can report and a person cannot see. It matters more here than for a normal
toggle because the three groups are **independent** by design (2026-08-19, entry below), so at any
moment the honest question is *which of these are in effect* — and the answer was being worked out
by studying the sheet, which is the thing the switches change.

Filled when on, plain when off, which is what the Locate tab's filter buttons have always done.
One `variant` expression, and the `text-foreground` class it replaces is gone.

### 2. The label side reaches the reader — `places` is not only about several dots

The report: `DISC1:L1`, `L2` and `L3` were placed with their labels **west**, on the Locate tab,
and came out **east** on the Drawing tab. East is the default.

The cause is worth writing down because everything in the chain was individually correct.
`_entry()` in `server/app/drawing.py` publishes a `places` array **only when it says something the
flat `point` and `placement` fields cannot**, and that rule was implemented as `len(places) > 1`.
For a coordinate that is exactly right: 269 of this drawing's 275 entries have one dot, and
duplicating each into a second field is bytes saying nothing. But **`label_dir` has nowhere else to
live** — there is no flat field for it — so a single-dot entry silently lost the one property of that
dot a human had chosen by hand, and the viewer applied its default. The editor wrote the file
correctly, the file held `"label": {"dir": "w"}`, `resolve_geometry()` resolved it, and the viewer
honours every `label_dir` it is given. It was dropped in the one step between.

The condition is now `len(places) > 1 or any("label_dir" in place …)`. **`site` is deliberately not
in it:** a site names *which of several dots this is*, and with one dot there are no several. The
effect on the real drawing is 48 more entries carrying `places`, every one of them because somebody
chose a side.

**This is the group's only server change**, which matters operationally: `python -m app` has no
reloader.

### 3. Past 50% zoom, nothing flies

In the user's words: *"when I select a terminal, the page zooms to 50% and centres on the marker.
That is good when I am zoomed all the way out. But when I am already past 50% I usually have the
marker in front of me and control of it, so moving the drawing interrupts the work."*

That is the flight doing exactly what it was built for, in the one situation where it is wrong. The
ceiling is not a new number: `FOCUS_ZOOM` is where a flight *lands*, so **from anywhere closer than
it, a flight can only take magnification away** — and past it you are normally at a zoom you chose
in order to work on one dot, which is on screen with the pointer beside it. So above the ceiling
neither the scale nor the position moves.

Three things about how it was done, each of which was the alternative not taken:

- **One guard, in the flight effect, not in five call sites.** The reason is a property of the
  *viewport* — how magnified the sheet already is — and not of which row was picked, so every asker
  gets the same answer: the list, the advance, the site buttons, a click on a dot.
- **The zoom is read from a ref**, so it is the zoom at the moment of the flight rather than at the
  render that asked for one. An unmeasured sheet reads 0, which is below the ceiling — the first
  flight of a session is exactly the one worth making.
- **`FOCUS_ZOOM` is exported and multiplied by 100** rather than `50` being written down twice. If
  the flight zoom ever changes, the ceiling follows it, because the ceiling *is* the flight zoom.

It applies to the advance too, and that is a deliberate call rather than an oversight: at working
magnification the advance's next row may be somewhere else on the sheet, and the old comment on that
code says *"the run takes the sheet with it, or the next click would be aimed at something that is
not on screen"* — which is true at fit zoom and not what somebody working at 100% asked for. The
footer under the sheet states the rule, because a flight that silently does not happen is otherwise
indistinguishable from one that is broken.

### Verification

127 web tests (three new — the visible switch state, a west label on a single-dot terminal, and the
ceiling with its boundary at exactly 50%), 106 server (one new: a single place keeps its label side),
`ruff` and `tsc` clean, bundle rebuilt into `server/app/static/`. The one red server test is the
documented one, `test_the_committed_artifact_is_exactly_what_the_generator_writes` — K6/H9,
`circuit_logic.json` behind the current `locations.json` after the user's own placement run, fixed by
`cd schematic_extraction/PS20115MLM4-2/extracted_docs && python author_circuit_logic.py`, which is a
human's command at a terminal by design. Not touched here.

### The manual, in the same session

**T-115** (the ceiling, including the boundary at exactly 50% and the "below it nothing changed"
half) in `02_tests_place_and_drag.md`, **T-335** (the label side from the reader's side, with the
`curl` that separates a server fault from a client one) in `04_tests_labels.md`, a paragraph on the
filled switches in **T-190**, all three in `08_results_log.md`, index §5 changes 11–13 with the new
counts, three new symptom rows in §6, and three rows in `06_code_map.md` — the `places` rule, the
flight ceiling, and where "filled means on" lives.

---

## 2026-08-19 — The Drawing tab gets the Locate tab's three groups

One request, from a user who had just finished walking the Locate manual: *"On the Locate tab we
can filter the list to show Components, Terminals, or Wire and Net Labels. On the Drawing tab I
can only see components."*

The gap is worth stating plainly, because it had been there since the marker overlay was built and
nobody noticed. **The Locate tab exists because 131 terminal points are guesses that a human has to
confirm, and the Drawing tab is where you check a placement from the reader's side** — T-170 in the
manual is that test. It could only ever check a *component*. The 131 pins, which are the actual
work, had no view at all outside the editor that wrote them.

### What landed

`DrawingTab.tsx` grew a `Layer` vocabulary — `components`, `terminals`, `labels` — with one
toolbar button each, using the Locate tab's exact words (`Wire & net labels`, ampersand and all)
because two screens naming the same three groups differently is how a vocabulary rots.

**They are independent switches, not one exclusive choice, and that is the one place this
deliberately diverges from the Locate tab.** Over there the filter picks which rows you are
*working through*, so exactly one at a time is right. Here you are reading, and every question
worth having the switches for is a comparison: *is that pin on the same conductor row as its
relay*, *is `W048`'s printed name anywhere near the run it belongs to*. Both halves have to be on
screen at once. It is also strictly a superset — switch two off and you have filtered to the
third — and it preserves what the original single `Components` toggle was for, which was turning
everything off to look at the drawing itself.

Only `Components` starts on. That is not timidity about changing a default: this sheet has 47
components and 131 terminals, and most of those terminals have no point of their own, so
*Terminals* alone paints a hollow dot on top of each component's dot. It is honest — hollow means
estimated and the tooltip says whose point it really is — but it is a fog, and nobody should meet
it without having asked for it. T-190 says so in the manual, so it reads as expected rather than
as breakage.

A group with nothing to draw gets **no button**. A pressed switch that changes nothing on the
sheet reads as broken; an absent switch reads as *nobody has placed one yet*, which is true, and
the Locate tab is where you fix it.

### The bug that came out of it, which nothing on screen would have shown

`onMarker` raised every click as `select('component', marker.id, 'drawing')`. Hard-coded, and
correct for exactly as long as components were the only things with dots. The moment a pin got one,
a click on `CR-BP:A1` would have put `{kind: 'component', id: 'CR-BP:A1'}` in the store — and the
selection card looks its entry up **by id**, so the card would have been perfectly right while the
store held a lie. Every future consumer of a selection switches on `kind`: net highlighting, the net
explorer, guided troubleshooting. It is `marker.kind` now, and a test asserts a clicked pin is a
`terminal` and a clicked label is a `wire`.

### Two things that had to be kept apart

Both are hazard **H11** in the code map, because both are the kind of coupling that looks like
tidying up:

- **`located` is not "which dots are drawn".** It decides whether a `runs through` chip on a net's
  card is a live link or a dead one, and it is built from the components group *whether or not the
  group is switched on*. Wired to the visible markers instead, switching `Components` off would
  silently kill every link on every card — indistinguishable from the extraction not knowing where
  those components are.
- **A switched-off group still contributes the selection and anything it runs through.** Hiding the
  thing an answer just pointed at is the one case the overlay must stay visible for. So `markers`
  filters per group rather than gating one list on a boolean.

### The invariant, restated where it can now be violated

A wire's `point` is the midpoint of its bounding box and a net's is the centroid of everything it
touches. **Neither is a place on the sheet**, and a dot on either would sit on blank paper carrying
a real identifier. The wire/net layer and the selected marker now both go through one
`atLabelPoint()`, which returns `null` until a human has said where the *name* is printed — so
neither path can grow the behaviour the other lacks. That is invariant 1 in the code map, extended
from *"there is no way to author a route"* to *"and no dot is ever drawn as if there were"*.

### Verification

124 web tests (five new, all in `DrawingTab.test.tsx`), `tsc` clean, and the bundle rebuilt into
`server/app/static/`. 105 server tests with the one documented red:
`test_the_committed_artifact_is_exactly_what_the_generator_writes`, which is K6/H9 —
`circuit_logic.json` is behind the committed `locations.json` and re-running
`author_circuit_logic.py` is a human's command at a terminal by design. No server code was touched
by this change.

### The manual, updated in the same session

The request asked for it, and the manual is what turned the gap into a request in the first place —
so: **T-190** (the three groups, the expected fog, the clicked pin is a terminal) in
`02_tests_place_and_drag.md`, **T-360** (every label at once, and no dot on blank paper) in
`04_tests_labels.md`, both in `08_results_log.md` and both unwalked. Index §5 change 10, four new
symptom rows in §6, hazard **H11** and four new client rows in `06_code_map.md`, and the note in
`01_screen_and_vocabulary.md` that the other tab now speaks the same three words.

---

## 2026-08-19 — Four changes to the reading loop: Ask ⇄ Drawing

The Locate-tab work of the same day is recorded in
`_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md` §5, not here. This
entry is the other half of the day: the user had finished walking all 28 Locate tests, everything
passed, and turned to **the loop a reader actually spends their time in** — read an answer, check
it on the sheet, come back. Four requests, and the thread joining them is that the answer and the
drawing are one document viewed two ways, so crossing between them should cost nothing.

### 1. A clicked component asks for everything, not one facet

*Ask about this* on a component's card put `What does CR-BP do, and what is connected to it?` in
the composer. It is now `Please tell me all you can about CR-BP`.

The narrow question was written to be exemplary — short, specific, two clauses. Standing at a
marker that is the wrong instinct: the reader has just arrived somewhere and does not yet know
which facet they want, and a two-clause question gets a two-clause answer with the relay's other
two sites, its ratings and the nets it switches left out. The other three kinds keep their
specific questions, because a terminal, a net and a wire each have one fact a reader is nearly
always after, and "everything about net `110`" is a table the deterministic views in
`webui_ideas.md` §1 will give away without a model at all.

`suggestedQuestion` in `webui/src/lib/designators.ts`, one test pinning the exact string, because
it is a product decision and not a wording accident.

### 2. `F2` shuttles between Ask and Drawing

The user noticed they were using *Ask about this* as a **tab switch** and asked for a real one.
That observation is the finding here: two ways across the seam existed and both were round trips
with a side effect — a citation moves the sheet, *Ask about this* rewrites the composer — so
neither was a way to simply *look*.

`F2` toggles: on the Drawing tab it goes to Ask, anywhere else it goes to the drawing. Bare `F2`
only; with any modifier it belongs to the browser or a screen reader.

**Why `F2` and not a letter.** It has to work while the caret is in the composer, which is where a
reader sits on the Ask tab, so bare letters are out. It must not be something the browser has
claimed: `Ctrl`/`Alt` plus a digit switches browser tabs, `Alt+D` is the address bar,
`Ctrl+Shift+D` is bookmarks. Nearly every function key is taken too — `F1` help, `F3` find, `F5`
reload, `F6` toolbar, `F11` full screen, `F12` dev tools — and `F2` is not, in any of the three
engines, and a textarea does nothing with it either.

Bound in `App.tsx`, deliberately, not in a tab: a tab that is not mounted cannot listen for the
key that would show it, and `keepMounted` is a performance decision that must not become the
reason a shortcut works. It is not bound at all when the sheet was never tiled — there is no
Drawing tab then, and a key that silently does nothing is worse than no key. Advertised in three
places a reader is already looking: the composer's hint line, the drawing's footer strip, and the
`title` on both tab triggers.

### 3. More of the model's identifiers become links

The citation seam has worked since 2026-08-12 and the model uses it "pretty well". The user asked
whether it could be pushed further. Reading the prompt against the client's actual lookup found a
real defect rather than a matter of degree:

**`Citation.tsx` matches the *whole* backticked span, verbatim, against the designator index.** So
`` `net 110` `` matches nothing — the entry's id is `110`, and nets carry no aliases — while
net `` `110` `` links. The old prompt's own example was `` `net 110` ``, and its troubleshooting
section printed the model path with **one** pair of backticks around the entire line, which turns
the most useful line in the answer into the one place the reader cannot click. The prompt was
teaching two of the failure modes it was meant to prevent.

So the Citation section gains a subsection stating the mechanism and six rules that follow from
it: one identifier per span and nothing else inside the backticks; spelled as `circuit_logic.json`
spells it; **every** occurrence rather than the first in a sentence (the old wording licensed a
bare mention afterwards, and a reader scrolled back three screens needs the link in front of
them); in every table cell; on every hop of a path; and the id in the sentence rather than a
pronoun or a paraphrase. Plus a closing instruction to re-read the draft once for links only,
which is the cheapest pass available. Both bad examples are fixed.

`PROMPT_VERSION` is `v1.2`. Every archived turn records it, so the effect of this change is
measurable against v1.1 answers rather than a matter of impression —
`test_terminals_must_be_cited_with_their_component` still holds the counts that make a bare pin
ambiguous.

**And the client meets it halfway.** `resolve` in `lib/designators.ts` now reads a span of the
form `<kind> <id>` — `` `net 110` ``, `` `wire W048` `` — as that id, *provided the kind word
agrees with the kind the index gave it*. A reader does not care whose fault a dead link was, and
this is the one near-miss worth absorbing because it is the phrase English wants. It is still not
a pattern match and the allowlist still holds: the id must be in the index exactly, an exact hit
on the whole span always wins first (a component actually named `NET 110` keeps its own span), and
`` `component 110` `` resolves to nothing rather than to net `110`. Nothing else is stripped —
`` `on net 110` `` and `` `W048 (blue)` `` stay plain, which is what keeps rule 1 of the prompt
worth obeying.

### 4. Escape clears the selection on the Drawing tab

The same key, with the same meaning, as the Locate tab's Escape from 2026-08-19: what a button
does, the key should do. A selection is a mode — a ringed dot, a card over the corner of the
sheet, a marker that stays visible through the *Components* toggle — and the only way out was a
20 px ✕ in that card, which costs a pointer trip away from the thing being read.

On `window` rather than on the sheet, because the selection usually arrived from a citation on the
*other* tab and nothing in the viewer has focus afterwards. Guarded three ways, and each guard is
a bug that would otherwise exist: by the active tab, so a hidden Drawing tab cannot disarm the
Locate editor's target; by `defaultPrevented`; and by a text-field check, so Escape in the unlock
field or the composer is that box's first. It also does not swallow an Escape when nothing is
selected — a dialog elsewhere may want it.

`isTextField` moved from `LocateTab.tsx` to a new leaf module `webui/src/lib/keys.ts`, since both
handlers now need the same rule and the reasoning behind it (checkboxes hold focus but nothing is
being composed in them) is worth stating once.

### Verify

    cd server && .venv/bin/python -m pytest -q; .venv/bin/python -m ruff check .; \
      cd ../webui && npx vitest run; npx tsc -b --noEmit

**105 server, 119 web** (eight new: the component question, the `F2` shuttle and its absence
without tiles, three for Escape, and two for the `<kind> <id>` span), ruff and tsc clean. `npm run build` has been run, so
`server/app/static/` is current; the server needs a restart for `prompts.py` — with `python -m
app` there is no reloader, and an unrestarted server answers with v1.1.

Four things to try, on a running server:

| | Do | Expect |
|---|---|---|
| **D-1** | Ask anything, click a component citation, press *Ask about this* | Back on Ask, composer reads `Please tell me all you can about <id>` |
| **D-2** | Press `F2` on either tab, repeatedly, including with the caret in the composer | Ask ⇄ Drawing every press; the sheet keeps its pan and zoom; nothing is typed into the box |
| **D-3** | Click a marker, then press `Escape` — then again with the composer focused | Card and ring gone the first time; the second time the box loses focus and any selection stands |
| **D-4** | Ask a troubleshooting question ("no 24 V at the bypass relay") | More clickable spans than before, including inside tables and on every hop of the path; no `` `net 110` `` and no whole-path spans |

---

## 2026-08-17 — What the editor was missing, and the flag that hid all of it

The user opened the app after the entry below landed and reported seeing **none** of it —
"I fear this is failed attempt number 2." Three separate things were wrong, and only one of them
was code.

### 1. The deliverable was invisible by default, and the note said so in the wrong place

The Locate tab exists only when the server is started with `SWUI_ALLOW_EDITS=true`. That defaults
to false *on purpose* — the routes are never registered, so a public demo has no write surface —
but `server/.env` did not have it, `python -m app` has no reloader, and the previous session's
summary mentioned the flag once, in a closing sentence about test coverage. So the user restarted
nothing, saw yesterday's UI, and reasonably concluded nothing had shipped.

**The lesson is about where a fact goes, not whether it was stated.** A feature that is
off-by-default has an activation step, and that step is part of the deliverable. It belongs at the
top of the handover, in `.env`, and in the README — not in a footnote. All three now have it, and
the `NEXT UP` state block above leads with it.

Worth recording as evidence that the screen itself was sound: once the user did start the server
with the flag, they placed **three terminals** through the UI inside six minutes — `TB-110:4`,
`TB-120:1`, `TB-IINSP1:1`, with real browser timestamps in `locations.json`. That is the first
machine-independent proof that click-to-place, autosave and persistence work with a real pointer,
which no test in this repository can give.

### 2. Wire and net labels could not be placed at all, and that was a wrong call

The user's requirement was "a list of all components **and wires** and then drag those labels to
the correct positions". The entry below refused to place wires, on the grounds that a wire's
geometry is its two endpoint terminals and drawing a line between them would be inventing a route.

**That argument is correct and it answered a different question.** A wire's *route* must never be
authored. Where its *name is printed* — `BLUE 18AWG`, beside the conductor — is a real, specific
place on the sheet, and a reader following a citation of `W048` wants to land on the words rather
than on the midpoint of a bounding box. Those are two different facts and the previous session
collapsed them into one refusal.

So `locations.json` gains two sections that can hold exactly one thing each:

    components   sites, each with a point and the pins drawn there
    terminals    a point of its own, which beats the site claiming that pin
    wires        label_point — and nothing else
    nets         label_point — and nothing else

The key is `label_point`, not `point`, deliberately: the next person to read this file must not be
able to mistake it for where the wire is. There is nowhere in the format to say where a wire goes,
which is the invariant the whole netlist's authority rests on. On the API side it surfaces as
`label_point`/`label_dir` on the entry, `rect` still frames the run from the endpoints, and
**wires and nets still carry no `placement`** — nothing estimates a label, so there is no
provenance to report beyond "a person put it there".

`author_circuit_logic.py` folds it in as `label_location` on `wires[]` and `nets[]`, never as
`location`. `test_a_wire_gets_where_its_name_is_written_and_never_a_route` asserts both halves,
including that the wire has no `location` key at all.

**Counted separately, and never as work outstanding.** A terminal with no point is missing data. A
wire with no label point is finished work with a nicety missing — every citation of it already
frames the right run. So `coverage()` reports `labelled / labellable` on its own, the "To do"
filter does not include them, `nextUnplaced()` skips them, and placing a label does **not** advance
to the next row: being thrown to an unrelated terminal after tidying a wire's name is not a run.
`PLACEABLE` and `LABELLABLE` in `model.ts` are that distinction in one place.

The Drawing tab benefits without any new UI: a selected wire or net used to get no marker at all,
because its `point` is a centroid sitting on blank paper. It now gets one **once a label point
exists**, on the printed text. Before that, it still frames the run and rings the ends, which
remains the honest answer.

### 3. Labels stay on eight sides, by the user's choice

Offered free drag (an arbitrary `label: {offset: [dx, dy]}`), free drag plus the compass, or the
eight compass sides that already existed. The user chose **eight sides only**. So `LABEL_SIDE`'s
compass lookup and the 3×3 control are the whole of label positioning, and no offset form was
built. Recording the choice because the obvious future request is "let me nudge it a bit", and the
answer is that this was decided rather than overlooked.

### One test whose premise expired

`test_without_a_locations_file_the_artifact_is_unchanged` asserted that with no `locations.json`,
`circuit_logic.json` regenerates byte-identically. That was the right invariant while no drawing
had a locations file. **The moment one does, it asserts that the artifact ignores the second
authored input** — the opposite of the intent — and it duly went red as soon as a real point was
placed.

Replaced by two tests that say what was actually meant:

- `test_the_committed_artifact_is_exactly_what_the_generator_writes` runs the generator against
  *both* authored inputs and compares to the committed file. This catches a hand-edit of a
  generated file, and it catches a `locations.json` that has been placed but never regenerated —
  so the staleness the editor puts a banner about is now a red test too.
- `test_the_loader_is_inert_when_there_is_no_locations_file` keeps the other half: a fresh
  extraction gets no `sites`, no provenance on a location, nothing folded.

Worth generalising: **a test whose premise is "the state of the repository today" expires the day
that state changes.** Phrase the invariant, not the snapshot.

### Verified

**105 server tests** (was 100) and **100 web** (was 93); `ruff` and `tsc -b` clean; bundle rebuilt
and the server restarted onto it.

Against the real netlist in a scratch copy — so the `locations.json` the user was editing was never
touched: `W048`'s label resolves to (742, 511) with `label_dir: "w"` while its `rect` stays
[385, 664, 861, 679], the run from its endpoints; net `110`'s label resolves independently of its
own 240 × 240 pt rectangle; a label for `W999` is reported as *"not a wire or net in the
netlist"* rather than dropped; and a section entry with no `label_point` costs that entry and says
so, naming `label_point` because that is the key a person typed.

**Still not verified by machine:** the drag gesture, for the same reason as ever — jsdom has no
`PointerEvent`, so `fireEvent.pointerDown` carries no coordinates and no test can drive a drag.
The arithmetic is pinned in `paint.test.ts` and *which tab passes `onDragPoint`* in the component
tests. The user's three placed terminals prove the click path; the drag path is theirs to confirm.

---

## 2026-08-16 — Job B attempt 2: the Locate editor, and the guessing stops

**Superseded in two places by the 2026-08-17 entry above.** Wires and nets are no longer unplaceable
— they carry a `label_point` for where their name is printed, though still never a route — and the
byte-identical generator test named below was replaced once a real `locations.json` existed. This
entry is otherwise current.

Attempt 1 built a guesser and shipped it without the thing it was meant to accelerate. This is the
thing: a screen where a person places every point, and `locations.json` as the second authored
file that records who said so. **No `derive.py`, no `seed_locations.py`, no ranking, no 45 pt or
60 pt thresholds, no net projection, no printed-label matching, no fuzzy text matching.** The five
reasons that got attempt 1 rejected are in the entry below and were the specification for this one.

Faults 1, 2 and 3 from `drawing_fixes_plan_01.md` are all closed by this change. 1 and 3 were
wrong coordinates and a human placing points is the fix — verified against the real sheet below.
2 was a line of code.

### Two sources in the file, three placements on the wire, and no fourth of either

    file `source`     human                 seed
    API `placement`   confirmed             seed                parent

`human` is a person in the editor. `seed` is the indexing pass's own estimate — the `x=`/`y=`
arguments in `author_circuit_logic.py`, made by the thing that was actually looking at the pixels.
`parent` exists only in the resolver and cannot be written: it is a terminal shown at its
component's point, which is the *absence* of an answer rather than an answer.

Attempt 1 had a fourth, `derived`, and deleting it is most of what this change is. `derived` is now
explicitly **not** a value the loader accepts, and `test_a_bad_field_costs_that_field_and_nothing_else`
uses it as its example of a rejected source — so reintroducing the tier fails a test that says
why in its own comment. That is deliberate: the machinery is easy to rebuild and the argument
against it is not obvious from the code alone.

### What the server gained

- **`server/app/locations.py`** — the format, the per-field validation, the `problems` list, and
  `resolve_geometry()` as the single place that decides where anything is. Lifted from `7003dfb`
  with the `derived` tier removed, plus two new things:
  - `parse()` split out of `load_locations()`, so the write path can validate a payload that is not
    on disk yet **using the same code the next read will use**. What the editor is told was refused
    is therefore exactly what gets refused, in the same words.
  - `save_locations()` — whole-file, `os.replace` onto the same filesystem, and
    `load_locations.cache_clear()` *inside it*. That last line is the one bug this design can have:
    without it the editor saves a point, gets a 200, and is handed the old geometry back.
    `test_a_saved_point_is_visible_to_the_very_next_read` fails without it.
- **The refusal split, and where it is.** Four things are refused whole, because writing them
  would destroy work in exchange for something the reader throws away anyway: a payload that is
  not an object, an unknown `schema`, another drawing's `drawing_number`, another page's
  `page_size_pt`. **Everything else is written and then reported.** One typo costs that field and
  lands in `problems`, which the editor shows as a red strip — because a coordinate a human typed
  and the server silently ignored is the worst outcome available here.
- **`GET /api/locations` answers the file verbatim.** The editor sends it straight back, so
  anything this endpoint normalised away — a `by`, an `at`, a field a later version adds — would be
  silently deleted on the next save. An extraction nobody has placed anything on gets
  `skeleton()`, an empty document, rather than a 404: a fresh drawing and a half-placed one differ
  in content, not in kind.
- **`drawing.py`** publishes `places[]` (only when there are two or more — 269 of 275 entries are
  single), `placement` on components and terminals, and `label_dir` only where somebody set one.
  Nets and wires carry **no** `placement` at all, and that is a claim rather than an omission:
  their geometry is their terminals', placing 131 terminals gives all 71 wires their positions for
  free, and a `placement` on a wire would invite someone to place one. Drawing a straight line
  between two component points because no conductor joined them would be inventing a wire route.
- **The gate.** `allow_edits` defaults false and the routes are registered **inside the `if`** — so
  a public demo has no write surface to attack rather than a guarded one.
  `test_a_read_only_server_has_no_editor_to_attack` asserts 404s from the router, not 401s from a
  handler. `editor_password` is a *second* secret, checked with `hmac.compare_digest`, mirroring
  `/api/unlock` on the same `5/minute` bucket; the client holds it in memory and returns it as
  `X-Editor-Password`, exactly as the demo password already works. That is the whole "scope": no
  server-side session, nothing to expire or forge, and closing the tab is a logout.
- **`editor_name`** — new, small, and not in the plan. It is published as `health.editing.by` and
  stamped into each point as `by`. Added because "a derived point is a guess with no owner" is the
  argument this entire job rests on, and a file that can record an owner should be able to.

### What the client gained

`webui/src/features/locate/` — `LocateTab.tsx` (the screen), `WorkList.tsx` (275 rows),
`TargetPanel.tsx` (sites and pin assignment), `model.ts` (all of the arithmetic, pure), plus
`stores/locateStore.ts`. Ten decisions in it are worth keeping:

1. **`model.ts` has no React and no `fetch` in it.** What the editor *does* to an authored file is
   the part that can be quietly wrong — a pin assigned to two sites, an advance that skips work —
   and none of it can be asserted against through a component tree. Fifteen tests live there.
2. **It is not a second `resolve_geometry`.** `editorPlaces()` answers a smaller question: what
   does the document the user is editing say *right now*, before it has been saved and
   re-resolved. Draft beats server because the server has not seen the last click — a rule about
   staleness, not about geometry, and it disappears when the save round-trips.
3. **A placement is a click that did not move the sheet.** The guard against a pan's trailing
   click planting a point: snapshot the viewport on `pointerdown`, refuse the click if it changed.
   Better than a distance threshold — there is no tolerance to pick, and it also catches a click
   that lands mid-flight or during an auto-fit, where the coordinate under the cursor is not the
   one the user was aiming at.
4. **`cssToPoint` went into `paint.ts`, beside `pointToCss`.** There is one projection in this
   application. An editor that computed its own would write coordinates the tiles disagree with,
   and the dots would land plausibly and be wrong. The round trip is tested in `paint.test.ts`.
5. **Saving is debounced, not manual.** 900 ms after the last change. Placing 131 terminals is a
   run of clicks, and a Save button turns that run into a run *plus* a habit — the sort of thing
   remembered right up until the moment it is not. The write is atomic, so one landing mid-run
   costs nothing. There is still a Save button for anyone who wants to force it.
6. **"Add a site" is editor state, not document state.** A site with no point would be refused by
   the server's per-field validation and reported as a problem, so the file only ever holds sites
   that are somewhere; the *next click* creates the site. This is also why there is no `addSite()`
   in `model.ts`, only `nextSiteId()`.
7. **Drag moves what the dot's row names** — a component's dot is its site, a terminal's is that
   pin's own point. Never both: a gesture that silently moved five other pins because they share a
   site would be the worst kind of surprise in a file nobody re-checks.
8. **The Locate tab's dots are draggable and the Drawing tab's are not**, because only the editor
   passes `onDragPoint`. A stray drag on a read-only sheet must pan. Both directions are tested.
9. **`refreshDesignators()` after every save.** Without it the file on disk is right and the
   Drawing tab keeps drawing the estimate until the page is reloaded. The store reaches across to
   `appStore` rather than making every reader poll, because this is the only thing in the
   application that changes geometry.
10. **The container stays mounted while the file loads.** Found the hard way, and it is a real
    trap rather than a test artifact: `useTileViewport` attaches its `ResizeObserver` in an effect
    that runs **once**, so a container rendered later than the hook is never measured — the sheet
    sits at `scale: 0`, nothing errors, and *every coordinate the editor computes is zero*. The
    password box and the loading line are an overlay over a mounted layout, not an early return.
    The Drawing tab is safe from this only because `isEnabled` keeps it unmounted until its tiles
    exist.

### Fault 2, and the honesty states

`DrawingTab.tsx:68` was `entry?.kind === 'component' ? entry.id : null` — one line that made a
selected terminal borrow its parent component's marker. So citing `CR-ON:A2` ringed a dot labelled
`CR-ON`, sitting wherever `CR-ON` is, which on this sheet is the coil centre rather than the pin.
Two wrong things at once, and both look like a working link. `MarkerLayer` now takes the whole
`selected` entry and draws it at its own point under its own name.

Nets and wires deliberately get **no** selection marker: their `point` is the centroid of
everything they touch, which is a rectangle worth framing and not a place on the sheet. They keep
what they always did — frame the rect, ring the members.

`MarkerLayer` also became honest about provenance, which is D5 and is the whole reason `placement`
is published. **Filled means a person placed it; hollow means we are showing our own estimate**,
white with the marker's colour as an inner ring, with the label in italics and a tooltip that says
which it is in words — *"the component's point, not this pin's — not confirmed"*. Nobody should be
told we know where `CR-BP:12` is while being shown a guess. `LABEL_SIDE` is now the eight-way
compass lookup the old single constant said it would become, driven by `place.label_dir`, and the
editor offers the eight sides plus an explicit "auto" as a 3×3 control.

### Measured

- `/api/designators` on the real drawing: still 275 entries and 269 located, but **57,186 →
  79,780 bytes** with no `locations.json` at all. The 22 KB is `placement` on 178 components and
  terminals. That is the price of every marker being able to say how much it knows, on a
  same-origin fetch of highly compressible JSON, and it is worth it.
- With the scratch file below: 80,264 bytes.

### Verified against the real extraction

A scratch `locations.json` was written into `PS20115MLM4-2/extracted_docs/`, checked, and
**removed** — the repository still has no locations file, which is Job E's job.

| | before | after |
|---|---|---|
| `TB-PB2SP:1` | (196, 382) `parent` | **(154.5, 348.3)** `confirmed` — fault 1 |
| `CR-SW:14` | (861, 704) `parent` — the coil | **(569, 473)** `confirmed` — fault 3 |
| `CR-ON:A2` | (861, 464) `parent` | **(870, 468)** `confirmed` |
| `CR-SW` | one `seed` point | two places, `coil` and `contact` |

No `problems`, and `confirmed_sites: 3`. Also smoke-tested on scratch ports 9713 and 9714:
`health.editing` reports `{enabled, password_required, by}`; `/api/locations` is 401 without the
header and answers the skeleton with it; the wrong password is 401; and on a **default** server
both editor routes are **404**.

### Verified by machine, and what is not

**100 server tests** (was 67) and **93 web tests** (was 59); `ruff` and `tsc -b` clean; bundle
rebuilt into the gitignored `server/app/static/`.

`test_extraction_generator.py`'s byte-identical check is the load-bearing one: with no
`locations.json`, `circuit_logic.json` regenerates exactly as committed. That is what keeps
generated files fully generated and what made it safe to land the loader before a single point
existed.

**Not verified by machine, and it is the same gap this project has always had here: the gestures.**
jsdom has no `PointerEvent` at all — `fireEvent.pointerDown` delivers no `clientX` — so drag, pan
and pinch cannot be driven in a test. What is pinned instead is the mechanism: the arithmetic in
`paint.test.ts` against real numbers, and *which tab passes `onDragPoint`* in the component tests.
Whether dragging a dot feels right, and whether the hollow-versus-filled distinction reads at a
glance, wants a human with a mouse.

Also unverified by machine: that the editor is usable at 131-placements scale. The arithmetic says
under seven minutes at three seconds a click. That is a claim about a screen nobody has used yet.

---

## 2026-08-14 / 15 — Job A accepted; Job B attempt 1 rejected and archived

**This entry replaces an earlier one that claimed Job A and the fault 4 anchoring fix were
committed in `6e9276e`. Both claims were false — that commit touches neither `prompts.py` nor
`test_invocation.py`, and the anchoring fix was inside Job B's uncommitted `MarkerLayer.tsx`
diff. Checked against `git show`, not against the note. A commit claim in this file is worth
verifying before relying on it.**

**Two things in this entry have since been overtaken.** Job A *was* committed, by the user, in
`a9cda29` along with the fault 4 fix — so "uncommitted on `main`" below is no longer true. And the
fault table it points at lived in the plan section for Job B attempt 2, which became the
2026-08-16 entry above when that work landed; **all four faults are now closed**. Read the
2026-08-16 entry for the current state.

Three faults were reported against the entry below, and investigating them found a fourth. Fault 1
was not a one-off — the vision pass's coordinates are approximate everywhere, and on a sheet whose
conductor rows are 16 pt apart, approximate means "wrong row".

### The decision that shaped everything, and it was the user's

Asked whether to derive the positions better, the user said a **human should confirm every
point**, in a purpose-built screen, because the goal is a library of many drawings and a derived
point is a guess with no owner. They also required the editor to sit behind **its own password**
— permission to spend tokens and permission to edit the drawing are different permissions — and
corrected a wrong assumption of mine: `CR-BP` is drawn *three* times, so component shape is
per-drawing data and any fixed "coil + contact" schema is wrong on arrival.

They also asked how a second geometry file squares with the project's original rule that
`author_circuit_logic.py` is the only hand-edited file. Resolution: **there are now two authored
files**, and the generator reads the second one, so generated files stay fully generated.

### Job A — accepted, green, uncommitted on `main`

**Prose linking fixed at the cause, in `prompts.py`.** The reported answer said *"CR-ON's coil
(A1/A2)"*, which the old prompt permitted: it listed `A1`, `A2`, `11`, `14` as printed and said
printed ids "may be cited bare". Nothing there is clickable, because the viewer links a citation
only when it is a backticked identifier it can find in the drawing index.

Two rules were added to the Citation section: every terminal is written `` `PARENT:PIN` ``,
never a bare pin (this drawing has five terminals named `A1`, six named `11` and **thirty-one
named `1`**), and a component is backticked the first time a sentence names it. The prompt says
*why* — a backticked identifier is what the reader clicks — because a rule the model does not
understand is one it drops under pressure. One contradiction had to be fixed at the same time:
"may be cited bare" now reads "without the description — but still in backticks".
`test_terminals_must_be_cited_with_their_component` in `test_invocation.py` pins all four
strings, counts included, so a change to the extraction that moves those numbers fails there
rather than quietly weakening the argument.

**Not done and worth noting:** `PROMPT_VERSION` was not bumped, though the comparable prompt
edit on 2026-08-10 bumped it to `v1.1`. Decide that when Job A is committed.

### Job B attempt 1 — rejected, archived on `job-b-attempt-1` at `7003dfb`

Built: `locations.json` with validation and `resolve_geometry()`, a `places[]`/`sites[]` model on
`designator_index()`, client-side `placesOf()` and one-dot-per-place, `author_circuit_logic.py`
folding points in, and — the part that was rejected — `derive.py` plus
`scripts/seed_locations.py`, which proposed and ranked coordinates from net projection and
printed-label matching. 101 server tests and 63 web tests, all green, `ruff` and `tsc` clean.

The user rejected it on architectural grounds, not for failing its tests. The five reasons are
set out in full in the section above and should be read there; in short: it was fitted to one
drawing, an 11 pt median error on a 16 pt row pitch converts human work rather than saving it,
it moved some dots further from their components, guessing belongs at index time rather than in
the server, and it delivered the accelerator without the editor it was meant to accelerate.

Two bugs the real drawing caught during that attempt, recorded because they are evidence for the
rejection rather than problems to fix: `CR1:11` was proposed at its coil, 400 pt wrong, because
net `0V` passes nearby; and `CR-SW`'s remote-only proposal deleted its main block, which is the
reported fault inverted. Both needed a special-case rule to suppress, and both rules were
particular to this sheet.

### The rollback, 2026-08-15

Branched `job-b-attempt-1` off `main`, committed Job A alone as `beb85a7` so it could be
restored independently, then committed Job B and these notes as `7003dfb` with the rejection
recorded in the commit message. Returned to `main` and restored Job A's two files. Job B's six
new files left the working tree with the branch switch — they were tracked on the branch, so no
`git clean` was needed and nothing was unrecoverable at any point. **The archive commit is what
made every later step reversible; uncommitted work is the one state git cannot recover.**

`main` verified after the rollback: 67 server tests, 58 web tests, `ruff` and `tsc` clean.
`main` is still at `6e9276e` and `origin/main` has not moved. **Nothing was pushed, at the
user's instruction: the remote is the last chance to reach a working state.**

### Fault 4 restored on its own, after the rollback

The rollback re-opened fault 4, because the anchoring fix had been sitting inside Job B's
uncommitted `MarkerLayer.tsx` diff rather than in `6e9276e` where the old entry claimed it was.
It was then restored **by itself**, on the argument that it is pure DOM structure with no
drawing-specific logic in it and therefore had no reason to wait for the editor. Only the
anchoring change was taken from `7003dfb`; Job B's `placesOf` flattening, per-place keying and
placement states were deliberately left on the branch. Details are in the fault table at the top.

Worth keeping as a working habit: the test was verified to fail against the old structure before
being kept. A regression test that has never seen the bug red is an assertion, not a test — and
here it cost one scripted patch-and-revert to establish, on a fix whose whole symptom is
invisible without layout. `main` after it: **67 server, 59 web**, `ruff` and `tsc` clean, bundle
rebuilt.

One trap worth not rediscovering: **`server/app/static/` is gitignored**, so the built bundle
still held Job B's JavaScript after the rollback and git could not revert it. Rebuilt with
`npm run build`.

### Measured on PS20115MLM4-2, and still true regardless of Job B

- 47 components and 131 terminals; `/api/designators` publishes 275 entries (47 components, 131
  terminals, 26 nets, 71 wires), 269 with a point, ~57 KB.
- Screening the 41 located components against every wire endpoint, terminal dot and junction in
  `geometry.json`: median distance **11 pt**, **17 over 15 pt**, **10 over 25 pt**. Conductor
  rows are **16 pt apart**.
- Six ids have no point at all: the two off-page machines and the four referenced drawings.
  `TB-L1`, `CB1`, `TB-0V`, `TB-IINSP1` and `TB-IINSP2` are the components hardest to place.
- `TB-PB2SP`'s correct terminal dot is at (154.5, 348.3) — the row the user's green arrow
  pointed at, identified from their screenshot.

---

## 2026-08-12 — The answer and the drawing point at each other

Job 1 of the previous "Recommended next jobs", built as one piece because the halves are
worthless apart: a component overlay on its own is 47 dots nobody clicks, and clickable
citations on their own have nothing to point at.

**What a reader can now do.** An answer says *"the blue 18AWG wire from `CR-BP:A2` to the
BYPASS 5A breaker (extraction id `W048`)"*; clicking either backticked span switches to the
Drawing tab and flies the sheet to it. Going the other way, every component with a location is
a marker: clicking one says what it is — class, description, the nets it is on — for free and
with no model in the loop, and offers *Ask about this*, which puts a question in the composer
and switches back. That is the loop closed in both directions.

### The five pieces, and the seams that matter

1. **`selection` lives in `appStore`, never in the viewer.** `{kind, id, origin, nonce}`. The
   `nonce` is bumped on every selection including a repeat, because clicking the same citation
   twice must re-pan — by then the reader has usually dragged the sheet elsewhere, and a silent
   no-op reads as a broken link. `origin` is the field that was not in the plan and turned out
   to be needed: the viewer flies to a selection raised from *text* and deliberately does not
   fly to one raised by a click *on the drawing*, because you do not move the sheet under
   someone who has just put a finger on it. Net highlighting, the net explorer and guided
   troubleshooting all read this same field; putting it in the viewer would make every one of
   them reach inside a component.

2. **`/api/designators`** — new endpoint, `drawing.py`'s `designator_index()`. 275 entries for
   this drawing (47 components, 131 terminals, 26 nets, 71 wires), 269 of them with a point,
   57 KB uncompressed. Each entry carries `label` (one human line), `members` (the components
   it is drawn through), `point`, `rect`, `aliases` and `on_sheet`.

   *Points are derived, not stored.* `components[].location` is the only geometry this
   extraction has, so a terminal borrows its parent component's point, a wire spans its two
   endpoint components, and a net spans every component it touches. `rect` is that bounding
   box and is what the viewer frames — which is why selecting net `110` zooms *out* to show all
   five components it runs through, and selecting `CR-BP` zooms in. Six ids have no point at
   all (the two off-page machines, the four referenced drawings); they stay in the index,
   because a citation of one is legitimate and dropping it would make it unresolvable rather
   than merely unclickable.

   *Its own endpoint, not another field on `/api/drawing`.* Ten times the size of everything
   else there, and it is the one thing whose absence has to degrade quietly: a client that
   cannot load it gets plain-text citations, which is exactly what shipped before.

   *`on_sheet` mirrors `prompts.py`.* The prompt's "Names that are not on the drawing" table is
   now also four constants in `drawing.py`, and the file says outright that the two must change
   together. A `W###`, a `TB-…:<n>` point number and a `RECEPT1:<n>` pin are ours; the UI marks
   them *our id*, because a clickable label the reader cannot find on the sheet in their hands
   is worse than an unclickable one.

3. **`panTo(rect)` on `useTileViewport`** — the inverse of `zoomAt`. The destination is two
   pure exported functions, `focusScale` and `centreOn`, because that is the part that can be
   wrong: too far in and you land on blank paper, too far out and the thing you clicked is a
   dot among fifty. A point target gets half of native zoom (≈4 pt lettering readable, about a
   quarter of the sheet visible); a rectangle is framed with padding. The flight is animated —
   interpolating the *centre in PDF space* and the scale geometrically, so the target stays
   under the middle of the container the whole way — and any deliberate gesture cancels it,
   including the pointer going down. `prefers-reduced-motion` gets the jump.

4. **A `code` renderer in `Markdown.tsx` → `Citation.tsx`.** The prompt already requires
   citations in backticks, so the hook was free. **Strictly an allowlist lookup, never a
   pattern**: `W999` has the exact shape of a wire id and stays inert, because "the model wrote
   something that looks like an id" is not evidence. A span is clickable only if the server
   published it, it has a point, and there is a Drawing tab to click through to; otherwise it
   renders exactly as before. `lib/designators.ts` holds the two lookup rules the real
   extraction forces: ids beat aliases (`MXCS-M9` is both a component and an alias of another),
   and an alias two components both claim is dropped rather than arbitrated (three are — "switch
   relay", "run bypass relay", "24E-1 terminal"). Flying someone to the wrong relay
   authoritatively is worse than not flying them anywhere.

5. **`MarkerLayer.tsx`, a DOM sibling of the canvas.** Markers need hit-testing, focus, tab
   order and tooltips, all free in the DOM and hand-rolled in canvas — and the canvas is
   `pointer-events-none` precisely so this can sit on it. The opposite call still stands for net
   highlighting: 149 polylines need none of that and are cheaper painted. Positions go through
   `pointToCss`, which is `paint.ts`'s own `tileDestRect` divided by the device-pixel ratio;
   there is one projection in this application, and a marker that computed its own could drift
   off the component it names. A *Components* toggle turns the other 46 off; the selected one
   and anything the selection runs through stay visible regardless, since hiding what an answer
   just pointed at is the one case the toggle must not cover.

### Two things worth knowing before touching this

**A new leaf module, `tabIds.ts`.** The ids used to be declared by the tab components
themselves, which was right while only a tab needed to name a tab. This job broke that:
`Markdown` → `Citation` → `DrawingTab` → `AskTab` → `MessageView` → `Markdown` is a cycle, and
this project has already lost an evening to exactly that failure (see `tabs.ts`'s header). A
leaf module with no imports of its own cannot participate in one. `DrawingTab` re-exports
`DRAWING_TAB_ID` so existing importers are unaffected.

**The composer prefill is a starting point, not a submission.** Clicking *Ask about this* types
the question and switches tabs; the reader presses Ask. Nothing in this job can spend money by
itself, which is the property to preserve when the net explorer starts raising selections too.

Tests: 66 server (up from 58) and 58 web (up from 31); `ruff` clean, `tsc -b` clean. The new
web tests cover the failure modes that are silent in a browser — an alias resolving to the
wrong component, a fenced code block turning into buttons, a marker rendering at the origin
because it used the wrong projection, and a citation that pans nowhere because the tab had
never been measured. Verified `/api/designators` against the real extraction on a scratch port:
275 entries, 269 located, 57,186 bytes.

**A running server does not pick this up.** The bundle is rebuilt into `server/app/static/`,
but `python -m app` has no reloader — restart it.

---

## 2026-08-11 — The drawing is sharp: a canvas at device resolution

Follows the entry below, same day. The user reported that lettering on the sheet was hard to
read and — the diagnostic detail — **magnifying did not help**, while the same drawing opened
through the *Source PDF* link was crisp.

**The tiles were never the problem.** A 1:1 crop straight out of `tile_r3c3.png`, no scaling,
is clean-edged; label text on this sheet has a median height of 4.13 pt, which at 400 DPI is
22.9 px. The resolution was on disk and was being thrown away between the file and the panel,
in three compounding places:

1. **`will-change: transform` on the scaled plane.** It promotes the plane to a composited
   layer, and the browser rasterizes such a layer once and then GPU-stretches the cached
   texture as the transform changes. Zooming magnified a bitmap rasterized at the *old* scale.
   That is what "magnifying does not help" means — it is the signature of this bug and not of
   an insufficient source, which is why the symptom was worth quoting exactly.
2. **Layer size.** At native zoom the plane was 6800×4400 CSS px, past the maximum texture
   size on most GPUs, which forces a reduced-scale rasterization and a stretch back up.
3. **Everything was in CSS pixels.** On a 2× display even a correct rasterization was upscaled
   once more before it reached the panel, and the toolbar's "100%" was already a 2× enlargement
   at the moment it claimed native resolution.

### What replaced it

`TileSheet.tsx` no longer positions 16 `<img>` elements under a CSS transform. It paints them
onto a **canvas whose backing store is sized in device pixels**, re-rasterizing from the source
PNGs every frame. A canvas has no composited-layer cache to go stale, no layer bigger than the
viewport, and no CSS-pixel indirection — all three mechanisms are removed rather than mitigated.

- **`features/drawing/paint.ts`** — new, and pure. `tileDestRect()` projects a PDF-point
  rectangle onto the backing store; `paintSheet()` clears, fills the paper white, sets
  `imageSmoothingQuality = 'high'` (at fit zoom a 2.4 Mpx tile is reduced to ~140 kpx, and the
  cheap filter turns 4 pt lettering into grey mush), and draws the tiles that intersect the
  viewport. No DOM in the file, which is what makes the arithmetic testable — jsdom has no 2D
  context to assert through.
- **Origins are rounded to whole device pixels; sizes are not.** At native zoom a tile's
  destination width is `(x1-x0) × dpi/72` = 2033.33 device px against a PNG the renderer
  rounded up to 2034 — so with the origin snapped, what remains is a third of a pixel of
  resampling in place of a 2× stretch. Rounding the size too would not close that gap and would
  drift the geometry off the point grid the overlay work depends on.
- **`useTileViewport` is device-aware.** It takes `dpi` rather than a precomputed
  `nativeScale`, derives `nativeScale = dpi / 72 / dpr`, tracks the container's CSS size for
  the backing store, and exposes both. A new `useDevicePixelRatio()` re-arms a
  `(resolution: Ndppx)` media query on change, because dragging a window to a monitor of
  different density changes the ratio with no resize and no re-render to notice it.
- **"100%" now means one tile pixel per *device* pixel** — the sharpest these rasters go. On a
  2× display the same fitted view that used to read 11% reads 23%, and the 200% ceiling is a
  genuine 2× enlargement instead of a hidden 4×.
- **Off-screen tiles are skipped.** Worth saying plainly: this saves nothing at fit zoom, where
  the whole sheet is on screen and all 16 are drawn. It is most of them once you zoom in.
- **The `<img>` elements survive as loaders**, hidden and never composited. They are how the
  browser fetches, decodes, caches and reports `load`/`error`; `new Image()` would buy nothing
  and lose the ability to assert on it. Tailwind's preflight carries
  `[hidden]:where(:not([hidden=until-found])){display:none!important}`, which beats its own
  `img{display:block}`, so the container is reliably invisible.

**The point-space seam is untouched.** `tileDestRect` is the same projection the CSS `left`/
`top` used to be, so a marker at `components[].location` or a conductor polyline from
`geometry.json` is still one line of arithmetic. Clickable overlays go in a DOM layer above the
canvas, which is why the canvas is `pointer-events-none`.

### Why not stop at the small fix, and why not go on to pdf.js

The plan offered three tiers. The cheapest — toggle `will-change` during gestures, correct the
DPR — was written up as "do this and measure". **There is no browser in this environment to
measure with**, so shipping a hypothesis and asking the user to re-test was the worse trade:
the canvas tier removes all three mechanisms by construction and its arithmetic can be verified
without a browser, which is exactly what was done.

pdf.js remains the right endpoint and is deliberately not in this change. It is a new
dependency, a CSP change (`worker-src 'self' blob:`) and worker bundling, none of which can be
exercised here — and the 1:1 crop shows 400 DPI is ample for reading this sheet. It stays in
the recommendations below, demoted to job 2 and rescoped from "make it legible" to "do not run
out of zoom".

### Verified

31 web tests (was 22) and 59 server tests pass; `tsc -b` and `ruff` clean; bundle builds.

The load-bearing verification is not the unit tests. `tileDestRect` and `paintSheet` were
**re-implemented line for line in Python and run against the real tiles** at native zoom
(`scale = 400/72`, dpr 1), compositing the four tiles that intersect a 1200×380 viewport
centred on the `GREEN 16AWG` run at (890, 434) pt. The output is crisp, correctly assembled and
seamless — that is the projection the canvas will use, checked against real pixels rather than
asserted about.

Nine new tests in `paint.test.ts` pin the properties that matter: destination size equals the
tile's own pixel count at dpr 1, 2 and 3; origins are integral; off-screen and not-yet-loaded
tiles are skipped; nothing is drawn before the container is measured. `DrawingTab.test.tsx`
gained a test that the canvas backing store is sized in device pixels, and its old assertion on
`<img>` `style.left` is gone with the CSS positioning it described.

`test-setup.ts` stubs `getContext` to return null — a real jsdom gap, and the viewer already
guards against it; the stub only keeps "not implemented" noise out of the output.

**Still not verified by machine: the gestures, and the perceived result.** No browser
automation here. The arithmetic is proven against real pixels; that the text now *looks* sharp
on the user's screen is for the user to confirm.

### One limit that did not improve

The ~169 MB of decoded bitmap is unchanged. The earlier note claimed a canvas would fix it
"since only visible tiles need be held" — that is wrong, and worth correcting rather than
quietly dropping: at fit zoom every tile is visible, so nothing can be released. Cutting it
needs either unloading tiles that leave the viewport when zoomed in, or pdf.js, which holds a
viewport-sized bitmap and nothing else.

**A running server does not pick this up.** The bundle is rebuilt into `server/app/static/`;
restart `python -m app`, or hard-reload if you already have the tab open.

---

## 2026-08-11 — One way to the drawing, and it is a tile viewer we own

The sheet moved from a full-screen PDF overlay into a **Drawing tab** that renders the 16
extracted tiles under one pan-and-zoom transform. Two duplicate buttons became none: the tab
itself is the control.

### Why there were two buttons, and why the answer was zero

They looked identical and were not. `AskTab.tsx`'s prominent *Show the drawing* lived inside
`Intro`, which renders only while `messages.length === 0` — it vanished at the first question,
which is precisely when a reader wants the drawing. `DrawingPanel.tsx`'s small *Drawing* was
always there but easy to miss. Keeping the prominent one would have kept the one that
disappears; keeping the small one would have kept the one nobody sees.

A tab trigger is both: persistent and prominent, and it costs no extra control. So both
buttons are gone, along with the full-screen overlay they opened. In their place the intro
carries one sentence — *"The sheet itself is in the Drawing tab above"* — which is text, not a
third button, and it only appears when the tab does.

### Why not a new browser tab

This was the user's question and the instinct was right, though not for the stated reason.
Same-origin browser tabs **can** talk to each other — `window.open()` returns a handle, and
`postMessage`, `BroadcastChannel` and `localStorage` events all work between them. Messaging
was never the obstacle.

The obstacle is that in a new tab (and in the old iframe) the thing drawing the schematic is
the browser's own PDF viewer, which is opaque: no DOM, no coordinate system, nothing to draw
on, no way to ask it where `CR-BP` currently is. That rules out the three highest-ranked ideas
in `webui_ideas.md` §2 — bidirectional citation, net highlighting and the component overlay —
all of which require owning the rendering surface. Hence the tiles.

The raw PDF is still one click away, as a link in the Drawing tab toolbar, for the two jobs it
is genuinely better at: printing, and a second monitor.

### The coordinate system was already there

The data audit that decided the approach, because it made the viewer cheaper than the road map
assumed. Three artifacts, one coordinate space — **PDF points, top-left origin, 1224×792**:

| Source | What it holds |
|---|---|
| `tiles/tiles.json` | 16 tiles, 4×4, each with its `pdf_rect` |
| `circuit_logic.json` | `components[].location{x,y}` — populated for **47 of 47** |
| `geometry.json` | 149 conductor polylines, 515 label bboxes, 98 symbols |

So the manifest is passed through to the browser **unconverted**, in points, and `scale` — the
one number that turns points into screen pixels — is the only conversion anywhere. A marker at
a component's location, or a highlighted conductor, becomes a sibling of the tiles needing no
registration step. A composite built offline at the fit scale, using exactly the arithmetic
`TileSheet.tsx` uses, reproduces the sheet seamlessly; the 30 pt tile overlap paints identical
pixels over itself and leaves no seams.

Also settled, in passing: `geometry.json` records `has_embedded_text: false` — every label is
OCR of stroked glyph geometry. So pdf.js would yield no text layer here either, which removes
its main advantage over the rasters. Tiles first was the right call, not merely the cheap one.

### What landed

**Server.**

- `drawing.tile_manifest()` reads `tiles/tiles.json` and normalises it: page size, DPI, grid,
  and per tile the `pdf_rect` in points plus pixel dimensions. Returns `None` unless the
  manifest parses, declares a positive page size, and names at least one PNG **that is on
  disk** — a half-rendered tile directory has to mean "no viewer", not "a viewer full of
  broken images". Tiles missing from disk are dropped individually.
- `/api/drawing` gained a `tiles` field carrying that manifest, so tab availability and the
  viewer's geometry arrive in the page load that was already happening. No second fetch, no
  loading state, ~2 KB.
- `GET /api/tiles/{name}` serves the PNG. `drawing.tile_file()` will only return a path the
  manifest itself lists, so the manifest is the allowlist and the filename in the URL cannot
  select anything else on disk. Verified: `tiles.json`, `../circuit_logic.json` and an
  unlisted `tile_r9c9.png` all 404.
- **The CSP exception is gone.** `/api/source` used to answer with `frame-ancestors 'self'` so
  the PDF could be framed. There is no iframe any more — the PDF is a link to a new tab, which
  framing rules do not touch — so `CSP_FRAMEABLE` and `FRAMEABLE_PATHS` were deleted and the
  policy is one blanket string again. Removing a live security exception the moment its reason
  expires is worth the five minutes.

**WebUI.**

- `features/drawing/useTileViewport.ts` — the pan/zoom engine. The viewport is three numbers,
  `screen = point × scale + offset`, held as an explicit transform rather than a scroll
  position, because "pan to `CR-BP`" cannot be expressed against a scroll position. Wheel zoom
  about the cursor, drag to pan, two-finger pinch, double-click, `+`/`-`/`0`/arrows, and
  auto-fit that survives a window resize until the reader takes control. It is a hook, not a
  component, because the tile layer and the overlay layer that comes next need the same
  transform and only one of them can own it.
- `features/drawing/TileSheet.tsx` — the 16 PNGs, absolutely positioned in points, under one
  `translate3d`/`scale`. No rendering code, as §2 promised.
- `features/drawing/DrawingTab.tsx` — toolbar (zoom, fit, live zoom percentage, tile-load
  progress, source-PDF link) and the viewport.
- The tab is `keepMounted`, so pan and zoom survive a trip back to Ask — but it therefore
  mounts at first paint, and 2.2 MB of rasters must not land on someone who never opens it.
  So the tiles are **armed on first activation**: nothing is fetched until the tab is opened
  once, and nothing reloads afterwards.
- Deleted: `components/SourceDrawing.tsx` and its test, and `sourceOpen` from the store.

**The zoom percentage means something specific.** 100% is one tile pixel per CSS pixel — the
sharpest the rasters go — so it is a percentage of the extraction's own resolution rather than
of anything arbitrary. Overzoom is capped at 200%; below 50% of the fit scale you cannot go.

### An import cycle, found by the new test and fixed rather than worked around

`App.test.tsx` has warned since day one that `tabs → AskTab → appStore → TABS` is a real cycle
surviving on the order modules happen to be evaluated in. Adding a second tab collected on it:
`DrawingTab.test.tsx` imports the component first, so `tabs.ts` built its registry mid-cycle
and produced `{id: undefined, Component: undefined}` — a blank screen with no error.

Reordering the test's imports would have hidden it. Instead the cycle is gone: `appStore` no
longer imports the registry. It used `TABS` for two things — an initial `activeTabId` and a
hydrate-time check that a persisted id still exists — and `App.tsx` already had to reconcile
the id against the *enabled* tabs regardless (the Drawing tab is disabled when there are no
tiles). `activeTabId` now starts empty, `App` resolves it in one place, and `tabs.ts` carries
the rule as a comment: it imports tab components and nothing imports it back. A tab that needs
its own id declares the constant itself, which is why `DRAWING_TAB_ID` lives in
`DrawingTab.tsx`.

### Verified

59 server tests (was 50) and 22 web tests (was 19) pass; `ruff` clean; `tsc -b` clean; the
production bundle builds. Against the real drawing on a scratch port 9702: `/api/drawing`
reports 16 tiles, 4×4, 400 DPI, 1224×792 pt; `/api/tiles/tile_r1c1.png` returns 146,715 bytes
of `image/png` at 1867×1267 with an hour of cache; the traversal cases 404.

New server tests cover the point-not-pixel contract, a tile absent from disk, a manifest with
no page size (which is exactly the shape
`test_source_drawing_follows_the_tile_manifest` writes), and five traversal attempts. New web
tests cover the three failures that are silent in a browser: fetching 2.2 MB before the tab is
opened, tiles positioned in the wrong units, and a missing `tiles` field producing a tab full
of 404s instead of no tab.

**Not verified by machine: the gestures.** There is no browser automation in this environment,
so wheel-zoom-at-cursor, drag-pan and pinch have unit tests around the maths but no end-to-end
proof. They want a human with a mouse and, ideally, a tablet.

### Known limits, recorded rather than fixed

- **~169 MB of decoded bitmap.** The 16 tiles total 42.1 megapixels, and at fit zoom every one
  of them is on screen, so viewport culling would save nothing in the default view. Fine on a
  desktop, plausibly a problem on a phone. The real fix is a downscaled overview image swapped
  for the tiles above a zoom threshold — which means the extraction emitting one.
- **Softness past 100%.** The rasters are 400 DPI and that is the ceiling; the source-PDF link
  is the answer for anyone who needs more.
- **`geometry.json` net labels are OCR and not quite `circuit_logic.json` net ids** — `LI-A`
  for `L1-A`, `OV.` for `0V`, `130.` for `130`. Joining them needs a normalisation pass, and
  every conductor that fails to match is a finding about the extraction. This matters for net
  highlighting, not for this change.

**A running server does not pick this up.** Restart `python -m app` to get `/api/tiles`.

---

## 2026-08-10 — Claude stops naming things the user cannot see

One file changed: `server/app/prompts.py`. `PROMPT_VERSION` → `v1.1`.

**The problem.** The extraction had to invent identifiers for things the drawing never names —
above all the 71 wire ids `W001`–`W071`, which appear nowhere on the sheet. The prompt then
*instructed* the model to use them: *"Cite identifiers for every claim: wires as `W047`."* So
answers came back in a private vocabulary. An electrician holding a printed sheet could read
"W047" and have no way to find it.

A second concern was raised alongside it — that the user does not know these entities exist and
so cannot ask about them. It dissolves once the first is fixed: if the invented names never
lead, there is nothing the reader needs to learn in order to ask a good question. That is why
this landed as one prompt change and not as a naming-glossary tab, which was designed and then
deliberately dropped.

**What the prompt now says.**

- A new `# Names that are not on the drawing` section, a five-row table of the *kinds* of id
  that are ours: `W###`, terminal-block point numbers, the inferred `RECEPT1`/`INFEED1`/
  `DISCHARGE1` pin numbers, `CABLE-*`/`SUB-*`, and the `NET-PB1`/`NET-PB2` renames. Five rules
  cover every invented id on this sheet, which is what lets the citation rule work with no new
  artifact beside the drawing.
- `# Citation` rewritten. Printed ids may still be cited bare. An invented id may never lead
  and never stand alone: colour, gauge and both endpoints first, ours in parentheses — *"the
  blue 18AWG wire from `CR-BP:A2` to the BYPASS 5A breaker (extraction id `W048`)"*. Terminal
  points are described positionally; connector pins are flagged as inferred on first use.
- The troubleshooting-path example carried a bare `W048` and would have contradicted the new
  rule on the one output shape most likely to be read at 2 a.m. The arrow now carries the
  spec: `CR-BP:A2 →[BLUE 18AWG, W048]→ BYPASS-CB:2 ─[BYPASS 5A]─ BYPASS-CB:1 → net 120`.

**Why the id survives in parentheses rather than being suppressed.** Three reasons, and the
first is the one that decided it. The `## Sources` rule and "a sentence that names no identifier
is an opinion" both depend on a claim being retraceable to a specific row of `wires[]`; removing
the ids loosens the thing the whole epistemics design rests on. Second, all 71 wires do have
unique `(from_terminal, to_terminal)` pairs — so a *complete* description is a unique key and
the id is strictly redundant — but prose compresses, and "blue 18AWG on the 24E-1 bus" matches
seven wires. The id is insurance against the model's own abbreviation, not against ambiguity in
the data. Third, it is the natural anchor for click-a-citation-to-highlight later, and it keeps
`acceptance.py`'s `re.findall(r"W\d{3}")` checks working unchanged.

**Two wrong facts caught while writing the prompt,** both worth recording because a wrong
example in a prompt teaches a wrong fact. `W047` is `CR-ON:A2 → TB-110:3` on net 110 — the
CR-BP-to-BYPASS wire is `W048`. And `RECEPT1:3` is the **black** RUN conductor: blue is pin 3
in the standard M12 cordset code, but this drawing's pin numbers are drawing order, so the
standard colour does not apply.

**Verified.** 50 server tests pass, `ruff` clean, rendered prompt inspected in full. Acceptance
run against v1.1 on Sonnet: `_claude_notes/webui_acceptance/20260811T001556Z-sonnet.md`,
4 passed / 2 failed, $0.39. Run on a throwaway loopback instance on port 9701 with
`SWUI_DEMO_PASSWORD=` and `SWUI_RATE_LIMIT_ENABLED=false`, because `acceptance.py` sends no
password header and the 3-per-10-minutes limit cannot pass a six-case run.

**Both failures are false negatives in the checkers, not regressions.** The answers are right;
the probes miss the wording:

- `net-125-troubleshoot` / *is not fooled by the green lamps.* The answer says the lamps
  *"do **not** prove the CR1 or CR2 relay contacts downstream actually closed"* — correct, and
  it names the trap explicitly. The check looks only for `does not prove` / `proves nothing` /
  `doesn't prove`, so plural "do not prove" slips past it.
- `breaker-ratings` / *does not call them protection.* The answer says *"they protect nothing;
  they just make/break a control path"* — correct. `_no_unnegated_protection()` scans 90
  characters after the match for a negation, and its list has no `nothing`; the window also cuts
  off just before the word. The function's own docstring warns about precisely this failure
  direction — marking a correct answer wrong — and it has now done it.

Left unfixed deliberately: loosening a test oracle to make a run go green is a judgement about
acceptance criteria, not a detail of this change. The two needle lists are the fix if wanted.

**The change itself is doing its job**, visible in the net 110 answer: terminal-block points
now read *"3rd point on the 110 terminal block (`TB-110:3`)"*, and connector pins carry the
warning — *"infeed connector pin 1 (`INFEED1:1`; pin numbering is inferred, not printed)"*.

One gap to watch. In a **table**, the model still puts the bare id in the leading `Wire`
column, with colour, gauge and endpoints in adjacent columns. Everything findable is on the
row, so it reads fine — but it is not what "never lead with an identifier" literally says. If
this matters, the rule should say tables are exempt when colour, gauge and both endpoints are
adjacent columns, rather than being left ambiguous.

**A running server does not pick this up.** Restart `python -m app` to load the v1.1 prompt.

---

## 2026-08-10 — Light theme, the source drawing, and a readable intro

Three user-experience changes to the WebUI, plus this file.

**Light theme.** `webui/index.html` no longer sets `class="dark"` on `<html>`, and it now
declares `<meta name="color-scheme" content="light">` so the browser's own furniture — form
controls, scrollbars — comes up light rather than dark. The `.dark` palette in `index.css` is
untouched and still complete: adding a toggle later means putting that one class back on
`<html>`, nothing more.

One palette value had to move with it. `--warning` and `--success` are used as *text* colours
at 11px (the "no revision" badge, the spend line), and the dark theme's bright amber and green
sit at roughly 2:1 contrast on a near-white background. Both are darkened in the `:root` block
only; the `.dark` block keeps its brighter values, because there they are correct.

**You can now see the source schematic.** `webui_ideas.md` §2 asks to see the drawing, and the
answer to "is this right?" was previously "open the PDF yourself, out of band". Added:

- `GET /api/source` — serves `source_docs/*.pdf` inline. Free, static, no model call.
- `drawing.source_document()` resolves which PDF that is: the name in `tiles/tiles.json`
  first, then a filename matching the drawing number, then a lone PDF. With several unrelated
  PDFs and nothing to disambiguate them — which is exactly the state of
  `ModLinx/source_docs/` — it returns `None` rather than guessing, and the endpoint 404s.
- `/api/drawing` gained a `source` field (`{name, bytes, media_type}` or `null`) so the UI can
  decide whether the button exists at all. Optional on the client type, so an older server
  degrades to no button instead of a broken one.
- `components/SourceDrawing.tsx` — a *Show the drawing* button in the intro and a compact
  *Drawing* button in the always-visible drawing bar, both opening one full-screen overlay
  with the PDF in an iframe. Escape closes it; there is an "Open in a new tab" escape hatch.

Two decisions worth keeping:

*The browser's PDF viewer, not the tiles.* The 148 KB source is vector, so it out-zooms the
400 DPI rasters and costs no rendering code. The tile viewer in `webui_ideas.md` §2 — 16 tiles
under one CSS transform, component overlays, bidirectional citation — is still the right thing
to build, and this does not stand in its way; it becomes "show me the real drawing,
unannotated" once the tile viewer is a tab.

*One CSP exception, deliberately narrow.* The blanket `frame-ancestors 'none'` is enforced on
the **framed** document, so leaving it on the PDF response would have shown a blank rectangle
with a console error and no obvious cause. `/api/source` alone answers with
`frame-ancestors 'self'`; every other directive is unchanged, and the policy is now one
`CSP_BASE` string in `main.py` so the two variants cannot drift. A test asserts both halves.

**The intro reads as four things instead of one grey wall.** The block above the composer ran
the drawing title, what the model reads, and what it does when the sheet has no answer
together as consecutive muted paragraphs — three independent ideas with nothing separating
them. Now the 20-word all-caps title sits in its own card under a "Drawing PS20115MLM4-2"
label, and the two notes are separate dashed-border sections headed *What it is reading* and
*When the sheet has no answer*. Same words, four distinct blocks.

Tests: 50 server and 19 web tests pass; `ruff` clean. Four of the web tests are new
(`SourceDrawing.test.tsx`) and cover the two quiet failures — a button that opens an empty
overlay, and an absent `source` producing a button that 404s. Verified `/api/source` against the
real drawing on a scratch port — 151,164 bytes, `application/pdf`, `inline`,
`frame-ancestors 'self'`.

**A running server does not pick this up.** The bundle is rebuilt into
`server/app/static/`, but `python -m app` has no reloader — restart it to get `/api/source`.

---

## Before this log

Summarised from `git log` and the notes, for continuity. Detail lives in the plan documents.

- **2026-08-07** — `schematic_skills/` extraction pipeline, the first indexed drawing
  (`PS20115MLM4-2`), and `webui_ideas.md` + `webui_v1_plan.md`. Later that day: the skill got
  its own venv, an MIT licence with the vendor PDFs carved out, and three corrections to the
  plan where it claimed a reproducibility the OCR does not have.
- **2026-08-09** — the server and WebUI of `webui_v1_plan.md`: FastAPI over headless Claude
  Code, NDJSON answer streaming with real cancellation, the free deterministic drawing panel,
  spend ceiling and rate limits, and a tab registry built so the road map's tabs are additions
  rather than rewrites. Then the demo password and the Unlock control in the header.
- **2026-08-10** — documentation brought in line with the shipped code.

---

# Recommended next jobs

*Rewritten 2026-08-12, after bidirectional citation landed. This section is the standing
recommendation and gets rewritten, not appended to. The previous job 1 was "make the answer and
the drawing point at each other"; it is done, and the entry at the top of this log records it.
The previous job 2 (render the vector PDF) is unchanged and has been demoted to job 3, because
two things now stand in front of it.*

**Read `NEXT UP — Job B, attempt 2` at the top of this file first. The Locate editor comes
before every job listed here** — the three jobs below all present ids and fly the sheet to
them, and all three are worth less while the points they fly to are unconfirmed estimates.
Nothing in this section is stale, but none of it is next.

## 1. Deterministic browse: the net explorer and the tables

`webui_ideas.md` §4, ranked second in the road map and second in this section for the last two
sessions. It goes first now for a reason that only became true this session: **it was the
strongest idea that did not exploit the surface we had built, and now it is the strongest idea
that does.** A row in a net table is a `selection`; the store already carries one, the viewer
already knows how to fly to it, and the markers already know how to ring it. What was a table
last week is a table wired into a drawing this week, for no extra work.

The case for it is otherwise unchanged and still the strongest on the list: it is free, it is
instant, and **every question it answers is a question nobody pays $0.64 for.** §12 of
`HowToUseThisSkill.md` is a 71-question bank, and a large fraction of it — what is on this net,
what lands on this terminal block, what does this relay switch, what are the breaker ratings,
what is in this cable — is a table lookup that a language model is a slow and expensive way to
perform.

### The shape of it

1. **A `Browse` tab** — one new file plus one entry in `tabs.ts`, which is what that registry
   exists for. `DrawingTab.tsx` is the worked example of a second tab and `DrawingPanel.tsx` is
   the worked example of the register to write in.
2. **Server endpoints beside `designator_index()`** — the same shape and the same file. Nets
   with their member terminals and wires, components with their terminals, cables with their
   member wires. Half the groundwork is already there: `designator_index()` established the
   pattern, the `on_sheet` flag, and the id spaces.
3. **Every id in every table is a selection.** Clicking `CR-BP` in a table must do exactly what
   clicking `CR-BP` in an answer does — `select(kind, id)` then switch to the Drawing tab. The
   seam takes `origin: 'text'` for this; that is what it is for.
4. **Answer the counting trap in the layout, not in prose.** Net 110 has 4 wires and 8
   terminals. A net view that shows those as two separate labelled counts makes the trap
   structurally impossible to fall into, which is better than warning about it.
5. **Say which ids are ours.** `/api/designators` already carries `on_sheet` per id and the UI
   already has the *our id* chip for it. A table of `TB-0V:1..12` without that mark is a table
   of numbers the reader cannot find on the sheet in their hands.

### Files to read for this job

| File | Why |
|---|---|
| `schematic_extraction/PS20115MLM4-2/extracted_docs/circuit_logic.json` | The whole thing — the tables *are* the feature. `relationships[]` (402 of them) is the part no view uses yet. |
| `.../EXTRACTION_NOTES.md` | The seven flagged inferences. Anything a table states as fact and the notes flag as inferred needs the caveat carried into the UI. |
| `schematic_skills/references/HowToUseThisSkill.md` §12 | The 71-question bank these tables are meant to displace. Build for the questions that are actually in it. |
| `server/app/drawing.py` | Where the endpoints go, and `designator_index()` as the pattern to copy — including why it is a separate endpoint and how `on_sheet` is derived. |
| `server/app/main.py`, `server/tests/test_api.py` | The endpoint and its tests; `tests/conftest.py` for the miniature extraction, which now carries a located component, an unlocated one, aliases and a terminal block. |
| `webui/src/tabs.ts`, `webui/src/tabIds.ts` | How a tab is added, and the no-cycle rule — read both headers before importing anything into anything. |
| `webui/src/components/DrawingPanel.tsx` | Already answers §12 Q21–Q25 deterministically; the tone and density to match. |
| `webui/src/stores/appStore.ts` | `selection` and `byToken`. A table raises the first and can resolve labels out of the second rather than refetching. |
| `webui/src/lib/designators.ts` | `KIND_LABEL`, `suggestedQuestion` and the lookup rules. A table that wants "ask about this" should reuse the question wording, not invent a second one. |

## 2. Highlight the net, on the drawing

`webui_ideas.md` §2's third part, and the direct completion of what just shipped. Selecting net
`110` currently frames the region and rings the five components it runs through; what it does
not do is show the copper. `geometry.json` has 149 conductor polylines in the same point space,
and `paint.ts` already paints in that space — so the drawing side is genuinely small.

**Read this before planning it, because the data does not fully cooperate.** Of the 149
conductors: 70 carry a `net_label` at all, and only 47 of those match a net id in
`circuit_logic.json` exactly. Normalising the OCR (`LI-A`→`L1-A`, `OV.`→`0V`, `130.`→`130`,
`"GND`→`GND`) recovers a handful more; the remaining 79 have no label whatsoever, and some of
what is labelled is noise (`U`, `YY`, `+4`, `C4E-1`). By length, labelled conductors are about
15,400 pt of 21,400 — **roughly two thirds of the copper, not all of it.**

That is not a reason to skip the job. It is the reason to design it honestly:

- Highlight what joins, and **say what did not**. "38 of the 71 wires on this net are drawn
  here" is a true and useful statement; silently lighting up two thirds of a net and letting
  the reader assume it is all of it is the failure mode this whole project is built against.
- **Do not synthesise geometry.** Drawing a straight line between two component points because
  no conductor joined would be inventing a wire route, and the netlist's authority rests on
  never doing that.
- Every conductor that will not join is a finding about the extraction, and the list of them is
  worth having on its own — it is the first real audit of the OCR pass since it ran.
- Paint the polylines into the canvas, not the DOM. They need no hit-testing, focus or
  tooltips, and 149 of them as DOM nodes would be the opposite call from the markers for the
  opposite reason. `MarkerLayer.tsx`'s header states the rule.

### Files to read for this job

| File | Why |
|---|---|
| `schematic_extraction/PS20115MLM4-2/extracted_docs/geometry.json` | `pages[0].conductors[]` — `points`, `net_label`, `spec_label`, `color`, `gauge`, `length`. Count the joins yourself before writing any code; the numbers above are the whole risk of this job. |
| `.../circuit_logic.json` | `nets[]` and `wires[]` — the join target. `wires[]` carries colour, gauge and net, so `spec_label` is a second possible join key where `net_label` is missing. |
| `server/app/drawing.py` | Where a conductor endpoint belongs, and `designator_index()` as the precedent for deriving geometry server-side rather than shipping 608 KB of raw vector to the browser. |
| `webui/src/features/drawing/paint.ts` | `tileDestRect` and `pointToCss`. A polyline is the same projection applied to a list of points; there must not be a third. |
| `webui/src/features/drawing/TileSheet.tsx` | Where the paint happens, and the rAF coalescing a highlight must not fight. |
| `webui/src/features/drawing/MarkerLayer.tsx` | The DOM-vs-canvas rule, stated in its header with the reasoning. |
| `webui/src/stores/appStore.ts` | `selection` — already carries `kind: 'net'`. Nothing new is needed in the seam, which is the point of having built it. |

## 3. Render the vector PDF, so zoom does not run out at 400 DPI

**Unchanged from the last two sessions, and still not urgent.** The canvas paints the tiles at
full device resolution and a 1:1 crop of the source is crisp, so the sheet reads properly. What
is left is a ceiling: past 100% the viewer is enlarging 400 DPI rasters, and the *Source PDF*
tab — the browser re-rasterizing 148 KB of vector at whatever zoom you ask for — does not have
that ceiling.

**The change.** Render the PDF page with pdf.js onto the canvas `TileSheet.tsx` already owns, at
`viewport.scale × devicePixelRatio`, re-rendering when the zoom settles. Keep the tiles as the
instant first paint and as the fallback for an extraction with no source PDF beside it, which
`source_document()` already reports as `null`.

**Nothing above the paint layer changes** — and that now includes the marker overlay and the
citation seam, both of which project through `paint.ts` and are indifferent to what filled the
pixels underneath. It is also cheaper than what ships today: 148 KB of vector instead of 2.2 MB
of PNG, and a viewport-sized bitmap instead of the ~169 MB of decoded raster recorded as a known
limit — the one thing the canvas did *not* fix, because at fit zoom no tile can be released.

**Two things to know before starting.** This PDF has `has_embedded_text: false` and so yields no
text layer — still true, still irrelevant to rendering quality. And pdf.js parses in a worker,
so `CSP_BASE` needs `worker-src 'self' blob:`; nothing else in the policy moves.

### Files to read for this job

| File | Why |
|---|---|
| `webui/src/features/drawing/TileSheet.tsx` | Owns the canvas, the paint effect and the rAF coalescing. Its header records why the `<img>` plane became a canvas — context for not undoing any of it. |
| `webui/src/features/drawing/paint.ts` | A pdf.js render lands as another source in `paintSheet`, not as a parallel code path. |
| `webui/src/features/drawing/paint.test.ts` | What is currently guaranteed about the projection, including the marker case. Add to it rather than around it. |
| `webui/src/features/drawing/useTileViewport.ts` | `nativeScale`, `useDevicePixelRatio`, and the `MAX_OVERZOOM` ceiling this job lifts. Note that `focusScale` expresses the citation zoom as a fraction of native, so raising the ceiling changes where a citation lands unless it is rescoped. |
| `webui/src/features/drawing/DrawingTab.tsx` | The zoom readout, its tooltip and the footer all state the 400 DPI ceiling in words. |
| `server/app/main.py`, `server/tests/test_api.py` | `CSP_BASE` gains `worker-src`; two tests assert on the CSP string. |
| `webui/index.html`, `webui/vite.config.ts` | The CSP meta tag is duplicated into the built bundle and must not drift from the server's; the pdf.js worker needs a bundler entry. |
| `_claude_notes/webui_v1_plan.md` §3.4 | Where the CSP rules come from. Changing them without reading it is how the reasoning gets lost. |

## The runner-up, and why it is not first

**Extracting `PS10115MLC2-2.pdf` and linking the sheets** (§5) is still the biggest capability
unlock available — it turns *"you cannot tell from this sheet"* about net `130` and `CR-SW` into
a real answer, and the PDF has been sitting in `ModLinx/source_docs/` unextracted the whole
time. It is not recommended first because it is an extraction job rather than a WebUI job: step
4 of the skill is deliberately interactive, so it is a session with a human in it, not a
feature. Worth scheduling as its own piece of work rather than deferring indefinitely.

Note that it has grown a second half since the citation work landed: a second sheet means the
server serves *two* drawings, and `/api/designators` becomes per-drawing — as does `selection`,
which would need to say *which* sheet it points at. Cheap to do now, expensive to retrofit after
a third consumer of the seam exists.

*Files to read:*
`schematic_skills/references/HowToUseThisSkill.md` **first and in full** — §2.1 the artifact
order, §3.2 the exact commands that produced the existing extraction, §3.3 why step 4 cannot be
automated, §6 output locations, §7 the start-to-finish run, §7b the ready-to-paste prompts;
then `schematic_skills/SKILL.md` and `schematic_skills/references/circuit_logic_schema.md` and
`schematic_conventions.md`. The scripts in the order they run:
`schematic_skills/scripts/extract.py`, `render_tiles.py`, `build_kg.py`, `index_schematic.py`.
For the target: `schematic_extraction/ModLinx/source_docs/PS10115MLC2-2.pdf`. Use the completed
extraction beside it as the reference for what "done" looks like —
`schematic_extraction/PS20115MLM4-2/extracted_docs/author_circuit_logic.py` above all, since
corrections belong in that script and never in the JSON. On the WebUI side, `server/app/config.py`
is the single `drawing_dir` knob, and nothing else is hardcoded — but note that a second sheet
means the server needs to serve *two* drawings, which is a design change the v1 plan does not
cover.
