# T-8xx — a wire highlighted along the ink

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-09-02** with Phases D and G of `_claude_notes/highlighting_wires_and_nets.md`
(Session 5).

**This is the session the whole plan was written for.** Everything before it made the drawing
easier to read; this is the first time the application answers *which of these lines is the one I
care about* by pointing at the line.

**And it is the one session whose lesson asks you to open a text editor.** There is no path editor
yet — that is Session 6 — so T-800 has you paste a block into `locations.json` by hand. It is
**temporary scaffolding and it is not the workflow.** The workflow is: arm a wire, see two or three
candidate conductors lit on the sheet, click the right one. That screen does not exist for another
session, and without the paste there would be nothing on this sheet to look at.

---

## What this session was for

The amendment you accepted on 2026-08-23, made real:

> **A wire's route is never computed.** It is either **lifted from the ink** — one or more
> conductor polylines out of `geometry.json`, which are the PDF's own vector strokes rather than a
> reading of them — or **traced by a person** along the printed conductor. It carries which of
> those it was, forever, and a hand-traced path says so on screen.

**Three sentences to carry through everything below:**

> A **wire** stores its own runs. A **net** stores nothing — its highlight is the union of its
> wires'. And **one thing is highlighted at a time**, because two highlights in one colour would
> claim the two are the same thing.

### One correction to the plan, found while writing this document

The plan's §6 and §3, this manual's §8, and `07_drawing_facts.md` all use **`W052` with conductor
`C0080`** as the worked example. **Measured against the terminal points you have since placed, that
pairing is wrong**, and the blocks below use the right ones:

| Wire | Its two placed ends | The ink | |
|---|---|---|---|
| `W052` | `CR2:14` (236.1, 563.4) → `TB-120:1` (300.1, 563.3) | **`C0109`** (232.6, 563.4) → (298.2, 563.4) | printed `120`, `BLUE 18AWG` |
| `W053` | `TB-120:3` (300.1, 663.7) → `BYPASS-CB:1` (381.5, 663.8) | **`C0080`** (379.8, 663.7) → (301.8, 663.7) | printed `120`, `BLUE 18AWG` |

`C0080` is `W053`'s run — both of its ends land within 1.7 pt of `W053`'s pins, and both of
`W052`'s pins are 60 pt of sheet away on a different conductor row. The plan was written on
2026-08-23 using `CR2`'s **coil** as `CR2:14`'s position, which is where the pin resolved *before*
it was placed; that is also where its dramatic "600 pt diagonal" came from. Nothing in the code
depended on the pairing — it was only ever an illustration — but an illustration that is wrong in
a document Session 6 reads is worth correcting, and the real illustration is better anyway: see
`W068` in T-820.

---

## T-800 · **The hand edit — scaffolding, not the workflow**

**Do.** Stop the server if it is running, and close any browser tab showing the Locate or Review
screens. Both hold a whole-document draft in memory, and a hand edit made while one is open is
overwritten by that tab's next save — that is `K2`/`H1`, and this is the one occasion in the whole
manual that walks into it on purpose.

**Do.** Open

    schematic_extraction/PS20115MLM4-2/extracted_docs/locations.json

find the `"wires": {}` near the end, and replace the empty object with this:

```json
  "wires": {
    "W052": {
      "path": {
        "runs": [[[232.6, 563.4], [298.2, 563.4]]],
        "conductors": ["C0109"],
        "geometry": "extracted",
        "attribution": "human",
        "by": "js",
        "at": "2026-09-02T18:04:11.512Z"
      }
    }
  },
```

**Expected.** The file still parses. A JSON error anywhere in it costs every point in it, and the
red strip at the top of the Locate tab will say so.

**Do.** Start the server and ask it what it now knows:

    cd /home/js/schematics/server && .venv/bin/python -m app
    # in another terminal
    curl -s localhost:9700/api/paths | head -c 400

**Expected.** Two maps. `wires` has exactly the one entry you pasted; `nets` has all 26 nets with
their wires, whether or not anything has been traced:

    {"wires":{"W052":{"runs":[[[232.6,563.4],[298.2,563.4]]],"geometry":"extracted",
     "attribution":"human","conductors":["C0109"]}},"nets":{ … "120":["W052","W053","W063",
     "W068"] … }}

