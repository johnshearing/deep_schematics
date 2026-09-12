# Highlighting wires and nets, 02 — *a human can author every feature and prove it on the drawing*

Written 2026-09-12. Supersedes nothing; `highlighting_wires_and_nets.md` (the 01) is the paint and
hit-test work that shipped, and **you do not need to read it to execute this.**

---

## §0 How to use this document

**Read this file. Then read only the per-phase reading list in the phase you are executing.**

Do **not** open these, and there is a measured reason below:

| File | Size | Why not |
|---|---|---|
| `change_history.md` | 233 KB | ~58 k tokens. Everything this plan needs from it is quoted here. |
| `authoring_the_wires.md` | 91 KB | ~23 k tokens. Finished except the user's run, which this plan does not touch. |
| `highlighting_wires_and_nets.md` | 99 KB | ~25 k tokens. The work it describes already shipped. |
| `geometry.json` | 620 KB | ~150 k tokens. Never. Use a `python3 -c` one-liner. |
| `circuit_logic.json` | — | Generated. Never read whole. |

That is ~106 k tokens of notes this plan exists to replace. **This file is ~25 KB on purpose.**

**One phase per session. Stop at the phase boundary even if there is context left.** §10 says why in
dollars.

---

## §1 Why this work exists

The user's words, 2026-09-11, after being told the answer to two authoring questions was a hand edit
to `wiring.json` and `locations.json`:

> *"we are making a WebUI that is supposed to allow a human make any required edits to the
> highlighted wiring, commoning, paths, nets and so on. If I had made those edits to the file then we
> lose the opportunity to create the use and utility required to make something that other humans
> will be able to use."*

And the goal, in the same message:

> *"we are trying experimenting with this particular drawing in order to figure out what features are
> required for a system where an ai model can understand any schematic drawing... The human user is
> capable of seeing and pointing at what is on schematic drawings. The ai models are not."*

**The diagnosis.** Every editor in the Locate tab was built as a **confirmation surface**, not an
**authoring surface**. Each panel takes its list of editable objects from something the machine
found, and its edit affordance from a proposal the machine computed. Where the machine found nothing,
there is no row and no button. That is one defect, appearing five times:

| Symptom | Mechanism |
|---|---|
| `TB-110`'s bus cannot be authored `:1`→`:4` | no conductor between `:1` and `:2` → no proposal → `CommoningPanel` has one button and it renders a proposal |
| `TB-130` has no bus at all | same, and the panel blames the reader: *"a question for your eyes rather than a gap in this screen"* — it **is** a gap in the screen |
| Two banners nobody can clear | the override's terminal is not a member, so `TargetPanel` builds no row, so there is no control |
| Six coil wires are "judgement" | the ink stops 46 pt short → nothing offered → no tool, and the notes call that a question for a person |
| `Add a wire` had to be invented | Phase E fixed exactly this, for exactly one object type — *"the door opened one word wide"* |

**Paths are the counter-example and the template.** They have both halves already: `Trace by hand`
(`PathPanel.tsx:273`), draggable corners (`PathHandles.tsx`), and `convertPath` to take an extracted
route and make it yours (`PathPanel.tsx:526`). Commoning has neither half. End-labels have neither.
**This plan gives the other object types what paths already have.**

---

## §2 The goal test

> **A human can point at every feature on the drawing, and the highlighting proves the JSON is a
> complete and correct representation of the sheet.**

Two halves, and only the first exists today:

- **Correct** — per-object highlighting. Select a wire, a net, a terminal; the ink it claims lights
  up. Shipped (Sessions 2–4 of the wires plan, plus the 01 document).
- **Complete** — *nothing on the sheet is unaccounted for.* Today the only way to ask is to click one
  line at a time and read *"no wire claims this run"*. **§6 makes that a view instead of 149 clicks.**

Everything in this plan serves that sentence. Nothing else is in scope.

---

## §3 What exists that you will reuse — measured 2026-09-12

Verified by reading the files, not the notes. Line numbers are as of commit `902895f` plus the
working tree.

**The trace machinery (the pattern to copy for §4):**

