# Highlighting wires and nets, 03 — *paint what has been authored, and the unpainted ink is the queue*

Written 2026-09-15 against commit `22d0b1b` plus the working tree. **Supersedes
`highlighting_wires_and_nets_02.md`**, whose `§4` (hand-traced commoning) and `§6` (the
unclaimed-conductor overlay) both shipped; everything still owed by it is carried forward here, and
**you do not need to read it to execute this.**

**The subject of this plan is `_claude_notes/goals_01.md`** — the user's nine authoring features and
eight highlighting targets, audited against the tree on 2026-09-15. Read that first; it is the
definition of *done* and it is ~14 KB.

**Status, 2026-09-17.** `§4` of plan 02 shipped 2026-09-12 and was walked the same evening. `§6` of
plan 02 shipped 2026-09-13, was walked, and was **rejected as a human-facing feature** — the reason
is `§1` below and it is the whole of why this plan exists. **`§4` here shipped 2026-09-15 and the
user walked it: it works.** Walking it produced two more requirements, which are `§4A` and `§4B`,
and they are the next two sessions. **`§4A` first.**

**What the walk of `§4` established, in one line:** the field answers *where is the work* and the
two clicks do not — the Drawing tab's click still answers *what conductor is this*, and the Locate
tab's cannot get from a painted run to the row that owns it. `§4A` and `§4B` are those two clicks.

---

## §0 How to use this document

**Read `goals_01.md`, then this file, then only the per-phase reading list in the phase you are
executing.** Nothing else from `_claude_notes`.

Do **not** open these, and the reason is measured:

| File | Size | Why not |
|---|---|---|
| `geometry.json` | 620 KB | ~150 k tokens. **Never.** A `python3 -c` one-liner answers any question about it |
| `circuit_logic.json` | — | Generated. Never whole; one-liner for a count |
| `change_history.md` | 233 KB | ~58 k tokens. Everything this plan needs from it is quoted here |
| `authoring_the_wires.md` | 91 KB | ~23 k tokens. Finished except the user's own run, which no phase here touches |
| `highlighting_wires_and_nets.md` | 99 KB | ~25 k tokens. Shipped |
| **`highlighting_wires_and_nets_02.md`** | 44 KB | **Shipped and superseded.** What still matters is quoted in `§3`, `§5` and `§6` below |
| `locate_tab_testing/*_tests_*.md` | 7–40 KB each | **A lesson document is the output of a phase, never its input** — `19_tests_coverage_overlay.md` and `20_tests_all_paths_overlay.md` included. The **one** exception is a phase's own acceptance list, quoted where it is needed: `§4A` names four T-numbers in `16_...` it has to demote, and reading those four sections (`:256-346`) is 2 KB, not the file |

That is ~110 k tokens of notes this plan exists to replace. **This file is ~33 KB on purpose, and every kilobyte of it replaces ten.**

**One phase per session. Stop at the phase boundary even if there is context left.** `§11` says why
in dollars.

---

## §1 Why this plan exists

The user walked `19_tests_coverage_overlay.md` on 2026-09-15 and rejected the feature it teaches:

> *"the conductors are not a true representation of the paths… The ink is what the human can see,
> while the conductors are what the ai thinks the human can see… What the human needs to see
> highlighted when drawing paths, is the paths that have already been created. Then the human will
> notice all the unhighlighted ink and know that these paths have not been created."*

They are right, and the error was in the plan I wrote. Plan 02 `§2` defined **complete** as
*nothing on the sheet is unaccounted for*, and then plan 02 `§6` silently substituted *conductors*
for *the sheet*. Conductors are the extractor's reading of the paper, and they disagree with the ink
three ways: 41 lines of layer-`"0"` ink never became conductors, ~90 of the 149 conductors are
leader lines and symbol strokes nothing will ever claim, and one place on this sheet has the ink
drawn wrong. `prompts.py:52` tells the model **"Do NOT read `geometry.json`"**, so the overlay was
also measuring a file the model never reads.

**The inversion.** Paint **what has been authored** and let the reader's eye find the rest. The
denominator becomes the paper, which is ground truth and needs no extractor to be right. Nothing in
the app does this: `LocateTab.tsx:621` paints `draftRuns(document, paths, targetEntry)` — the armed
row's route and nothing else. That is `§4`.

**`Unclaimed ink` comes off the toolbar in the same change.** The user: *"There is no need for a
human to see that but if you need it for diagnostics then it is ok to leave the code in so that you
can use it behind the scenes."*

---

## §2 The goal test

> **A human can author every feature the model reasons over, and the model can point at every one of
> them while it answers.**

`goals_01.md` `§4` and `§5` are that sentence as two tables. The short form:

- **Authorable today**: wires (add, correct, retire), paths (lift, add a run, trace, drag, *none
  here*), commoning, printed readings, terminal and component positions, end-label sides.
- **Not authorable at all**: notes, whether a terminal or component *exists*, **which net a
  terminal is on**, what a label is *about*, symbol bindings. All five live in
  `author_circuit_logic.py`, the one authored input with no screen.
- **Highlightable today**: components, terminals, wires, nets — one at a time.
- **Not highlightable**: notes, cables, printed labels, symbols — because **a feature needs an id in
  `circuit_logic.json` before the model can cite it.**

Everything in this plan serves that sentence. Nothing else is in scope.

---

## §3 What exists that you will reuse — measured 2026-09-15

Read out of the files on the day, at commit `22d0b1b` plus the working tree. **Re-check a line
number with `grep -n` before trusting it if the tree has moved.**

> **It has moved.** `§4` shipped on 2026-09-15 and added about 115 lines to `LocateTab.tsx`, so
> every `LocateTab.tsx` number in the table below is that much low — the toolbar row is now
> ~`:1225-1280`, the `TileSheet` call site ~`:1510`, the filter buttons ~`:1320-1360`. **`§4A`'s and
> `§4B`'s own tables were read on 2026-09-17 and are current**; use those, and grep for anything
> here you actually need.

**The three run layers and the one projection:**

