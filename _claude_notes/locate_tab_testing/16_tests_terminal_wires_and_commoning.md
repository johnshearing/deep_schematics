# T-11xx — a terminal's wires, a block's commoning, and *is there a wire here*

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-09-09** with Phases C and D of `_claude_notes/authoring_the_wires.md` (Session 3).

**This document is written to be worked without reading a word of explanation.** Every test is
**Do** and **Expected** first and short. Under some of them is a ***Why*** paragraph in italics —
those are **skippable**. The arguments live in the code and in `06_code_map.md`; this page is for a
person with a mouse.

---

## Before you start

    cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/

**There is a server change this session, so restart it.** The client is a rebuilt bundle too.
Editor password `edit-1234` — but **most of this document needs no password at all**, and that is
the point of it.

Four checks, before you touch anything: **245 server · 433 web · ruff clean · tsc clean**.

### What is new, in five lines

- **The Drawing tab can answer *what is this line*.** Click bare paper and it names the run.
- **Clicking a terminal highlights every wire that reaches it.**
- **A net's highlight includes the block's commoning** — once you have confirmed the commoning.
- **You confirm a block's commoning on the Locate tab**, from a new `Commoning` filter.
- **`/api/conductors` no longer needs the editor password.** That is what makes the first two work
  for somebody holding the paper.

---

## T-1100 · The runs of ink are free now — **the acceptance criterion**

**Do.** Stop the server. Set `SWUI_ALLOW_EDITS=false` in `server/.env`. Start it again and run:

    curl -s -o /dev/null -w '%{http_code}\n' localhost:9700/api/conductors
    curl -s -o /dev/null -w '%{http_code}\n' localhost:9700/api/paths
    curl -s -o /dev/null -w '%{http_code}\n' localhost:9700/api/wiring

**Expected.** **200**, **200**, **404**.

**Do.** Open the Drawing tab and click on a conductor.

**Expected.** A card naming it. No Locate tab, no Review tab, no password anywhere.

**Do.** Put `SWUI_ALLOW_EDITS=true` back and restart.

> ***Why (skippable).*** `/api/conductors` was behind the password from the day it was built,
> because 149 candidate polylines are no use to somebody who cannot accept one into a file. Phase D
> added a second reader with a different question — *what is this line, and does any wire claim
> it* — which needs the same polylines and no password. What did **not** move is that
> `geometry.json` itself never leaves the server: it is narrowed twice, key by key, and a test pins
> the set. Hazard `H20` was rewritten round this; the line it draws now is **geometry is free and
> connectivity is not**, which is why `/api/wiring` is still 404.

---

## T-1105 · Confirm a block's commoning

**Needs the editor password.**

**Do.** Locate tab → unlock → press the new **`Commoning`** filter, the third one.

**Expected.** **Six rows** — `TB-0V`, `TB-24E1-A`, `TB-24E1-B`, `TB-110`, `TB-120`, `TB-GND-B` —
and in the toolbar:

    0 of 6 blocks commoned

**Do.** Click **`TB-0V`**. Look at the section headed **This block's commoning**.