| Thing | Where |
|---|---|
| `tracing` state — the corners so far, `null` for not tracing | `webui/src/features/locate/LocateTab.tsx:300` |
| `trace(start\|finish\|back\|abandon)` — the state machine | `LocateTab.tsx:801-824` |
| Sheet click appends a corner while tracing | `LocateTab.tsx:1314` |
| `Enter` finishes, `Backspace` un-corners, `Esc` abandons | `LocateTab.tsx:892-900`, `728-760` |
| Handles are offered for hand-traced routes only | `LocateTab.tsx:615-624` (gated `kind !== 'wire'`) |
| `Tracing` — the in-progress panel ("n corners so far") | `PathPanel.tsx:629` |
| `tracePath` — what a finished trace writes | `features/locate/model.ts:709` |

**Commoning, today:**

| Thing | Where |
|---|---|
| `CommoningPanel` — one button, renders a proposal | `features/locate/CommoningPanel.tsx` (255 lines) |
| The dead-end copy to delete | `CommoningPanel.tsx:104-110` |
| The early return that hides the panel with no proposal | `CommoningPanel.tsx:72` |
| `setCommoning` — writes `geometry: 'extracted'`, hard-coded | `features/locate/wiringModel.ts:597` |
| `clearCommoning`, `setCommoningNote`, `commoningCoverage` | `wiringModel.ts:627`, `636`, `662` |
| `commoningFor` — the ink's proposal (the shape rule) | `features/locate/wiring.ts` |

**The server already accepts a hand trace. This is the single most important finding in §3:**

`server/app/wiring.py:182` — `GEOMETRIES = ("extracted", "human")`, `ATTRIBUTIONS = ("printed",
"human")`, and `_commoning` (`wiring.py:464`) refuses only `derived`, a run of fewer than two points,
a non-pair point, a bad `page`, and a non-list `conductors`. Its own docstring reads *"a block's bus
is lifted from the ink **or traced by a person**"*.

> **§4 is client-only. No server change, no schema change, no migration.**

**End-labels (§5):**

| Thing | Where |
|---|---|
| `members` and `overrides`, side by side already | `features/locate/TargetPanel.tsx:262-263` |
| `EndLabelRow`, and its reset path `onSet(null)` | `TargetPanel.tsx:398`, `430` |
| The banner, and the drop that makes it harmless | `server/app/locations.py` ~`1000-1010` |

Banner text, exactly: `locations.json puts a label on 'TB-0V:2' for W019, which W019 does not touch`.

**Coverage (§6) — every input is already on the page:**

| Thing | Where |
|---|---|
| All 149 runs of ink, client-side, no password | `features/drawing/DrawingTab.tsx:172` (`appStore.conductors`) |
| `claims` — conductor id → wire, and → block | `DrawingTab.tsx:478` via `hitTest.ts:124` `claimsFrom` |
| `Claims.wires` / `.traced` — the honesty denominator | `hitTest.ts:109-112` |
| `paintRuns`, and the two styles to sit beside | `features/drawing/paint.ts:229`, `HIGHLIGHT:172`, `CANDIDATE:191` |

**The extractor (§7):**

| Thing | Where |
|---|---|
| The layer gate | `schematic_skills/scripts/extract.py:405` |
| The conductor test that gate feeds | `extract.py:440` |
| `--layers` CLI flag | `extract.py:1160` |
| The only venv with `pymupdf` | `/home/js/schematics/.venv/bin/python` |

**The measured finding §7 acts on** (2026-09-11, by reading the PDF directly): `geometry.json` was
built with `--layers SCHEMATIC`; the drawing also uses PDF layer `"0"`; **41 lines of ≥ 6 pt on layer
`"0"` never became conductors, and 16 of them land on placed terminals.** 25 of the 41 are the page
frame and the revision table. Specific ink: `TB-110:1`–`:2` at x 781.45, y 485.28→498.05;
`TB-120:2`–`:3` at x 300.05, y 641.35→662.02; `TB-130:1`–`:2` at x 818.66, y 581.72→648.93;
`TB-0V:8/:9/:11` at y 399.55, 416.09, 449.16; all six relay-coil pins.

---

## §4 Phase 2a — trace a block's bus by hand

**The deliverable.** `TB-110`'s commoning is authored as one run from `:1` to `:4`, **through the
screen, with no file edit.** Same for `TB-130` and `TB-120`. The panel stops telling the reader their
eyes are the problem.

**Reading list (and nothing else):** `CommoningPanel.tsx` whole (255 lines); `wiringModel.ts:560-680`;
`LocateTab.tsx:290-320`, `600-630`, `700-910`, `1240-1340`; `PathPanel.tsx:620-655`; `model.ts:700-745`.

