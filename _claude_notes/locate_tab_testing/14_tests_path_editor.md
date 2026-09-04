# T-9xx — the path editor

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-09-03** with Phase E of `_claude_notes/highlighting_wires_and_nets.md` (Session 6 —
the last one).

**This is the session that spends your judgement rather than your patience.** Session 5 could show
you a wire; this is where you say which line each of the 71 wires is, and the machine's whole job is
to put the right answer at the top of a short list.

**The hand edit is over.** `13_tests_paths_highlight.md` T-800 asked you to paste a `path` block
into `locations.json` with a text editor, and said in as many words that it was scaffolding and not
the workflow. The workflow is below: arm a wire, look at three or four runs of ink, click one.

---

## What to hold in your head before you start

**Three sentences, and everything below follows from them.**

> The machine **proposes**; a person **accepts**. A route is **lifted from the ink** or **traced by
> hand**, and it says which forever. And *there is nothing on this sheet to trace* is a **decision**,
> which is what lets the count reach 71.

### Why a single candidate still asks for a click

Because it is the same finding the whole application rests on. A better guesser was built for the
component positions and rejected: at 11 pt median error against **16 pt** conductor rows a proposal
has to be audited, auditing costs about what deciding costs, and it costs *more* when the proposal
is confidently wrong — because first you have to notice. One conductor on this pitch is exactly that
case. So there is no *accept all*, no auto-accept for an exact match, and the file says
`attribution: human` on every route this screen writes, even the ones the printed net name chose.

### What the numbers actually are, measured on this drawing

The plan (§13, Session 6) said to expect **19** wires with one candidate, **33** with two or three
and **19** with none, and warned that *"if the first two numbers come out much smaller, the ranking
is wrong rather than the drawing being hard."* They came out **larger**, and the reason is your own
review run:

| | plan, 2026-08-23 | measured, 2026-09-03 |
|---|---|---|
| Nets with a printed conductor to match against | 17 of 26 | **26 of 26** |
| Wires with exactly one run whose **two ends** land on both their pins | — | **37** |
| Wires whose best candidate reaches **one** end (an L, or a crossover hop) | — | **33** |
| Wires with **no** candidate at all | 19 | **0** |
| Wires with no printed-name *and* spec match | 19 | **3** |

Those 37 are a glance and a click. The 33 are the interesting ones: they need **two** runs, and
that is what `Add a run` is for. The three with no name-and-spec match are `W012` and `W015`, which
have no colour or gauge printed at all (two of 71 — nothing to match on), and `W049`.

**26 of 26 is `K10` being answered**, and it was worth exactly two nets: see T-945.

---

## T-900 · The panel, and what a row of it says

**Do.** Start the server, open the Locate tab, unlock with `edit-1234`. Press the new **`Paths`**
filter.

**Expected.** 71 rows, every wire on the sheet, because none of them has a route yet. The toolbar
reads **`0 of 71 wire paths`**.

**Do.** Arm **`W052`**.

**Expected.** Under the two end-label compasses, a new section headed **Where it runs**, and a
short ranked list. `C0109` is at the top with a ring round it, and its row carries the tag
**`both ends`**, its printed net name `120`, its spec `BLUE 18AWG`, and a distance in points.

**Read one row properly, because the tags are the ranking made visible:**

| Tag | What it claims |
|---|---|
| `both ends` | both of this wire's **placed pins** are on this run's two ends |
| `one end` | one of them is. Half a route — the normal shape across a crossover hop |
| `printed name` | the net name printed beside it is this wire's net |
| `corrected name` | …and it is a name **you** read off the paper on the Review tab |
| `spec` | its printed colour and gauge are this wire's |
| `colour only` | the colour matches and the gauge does not |
| `nearby` | no name printed on it, and it runs close to this wire |
| `another net` | a different net's name is printed beside it — **but the geometry fits** |
| `suspect` | shorter than 15 pt, or a closed loop. 46 runs on this sheet are symbol strokes |

