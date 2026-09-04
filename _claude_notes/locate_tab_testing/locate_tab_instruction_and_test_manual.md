# The editing and reading screens — instruction and test manual

*It began as the Locate tab's and now covers **four** screens: `Locate`, `Drawing`, `Ask` and — since
2026-08-25 — `Review`. **The directory keeps the name `locate_tab_testing/`** on purpose: dozens of
cross-references point at it and a rename costs more than it buys. The plan's §11 recorded that fork
and this is the honest title instead.*

**This file is the index. Read it first and read it whole; it is short on purpose.** Everything
else in this directory is a leaf document you pull in only when you need it, so that a session
troubleshooting one broken gesture does not have to hold the whole feature in context.

Two audiences, one document set:

- **The user**, learning to drive the Locate tab. Every test below is also a lesson: it says what
  to click and what should happen, so working through them in order teaches the whole screen.
- **A new Claude Code session**, troubleshooting it. The test ids are the vocabulary — the user
  reports *"T-142 failed, the dot landed about half an inch left"* and §"Where to look" plus
  `06_code_map.md` turn that into a file and a function without a search.


---

## 1. Start here, every session

    cd /home/js/schematics/server && .venv/bin/python -m app

Then open **http://localhost:9700/webui/** and click the **Locate** tab.
Editor password: **`edit-1234`** (in `server/.env` as `SWUI_EDITOR_PASSWORD`).

Three facts that have each cost a session already:

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab — and since 2026-08-25, no `Review` tab either.** It
   is in `server/.env` now. With it false the routes are never registered — that is deliberate, not a
   bug. The two editing tabs take the **same** password: both write an authored file, and that is one
   permission.
2. **`python -m app` has no reloader.** Any change under `server/app/` needs a restart.
3. **The client is a built bundle.** Any change under `webui/src/` needs
   `cd webui && npm run build`, *and* a server restart if the server changed too. A rebuilt bundle
   against an unrestarted server is the dangerous combination — the new client can send fields the
   old validator silently ignores.

Verify all four tests pass before blaming the UI:

    cd server && .venv/bin/python -m pytest -q; .venv/bin/python -m ruff check .; \
      cd ../webui && npx vitest run; npx tsc -b --noEmit

Expected right now: **172 server, 318 web, ruff clean, tsc clean** *(2026-09-03, after Session 6 —
the last session of the wires-and-nets plan; it was 157 and 251 after Session 5, 141 and 232 after
Session 4, 117 and 192 after Session 3, 117 and 185 after Session 2, 111 and 155 after Session 1,
and 106 and 127 before that)* — except
that
`test_the_committed_artifact_is_exactly_what_the_generator_writes` is red whenever `locations.json`
has moved ahead of `circuit_logic.json`. That is **K6** doing its job, not a failure; re-run the
generator (§5) and it goes green. **A review run cannot cause it** — that is Session 4's acceptance
criterion (T-740), and if the artifact test goes red after correcting a label, something is very
wrong.

---

## 2. What the Locate tab is for, in one paragraph

`circuit_logic.json` records where each component is, but those coordinates came from a vision pass
and are approximate everywhere — median error 11 pt on a sheet whose conductor rows are **16 pt
apart**, so "approximate" means "wrong row", and a dot on the wrong row names a different circuit.
A better guesser was built and rejected: at that accuracy a proposal must be audited, auditing
costs what placing costs, and it costs more when the proposal is confidently wrong. So the rule is
**the indexing pass gets one chance to guess, and after that a human owns the positions.** The
Locate tab is where that human works, and `locations.json` is the file that records who said so.

## 2a. And what the Review tab is for, in one paragraph *(added 2026-08-25)*

The same argument, one layer down. This PDF has **no embedded font text** — `geometry.json` says so
itself — so every string on the sheet was read by OCR off the *shapes of the strokes*, and the
extraction flagged **278** of its own results as doubtful on 2026-08-03. Nothing had ever read that
list. It matters because 30 of the 70 printed net names came back at confidence 0.4 and nine of them
are wrong, which is why only **17 of 26** nets can be matched to a printed conductor — the comparison
Session 6's path finder is built on. So the Review tab is a queue of 664 readings with the **ink on
screen beside each one**, and `label_corrections.json` records what a person said the paper actually
says. It corrects a *reading of the sheet* and never the netlist, which is already right: T-740 is the
test, and it compares bytes.

---

## 3. The documents in this directory

Read the index (this file) plus **only** what the symptom calls for.

| File | What is in it | Pull it in when |
|---|---|---|
| `01_screen_and_vocabulary.md` | The screen, region by region; every button, badge and dot style; the words *site*, *pin*, *seed*, *parent*, *label*. | Always, on a first read. Any report about something *looking* wrong. |
| `02_tests_place_and_drag.md` | **T-100–T-1xx.** Picking a row, click-to-place, the advance, dragging a dot, the pan-versus-place rule, the flight ceiling (T-115), and (T-190) the Drawing tab's five layer switches. | Anything about a point landing in the wrong spot, or not landing — or about the sheet moving, or refusing to. |
| `03_tests_sites_and_pins.md` | **T-200–T-2xx.** Components drawn more than once, adding/renaming/removing sites, assigning pins to sites. | Anything about `CR-BP`, `CR-SW`, multiple dots, or pins. |
| `04_tests_labels.md` | **T-300–T-3xx.** Wire and net label points, the eight label sides, and (T-335) whether the side you chose survives to the Drawing tab. | Anything about a label, or about wires and nets. |
| `05_tests_save_and_recover.md` | **T-400–T-4xx.** Autosave, the Save button, restart, refusals, the `problems` strip, regenerating `circuit_logic.json`, **(T-426) the Ask tab keeping the reader's place across `F2`**, and **(T-470–T-490) `Ctrl+Z` and the `Shift`+arrow nudge**. | Anything about work not persisting, or a red strip, or a marker you did not mean to move, or a tab that came back in the wrong place. |
| `09_tests_net_membership.md` | **T-500–T-530.** What a net is made of, and where its highlight goes: rings on **terminals and only terminals**, the member roster on the selection card, the way **back** to it, *place it*. **Drawing tab, no password.** | Anything about a net or wire highlight marking the wrong place — or too much. |
| `10_tests_end_labels.md` | **T-550–T-590.** A label at both ends of every wire and at every net terminal, on by default and costing nothing: the two-ended compass, the per-member net list, `hidden`, **Reset to default deleting rather than writing**, three labels on one pin, and the `Wires`/`Nets` filter split. **Both tabs.** | Anything about a wire's or net's name on the sheet, or about `locations.json` growing lines nobody asked for. |
| `11_tests_drawing_list.md` | **T-600–T-650.** The Drawing tab's list of all 275 designators: the order, the four filter buttons, the search box, the collapse · **the list filters the list and the switches filter the sheet, and neither touches the other** · five switches · a net selected without spending a question (`K9`) · **and all of it with `SWUI_ALLOW_EDITS=false`**, which is the acceptance criterion. **Drawing tab, no password.** | Anything about finding a designator, about the list and the sheet disagreeing, or about a row doing something to the drawing you did not ask for. |
| `12_tests_label_corrections.md` | **T-700–T-740.** The new **`Review`** tab: 664 readings the extraction lifted off the paper, the 278 it doubted itself, and the third authored file — `label_corrections.json`. Worst-read first · the ink ringed beside the row · `All readings` · `not a label` as `null` · **Reset deleting** · and **T-740, the netlist not moving**. **Needs the editor password and a restart.** | Anything about a misread label, a run with no net name, or a correction that did not stick — or the artifact test going red after a review run. |
| `13_tests_paths_highlight.md` | **T-800–T-840.** A wire highlighted **along the PDF's own conductor strokes** rather than between its ends: `GET /api/paths`, the stroke on the canvas, a net as the union of its wires' runs, the highlight surviving its own layer switch, and the two triggers — an Ask-tab citation and an armed row on the Locate tab. **It begins with a hand edit**, because the path editor is Session 6 and without one there is nothing to look at; the document says so and says what to keep. **Both tabs; the highlight itself needs no password.** | Anything about a wire's route: nothing highlighted, the wrong conductor highlighted, a highlight that vanishes when a switch is pressed, or `locations.json` refusing a path you pasted. |
| `14_tests_path_editor.md` | **T-900–T-960.** The path editor: the ranked candidate runs and what each row's tags mean, one click to accept, `Add a run` across a crossover hop, **Clear** and re-pick, the conversion an extracted run needs before a corner may be dragged, **Trace** with all four keys, *no path on this sheet*, the `Paths` filter and the count that reaches 71 — and **`K10`**, which was worth two nets. **T-910 is the acceptance criterion**: the ranking has to reproduce the four pairings measured by hand in `07_drawing_facts.md`. **Needs the editor password and a restart.** | Anything about a candidate list — nothing offered, the wrong run at the top, a route that will not clear, a corner that will not move, or the count and the filter disagreeing. |
| `06_code_map.md` | Every behaviour → the file and function that owns it. The data flow end to end. The known hazards, with reasoning. | Always, when troubleshooting. Never needed to *run* a test. |
| `07_drawing_facts.md` | The concrete ids and coordinates on `PS20115MLM4-2` the tests refer to — relay pin lists, the three `CR-BP` sites, `W048`, net `110`. | When a test names an id and you need to know what it is. |
| `08_results_log.md` | Every test id in a table, blank, for the user to mark up. | **A troubleshooting session should read this first** — it says what is actually broken. |