### 4.1 `traceCommoning` in `wiringModel.ts`

Add beside `setCommoning` (line 597). Mirror `model.ts:tracePath` (line 709):

```
traceCommoning(document, block, corners, stamp, conductors?) → WiringDocument
  corners.length < 2  → return document unchanged   (one point is not a bus)
  runs:        [corners.map(([x,y]) => [round(x), round(y)])]
  geometry:    'human'        ← the polyline is the person's
  attribution: 'human'        ← a person said this is the block's own bus
  conductors:  see 4.2        ← the honest weaker claim, omitted when empty
  by / at:     from stamp
```

Keep `setCommoning` exactly as it is. Two writers, two claims, and the file can say which: `extracted`
means *these corners are the drawing's*, `human` means *these corners are mine*. That distinction is
already load-bearing for paths (`PathPanel.tsx:523` refuses to drag an extracted corner) and the
badge at `CommoningPanel.tsx:82-92` should grow a third reading for it.

### 4.2 Decision: a hand trace **does** record the conductors it runs along

**This is the one decision in this plan that is not obvious, and §6 depends on it.**

A hand-traced bus with `conductors: []` claims no conductor ids. `claimsFrom` (`hitTest.ts:124`) maps
*conductor id → block* out of `bus.conductors`. So a hand trace along real ink would leave that ink
reading **unclaimed** in §6's coverage view, forever — the sheet would report a gap where the person
has just done the work.

So at finish-trace time, compute the conductor ids the polyline runs along by proximity and store
them. `conductors` is documented as a provenance note, not as the geometry — `CommoningPanel.tsx:132`
already prints `'hand-traced'` when the list is empty — so this is the honest weaker claim riding
along with the stronger one, which is exactly the shape the user was offered for `TB-110` on
2026-09-11: `runs` hand-drawn, `conductors: ["C0060", "C0077"]`.

Reuse the projection in `hitTest.ts` (`project`, behind `pickRun`). **Do not write a second
projection** — invariant 2, one projection in this application.

Where the ink genuinely is not there (`TB-130`, and `TB-110:1`–`:2` until §7), the list comes back
short or empty and that is correct: the polyline is the claim, and `'hand-traced'` is the right word
on screen.

### 4.3 `CommoningPanel` grows a second button

- Add `Trace by hand`, styled and worded like `PathPanel.tsx:273`.
- **Delete the copy at `CommoningPanel.tsx:104-110`.** It is wrong (it is a gap in the screen) and it
  hard-codes `TB-130` in user-visible text, which violates the generalise rule. Replace with the
  neutral statement plus the button.
- The `Take it back` path (`:181`) works unchanged — `clearCommoning` deletes the record, and for a
  hand trace *no record* and *nobody authored this* are still the same state.
- `NoteBox` (`:216`) works unchanged.

### 4.4 The early return at `CommoningPanel.tsx:72` — and the trap in fixing it

```
if (!wiring || (!record && proposal.runs.length === 0 && ink !== null)) return null
```

That is what hides the panel on a block the ink says nothing about. It has to go, or `TB-130` stays
unauthorable. But the comment above it is right: *"a panel that appeared on all 47 of them would be
noise on the 41 that have no bus and never will."*

**The gate must be structural, not by name.** `entry.terminals` with **two or more** members is the
test — a thing with two pins can have a bus between them. **Do not test for a `TB-` prefix.** The
user's standing rule: *"If you find yourself typing `TB-` into the server or the client, stop."*

(Worth knowing: that rule is already broken in this file, at `:108` and `:123`. §4.3 fixes `:108`.
`:123`'s `C0105` example is in a `title` tooltip; leave it or generalise it, but do not spend the
session on it.)

### 4.5 The hard part: the trace state machine writes to one of **two** documents

Today `trace('finish')` (`LocateTab.tsx:816-822`) always calls `tracePathInto` → `locations.json`,
and handles are gated on `targetEntry?.kind !== 'wire'` (`:621`).

Give the trace a target discriminator, set when it starts and read when it finishes:

```
type TraceTarget =
  | { kind: 'path';      wire: string }    → model.tracePath      → locations.json
  | { kind: 'commoning'; block: string }   → traceCommoning       → wiring.json
```