**Why the two maps are shaped like that.** A wire with no path is **absent** rather than null,
because the only question a client asks is *is there one*. And `nets` lists every net's wires
regardless, so a net can say *none of my four wires has a path yet* instead of drawing nothing and
reading as broken. Nothing anywhere in that payload is a path keyed on a net.

**What you have just claimed, said plainly.** That the conductor `C0109` is `W052`'s run, and that
a **person** decided so — `attribution: human`. T-810 is where you check that with your eyes, which
is the order this system insists on everywhere: the machine proposes, a person confirms.

---

## T-805 · **The proof: the netlist does not move**

**Do.** With the path in the file, run the server suite:

    cd /home/js/schematics/server && .venv/bin/python -m pytest -q

**Expected.** **157 passed** — and in particular
`test_the_committed_artifact_is_exactly_what_the_generator_writes` is **green**, with no banner in
the Locate tab's toolbar and nothing to re-run.

**Why this is the point of the phase and not a detail.** Every other authored thing here makes
`circuit_logic.json` stale the moment you touch it: place a point and `K6` goes red until you re-run
`author_circuit_logic.py`. A path does not, because the generator does not read it and never will —
a polyline says nothing about *what connects to what*, which `from_terminal` and `to_terminal`
already answer. Paths are **display geometry**, and this is what keeps a later session from quietly
wiring them into the artifact every answer is checked against.
`test_a_path_does_not_reach_the_netlist` compares the generator's output with and without a path,
in bytes.

---

## T-810 · A wire highlighted along its own ink

**Do.** Open **http://localhost:9700/webui/** and the **Drawing** tab. In the list on the left type
`W052`, and click the row.

**Expected.**

1. the sheet flies to the wire and its two end labels appear at `CR2:14` and `TB-120:1`;
2. **a translucent orange stripe lies along the conductor between those two pins**, on the ink
   rather than beside it;
3. the card in the bottom-left corner says **`highlighted`**, with two badges and `C0109`.

**Do.** Zoom in until you can see the black conductor under the stripe.

**Expected.** The line is still readable through the highlight. Deliberate: you are deciding *which*
line this is, and a highlight that hid the line would answer the question by removing the evidence.

**Do.** Look at where the stripe **stops**, at both ends.

**Expected.** It stops about 3 pt short of `CR2:14` and 2 pt short of `TB-120:1`. That gap is the
honest one — the ink is what the PDF actually draws, and the pins are where a person put them.
Nothing has been stretched to make the two agree, and nothing ever will be: the moment a route is
adjusted to meet its endpoints it has stopped being lifted from the ink.

---

## T-815 · What the card says about a path — and what it says when there is none

**Do.** Read the card's path line for `W052`.

**Expected.** Two badges, each with a sentence on hover:

| Badge | Means |
|---|---|
| `lifted from the ink` | the polyline is a conductor out of `geometry.json` — the PDF's own strokes, not a reading of them. A hand trace says **`hand-traced`** here, everywhere it appears |
| `assigned by hand` | *who says this run belongs to this wire.* Yours says this because that is what you pasted. The alternative is `matched by its printed name` — and `C0109` does carry a printed `120` beside it, so Session 6 will be able to say the stronger thing |
| `C0109` | the conductor it was lifted from. **Absent on a hand trace**, and that absence is the record: there was no conductor to lift |

**Do.** Click any other wire in the list — `W047`, say.

**Expected.** `no path yet, so nothing is highlighted`, and a clean sheet. **That sentence is doing
real work:** an unhighlighted drawing cannot tell you the difference between *nobody has traced this
wire* and *the highlighter is broken*, and until Session 6 the first is true of 70 of the 71 wires.

**Do.** Click a component — `CR2`.

**Expected.** **No path line at all.** A relay has no route in the way a stone has no opinion, and a
card announcing *no path yet* on 178 of the 275 rows would be noise.

---

## T-820 · **A net is the union of its wires — and the run that proves the whole design**

**Do.** Stop the server again and add two more blocks inside `"wires"`, beside `W052`:

```json
    "W053": {
      "path": {
        "runs": [[[379.8, 663.7], [301.8, 663.7]]],
        "conductors": ["C0080"],
        "geometry": "extracted",
        "attribution": "human",
        "by": "js",
        "at": "2026-09-02T18:04:11.512Z"
      }
    },
    "W068": {
      "path": {
        "runs": [
          [[301.8, 639.6], [426.3, 639.6]],
          [[429.8, 639.6], [798.0, 639.6], [798.0, 563.5], [598.9, 563.5]]
        ],
        "conductors": ["C0081", "C0057"],
        "geometry": "extracted",
        "attribution": "human",
        "by": "js",
        "at": "2026-09-02T18:04:11.512Z"
      }
    }
```

