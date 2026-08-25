# Locate tab — instruction and test manual

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

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab.** It is in `server/.env` now. With it false the
   routes are never registered — that is deliberate, not a bug.
2. **`python -m app` has no reloader.** Any change under `server/app/` needs a restart.
3. **The client is a built bundle.** Any change under `webui/src/` needs
   `cd webui && npm run build`, *and* a server restart if the server changed too. A rebuilt bundle
   against an unrestarted server is the dangerous combination — the new client can send fields the
   old validator silently ignores.

Verify all four tests pass before blaming the UI:

    cd server && .venv/bin/python -m pytest -q; .venv/bin/python -m ruff check .; \
      cd ../webui && npx vitest run; npx tsc -b --noEmit

Expected right now: **117 server, 185 web, ruff clean, tsc clean** *(2026-08-24, after Session 2 of
the wires-and-nets plan; it was 111 and 155 after Session 1, and 106 and 127 before that)* — except
that
`test_the_committed_artifact_is_exactly_what_the_generator_writes` is red whenever `locations.json`
has moved ahead of `circuit_logic.json`. That is **K6** doing its job, not a failure; re-run the
generator (§5) and it goes green.

---

## 2. What the Locate tab is for, in one paragraph

`circuit_logic.json` records where each component is, but those coordinates came from a vision pass
and are approximate everywhere — median error 11 pt on a sheet whose conductor rows are **16 pt
apart**, so "approximate" means "wrong row", and a dot on the wrong row names a different circuit.
A better guesser was built and rejected: at that accuracy a proposal must be audited, auditing
costs what placing costs, and it costs more when the proposal is confidently wrong. So the rule is
**the indexing pass gets one chance to guess, and after that a human owns the positions.** The
Locate tab is where that human works, and `locations.json` is the file that records who said so.

---

## 3. The documents in this directory

Read the index (this file) plus **only** what the symptom calls for.

| File | What is in it | Pull it in when |
|---|---|---|
| `01_screen_and_vocabulary.md` | The screen, region by region; every button, badge and dot style; the words *site*, *pin*, *seed*, *parent*, *label*. | Always, on a first read. Any report about something *looking* wrong. |
| `02_tests_place_and_drag.md` | **T-100–T-1xx.** Picking a row, click-to-place, the advance, dragging a dot, the pan-versus-place rule, the flight ceiling (T-115), and (T-190) the Drawing tab's three layer switches. | Anything about a point landing in the wrong spot, or not landing — or about the sheet moving, or refusing to. |
| `03_tests_sites_and_pins.md` | **T-200–T-2xx.** Components drawn more than once, adding/renaming/removing sites, assigning pins to sites. | Anything about `CR-BP`, `CR-SW`, multiple dots, or pins. |
| `04_tests_labels.md` | **T-300–T-3xx.** Wire and net label points, the eight label sides, and (T-335) whether the side you chose survives to the Drawing tab. | Anything about a label, or about wires and nets. |
| `05_tests_save_and_recover.md` | **T-400–T-4xx.** Autosave, the Save button, restart, refusals, the `problems` strip, regenerating `circuit_logic.json`, **(T-426) the Ask tab keeping the reader's place across `F2`**, and **(T-470–T-490) `Ctrl+Z` and the `Shift`+arrow nudge**. | Anything about work not persisting, or a red strip, or a marker you did not mean to move, or a tab that came back in the wrong place. |
| `09_tests_net_membership.md` | **T-500–T-530.** What a net is made of, and where its highlight goes: rings on **terminals and only terminals**, the member roster on the selection card, the way **back** to it, *place it*. **Drawing tab, no password.** | Anything about a net or wire highlight marking the wrong place — or too much. |
| `10_tests_end_labels.md` | **T-550–T-590.** A label at both ends of every wire and at every net terminal, on by default and costing nothing: the two-ended compass, the per-member net list, `hidden`, **Reset to default deleting rather than writing**, three labels on one pin, and the `Wires`/`Nets` filter split. **Both tabs.** | Anything about a wire's or net's name on the sheet, or about `locations.json` growing lines nobody asked for. |
| `06_code_map.md` | Every behaviour → the file and function that owns it. The data flow end to end. The known hazards, with reasoning. | Always, when troubleshooting. Never needed to *run* a test. |
| `07_drawing_facts.md` | The concrete ids and coordinates on `PS20115MLM4-2` the tests refer to — relay pin lists, the three `CR-BP` sites, `W048`, net `110`. | When a test names an id and you need to know what it is. |
| `08_results_log.md` | Every test id in a table, blank, for the user to mark up. | **A troubleshooting session should read this first** — it says what is actually broken. |