**Why the order is what it is.** The tags are listed above in the order they outrank each other,
and **the geometry beats the printed name**. That is deliberate and it is the opposite of what the
plan's prose suggests: a pin you placed against a vector stroke is geometry against geometry with
no reading of the paper in between, while a printed name is *read* — 30 of this sheet's 70 came back
at confidence 0.4 and nine of them were wrong. And there is a second reason, which
`07_drawing_facts.md` states outright: **the second half of a real route routinely carries no
printed name at all**, so ranking on the name alone finds one end of a wire and not the other.

**Do.** Move the pointer down the list without clicking.

**Expected.** Each run lights up on the sheet in turn, in a **blue** stroke — narrower and more
transparent than the accepted highlight, and a different colour. Moving off puts the sheet back.

**Why a different colour.** A proposal and a decision must never look alike on a drawing where
accepting the wrong conductor is the failure that matters. The blue is thinner so you can still see
the ink underneath it, which is the whole act.

---

## T-905 · Accept one, and check what was written

**Do.** With `W052` armed, click the **`C0109`** row.

**Expected, on screen.** The blue proposal becomes the orange accepted stripe. The section now
reads **`One run along C0109`**, with a length in points *against a 64 pt chord*, and two badges:
**`from the ink`** and **`you said so`**. The row in the list changes to **`path traced`**. The
toolbar goes to `1 of 71 wire paths`, and the `Paths` filter loses the row.

**Do.** Wait for the save badge to go green, then look at the file:

    cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs
    python3 -c "import json;print(json.dumps(json.load(open('locations.json'))['wires'],indent=1))"

**Expected.**

```json
 {
  "W052": {
   "path": {
    "runs": [[[232.62, 563.4], [298.21, 563.4]]],
    "geometry": "extracted",
    "attribution": "human",
    "conductors": ["C0109"],
    "by": "js",
    "at": "..."
   }
  }
 }
```

**Three things about that block, and each is worth a moment:**

1. **There is no `point` and no `label_point` in it.** A wire has no place of its own and never
   will. A dot at the centre of a wire's bounding box sits on blank paper and claims to be the
   wire, which is the whole reason `label_point` is a separate field — and a coordinate written
   under a wire's name would be a route synthesised from its ends, the one thing forbidden.
2. **`attribution` says `human`, even though the printed name is what put `C0109` at the top.** The
   two axes answer different questions — `geometry` is *where did this line come from*,
   `attribution` is *who says it is this wire's* — and the answer to the second is always the person
   who clicked. `printed` is reserved for something nothing in this application does: accepting a
   match with nobody looking.
3. **The coordinates are not rounded to a tenth** the way a placed point is. This polyline is a copy
   of the PDF's own vector data; rounding it would make the highlight disagree with the stroke it is
   tracing, for no gain.

**Do.** Look at the stripe on the sheet at 200%.

**Expected.** It runs along the conductor, 5 pt wide, translucent enough to read the ink through,
and it **stops short of the pins** rather than being stretched to meet them. That gap is the truth:
the ink ends where the extractor says it ends.

---

## T-910 · The four pairings measured off the sheet — **the acceptance criterion**

`07_drawing_facts.md` §*"Which conductor belongs to which wire"* has net 120's four wires paired
with their ink **by hand, from the placed points**, and says so in as many words: *"Session 6's
ranking should reproduce this table; if it does not, the ranking is what is wrong."* This is that
check, and it takes two minutes.

**Do.** Arm each of these in turn and read the top of the list.

| Wire | Expected at the top | Also expected in the list |
|---|---|---|
| `W052` | **`C0109`**, `both ends`, fit ≈ 3.5 pt | `C0091`, `C0092` below it, both `one end` |
| `W053` | **`C0080`**, `both ends`, fit ≈ 1.7 pt | the other three `120` runs, `printed name` only |
| `W063` | **`C0091`**, `one end` | **`C0092`** — `one end`, and **no printed name at all** |
| `W068` | **`C0081`**, `one end` | **`C0057`** — `one end`, three segments, no name |

**Expected.** Every one of the four. In particular `W052` gets **`C0109`** and not `C0080`.

**Why that last sentence is in bold everywhere.** Every document in this project paired `W052` with
`C0080` for nine days, including the plan's §3 and §6 and this manual's §8. It was written from
`CR2:14`'s position *before anybody placed it* — its parent relay's coil, 630 pt away — and
`C0080` is `W053`'s run, within 1.7 pt at both of its pins. The pairing was only ever an
illustration and nothing in the code depended on it, but it is the reason the measured table exists,
and a ranking that reproduced the wrong answer would look exactly as convincing as one that
reproduces the right one.

