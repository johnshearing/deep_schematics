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

## NEXT UP — Job B, attempt 2: the Locate editor

**This section is the plan, not the record. It is written to be the only thing a new session
needs to read before starting. Everything below it is history.**

Attempt 1 of Job B was rejected by the user on 2026-08-15 and is archived, unmerged, on the
local branch `job-b-attempt-1`. Read *What attempt 1 got wrong* before writing any code; the
rejection was architectural, not a matter of bugs, and a second attempt that does not
understand why will rebuild the same thing.

### State of the repository, verified 2026-08-15

    main          6e9276e, unchanged, tracks origin/main. NOTHING HAS BEEN PUSHED.
                  Uncommitted in the working tree, all accepted and all green:
                    Job A       server/app/prompts.py, server/tests/test_invocation.py
                    fault 4     webui/src/features/drawing/MarkerLayer.tsx
                                webui/src/features/drawing/DrawingTab.test.tsx
                  plus these notes.
    job-b-attempt-1   beb85a7  Job A alone, so it can be restored independently
                      7003dfb  Job B attempt 1 — NOT ACCEPTED. Study only. Local only.

- Tests on `main` right now: **67 server**, **59 web**; `ruff` and `tsc -b` clean.
- **`server/app/static/` is gitignored.** Git cannot roll the built bundle back, so after any
  checkout that changes the client, run `npm run build` or the server serves stale JavaScript.
  This bit once already.
- The remote is the last known-good state. Do not push until Job B attempt 2 works and the
  user says so.

### The four reported faults, and their real status

| | Fault | Status on `main` |
|---|---|---|
| 1 | `TB-PB2SP`'s dot on the wrong conductor — authored (196, 382), actual row y = 348.3 | **open** |
| 2 | Selecting `CR-ON:A2` labels the marker `CR-ON` and puts it where `CR-ON:A1` is | **open** — `DrawingTab.tsx:68`, `entry?.kind === 'component' ? entry.id : null`. That ternary *is* the fault |
| 3 | `CR-SW:14` flies to the coil at (861, 704); the contact is drawn at (569, 473) | **open** |
| 4 | A labelled marker's dot does not sit on its own point | **FIXED 2026-08-15**, uncommitted on `main`, done independently of Job B |

**Fault 4 is done and needs no further work.** It was fixed on its own because the fix is pure
DOM structure with no drawing-specific logic in it, so it had no reason to wait for the editor:
the *button* is now the dot (no flex, no gap), so its two translations centre the dot on the
point, and the label is absolutely positioned inside it through a new `LABEL_SIDE` constant,
contributing nothing to the button's size. The label stays inside the button so it remains a hit
target and the marker keeps one focusable half. `LABEL_SIDE` is east-only on purpose — when a
per-point side arrives from the Locate editor it becomes an eight-way lookup and nothing else in
that file changes. Seven unused directions were not written.

Pinned by `anchors the dot on the point, so a label cannot drag it sideways` in
`DrawingTab.test.tsx`, lifted from `7003dfb`. That test was verified to **fail** against the old
flex-row structure before being kept — jsdom does no layout, so it asserts the mechanism (the
button's box is the dot's box; the label is out of flow and cannot contribute to it) rather than
a measured offset.

Note for anyone reading older screenshots: fault 4 made *every* labelled dot look misplaced, and
it is a different cause from the misplacement the user complained about in attempt 1. Do not
conflate them. Faults 1, 2 and 3 remain open and are the editor's job.

### What attempt 1 got wrong — the learning, in the user's words and mine

Attempt 1 built `locations.json` plus a server-side derivation engine (`derive.py`,
`scripts/seed_locations.py`) that proposed and ranked coordinates from two kinds of evidence.
All 101 of its tests passed. It was still the wrong thing, for five reasons.

**1. It was fitted to this one drawing.** Every constant in it traces to a fault observed on
`PS20115MLM4-2`: the 45 pt limit past which a candidate is reported but not written, the 60 pt
radius inside which a derived site suppresses the authored one, the refusal to net-project
contact-function pins on a component that also has coil pins (which exists only because
`CR1:11` landed 400 pt away at the coil), and exact-text-only OCR matching (whose stated reason
is that *this* OCR reads `A1` as `AL` and `CR1` as `CRI`). On a second sheet — different hand,
different row pitch, different OCR failures — not one of those numbers is justified and the
exclusion rules may be silently wrong. **The goal is a library of many drawings; the test any
design must pass is whether it survives drawing number two. This failed that test.**