| Thing | Where |
|---|---|
| `RunStyle`, and the three styles | `webui/src/features/drawing/paint.ts` — `HIGHLIGHT:172` (the selection), `CANDIDATE:191` (a proposal, or a trace in progress), `UNCLAIMED:216` (added 2026-09-13) |
| `paintRuns` — **the one paint path for a set of polylines** | `paint.ts:254`. Returns how many runs it drew, which is what the tests assert on |
| `polylineToDevice` → `tileDestRect` — invariant 2, one projection | `paint.ts:205` |
| The canvas that composes the layers, and its paint **order** | `webui/src/features/drawing/TileSheet.tsx` — `unclaimed`, then `candidates`, then `runs`, then the DOM markers above |
| The assertable trace of each layer | `data-runs`, `data-candidates`, `data-unclaimed` on the canvas. **jsdom has no 2D context**, so this is the only way a screen test can read a paint |

**The Locate tab, which `§4` changes:**

| Thing | Where |
|---|---|
| What the sheet highlights today — **one target at a time** | `LocateTab.tsx:621-624`, `draftRuns(document, paths, targetEntry)` |
| `draftRuns` itself, and that it **prefers the draft over the saved index** | `features/locate/paths.ts:410-425` |
| The `TileSheet` call site | `LocateTab.tsx:1395` |
| The corner handles layer, painted as a second `TileSheet`… | `LocateTab.tsx:1497` |
| The sheet's toolbar row — zoom out `:1140`, zoom in `:1146`, fit `:1149`. **This is where the toggle goes** | `LocateTab.tsx:1110-1165` |
| The queue's filter buttons, `aria-pressed`, one at a time | `LocateTab.tsx:1200-1245` |
| The published index the overlay reads | `appStore.paths` from `GET /api/paths`; `appStore.refreshPaths` (`stores/appStore.ts:250`) already runs after every save — `wiringStore.ts:158` |

**The Drawing tab's coverage overlay, which `§4` demotes:**

| Thing | Where |
|---|---|
| `coverage` state, the `unclaimed` and `unclaimedRuns` memos | `DrawingTab.tsx:503`, and the memos just below |
| `claims` — conductor id → wire, and → block | `DrawingTab.tsx:478`, built by `hitTest.ts:133` `claimsFrom` |
| `Claims.wires` / `.traced` / `.handTraced` — the honesty numbers (`H27`) | `hitTest.ts:109-121`, `:158` |
| The toolbar: the layers group, then the toggle to delete | `DrawingTab.tsx:750` (group), `:797` (`data-coverage-toggle`) |
| The legend to keep, moved or reused | `data-coverage-legend`, just above the layers group |

**The netlist side:**

| Thing | Where |
|---|---|
| What a selection highlights — a wire's runs, a net's wires' union, a terminal's plus its block's bus | `webui/src/lib/paths.ts:116` `pathsFor`. Pure, shared by both tabs |
| **The `/api/paths` payload, and the `nets` map built from `wires[].net`** | `server/app/drawing.py:320-355`, the map at `:332-338`. **This is the bridge-wire defect** — `goals_01.md` `§6` |
| The two-nets flag, and that it offers no fix | `features/locate/WiringPanel.tsx:700` `NetsAcross` |
| The end-label rows and the reset path `§5` needs | `features/locate/TargetPanel.tsx:274-275` (`members` and `overrides` side by side), `:455` (`onSet(null)`) |
| The layer gate `§6` fixes | `schematic_skills/scripts/extract.py:405`, the conductor test it feeds at `:440`, the `--layers` flag at `:1160` |
| The only venv with `pymupdf` | `/home/js/schematics/.venv/bin/python` |

**The census, measured 2026-09-15 — and it moves as the user authors, so recompute it:**

| | |
|---|---|
| `locations.json` | 131 placed terminals · 41 components placed at 47 sites · **59 wire routes, 17 hand-traced** · 113 end-label overrides on 56 wires |
| `wiring.json` | 71 records, 3 `source: human` · 6 commoning blocks, 2 hand-drawn |
| `label_corrections.json` | 654 decisions |
| the ink | 149 runs · 44 claimed by a route · 7 by a bus · 98 by nothing |
| **what `/api/paths` publishes** (2026-09-17) | **59 routes · 6 buses · 68 runs**, which is what the field paints and what `pickPath` searches |

**The three things `§4A` and `§4B` reuse, added 2026-09-17 after `§4` shipped:**

| Thing | Where |
|---|---|
| `AUTHORED`, and the four-layer paint order | `paint.ts` · `TileSheet.tsx` — `authored` is painted **first**, so an armed row's route always wins |
| `project` — point to polyline, **the only distance function**, and `PICK_PT = 6` with its reasoning | `lib/polyline.ts:28` · `hitTest.ts:46` |
| `pickRun` — the shape `pickPath` copies, nearest-within-6-pt with ties to the shorter run | `hitTest.ts:71-96` |

---

## §4 Phase 3a — every authored path painted at once — **shipped 2026-09-15**

> **Shipped 2026-09-15 and walked.** `AUTHORED` in `paint.ts`, `authored` on `TileSheet` (painted
> first of four), `showAuthored` + `data-authored-toggle` + `data-authored-legend` on the Locate
> tab, `Unclaimed ink` off the Drawing tab's toolbar and behind `?unclaimed=1`, and the bridge-wire
> fix in `drawing.py`. Walked in **`locate_tab_testing/20_tests_all_paths_overlay.md`**, T-1450–
> T-1459. `H28` in `06_code_map.md` is the reasoning. **Do not rebuild any of it**; `§4A` and `§4B`
> below are what the user asked for after walking it, and they are the next two sessions.
>
> The one thing left open by it: **the colour**. Slate at `rgba(71, 85, 105, 0.35)`, 3 pt, chosen
> by argument rather than on screen because the executing session had no browser. T-1450 is where
> the user judges it, and it is one line in `paint.ts`.

**The deliverable, in the user's words.** *"The all-paths overlay on the Locate tab — every authored
route and bus painted at once, one colour, toggled, with `58 of 71 wires have a route` in the
legend. The unpainted ink is then your queue, read off the paper."*

**Reading list (and nothing else):** `LocateTab.tsx:600-660`, `1110-1165`, `1380-1420`, `1480-1510`;
`TileSheet.tsx` whole (~200 lines); `paint.ts:150-270`; `features/locate/paths.ts:400-430`;
`DrawingTab.tsx:495-545` and `740-815`; `server/app/drawing.py:315-360`. **Plus one of
`DrawingTab.test.tsx`'s coverage tests** (the block at the foot of the file) — it is the pattern for
reading a paint out of a canvas that does not exist.

### 4.1 The layer — two props, not one clever one