**Do.** Leave `W063` and `W068` unaccepted for now — T-915 is where they get their second piece.

---

## T-915 · The crossover hop — **why `runs` is a list**

**`W068` is the example the whole plan should have used.** Its straight chord is 312 pt diagonally
across the middle of the sheet. Its ink is **644 pt** of conductor going out to x = 798 and coming
back, in **two** pieces with a 3.5 pt gap between them — where the drawing puts a hop arc to mean
*no connection*. This sheet has 88 of those arcs, and mistaking one for a terminal was the
hardest-won lesson of the whole extraction.

**Do.** Arm `W068` and accept **`C0081`**.

**Expected.** One stripe, along the top of the run — and it plainly does not reach
`DISCHARGE1:3`. The panel says `One run along C0081`.

**Do.** Press **`Add a run`**.

**Expected.** A short list, ranked the same way, with **`C0057`** near the top — because a run with
a pin of this wire on it outranks one without, and `C0057`'s far end lands on `DISCHARGE1:3`.

**Do.** Click `C0057`.

**Expected.** The panel now reads **`2 runs along C0081 + C0057`**, roughly **644 pt of ink against
a 312 pt chord**, and a line underneath explaining the gap. On the sheet: two stripes with a
**visible break** between them at x ≈ 428.

**Why the gap is left open.** Closing it would draw a join nobody drew. The drawing says *these two
conductors cross and are not connected*, and a highlight that bridged them would be asserting a
connection the sheet denies — on the one screen whose job is to tell you which line is which.

**Do.** Do the same for **`W063`**: accept `C0091`, then add **`C0092`**.

**Expected.** An L — 261 pt west along the row, then 73 pt down. And note what `C0092` is:
**a conductor with no printed net label at all**. If the ranking had trusted the printed name over
the geometry, this piece would have been nowhere in the list, and half of `W063` would be
unfindable.

---

## T-920 · Clear, and re-pick

**Do.** With `W063` traced, press **`Clear`**.

**Expected.** The stripes go, the candidate list comes back, the row goes back to `ends known, no
path`, and the count drops by one.

**Do.** Look at the wire's record in `locations.json` after the save.

**Expected.** **The wire has gone from the file entirely** if the route was all it had — rather than
being left behind as `"W063": {}`. That is what keeps `"wires": {}` empty on an untouched drawing
instead of filling with an empty object for every wire anybody ever armed.

**Do.** Now set one of `W063`'s end labels with a compass, then accept `C0091` again, then `Clear`
again.

**Expected.** The `labels` entry is **still there** and only the `path` has gone. The end labels and
the printed name in the same record are answers to different questions, and taking them away as a
side effect of *Clear* would silently undo work nobody asked about.

**Do.** Accept `C0091`, then — without clearing — click the `C0092` row in the main list.

**Expected.** It **replaces** the route rather than adding to it. Clicking a candidate always means
*this is the route*; `Add a run` is the only thing that continues one. Two hit targets, two verbs,
and `Ctrl+Z` if you press the wrong one.

---

## T-925 · An extracted run cannot be dragged until it says it is yours

**Do.** Arm `W052` (traced along `C0109` since T-905). Look at the sheet closely, at 200%.

**Expected.** **No handles on the stripe.** The badges say `from the ink`, and the panel offers a
button reading **`Make it editable`**.

**Why.** `geometry: extracted` is a claim about the polyline itself: *these corners are the
drawing's, not mine.* Dragging a vertex would leave that claim standing over a line a person had
altered — geometry asserting it is the PDF's own vector data when it is not. That is the same class
of lie as storing a computed label side as though somebody had chosen it, which is invariant 10 and
the reason this file still means anything.

**Do.** Press **`Make it editable`**.

**Expected.** The badge changes to **`hand-drawn`**, small red square handles appear at each corner
of the run, and the line *"Drag a corner on the sheet to move it"* replaces the button. In the file:
`geometry` is now `"human"` and **`conductors` has gone** — the run is no longer the run it was
lifted from, so naming it would be a claim that is no longer true.