**Do not read** `geometry.json` (608 KB, ~150,000 tokens) or `circuit_logic.json` in full.
`07_drawing_facts.md` exists so that never becomes necessary.

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
                      **"wires": {} and "nets": {} — no label points, and no
                        end-label overrides either.** As of Session 2 those two
                        sections hold two different things, and both being empty
                        is the *normal* state: 265 end labels are drawn from the
                        terminal points above, and the file records only the ones
                        somebody overruled.
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
| No Locate tab at all | §1 above | `SWUI_ALLOW_EDITS`; `tabs.ts` `isEnabled` |
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
| The Drawing tab will not show me terminals, or wire and net labels | `02_tests_place_and_drag.md` **T-190**, `04_tests_labels.md` **T-360** | its own three switches in the toolbar, `DrawingTab.tsx` `LAYERS` and `shown` — a group with nothing to draw has no button at all |
| I cannot tell which of the Drawing tab's three switches are on | `02_tests_place_and_drag.md` **T-190** | filled means on since 2026-08-19 — the `variant` on the `LAYERS.map` buttons in `DrawingTab.tsx` |
| The Drawing tab is a fog of dots after I pressed Terminals | **expected** — `02_tests_place_and_drag.md` T-190 | most pins have no point of their own and are drawn hollow on their component's dot. That is the honest picture, and it is why the group starts off |
| A dot on the Drawing tab named a component when I clicked a pin | `02_tests_place_and_drag.md` T-190 | `DrawingTab.tsx` `onMarker` — it must pass `marker.kind`, not `'component'` |
| The `runs through` chips on the Drawing tab went dead | `06_code_map.md` **§H11** | `located` is built from the components group regardless of its switch; if it reads the visible markers instead, turning Components off kills every link |
| The counts in the toolbar look wrong | `01_screen_and_vocabulary.md` §Toolbar | `model.ts` `coverage` |
| The rows are in a strange order, or the advance jumps somewhere unexpected | `01_screen_and_vocabulary.md` §The list | the `entries` memo and `BY_ID` in `LocateTab.tsx` — the list and `nextUnplaced` share one order |
| The green row is highlighted somewhere I have to scroll to find | `02_tests_place_and_drag.md` T-180 | `WorkList.tsx` `armedRow` — the `scrollIntoView` effect |
| The sheet flies to the wrong one of a component's dots, or does not fly at all | `03_tests_sites_and_pins.md` T-215 | `LocateTab.tsx` `framing` and `flyTo` — **every** flight is asked for by a call site |
| The site-name box loses focus, snaps back, or saves per keystroke | `03_tests_sites_and_pins.md` T-220 | `TargetPanel.tsx` `SiteName`; `06_code_map.md` §H4 |

---

## 7. Known issues, before you start

These are things **I already know are wrong or rough**. Do not spend a report on them — but do say
if one bites harder than described. Full reasoning is in `06_code_map.md`.