`TileSheet` gains **`authored?: readonly Polyline[]`** beside the existing `unclaimed`, painted
**first of all four** and carrying `data-authored`. A generic `field: {runs, style}[]` prop was
considered and rejected: one prop per claim keeps the paint order readable and keeps the existing
`data-unclaimed` tests untouched.

**Four edits, and the fourth is the silent one:** the prop, the paint call in the layout effect, the
`data-` attribute, **and the effect's dependency array**. A missed dependency is a stale frame, not
an error.

Paint order, bottom to top, and each step is a different claim:

    authored   →  what has been authored, the whole sheet, background state
    unclaimed  →  the diagnostic, off unless asked for by URL
    candidates →  a proposal, or a trace in progress
    runs       →  the armed row's own route, which must always win

### 4.2 The style — a fourth `RunStyle`, and deliberately neutral

Add `AUTHORED` beside the other three in `paint.ts`. **Neutral, not green**: the field is background
state rather than a verdict, it must never compete with the orange-red selection stripe, and a
red/green pair would be the one contrast a colourblind reader cannot make. Slate at low alpha
(around `rgba(71, 85, 105, 0.35)`), **3 pt**, `minDevicePx: 2` — thinner and fainter than
`HIGHLIGHT`, because 60-odd runs paint at once and a field of 5 pt stripes is a second drawing over
the first. Confirm it on screen before writing the test.

### 4.3 The set — read the **published index**, never a draft

    authored = paths.wires[*].runs  ∪  paths.commoning[*].runs

**`H18` is why this is not `draftRuns` over every wire.** A route's draft lives in `locations.json`'s
whole-document draft and a bus's in `wiring.json`'s, so a field assembled from drafts would be one
overlay holding two authored documents — the same crossing `H26` keeps the trace clear of. The
published `/api/paths` is one source, needs no password (`H20`), and `refreshPaths` already runs
after every save (`wiringStore.ts:158`), so the field updates the moment the user commits a route.
The armed row's unsaved edit is already visible on top, in `HIGHLIGHT`, through the existing `runs`.

*(If the executing session wants live feedback before a save, the **route** half may come from the
locations draft — one document, no crossing. The **bus** half must never come from the wiring draft.)*

### 4.4 The toggle and the legend

- One button in the sheet's toolbar row (`LocateTab.tsx:1110-1165`), worded for what it paints —
  `Authored paths` — `aria-pressed`, filled when on, `data-authored-toggle`.
- **Off by default and not persisted.** `DrawingTab.tsx`'s own record of the user's verdict on the
  last permanently-lit overlay is *"this adds clutter and confusion to the drawing"*.
- **The legend is part of the feature, `H27` again**: beside the count of runs painted, print
  **`n` of `m` wires have a route**, and how many of those were hand-traced. 59 of 71 and 17 today.
  **Get both with a one-liner; never hard-code either.** `Claims.traced`/`.wires`/`.handTraced`
  already compute exactly this (`hitTest.ts:109-121`) — reuse it rather than counting again.

### 4.5 `Unclaimed ink` comes off the toolbar

Delete the button (`DrawingTab.tsx:797`) and its toolbar legend. **Keep** `UNCLAIMED`, the
`unclaimed`/`unclaimedRuns` memos, the `TileSheet` prop and `Claims.handTraced`, and gate the whole
thing on a URL query — `?unclaimed=1`, read once, not reactive — so the path stays live, stays
tested and cannot rot. The seven `T-14xx` screen tests keep their assertions and swap the button
click for setting the query before `render`. `19_tests_coverage_overlay.md` gets a header note
demoting it to a diagnostic and naming the query string; **its T-numbers are spent, do not reuse
them.**

### 4.6 The bridge-wire fix rides along — the phase's only server edit

`server/app/drawing.py:332-338` builds `/api/paths`'s `nets` map out of `circuit_logic.json`'s
single-valued `wires[].net`. `W019` bonds `PS1:-2` (net `0V`) to `TB-GND-B:2` (net `GND`) and its
`net` field says `0V`, so **selecting `GND` does not paint the bond.** Build the map from each net's
**`member_terminals`** instead — either end a member means that wire's runs belong to that net's
highlight — keeping the `wires[].net` grouping as a fallback for a wire whose ends are not in any
net. One server test: `GND`'s entry contains `W019`. No client change, no schema change, and
`path_nets` becomes right without authoring anything. Full reasoning in `goals_01.md` `§6`.

### 4.7 Acceptance criteria

1. With the overlay on, the painted set is **exactly** the runs in `/api/paths`'s `wires` plus its
   `commoning` — counted against the payload, not against a hard-coded number.
2. The armed row's own route is still distinguishable **on top** of the field.
3. The legend prints the run count **and** `n of m wires have a route`, hand-traced named.
4. Off by default; off again after a reload; toggling off restores the sheet exactly.
5. Selecting net `GND` paints `W019`'s route, and selecting `0V` still does.
6. **`Unclaimed ink` is gone from the toolbar** and `?unclaimed=1` still paints it.
7. `circuit_logic.json` does not move and `git status --short schematic_extraction/` comes back
   exactly as found. **Do not author the user's data.**
8. The four checks green.

**Documents:** `locate_tab_testing/20_tests_all_paths_overlay.md`, **T-1450 onward**; the demotion
note on `19_...`; `H28` in `06_code_map.md` — *the overlay's denominator is the paper, so the only
honest thing to paint is what has been authored, and it is read from the published index because a
field assembled from two drafts would be `H18` in a new coat.*

**Estimate: half a session, $12–25.** It is client-side plus one server function, and the layer it
needs already exists.

---

## §4A Phase 3d — the Drawing tab points at **paths**, not conductors — **the next session**

*(Numbered `§4A` on purpose. `§5` to `§8` keep the numbers `claude.md` and `goals_01.md` already
cite, and these two phases belong beside `§4` because they are the same inversion carried into the
other two places the sheet answers a question.)*

**The deliverable, in the user's words** — after walking `§4`:

> *"I am on the 'Drawing' tab of the WebUI. I notice if I click while over a conductor then the
> conductor will turn blue and an information box will appear… Since we have already established
> that the human does not need to see the conductor but rather the paths, it would be better if
> when clicking over a path, (not a conductor — we are not interested in conductors), on the
> 'Drawing' tab, the path would become highlighted and that we would see an information box in the
> lower right that tells us about the path and the wire that owns the path. If there is no path
> then nothing will happen when clicking over the ink and that tells us that a path needs to be
> created there."*