**Do.** Drag one handle 20 pt and watch the save badge. Then press **`Ctrl+Z`**.

**Expected.** The corner moves, rounded to a tenth of a point like every other coordinate a person
chooses, and one `Ctrl+Z` puts the **whole drag** back — not one frame of it. The badge says what it
undid.

**Do.** Press `Clear`, and accept `C0109` again to put `W052` back to `from the ink`.

---

## T-930 · **Trace** — all four keys, and nothing written until `Enter`

The last resort, and it is offered last on purpose: **79 unlabelled conductors are real ink and
beat a hand trace every time.** A run out of the PDF is exact geometry; a person clicking corners
is not. Use this where there is genuinely nothing to lift.

**Do.** Arm any wire and press **`Trace by hand`**.

**Expected.** The panel replaces the candidate list with *Tracing by hand* and the four keys.
Nothing else on the screen changes and nothing has been written.

**Do.** Click three corners on the sheet, following a printed conductor.

**Expected.** *"3 corners so far"* and a length, and a **blue** line following your clicks. Note
that the sheet click no longer places anything — while tracing, a click is a corner.

**Do.** Press **`Backspace`**.

**Expected.** *"2 corners so far"*. The last corner is gone.

**Do.** Press **`Esc`**.

**Expected.** The trace is abandoned, the candidate list comes back, **and the wire is still
armed.** `locations.json` is untouched — nothing is written until `Enter`, which is exactly what
makes `Esc` safe to press.

**Why `Esc` does not also disarm.** Two things want that key. A half-drawn route is the more recent
and more fragile of the two, and one press taking away *both* it and the armed row would mean losing
your place as the price of abandoning a line. So the first `Esc` drops the corners and the second
disarms — the same escalation a text field already has.

**Do.** Trace again, two corners, and press **`Enter`**.

**Expected.** An orange stripe along what you drew, badges reading **`hand-drawn`** and **`you said
so`**, handles on the corners immediately (a hand-drawn route is editable by definition), and in the
file:

```json
"path": { "runs": [[[…], […]]], "geometry": "human", "attribution": "human", "by": "js", "at": "…" }
```

**No `conductors` key, and that absence is the record**: there was no run to lift. And these
coordinates *are* rounded to a tenth — they are a person's judgement, and a tenth is finer than
anything printed on the sheet.

**Do.** Try to finish a trace with **one** corner.

**Expected.** Nothing is written. One point is not a run, and the server refuses one by name from
the other side too.

**Do.** `Clear` whatever you traced, unless you meant it.

---

## T-935 · *No path on this sheet* — the decision that lets the count finish

**Do.** Find a wire whose run genuinely is not on this drawing — a wire to one of the `MXCS-*`
referenced drawings, or one of the off-page machines. Arm it and press
**`No path on this sheet`**.

**Expected.** The button fills. The panel says *"Nothing to trace on this sheet — you said so"*, the
row reads **`no path here`**, the count goes **up** by one, and the wire leaves the `Paths` filter.
The file holds exactly:

```json
"W0xx": { "no_path_on_this_sheet": true }
```

**Do.** Press it again to take it back, and look at the file.

**Expected.** The key is **deleted**, not written as `false`. That is invariant 10 for the fourth
time in this project — *Reset to default* deletes an end-label override, `hidden: false` is stripped,
a review `Reset` deletes the correction, and this deletes the decision. A file that cannot tell
*nobody has looked at this wire* from *somebody decided there is nothing here* has stopped being a
record of who said what, and that is the only thing it is for. The server refuses a written `false`
by name as well, from the other side, deliberately.

**Do.** Mark a wire *no path*, then accept a candidate for it without clearing first.

**Expected.** The `no_path_on_this_sheet` key **goes**. The two are contradictory claims, so each
retracts the other rather than the file holding both.

**Why this state exists at all, and why it was designed in rather than discovered.** Without it the
`Paths` count could never reach 71, and a progress number that stops short for a reason nobody can
act on is worse than no number. This screen has already made that mistake once — the six `nowhere`
rows in *To do* that can never be finished, which is **`K7`**. The plan says three times that Phase E
is avoiding it on purpose, and this is what that came to.