**`W068` is the wire this whole plan exists for**, so it is worth knowing what you have just pasted
before you look at it. `W068` is `DISCHARGE1:3 → TB-120:2`, RED 16AWG:

| | |
|---|---|
| A straight chord would claim | (602.7, 563.6) → (300.1, 639.6) — a 312 pt diagonal straight across the middle of the sheet |
| The ink actually says | west 125 pt along `C0081`, **a 3.5 pt gap**, then east 368 pt to x = 798, north 76 pt, and west 199 pt back to the pin — 644 pt of conductor going the long way round |

The chord is not slightly wrong. It crosses a dozen conductors it has nothing to do with, and it
misses every one of the four the wire actually runs on. **That gap of 3.5 pt is a crossover hop** —
this sheet has 88 of them, and the extractor splits a conductor at each one. It is why `runs` is a
*list*: closing that gap would draw a segment nobody drew.

**Do.** Restart the server, reload, and click net **`120`** in the list.

**Expected.**

1. the sheet frames the whole net and rings its **seven terminals**;
2. **four separate stripes** are lit, in three different parts of the drawing — and the two that
   belong to `W068` have a visible break between them at x ≈ 428;
3. the card says **`highlighted: 3 of its 4 wires`**, and the geometry badge says
   `lifted from the ink`;
4. `W063` is the one that is missing, and nothing on the sheet pretends otherwise.

**Do.** Look at the file again.

**Expected.** **There is nothing under `"nets"`.** A net stores no path of its own — the server
refuses one **by name** if you try, and the message says why. Its highlight is assembled from its
wires every time it is drawn, which means tracing `W063` tomorrow improves net 120 with no work on
the net at all.

---

## T-825 · The highlight survives its own switch, and only one thing is lit

**Do.** With net `120` selected, press **`Nets`** in the toolbar on and off again. Then **`Labels`**
off. Then **`Components`** off.

**Expected.** **The highlight never goes away.** It is read off the *selection* and off nothing
else — the same exemption the rings and the end labels have, and the same reasoning: hiding the
thing you just asked to see is the one case the overlay has to stay visible for. (`H11` in the code
map, and five switches is five chances to get it wrong.)

**Do.** Click `W052` in the list, then `W047`, then press **`Esc`**.

**Expected.** One stripe, then none (`W047` has no path), then none. **One at a time**: a new
selection replaces the highlight rather than adding to it, and `Esc` clears both.

---

## T-830 · The stroke is measured in points, so it tracks the ink

**Do.** Select `W068` — the long one. Press **`0`** to fit the sheet; the zoom reads about **11%**.

**Expected.** The whole route is on screen and still unmistakable: a thin mark going out to the
right-hand column and back. At this zoom the 1224 pt sheet is about 776 px across, so 5 pt of
highlighter comes to roughly three device pixels — which is exactly where the floor sits, and why
there is one. Zoom out further (the viewer allows half the fit scale) and the stripe stops getting
thinner rather than disappearing at the zoom where you most need to find something.

**Do.** Zoom all the way in. The button stops at **200%**, which is this viewer's ceiling
(`MAX_OVERZOOM`; the plan said 400% and the viewer has never gone that far — the ceiling is worth
knowing rather than worth changing).

**Expected.** The stripe has thickened *with the drawing*, still sits on its conductor, covers its
own row, and does not reach the rows 16 pt above and below it. That is the number that matters on
this sheet: one row out names a different circuit.

**Why in points and not pixels.** A fixed-pixel stroke is two different things at the two ends of
that range: a hairline at 11% and a band across four conductors at 200%. Width 5 pt, floor 3 device
pixels, both in one constant (`HIGHLIGHT` in `paint.ts`).

---

## T-835 · An answer's citation lands on a net and paints it — **Phase G**

**Do.** On the **Ask** tab ask something that will cite net 120 — *"what is on net 120?"* — and when
the answer comes, click the backticked **`120`**.

**Expected.** The Drawing tab opens, the sheet flies to net 120, the roster names its seven
terminals, and **all four stripes are lit.** No new machinery: a citation calls the same
`select(kind, id)` a list row does, and the highlight hangs off the selection.

