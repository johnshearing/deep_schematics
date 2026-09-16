# T-145x — the authored-paths field: *the unpainted ink is the queue*

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-09-15** with §4 of `_claude_notes/highlighting_wires_and_nets_03.md`.

**Written to be worked without reading a word of explanation.** Every test is **Do** and
**Expected** first and short. Under some of them is a ***Why*** paragraph in italics — those are
**skippable**.

---

## Before you start

**This one touches both halves**, so it is two commands and not one:

    cd /home/js/schematics/webui && npm run build
    cd /home/js/schematics/server && .venv/bin/python -m app     # restart it; there is no reloader

*A rebuilt bundle against an unrestarted server is the dangerous combination, and this change has a
server edit in it (T-1458).* Then <http://localhost:9700/webui/>.

This is the **Locate** tab, so it needs the editor password — `edit-1234`. Nothing here writes a
byte: the field is read from `GET /api/paths`, which has no password by design.

Four checks before you touch anything: **263 server · 490 web · ruff clean · tsc clean.**

### What is new, in five lines

- **`Authored paths`**, a new switch at the right-hand end of the Locate tab's sheet toolbar,
  beside the zoom.
- **On, it paints every route and every block's bus you have authored — the whole sheet at once**,
  in slate, thinner and fainter than a selection. **The ink it leaves unpainted is your queue.**
- **Beside it, a legend**: how many runs are painted, how many of those are a block's bus, and
  **how many wires have a route at all** with the hand-traced count beside it (`H27`).
- **Off by default, and gone again on reload.**
- **`Unclaimed ink` is gone from the Drawing tab.** The code stays, behind `?unclaimed=1`
  (T-1459). And **selecting net `GND` now paints the 0 V-to-earth bond** (T-1458).

### The numbers as they stood on 2026-09-15

Read off `/api/paths` on the day, and **they move as you author** — the legend on screen is the
authority, never this page:

| | |
|---|---|
| wires with a route | **59 of 71**, **17** of them hand-traced |
| blocks with a bus | **6**, contributing **7** runs |
| **runs the field paints** | **68** |

Get them yourself:

    cd /home/js/schematics/server && .venv/bin/python -c "
    from pathlib import Path
    from app.drawing import paths_index
    b = paths_index(Path('/home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs'))
    print(len(b['wires']), 'routes ·', sum(1 for p in b['wires'].values() if p['geometry']=='human'), 'by hand ·',
          sum(len(p['runs']) for p in b['wires'].values()) + sum(len(c['runs']) for c in b['commoning'].values()), 'runs')"

---

## The tests

### T-1450 — the colour is background state, not a verdict

**Do.** Open the Locate tab, unlock it, press **`Authored paths`**. Look at the sheet at the fit
zoom, then at 100%.

**Expected.** A **neutral slate** field over the routes you have authored, thin and translucent
enough to read the black conductor through it. It should look like *state of the drawing*, not like
*approved*.

***Why. Deliberately not green.*** *It is background state rather than a verdict; it must never
compete with the orange-red stripe that answers a question you just asked; and a red/green pair is
the one contrast a colourblind reader cannot make. **If it is too faint or too loud on your screen,
say so — it is one line in `paint.ts` (`AUTHORED`) and this is the test that decides it.***

### T-1451 — off on arrival, and off again after a reload

**Do.** Reload the page and open the Locate tab without pressing anything. Then press the switch,
then reload again.

**Expected.** No slate on arrival and no legend; the switch is unfilled. After pressing it, the
field appears. After the reload it is unfilled and the sheet is plain again.

***Why.*** *Your verdict on the last overlay that lit the sheet by itself was "this adds clutter
and confusion to the drawing". Nothing anywhere remembers this switch.*

### T-1452 — it paints every route and every bus, and nothing else

**Do.** With the field on, look for a **block's bus** you have confirmed (`TB-120`, `TB-110`) and
for a wire you have **hand-traced**. Then find a wire you know has **no** route yet.

**Expected.** Both the routes and the buses are in the field — a hand-traced route exactly like a
lifted one, since the field is polylines and does not care where they came from. The wire with no
route has **no slate on its ink**, which is the whole point: **that is your queue, read off the
paper.**

### T-1453 — the legend, and the two numbers that keep it honest

**Do.** Read the legend in the toolbar's left-hand flow.

**Expected.** Something of the shape **`68 runs painted, 7 of them a block's bus · 59 of 71 wires
have a route, 17 of those hand-traced`** — with **your** numbers. The wire count must agree with
the `n of m wire paths` count you already have on this screen, allowing for one difference below.