**Do not read** `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.
`07_drawing_facts.md` exists so that never becomes necessary.

*Since 2026-08-25 the **server** reads `geometry.json`, for the Review tab, and that changes nothing
about the line above.* `server/app/ink.py` narrows it to named fields behind an `lru_cache` and the
route narrows it again, so 620 KB becomes a 119 KB payload of 664 readings and **the file itself
reaches neither the browser nor the model** — `prompts.py` §3 still forbids it. If you need a number
out of it in a session, get it with a `python3 -c` one-liner that prints a summary. Hazard **H17**.

---

## 4. How to report a result

Mark each test in **`08_results_log.md`** as you go — it has every test id in a table and is the
first thing a troubleshooting session should read. For anything that does not match, fill in this
block there:

```
TEST:      T-142
EXPECTED:  (paste the "Expected" line from the manual)
GOT:       (what actually happened, in your words — be literal)
SCREEN:    save badge said ____ · zoom said ____% · filter was ____
FILE:      (paste locations.json, or the part that changed, if relevant)
```

The four extra lines matter more than they look:

- **the save badge** separates "the UI did nothing" from "the UI did it and the write failed";
- **the zoom** because labels on the sheet are hidden below 30% (`01_screen_and_vocabulary.md` §Dots);
- **the filter** because a row vanishing from *To do* is usually correct behaviour;
- **the file** because it is the actual deliverable, and the UI is only a way to write it.

`locations.json` lives at
`schematic_extraction/PS20115MLM4-2/extracted_docs/locations.json` and is small enough to paste
whole.

---

## 5. State of the system, 2026-08-19 — with the file counts refreshed 2026-08-24 in §5a

**Read §5a for what is actually in the files.** This section is the history of the screen and is
kept as it was written; its numbers for `locations.json` went stale the moment a real placement run
happened, and §5a is where they now live.

**Ten changes to the screen since the tests above were first walked**, none of them touching
what gets written into `locations.json`:

1. The **advance starts off** (`01_screen_and_vocabulary.md` §The advance checkbox, T-120, T-150).
2. The **list is alphabetical by id** under every filter, and the advance walks that same order
   (§The list, T-100, T-150).
3. The **target panel is set apart from the list** — accent edge, shaded ground, shadow over the
   list (§The target panel).
4. The **site-name box takes a whole word** and refuses a bad name visibly. That is **K3, fixed**
   (T-220).

The last four are all one change of mind, made 2026-08-19: **a flight is asked for, never inferred
from the target having changed.** Every one of these was the same effect keyed on the row's id,
and the id is not enough to say where to go.

5. The **list scrolls the armed row into view** whenever the target arrives from somewhere other
   than a click in the list — a dot, the advance, a site button (T-180).
6. **Clicking a dot arms *that* dot's site** and closes in on it, rather than arming the first
   site the component happens to have and flying there (T-215).
7. **Picking a row that is drawn in more than one place fits the whole sheet**, so all of its dots
   are on screen at once instead of one of them filling the view (T-215).
8. The **`place` / `placing` buttons fly to their site** — including the one already armed, which
   is **K1, fixed** (T-215, T-110).

The ninth came from the Drawing-tab work later on 2026-08-19 and is not this tab's, but it is
visible from here and it changes how a placement run feels:

9. **`F2` crosses to the Drawing tab and back**, from anywhere, including with the caret in a
   site-name box. The armed target, the draft and each tab's own pan and zoom survive the trip
   (§The sheet in `01_screen_and_vocabulary.md`, **T-425** — a new test, not yet walked). The same
   session gave the Drawing tab its own `Escape`, which is why there are now two `window` Escape
   listeners and one new hazard, **H10**.

The tenth is not this tab's either, and it was asked for **from this manual** — §6 below is where the
gap showed up:

10. **The Drawing tab shows the same three groups this tab filters by** — `Components`, `Terminals`
    and `Wire & net labels`, in its own toolbar, in those words. It drew components and nothing else
    before, so `F2` could check a *component* from the reader's side and never a **pin**, which is
    131 of the 178 placements. One deliberate difference: they are **independent switches** rather
    than one exclusive choice, because a reader's question is a comparison — *is that pin on the same
    conductor row as its relay?* — and both halves have to be on screen at once. Only `Components`
    starts on, so the tab looks exactly as it did until you ask for more. **T-190** and **T-360** are
    the new tests, neither walked. It also fixed a fault nothing on screen would have shown you: a
    click on the sheet used to raise every marker as `kind: 'component'`, so a clicked pin would have
    entered the store as a component with a terminal's id. New hazard **H11**.

**Three more, later on 2026-08-19, all asked for after a real placement run.** The first two are
this tab's neighbours and the third is this tab's own:

11. **The Drawing tab's three switches are filled when they are on.** Any combination of them is
    legal, so *which filters are in effect* has to be readable on all three buttons at once; it was
    `aria-pressed` and a slightly brighter word, which is a state a screen reader could report and a
    person could not see. **T-190** gained a paragraph.

12. **The label side reaches the Drawing tab.** `DISC1:L1`–`L3` were placed with their labels west
    and came out east — the default — because the index publishes `places` only when it says
    something `point` and `placement` cannot, and "one dot" was read as "says nothing". `label_dir`
    lives nowhere else in the payload, so 269 of the 275 entries dropped the one thing about the dot
    a human had chosen by hand. `_entry` in `server/app/drawing.py`; **T-335** is the new test, and
    it is **the only server change in this group**, so it needs a restart.

13. **Past 50% zoom, nothing flies.** Picking a row, the advance, a site button and a dot all still
    *arm* exactly as before, but the sheet does not move — neither magnification nor position. 50% is
    where a flight lands, so from closer in every flight is a zoom out, and past it you are normally
    at a magnification you chose in order to work on one dot you can already see. At 50% and below
    nothing changed. **T-115** is the new test; the ceiling is one constant read from `FOCUS_ZOOM`.

    tests             106 server (105 green + the stale artifact one), 127 web, ruff
                      and tsc clean. Eight of the web tests are the Drawing-tab work of
                      the same day (F2, Escape, the component question, and a v1.2
                      prompt), five more are the layer switches of change 10, and
                      three are changes 11–13; change_history.md 2026-08-19 has all of
                      them. What moved in here: isTextField now lives in
                      webui/src/lib/keys.ts, FOCUS_ZOOM is exported from
                      useTileViewport.ts, hazards H10 and H11 are new, and T-115,
                      T-190, T-335, T-360 and T-425 are new tests nobody has walked.

### 5b. Session 1 of the wires-and-nets plan, 2026-08-24

Two changes, both of which make what already existed correct rather than adding a screen. The plan
is `_claude_notes/highlighting_wires_and_nets.md`; this was **Phases 0 and A**, and §13 there says
what the remaining five sessions are.

14. **`Ctrl+Z`, and `Shift`+arrows to nudge an armed point.** **`K8` is fixed.** A drag, a rename, a
    pin, a label side, an unplace — every mutation in the editor is undoable, fifty steps deep, in
    memory, cleared on load; `Ctrl+Shift+Z` redoes. The toolbar says what was undone in words
    (*"undid: moved `BYPASS-CB:1`"*) and the list arms and scrolls to the row it changed, because a
    silent undo on a 275-row document is invisible. `Shift`+arrow moves the armed point **1.0 pt**
    and `Shift`+`Alt`+arrow **0.1 pt** — in *points*, so the step is the same at 11% and at 400% —
    and **bare arrows still pan the sheet**. A run of nudges, or one drag however many frames long,
    is **one** undo step. Only a point the draft already owns will move: nudging a terminal drawn on
    its parent's dot does nothing, deliberately, because it would turn an estimate into a
    confirmation. **T-470–T-490** are the new tests, none walked. Two ideas were **rejected** and
    are recorded in the plan §9 so they do not creep back: a minimum-drag threshold, and a `rev`
    counter on the file.

15. **A net or a wire is highlighted as the terminals it is made of.** The reported fault —
    *"clicking `120` marks Bypass-CB, DISCHARGE1, INFEED1 and TB-120, but not CR2"* — was a ring on
    CR2's **coil** when the net's member is `CR2:14`, its NO contact 630 pt away, plus
    `TB-120:1/2/3` collapsing onto one component dot. `/api/designators` now publishes `terminals`
    on every wire and net: the membership itself, **in order and undeduped**, each member with its
    own point and its own `placement`. The selection card becomes a **roster** of those members with
    their state in the list's own words, each a click away from being flown to, and — only where the
    server has an editor — a **place it** link that arms that pin on the Locate tab. **This is a
    server change and needs a restart.** It costs **20 KB** on a 90 KB payload (22%), said out loud
    in `09_tests_net_membership.md`. **T-500–T-520** are the new tests, none walked.

    One thing worth knowing before Session 3: **selecting a net from the reader's side still needs a
    citation from an answer.** Nothing on the sheet raises a net, so T-500 costs one question. The
    Drawing tab's list, Session 3, is what removes that.

    tests             111 server, 155 web, ruff and tsc clean. New: a first
                      `webui/src/stores/locateStore.test.ts` (12), the keyboard in
                      LocateTab.test.tsx (9), the roster in DrawingTab.test.tsx (5),
                      `draftPoint` in model.test.ts (2), and five server tests across
                      test_api.py and test_locations.py. What moved: the three
                      placement words (`placed`, `estimate`, `on its component`) now
                      live once in `webui/src/lib/designators.ts` as
                      `PLACEMENT_LABEL`, imported by both the Locate list and the
                      Drawing roster; `useTileViewport`'s key handler declines a
                      *modified* arrow so a nudge cannot pan the sheet under the dot.

### 5c. Session 2 of the wires-and-nets plan, 2026-08-24

**Phase B, plus three corrections the user asked for after walking Session 1.** The plan is
`_claude_notes/highlighting_wires_and_nets.md`; §13 there says Session 3 is the Drawing tab's list.

16. **A label at both ends of every wire and at every net terminal — 265 of them, and none of them
    is work.** The side is computed from points already placed: away from the wire's other end, away
    from the centre of the rest of the net, snapped to eight, stepped clockwise past anything already
    written there. `locations.json` stores **only the exceptions**, and *Reset to default* **deletes**
    the override rather than writing the computed side back in — a default stored as though a person
    chose it makes the file stop distinguishing *nobody looked* from *somebody decided*, which is the
    distinction it exists for. **Schema 2**, and the migration is the version number: schema 2 only
    added a key, a 1 is still read whole, and the editor stamps 2 onto the draft as it loads. A wire's
    label shows its **spec** (`BLUE 18AWG`), because every `W###` is an id we invented and is printed
    nowhere. **T-550–T-590** in the new `10_tests_end_labels.md`, none walked. **Server change —
    restart needed.**