`setTracing([])` becomes *set corners **and** target*. `trace('finish')` dispatches on the target and
calls the one `edit` function for that document. `Esc`/`Backspace`/the click-to-corner path at
`:1314` are document-agnostic and do not change.

**This is `H18`'s boundary, and the trace is now a second place two documents meet.** `H18` says the
three whole-document drafts must not learn about each other, and `wiringModel.pathStale` is the one
place they meet — *as arguments*. The trace target is the second, and it must meet them the same way:
the state machine holds a tagged id and hands it to one writer. It must never hold both documents.

**Write `H26` in `06_code_map.md` for this.** Suggested wording: *the trace state machine is shared by
two documents and the tag is the only thing keeping them apart; a trace that could write both would be
one gesture editing two files.*

Lift `Tracing` out of `PathPanel.tsx:629` to a shared module if it needs the block's name; it is
already document-agnostic, so prefer passing a label over duplicating it.

### 4.6 Acceptance criteria

1. `TB-110`'s bus is authored as **one run, `:1` centre to `:4` centre, ≈46.8 pt**, entirely from the
   screen. The record reads `geometry: "human"`, `attribution: "human"`, and `conductors` containing
   `C0060` and `C0077` (per §4.2) — **not** an empty list, because that ink is real.
2. `TB-130` is authored across its two points 71 pt apart, `conductors` empty or absent, and the panel
   says `hand-traced`.
3. **`circuit_logic.json` does not move.** `test_commoning_does_not_reach_the_netlist` already asserts
   this in bytes; it must stay green for a hand-traced record too.
4. A block with fewer than two terminals shows no panel. The panel does not appear on all 47
   components.
5. `Esc` mid-trace leaves `wiring.json` byte-identical.
6. The four checks green.

**Prove it the way every session since Session 2 has:** back the file up, write one record through the
running server, re-run the generator, restore, and show `git status --short schematic_extraction/`
coming back **empty**. **Do not author the user's data.** The run is theirs.

**What this unblocks for the user immediately:** the `Commoning` filter's six blocks all become
authorable, including the three the notes have been carrying as *questions for your eyes* since
2026-09-06. `wiring.json` currently holds 4 commoning records.

---

## §5 Phase 2b — the override nobody can reach

**The deliverable.** Both banners clear from the screen.

**Reading list:** `TargetPanel.tsx:250-300` and `390-460`. Nothing else.

Today (`TargetPanel.tsx:262-263`):

```
const members   = entry.terminals ?? []
const overrides = endLabelsOf(document, entry.id)
```

and one `EndLabelRow` per **member**. An override keyed on a terminal the wire no longer touches has
no row, so no eye icon, so no way back. The compass control that created it cannot reach it.

**The change.** Compute the orphans and render them as extra rows:

```
orphans = Object.keys(overrides).filter(id => !members.some(m => m.id === id))
```

Each orphan row says plainly that the wire does not touch this terminal any more, and carries **one**
control — a reset that calls the existing `onSet(null)` path (`TargetPanel.tsx:430`). No compass, no
eye: there is nothing to aim.

**Both halves stay inside one document,** so this does not offend `H18`: `end_labels` and `members`
are both `locations.json`.

**It must work for nets as well as wires.** `locations.py` refuses *"labels the ends of X, which is
not a wire **or net** in the netlist"* — `end_labels` is keyed by either.

**No server change.** The banner is `resolve_geometry` doing its job; it goes quiet when the key goes.

### Acceptance criteria

1. `W019`'s orphan `TB-0V:2` and `W063`'s orphan `TB-120:2` each show a row with a reset, and pressing
   both clears both banners.
2. `PS1:-2`, `INFEED1:3` and `TB-120:1` are untouched — those are live overrides on ends the wires do
   touch.
3. A net with an orphaned override behaves the same.
4. Tests go in `10_tests_end_labels.md` as new T-numbers; do not start a new document for this.

---

## §6 Phase 2c — the coverage overlay: *proving the JSON is complete*

**The deliverable.** One toggle on the Drawing tab paints every run of ink that **nothing** claims —
no wire's route, no block's bus. Unaccounted-for features become visible at a glance instead of being
found by clicking 149 times.

This is the half of §2 that does not exist, and it is the reason the user asked for it in scope.

**Reading list:** `DrawingTab.tsx:160-200`, `270-330`, `450-490`, `780-830`, `900-930`;
`hitTest.ts:96-150`; `paint.ts:150-250`. Nothing else.