**Expected.**

    This block's commoning     [ the ink proposes ]
    1 run    C0105                              279.6 pt
    [ This is TB-0V's commoning ]

**Do.** Hover the `1 run  C0105` line.

**Expected.** A **blue** stripe down the block's vertical, from row 1 to row 12. It stops at row
12; it does **not** carry on west across the sheet.

**Do.** Press **`This is TB-0V's commoning`**.

**Expected.** The badge becomes `you, on 2026-09-09`, the count goes to `1 of 6 blocks commoned`,
and a **`Take it back`** button appears. The `wiring` save badge goes `unsaved` → `saved`.

**Do.** Wait for the save, then look at the file:

    cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs
    python3 -c "import json;print(json.dumps(json.load(open('wiring.json'))['commoning'],indent=2))"

**Expected.**

```json
{
  "TB-0V": {
    "runs": [[[954.4, 267.3], [954.4, 546.7]]],
    "geometry": "extracted",
    "attribution": "human",
    "conductors": ["C0105"],
    "by": "js",
    "at": "2026-09-09T..."
  }
}
```

> ***Why the stripe stops at row 12, which is the whole of this format (skippable).*** `C0105` is
> **one** conductor holding `DISCHARGE1:2`'s wire *and* all 279.6 pt of the block's vertical — the
> extractor splits a conductor at a crossover hop and a T-junction is not one. So a record saying
> *"conductor `C0105`"* would claim that wire as part of the bus. The record stores the **stretch**
> instead, and `conductors` says only which run it was cut out of.

> ***Why there is a button at all (skippable).*** The rule that finds a bus is *two or more of one
> block's terminals lying on one run*. It is a good rule — told nothing about this drawing it finds
> all eight of the commoning conductors somebody listed by hand — and it is already known to be
> incomplete here (T-1115). So it proposes, you decide, and `derived` is refused by name if
> anything ever tries to write the proposal into the file as though a person had accepted it.

---

## T-1110 · A commoning save does **not** move the netlist

**Do.** With `TB-0V` confirmed, look at the top of the screen.

**Expected.** **No `circuit_logic.json is behind` banner** from this save. (If you confirmed a wire
earlier in the session, that banner is still there from the wire.)

**Do.** Note the checksum, run the generator, and compare:

    cd /home/js/schematics/schematic_extraction/PS20115MLM4-2/extracted_docs
    md5sum circuit_logic.json
    python3 author_circuit_logic.py
    md5sum circuit_logic.json

**Expected.** **The same checksum, twice.**

> ***Why (skippable).*** `wiring.json` holds two sections and they are opposites. A wire's
> endpoints **are** the netlist — that is the `CONNECTS_TO` edge the model answers from, and saving
> one names two commands. A block's commoning never enters the netlist at all: no `W###`, no edge,
> no entity. It is display geometry, like a path. The generator does not read the section, and
> `test_commoning_does_not_reach_the_netlist` compares the output bytes with and without one rather
> than making the argument.

---

## T-1115 · A block the ink cannot offer a bus for — **and one of the three questions for your eyes**

**Do.** Press `All`, and click **`TB-130`**.

**Expected.** **No *This block's commoning* section at all.** `TB-130` is not in the `Commoning`
filter either.

**Do.** Zoom in on `TB-130` on the sheet and look at it.

**Expected.** Its two points are **71 pt apart with no conductor drawn between them.**

**This is a question for you, not a fault.** Three wires reach a block with two points and no bus.
Also worth a look while you are there: **`TB-120:3`**, which sits 24 pt below `:2`, off the end of
`C0092` — it may be a third landing rather than a separate point. Both are on the plan's §14 list.
**Tell me what you see and I will decide what the file needs.**

> ***Why this screen cannot help (skippable).*** Every commoning record is a stretch of a real
> conductor, lifted from the PDF's own strokes. Where there is no conductor there is nothing to
> lift, and the only honest alternatives are *hand-trace one* — which does not exist yet — or *say
> this block has no bus*, which is a format decision waiting on what you see.

---

## T-1120 · A net highlighted **with** its commoning — the change you asked for

**Drawing tab. No password.**

**Do.** Drawing tab → find `0V` in the list on the left → click it.

**Expected.** The sheet paints every traced wire on the net **and the vertical they land on**, and
the card says:

    highlighted: 3 of its 13 wires   with TB-0V's commoning

**Do.** Press the `Nets` layer switch **off**.

**Expected.** The highlight **stays**. So does the commoning.

> ***Why it says 3 and not 11 (skippable, and worth reading once).*** You asked for *"eleven wire
> runs and the vertical they land on"*. The vertical is there. The eleven are not, because only 3
> of net `0V`'s 13 wires have a **route** authored yet — that is the `Paths` queue, and it is your
> work rather than this session's. As you trace them the number climbs on its own. **Nothing else
> needs doing for the eleven to appear.**

> ***Why a wire's highlight does **not** include the bus (skippable).*** Select `W063` and you get
> `C0091` alone. Painting `TB-120`'s vertical underneath it, in the same colour, is exactly the
> picture that had `07_drawing_facts.md` calling that vertical *"the second piece of `W063`'s L"*
> for a week. A net and a terminal are questions about a **place in the circuit**, where the bus is
> part of the answer. A wire is a claim about **one piece of ink**, and it is not.

---

## T-1125 · Click a terminal → the wires that reach it

**Drawing tab. No password.**

**Do.** Press the `Terminals` layer switch on. Zoom in on `TB-0V` and click the dot on **row 6**
(`TB-0V:6`).

**Expected.** The card names the pin, and under it:

    one wire lands here
    [ W042 ]

The sheet highlights `W042`'s route if it has one, plus `TB-0V`'s commoning if you confirmed it in
T-1105.

**Do.** Click the **`W042`** chip.

**Expected.** `W042` is selected, its whole route is highlighted, and the card offers **← back to
`TB-0V:6`**.

**Do.** Now go to the **Locate** tab, arm any row, and click a terminal dot.

**Expected.** It **places or re-arms**, exactly as it always has. Nothing is highlighted.

> ***Why the same click means two things (skippable).*** *What lands on this pin* is a reader's
> question and *put the dot here* is an editor's. They live on two tabs, which is how they stay
> apart without a modifier key — and on this tab the click already **selected** the terminal, so
> what changed is what the selection **paints**, not what the click **means**.

---

## T-1130 · A pin nothing reaches — **the missing wire, visible by its absence**

**Do.** Click **`TB-0V:8`**.

**Expected.**

    No wire in the index reaches this pin. That is a finding rather than a blank: every one of
    the drawing's 71 wires has two endpoints recorded, so a pin with none is a pin nothing was
    assigned to.

**Do.** Do the same for **`:9`** and **`:11`**.

**Expected.** The same, on both.

**This is the instrument for your authoring run.** Those three rows are where `W044`, `W050` and
`W057` have to go — the plan's §3.5 has the table — and this is the screen that shows you the three
holes at once. Use it while you work.

> ***Why it is worth building before the run rather than after (skippable).*** A wire on the wrong
> screw is invisible at the row it should be on and wrong at the row it is on. Clicking row 8 and
> being told *nothing here* is the only view of the sheet that shows the defect as a **gap** rather
> than as a plausible-looking wire somewhere else.

---

## T-1135 · The sheet hit-test, verdict 1 — **claimed by a wire**

**Do.** Find a wire you have traced. Click **directly on its conductor**, on bare paper, not on a
dot.

**Expected.** A card in the bottom-left corner:

    C0109        a run of ink   [our id]
    BLUE 18AWG   printed 120    65.6 pt
    claimed by W052
    58 of 71 wires have a route so far, so "no wire claims this run" can also mean nobody has
    traced it yet.
    pointed at from 0.4 pt away · conductor rows on this sheet are 16 pt apart

**Do.** Click the **`W052`** link on the card.

**Expected.** The wire is selected and its route is highlighted.

**Do.** Click somewhere on **blank paper**, well away from any line.

**Expected.** **Nothing happens.** No card.

---

## T-1140 · Verdict 2 — **`TB-120`'s commoning**

**Do.** Zoom in on `TB-120` and click the short vertical between points **1 and 2** (`C0092`).

**Expected.**

    C0092                a run of ink   [our id]
    no colour or gauge printed          72.7 pt
    TB-120's commoning — by its shape, and nobody has confirmed it
    A terminal block joins its own screws with this. It is not field wire, so no wire may claim
    it — which is why it carries no printed name.

**Do.** Go to the Locate tab, `Commoning`, `TB-120`, and confirm it. Come back and click `C0092`
again.

**Expected.** The same, **without** the *by its shape* caveat. It now reads simply
**`TB-120`'s commoning**.

> ***Why two wordings (skippable).*** They are two different claims. The shape rule *found* this
> one; a person *decided* it. A screen that printed the same sentence for both would be reporting a
> decision nobody made — which is the distinction every authored file in this project exists for.

---

## T-1145 · Verdict 3 — **no wire claims this run**, and the count that makes it honest

**Do.** Click on a **label leader line** — one of the short strokes running from a printed net
number to the conductor it names.

**Expected.**

    no wire claims this run
    Around 90 of this sheet's 149 runs are label leader lines, earth symbols and the internal
    strokes of a symbol rather than wiring.
    58 of 71 wires have a route so far, so "no wire claims this run" can also mean nobody has
    traced it yet.

**Read the second number before you believe the first.** Both sentences are on the card on purpose.

> ***Why (skippable).*** Until every wire has a route, *no wire claims this run* is also the answer
> for real wiring nobody has got to. A card that gave the verdict alone would teach a false fact on
> its first use, so the coverage is printed beside every verdict — including *claimed by*.

---

## T-1150 · One corner, two cards, and `Escape`

**Do.** Select net `120` from the list. Then click a conductor on the sheet.

**Expected.** The conductor's card replaces the net's card. **The net stays selected and stays
highlighted.**

**Do.** Press `Escape`.

**Expected.** The conductor card goes. **The net's card comes back**, still selected.

**Do.** Press `Escape` again.

**Expected.** Now the selection clears.

> ***Why in that order (skippable).*** Each press takes exactly one thing away, most recent first —
> the same escalation the Locate tab uses for a trace and an end slot (`H22`). Asking what a line
> is in the middle of reading a net is a question *about the net*; paying for it with your place in
> the drawing would make the feature cost something to use.

---

## T-1155 · The bus is never offered as a wire's route

**Needs the editor password.**

**Do.** Locate tab → `Paths` → arm **`W063`**.

**Expected.** **`C0091` at the top, tagged `both ends`**, and underneath the candidate list:

    not offered: C0092 is TB-120's own commoning. A terminal block joins its own screws with it,
    so no wire may claim it.

**Do.** Accept `C0091`.

**Expected.** One stripe reaching both of `W063`'s pins. There is no second piece to add.

> ***Why this changed, and what it corrects (skippable).*** `07_drawing_facts.md` recorded `C0092`
> as the second half of `W063`'s L, and `14_tests_path_editor.md` T-915 **told you to accept it**.
> Both were wrong: `W063` ends at `TB-120:1`, `C0091` reaches both its pins, and `C0092` is the
> block's bus. Both documents are corrected. The run is now removed from the ranking rather than
> tagged, because a tag on a row you can still press is not a rule — and the panel names what it
> kept out, because a list that quietly drops things is one nobody can trust.

---

## T-1160 · What is deliberately not here

So you do not go looking for it, and so nobody builds it by accident:

| Not built | Why, and when |
|---|---|
| **Hand-tracing a block's bus** | Every commoning record is a stretch of a real conductor. `TB-130` has none, and whether the answer is *trace one* or *say this block has no bus* is **T-1115's question for you**. |
| **`Add a wire` / `Retire this wire`** | **Phase E.** §3.7 measured **0** genuinely missing field wires, so it is insurance for drawing number two. The format is ready and the door is deliberately shut. |
| **A wire's highlight including the bus** | Decided against, deliberately — see T-1120's second *Why*. Plan §9 asked for it; `W063` is the reason it is not there. |
| **The `Ask` tab reasoning about highlighted wires** | **Next**, and it is your own note at the end of the plan. Everything it needs now exists: a terminal's wires, the commoning on the sheet, and a hit-test that can name what a line belongs to. |

---

## If something looks wrong

| What you see | Look at |
|---|---|
| Clicking a line does nothing at all | The toolbar says *the runs of ink did not load* if that is why. Otherwise you may be more than **6 pt** from the conductor — zoom in. A click on a **dot** never reaches the hit-test, by design |
| The card names a conductor I was not pointing at | Worth a report, with the zoom percentage and roughly where you clicked. `features/drawing/hitTest.ts` is the whole of it, and the tolerance is 6 pt of **paper**, not of screen |
| `no wire claims this run` on a wire I know exists | Almost certainly right and almost certainly temporary: it means no **route** has been authored for it. The count on the card says how many have |
| A net's highlight has no commoning in it | Have you confirmed that block's bus (T-1105)? An unconfirmed block is silently absent rather than an error, because until your run every block is one |
| The commoning appeared on the Locate tab but not on the Drawing tab | It should appear immediately — the save re-reads `/api/paths`. If a reload fixes it, that is a real fault: `wiringStore.save`, `appStore.refreshPaths` |
| No **This block's commoning** section on a component | 41 of the 47 components are not terminal blocks and never have one. If it is a block, the ink joins none of its points — T-1115 |
| The `Commoning` list is empty | `/api/conductors` did not load. The list's membership is a measurement over the ink, so with no ink there is nothing to offer |
| `C0092` offered as a candidate route | A real fault — T-1155. `features/locate/wiring.ts` `isCommoning` and `paths.ts` `candidates()` |
| Clicking a terminal on the **Locate** tab highlighted something | A real fault. That tab places; this one paints. `06_code_map.md` §H11 and decision 7 |
| `Escape` cleared my selection when I meant to close the conductor card | The card had already gone. Card → selection, one press each — `06_code_map.md` §H22 |

---

## What this session cost, and what is left of §14

**Two new client modules, two new panels, one server route freed.** `features/drawing/hitTest.ts`
is the sheet hit-test; `lib/polyline.ts` is the point-space arithmetic all three measurements now
share; `CommoningPanel.tsx` authors a block's bus; `ConductorCard.tsx` says what a line is. On the
server, `wiring.py` gained the `commoning` record format and `/api/conductors` lost its password.
**16 new server tests and 41 new web tests.**

**§14's estimate is unchanged for the wires: about 100 gestures.** What is added is **six clicks**
for the six blocks' commoning, and **three zooms** for the questions in T-1115. Both are small, and
the second one is the only part of this session's work that comes back to me.