**If you would rather not spend a question**, clicking the row in the list is the same test for
nothing. The point being made is that there is exactly **one** way into the highlight, so a citation
and a row cannot come to disagree. (One thing that stays as it was: a citation is only clickable
when the thing has a point, so a net with no positioned member is deliberately dead text.)

---

## T-840 · The Locate tab highlights what is armed — **Phase G**, then the cleanup

**Do.** Press **`F2`** to the Locate tab, unlock it with `edit-1234`, press the **`Wires`** filter
and arm **`W052`**.

**Expected.** The same stripe on the same conductor, plus the wire's two ends dotted and labelled as
they have been since Session 2. **Now you can see the run while you place its pins** — which is the
quiet win the plan predicted: a pin placed on the end of a conductor you can see beats one placed by
eye.

**Do.** Arm a terminal instead — `CR2:14`.

**Expected.** The highlight goes. A terminal has no route; one thing at a time.

**Do.** Arm `W052` again, set one of its end labels with the compass, and wait for the save badge to
go green. Then look at `locations.json`.

**Expected.** **The `path` block is exactly as you pasted it**, with the new `labels` entry beside
it. Every mutation in the editor rewrites the record it found rather than replacing it, so the
scaffolding survives the editor working on the same wire — which matters, because that block is the
only path on the sheet and nothing on screen would tell you it had gone. `model.test.ts` has this as
a test for the same reason.

**Do — the cleanup, and it is part of the lesson.** Decide what to keep, with the server stopped:

- **keep the three blocks** if T-810 and T-820 satisfied you that the stripes are on the right
  conductors. You are the person `attribution: human` names, and having looked at all three on the
  sheet you have made exactly the judgement Session 6's editor is going to ask you for — with the
  advantage that Session 6 can then check its ranking against three answers you already gave;
- **or put `"wires": {}` back**, and Session 6 starts from nothing. Either is honest. What would not
  be is keeping a block you never looked at.

**Do.** Restart, and run the four checks:

    cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
    cd ../webui && npx vitest run && npx tsc -b --noEmit

**Expected.** **157 server · 251 web · ruff clean · tsc clean**, and the artifact test green
whatever you decided — because a path never makes the netlist stale. `git diff` should show
`locations.json` changed by exactly what you meant to leave behind and nothing else under
`schematic_extraction/`.

---

## If something looks wrong

| What you see | Look at |
|---|---|
| No stripe at all, and the card says `no path yet` | the server was started **before** you edited the file, or the edit is under `"nets"` rather than `"wires"`. The parse is cached per process — restart |
| A red strip naming your path | it says which field: a run of one point, a coordinate off the 1224 × 792 pt page, or `geometry`/`attribution` outside the two words each allows. `derived` is refused by name on both |
| The whole file's points vanish and the strip says `not an object` | JSON: a trailing comma, or the `"wires"` block pasted outside the top-level object |
| The stripe is on a conductor, but the **wrong** one | that is a real answer and it is what this screen is for. Correct the block, or drop it and wait for the editor that ranks the candidates |
| The artifact test goes red after a hand edit | **that is not a path.** Look for a point you moved in the same sitting — `K6` is about positions, and a path cannot cause it |

---

## What it cost, and what is not here yet

**One new endpoint and one new field.** `GET /api/paths` is a few dozen dictionary lookups over two
already-cached parses, and it is **free of the editor password on purpose**: a path lives in
`locations.json`, not in `geometry.json`, and *which line is this* is a reader's question before it
is an editor's. The highlight therefore works with `SWUI_ALLOW_EDITS=false` — the same criterion the
designator list had in Session 3, and worth a minute if you have one.

**Not here yet, and it is the whole of Session 6:**

- **the path editor** — ranked candidate conductors, hover to compare, click to accept, multi-select
  across a crossover hop, and **Trace** for the 19 wires with no candidate at all;
- **the counts** — no `0 of 71 wire paths` anywhere, and no `Paths` filter;
- **`no_path_on_this_sheet`** — the file understands it and the server counts it, but nothing on
  screen can say it;
- **the ring around a conductor on the Review tab** is still the box round its endpoints (`Q16`,
  `Q17`), because `ink.py` does not load the polylines until `/api/conductors` needs them.

What *is* here is the thing all of it was for: the sheet can show you a wire.