### 6.1 The computation — three lines, no new fetch

Every input is already on the page. A conductor is **unclaimed** when its id appears in neither
`claims.byConductor` nor `claims.commoning` (`DrawingTab.tsx:478`, built by `hitTest.ts:124`).

Add an `UNCLAIMED` `RunStyle` beside `HIGHLIGHT` (`paint.ts:172`) and `CANDIDATE` (`:191`), and paint
through the existing `paintRuns` (`:229`). **Do not add a second paint path** — invariant 2 again, one
projection, and `paint.ts` is where the sheet is drawn.

### 6.2 Off by default, and the reason is in the code already

`DrawingTab.tsx:281` records the user's own objection to a previous overlay: *"this adds clutter and
confusion to the drawing"*. A permanently-lit sheet repeats that mistake. The toggle starts off and
does not persist across a reload.

### 6.3 The legend is not optional — `H27`

`Claims` already carries `wires` and `traced` with the comment (`hitTest.ts:109-112`):

> *"**The honesty requirement**: a verdict of *no wire claims this run* means very little at 3 of 71
> and a great deal at 71."*

At the time of writing, `wiring.json` has **3 of 71** wires marked `source: human` and
`locations.json` has **62** wire routes. So the overlay must print, beside the count of unclaimed
runs, **how many wires have a route at all**. Without it the view invites exactly the wrong
conclusion: *"look how much ink is unaccounted for"* when the real answer is *"almost nothing has been
authored yet."*

**Write `H27` in `06_code_map.md`:** *the coverage overlay is only honest beside the traced/total
count; shipped alone it is a number that means the opposite of what it looks like.*

### 6.4 Acceptance criteria

1. With the overlay on, the painted runs are exactly the conductors in neither claim map, and the
   count reconciles against the sheet's total runs of ink (149 at the time of writing — get the number
   with a one-liner, do not hard-code it).
2. The legend shows unclaimed count **and** `n of m wires have a route`.
3. Authoring `TB-110`'s bus by hand (§4) **removes** its conductors from the unclaimed set — this is
   the cross-check on §4.2 and the reason that decision is in §4 rather than here.
4. Off by default; toggling off restores the sheet exactly.
5. Tests in a new `19_tests_coverage_overlay.md`, T-1400 onward.

---

## §7 Phase 1-cheap — fix the extractor, do **not** re-extract

**The deliverable.** `extract.py` stops dropping conductors on unnamed layers, **and
`PS20115MLM4-2/geometry.json` is not regenerated.**

**Reading list:** `extract.py:385-465` and `1150-1200`. `EXTRACTION_NOTES.md` line ~7. Nothing else.

### 7.1 Why the split, in one measurement

Re-extracting renumbers every `C####`. **There are 957 mentions of a `C####` id across 30+ files** —
20 under `webui/src` (including `paths.test.ts`, `wiring.test.ts`, `hitTest.test.ts`,
`LocateTab.test.tsx`), 10 under `server` (including `test_conductors.py`, `test_paths.py`,
`test_extraction_generator.py`), and 10 notes documents. Fixing the extractor costs almost nothing;
re-baselining those ids is a session of mechanical work and the dearest thing in the original
ordering. **Authored work survives either way** — all 58 routes and every commoning record store
polylines, with `conductors` as provenance only — but the fixtures do not.

So: **fix the code now, so drawing number two never has this gap. Re-extract when drawing number two
forces a re-run anyway.**

### 7.2 The change

At `extract.py:405`:

```
if layers and layer not in layers:
    wanted = False            # only conductors are restricted; glyph strokes are kept
```

and `:440` gates conductor segments on `wanted`. The fix is to stop treating *"not in the named
layers"* as *"not a conductor"*, and to reject the page furniture on its geometry instead.

**Reject by shape, not by layer name.** 25 of the 41 layer-0 lines are the page frame and the revision
table; 16 land on placed terminals. A bounding-box test against the page edges plus the revision
table's rect removes the furniture without naming a layer. **Put the numbers in `prm`, per drawing —
not as constants in the code.** A hard-coded frame inset is a defect on drawing two even when it makes
this sheet right.

This matters to §6 directly: **without the furniture filter, the coverage overlay would light up the
page border forever.** Ship them in the same plan and the border never appears.

### 7.3 Acceptance criteria — proven without moving a single id