***Why.*** *`68 runs painted` says nothing on its own; beside `59 of 71 wires have a route` it says
how much of the drawing is done, which is the only question this view exists to answer (`H27`). The
bus count is there because the wire count cannot account for it — a block's bus is nobody's wire.*

***The one legitimate difference.*** *The screen's own `n of m wire paths` counts a wire as settled
when you have said **no path on this sheet**, because that finishes the work. The legend counts
**painted** routes, and a wire with no path paints nothing. So the legend's first number can be
lower, and that is correct.*

### T-1454 — the row you are working on still wins the sheet

**Do.** With the field on, arm a wire that has a route (filter **`Wires`**, click its row).

**Expected.** Its route is **orange-red on top of the slate**, unmistakably the answer to *which
wire is this*. Arm a wire with no route: the field does not change, and nothing is highlighted.

### T-1455 — a route you accept shows at once, and joins the field a moment later

**Do.** With the field on, arm a wire with no route and **accept a candidate run**.

**Expected.** The route appears **immediately** in the selection's own colour. About a second
later, once the save has landed and the index has been re-read, it is **also** part of the field —
press the switch off and on if you want to be sure.

***Why — this is `H18` on screen.*** *The field is read from the **published** `/api/paths` and
never from a draft. A route's draft lives in `locations.json`'s whole-document draft and a bus's in
`wiring.json`'s, and a field assembled from both would be one overlay holding two authored
documents, which is the crossing that hazard exists to prevent. You lose nothing by it: your
unsaved work is already on top, in the brighter colour.*

### T-1456 — switching it off gives the sheet back exactly

**Do.** With a wire armed and the field on, press the switch off.

**Expected.** The slate goes, the legend goes, and the armed wire's highlight is exactly as it was.

### T-1457 — nothing to paint, nothing to press

**Do.** Not walkable on this drawing — **automated only** (`LocateTab.test.tsx`). On a drawing with
no authored route and no bus, there is **no switch at all**.

***Why.*** *A switch that paints nothing reads as broken rather than as empty. This is drawing
number two on the morning somebody opens it.*

### T-1458 — selecting `GND` now paints the 0 V-to-earth bond *(the server half)*

**Do.** On the **Drawing** tab — no password needed — select net **`GND`**, then net **`0V`**.

**Expected.** **`W019`'s route is painted for both.** It is the one wire on this sheet whose two
ends are on different nets: `PS1:-2` is `0V` and `TB-GND-B:2` is `GND`, and the bond is the point
of the wire.

***Why.*** *`/api/paths`'s membership map was built from the generated `wires[].net`, which holds
**one** net per wire — so `GND`'s highlight was missing a wire you can see. It is now built from
each net's **member terminals**: either end a member means that wire's runs belong to that net's
highlight. A rule about membership and never about a net's name, so it carries to the next
drawing. The netlist itself was never wrong, and nothing was authored to fix this.*

### T-1459 — `Unclaimed ink` is gone, and still reachable

**Do.** On the Drawing tab, look at the toolbar. Then open
<http://localhost:9700/webui/?unclaimed=1> and go to the Drawing tab.

**Expected.** **No `Unclaimed ink` switch** anywhere on the toolbar. With the query string, the
pink overlay and its legend are there as before, on arrival, with no switch to press.

***Why.*** *You rejected it as a human-facing view: "the conductors are not a true representation
of the paths… the ink is what the human can see, while the conductors are what the ai thinks the
human can see." Its denominator was the extractor's reading of the paper rather than the paper. On
your instruction the code stays for diagnostics — `?unclaimed=1` is how, and keeping it reachable
is what keeps it tested. **T-1400 to T-1407 are spent**; three of them changed shape, because they
were tests of the switch itself.*

---

## If something is wrong

| What you see | Likely |
|---|---|
| No `Authored paths` switch | the bundle was not rebuilt, or `/api/paths` published nothing — check the count with the one-liner above |
| Slate on ink you have not authored | a real fault. The field is exactly `/api/paths`'s `wires[].runs` plus `commoning[].runs` and nothing computes a polyline |
| Ink you **have** authored with no slate | check the wire actually has a route and not *no path on this sheet*; if it has one, that is a real fault |
| The field does not grow after you accept a route | expected for about a second; if a reload is needed, the save's index refresh failed — look for a red save badge |
| `GND` still paints nothing | the server was not restarted (`python -m app` has no reloader) |

**Nothing in this field is ever accepted.** A run it leaves dark is a question for your eyes —
`W042` is the standing reason.
