# T-14xx — the coverage overlay: *what is this drawing not telling anybody?*

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-09-13** with §6 of `_claude_notes/highlighting_wires_and_nets_02.md`.

**Written to be worked without reading a word of explanation.** Every test is **Do** and
**Expected** first and short. Under some of them is a ***Why*** paragraph in italics — those are
**skippable**.

---

## Before you start

**This is a client-only change.** Nothing under `server/app/` moved, and `GET /api/conductors`
already published all 149 runs of ink with no password. So one command:

    cd /home/js/schematics/webui && npm run build

and reload the page. If the server is already running you do **not** need to restart it.

    cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/

**None of this needs the editor password**, and none of it writes a byte. It is the **Drawing**
tab, which is the reader's tab.

Four checks before you touch anything: **261 server · 482 web · ruff clean · tsc clean.**

### What is new, in four lines

- **`Unclaimed ink`**, a new switch at the right-hand end of the Drawing tab's toolbar, beside the
  five layer switches and outside their group.
- **On, it paints every run of ink that nothing claims** — no wire's route, no block's bus — in
  pink, thinner and fainter than a highlight.
- **Beside it, a legend**: how many runs are claimed by nothing, out of how many there are, and
  **how many wires have a route at all**. The second number is what makes the first one mean
  anything.
- **Off by default, and it does not survive a reload.**

### The numbers as they stood on 2026-09-13

| | |
|---|---|
| runs of ink on the sheet | **149** |
| claimed by a wire's route | **44** |
| claimed by a block's bus | **7** |
| **claimed by nothing** | **98** |
| wires with a route | **58 of 71**, 16 of them hand-traced |

**Yours will differ, and that is the point of the feature** — every route you author takes runs
out of the unclaimed set. Read the numbers off the screen, never off this page.

---

## T-1400 · The switch is there, and it is off

**Do.** Drawing tab. Look at the right-hand end of the toolbar.

**Expected.**

- a **`Unclaimed ink`** button with a highlighter icon, **not filled** — the same *off* look the
  five layer switches have;
- the sheet is exactly as it has always been: nothing pink on it;
- **no legend** anywhere in the toolbar.

> ***Why it starts off (skippable).*** Your own verdict on the last overlay that lit the sheet by
> itself was *"this adds clutter and confusion to the drawing"*. Ninety-eight lines lit on arrival
> would earn that twice over. This is a question you ask, not a state you live in.

## T-1405 · Turn it on

**Do.** Click **`Unclaimed ink`**.

**Expected.**

- the button fills, the way a pressed layer switch does;
- **a lot of pink**, thinner and paler than a selection highlight;
- a legend appears in the toolbar, to the left, reading something close to
  **`98 of 149` runs of ink are claimed by nothing · 58 of 71 wires have a route, 16 of those
  hand-traced, claiming none**.

## T-1410 · The legend is the half that stops the number lying

**Do.** Read the legend as one sentence.

**Expected.** Two numbers that pull in opposite directions, and the second is the true story:
**almost nothing has been authored yet**, not *most of this drawing is unaccounted for*.

> ***Why (skippable, but this is the one worth reading).*** Three separate things make the
> unclaimed count large while nothing at all is wrong. **13 wires have no route yet** — nobody has
> been asked. **16 of the routes that do exist you drew by hand**, and a hand-drawn route names no
> conductor *by design*, so the ink underneath it stays unclaimed forever and correctly. And
> **about 90 of the 149 runs are not wiring at all** — leader lines, earth symbols, the little
> internal strokes of a contact symbol — which nothing will ever claim. That is hazard `H27` in
> `06_code_map.md`, and it is why the count is never shown without the legend.

## T-1415 · The bus you drew on `TB-110` is *not* painted

**Do.** With the overlay on, find `TB-110` — type it into the list on the left and click the row,
and the sheet flies there. Zoom in on the short vertical between screws `:1` and `:4`.

**Expected.**

- that stretch is **not** pink;
- click it: the card says **`TB-110`'s commoning**.

> ***Why this is the acceptance test for a decision made in §4 (skippable).*** When you traced
> `TB-110`'s bus by hand, the screen also recorded the two runs of real ink the line follows —
> `C0060` and `C0077` — as the weaker claim riding along with the stronger one. That is what keeps
> them out of this view. Had the hand trace claimed nothing, this overlay would report a gap
> exactly where you had just done the work.

## T-1420 · `TB-130`, which you drew where there is no ink at all

**Do.** Go to `TB-130` the same way. It is the one you drew across a gap the PDF's vectors do not
cover.

**Expected.** Your bus is in the record and on the Locate tab, and **the stretch you drew has no
run of ink under it, so this view has nothing to paint there — pink or otherwise.** The overlay
paints runs of ink, never claims.

> ***Why (skippable).*** This is the difference this project keeps insisting on. A conductor is a
> measurement of the paper; a bus is your interpretation of it. The ink that *should* be at
> `TB-130` is missing because the extraction read only the `SCHEMATIC` layer of the PDF and this
> line is on layer `"0"` — a bug upstream, and §7 of the plan is the fix. When that lands and the
> geometry is rebuilt, the run will exist, your record already names the polyline, and this view
> is how you will notice.

## T-1425 · Off puts the sheet back exactly

**Do.** Select a wire that has a route — any row in the list with a highlight. Then turn
`Unclaimed ink` on, and off again.

**Expected.** The selection's highlight is untouched throughout, and with the overlay off the
sheet is byte-for-byte what it was: no pink, no legend.

## T-1430 · It does not survive a reload

**Do.** Turn it on. Press `F5`.

**Expected.** Off again, sheet clean. The layer switches behave the same way and for the same
reason.

## T-1435 · Nothing here writes anything

**Do.** With the overlay on, click several pink runs and read their cards. Then:

    cd /home/js/schematics && git status --short schematic_extraction/

**Expected.** Whatever it said before you started, unchanged. **There is nothing on this screen to
accept**, deliberately: a run the overlay leaves dark is a question for your eyes, not a record
waiting for a button. `W042` is the standing reason — you pressed *I looked and it was right* on a
wire the ink says nothing about, and that was the correct answer.

## T-1440 · Watch the number move as you author

**Do.** Leave the overlay on. Go to the Locate tab, author one wire's route from a run of ink the
overlay is painting, and come back.

**Expected.** That run is no longer pink and the unclaimed count has dropped. **This is the
feature.** It is the first screen in the project that answers *how much of this sheet is still
unaccounted for* without clicking 149 lines one at a time.

---

## What this does **not** do, and both are on purpose

1. **It does not tell you what an unclaimed run *is*.** Click it — the conductor card has said
   that since Session 3.
2. **It does not offer to claim anything.** Not one button. Accepting ink for a wire is the Locate
   tab's job, with a person deciding, and a screen that painted the gaps *and* offered to fill
   them would eventually fill one nobody looked at.