**This is `H28` applied to the click.** `§4` fixed what the sheet *paints*; the click still answers
*what conductor is this*, which is the extractor's reading of the paper and the question the user
has now struck three times. The same demotion, the same way: the conductor card goes behind
`?unclaimed=1` beside the overlay it belongs with, and the click answers **which authored path is
this, and whose**.

**And the silence is a feature.** A click on ink with no path must do **nothing at all** — no card,
no highlight, no *no wire claims this run* verdict. *Nothing happens* is the message: **a path
needs to be created here.** That sentence is the acceptance criterion for half this phase.

### Reading list (and nothing else)

Read out of the files on **2026-09-17**, at the tree with `§4` in it. `grep -n` to confirm one if
the tree has moved.

| Thing | Where |
|---|---|
| The sheet's click handler — **the four lines that change** | `DrawingTab.tsx:872-892`, ending `setPick(pickRun(conductors, at, claims))` |
| `pickRun`, and `PICK_PT = 6` with the reasoning for 6 | `features/drawing/hitTest.ts:46`, `:71-96` |
| `project` — point to polyline, **the one distance function in the app** | `lib/polyline.ts:28` |
| `Pick`, the shape the card renders | `hitTest.ts:49-68` |
| The card to demote, and its three verdicts | `ConductorCard.tsx:36` (props), `:116` claimed, `:135` commoning, `:164` unclaimed |
| **The corner both cards share, and the precedence note that explains why** | `DrawingTab.tsx:935-960`; both are `bottom-3 left-3` — `ConductorCard.tsx:46`, `SelectionCard.tsx:85`. **`bottom-3 right-3` is empty** |
| `PathSummary` — what a card can already say about a route without computing anything | `lib/paths.ts:48-76`, `pathsFor` at `:116` |
| What the published index holds | `PathIndex` / `WirePath` / `BlockCommoning` — `api/types.ts:286-350` |
| The five screen tests that change, and the fixture they share | `DrawingTab.test.tsx:1360-1440`, `describe('pointing at a line on the sheet')` |
| The walked versions of those five — **T-1135, T-1140, T-1145, T-1150** | `locate_tab_testing/16_tests_terminal_wires_and_commoning.md:256-346` |
| What `§4` built, for reuse rather than reading | `AUTHORED` in `paint.ts`, `authored` on `TileSheet`, `20_tests_all_paths_overlay.md` |

### 4A.1 `pickPath` — one function, and it belongs in `lib/paths.ts`

    pickPath(index, at, within = PICK_PT) → { owner: {kind: 'wire' | 'block', id}, run, off, geometry, conductors } | null

**In `lib/paths.ts` and not in `features/drawing/hitTest.ts`**, because `§4B` needs the same
function on the Locate tab and `lib/paths.ts` is where the two tabs already share their one answer
to *which runs is that* (`pathsFor`). It is arithmetic over a payload that is already on the page:
no fetch, no endpoint, no server edit in this phase at all.

**The same two rules as `pickRun`, for the same measured reasons:** nearest **and** within
`PICK_PT` = 6 pt, so a click in white space answers *nothing here* rather than reaching for the
closest thing on the sheet; and **ties go to the shorter run**, which is what makes a click near a
pin take the stub rather than the bus passing through it. Use `project` (`lib/polyline.ts:28`) —
**do not write a second distance function**, that is invariant 2 in a new coat.

**It searches `wires[*].runs` and `commoning[*].runs`, which is exactly the set `§4` paints.** That
is the property worth a test of its own: *anything you can see in the field, you can click.*

### 4A.2 The click, and the highlight that comes free

`DrawingTab.tsx:886-892` sets a conductor pick. It becomes a path pick, and **the highlight is not
new work**: selecting the owning wire already paints its runs in `HIGHLIGHT` through `pathsFor`, so

    select('wire', owner.id, 'drawing')      // a route
    select('component', owner.id, 'drawing') // a block's bus — the commoning lives on the component

**Clicking a run of authored ink is the same act as clicking that wire's row**, and saying so in
one line of code is the whole reason this phase is small. `'drawing'` as the origin is what stops
the fly-to from firing at something the reader is already looking at (`DrawingTab.tsx:538-543`).

### 4A.3 The card — bottom **right**, as asked, and it ends a fight rather than joining one

`PathCard`, `data-path-card`, at `bottom-3 right-3`. The user asked for the lower right and it is
also the better corner: `ConductorCard` and `SelectionCard` both sit bottom-left and the code has a
whole comment about which of them wins (`DrawingTab.tsx:935-945`). A path card in the other corner
**can coexist with the selection card**, which is the honest arrangement — *what is this line* and
*where is this identifier* are different questions and the answers no longer have to take turns.

What it says, and every item of it is already published:

- **whose it is** — *`W064`'s route*, or *`TB-120`'s bus* — as a link that selects it, the same
  `onSelectWire` / `onSelectBlock` pair `ConductorCard` already has (`:36`).
- **how it was authored** — *lifted from the drawing* or *you drew it*, off `geometry`. Never a
  `C####` id in the user-visible string: the ink's own names are the extractor's, and this whole
  line of work is about not showing them.
- **how much of a route it is** — how many runs, and the length along the ink beside the straight
  line between the pins if that is cheap (`PathSummary`, `lib/paths.ts:48`; `lengthOf` in
  `features/locate/paths.ts` if not).
- **and, for a wire, that the Locate tab is where it is edited.** A reader has no password; saying
  where the control lives is not the same as offering it.

### 4A.4 Bare ink is silent, and `ConductorCard` goes where the overlay went

No path within 6 pt → **nothing**: no card, no selection change, no highlight. The three conductor
verdicts move behind **`?unclaimed=1`** with the overlay they belong to — same query, read once,
same reason (`H28`), and the five tests in `DrawingTab.test.tsx:1360-1440` keep their assertions by
setting the query before `render`, exactly as `§4` did to the seven coverage tests.

**Do not delete `ConductorCard`, `pickRun`, `Pick` or `claimsFrom`.** They are the diagnostic that
answers *is the ink there, or did we miss it* from the screen, and `§6` still needs that question
answerable.

### 4A.5 Acceptance criteria

