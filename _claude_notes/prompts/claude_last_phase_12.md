Greetings. Background first, then the request at the bottom. **Read this file whole — it is short on
purpose — and then do §1 and nothing else.**

---

## 1. The request

**Read `_claude_notes/goals_01.md`, then `_claude_notes/highlighting_wires_and_nets_03.md`, both
whole. Then execute plan 03's §5 — Phase 3b — and stop there.**

In my own words:

> **I have three red banners I cannot clear from any screen, and my own authoring run is making
> more of them.** When I correct a wire's far end, the end-label override I had set on the old
> terminal is left behind — the wire does not touch that terminal any more, so the panel gives it
> no row, no eye and no way back. **Give each orphan a row that says plainly the wire has left that
> terminal, with one control on it: a reset.**

**Then stop.** **§4C, then §6, then §6A** are the sessions after this one; §7 and §8 are plans to
write rather than code. **If §5 leaves room, take §4C's two *defects* as well and say that you
did** — `Take it back` not reverting the slot (trap 28) and no way to force a wiring save. They are
wrong behaviour in the same editor §5 touches, each is a failing test and a small fix, and plan 03
§10 asks for them here rather than in a sitting of their own.

Those two documents are self-contained. `goals_01.md` is the definition of done — the nine features
I must be able to author and the eight things the model must be able to highlight. **§5's reading
list is two line ranges and one function, read out of the files on 2026-09-15 and not re-checked
since, so `grep -n` each before trusting it** — and remember **trap 10**: a panel's plumbing is
three edits and `TargetPanel.tsx` is all three. Otherwise **trust the reading lists over your
instinct to look around**; that instinct is what makes these sessions cost $100.

**§5's count is authored data and it moves under you.** Three orphans on 2026-09-18 and a fourth
coming from `W014`. **Compute the rows from `Object.keys(overrides)` against today's members; a
test that asserts *three orphans* goes red the moment I correct that wire.** That is trap 4 and it
has now bitten four times.

**One phase per session.** When §5's acceptance criteria are met, write up what happened and stop,
even if there is context left.

**§4B shipped on 2026-09-19 and I walked it — it works.** With `Authored paths` on, clicking a
painted route arms that wire's row and lights it on top of the field, clicking a painted bus arms
its block and opens the commoning panel, and **with the field off every click still means *place***.
**§4A shipped 2026-09-17** and is the same gesture on the Drawing tab. **Do not rebuild or extend
either.** Their lesson document is `locate_tab_testing/21_tests_clicking_a_path.md` — one document,
one feature, two tabs — which you **do not read**: a lesson document is the output of a phase, never
its input. `H29` and `H30` in `06_code_map.md` are the reasoning, and **`H30` is worth reading
before touching any handler on the Locate tab.**

**Two things those two phases left me.** The slate colour is still unjudged (T-1450 — I will say if
it is wrong). And `SelectionCard.tsx:274` still prints a route's `C####` list, which a path click
puts on screen; that was left alone deliberately rather than demoted without my asking, and it is
one prop and one line **if I ask**. Do not do it as a side effect of §5.

**What walking §4A found, which is now plan 03 §4C and `goals_01.md` §6A — read both, and solve
only the two defects named above.** I followed the new card's link from `RECEPT1:4` to `W037`, read
its record, and could see with my own eyes it was wrong; same for `W018` on the Locate tab. **Both
reproduce a measurement made on 2026-09-08 to the screw** — 11 of 71 wires have their far end on the
wrong screw because the vision pass *allocated* screw numbers down the page. **The corrections are
mine to make and the screen already exists** (`15_tests_wiring_editor.md`, 2026-09-08); what §4C
adds is a way to *find* the eleven and a way to say *why* I corrected one. **Do not make the
corrections for me and do not retire anything** — I asked for that explicitly on 2026-09-18: *"These
problems are exactly what I need to test the WebUI, learn what needs to be done and learn how to use
it."* **List them, explain them, fix the screen — never do the run.**

**And working the first one found three more defects, all in plan 03 §4C and §6A.** `Take it back`
leaves the slot showing the value it took back, which cost me an hour and a byte-identical save;
there is no way to force a wiring save; and once `W018`'s endpoint was right **the path editor
offered no candidate for it at all**, so I hand-traced ink whose three conductors the endpoint
proposal had just named to me by id. The first two are this session's optional extra; **the third is
§6A and it is not** — it wants a measurement before a line is written.