17. **`Wire & net labels` on the Locate tab became `Wires` and `Nets`.** Different work: a wire has
    two ends and a pair of compasses, a net has up to nine members and a list. The third toolbar
    count went with it — there is no `0 of 97 wire and net labels` any more, because that was a
    progress bar over something optional and therefore `K7`'s shape. It reads `71 wires · 26 nets · 0
    end labels moved by hand`. The `computed` row state is now **`ends known, no path`**: *"route from
    its terminals"* is the one thing a route may never be. **`K4` is narrowed** — the compass is live
    the moment a wire is armed, because its anchor already exists.

18. **A net marks its terminals and nothing else.** *"The components are also marked and this adds
    clutter and confusion."* Correct, and the reasoning that put them there confused **saying**
    something with **marking** it: the card still names all five under `runs through`. Net 120's seven
    pins were bringing five extra rings and five forced labels with them. **T-530**, and T-500's
    fourth expectation is amended.

19. **A way back to the roster.** A card reached from a roster row or a `runs through` chip carries
    **← back to `120`**, which re-selects the net and re-frames it. One step, not a history.
    **T-525**.

20. **The Ask tab comes back to the line you were reading.** It is the one tab that is not
    `keepMounted`, so every `F2` remounted it at the bottom of the answer — the reading loop undone.
    **T-426**.

*Not done, and withdrawn rather than deferred:* a shorter arrow-key nudge. The user asked for one and
then found `Shift`+`Alt`+arrow, which is 0.1 pt — the finest thing the file records — and withdrew the
request. `Shift`+arrow stays 1.0 pt. Worth knowing that the discoverability of the fine step was the
actual problem: it is in the footer strip and in T-490, and it was still missed.

    tests             117 server, 185 web, ruff and tsc clean. New: a first
                      `features/ask/AskTab.test.tsx` (3), `endLabels.test.ts` (13),
                      four end-label tests in `test_locations.py` plus two schema
                      ones, four in `LocateTab.test.tsx`, four in
                      `DrawingTab.test.tsx`, four in `model.test.ts`. What moved:
                      `SCHEMA` is 2 and lives in both `locations.py` (with
                      `READABLE`) and `model.ts`; `coverage()` no longer counts
                      labels; `_wire_spec` and `spec` are new on the wire entry;
                      `EndLabel` and `Locations.end_labels` are new; a member of a
                      wire or net may now carry `label_dir` and `hidden`.

### 5d. Session 3 of the wires-and-nets plan, 2026-08-25

**Phase C, and it is a pure client session** — no server change, no schema change, nothing written to
`locations.json`. The plan is `_claude_notes/highlighting_wires_and_nets.md`; §13 there says Session 4
is the label-corrections review screen.

21. **The Drawing tab has a list of all 275 designators down its left, and `K9` is fixed.** Read-only:
    a row click **selects**, through the same `select(kind, id)` a citation in an answer calls, so the
    sheet flies and the card names it. Four filter buttons (`Components` `Terminals` `Wires` `Nets`,
    **any combination, none of them meaning all**), a search box over the id *and* the one-line
    description, and a chevron that collapses the whole thing to a rail. **The buttons over the list
    filter the list; the switches over the sheet filter the sheet; neither touches the other** — that
    sentence is the design and T-620 is the test. It works with **`SWUI_ALLOW_EDITS=false`**, which is
    the acceptance criterion and T-650: the row state comes from `/api/designators`
    (`readerRowState`) and never from the editor's draft. **T-600–T-650** in the new
    `11_tests_drawing_list.md`, none walked.

22. **`Wire & net labels` on this tab became `Wires`, `Nets` and `Labels` — five switches.** The same
    split the Locate tab made a day earlier, plus one for the *text*: an end label needs its own
    kind's switch **and** `Labels`, because it is a label of a wire. The selection is still exempt
    from all of them (H11). **T-605**, and **T-190** now describes five.

23. **One list, two screens.** `features/locate/WorkList.tsx` moved to
    `components/DesignatorList.tsx` **unchanged** and both tabs import it — the row, the state words,
    the `our id` badge and the `scrollIntoView` are decided once. A new hazard **H16** records the
    other consequence of the session: two rows of buttons now carry the same four words, so each row
    is a labelled group (`Layers on the sheet`, `Filter the list`) and nothing may merge them.

    Whether the list is **open** is persisted (`appStore.drawingListOpen`); the filters and the search
    text are deliberately not.

    tests             117 server (unmoved — nothing server-side changed), 192 web,
                      ruff and tsc clean. Seven new in DrawingTab.test.tsx (42),
                      and every by-name button query in that file is now scoped to
                      one of the two labelled groups. What moved: WorkList.tsx →
                      components/DesignatorList.tsx; RowState now lives in
                      lib/designators.ts beside the new readerRowState and is
                      re-exported by features/locate/model.ts.

### 5e. Session 4 of the wires-and-nets plan, 2026-08-25

**Phase F.** A new tab, two new routes, three new server modules and **the third authored file**. The
plan is `_claude_notes/highlighting_wires_and_nets.md`; §13 there says Session 5 is paths on the
sheet. **Server change — restart needed**, and the client is a rebuilt bundle.

24. **The extraction's own doubts are on a screen, and the ink is beside them.** `geometry.json` has
    carried a `review_queue` since 2026-08-03 — **278 items** — and *nothing had ever read it.* The
    new **`Review`** tab is 664 readings: **515 strings** the OCR pass lifted off the paper and
    **149 runs** of conductor the vector pass lifted out of the PDF. The queue is **worst-read
    first**, the 150 blanks are grouped at the end because they need a decision rather than a
    correction, and the row your caret is in is **ringed on the sheet** — because correcting a
    transcription by reading the transcription is how a misread becomes a confirmed misread. There is
    no font in this PDF: `geometry.json`'s own `text_source` says *"every label must be verified with
    the vision pass"*, and **30 of the 70 printed net names came back at confidence 0.4.**
    **T-700–T-740** in the new `12_tests_label_corrections.md`, none walked.

25. **`label_corrections.json`, and it is not `locations.json`.** Three reasons, each sufficient: it
    keys on *extraction* ids (`T0012`, `C0080`) rather than designators; it is written from a second
    screen, so folding it in would widen the `K2`/`H1` last-write-wins window across two workflows;
    and it is a different claim — *what the ink says* against *where the thing is drawn*. Schema 1.
    `text` is required and may be **`null`**, which is *this is not a label* — `""` is refused **by
    name**, because it would read as *"I looked and there is nothing here"*, which is a claim about
    the ink. `was` keeps the machine's reading forever, since a re-extraction destroys the original.
    **Reset deletes the entry** rather than writing the reading back in (invariant 10 again, T-730) —
    but a **confirmation** *is* kept, and the distinction is exact: a label's side would have been
    computed anyway with nobody looking, and nothing produces *a person checked this* but a person.

26. **Correcting a label reaches every run that reads its net name.** `LI-A` → `L1-A` on `T0012` makes
    `C0030` read `L1-A` too, and the row says so — *reads `L1-A` via `T0012`*. This is the point of
    the phase: Session 6's matcher compares the **run's** printed name against a wire's net id, so a
    screen that fixed the label and left the run alone would have unlocked nothing. A correction on
    the run itself still wins, and is the only thing available for the **79 runs with no name bound at
    all** — which is more than the 30 misreads.

27. **The netlist does not move, and it is asserted in bytes.** `author_circuit_logic.py` does not
    read this file and must not start:
    `test_the_generator_output_is_byte_identical_with_and_without_a_corrections_file`. No `stale`
    banner, and the artifact test stays green after a review run — corrections are like paths and end
    labels, authored and free of regeneration. **T-740** is the acceptance criterion.

    One thing found while writing the tests and worth knowing before Session 6: **51 labels have a
    reading that differs from their own raw OCR, and only 2 of them are flagged.** Some of that
    tidying is right (`JRANGE 16AWG` → `ORANGE 16AWG`) and some is a step backwards
    (`BLACK 22 AWG` → `BLACK 22 AW6`, at 0.83, unflagged). That whole class is reachable only through
    **`All readings`**, which is why decision 3's *"editing all of them should be possible"* was not
    a nicety. **T-720.**

    tests             141 server, 232 web, ruff and tsc clean. New: a whole
                      `tests/test_review.py` (24), a first
                      `features/review/model.test.ts` (21) and
                      `features/review/ReviewTab.test.tsx` (19). New files:
                      `server/app/ink.py` (the reduced read of `geometry.json`),
                      `server/app/label_corrections.py` (the file, and the join),
                      `webui/src/features/review/{ReviewTab.tsx,model.ts}`,
                      `webui/src/stores/reviewStore.ts`. New hazards **H17**,
                      **H18** and **H19**.

### 5f. Session 5 of the wires-and-nets plan, 2026-09-02

**Phases D and G.** A new endpoint, a new field in `locations.json`, and the first thing on this
screen that draws a *line* rather than a dot. The plan is
`_claude_notes/highlighting_wires_and_nets.md`; §13 there says Session 6 is the path editor — and
that the **small batch** at the end of §13 goes at the head of it, before Phase E. **Server change —
restart needed**, and the client is a rebuilt bundle.

28. **A wire can be highlighted along the ink, and a net is the union of its wires' runs.** Schema 2
    gains `path` on a wire: `runs` (a **list** of polylines, because a crossover hop is a real gap
    the highlight must show rather than close), `conductors`, and two provenance axes —
    `geometry: extracted | human` for *where the line came from* and `attribution: printed | human`
    for *who says it is this wire's*. **`derived` is refused by name on both**, which is §8's rule
    made enforceable rather than merely written down. A **net stores nothing**: a path under `nets`
    is refused by name, and its highlight is assembled from its wires every time it is drawn.
    `GET /api/paths` publishes the two maps, and it is **free of the editor password** — a path is
    authored display geometry out of `locations.json`, the ink loader is never opened, and *which of
    these lines is the one I care about* is a reader's question first (hazard **H20**).
    **T-800–T-840** in the new `13_tests_paths_highlight.md`, none walked.

29. **The stroke is 5 pt wide — in points, so it tracks the ink** — translucent so the conductor
    stays readable through it, with a 3 device-pixel floor so it survives the 11% fit. It is painted
    on the tile canvas rather than in the DOM (`paint.ts` `paintRuns`, through the same
    `tileDestRect` as every marker: invariant 2, one projection), under the markers and after the
    tiles. **One wire or one net at a time**, and the highlight is read off the selection alone, so
    it survives its own layer switch being off — `H11` again. Both triggers landed with it: an
    Ask-tab citation of a net paints it, and arming a wire or net on the **Locate** tab paints it
    too, which means you can now see the run while you place its pins.

30. **There is no path editor yet, so `13_tests_paths_highlight.md` begins with a hand edit.**
    Temporary scaffolding, stated as such in the document, with the exact blocks to paste and a step
    that asks what to keep. **Do it with the server stopped and no editor tab open** (`K2`/`H1`), and
    know that the editor will not eat it: every mutation rewrites the record it found, and
    `model.test.ts` has a test that says so.

    **A correction to the plan came out of writing it.** §6, §3, this manual's §8 and
    `07_drawing_facts.md` all paired **`W052` with `C0080`**. Measured against the terminal points
    placed on 2026-08-20 that is wrong: `C0080` is **`W053`**'s run (both ends within 1.7 pt of its
    pins) and `W052`'s is **`C0109`**. The plan was written using `CR2`'s coil as `CR2:14`'s
    position, which is where that pin resolved before anybody placed it — and that is also where its
    "600 pt diagonal" came from. Nothing in the code depended on it; `07_drawing_facts.md` now
    carries the measured pairings, because Session 6's ranking will be checked against them.

    **The proof of the phase, and it is worth doing once by hand:** save a path and
    `circuit_logic.json` stays current. No banner, no regeneration, artifact test green —
    `test_a_path_does_not_reach_the_netlist` compares the generator's bytes with and without one.

    tests             157 server, 251 web, ruff and tsc clean. New:
                      `tests/test_paths.py` (7) and `webui/src/lib/paths.test.ts`
                      (6), eight path refusals in `test_locations.py`, one in
                      `test_extraction_generator.py`, five in `paint.test.ts`,
                      five in `DrawingTab.test.tsx`, one each in
                      `LocateTab.test.tsx` and `model.test.ts`. New files:
                      `webui/src/lib/paths.ts` (`pathsFor` — the union rule, shared
                      by both tabs) and `13_tests_paths_highlight.md`. What moved:
                      `WirePath`, `_paths`, `_no_path` and `Geometry.paths` in
                      `locations.py`; `paths_index` in `drawing.py`;
                      `polylineToDevice`, `paintRuns` and `HIGHLIGHT` in `paint.ts`;
                      an optional `runs` prop on `TileSheet` (and `data-runs` on its
                      canvas, which is the only trace a test can read); `paths` in
                      `appStore`, refreshed with the designators because one save
                      moves both. New hazard **H20**.

### 5g. Session 6 of the wires-and-nets plan, 2026-09-03 — **the last one**

**Phase E, preceded by the six-item small batch at the end of the plan's §13.** A new endpoint
behind the editor password, a new pure module, a new panel, and the first screen whose whole job is
to write a `path`. The plan is `_claude_notes/highlighting_wires_and_nets.md`, and **it is now
built end to end** — Phases 0, A, B, C, D, E, F and G. **Server change — restart needed**, and the
client is a rebuilt bundle.

31. **The machine proposes a wire's route and a person accepts it.** Arm a wire and the panel offers
    a short **ranked** list of runs of ink, each tagged with why it is there: `both ends`, `one end`,
    `printed name`, `corrected name`, `spec`, `colour only`, `nearby`, `another net`, `suspect`.
    Hover one and it lights on the sheet in its own colour — a proposal must never look like a
    decision. Click to accept; `Add a run` continues a route across a **crossover hop**, which is
    why `runs` is a list and why the gap is drawn as a gap. **Nothing is ever accepted
    automatically**, not even for the 37 wires whose single candidate lands on both their pins, and
    every route this screen writes says `attribution: human`. **T-900–T-960** in the new
    `14_tests_path_editor.md`, none walked.

32. **The geometry outranks the printed name, and that is the opposite of what the plan's prose
    suggested.** A placed pin against a vector stroke is geometry against geometry with no reading
    of the paper in between; a printed name is *read*, and 30 of this sheet's 70 came back at
    confidence 0.4. The second reason is decisive on its own: **the second half of a real route
    routinely carries no printed name at all** (`C0092`, `C0057`), so ranking on the name would find
    one end of a wire and not the other. Measured against the real drawing, the ranking reproduces
    all four pairings in `07_drawing_facts.md` — including `W052` → **`C0109`**, which every
    document in the project had wrong for nine days.

33. **The numbers came out better than the plan predicted, because of your review run.** §13 said to
    expect 19 wires with one candidate, 33 with two or three and **19 with none**, and warned that
    smaller numbers would mean a broken ranking. Measured 2026-09-03: **37** wires have exactly one
    run whose two ends land on both their pins, **33** have a best candidate reaching one end (an L
    or a hop — two pieces), and **0** have no candidate at all. Only **3** have no printed-name *and*
    spec match, and two of those three (`W012`, `W015`) have no colour or gauge printed on them at
    all. **26 of 26 nets** now match a printed conductor.

34. **`K10` is struck, and it was worth two nets rather than two labels.** `drawing.py` publishes a
    net's *printed* name beside its id where the two differ (`printed_net`), the end label draws it —
    so `NET-PB1` reads **`PB1`** on the sheet, which is what a reader can check — and
    `candidates()` compares against **both** forms. `NET-PB1` and `NET-PB2` were the only two nets
    of 26 with no printed conductor for the matcher, while both of their printed names sat on a run.

35. **`no_path_on_this_sheet` finally has a control, and the count reaches 71.** Session 5 built the
    field and the validator; this is the screen that can say it. A wire leaves the new **`Paths`**
    queue two ways — a route, or a person saying there is none here — and the toolbar reads
    `n of 71 wire paths`. That is **`K7` avoided on purpose**, and it is worth holding beside `To do`,
    which still has six rows in it that can never be finished.

36. **An extracted run cannot be edited until it stops claiming to be the drawing's.**
    `geometry: extracted` is a claim about the polyline, so there are no handles on one; **Make it
    editable** converts it to `geometry: human` and drops the `conductors` list, because the run is
    no longer the run it was lifted from. New hazard **H21**. **Trace** is offered last on purpose —
    79 unlabelled conductors are real ink and beat a hand trace every time — and its four keys are
    click, `Backspace`, `Esc`, `Enter`, with nothing written until the last of them. `Esc` takes the
    **trace** before the armed row: new hazard **H22**.

37. **The small batch, at the head of the session and before Phase E.** Six items out of the 23
    questions you asked about the `Review` tab, and the same argument that put Phase 0 in front of
    everything. The `kind` badge is recomputed from the text you typed; a third scope,
    **`Not a label`**, lists all 279 of those decisions; the ✖ on a **run** row now says *no net name
    is printed on this run* and that it is **not a bookmark** — that wording cost 34 net names; a
    **note** box gives a bookmark somewhere honest to live, disabled until the row has a decision it
    can ride on; a **run is ringed along its own polyline** instead of the 206 × 215 pt box round its
    endpoints; and `build_kg.py` was re-run. **T-745–T-770** in `12_tests_label_corrections.md`,
    none walked. **No schema change**, and no correction moved.

    Two findings worth keeping. `custom_kg.json` **was never actually stale**: re-running the
    generator produced a byte-identical file, because `build_kg.py` emits no coordinates at all — the
    staleness was a timestamp. And **`points` left the *forbidden sections* list in `test_review.py`
    and joined the pinned key set**, which is the honest place for it: a polyline is published on
    purpose now, and what may not reach a browser is a section nobody narrowed. `H17` says so.

    tests             172 server, 318 web, ruff and tsc clean. New:
                      `tests/test_conductors.py` (13) and
                      `webui/src/features/locate/paths.test.ts` (19 — four of
                      them the measured pairings), plus 17 in
                      locate/model.test.ts (45), 13 in LocateTab.test.tsx (51),
                      12 in review/model.test.ts (33), five in
                      ReviewTab.test.tsx (24), one each in test_api.py,
                      test_review.py and endLabels.test.ts. New files:
                      `webui/src/features/locate/paths.ts` (the ranking, pure),
                      `PathPanel.tsx`, `PathHandles.tsx`, and
                      `14_tests_path_editor.md`. What moved: `Conductor.points`,
                      `Conductor.rect` (over every vertex now), `color`, `gauge`,
                      `length` and a new `Binding` in `ink.py`; `_traceable` and
                      `GET /api/conductors` in `main.py`; `printed_net` in
                      `drawing.py`; `Reading.points` in `label_corrections.py`;
                      `setPath`/`addRun`/`tracePath`/`convertPath`/
                      `movePathVertex`/`clearPath`/`setNoPath` and a path-aware
                      `rowState`/`coverage` in locate/model.ts; `classifyLabel`/
                      `labelKind`/`setNote` and a third scope in
                      review/model.ts; `CANDIDATE` in `paint.ts` and a
                      `candidates` prop on `TileSheet`; two new `RowState`
                      members, `traced` and `no-path`. New hazards **H21** and
                      **H22**.

### 5a. What is in the files, 2026-08-24

**The counts below replaced a stale block that still described 6 components and 18 terminals.**
A full placement run happened on 2026-08-20 and the manual did not hear about it. Re-measured
against the files, not remembered:

    locations.json    schema 1 on disk until the editor next saves, when it
                      becomes **2** — see §5c change 16; nothing else in the file
                      changes. The placement run is **finished for points**:
                      41 component ids over 47 drawn sites, every one source: human
                      131 terminals — **all of them** — each with its own point,
                        every one source: human
                      52 of those 131 carry a chosen label side; the other 79 sit
                        at the default
                      multi-site components: CR-BP, CR-SW, CR-ON, CR1, CR2
                      **"wires": {} and "nets": {} — no label points, no
                        end-label overrides, and no paths.** Those two sections hold
                        three different things and all of them being empty is the
                        *normal* state: 265 end labels are drawn from the terminal
                        points above and the file records only the ones somebody
                        overruled, while a `path` is authored one wire at a time.
                        **Session 5's pasted scaffolding is gone** — T-840 asked what
                        to keep and the answer was nothing, so `wires` is empty again
                        and Session 6's ranking had no answers of its own to check
                        against beyond the four measured in `07_drawing_facts.md`.
                        **Since 2026-09-03 there is an editor**: arm a wire on the
                        Locate tab, press `Paths`, and accept a run — no text editor,
                        no stopped server (`14_tests_path_editor.md`). **A net never
                        gets a path**: its highlight is the union of its wires'.
                      Consequence worth stating out loud, because the whole
                      wires-and-nets plan turns on it: every one of the 71 wires now
                      has two human-confirmed ends, and all 127 net member terminals
                      resolve to human-confirmed points.
    circuit_logic.json  26 nets · 71 wires · 131 terminals · 47 components.
                      Regenerated at commit 1ae36ce, and **behind locations.json in
                      the working tree right now** by one point, so
                      test_the_committed_artifact_is_exactly_what_the_generator_writes
                      is the one red server test. That is K6/H9 working, not a
                      failure — a save happened after the last regeneration. Fix it
                      with one command, and it is a human's command by design:
                      cd schematic_extraction/PS20115MLM4-2/extracted_docs
                      && python author_circuit_logic.py
                      Do not hand-edit it — it is generated.
    label_corrections.json  **Added 2026-09-02.** Schema 1, the third authored file,
                      written by the Review tab. **654 decisions over 664 readings** —
                      the queue has been worked end to end: 276 *not a label*, 272
                      confirmations, 106 corrected strings. The number that matters,
                      because it is what Phase E's matcher compares against: **24 of
                      the 26 nets now have at least one printed conductor carrying
                      their name, against 17 before the run**, and **70 of the 149
                      runs carry a usable net name.** That is the same count the
                      extraction started with and a different seventy: the seven
                      partial reads that were never names (4, U, +4, A, YY, 50, PBL)
                      are out and seven a person supplied are in.
                      The two nets not matched are NET-PB1 and NET-PB2, and that is
                      **K10** — the sheet prints PB1 and PB2 and the netlist prefixed
                      them — rather than a reading anybody can fix on that screen.
                      **Both of those printed names are now on a run**, so K10 is the
                      only thing between the matcher and 26 of 26.
                      34 of the 654 carry a `note`, which nothing in the UI can write
                      yet (small batch item 3): they are the two batches applied on
                      2026-09-02 and the note says what each is and why.
                      It is tracked and heavily modified against its last commit (90
                      entries committed, 654 in the tree). Authored content git cannot
                      regenerate, exactly like locations.json, so it wants a commit.
                      **Nothing regenerates from it and nothing needs to** — T-740, in
                      bytes.
    custom_kg.json    generated from circuit_logic.json by
                      schematic_skills/scripts/build_kg.py, and **re-run 2026-09-03**
                      (small-batch item 6). 693 chunks, 291 entities, 402
                      relationships — and the interesting part is that the output was
                      **byte-identical**: `git diff` showed nothing. It had looked a
                      placement run behind (dated 2026-08-03 against a
                      circuit_logic.json of 2026-08-25), and it was not, because
                      **build_kg.py emits no coordinates at all** — 0 occurrences of
                      `location` or `source: human` in 479 KB. It derives from the
                      netlist's connectivity and descriptions, which the placement run
                      did not touch. So the staleness was a timestamp rather than
                      content and the exposure was never real.
                      **The recipe is still two commands**, and this is the second:
                      cd schematic_extraction/PS20115MLM4-2/extracted_docs && python
                      ../../../schematic_skills/scripts/build_kg.py circuit_logic.json
                      -o custom_kg.json --pretty --validate
                      K6 and the artifact test cover only the first half, so run this
                      one after a regeneration — "probably unchanged" is not the same
                      as "checked", and it costs a second.
    server            not running; start it as in §1
    git               locations.json is tracked, and modified against its last commit
                      by exactly one point: BYPASS-CB:1 y 663.8 → 663.7, an accidental
                      0.1 pt drag on 2026-08-24. A tenth of a point against 16 pt
                      conductor rows is 1/160th of a row, and 663.7 is exactly the y
                      of C0080, the BLUE 18AWG run that lands there — so the
                      replacement is if anything a hair better than the original.
                      Recorded here because it is the accident that produced K8.
                      locations.json is authored content and the one thing here git
                      cannot regenerate, so commit it when a run of placement ends.

**The four label points that used to be here were deleted on purpose.** `W001` (231.1, 50.5),
`W002` (231.4, 66.9), `W047` (925.3, 516.2) and net `110` (926.3, 485.7) were placed 2026-08-18,
are present at commit `8f1ae5d`, and are absent from `1ae36ce` onwards. **The user removed them
deliberately and does not want them restored** (confirmed 2026-08-24). They are recorded here only
so that a future session finding the gap in the file's history does not go hunting for a bug, and so
the coordinates are not lost if they are ever wanted:
`git show 8f1ae5d:schematic_extraction/PS20115MLM4-2/extracted_docs/locations.json`.

**And they may not be coming back in this form at all.** The wires-and-nets plan replaces the single
`label_point` per wire — *where the name is printed on the run* — with a label at each end, anchored
to a terminal point that already exists. Whether the old `label_point` is still worth having after
that is **an open question the user has deliberately left open**, to be answered by using the new
thing rather than by guessing now. So do not treat an empty `"wires": {}` as work waiting to be
done; treat it as a decision not yet needed.

**This is not `K2`.** No save has been shown to lose anything. Git is still the only cross-session
undo the system has, which is why a run of placement should end in a commit — but that is prudence,
not a known fault.

**The editor is the only supported way to change `locations.json`.** Hand-editing it is not
forbidden — it is a text file, and being readable by a person is the point — but the editor holds
a whole-document draft in memory, so a hand edit made while a tab is open will be overwritten by
that tab's next save. See `06_code_map.md` §H1.

---

## 6. Where to look, by symptom

The first column is what the user says. Use this to pick one leaf document, not three.

| Symptom | Read | Most likely owner |
|---|---|---|
| No Locate tab at all, or no Review tab | §1 above | `SWUI_ALLOW_EDITS`; `tabs.ts` `isEnabled` — both editing tabs need it **and** tiles |
| A correction I typed on the Review tab did nothing | `12_tests_label_corrections.md` **T-710**, **T-730** | did you press `Enter` or the ✓? **Blur alone is deliberately not a decision** (`06_code_map.md` §H19), or tabbing through the queue would sign all 278 readings |
| I corrected a label and the conductor beside it still reads the old string | `12_tests_label_corrections.md` **T-710** | `label_corrections.py` `resolve_corrections` — a run's reading must follow the label its net name is bound from (`ink.net_label_source_of`), or Phase F unlocks nothing for the matcher |
| `label_corrections.json` grew a line nobody asked for, or lost one | `12_tests_label_corrections.md` **T-730** | *Reset* **deletes**; `""` is refused. `features/review/model.ts` `setCorrection` |
| The red strip on the Review tab names an id I do not recognise | `12_tests_label_corrections.md` — hand-editing | a correction keyed on something not in `geometry.json` is refused **by name**, because its symptom would otherwise be nothing at all. Same reasoning as `H14` |
| The artifact test went red after a review run | `12_tests_label_corrections.md` **T-740** | **that is a bug, not `K6`.** Nothing this screen writes can make `circuit_logic.json` stale; the generator does not read the corrections and a test asserts it in bytes |
| ~~A run of ink is ringed with an enormous box covering unrelated conductors~~ | `12_tests_label_corrections.md` **T-765** | **Fixed 2026-09-03** (small-batch item 5). A run is drawn along **its own polyline** now and a label keeps its exact bbox. It was min/max over the run's two *endpoints*, which for 19 of the 149 did not even contain the ink — `C0057` goes out to x = 798 while its ends span x 429.8–598.9. If a **run** is still a filled box, the bundle is stale: `npm run build` and restart |
| No candidate runs are offered for an armed wire | `14_tests_path_editor.md` **T-900**, and the panel says which it is | *"The extracted ink did not load"* means `/api/conductors` failed — check `SWUI_ALLOW_EDITS=true` and that the tab is unlocked. An **empty list** is a real answer: no run is near either pin and none carries the net name. `Trace by hand` still works either way, and so does everything else on the screen |
| The candidate at the top of the list is the wrong conductor | `14_tests_path_editor.md` **T-900**, **T-910** | worth a report, with the wire id and the run you expected. `features/locate/paths.ts` `candidates` is the whole ranking and `paths.test.ts` pins the four pairings measured in `07_drawing_facts.md`. **Note the order is geometry before printed name**, on purpose |
| I cannot drag a corner of a highlighted route | `14_tests_path_editor.md` **T-925**, then `06_code_map.md` **§H21** | it is `from the ink`, and that badge is a claim about the polyline. Press **Make it editable** — which converts it to `geometry: human` and drops the conductor ids, because the run stops being the run it was lifted from |
| `Esc` cleared the armed row when I meant to abandon a trace | `14_tests_path_editor.md` **T-930**, then `06_code_map.md` **§H22** | the trace had already ended. The **first** `Esc` takes the corners and leaves the wire armed; the second disarms. A text field still gets the first one of all |
| The `Paths` count and the `Paths` list disagree | `14_tests_path_editor.md` **T-940** | they cannot: `coverage().settled` and the filter share one predicate, `model.ts` `pathSettled`. If they do, that is a real fault |
| A net's end label says `NET-PB1` and the sheet says `PB1` | `14_tests_path_editor.md` **T-945** | that was **`K10`** and it is fixed: `drawing.py` `printed_net` publishes the printed form and `endLabels.ts` draws it. A stale bundle would show the old word |
| A run stops where it crosses another wire, and the rest of it is a different id | `_claude_notes/review_tab_questions.md` **Q16** | **that is the ink, and it is deliberate.** The extractor splits a conductor at every crossover hop — 88 of them, `EXTRACTION_NOTES.md` correction 5 — which is why the plan's `path.runs` is a **list** of polylines and why Phase E offers multi-select across a hop. `C0001` and `C0002` are one physical run with a 20 pt gap at y = 83.67 |
| The `kind` badge on a Review row disagrees with the text I just typed | `_claude_notes/review_tab_questions.md` **Fact 3**; plan §13 small batch item 1 | `kind` is `classify_label()` in `extract.py`, a **pure function of the text**, and `ink.py` calls it *"a hint for the reader, never a filter this server applies"*. The badge is just not recomputed after a correction. **There is nothing to author and no editor to build** |
| I marked a run *not a label* and its net name vanished from the matcher | `_claude_notes/review_tab_questions.md` **§2** | **working as designed, and the wording is the bug.** On a **run** row that button means *no net name is printed on this run*, and `corrected_text()` drops a `null` so Phase E never sees it. 34 net names were lost this way on 2026-09-01 and 31 put back. *Reset* (↺) takes the decision back |
| A wire or net I selected is not highlighted on the sheet | `13_tests_paths_highlight.md` **T-815** | **expected for 70 of the 71 wires.** The card says `no path yet` because nobody has traced one, and the path editor is Session 6. If the card says `highlighted` and the sheet does not, that is a real fault: `pathsFor` in `lib/paths.ts`, then the `runs` prop on `TileSheet` |
| I pasted a path into `locations.json` and nothing changed | `13_tests_paths_highlight.md` **T-800** | was the server already running? The parse is cached per process (`H2`) — restart it. Was the block under `"nets"`? A net stores no path and the red strip says so by name |
| The red strip names a path I hand-edited | `13_tests_paths_highlight.md` **the table at the end** | `locations.py` `_paths` — a run of one point, a coordinate off the page the file declares, or `geometry`/`attribution` outside their two words. **`derived` is refused by name on both axes**, and the whole path is dropped rather than half of it |
| The highlight is on a conductor, but the wrong one | `13_tests_paths_highlight.md` **T-810** | that is a judgement, not a bug — a path says which conductor a **person** said this wire is. Correct the block, or drop it and wait for Session 6's ranked candidates |
| The highlight disappeared when I pressed a layer switch | `13_tests_paths_highlight.md` **T-825**, then `06_code_map.md` **§H11** | it must not: the highlight is read off the selection alone. Same exemption as the rings and the end labels |
| Password rejected, or the tab shows the lock forever | `05_tests_save_and_recover.md` T-400 | `main.py` `_require_editor`, `locateStore.unlock` |
| Stuck in placing mode — a dot stays red, the cursor stays a crosshair | `02_tests_place_and_drag.md` T-165 | the `Escape` effect in `LocateTab.tsx`; `TargetPanel.tsx` `Header` ✕ |
| `Esc` did something nobody asked for, on this tab or the other one | `06_code_map.md` **§H10** | there are two `window` Escape listeners since 2026-08-19 — this tab's and the Drawing tab's — and the `activeTabId` guard is all that separates them |
| The tab changed by itself, or `F2` does nothing | `01_screen_and_vocabulary.md` §The sheet, T-425 | the `F2` effect in `App.tsx`; it is not bound at all when the sheet was never tiled |
| The armed target or the zoom resets when I come back from the drawing | `05_tests_save_and_recover.md` **T-425** | `keepMounted` on both entries in `tabs.ts`; then `06_code_map.md` §H1 |
| Dot lands in the wrong place on the sheet | `02_tests_place_and_drag.md` | `paint.ts` `cssToPoint` — the projection |
| Click does nothing | `02_tests_place_and_drag.md` T-120 | the pan-versus-place rule in `LocateTab.tsx` `onClick` |
| Drag does nothing, or drags the sheet instead | `02_tests_place_and_drag.md` T-140 | `MarkerLayer.tsx` `onDragPoint` |
| A component gets one dot when it needs three | `03_tests_sites_and_pins.md` | `model.ts` `editorPlaces`, `nextSiteId` |
| A pin ends up at the wrong site | `03_tests_sites_and_pins.md` T-230 | `model.ts` `assignTerminal`, `siteClaiming` |
| A wire will not let me place it | `04_tests_labels.md` — this is **by design** | `model.ts` `LABELLABLE` |
| Label does not move to the side I picked | `04_tests_labels.md` T-330 | `MarkerLayer.tsx` `LABEL_SIDE`; place the point *first* |
| The side is right here and wrong on the Drawing tab | `04_tests_labels.md` **T-335** | `drawing.py` `_entry` — `places` must be published whenever a place carries `label_dir`, even a single one; `label_dir` lives nowhere else in the payload |
| The sheet will not fly to the row I picked | `02_tests_place_and_drag.md` **T-115** — check the zoom first | above 50% that is deliberate: `FLY_CEILING_PERCENT` in `LocateTab.tsx`. Below it, `flyTo`/`framing` (T-110) |
| Work disappeared | `05_tests_save_and_recover.md` T-440 | **`06_code_map.md` §H1** — read this before anything else |
| I nudged a dot by accident and want it back | `05_tests_save_and_recover.md` **T-470** | **`Ctrl+Z`** since 2026-08-24 — fifty steps, in memory. Reloaded since? Then it is git: `git diff` on `locations.json` names the point and its old coordinate exactly |
| `Ctrl+Z` does nothing | `05_tests_save_and_recover.md` **T-470** | is the Locate tab the tab on screen? There are three `window` key listeners now and the `activeTabId` guard separates them — `06_code_map.md` §H10. With the caret in a text box it is the *box's* undo, by design |
| `Shift`+arrow does not move the dot | `05_tests_save_and_recover.md` **T-490** | only a point the **draft owns** moves. A row reading `on its component` has a dot on screen and no point of its own, and nudging it would turn an estimate into a confirmation — `model.ts` `draftPoint` |
| A `Shift`+arrow pans the sheet as well as nudging | `05_tests_save_and_recover.md` **T-490** | `useTileViewport.ts` `onKeyDown` — it must decline a *modified* arrow. Narrowed to the arrows on purpose: `+` needs `Shift` to type |
| A net's highlight marks the wrong place, or fewer dots than it has members | `09_tests_net_membership.md` **T-500** | it must ring the **terminals**, not their parent components. `drawing.py` `_entry`/`_member` publish `terminals`; `DrawingTab.tsx` `relatedIds` must be built from them |
| A net's highlight marks **more** than its terminals | `09_tests_net_membership.md` **T-530** | `relatedIds` must be the member terminals **only** — the components are named on the card and not marked on the sheet, since 2026-08-24 |
| No way back after clicking a roster row | `09_tests_net_membership.md` **T-525** | `Selection.from` in `appStore.ts`, and `back`/`onBack` on `SelectionCard.tsx`. Only set when the selection came from another card |
| The Ask tab jumps to the bottom when I come back to it | `05_tests_save_and_recover.md` **T-426** | the `view` module state in `AskTab.tsx` — that tab is the one that is *not* `keepMounted`, so every `F2` builds a fresh one |
| A wire or net label is in the wrong place, or moves when I press a switch | `10_tests_end_labels.md` **T-555** | `features/drawing/endLabels.ts` — the plan is made over the **whole** index on purpose, so nothing about what is on screen can move a label |
| `locations.json` grew lines I did not ask for | `10_tests_end_labels.md` **T-570** | `model.ts` `setEndLabel` — *Reset* and *unhide* **delete**; the server refuses an override that says nothing |
| The compass on a wire or net does nothing | `10_tests_end_labels.md` **T-565** | not `K4` any more: an end label's anchor exists already. Check you are pressing the compass *in an end's row* rather than the one under it, which is for the printed name |
| A label I set is not on the sheet | `10_tests_end_labels.md` **T-575**, then **H7** | is that end **hidden**? Is the zoom below 30%? Is `dir` on a terminal the wire actually touches — the server names that refusal in the red strip |
| A wire has no end labels at all | `10_tests_end_labels.md` **T-590** — **expected** | two of the 71 have no colour and no gauge, so there is nothing printed to label them with, and `W###` is ours |
| The selection card lists components where I expected pins | `09_tests_net_membership.md` **T-510** | `SelectionCard.tsx` `MemberRow` — the roster reads `entry.terminals`, and a server older than 2026-08-24 does not send it |
| No **place it** button on a roster row | `09_tests_net_membership.md` **T-520** | either the row is already `placed`, or `health.editing.enabled` is false — which is correct on a reader's copy |
| `"wires": {}` and `"nets": {}` are empty — is that a fault? | §5a | **No.** Four label points were there and were deleted on purpose. Do not restore them, and do not read the empty sections as unfinished work |
| Red strip across the top | `05_tests_save_and_recover.md` T-430 | `locations.py` `parse`, `resolve_geometry` |
| Drawing tab still shows the old dot | `05_tests_save_and_recover.md` T-420 | `appStore.refreshDesignators` |
| The Drawing tab will not show me terminals, or wire and net labels | `02_tests_place_and_drag.md` **T-190**, `11_tests_drawing_list.md` **T-605** | its own **five** switches in the toolbar, `DrawingTab.tsx` `LAYERS` and `shown` — a group with nothing to draw has no button at all. An end label needs **two** of them: `Labels` and its own kind |
| I cannot tell which of the Drawing tab's switches are on | `02_tests_place_and_drag.md` **T-190** | filled means on since 2026-08-19 — the `variant` on the `LAYERS.map` buttons in `DrawingTab.tsx` |
| I cannot find a designator on the Drawing tab, or a net cannot be selected from the sheet | `11_tests_drawing_list.md` **T-600**, **T-610** | that was `K9` and it is fixed: the list down the left, `DrawingList.tsx`. Is it collapsed to a rail? |
| I pressed a button over the list and the drawing changed — or a switch and the list changed | `11_tests_drawing_list.md` **T-620**, then `06_code_map.md` **§H16** | the two rows are separate state: `kinds` (the list) and `shown` (the sheet) in `DrawingTab.tsx`. They share four words and nothing else |
| The list on the Drawing tab shows nothing | `11_tests_drawing_list.md` **T-625** | is there text in the search box? The empty note says which of the two it is. `filterEntries` in `DrawingList.tsx` |
| The list is gone from the Drawing tab | `11_tests_drawing_list.md` **T-630** | collapsed, and it is **remembered across a reload** — press the **›** on the rail. `appStore.drawingListOpen` |
| The Drawing tab's list has no state words, or the wrong ones, with editing off | `11_tests_drawing_list.md` **T-650** | `readerRowState` in `lib/designators.ts` — the reader's list must never read the editor's draft |
| The Drawing tab is a fog of dots after I pressed Terminals | **expected** — `02_tests_place_and_drag.md` T-190 | most pins have no point of their own and are drawn hollow on their component's dot. That is the honest picture, and it is why the group starts off |
| A dot on the Drawing tab named a component when I clicked a pin | `02_tests_place_and_drag.md` T-190 | `DrawingTab.tsx` `onMarker` — it must pass `marker.kind`, not `'component'` |
| The `runs through` chips on the Drawing tab went dead | `06_code_map.md` **§H11** | `located` is built from the components group regardless of its switch; if it reads the visible markers instead, turning Components off kills every link |
| The counts in the toolbar look wrong | `01_screen_and_vocabulary.md` §Toolbar | `model.ts` `coverage` |
| The rows are in a strange order, or the advance jumps somewhere unexpected | `01_screen_and_vocabulary.md` §The list | the `entries` memo and `BY_ID` in `LocateTab.tsx` — the list and `nextUnplaced` share one order |
| The green row is highlighted somewhere I have to scroll to find | `02_tests_place_and_drag.md` T-180 | `components/DesignatorList.tsx` `armedRow` — the `scrollIntoView` effect, shared by both tabs' lists since 2026-08-25 |
| The sheet flies to the wrong one of a component's dots, or does not fly at all | `03_tests_sites_and_pins.md` T-215 | `LocateTab.tsx` `framing` and `flyTo` — **every** flight is asked for by a call site |
| The site-name box loses focus, snaps back, or saves per keystroke | `03_tests_sites_and_pins.md` T-220 | `TargetPanel.tsx` `SiteName`; `06_code_map.md` §H4 |

