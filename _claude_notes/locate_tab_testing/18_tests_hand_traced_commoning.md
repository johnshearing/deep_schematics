# T-13xx — drawing a block's bus by hand

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-09-12** with §4 of `_claude_notes/highlighting_wires_and_nets_02.md`.

**Written to be worked without reading a word of explanation.** Every test is **Do** and
**Expected** first and short. Under some of them is a ***Why*** paragraph in italics — those are
**skippable**.

---

## Before you start

**This is a client-only change.** No server change and no schema change: `server/app/wiring.py`
has accepted `geometry: "human"` on a commoning record since Phase C. So:

    cd /home/js/schematics/webui && npm run build
    cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/

Editor password `edit-1234`. Four checks before you touch anything: **261 server · 473 web · ruff
clean · tsc clean**.

**T-1330 writes into your real `wiring.json` and T-1335 takes it back out.** Everything else here
is read-only or abandoned before it writes.

### What is new, in four lines

- **`Trace by hand`** on the commoning panel, beside the accept button. Same four keys as a path:
  click each corner, `Enter` finishes, `Backspace` un-corners, `Esc` abandons.
- **The panel now appears on any component with two or more terminals on one net** — not only on
  the six the ink proposes a bus for. Reach those through the `Components` or `All` filter.
- **A hand-traced record says `geometry: "human"`**, and the badge reads *you drew it*.
- **It still names the ink it runs along**, where there is any — the weaker claim, so a line you
  have just drawn does not leave real ink reading unaccounted-for.

---

## T-1300 · The panel is on a block the ink says nothing about

**Do.** Locate tab → unlock → `All` → click **`TB-130`**.

**Expected.**

- a **This block's commoning** section, which was not there before this session;
- *The ink joins none of this block's points to each other*, and then a plain statement that the
  line may not be in the extracted geometry;
- **no** *This is `TB-130`'s commoning* button — there is no proposal to accept;
- **one** button: `Trace by hand`.

> ***Why this is the whole phase (skippable).*** The old copy said *that is a question for your
> eyes rather than a gap in this screen*. It was the wrong way round: you can see two screws
> strapped together and a rule over extracted vectors cannot, so the gap was in the screen.

## T-1305 · And it is not on every component

**Do.** `All` → click a relay, a push button, and **`TB-GND-B`**.

**Expected.** No commoning section on any of them.

> ***Why (skippable).*** The gate is *two or more of this component's terminals on one net* — a
> statement about shapes, not about what a designator is called. On this drawing it opens the panel
> on **12** of the 47 components; a section on all 47 saying *nothing here* would be noise.

## T-1310 · Four keys, and nothing written until `Enter`

**Do.** `All` → `TB-130` → `Trace by hand`. Click two points on the sheet, anywhere.

**Expected.** The panel is replaced by **Tracing by hand**, reading *2 corners so far · n pt of
line*, with the three keys listed under it. A line is drawn on the sheet in the proposal colour.

**Do.** Press `Backspace`, then `Esc`.

**Expected.** *1 corner so far*, and then the panel back as it was. **The `wiring` save badge never
leaves `saved`** — nothing was written.

## T-1315 · `Esc` gives up the trace before it gives up the row

**Do.** Start a trace on `TB-130`, click one corner, press `Esc` once.

**Expected.** The trace is gone and **`TB-130` is still armed**, ready to draw again. A second
`Esc` clears the selection.

## T-1320 · The line you draw is the line that is stored

**Do.** `Commoning` filter → **`TB-110`** → `Trace by hand`. Zoom in on the block first. Click on
the centre of **screw 1**, then on the centre of **screw 4**. Press `Enter`.

**Expected.**

- the badge reads **`you drew it, on 2026-09-12`** — a third reading it did not have;
- the run row reads **1 run**, `C0060 + C0077`, and about **46.8 pt**;
- the `wiring` badge goes `unsaved` → `saved`;
- the netlist badge says `circuit_logic.json is behind` and names both commands.

> ***Why the conductors are named when you drew the line yourself (skippable).*** Two different
> claims. `runs` says *these corners are mine*; `conductors` says *and they follow this ink*. The
> second is computed from your corners and stored because the Drawing tab maps conductor → block
> out of that list and nothing else — without it, ink you have just accounted for would read as
> unclaimed. The four wires that cross the bus on their way to the four screws are **not** named:
> a crossing shares none of the line's course.

## T-1325 · Where there is no ink, it says so

**Do.** `All` → `TB-130` → `Trace by hand` → click its two screws, 71 pt apart → `Enter`.

**Expected.** The run row reads **1 run**, **`hand-traced`**, about **71 pt**. No conductor id,
because there is no conductor — and that is the record rather than a gap in it.

**Expected.** `TB-130` **now appears in the `Commoning` filter**, and the count goes from
`n of 6 blocks commoned` to `n+1 of 7`.

> ***Why it was not in that filter before (skippable).*** That list is a measurement: the blocks
> the *ink* can propose a bus for, plus the blocks somebody has authored one for. A block the rule
> cannot see joins it the moment you decide about it, which is why it is reached as an ordinary
> component row until then.

## T-1330 · It does not move the netlist

**Do.** With T-1320 and T-1325 saved, run the generator:

    cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs
    python author_circuit_logic.py
    git status --short circuit_logic.json

**Expected.** **Nothing.** `circuit_logic.json` is byte-identical: a block's bus is display
geometry, so it earns no wire, no edge and no entity. `test_commoning_does_not_reach_the_netlist`
asserts the same thing in bytes, for a hand-traced record as well as a lifted one.

## T-1335 · Take it back, and put your file back

**Do.** `TB-130` → **`Take it back`**.

**Expected.** The record is **deleted**, the panel returns to *The ink joins none of this block's
points to each other*, and `TB-130` leaves the `Commoning` filter again.

**Do.** Decide what to keep. To drop everything this document wrote:

    cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs
    git checkout wiring.json

**Expected.** Your four earlier commoning decisions are back and `TB-110`'s hand trace is gone.
**This throws away anything else you had not committed in that file** — commit before you start.

---

## What to report

| If this happens | It means |
|---|---|
| A trace on a block wrote something into `locations.json` | a real fault, and the worst one here: one gesture reaching two authored files. `H26` |
| `Trace by hand` on a **wire** started a trace of the block's bus, or vice versa | the same fault from the other side |
| The badge says `you` rather than `you drew it` after a hand trace | the record was written with `geometry: "extracted"` — a line claiming to be the drawing's |
| The conductor row names a wire you can see crossing the bus | the shared-course test is too loose; `ALONG_PT` in `features/locate/wiring.ts` |
| A commoning panel appeared on something with no two points on one net | the gate is reading the wrong thing, and the next thing it will grow is a designator prefix |