**2. A mediocre guesser makes work rather than saving it.** Screening the 41 located components
against every wire endpoint, terminal dot and junction in `geometry.json` gives a median
distance of **11 pt, with 17 over 15 pt and 10 over 25 pt** — on a sheet whose conductor rows
are **16 pt apart**. So the machine's accuracy is roughly a coin flip on *which row*, which is
the only thing that matters. A human must then audit every proposal instead of placing every
point, which costs about the same per point and costs *more* when a proposal is confidently
wrong, because first you have to notice that it is. A derived tier only pays if accuracy is very
high or confidence is well calibrated. This was neither.

**3. It made some dots worse, which was its whole justification.** `resolve_geometry`'s
precedence meant a terminal that used to borrow a reasonable parent point could instead inherit
a *derived site* that was further away, and `MarkerLayer` drew one dot per place — so a
component that picked up a spurious second site got a spurious second dot. Adding a guessing
layer added wrong dots. That is not a bug in it; it is what a guessing layer does.

**4. Guessing belongs at index time, once.** The extraction's vision pass already produced
`components[].location`. **That is the guess** — made by the thing actually looking at the
pixels, at the one moment a human is already in the loop, since step 4 of the extraction skill
is deliberately interactive. `derive.py` was a *second*, independent guessing stage, in a
different language of evidence, living in the server, running long after the drawing was read,
and unable to see the drawing at all. Two guessers with different owners and different failure
modes. The user's rule, and it is the right one: **Claude gets its one chance to guess when the
schematic is indexed; after that a human owns the positions.**

**5. It built the accelerator and shipped it without the thing it accelerates.** The deliverable
was always the editor (Job C in `drawing_fixes_plan_01.md`). Attempt 1 delivered 14 files of
data plumbing and derivation and no editor, which is why the user's reaction was "much more
complicated with many unnecessary files and scripts." **Effort belongs in making placement fast,
not in guessing well.** 131 terminals at three seconds a click is under seven minutes. A fast
editor beats a good guesser outright, and it never lies to you.

### What to build in attempt 2

One thing: **the editor the user described.** "A list of all indexed components and wires that
lets me place dots and labels in the correct position, and lets me drag misplaced dots and
labels to their correct positions."

1. **A `Locate` tab** — `webui/src/features/locate/`, added to `tabs.ts`. `DrawingTab.tsx` is
   the worked example of a second tab; read `tabIds.ts`'s no-cycle rule first.
2. **A list of every indexed designator**, with a placed/unplaced state and a coverage count.
   The index is 275 entries: 47 components, 131 terminals, 26 nets, 71 wires. **Only components
   and terminals need a point.** A wire's geometry is its two endpoint terminals and a net's is
   its members, so they are computed, never placed — placing terminals gives all 71 wires their
   positions for free. Show them in the list anyway so the user can see and verify the result,
   but marked as derived-from-endpoints, not as work to do.
3. **Click to place. Drag to correct.** Drag was missing from the original Job C design and the
   user is right that it is the obvious gesture for a dot that is visibly in the wrong spot.
   Keyboard advance so a run of placements never needs the mouse to leave the sheet.
4. **`locations.json` as the second authored file**, human-owned. The authored/generated rule,
   already agreed with the user:

        AUTHORED    author_circuit_logic.py   netlist: what connects
                    locations.json            geometry: where it is drawn (human + editor)
                              ↓ python author_circuit_logic.py
        GENERATED   circuit_logic.json, custom_kg.json