---

## 7. Known issues, before you start

These are things **I already know are wrong or rough**. Do not spend a report on them — but do say
if one bites harder than described. Full reasoning is in `06_code_map.md`.

*Five of the eleven are struck. What is left after Session 6 is `K2` (deferred, never observed),
`K4` (narrowed to a component site with no point yet), `K5` (a design question), `K6` (not a bug),
`K7` — the six rows in `To do` that can never be finished, and the only one of these the plan set
out to avoid rather than fix — and `K11`, which is now a decision rather than a gap.*

| # | What | Effect | Fix is |
|---|---|---|---|
| ~~**K1**~~ | ~~Picking the same row twice does not re-fly the sheet~~ | **Fixed 2026-08-19.** A flight is now something a call site *asks for* rather than something an effect infers from the row's id having changed, so asking twice flies twice — picking the row again, or pressing the `placing` button of the site you are on, brings you back after panning away. T-110 and T-215 test it. | done — `LocateTab.tsx` `flyTo`, `framing` |
| **K2** | Two tabs, or a hand edit, silently lose work | The draft is a whole document loaded once. The last save wins and discards everything it never saw. **Still theoretical** — it has not been observed. A gap in the file's history on 2026-08-24 looked like it had bitten and turned out to be a deliberate deletion (§5a), so the only evidence for it remains the shape of the code. | medium — a counter in the file, checked on save. **Deferred by the user 2026-08-24**: they work in one tab and hand-edits are their own, so the cure is currently bigger than the disease |
| ~~**K3**~~ | ~~The site-name box appears frozen if you empty it~~ | **Fixed 2026-08-18.** The box holds its own text and writes the document once, on `Enter` or blur, so a whole word goes in without the caret leaving; a refused name stays on screen with its reason. T-220 tests it. | done — `TargetPanel.tsx` `SiteName`, `model.ts` `canRenameSite` |
| **K4** | The eight-way label control does nothing until the point exists | Place first, then choose the side. **Narrowed 2026-08-24:** it no longer applies to a wire's or a net's **end** labels, which are anchored to terminal points that already exist and whose compasses are live the moment the row is armed (T-565). It stands for the old `label_point` and for a component site with no point yet. | small — create-on-set, on what is left of it |
| **K5** | You cannot place a point *under* an existing dot by clicking it | The dot swallows the click and retargets instead. Zoom in, or drag the dot. | design question |
| **K6** | `circuit_logic.json` goes stale after every save | Deliberate — the banner says so and `test_the_committed_artifact_is_exactly_what_the_generator_writes` goes red until you re-run the generator. | not a bug |
| ~~**K10**~~ | ~~An invented net id is printed on the sheet as its end label~~ | **Fixed 2026-09-03**, in Session 6, and it turned out to be worth **two nets** rather than two labels. `NET-PB1` and `NET-PB2` are prefixed names for the nets the sheet prints as `PB1` and `PB2` — the rename was right, because the drawing also has a *push button* called `PB1` and two things may not share an id — and it cost two things. The visible one: an end label saying a word a reader holding the paper cannot find. The expensive one, which only appeared once the whole review queue had been worked: those two were **the only nets of 26 with no printed conductor for Phase E's matcher to compare against**, while both of their printed names sat on a run (`C0054` reads `PB1` after your correction; `PB2` was read correctly all along). So `drawing.py` `printed_net` publishes the printed form beside the id, `endLabels.ts` draws it, and `candidates()` compares against **both** forms. **26 of 26.** T-945 walks it. | done — `printed_net` (`drawing.py`), `printed` on a net entry, `netNames` (`features/locate/paths.ts`) |
| **K11** | The Review tab records a run's **net name** and nothing else about a run | 40 of the 119 flagged conductors were flagged for a missing `spec_label` or an unbound endpoint rather than a missing net name, and this screen cannot record either. **Decided after using the ranking, 2026-09-03, and the answer is: leave it.** Phase E's ranking does use the spec as its second signal — `spec_label` whole, and `color`/`gauge` apart so a run whose colour matches while its gauge does not ranks below an exact match rather than dropping out of the list — but the measurement says it is not the binding constraint. Every one of the 71 wires comes back with at least one candidate, **37 of them with a single run whose two ends land on both their pins**, and the three wires with no name-and-spec match are two that have no colour or gauge printed at all plus `W049`. A `spec` key on a run would double this file's schema for the weaker signal, and the strongest one turned out to be neither: it is the **endpoint geometry**, which needs nothing from this screen. Kept as a known issue rather than struck, because the reasoning is *not needed*, not *impossible* — the day a drawing arrives where the geometry is ambiguous, this is the field to add. | **not doing it** — and now for a measured reason rather than a guess |
| **K7** | Six rows in *To do* can never sensibly be finished | The two off-page machines and four referenced drawings say `nowhere` and have no position on this sheet, so "to do" cannot reach 0. Exactly the complaint that made wire labels a separate count — and I missed it here. **Unchanged on the Locate tab**, and worth knowing that on the Drawing tab's new list those same six rows are not a chore at all: there, `nowhere` is information — *this identifier is real and it is not on this sheet* (T-640). | small — exclude `nowhere` from the queue, or count them apart |
| ~~**K8**~~ | ~~A marker moved by accident cannot be put back~~ | **Fixed 2026-08-24.** `Ctrl+Z` over the draft, fifty whole-document snapshots deep, announcing what it undid and arming the row it changed; `Ctrl+Shift+Z` redoes. Plus `Shift`+arrows to nudge an armed point by 1.0 pt and `Shift`+`Alt`+arrows by 0.1 pt, so a small move never needs a small drag. **A minimum-drag threshold stays rejected** — small moves are legitimate. **The stack is in memory and dies with the page:** cross-session recovery is still git, which is why a run of placement should end in a commit. T-470–T-490 test it. | done — `stores/locateStore.ts` `edit`/`undo`/`redo`, `LocateTab.tsx` `nudge` and the key effect, `model.ts` `draftPoint` |
| ~~**K9**~~ | ~~A net cannot be selected from the sheet~~ | **Fixed 2026-08-25.** The Drawing tab has a list of all 275 designators down its left: type or scroll, click the row, and the net is selected and framed with its seven pins ringed — the same selection a citation raises, without the question. T-610 walks it against T-500, which is the same test at the price of one model answer. | done — `features/drawing/DrawingList.tsx`, `components/DesignatorList.tsx`, `DrawingTab.tsx` `onRow` |