1. A test runs the **new** `extract.py` against `PS20115MLM4-2.pdf` and asserts that the 16 layer-0
   lines landing on placed terminals now come through as conductors — naming the coordinates in §3, not
   `C####` ids, because ids are what this phase refuses to move.
2. The same test asserts the page frame and revision table do **not** come through.
3. `geometry.json` is **not** written. `git status --short schematic_extraction/` comes back empty.
4. `EXTRACTION_NOTES.md` records that this drawing's `geometry.json` predates the fix and which ink it
   is therefore missing — so the next person does not re-derive the finding a fourth time.
5. Use `/home/js/schematics/.venv/bin/python`. It is the only venv here with `pymupdf`; `server/.venv`
   does not have it and neither does system `python3`.

---

## §8 Deliberately **not** in this plan

- **Re-extracting `PS20115MLM4-2`** (the "1-full" option). §7.1. Costs $60–140 and buys convenience on
  a drawing whose data is already authorable by hand once §4 ships.
- **Drawing number two.** `schematic_skills/scripts/bootstrap_wiring.py` exists and has never been
  pointed at a drawing. It is the test of everything here and it wants its own plan.
- **The `Ask` tab driving the highlight.** The loop is already closed one click wide —
  `prompts.py` makes the model spell identifiers, `Markdown.tsx` renders them as `Citation`, and
  `Citation.tsx:54-56` calls `select(kind, id)` and switches tabs. Widening it to a whole net is the
  next real feature *after* this plan, and the user's ordering is deliberate: the highlighting must be
  trustworthy before anything reasons on top of it.
- **The user's authoring run.** 3 of 71 wires are `source: human`. §4 unblocks the commoning half of
  it; nothing here touches the wire queue.

---

## §9 Order, sessions, budget

**Item 2 before item 1**, by the user's decision on 2026-09-12 and for the reason in §7.1.

| # | Phase | Session | Est. |
|---|---|---|---|
| 1 | §4 — hand-trace a block's bus | one, whole | $25 – $55 |
| 2 | §5 — orphaned override rows | half; may share a session with §6 | $12 – $28 |
| 3 | §6 — the coverage overlay | one | $25 – $50 |
| 4 | §7 — the extractor fix, no re-extraction | one, short | $10 – $20 |
| | **Total** | **3–4 sessions** | **$72 – $153** |

Priced at Opus 5 API rates: $5/M in, $25/M out, $6.25/M cache write, $0.50/M cache read. The user
funded ~$150 for this. **§10 is how it stays inside that**, and it is not advice — the same work has
cost 3× this in this project.

---

## §10 The token strategy

**Measured from 26 session transcripts of this project, 2026-09-12. Total spent to date: $1,031.76;
mean $39.68 per session; dearest $121.34.**

Where it goes:

| Session | Calls | Avg context per call | Cache reads | Total |
|---|---|---|---|---|
| 2026-09-09 (Phases C+D) | 409 | **407 K** | $82.60 — **84% of the bill** | $98.51 |
| 2026-09-07 (Phase 0/A/B) | 367 | **407 K** | $73.23 | $107.40 |
| 2026-09-11 (analysis only) | 99 | 65 K | $3.13 | $6.27 |
| 2026-09-12 (this plan) | ~70 | 57 K | ~$1.50 | ~$8 |

**Cost ≈ $0.50 × (context in M tokens) × (number of calls).** Nothing else is close. Two sessions ran
at 407 K of context four hundred times over. The spread between a 400 K session and a 60 K one is
**~7× for the same amount of thinking.**

### The rules, in force for every session executing this plan

1. **Read this file and the phase's reading list. Nothing else from `_claude_notes`.** §0 names the
   three big documents and why they are excluded. This rule alone is worth ~106 k tokens.
2. **One phase per session.** Context only grows. A second phase starts at the first one's ceiling and
   pays for it on every call.
3. **Read regions, not files.** Every reading list in §4–§7 gives line ranges. `Read` with
   `offset`/`limit`, or `grep -n` for structure first and then one targeted read.
4. **Batch the checks.** Run the four at the start and at the end, not between edits. Each run is a
   call at full context; ten speculative runs at 120 K cost more than the code.
5. **Never read `geometry.json` or `circuit_logic.json`.** `python3 -c` printing a summary.
6. **Do not re-read a file you just edited.** `Edit` fails loudly if it did not apply.
7. **Independent calls go in one message.** Six greps in one block cost one call's context, not six.