5. **Provenance with three states and no fourth**: `confirmed` (a human placed it), `seed` (the
   extraction's own vision estimate, never dressed up as knowledge), `parent` (a terminal shown
   at its component's point, always flagged). There is no `derived`, because nothing derives.
   The UI must draw unconfirmed points differently from confirmed ones — nobody should be told
   we know where `CR-BP:12` is while being shown an estimate.
6. **Sites, kept.** `CR-BP` is drawn **three** times on this sheet (coil, `11`/`12` NC contact,
   `21`/`24` NO contact), so component shape is per-drawing data and any fixed "coil + contact"
   schema is wrong on arrival. A component has N sites; each site claims specific pins, and
   **that assignment is explicit and human, never inferred from a pin's `function`** — `CR-BP`
   has two terminals whose function is `common` (`11` and `21`) at different sites.
7. **The editor behind its own password.** The user's requirement, and the reasoning is theirs:
   permission to spend tokens and permission to edit the drawing are different permissions.
   `editor_password` and an off-by-default `allow_edits` in `config.py`; with `allow_edits`
   false the routes are **never registered**; `/api/health` publishes
   `editing: {enabled, password_required}`; `POST /api/editor/unlock` mirrors `/api/unlock` at
   the same `5/minute`, scope in memory only; `PUT /api/locations` requires that scope, is
   whole-file and atomic (`os.replace`), and is refused if `drawing_number` disagrees.
8. **Two things that will bite if forgotten.** `load_locations` is `lru_cache`d, so the writer
   **must** call `load_locations.cache_clear()` or it saves a point and is handed back the old
   one. And after a write, `circuit_logic.json` is stale until `author_circuit_logic.py` is
   re-run — show a banner; do not run Python from the UI.
9. **Validate per field, and publish what was refused.** One typo costs that field, not the
   drawing, and everything refused lands in a `problems` list the UI shows. A coordinate a human
   typed and the server silently ignored is the worst outcome available here.
10. **Reuse the one projection.** `useTileViewport`, `TileSheet`, `paint.ts`'s `pointToCss` and
    `MarkerLayer`. There is one projection in this application and this must not add a second.
11. **Fold in fault 2** (fault 4 is already fixed) — a dedicated selection marker at the
    selection's own point labelled `entry.id`, replacing the `DrawingTab.tsx:68` ternary, so
    `CR-ON:A2` reads `CR-ON:A2` instead of borrowing its parent's marker. Faults 1 and 3 are
    fixed by the editor itself: they are wrong coordinates, and a human placing points is the
    fix. Do not chase them in code.

### What not to build, and why each one is here

- **No `derive.py`, no `seed_locations.py`, no ranking, no 45 pt or 60 pt thresholds, no
  net projection, no printed-label matching.** This is the whole point of attempt 2.
- **No fuzzy text matching, ever** — but note the corollary: since nothing is being matched
  automatically, this simply does not arise. Do not reintroduce the machinery in order to
  reintroduce the rule.
- **Do not synthesise geometry.** Drawing a straight line between two component points because
  no conductor joined would be inventing a wire route, and the netlist's authority rests on
  never doing that.
- **Do not infer a pin's site from its `function`.** See §6 above.
- **No client-side pattern-matching of prose for identifiers.** `Citation.tsx`'s
  allowlist-not-pattern rule is load-bearing: `W999` has the exact shape of a wire id and must
  stay inert. Aliases here include English phrases ("switch relay", "run bypass relay"), three
  of them already ambiguous between two components.
- **Do not run `npx prettier`.** There is no prettier config, so it reformats to double quotes
  and semicolons, against the house style. It happened once and was reverted.

### What is worth salvaging from `7003dfb`, and what is not

Read the branch diff rather than rebuilding blind. Worth taking:

- ~~The **fault 4 anchoring fix** in `MarkerLayer.tsx`~~ — **already taken**, 2026-08-15. It is
  on `main` (uncommitted) with its test. Do not take it twice.
- `locations.py`'s **format, per-field validation and `problems` list**, and `resolve_geometry()`
  as the single place that decides where anything is — with the `derived` tier deleted.
- The **`places[]` / `sites[]` model** in `drawing.py`'s `designator_index()`, including
  `placement`, and the rule that `places` is omitted when there is only one (269 of 275
  entries). Also: nets and wires frame their *terminals*, not the components those sit on.
- Refusing a `locations.json` written for a different page size **whole**, rather than applying
  it at an offset.
- `placesOf()` in `webui/src/lib/designators.ts` — read geometry through it, never read
  `places` directly — and `MarkerLayer` drawing one dot per place, keyed `${id}@${site}`,
  restricted to confirmed places so no spurious dots appear.
- `author_circuit_logic.py` folding points into `components[].location`, `components[].sites[]`
  and `terminals[].location`, leaving a terminal with **no** location when nothing is confirmed
  rather than handing it its parent's — "somewhere on `CR-ON`" and "on `CR-ON:A2`" are different
  claims, and the server does that substitution at read time and labels it.
- `test_extraction_generator.py`'s **byte-identical regeneration** check: with no
  `locations.json`, `circuit_logic.json` comes out identical to the committed one. Cheap, and it
  is what guarantees generated files stay fully generated.

Not worth taking: `derive.py`, `seed_locations.py`, `test_derive.py`, and the seeder half of
`test_locations.py`.

### Files to read before starting

| File | Why |
|---|---|
| `_claude_notes/drawing_fixes_plan_01.md` | The approved six-job plan (A–F). Job C is the editor and is what attempt 2 actually is; Job E and Job F are below. Its Job B section is superseded by this one. |
| `git show 7003dfb --stat`, then the diffs that matter | Attempt 1. Read the salvage list above and go straight to those files; do not read it all. |
| `server/app/drawing.py` | `designator_index()` — where geometry is resolved and published, and the precedent for deriving server-side rather than shipping raw vector. Also the four `on_sheet` constants that must change together with `prompts.py`. |
| `server/app/config.py`, `server/app/main.py` | The single `drawing_dir` knob; where `allow_edits`/`editor_password` and the new routes go; `/api/unlock` as the pattern to mirror; `CSP_BASE`. |
| `webui/src/features/drawing/DrawingTab.tsx` | Line 68 is fault 2. Also the worked example of a tab, and the toolbar/viewport composition to reuse. |
| `webui/src/features/drawing/MarkerLayer.tsx` | Line 72 is fault 4. Its header states the DOM-vs-canvas rule and the reasoning: markers need hit-testing, focus and tooltips; 149 conductor polylines do not and are cheaper painted. |
| `webui/src/features/drawing/paint.ts`, `useTileViewport.ts` | `pointToCss`, `panTo`, `focusScale`, `centreOn`. The one projection, and how a row in a list flies the sheet to a point. |
| `webui/src/tabs.ts`, `webui/src/tabIds.ts` | How a tab is added, and the no-cycle rule. Read both headers before importing anything into anything; this project has already lost an evening to an import cycle that produced a blank screen with no error. |
| `webui/src/stores/appStore.ts` | `selection` — `{kind, id, origin, nonce}`. A list row raises `origin: 'text'` and the viewer flies to it; a click on the sheet raises `origin: 'drawing'` and it deliberately does not fly. |
| `webui/src/lib/designators.ts` | `placesOf`, `KIND_LABEL`, `suggestedQuestion`, and the two lookup rules the real extraction forces: ids beat aliases, and an alias two components both claim is dropped rather than arbitrated. |
| `schematic_extraction/PS20115MLM4-2/extracted_docs/author_circuit_logic.py` | The authored netlist, and where `locations.json` gets folded in. Corrections belong here and never in the JSON. |
| `server/tests/conftest.py` | The miniature extraction the server tests run against: a located component, an unlocated one, aliases, a terminal block. |

Do **not** read `geometry.json` (608 KB) or `circuit_logic.json` in full unless a specific
question needs them; a single read of `geometry.json` costs roughly 150,000 tokens, which is
about 300 full test runs. The measurements this section quotes were taken from it already.

### Verification, in one command

    cd server && .venv/bin/python -m pytest -q; .venv/bin/python -m ruff check .; \
      cd ../webui && npx vitest run; npx tsc -b --noEmit

Semicolons, not `&&`, so one failure does not hide the state of the other three. Keep `-q`:
verbose pytest prints a line per test and costs nine times as much output for no information
when everything passes. A full green pass costs about 500 tokens of output — effectively free,
and far cheaper than finding a break three edits later. Run `npm run build` once at the end,
because it writes into the gitignored `server/app/static/`.

A running server does not pick any of this up: `python -m app` has no reloader.

**Still unverified by machine, and the reason to look before building more:** that `CR-ON:A2`
lands on A2 and `CR-SW:14` on the contact **in a browser**. There is no browser automation in
this environment.

### The two jobs after this one

- **Job E** — `TB-PB2SP` placed by hand as the first `confirmed` entry, at (154.5, 348.3): the
  terminal dot on the `PB2-SP` conductor, which is the point the user's screenshot identified.
  That is human authority. `TB-PB1SP` and the other screened candidates are **not** edited blind.
- **Job F** — teach `schematic_skills` to emit a seed `locations.json` per new drawing and to
  say in `SKILL.md` that the authored tier is two files. This is the part that makes drawing
  number two cheap, and it is the whole point of the library goal.

---

## 2026-08-14 / 15 — Job A accepted; Job B attempt 1 rejected and archived

**This entry replaces an earlier one that claimed Job A and the fault 4 anchoring fix were
committed in `6e9276e`. Both claims were false — that commit touches neither `prompts.py` nor
`test_invocation.py`, and the anchoring fix was inside Job B's uncommitted `MarkerLayer.tsx`
diff. Checked against `git show`, not against the note. A commit claim in this file is worth
verifying before relying on it.**

Three faults were reported against the entry below, and investigating them found a fourth; all
four are tabulated in the section above, along with what is still open. Fault 1 was not a
one-off — the vision pass's coordinates are approximate everywhere, and on a sheet whose
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