---

## 8. The one thing that must stay true

**Replaced 2026-08-24** with the amendment in `_claude_notes/highlighting_wires_and_nets.md` §3,
which the user accepted as written on 2026-08-23. The old wording — *"a wire's route is its two
endpoint terminals and nothing else"* — is kept in the paragraph below it, because what it was
guarding is exactly what the new wording still forbids.

> **A wire's route is never computed.** It is either **lifted from the ink** — one or more conductor
> polylines out of `geometry.json`, which are the PDF's own vector strokes rather than a reading of
> them — or **traced by a person** along the printed conductor. It carries which of those it was,
> forever, and a hand-traced path says so on screen.
>
> What stays forbidden is a route **synthesised from its endpoints**: no straight line between two
> terminals, no interpolation, no path derived from anything but ink. A highlight computed from
> terminal positions is the bug, whatever else it fixes.

Why the distinction is the whole of it, on this drawing: `W052` runs `CR2:14 → TB-120:1`. A straight
chord between those two pins is a 600 pt diagonal across the entire relay column and four unrelated
circuits. The ink says one horizontal run at y = 663.7, from x = 379.8 to x = 301.8. The chord is not
slightly wrong, it is somewhere else — and for a highlighter whose job is *which of these lines is the
one I care about*, a wrong line is worse than no line.