1. Clicking within 6 pt of any run the `Authored paths` field paints → that path is highlighted and
   the card names **the wire or block that owns it**, with no `C####` anywhere on screen.
2. Clicking ink that **no** path claims → **nothing happens at all**, and the reader's selection is
   left exactly as it was.
3. The card is bottom-right, the selection card is bottom-left, and **both may be open at once**;
   `Escape` closes the path card first and the selection second — `H22`'s escalation, unchanged.
4. A hand-traced route is clickable exactly like a lifted one, and says which it is.
5. `?unclaimed=1` still gives the three conductor verdicts and the pink overlay.
6. Nothing drawing-specific anywhere: no `TB-`, no `W019`, no `C0060` in a gate, a test or a string.
7. `git status --short schematic_extraction/` unchanged. No authoring, no server edit.
8. The four checks green, and the counts read off the run.

**Documents:** `locate_tab_testing/21_tests_clicking_a_path.md`, **T-1500 onward** · a demotion note
on `16_...`'s T-1135/T-1140/T-1145 like the one `19_...` carries · `H29` in `06_code_map.md` —
*the click was the third view over conductors, and the reader's question is whose path this is* ·
one row in the manual's index and a correction to its *clicking a line does nothing at all*
troubleshooting row, which is about to become the **expected** answer.

**Estimate: half a session, $12–25.** One new pure function, one card, one line of click handler,
and five tests that keep their assertions.

---

## §4B Phase 3e — clicking a path on the Locate tab arms its row

**The deliverable, in the user's words:**

> *"I am on the 'Locate' tab. I notice that when I click on W064 on the list then I will see an
> information box overlaid on the list which will tell me much information about the wire and allow
> me to edit the wire's properties and also I think it will allow me to draw the path for that wire
> by means of three buttons… Please add functionality such that when I click over a path, while on
> the 'Locate' tab, the corresponding item in the list will be activated and the path will be
> highlighted too."*

**This is the authoring half of `§4A`, and it closes the loop the field opened.** With the field
on, the user can see sixty-eight painted runs and has no way to get from one of them to the row
that owns it except by reading its name off the drawing and hunting the list. The field shows
*where the work is*; this makes the drawing itself the index into the queue.

### The one hard part, and it is not the hit test

**On this tab a click already means something, and what it means is *place the armed thing*.**
`LocateTab.tsx:1486-1507`: while tracing it adds a corner, while an end slot is armed it is
ignored, and otherwise it calls `put(at)` — which writes the armed row's point, or a wire's
`label_point`. So a second meaning cannot be layered on by nearness alone: a person placing a
terminal onto ink that happens to carry a path would arm a wire instead, and that is the authoring
loop broken for a feature nobody asked to be implicit.

**The rule, and it is the phase's one design decision: the field is the mode.**

    tracing            → the click is a corner          (unchanged)
    an end slot armed  → only a terminal fills it       (unchanged, H26)
    `Authored paths` on and a path within PICK_PT → arm that path's owner   ← new
    otherwise          → put(at)                        (unchanged)

Three reasons it is the toggle rather than a modifier key or a heuristic: **placement stays
unambiguous** whenever the field is off, which is how the screen is used for everything except path
work; **it is discoverable without documentation** — the ink you can click is the ink that is
painted, and the user just learned that switch; and **it needs no new state**, so `H24`'s landing
rule and `H26`'s one-gesture-two-files tag are both untouched. *(If the user would rather have it
always on, it is one condition — but say so before building it, because the risk above is real.)*

### Reading list (and nothing else)

| Thing | Where |
|---|---|
| The click handler and its three existing meanings | `LocateTab.tsx:1486-1507` |
| `put`, and what a click writes for each kind of armed row | `LocateTab.tsx:1050` · `model.ts` `place` |
| How a row is armed from the sheet today — **the pattern to copy**, including `flyTo` which this must *not* do | `LocateTab.tsx:1547-1585`, `MarkerLayer`'s `onSelect`; `aim` at `:1689` |
| The field's state, for the mode test | `LocateTab.tsx` `showAuthored`, `authored`, `authoredRuns` (all just above the `net` memo, ~`:645-700`) |
| `pickPath` — **written by `§4A`, reused here unchanged** | `lib/paths.ts` |
| The queue's filter buttons, which can hide the row being armed | `LocateTab.tsx:1320-1360` |
| `H24` before touching anything near the landing rule | `06_code_map.md` |

### 4B.1 What arming means, exactly

- **A wire's route** → `setTarget(aim(entry, document))` on that wire, so the panel opens with
  `Add a run`, `Make it editable`, `Trace by hand` and `Clear` on it — which is what the user is
  reaching for. `runs` then paints it in `HIGHLIGHT` **on top of the field**, with no extra code:
  `§4`'s layer order already guarantees the armed row wins.
- **A block's bus** → arm the **component**, because that is where the commoning panel lives — the
  same rule `§4A`'s card follows, so one answer to *whose is this* serves both tabs.
- **No fly-to.** The reader is looking at the run they clicked; panning the sheet under them would
  be the opposite of helpful. (This is the one place it differs from clicking a dot, which does fly
  — and the reason is that a dot click comes from the list-hunting habit this feature replaces.)
- **The row has to be visible in the list.** If the queue filter would hide it, switch the filter
  to `All` rather than arming a row nobody can see, and scroll it into view — `scrollIntoView` is
  already how the list does that.

### 4B.2 Acceptance criteria

1. With `Authored paths` on, clicking a painted route arms that wire's row, opens its panel, and
   highlights the route on top of the field.
2. Clicking a painted **bus** arms its component and opens the commoning panel.
3. **With the field off, every click means exactly what it means today** — a placement still lands,
   a trace still takes a corner, an armed end slot still ignores bare paper. One test per meaning.
4. Clicking ink with no path, field on or off, **never arms anything** and never writes.
5. A click while **tracing** is still a corner, even over a painted path — the trace wins.
6. Nothing is written by any of this: `saved` stays empty in the test, and
   `git status --short schematic_extraction/` comes back unchanged.
7. The four checks green.

**Documents:** append to `21_tests_clicking_a_path.md` (one document for both halves of *clicking a
path* — they are one feature on two tabs), **T-1520 onward** · `H30` in `06_code_map.md`: *a click
on the Locate tab already means place, so a second meaning needs a mode and not a heuristic* · the
manual's index row extended.