| # | What | Effect | Fix is |
|---|---|---|---|
| ~~**K1**~~ | ~~Picking the same row twice does not re-fly the sheet~~ | **Fixed 2026-08-19.** A flight is now something a call site *asks for* rather than something an effect infers from the row's id having changed, so asking twice flies twice — picking the row again, or pressing the `placing` button of the site you are on, brings you back after panning away. T-110 and T-215 test it. | done — `LocateTab.tsx` `flyTo`, `framing` |
| **K2** | Two tabs, or a hand edit, silently lose work | The draft is a whole document loaded once. The last save wins and discards everything it never saw. **Still theoretical** — it has not been observed. A gap in the file's history on 2026-08-24 looked like it had bitten and turned out to be a deliberate deletion (§5a), so the only evidence for it remains the shape of the code. | medium — a counter in the file, checked on save. **Deferred by the user 2026-08-24**: they work in one tab and hand-edits are their own, so the cure is currently bigger than the disease |
| ~~**K3**~~ | ~~The site-name box appears frozen if you empty it~~ | **Fixed 2026-08-18.** The box holds its own text and writes the document once, on `Enter` or blur, so a whole word goes in without the caret leaving; a refused name stays on screen with its reason. T-220 tests it. | done — `TargetPanel.tsx` `SiteName`, `model.ts` `canRenameSite` |
| **K4** | The eight-way label control does nothing until the point exists | Place first, then choose the side. **Narrowed 2026-08-24:** it no longer applies to a wire's or a net's **end** labels, which are anchored to terminal points that already exist and whose compasses are live the moment the row is armed (T-565). It stands for the old `label_point` and for a component site with no point yet. | small — create-on-set, on what is left of it |
| **K5** | You cannot place a point *under* an existing dot by clicking it | The dot swallows the click and retargets instead. Zoom in, or drag the dot. | design question |
| **K6** | `circuit_logic.json` goes stale after every save | Deliberate — the banner says so and `test_the_committed_artifact_is_exactly_what_the_generator_writes` goes red until you re-run the generator. | not a bug |
| **K10** | An invented net id is printed on the sheet as its end label | `NET-PB1` and `NET-PB2` are prefixed names for nets the sheet prints as `PB1` and `PB2` (`INVENTED_NET_PREFIX`), so their end labels say a word that is not on the paper. Two nets of 26. Found while writing T-550 on 2026-08-24. | small — publish the printed form beside the id and label with that. Deliberately not done in Session 2: it is the same question Phase F asks about every misread label, and answering it twice in two places is how the two answers drift |
| **K7** | Six rows in *To do* can never sensibly be finished | The two off-page machines and four referenced drawings say `nowhere` and have no position on this sheet, so "to do" cannot reach 0. Exactly the complaint that made wire labels a separate count — and I missed it here. | small — exclude `nowhere` from the queue, or count them apart |
| ~~**K8**~~ | ~~A marker moved by accident cannot be put back~~ | **Fixed 2026-08-24.** `Ctrl+Z` over the draft, fifty whole-document snapshots deep, announcing what it undid and arming the row it changed; `Ctrl+Shift+Z` redoes. Plus `Shift`+arrows to nudge an armed point by 1.0 pt and `Shift`+`Alt`+arrows by 0.1 pt, so a small move never needs a small drag. **A minimum-drag threshold stays rejected** — small moves are legitimate. **The stack is in memory and dies with the page:** cross-session recovery is still git, which is why a run of placement should end in a commit. T-470–T-490 test it. | done — `stores/locateStore.ts` `edit`/`undo`/`redo`, `LocateTab.tsx` `nudge` and the key effect, `model.ts` `draftPoint` |
| **K9** | **A net cannot be selected from the sheet.** | Nothing a reader can click raises a net or a wire: the dots are components, terminals and label points, so the only way to a net's highlight is a citation in an answer — which costs a question. Found while writing T-500 on 2026-08-24. | **already planned** — the Drawing tab's list of all 275 designators is Phase C, `highlighting_wires_and_nets.md` §13 Session 3. Noted so nobody reports it as a bug in the meantime |

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

**As of Session 2 nothing in the system stores a path at all**, and a wire still carries only a
`label_point` and its end-label sides. `path` arrives in Session 5 with the two provenance axes
(`geometry: extracted | human`, `attribution: printed | human`), and `derived` is a **rejected** value
on both of them. Until then, a row reading `ends known, no path` is telling the literal truth.

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

*(**Ten** files now. `09_tests_net_membership.md` was added 2026-08-24 with Session 1 of the
wires-and-nets plan, and that plan adds five more — `10` through `14` — one per remaining session.
§3 above is the current map; this table is kept as written.)*

*(**38** now — T-425 was added with the `F2` work, T-190 and T-360 with the Drawing tab's layer
switches, and T-115 and T-335 with changes 11–13, all on 2026-08-19; **T-470–T-490 and T-500–T-520
came with Session 1 of the wires-and-nets plan on 2026-08-24**. §5 above is the current count; this
section is kept as written.)*

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