**Since Session 5, 2026-09-02, the file can hold one** — and only in the two ways the rule allows.
A wire may carry a `path`: `runs`, `conductors`, and the two provenance axes
(`geometry: extracted | human`, `attribution: printed | human`). **`derived` is a rejected value on
both**, refused by name with a test per axis, and a net carries no path at all because its highlight
is the union of its wires'. Nothing computes a run, nothing stretches one to meet the pins it stops
short of, and where there is none the card says *no path yet* rather than drawing a chord.

**And since Session 6, 2026-09-03, there is a screen that writes one — which is where the rule
stopped being a restraint and started being the design.** The path editor's whole job is to *offer
ink*: it ranks the runs of ink that might be a wire, lights one on the sheet when you hover it, and
writes the polyline it already had when you accept. The only other thing it can do is record corners
a person clicked. Three consequences worth stating, because each is a place the rule could have been
broken quietly and was not:

- **`attribution` is written `human` on every route**, including the 37 wires whose single candidate
  lands on both their pins. `printed` is reserved for accepting a match with nobody looking, and
  nothing in this application does that;
- **`chordOf` is the one function that computes anything from a wire's two ends**, and it exists only
  to be printed *beside* the ink's length for comparison. `W068`: 312 pt against 644. It is never
  drawn;