### The budget check

At **≤ 120 K context and ≤ 200 calls**, a session lands near **$20**. Sanity marks while working: by
60 calls you should be around $3–6; if you are past $25 before the tests are written, the reading list
grew and the phase should be cut, not pushed through.

**Say at the end of the session what it cost** — the transcripts carry per-call usage and the
measurement is one script.

---

## §11 Standing rules that apply to every phase

1. **`SWUI_ALLOW_EDITS=true` or there is no Locate tab and no Review tab.** True in `server/.env`.
   Editor password `edit-1234`.
2. **`python -m app` has no reloader** — a change under `server/app/` needs a restart. **The client is
   a built bundle** — a change under `webui/src/` needs `cd webui && npm run build`. **A rebuilt bundle
   against an unrestarted server is the dangerous combination.**
3. **If you start the server, stop it in the same turn. The console is the user's.**
4. **Start from green**, at 261 server · 458 web · ruff clean · tsc clean. The one expected red is
   `test_the_committed_artifact_is_exactly_what_the_generator_writes`, whenever `locations.json` or
   `wiring.json` is ahead of `circuit_logic.json` — that is `K6` working. Clear it with the generator
   first so you can tell your breakage from the user's.
5. **Do not author anything in the four authored files** — `locations.json`, `label_corrections.json`,
   `wiring.json`, `author_circuit_logic.py`. The run is the user's. Verify write loops with the
   backup/restore/`md5sum` dance and prove it with an empty `git status --short schematic_extraction/`.
6. **Do not auto-accept anything.** Not a proposed endpoint, not a candidate route, not a bus the shape
   rule found, and not a conductor list a hand trace computed. `W042` is the standing reason.
7. **Do not commit and do not push.** Read git freely. Name the files that want committing and stop.
8. **Do not hand-edit `circuit_logic.json` or `custom_kg.json`.** Both generated:
   ```
   cd schematic_extraction/PS20115MLM4-2/extracted_docs
   python author_circuit_logic.py
   python ../../../schematic_skills/scripts/build_kg.py circuit_logic.json -o custom_kg.json --pretty --validate
   ```
   Neither §4 nor §5 nor §6 moves the artifact. §7 does not either, because it does not re-extract.
9. **Nothing drawing-specific in `server/app/` or `webui/src/`.** No `TB-` in a test, a gate or a
   string. §4.4 is where this rule is easiest to break.
10. **Hazards to read before touching:** `H18` (three drafts, and §4.5 adds a second meeting point),
    `H24` (the landing rule, before `features/locate/wiring.ts`), `H25` (the `W` table is not the list
    of wires), `H20` (geometry is free and connectivity is not). New: **`H26`** (§4.5), **`H27`** (§6.3).

---

## §12 Documents to write

| Phase | Document | T-numbers |
|---|---|---|
| §4 | `_claude_notes/locate_tab_testing/18_tests_hand_traced_commoning.md` | T-1300 onward |
| §5 | append to `10_tests_end_labels.md` | next free |
| §6 | `_claude_notes/locate_tab_testing/19_tests_coverage_overlay.md` | T-1400 onward |
| §7 | append to `EXTRACTION_NOTES.md` per §7.3.4 | — |
| all | `06_code_map.md` — `H26`, `H27` | — |
| all | `locate_tab_instruction_and_test_manual.md` — index the new leaves in §5a | — |

**Keep them short.** The test manual is an index over seventeen leaf documents already, and the notes
tax measured in §10 is the reason this plan is 25 KB rather than 99 KB.

---

## §13 Open questions — none are blocking

1. **Does a hand-traced bus need draggable corners?** `PathHandles.tsx` would work on it unchanged,
   since it keys on `geometry === 'human'`. Deliberately left out of §4 to keep the phase one session.
   Cheap to add later; ask the user whether re-tracing is good enough first.
2. **`CommoningPanel.tsx:123`'s `C0105` tooltip** names this drawing in the client. Out of scope
   above; worth a line when someone is next in that file.
3. **`server/app/prompts.py`** teaches the model this sheet's terminal conventions across ~50 lines.
   Not a problem until drawing number two, and then it is that plan's first page.

---

*Plan written 2026-09-12 against commit `902895f` plus the working tree. Every line number and count
in §3 and §7.1 was read out of the files that day; re-check a line number before trusting it if the
tree has moved.*