---

## T-940 · The `Paths` filter and the count

**Do.** Press **`Paths`**, and count what is left.

**Expected.** Only wires, and only the ones with neither a route nor a *no path* decision. The
toolbar's `n of 71 wire paths` and the length of this list add up to 71 at every moment.

**Do.** Accept a route for the top row.

**Expected.** The row leaves the list **immediately**, before the save badge has gone green. The
filter reads the draft, not the server, so the queue shrinks under your click rather than 900 ms
later.

**Do.** Compare it with **`To do`**.

**Expected.** `To do` still has six rows in it that can never be finished — `MXCS-M9`, `MXCS-M11`,
`MXCS-P9`, `MXCS-P11`, `UPSTREAM-MACHINE`, `DOWNSTREAM-MACHINE`, which have no position on this
sheet at all. That is `K7` and it is still open. **`Paths` is the same shape of queue built the
other way round**, and holding the two side by side is the clearest possible statement of what the
difference costs.

---

## T-945 · **`K10`** — the name the sheet actually prints

**Do.** On the Drawing tab, turn on `Nets` and `Labels`, and find `NET-PB1`. Or on the Locate tab,
press `Nets` and arm it.

**Expected.** Its end labels read **`PB1`** — what is printed on the paper — rather than `NET-PB1`,
which is printed nowhere.

**Do.** On the Locate tab, arm the wire on that net (`W040`, `PB1:4 → CR1:A1`, BLACK 22AWG) and look
at its candidates.

**Expected.** **`C0054` at the top, tagged `corrected name`** — because you typed `PB1` into that
run on the Review tab on 2026-09-02, where the extractor had bound `PBL`.

**What this was worth, exactly.** `NET-PB1` and `NET-PB2` were **the only two nets of 26** with no
printed conductor for the matcher to match against, after the whole review queue had been worked.
The sheet prints `PB1` and `PB2`; the extraction renamed them because the drawing *also* has a push
button called `PB1`, and the rename was right — two things may not share an id. So the fix was never
the Review tab's: the server now publishes the printed form beside the id, the label draws it, and
the ranking compares against **both**. **26 of 26.** `K10` is struck.

---

## T-950 · The Review tab's ring follows the ink now

This is small-batch item 5 and it belongs to this session because `ink.py` only loads the conductor
polylines when `/api/conductors` needs them — which is now.

**Do.** Open the **Review** tab, switch to `All readings`, and put the caret in **`C0002`**.

**Expected.** The mark on the sheet is the **three-segment L itself**, drawn along its corners, with
a faint dashed rectangle round it rather than a filled box.

**What it was.** A filled **206 × 215 pt** rectangle — a quarter of the sheet — with a dozen
unrelated runs inside it. Asked *which of these is `C0002`*, that ring could not answer. And for
**19 of the 149** runs the box round the two endpoints did not even *contain* the ink: `C0057` goes
out to x = 798 while its endpoints span x 429.8–598.9, so part of the run was outside its own mark.

**Do.** Put the caret in a **label** row — `T0012`.

**Expected.** Still a filled box, exactly the extraction's `bbox`. That is deliberate: a label
**is** a box, the bbox is the claim, and framing it exactly is how a person sees that the *box* is
wrong — which is how `T0350` and `T0343` were diagnosed in the first place.

---

## T-955 · The reader's copy is unchanged, and cannot download the ink

**Do.** Set `SWUI_ALLOW_EDITS=false` in `server/.env`, restart, and reload.

**Expected.** No Locate tab and no Review tab, as always. The Drawing tab's list works. **A wire you
select is still highlighted along the ink**, and its card still names the conductors — because
`/api/paths` is free of the gate on purpose (`H20`).

**Do.** Ask for the ink directly:

    curl -s -o /dev/null -w '%{http_code}\n' localhost:9700/api/conductors

**Expected.** **404.** Not 401 — the route was never registered.