**Estimate: half a session, $10–20.** It is one branch in one handler, plus the tests that prove the
other three branches did not move.

---

## §5 Phase 3b — the override nobody can reach

Carried from plan 02 `§5`, **unchanged and still valid**: it is the last hole in an otherwise
complete authoring surface.

**The deliverable.** Both banners clear from the screen.

**Reading list:** `TargetPanel.tsx:265-300` and `430-470`; `features/locate/model.ts` `endLabelsOf`.
Nothing else.

The overrides live under `locations.json` → `wires[id].labels`, keyed by **terminal id** →
`{ hidden: true }` or `{ dir: … }`. **113 across 56 wires; `nets` has none.** Compute it, never
quote it.

Today (`TargetPanel.tsx:274-275`) there is one `EndLabelRow` per **member**, so an override keyed on
a terminal the wire no longer touches has no row, no eye icon and no way back — the compass that
created it cannot reach it. The change:

    orphans = Object.keys(overrides).filter(id => !members.some(m => m.id === id))

Each orphan row says plainly that the wire does not touch that terminal any more and carries
**one** control: a reset through the existing `onSet(null)` path (`:455`). No compass, no eye —
there is nothing to aim. Both halves stay inside `locations.json`, so `H18` is not engaged, and it
must work for **nets** as well as wires (`locations.py` refuses *"labels the ends of X, which is not
a wire or net in the netlist"*). **No server change**: the banner is `resolve_geometry` doing its
job and it goes quiet when the key goes.

**Acceptance criteria.** `W019`'s orphan `TB-0V:2` and `W063`'s orphan `TB-120:2` each show a row
with a reset, and pressing both clears both banners · `PS1:-2`, `INFEED1:3` and `TB-120:1` are
untouched, being live overrides on ends the wires do touch · a net with an orphaned override behaves
the same · tests **append to `10_tests_end_labels.md`** as new T-numbers; do not start a document.

**Estimate: half a session, $12–28.**

---

## §6 Phase 3c — fix the extractor, do **not** re-extract

Carried from plan 02 `§7` and **re-justified.** It is no longer a coverage story: the reason to do it
is that **the path editor's candidate list is missing 16 runs that land on placed terminals**, so
six relay-coil wires and three `TB-*` bus stretches cannot be lifted from the ink at all and must be
drawn by hand. Fix the code now so drawing number two never has the gap.

**Reading list:** `extract.py:385-465` and `1150-1200`; `EXTRACTION_NOTES.md` line ~7. Nothing else.

**The measured finding** (2026-09-11, by reading the PDF directly): `geometry.json` was built with
`--layers SCHEMATIC`; the drawing also uses PDF layer `"0"`; **41 lines of ≥6 pt on layer `"0"` never
became conductors, and 16 of them land on placed terminals.** 25 of the 41 are the page frame and
the revision table. Specific ink: `TB-110:1`–`:2` at x 781.45, y 485.28→498.05; `TB-120:2`–`:3` at
x 300.05, y 641.35→662.02; `TB-130:1`–`:2` at x 818.66, y 581.72→648.93; `TB-0V:8/:9/:11` at
y 399.55, 416.09, 449.16; all six relay-coil pins.

**The change.** At `extract.py:405`, stop treating *"not in the named layers"* as *"not a
conductor"*, and reject the page furniture **on its geometry** instead — a bounding-box test against
the page edges plus the revision table's rect. **Put the numbers in `prm`, per drawing.** A
hard-coded frame inset is a defect on drawing two even when it makes this sheet right.

**Why the split.** Re-extracting renumbers every `C####`, and there are **957 mentions of a `C####`
id across 30+ files**. Authored work survives either way — every route and every commoning record
stores polylines, with `conductors` as provenance only — but the fixtures do not. **Re-extract when
drawing number two forces a re-run anyway.**

**Acceptance criteria.** A test runs the **new** `extract.py` against `PS20115MLM4-2.pdf` and asserts
the 16 layer-`"0"` lines landing on placed terminals now come through as conductors, **naming the
coordinates above and never a `C####` id** · the same test asserts the page frame and revision table
do **not** come through · `geometry.json` is **not** written and
`git status --short schematic_extraction/` is empty · `EXTRACTION_NOTES.md` records that this
drawing's geometry predates the fix and which ink it is therefore missing · use
`/home/js/schematics/.venv/bin/python`, the only venv with `pymupdf`.

**Estimate: one short session, $10–20.**

---

## §7 The netlist authoring surface — **write a plan, not code**

Items 1, 2, 3 and 6 of the user's authoring list — **notes, whether a component exists, whether a
terminal exists, and which net a terminal is on** — are all one file: `author_circuit_logic.py`, the
one authored input with **no screen**, where the answer to *how do I change this* is still *edit the
file*. That is the sentence this whole line of work exists to delete, one file over.

**Net membership is the sharpest of the four**, because membership is what the highlight paints: a
net a reader can see is wrong can only be fixed in Python today.

**The shape it must take**, and it is bigger than any phase here:

- `circuit_logic.json` is **generated**, so none of this can be authored *into* it. The editor writes
  a **fifth authored input** the generator folds in, exactly as `wiring.json` is.
- Adding a terminal changes the netlist, so it needs the `H25` treatment the `W` table already has:
  an **`added` marker**, a generator that accepts it, and **refusal by name** for everything else.
- Deleting is not deleting. `H25`'s lesson and the wire tombstone both say the same thing: a thing
  that existed and does not now is a record with a reason, not an absence.

**Why it can wait, honestly:** on **this** drawing the tables are right, because the extraction read
them off the paper and the user has been checking them all along. It becomes urgent on **drawing
number two**, where nobody has checked anything and the tables are a machine's first guess.

**This phase writes `_claude_notes/authoring_the_netlist_01.md` and stops.** Plans are documents
first. Estimate **~$8**.

---

## §8 Cables, label and symbol binding, and the citation loop — **write a plan, not code**

Items 6, 7 and 8 of the highlighting list, and they are one problem: **a feature needs an id in
`circuit_logic.json` before the model can cite it.** Ordered **after `§7`**, because `§7` is what
creates ids.

What the plan has to cover:

- **Cables.** The grouping already exists — **8 cables with `member_wires`** — so a cable's
  highlight is the union of its member wires' runs and needs no authoring. **The oval has no
  geometry in the extraction** (98 symbols: 88 `terminal_point`, 10 `device_circle`), so a cable
  boundary is a shape a person draws: `geometry: "human"`, the same claim `TB-130`'s bus makes.
- **Labels.** 515 labels with bboxes exist and `label_corrections.json` authors what each one
  *says*. What nothing authors is what a label is **about** — *this `wire_spec` belongs to `W048`* —
  which is what would let an answer light the printed name it is quoting.
- **Symbols.** Same: a binding from symbol → designator. **Not a symbol editor.** Drawing a symbol
  is inventing ink, which is the argument the user made against a conductor editor and it has not
  changed.
- **The loop itself.** `Citation.tsx` calls `select(kind, id)`; each new highlightable kind is a new
  `kind` there, a new marker or run source on the sheet, and a line in `prompts.py` teaching the
  model that it may cite it.

Estimate **~$8**, plan only.

---

## §9 Deliberately **not** in this plan

- **A conductor editor, and any further view over conductors.** Struck twice — 2026-09-13 as a thing
  to author, 2026-09-15 as a thing to view.
- **Re-extracting `PS20115MLM4-2`.** `§6.` Costs $60–140 and buys convenience on a drawing whose
  data is already authorable by hand.
- **Drawing number two.** `schematic_skills/scripts/bootstrap_wiring.py` exists and has never been
  pointed at a drawing. It is the test of everything here and it wants its own plan.
- **The user's authoring run.** 3 of 71 wires are `source: human`; the run is theirs and no phase
  here touches the queue.
- **A `BONDED_TO` relationship** for the 0 V-to-ground bond. Recorded as `§14` q2; the netlist
  already carries the bond terminal-to-terminal.

---

## §10 Order, sessions, budget

| # | Phase | Session | Est. |
|---|---|---|---|
| — | `§4` — every authored path painted at once, `Unclaimed ink` demoted, the bridge-wire fix | **done 2026-09-15** | **$13.12** |
| 1 | **`§4A` — the Drawing tab points at paths, not conductors** | half | **$12 – $25** |
| 2 | **`§4B` — clicking a path on the Locate tab arms its row** | half | **$10 – $20** |
| 3 | `§5` — the orphaned override rows | half | $12 – $28 |
| 4 | `§6` — the extractor fix, no re-extraction | one, short | $10 – $20 |
| 5 | `§7` — the netlist authoring surface | **plan only** | ~$8 |
| 6 | `§8` — cables, bindings, the citation loop | **plan only** | ~$8 |
| | **Total left** | **4–5 sittings** | **$52 – $109** |

**Why the two new phases go first, ahead of `§5` and `§6`:** they are what the user asked for after
walking `§4`, they reuse `§4`'s layer and `§4A`'s `pickPath` rather than needing anything new, and
together they finish one thought — *the drawing is the index into the queue*. `§5` and `§6` are both
still fully specified and neither has moved.

Priced at Opus 5 API rates: $5/M in, $25/M out, $6.25/M cache write, $0.50/M cache read. **About
$80 of the user's funded $150 remained on 2026-09-17**, after `§4` came in at $13.12 — the low end
of its estimate, and `§11` is why.

---

## §11 The token strategy

**Measured over 28 session transcripts, 2026-09-15: $1,052 spent to date.** Where it goes:

| Session | Calls | Avg context | Total |
|---|---|---|---|
| 2026-09-09 (Phases C+D) | 409 | **407 K** | $98.51 — cache reads were 84% of the bill |
| 2026-09-07 (Phase 0/A/B) | 367 | **407 K** | $107.40 |
| 2026-09-12 (`§4`, executed) | 228 | 136 K | $23.84 |
| 2026-09-13 (`§6`, **implementation only**) | 128 | **100 K** | **$11** |
| 2026-09-15 (the same session: design review, re-plan, three documents) | 190 | 129 K | $32 |
| **2026-09-15 (`§4` here, implementation + four documents)** | **133** | **114 K** | **$13.12** |

**The `§4` session is the model to copy, and what made it cheap is listed rather than praised:** the
plan's reading list was followed and nothing else was opened; four `python3 -c` one-liners answered
every question about the data (route counts, the real `nets` map, the payload's run count); the four
checks ran **twice**, at the start and at the end, in the background and in parallel; and every edit
went in as an exact-string replacement that fails loudly rather than as a re-read of the file. Peak
context was 176 K and the average 114 K, which is where the money is.

**Cost ≈ $0.50 × (context in M tokens) × (number of calls).** Nothing else is close. The spread
between a 400 K session and a 100 K one is **~6× for the same thinking** — and the last row is the
other lesson: **prose at full context is not free either.**

### The rules, in force for every session executing this plan

1. **Read `goals_01.md`, this file, and the phase's reading list. Nothing else from
   `_claude_notes`.** `§0` names the excluded documents and why. This rule alone is worth ~110 k
   tokens.
2. **One phase per session.** Context only grows; a second phase starts at the first one's ceiling
   and pays for it on every call.
3. **Measure the data with `python3 -c`, then read only the code that renders it.** Four one-liners
   answered *how many runs, claimed by what, claimed by whom, which nets does a wire cross* for a
   few hundred tokens each on 2026-09-15.
4. **Read regions, not files.** Every reading list here gives line ranges. `Read` with
   `offset`/`limit`, or `grep -n` for structure and then one targeted read.
5. **Batch the four checks** — start and end, not between edits. A test run at 120 K is a dollar.
6. **Independent calls go in one message.** Six greps in one block cost one call's context.
7. **Never read `geometry.json` or `circuit_logic.json`.**
8. **Do not re-read a file you just edited.** `Edit` fails loudly if it did not apply.
9. **Do not calibrate a test by guessing.** Compute the viewport point from the documented fit
   (`776/1224` px/pt, origin `12, 48.94`); clicking pixels and adjusting costs a test run each try.
10. **Say what the session cost at the end.** The transcripts carry per-call usage and the
    measurement is one script — `§11`'s table is how it is kept honest.

**The budget check.** At **≤ 120 K context and ≤ 200 calls** a session lands near **$20**. By 60
calls you should be at $3–6. **Past $25 before the tests are written, the reading list grew — cut
the phase rather than push it through.**

---

## §12 Standing rules that apply to every phase

1. **`SWUI_ALLOW_EDITS=true` or there is no Locate tab and no Review tab.** True in `server/.env`.
   Editor password `edit-1234`. The routes are registered inside an `if`.
2. **`python -m app` has no reloader** — a change under `server/app/` needs a restart. **The client
   is a built bundle** — a change under `webui/src/` needs `cd webui && npm run build`. **A rebuilt
   bundle against an unrestarted server is the dangerous combination.**
3. **If you start the server, stop it in the same turn. The console is the user's.**
4. **Start from green.** Run the four checks first and read the counts off the run, not off this
   page. The one expected red is
   `test_the_committed_artifact_is_exactly_what_the_generator_writes`, whenever `locations.json` or
   `wiring.json` is ahead of `circuit_logic.json` — that is `K6` working; clear it with the
   generator so you can tell your breakage from the user's.
5. **Do not author anything in the four authored files** — `locations.json`,
   `label_corrections.json`, `wiring.json`, `author_circuit_logic.py`. Verify a write loop with the
   backup / one record through the running server / generator / restore / `md5sum` dance, and prove
   it with `git status --short schematic_extraction/` **unchanged from how you found it**.
6. **Do not auto-accept anything.** Not a proposed endpoint, not a candidate route, not a bus the
   shape rule found, not a conductor list a hand trace computed. `W042` is the standing reason.
7. **Do not commit and do not push.** Read git freely; name the files that want committing and stop.
8. **Do not hand-edit `circuit_logic.json` or `custom_kg.json`.** Both generated:
   ```
   cd schematic_extraction/PS20115MLM4-2/extracted_docs
   python author_circuit_logic.py
   python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate
   ```
   No phase in this plan moves the artifact.
9. **Nothing drawing-specific in `server/app/` or `webui/src/`.** No `TB-`, no `W019`, no `C0060` in
   a gate, a test or a user-visible string. `§4.6` is where this is easiest to break — the fix is
   *either end is a member of this net*, never a net's name.
10. **Hazards to read before touching:** `H18` (three whole-document drafts must not learn about
    each other), **`H26`** (one gesture, two authored files, and a tag is the only thing keeping
    them apart), **`H27`** (a coverage count is only honest beside the traced/total), `H24` (the
    landing rule, before `features/locate/wiring.ts`), `H25` (the `W` table is not the list of
    wires), `H20` (geometry is free and connectivity is not), and **`H28`** — *the denominator is
    the paper, so paint what has been authored, and read it from the published index* (written
    2026-09-15; **read it before `§4A` or `§4B`** — it is the argument both of them continue).
    Still to write: **`H29`** (`§4A`) and **`H30`** (`§4B`).
11. **Three things a reading list will always miss**, learned the hard way: `TargetPanel.tsx` is the
    plumbing for every panel (props interface → sub-panel → call site, three edits);
    `wiringStore.edit` takes **no note**, unlike the locations store's; **a new canvas overlay is
    four edits in `TileSheet.tsx`** — prop, paint call, `data-` attribute, dependency array; and the
    test file for a panel is not named after the panel.

---

## §13 Documents to write

| Phase | Document | T-numbers |
|---|---|---|
| `§4` | `locate_tab_testing/20_tests_all_paths_overlay.md` — **written 2026-09-15** | T-1450–T-1459, **spent** |
| `§4` | a header note on `19_tests_coverage_overlay.md` — demoted to a diagnostic, `?unclaimed=1` — **written** | — |
| `§4A` | `locate_tab_testing/21_tests_clicking_a_path.md` | **T-1500 onward** |
| `§4A` | a demotion note on `16_tests_terminal_wires_and_commoning.md`'s T-1135/T-1140/T-1145 — the conductor verdicts are a diagnostic now | — |
| `§4B` | append to `21_tests_clicking_a_path.md` — one document, one feature, two tabs | **T-1520 onward** |
| `§5` | append to `10_tests_end_labels.md` | next free |
| `§6` | append to `EXTRACTION_NOTES.md` per `§6`'s acceptance criteria | — |
| `§7` | **`_claude_notes/authoring_the_netlist_01.md`** — and stop | — |
| `§8` | a plan document for cables, bindings and the citation loop — and stop | — |
| all | `06_code_map.md` — `H28` **written**; `H29` owed by `§4A`, `H30` by `§4B`; one row per new behaviour | — |
| all | `locate_tab_instruction_and_test_manual.md` — index each new leaf, and correct the troubleshooting rows `§4` makes stale | — |

**Keep them short.** The manual indexes **twenty-one** leaf documents already, and the notes tax
measured in `§11` is why this plan is 33 KB rather than 99 KB. **T-numbers spent reach T-1459, and
`§4A` starts at T-1500** — the gap is deliberate, so a late addition to `20_...` never collides.

---

## §14 Open questions — none are blocking

1. **Should the reader's Drawing tab get the authored-paths field too?** `§4` put it on the Locate
   tab because that is where paths are drawn and where the user asked for it. On the Drawing tab the
   same field would answer *how much of this drawing has been authored* for somebody with no
   password — one prop and one toggle now that `§4` exists. **`§4A` makes it more attractive than it
   was**: a field you can see is a field you can click, and `§4A`'s card is the answer to the click.
   Worth one line in `§4A`'s session if the user asks for it; never assumed.
   *(Also open, and cheaper to settle by looking than by arguing: is slate at 0.35 alpha right on
   the user's screen? T-1450.)*
2. **A net-to-net relationship for the 0 V-to-ground bond.** None of the 402 relationships joins two
   nets, so a model can only find the bond by traversing `CONNECTS_TO` and each terminal's `net`. A
   `BONDED_TO` edge from the generator, or a line in `prompts.py`, would say it outright.
3. **Does a hand-traced bus need draggable corners?** `PathHandles.tsx` would work unchanged — it
   keys on `geometry === 'human'`. There are two hand-drawn buses in the real file now, so the user
   can answer from experience: is re-tracing enough, or does a 0.1 pt correction need a drag?
4. **`CommoningPanel.tsx:123`'s `C0105` tooltip** names this drawing in the client. One line to
   generalise, whenever somebody is next in that file.
5. **`server/app/prompts.py`** teaches the model this sheet's terminal conventions across ~50 lines.
   Not a problem until drawing number two, and then it is that plan's first page.

---

*Plan written 2026-09-15 against commit `22d0b1b` plus the working tree. Every line number and count
in `§3` was read out of the files that day; re-check one with `grep -n` before trusting it if the
tree has moved.*