- **an extracted run cannot be edited in place.** `geometry: extracted` is a claim about the
  polyline, so moving a corner takes an explicit conversion to `geometry: human` first, and the
  conductor ids go with it. Hazard `H21`.

A row reading `ends known, no path` is now a wire nobody has got to yet, and the `Paths` filter is
the list of them.

**The worked example above has been corrected.** `W052`'s two pins were placed on 2026-08-20 at
(236.1, 563.4) and (300.1, 563.3), which puts its run at **`C0109`**; `C0080` — the y = 663.7 run
quoted above — is **`W053`**'s, within 1.7 pt at both ends. The 600 pt diagonal was measured from
`CR2`'s coil, which is where `CR2:14` resolved before anybody placed it. The *argument* is unchanged
and is better made by `W068`, whose chord is 312 pt straight across the middle of the sheet while its
ink goes 644 pt the long way round: `13_tests_paths_highlight.md` T-820.

---

## 9. A Note From Claude's Human Cocreator - Claude Code left the following comments in the console after writing this document:

Nine files in _claude_notes/locate_tab_testing/, with the one you named as the index:

| File | Purpose | ~tokens |
| :--- | :--- | :--- |
| `locate_tab_instruction_and_test_manual.md` | The index. Start-up commands, what the tab is for, the document map, how to report, current state, symptom → which doc to read, known issues | 2.6k |
| `01_screen_and_vocabulary.md` | Every region, badge and dot style; the words site, pin, seed, parent, label | 2.8k |
| `02_tests_place_and_drag.md` | T-100–T-170 | 2.1k |
| `03_tests_sites_and_pins.md` | T-200–T-260 | 1.8k |
| `04_tests_labels.md` | T-300–T-350 | 1.8k |
| `05_tests_save_and_recover.md` | T-400–T-460 | 2.4k |
| `06_code_map.md` | Behaviour → file and symbol, data flow, nine hazards, seven invariants | 3.0k |
| `07_drawing_facts.md` | The real ids and coordinates, so nobody reads geometry.json (150k tokens) | 1.7k |
| `08_results_log.md` | All 28 tests as a blank table for you to mark up | 0.9k |

