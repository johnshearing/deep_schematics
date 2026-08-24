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

Expected right now: **106 server, 127 web, ruff clean, tsc clean** — except that
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
| `05_tests_save_and_recover.md` | **T-400–T-4xx.** Autosave, the Save button, restart, refusals, the `problems` strip, regenerating `circuit_logic.json`. | Anything about work not persisting, or a red strip. |
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

### 5a. What is in the files, 2026-08-24

**The counts below replaced a stale block that still described 6 components and 18 terminals.**
A full placement run happened on 2026-08-20 and the manual did not hear about it. Re-measured
against the files, not remembered:

    locations.json    schema 1. The placement run is **finished for points**:
                      41 component ids over 47 drawn sites, every one source: human
                      131 terminals — **all of them** — each with its own point,
                        every one source: human
                      52 of those 131 carry a chosen label side; the other 79 sit
                        at the default
                      multi-site components: CR-BP, CR-SW, CR-ON, CR1, CR2
                      **"wires": {} and "nets": {} — no label points at all**
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
| I nudged a dot by accident and want it back | §7 **K8** | there is no undo yet. `git diff` on `locations.json` names the point and its old coordinate exactly; that is the whole recovery story today |
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
| **K4** | The eight-way label control does nothing until the point exists | Place first, then choose the side. | small — create-on-set |
| **K5** | You cannot place a point *under* an existing dot by clicking it | The dot swallows the click and retargets instead. Zoom in, or drag the dot. | design question |
| **K6** | `circuit_logic.json` goes stale after every save | Deliberate — the banner says so and `test_the_committed_artifact_is_exactly_what_the_generator_writes` goes red until you re-run the generator. | not a bug |
| **K7** | Six rows in *To do* can never sensibly be finished | The two off-page machines and four referenced drawings say `nowhere` and have no position on this sheet, so "to do" cannot reach 0. Exactly the complaint that made wire labels a separate count — and I missed it here. | small — exclude `nowhere` from the queue, or count them apart |
| **K8** | **A marker moved by accident cannot be put back.** | A drag writes the new point into the draft, autosave persists it, and the coordinate it replaced is gone from the running program. There is no `Ctrl+Z`. Reported by the user 2026-08-24 after `BYPASS-CB:1` moved a tenth of a point (§5a). Today the only undo is git, which recovers the last **commit**, not the last **action**. | small — `Ctrl+Z` over the draft, plus `Shift`+arrows to nudge an armed point precisely so a small move never needs a small drag. Designed in `_claude_notes/highlighting_wires_and_nets.md` §9, Phase 0. **A minimum-drag threshold was considered and rejected by the user**: small moves are legitimate and must stay possible |

---

## 8. The one thing that must stay true

A wire's **route** is its two endpoint terminals and nothing else. Nowhere in `locations.json`,
in the editor, or in the API is there a way to say where a wire *goes* — because drawing a line
between two terminals no conductor joined would be inventing geometry, and every claim this system
makes rests on it never having invented any. A wire can carry only a `label_point`: where its name
is printed. If a change ever appears to let a human author a route, that is the bug, whatever else
it fixes.

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

*(**32** now — T-425 was added with the `F2` work, T-190 and T-360 with the Drawing tab's layer
switches, and T-115 and T-335 with changes 11–13, all on 2026-08-19. §5 above is the current count;
this section is kept as written.)*

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