**§6 of plan 02 shipped on 2026-09-13 and I walked it — and then rejected it.** Do not rebuild it
and do not defend it; §2 below says why in one sentence, and plan 03 §1 says it properly. Its code
stays in the tree as a diagnostic, behind `?unclaimed=1`, and **§4A demoted the conductor *card* the
same way, for the same reason.** The demotion pattern is settled and reusable and is written down in
`H29`.

*If I have found something while working since, I will say so in this session and that overrides the
above. Otherwise §5 is the job.*

---

## 2. What this project is

A WebUI where **a human points at features on a schematic and they become JSON a model can reason
over** — and where the highlighting is what proves the JSON is a complete and correct representation
of the sheet. `PS20115MLM4-2` is the test specimen, not the goal; the goal is a library of indexed
drawings and a system that works on any of them.

The long-term aim, so nothing here loses sight of it: **the model highlights notes, components,
terminals, paths, path_nets, path_cables, labels and symbols on the drawing as it speaks its answer
to me.** `goals_01.md` is that list audited against what exists. Everything I ask for is one of
those items.

`circuit_logic.json` is generated from four authored inputs: the tables in `author_circuit_logic.py`
(what each thing *is*), `locations.json` (where it is drawn), `wiring.json` (which two terminals each
wire *joins*, plus each block's bus), and — read by the app, not the generator —
`label_corrections.json` (what the ink says).

**What I rejected on 2026-09-15, and why it matters more than the feature did.** Plan 02's §6 painted
every run of ink that no wire's route and no block's bus claimed. It works, and it does not move us
toward the goal: **the conductors are the model's notion of where the ink is, and I can see the ink
itself.** The extractor missed 41 lines, about 90 of the 149 conductors are leader lines and symbol
strokes nothing will ever claim, and one place on the sheet is drawn wrong — so *unclaimed
conductors* measures the extraction, not the JSON. `prompts.py:52` even tells the model **"Do NOT
read `geometry.json`."** What I need is the opposite view: **paint what has been authored and let my
eye find the rest.** That was §4, and it is built.

**The same argument, third time, and that was §4A — built 2026-09-17, and §4B finished it on
2026-09-19.** The *click* on the Drawing
tab used to answer *what conductor is this*. **I am not interested in conductors.** The reader's
question is *whose path is this*, and the click answers that or says nothing at all. **Silence is
the feature**: ink that answers nothing is ink that needs a path, which is the same instrument as
the unpainted ink in §4 — my eye, on the paper. The conductor card is alive as a diagnostic at
`?unclaimed=1` and off the reader's screen. **§4B is the same click on the Locate tab, where it arms
the row instead of naming it**, so the way back from a mark on the paper to the record that owns it
now exists on both screens.

**And the first thing the new click did was find a fault, which is the argument for all of it.**
Within an hour I had followed the card's link from a terminal to `W037` and could see its record was
wrong; the same for `W018`. **11 of my 71 wires have their far end on the wrong screw** — the vision
pass *allocated* screw numbers down the page instead of reading them — and it was measured on
2026-09-08 and tabled in `authoring_the_wires.md` §3.2 and §3.5. **Grep that file, never read it.**
The fix is a **one-end correction** on each, which keeps `was`; it is **not** a retirement and
**not** a new wire, and it is mine to do. `goals_01.md` §6A and plan 03 §4C are the write-up.

**Where the authoring stands, measured 2026-09-15 and unchanged in the table on 2026-09-17. Read the
files, never the prose, if a count matters** — every document in this project quotes the census of the day it was written, and I author
between sessions.

| | |
|---|---|
| `locations.json` | 131 placed terminals · 41 components at 47 sites · **59 wire routes, 17 hand-traced** · 113 end-label overrides on 56 wires |
| `label_corrections.json` | 654 decisions |
| `wiring.json` | 71 records, **3 `source: human`** · **6 commoning blocks, 2 drawn by hand** |
| the ink | 149 runs · 44 claimed by a route · 7 by a bus · 98 claimed by nothing |
| `/api/paths`, which is what the sheet paints and what §4A clicks | **59 routes · 6 buses · 68 runs** (re-measured 2026-09-17, unmoved) |
| wires whose far end the ink puts elsewhere | **11 of 71 provable, 13 unsettleable, 47 right** — measured 2026-09-08. **3 corrected, 8 left** on 2026-09-18; the table is plan 03 `§4C.0` and I am working it |

Get any of those with a one-liner:

```
cd schematic_extraction/PS20115MLM4-2/extracted_docs && python3 -c "…"
```

**The authoring run is mine and it has barely begun.** All six commoning blocks are decided and I am
working through the paths now. §4 did not touch my queue; it told me where the queue *is*. §4A and
§4B did not touch it either: they made the drawing itself the index into it — click a painted run
and learn whose it is, or click it on the Locate tab and be editing it. **§5 does not touch it
either**: it gives an orphaned end-label override a row and a reset, on rows my own corrections
created. **Nor does §4C**: it makes the eleven wrong screws *findable* and makes a correction able
to say *why*. The rule has not changed once — **no phase writes a byte of my data.**

---

## 3. Why the plan exists, in one paragraph

Every editor so far was built as a **confirmation surface**, not an **authoring surface**: each panel
takes its list of objects from something the machine found and its edit control from a proposal the
machine computed, so where the machine found nothing there is no row and no button. On 2026-09-11 the
answer to two of my authoring questions was *hand-edit the JSON*, and I deliberately did not do it —
a hand edit produces correct data and destroys the finding. **An un-authorable thing is a named gap in
a panel, not a file edit.** Wires and paths now have both halves; commoning got them on 2026-09-12.
**What still has no screen at all is `author_circuit_logic.py`** — whether a terminal exists, which
net it is on, what a component is, and the drawing's notes — and that is plan 03 §7. The highlighting
half is correct per object and got its *complete* view on 2026-09-15, when §4 painted the whole of
what I have authored at once. **The way back — from a mark on the paper to the record that owns it —
is built on both screens**: the Drawing tab's click answers *whose path is this* (§4A, 2026-09-17)
and the Locate tab's arms the row that owns it (§4B, 2026-09-19). **And the way back immediately
found two records that are wrong**, which is §4C and is the honest measure of whether any of this
was worth building. **What is left is smaller and duller and it is on my screen every day**: an
override nobody can reach (§5), a disagreement nobody can filter for (§4C), and ink the extractor
never read (§6).

---

## 4. Traps, each of which has cost a session

1. **No `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab.** It is true in `server/.env`.
   Editor password `edit-1234`. The routes are registered inside an `if`, so with it false there is
   nothing there to be wrong about — deliberate, not a bug.
2. **`python -m app` has no reloader.** A change under `server/app/` needs a restart.
3. **The client is a built bundle.** A change under `webui/src/` needs `cd webui && npm run build`.
   **A rebuilt bundle against an unrestarted server is the dangerous combination.** §4 was one
   server function plus client work and needed both. **§4A and §4B were client-only and so is §5** —
   rebuild the bundle, leave the server alone; plan 03 §5 says *no server change* outright, because
   the banner is `resolve_geometry` doing its job and it goes quiet when the key goes. §4C has one
   schema field and therefore *does* need a restart.
4. **A test asserting an absolute count against an authored file goes red as I author.** This has
   bitten three times. The cure is always the same: **reconstruct the indexing pass's own answer from
   `was`, and assert against that.** `INDEXED` in `test_extraction_generator.py` and `loadReal` in
   `wiring.test.ts` are the two implementations and both carry the reasoning. **§4's legend counts, §4A's path card and §4B's run
   counts were all exactly this trap, and §5's *three orphans* is the next one — it becomes four
   the moment I correct `W014`** — a
   count or a length on a card comes off the payload, never out of a fixture's memory, and expect it
   to move under you.
5. **`H18` — three whole-document drafts over three authored files.** They must not learn about each
   other. `wiringModel.pathStale` and the trace's target tag are the only two places two of them meet,
   and both meet them *as arguments*. **`H26` is the newest hazard in the book** — read it if you
   touch the trace. **§4 was a third place they could have met and did not**: the field reads the
   published `/api/paths`, never two drafts — and `pickPath`, written in §4A, and the arming in §4B
   read that same published index, for the same reason.
6. **`H24` — the landing rule has three parts and only the first is obvious.** Read it before touching
   `features/locate/wiring.ts`.
7. **`H25` — the `W` table is no longer the list of wires that exist.** A record saying `"added": true`
   is a wire I put there; an unknown id *without* it is still a typo and still refused by name.
8. **`H23` — the generator refuses to run without `wiring.json`.** Anything you write that runs it must
   supply the file.
9. **`H20` — geometry is free and connectivity is not.** `GET /api/paths` and `GET /api/conductors`
   have no editor password, on purpose, which is why §4 and §4A needed no new endpoint and **§4B
   needs none either**: `pickPath` is arithmetic over a payload already on the page. §4C is the
   first phase since §4 that touches the server at all, and only for one schema field.
10. **A panel's plumbing is three edits, and `TargetPanel.tsx` is all three** — the props interface,
    the sub-panel that renders it, and the call site. Assume the same gap in every reading list.
11. **The test file for a panel is not named after the panel.** Commoning is tested in
    `WiringPanel.test.tsx`; the Drawing tab's overlays in `DrawingTab.test.tsx`. Look before starting
    a new spec file.
12. **`wiringStore.edit` takes no note**, unlike the locations store's. One `tsc` error if you assume
    otherwise — **and this is no longer only a trap, it is §4C.2.** A retirement demands a reason in
    words and a *correction* accepts none, so *the printed table says `:1`, the ink lands on `:3`,
    and I looked* cannot be written down. Do not add the field as a side effect of another phase.
13. **A new canvas overlay is four edits in `TileSheet.tsx`** — the prop, the paint call in the layout
    effect, the `data-` attribute a test reads it through, **and the effect's dependency array.** The
    fourth is silent: a missed dependency is a stale frame, not an error. This is what §6's reading
    list missed on 2026-09-13.
14. **The Locate tab paints two things now, and the difference is the design.** The armed row's
    route is `runs` — `draftRuns(document, paths, targetEntry)`, which prefers the unsaved draft —
    and the whole sheet's authored routes are `authored`, read from the published `/api/paths` and
    never from a draft. Painted in that order, selection on top. **§4B added a third meaning to a
    click on this tab without disturbing the first two** — see trap 17, and `H30`.
15. **Do not write a second distance function.** `project` (`lib/polyline.ts:28`) is the only
    point-to-polyline measurement in the app; **`PICK_PT = 6` now lives beside it in
    `lib/polyline.ts`**, moved there on 2026-09-17, and the comment explains why 6 and not 4 or 8.
    `pickRun` (`hitTest.ts:71`) and `pickPath` (`lib/paths.ts`) are the two users of it, and
    **`pickPath` is what §4B reuses unchanged.** Ties go to the shorter run, which is why a click
    near a pin takes the stub rather than the bus.
16. **A control is documented in *three* places, and the third is prose.** The button, its tests,
    **and the tab's own help paragraph** — `DrawingTab.tsx`'s explanation names its switches by
    name. Deleting `Unclaimed ink` on 2026-09-15 left a sentence about it behind, found only by
    grepping the string. Grep the user-visible name before you call a removal done.
17. **On the Locate tab a click has four meanings and the fourth is behind a mode** — built
    2026-09-19, `H30`. In order: tracing takes a corner · an armed end slot ignores paper · **with
    `Authored paths` on, a path within `PICK_PT` arms its owner's row** · otherwise `put(at)` writes
    the armed row's point, or a wire's `label_point`. **The mode is what keeps them apart**: a
    second meaning added by nearness alone would arm a wire when somebody placed a terminal onto ink
    that carries a path. **Do not add a fifth meaning without a mode of its own**, and do not
    replace this one with a modifier key or a nearness heuristic without asking me.
18. **Two cards share the sheet's bottom-left corner and there is a precedence comment about it**
    (`ConductorCard.tsx:46` and `SelectionCard.tsx:85` are both `bottom-3 left-3`). §4A took the
    empty right-hand corner rather than joining that fight — see trap 26 for where things sit now.
19. **A Locate-tab screen test's harness re-stubs the designator index on every save.**
    `LocateTab.test.tsx`'s `stubServer` now takes an `index` option for exactly that reason: a
    locations save calls `refreshDesignators`, which re-reads `/api/designators` **and**
    `/api/paths`, so a test that set the store's census by hand watched it be replaced mid-test.
20. **T-numbers spent reach T-1526.** §5 takes the next free number in `10_tests_end_labels.md`,
    §4C the next in `15_tests_wiring_editor.md`, §6A the next in `14_tests_path_editor.md`. Do not reuse a number and do not renumber one — `19_...`'s
    T-1400–T-1407 and `16_...`'s T-1135/T-1140/T-1145/T-1150 are spent even though both features
    are demoted.
21. **`/api/paths`'s `nets` map is built from each net's `member_terminals`** since 2026-09-15
    (`server/app/drawing.py:332`), because the generated `wires[].net` holds one net per wire and
    `W019` bonds `0V` to `GND`. **Either end a member means that wire's runs belong to that net's
    highlight.** Keep it a rule about membership, never about a net's name.
22. **`lib/` may not import from `features/`.** Nothing in `lib/` does, and that is why `PICK_PT`
    had to move rather than be imported (trap 15). Check the direction before putting a shared
    function in `lib/` — it is the reason `pickPath` lives there and `pickRun` does not.
23. **A screen test can only click where a marker is drawn.** `clickAtMarker` reads a marker's CSS
    position, because that is the only place a test can learn where a PDF point lands. So testing a
    click on a **path** means putting a confirmed pin *on that path* in the fixture — which is what
    `ON_ROUTE` and `ON_TRACE` in `DrawingTab.test.tsx` exist for. Do not calibrate by guessing
    pixels; that costs a test run per try.
24. **`pathsFor` returns null for a `component`.** So selecting a component paints nothing, and any
    feature that answers *this is a block's bus* has to supply its own runs — `§4A` needed
    `runs={onPath?.runs ?? path?.runs}` for exactly this and the plan did not predict it; **§4B hit
    it again** — arming a *component* is how a bus is reached — and fixed it in the `runs` memo,
    which now reads a block's bus out of `paths.commoning[id]`, published index only (`H18`).
    **Expect the same gap in anything that answers *what runs belong to this row*.**
25. **The ink's verdict on a wire's far end already exists**, and it is not obvious from the code
    map: `proposalsFor` (`features/locate/wiring.ts:336`) walks the ink **from the trustworthy end**
    and `EndSlot` (`WiringPanel.tsx:508`) renders it with `agrees` and `data-wiring-proposal`. **Do
    not build a second one.** §4C is a filter, a field and a colour over this — never a new
    calculation, and never an auto-accept (`W042`).
26. **Two cards can be open at once now, and the corners are the rule.** `bottom-3 left-3` is the
    selection card *and* the conductor card, with a precedence comment; `bottom-3 right-3` is the
    path card. `Escape` takes the path card and the conductor pick together — one gesture, one
    answer — then the selection. `H22`, extended 2026-09-17.
27. **Never restart the server, or close the tab, while the `wiring` badge is not `saved`.** The
    wiring editor autosaves 900 ms after the last edit and has **no Save button** — only `Retry`,
    and only after a failure. A stranded draft looks identical to a saved one on the panel, and on
    2026-09-18 that cost an hour: `wiring.json` was written **byte-identical** and the generator
    correctly folded in nothing. The proven diagnostic is `md5sum` and
    `git status --short schematic_extraction/`, never the screen.
28. **`Take it back` on a wiring end does not revert the slot.** Measured 2026-09-18: pick a new
    terminal, press `Take it back`, and the box goes on showing the terminal you took back while
    the document reverts underneath it. It is a real defect, it is `§4C` hole 3a, and **it is the
    likely cause of any report that a correction did not stick** — ask whether `Take it back` was
    pressed before investigating anything else.
29. **Correcting a wire's far end orphans any end-label override on the old terminal**, and the
    banner it raises cannot be cleared from any screen. Three standing on 2026-09-18 — `W018`'s
    `TB-0V:1`, `W019`'s `TB-0V:2`, `W063`'s `TB-120:2` — with one more coming from `W014`. It is
    **loud and harmless** (`resolve_geometry` refusing by name, `H14`), it never reaches the
    netlist, and it is plan 03 `§5`, fully specified. **Do not offer a hand edit** and do not offer
    the `Take it back` round trip without saying it runs through the defect in trap 28.
30. **The path editor's candidate list does not chain runs, and the endpoint proposal does.**
    `candidates` (`features/locate/paths.ts:194`) is per-run; `landingsFrom`
    (`features/locate/wiring.ts:357`) walks through unterminated ends within `JOIN_PT`. So a wire
    whose route is two or three conductors end to end can be *named* by the end slot and offered
    **nothing** by the path editor — which is why `W018` had to be hand-traced on 2026-09-18 over
    ink the machine had already identified. Plan 03 `§6A`, and **measure before building**.

31. **A handler's own guard runs before its branches, and a reading list will give you the
    branches.** §4B's plan named the four meanings of the sheet's click and not the
    `if (!target || !from) return` two lines above them — so the feature as specified would only
    have worked when a row was *already* armed, which is the opposite of its purpose. **Read the top
    of the handler, not just the branch you are adding to.**

Running it:

```
cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/
```

**If you start the server, stop it in the same turn. The console is mine.**

The four checks:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

**Background them in parallel — but a worker error is not a red test.** On 2026-09-17 the web run
died beside pytest with `Serialized Error: { code: 'ERR_IPC_CHANNEL_CLOSED' }` and came back
**506 passed** when re-run alone. **Only a named failing test is a failure**; if the run dies with an
IPC or worker error, re-run `npx vitest run` on its own before telling me anything.

**Start from green, and read the counts off your own run rather than off this page** — they moved
four times in the last week, and stood at **263 server · 513 web** on 2026-09-19. A red check in a
session that has written no code means something else is wrong — say so loudly. The one exception
is
`test_the_committed_artifact_is_exactly_what_the_generator_writes`, which goes red whenever
`locations.json` or `wiring.json` is ahead of `circuit_logic.json`, and names which. That is `K6`
doing its job; clear it with the generator first so you can tell your breakage from mine. **It was
green on 2026-09-19** — my path authoring does not reach the netlist, by design.

**Two venvs, and only one has `pymupdf`:** `/home/js/schematics/.venv/bin/python` can read the PDF
(`page.get_drawings()` with a clip is cheap and exact); `server/.venv` cannot, and neither can system
`python3`. *Is the ink there, or did we miss it?* has cost this project three open items — that venv
is how you answer it, and plan 03 §6 is the phase that needs it.

---

## 5. What not to do

- **Do not build a conductor editor, and do not build another view over conductors.** Struck three
  times: 2026-09-13 as a thing to author — a conductor is a measurement of the paper, so drawing one
  would be inventing ink — 2026-09-15 as a thing to *view*, for the reason in §2, and 2026-09-17 as
  a thing to *click*, which is §4A and is **done**. What a person authors is the **interpretation**: *this run is
  that wire's route*, *this stretch is that block's bus*, and where the ink is missing they draw it
  directly, which is what `geometry: "human"` records. Ink the extractor lost is a **bug upstream**
  (plan 03 §6), not a gap in the screen. **The demotion pattern is settled and reusable**: leave the
  code, take the control off the screen, gate it on `?unclaimed=1`, keep every test by setting the
  query instead of clicking, and write the reason into the lesson document's header.
- **Do not correct `W018`, `W037` or any of the other nine wrong screws.** They are named in
  `goals_01.md` §6A because knowing about them is the phase's input, not its output. The screen that
  corrects them shipped 2026-09-08 and the run is mine. **And do not retire them** — a retirement is
  for a wire that does not exist, and using it here would delete a real connection and throw away
  `was`.
- **Do not author anything in the four authored files.** The run is mine. To verify a write loop end
  to end: back the file up, write one record through the running server, check the generator folds it
  in, restore, and prove it with `md5sum` — `git status --short schematic_extraction/` coming back
  **unchanged from how you found it** is the proof. Every session since Session 2 has done it that way.
- **Do not renumber anything.** Not terminals, not `C####` ids, and not spent T-numbers: `19_`'s
  T-14xx are used, so §4's tests start at **T-1450**.
- **Do not auto-accept anything.** Not a proposed endpoint, not a candidate route, not a bus the shape
  rule found, and not a conductor list a hand trace computed. `W042` is the standing reason: I pressed
  *I looked and it was right* on a wire the ink says nothing about, and that was the correct answer.
- **Do not hand-edit `circuit_logic.json` or `custom_kg.json`.** Both are generated:

      cd schematic_extraction/PS20115MLM4-2/extracted_docs
      python author_circuit_logic.py
      python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate

  No phase in plan 03 moves the artifact.
- **Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** If you
  need a number, get it with a `python3 -c` one-liner that prints a summary. On 2026-09-15 four
  one-liners answered every measurement question in this file for a few hundred tokens each; it is the
  single biggest saving available.
- **Grep the big documents; do not read them.** `authoring_the_wires.md` (91 KB),
  `change_history.md` (233 KB) and the two superseded plans are **lookup tables**, not reading. One
  `grep -n "W018\|W037"` over the 91 KB returned the two rows that answered the hardest question of
  2026-09-17, for about 200 tokens. This is the cheapest habit in the file and it was not in it
  before.
- **Do not read the lesson documents in `_claude_notes/locate_tab_testing/*_tests_*.md`** — the glob
  now reaches `20_` and `21_`, not only `1x_`. They are written for me to walk, and a lesson document
  is the **output** of a phase, never its input. The one exception is a handful of sections a phase
  is explicitly told to demote or append to, and then you read those sections, not the file — §4A
  read four of `16_...`'s and they came to 2 KB. **§5 appends to `10_tests_end_labels.md` and does
  not read it**; the T-numbers it needs are the next free ones, and the plan says which document.

---

## 6. Three things I want built *for*, not just built

1. **This has to generalise to other drawings.** The drawing-specific half stays in the extraction's
   own tables; everything in `server/app/` and `webui/src/` knows only shapes. **If you find yourself
   typing `TB-`, `W019` or `C0060` into the server or the client, stop.** The commoning gate — *two or
   more of this component's terminals on one net* — is the worked example of doing this right, and
   §4.6's *either end is a member of this net* is the next one.
2. **This has to generalise to circuits that need several pages.** `wiring.json` holds terminal
   designators and no coordinates, which is what makes it survive a second sheet — except `commoning`,
   which stores polylines and already carries an optional `page` for exactly that day.
3. **Build for the model's highlight.** Every feature the model must point at while it answers needs
   **an id in `circuit_logic.json`** — that is the whole reason notes, cables, printed labels and
   symbols cannot be cited today, and it is the constraint that orders plan 03 §7 before §8.

---

## 7. The budget, and how to check it

I fund this from API credits, so tokens are money and plan 03's §11 is not advice.

**Measured over 31 session transcripts on 2026-09-19: about $1,112 spent to date.** The two $100
sessions ran at 407 K context over ~400 calls, where cache reads were 84% of the bill. Recent work,
for comparison: plan 02's §4 cost **$23.84** at 136 K; its §6 **implementation** cost **$11 at 100 K
over 128 calls**; **the same session reached $32 by 190 calls** once we reviewed the design,
re-planned and wrote three documents — prose at full context is not free either; **plan 03's §4 cost
$13.12 at 114 K average over 133 calls**; **plan 03's §4A cost $23.42 at 152 K average over 175
calls for the code and documents — and $36.29 over 226 calls at 176 K by the time we had discussed
`W018`, planned §4C and rewritten these three files**; and **plan 03's §4B cost $10.53 at 115 K
average over 88 calls**, code and three documents, which is now the shape to copy and the cheapest
coding session this project has had. That last
$13 is the same lesson as plan 02's §6: **the conversation after a phase costs as much as a small
phase**, because it runs at the session's ceiling. It was worth it — §4C came out of it — but price
it before starting one.

**What made §4 cheap, in four habits worth repeating:** the phase's reading list was followed and
nothing else was opened; four `python3 -c` one-liners answered every question about the data; the
four checks ran **twice only**, at the start and the end, backgrounded and in parallel; and every
edit was an exact-string replacement that fails loudly rather than a re-read of the file.

**And what made §4B cheaper still, at 88 calls — three more, and they are the ones to copy.** The
whole reading list was **re-located in two batched `grep -n` calls** rather than one call per line
number, which is where §4A's call count went. **The tests were written from the fixtures the suite
already had** — its `stubServer`, `clickSheet`, `endRows` and `saved` — instead of new ones, and the
click coordinates were **computed from the documented fit rather than guessed**, so all seven passed
on the first run; guessing costs a test run per try and a test run at 115 K is a dollar. And **the
three documents went in as one call**, written from notes taken while the tests were, never by
re-reading the code to describe it.

**Why §4A still cost twice that, having done all four — this is the more useful lesson.** Nothing
was wasted. The floor was higher: `goals_01.md` plus plan 03 is **~48 KB before a line of code**, so
a phase now *starts* near 60 K and every call pays for it. That leaves **the number of calls as the
only lever**, and §4A made 175. So: **batch harder** — six greps in one message, not three messages
of two — and **write each document in one call**, from notes taken while the tests were written,
never by re-reading the code to describe it. Five documents at 150 K was about half that bill.

Price a session, including the one you are in:

```
ls -t ~/.claude/projects/-home-js-schematics/*.jsonl | head -1
# then sum message.usage over the file: input ×$5, output ×$25,
# cache_creation ×$6.25, cache_read ×$0.50, per 1M tokens (Opus 5)
```

**Cost ≈ $0.50 × (context in M tokens) × (number of calls).** Nothing else is close.

**Sanity marks while working:** at 60 calls you should be around $3–6. Past $25 before the tests are
written means the reading list grew — cut the phase rather than push it through. A phase should land
near $20 at ≤120 K context and ≤200 calls.

**Say what the session cost at the end.** About **$33** of the $150 I funded remains, against plan
03's **$62–106** for everything left in it. **So it does not fit, and saying so is the instruction
being followed rather than bad news.** **§5 ($12–28) fits and nothing after it does**, on current
prices, unless I fund more or a phase is cut — and §4C's two defects riding along inside §5's
session is the cheapest thing left in the plan. **Tell me at the start of a session if you think the
phase in §1 will not fit**, and tell me if you think it should be cut rather than squeezed. **And
end each session in the write-up, not in a conversation** — the discussion after §4A cost $13, which
is most of a phase.

---

## 8. Four standing instructions

1. **I do all the git work myself. Do not commit and do not push.** Read git freely — `git status`,
   `git diff`, `git show`, `git log` are often the fastest answer. When something ought to be
   committed, name the files and say so.

2. **There are four authored files git cannot regenerate:**

       locations.json           where everything is drawn
       label_corrections.json   what the ink says
       wiring.json              what each wire joins, and each block's bus
       author_circuit_logic.py  what each thing is  (a Python file, but the tables in it are my data)

   **Say at the end of your session which files want committing**, and remember that anything I author
   while walking your lessons lands in the same commit as your code unless I am told to separate them.

   *Currently uncommitted and known, 2026-09-19:* **nothing.** `13d63cc — After executing plan 03's
   §4B` carries that phase's code and documents, `git status --short schematic_extraction/` is empty,
   and `W018`'s correction and everything before it is committed. **You are starting from a clean
   tree, so anything `git status` shows you is either yours or something I did after this line was
   written.** **I am working the other eight wrong screws now, so
   `locations.json` and `wiring.json` will move under you** — re-read rather than trusting a count
   you took at the start, and expect `circuit_logic.json` to be ahead of or behind them depending on
   when I last ran the generator.

3. **Tell me afterwards** which files I asked you to read that did not earn their tokens, and which
   files you needed that I did not name. I use it to rewrite this file — traps 10 to 15 came from
   that answer, traps 22 to 26 from §4A's, **traps 27 to 29 from me walking §4A and hitting three
   defects in twenty minutes**, and **trap 31 from §4B finding that its reading list had given it
   the branches of a handler and not the guard above them.** Say it even when the answer is *the list was right*; that is
   worth knowing too.

   **And when I report that something does not work, measure before theorising.** On 2026-09-18 the
   file's **mtime** and a `md5sum` settled in one call what four rounds of reasoning about the code
   could not: the save had run and written byte-identical bytes. **`ls -l`, `md5sum`,
   `git status --short`, and a real `PUT` through the running server** — that sequence is the
   debugger for this project, and §5's backup/write/restore/`md5sum` dance is exactly it.

4. **Keep token usage as low as you can without lowering quality.** Measure the data with a one-liner
   before reading the code that renders it, read line ranges rather than files, batch independent calls
   into one message, and run the four checks at the start and the end rather than between edits.
   **Two more, learned on 2026-09-17:** **grep the big documents instead of reading them** — they are
   lookup tables and one `grep -n` beats a re-derivation — and **write each document in a single
   call**, from notes taken while the code was written. At 150 K context the call count *is* the bill,
   so the win is fewer, fatter messages rather than less thinking.

---

## 9. If you are picking this up cold and §1 does not apply

The things a session might otherwise be, in the order I would want them:

1. **Plan 03's remaining phases, in this order** — **§5** the orphaned end-label rows, **§4C**
   the wrong far ends (**its two defects should ride inside §5's session**), §6 the extractor's
   layer fix, §6A the chained candidate. **I reordered §5 ahead of §4C on 2026-09-18** because my
   own run is creating banners I cannot clear, while §4C's *find them* half is already done — I have
   the list. All specified; none needs new design. §4 shipped 2026-09-15, §4A on 2026-09-17 and §4B
   on 2026-09-19.
2. **Plan 03 §7 — a screen for `author_circuit_logic.py`.** Notes, whether a terminal or component
   *exists*, and **which net a terminal is on**, which is the sharpest gap in the whole surface because
   net membership is what the highlight paints. It **wants a plan, not a session**, and it becomes
   urgent on drawing two.
3. **Plan 03 §8 — cables, label and symbol binding, and widening the citation loop** so an answer can
   paint a note or a cable. After §7, because §7 is what creates the ids. **A plan, not a session.**
4. **Drawing number two.** `schematic_skills/scripts/bootstrap_wiring.py` exists and has never been
   pointed at a drawing. It is the test of everything above and **wants a plan, not a session.**
5. **Something I have found while working.** Most likely I do not understand how to use what you have
   built and need instruction, or something is not working. This overrides §1.

**And when it is that last one, check whether the screen already answers me before planning
anything.** On 2026-09-17 I reported two wrong wire records and proposed retiring them; the finding
was right, the remedy was wrong, and **the control I needed had shipped nine days earlier** — the
panel was already showing the ink's own verdict beside the record I was reading. The answer was
instruction plus three small holes (§4C), not a feature. **Grep the code for the thing I am asking
for before designing it.** Trap 25.

**Plans are documents first.** Write the plan into `_claude_notes` and stop — I read plans and execute
them in separate sittings, and the plan is the cheap half.