*(**Fifteen** files now, and that is all of them: `09_tests_net_membership.md` came with Session 1
on 2026-08-24, `10_tests_end_labels.md` with Session 2 the same day, `11_tests_drawing_list.md` with
Session 3 on 2026-08-25, `12_tests_label_corrections.md` with Session 4 the same day,
`13_tests_paths_highlight.md` with Session 5 on 2026-09-02 and **`14_tests_path_editor.md` with
Session 6 on 2026-09-03 — the last session of the plan.** §3 above is the current map; this table is
kept as written.)*

*(**38** now — T-425 was added with the `F2` work, T-190 and T-360 with the Drawing tab's layer
switches, and T-115 and T-335 with changes 11–13, all on 2026-08-19; **T-470–T-490 and T-500–T-520
came with Session 1 of the wires-and-nets plan on 2026-08-24, T-550–T-590 with Session 2 the same day,
T-600–T-650 with Session 3 on 2026-08-25, T-700–T-740 with Session 4 the same day, T-800–T-840
with Session 5 on 2026-09-02, and T-745–T-770 plus T-900–T-960 with Session 6 on 2026-09-03** —
**about 90 numbered lessons in all.** §5 above is the current count; this section is kept as
written.)*

28 numbered tests. Each one doubles as a lesson — what to click, what should happen, and why it matters — so working through them in order teaches the whole screen. Each also says where to look if it fails, so a report of "T-142 failed, the dot landed half an inch left" points straight at paint.ts cssToPoint.

A troubleshooting session next time reads the index + your results log + one test file + the code map — about 8.5k tokens instead of the whole feature.

Seven known issues I found while writing it *(eight now — `K8` was added 2026-08-24. §7 above is the
current list; this section is kept as written.)*

Writing the manual made me read my own code as a user would, and that surfaced things tests don't catch. They're in index §7 so you don't waste a report on them:

- K1 picking the same row twice doesn't re-fly the sheet
- K2 two tabs (or a hand edit while a tab is open) silently lose work — the one I'd fix first, and T-440 asks you to confirm how easily it bites
- K3 the site-name box looks frozen if you backspace it empty
- K4 the eight-way label control does nothing until the point exists
- K5 you can't place a point under an existing dot by clicking it
- K7 six rows in To do can never be finished — the off-page machines and referenced drawings. This is exactly the complaint that made me count wire labels separately, and I missed it in the same screen.

Each has a proposed fix; all but K2 and K5 are small.

Two housekeeping things

circuit_logic.json was stale against your current locations.json, and test_the_committed_artifact_is_exactly_what_the_generator_writes was red — doing its job. I re-ran the generator; 105 server tests and 100 web tests now pass, ruff and tsc clean.

One caution worth repeating from T-440: use one Locate tab at a time, and don't hand-edit locations.json while a tab is open. The save is a whole document loaded once, so the last save wins over anything it never saw. That's K2, and it's the gap I'd close before you do a long placement run.