**Why these two are on opposite sides of the same gate.** A path is **authored display geometry**
out of `locations.json`, and *which of these lines is the one I care about* is a reader's question
before it is an editor's — a technician with the drawing and no password is exactly who the
highlight is for. `/api/conductors` is the **raw ink**: 149 candidate polylines out of a 608 KB
file, useful only to somebody who is about to accept one of them into an authored file. They look
like a pair and they are opposites, and merging them for convenience would hand every reader 32 KB
of proposals they cannot act on.

**Do.** Put `SWUI_ALLOW_EDITS=true` back and restart.

---

## T-960 · The proof, and the four checks

**Do.** With however many paths you have authored, run the suite:

    cd /home/js/schematics/server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
    cd ../webui && npx vitest run && npx tsc -b --noEmit

**Expected.** **172 server · 318 web · ruff clean · tsc clean** — and
`test_the_committed_artifact_is_exactly_what_the_generator_writes` **green**, with no banner and
nothing to re-run.

**That is the proof of the whole approach, demonstrated rather than asserted.** You have just
authored geometry into `locations.json` and `circuit_logic.json` — the file the model reads — has
not moved a byte, because the generator does not read paths.
`test_a_path_does_not_reach_the_netlist` compares its output in bytes with and without one. Paths and
end labels and label corrections are the three authored things that cost you no regeneration.

**Do.** Look at what changed:

    cd /home/js/schematics && git status --short schematic_extraction/

**Expected.** **`locations.json` and nothing else.** It is authored content git cannot regenerate
and it now holds the only record of which conductor each wire is — so a run of this work should end
in a commit.

---

## If something looks wrong

| What you see | Look at |
|---|---|
| No **Where it runs** section on an armed wire | is it a **net**? A net stores no route — its highlight is the union of its wires' and there is nothing on it to author |
| *"The extracted ink did not load"* | `/api/conductors` failed. Is `SWUI_ALLOW_EDITS=true`? Is the tab unlocked? Everything else on the screen still works and `Trace by hand` still does |
| An empty candidate list | genuinely possible, and it means no run of ink is near either pin and none carries the net name. Trace it, or say there is nothing here |
| The top candidate is plainly the wrong conductor | that is a report worth making, with the wire id and the run you expected. `features/locate/paths.ts` `candidates` is the whole of the ranking and `paths.test.ts` pins the four measured pairings |
| A candidate is tagged `another net` and looks right anyway | look twice, and then trust your eyes. It means the geometry fits while the name beside it says another net — either a misread nobody caught, or a wire on the wrong row. Both are worth knowing about |
| The count says `70 of 71` and the `Paths` list is empty | it cannot: they are computed from the same predicate. If it does, that is a real fault — `coverage` and the filter in `LocateTab.tsx` |
| A handle will not appear on a stripe | it is `from the ink`. Press **Make it editable** — and read T-925 for why that is a step rather than a formality |
| `Esc` cleared the armed row when I meant to abandon a trace | the trace had already finished or been abandoned. The first `Esc` takes the corners, the second the row |
| The red strip names a path | `locations.py` `_paths`: a run of one point, a coordinate off the 1224 × 792 pt page, or `geometry`/`attribution` outside their two words. `derived` is refused **by name** on both, and the whole path is dropped rather than half of it |

---

## What this session cost, and what the plan has left over

**One new endpoint, one new pure module, one new panel.** `/api/conductors` is 32 KB behind the
editor password — 149 runs, their polylines, their names with every one of your corrections applied,
and each end's bound terminal-point symbol. `features/locate/paths.ts` is the ranking, pure and with
19 unit tests over the four measured pairings. Nothing in `locations.json`'s schema changed: Session
5 built `path` and `no_path_on_this_sheet` and this is the screen that writes them.

**The whole of `highlighting_wires_and_nets.md` is now built.** Phases 0, A, B, C, D, E, F and G,
across six sessions and 21 lesson documents' worth of tests. `change_history.md`'s **NEXT UP** says
what comes after it.

**Two things this deliberately does not do**, both recorded so nobody re-opens them:

- **it never accepts on its own.** Not for the 37 wires with a single exact candidate, not for
  anything. The machine ranks; you confirm;
- **it does not compute a route.** Not from the endpoints, not by interpolation, not by joining two
  runs across a hop. `derived` is a rejected value on both provenance axes, refused by name, with a
  test per axis.
