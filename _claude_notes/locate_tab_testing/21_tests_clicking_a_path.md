# T-150x — clicking a path: *whose is this, and where there is no answer, silence*

Index: `locate_tab_instruction_and_test_manual.md`.
Added **2026-09-17** with §4A of `_claude_notes/highlighting_wires_and_nets_03.md`.

**Written to be worked without reading a word of explanation.** Every test is **Do** and
**Expected** first and short. Under some of them is a ***Why*** paragraph in italics — those are
**skippable**.

---

## Before you start

**Client only.** One command, and **do not restart the server** — there is no server edit in this
change:

    cd /home/js/schematics/webui && npm run build

Then <http://localhost:9700/webui/>. This is the **Drawing** tab, so **no password is needed for
anything below** — `GET /api/paths` has no editor gate by design, and nothing here writes a byte.

Four checks before you touch anything: **263 server · 506 web · ruff clean · tsc clean** (they were 263 · 490 when this phase started; **read them off your own run**, they move as
tests are added).

### What is new, in four lines

- **Click over a painted path on the Drawing tab and it lights up**, and a card appears in the
  **lower right** naming the **wire** or the **block** that owns it.
- **Click over ink that no path claims and nothing happens at all** — no card, no highlight, not
  even a *no wire claims this run*. **That silence is the message: a path needs to be created
  there.**
- **The conductor card is gone from the reader's screen.** It still works at
  **`?unclaimed=1`**, with the overlay it belongs to.
- **The lower-right corner was empty**, so the path card and the **selection** card in the
  lower-left can now be on screen **at the same time**.

### The numbers as they stood on 2026-09-17

Read off `locations.json` and `wiring.json` on the day, and **they move as you author** — what is
on screen is the authority, never this page:

| | |
|---|---|
| wires with a route | **59 of 71**, **17** of them hand-traced |
| blocks with a bus | **6**, contributing **7** runs |
| **runs you can click** | **68** — exactly what `Authored paths` paints |

**That equality is the feature and not a coincidence.** The click searches the same published
index the field paints from, so: *anything you can see in the field, you can click.*

---

## T-1500 · Clicking a route names the wire that owns it

**Do.** On the **Locate** tab, switch `Authored paths` on and look at the sheet. Pick a painted run
you recognise and note roughly where it is. Now go to the **Drawing** tab and click **directly on
that run**, on bare paper, not on a dot.

**Expected.** A card in the **lower right**, in this shape — the id, the counts and the length
will be that run's own, read off the payload and not off this page:

    W052        this wire’s route
    lifted from the drawing   1 run   ... pt along the ink
    Drawn and corrected on the Locate tab, on this wire’s own row.
    pointed at from 0.4 pt away · conductor rows on this sheet are 16 pt apart

and **the whole route highlighted** in the selection colour — every run of it, not just the one you
clicked. A route across a crossover hop says **2 runs** and gives the length of both.

**Do.** Click the **`W052`** link on the card.

**Expected.** Nothing jumps. The wire is already selected — the click selected it — and the link is
there for when you want the row in the list rather than the ink.

> ***Why there is no `C0080` anywhere on it (skippable).*** The ink's own names are the
> extraction's. They are printed nowhere on the paper, the model is told not to read the file they
> live in, and not showing them is the whole of this line of work. The card says *lifted from the
> drawing* instead, which is the fact about the **path** rather than a name for the ink.

---

## T-1501 · Clicking a block's bus names the block

**Do.** Click one of the short verticals inside a terminal block — one of the six you have authored
a bus for. `TB-0V`'s long vertical is the easiest to hit.

**Expected.**

    TB-0V       this block’s own bus
    lifted from the drawing   1 run   279.6 pt along the ink        (or however long yours is)
    A terminal block joins its own screws with this. It is not field wire, so no wire may claim
    it — which is why it carries no printed name.
    Drawn and corrected on the Locate tab, under Commoning.

**and the bus highlighted.** The **component** is selected, not a wire — look at the list on the
left and you will see its row.

> ***Why the component (skippable).*** A block's commoning lives on the component, which is where
> its panel is. One answer to *whose is this* has to serve the card here and, next session, the
> armed row on the Locate tab — so the block-to-component step happens once, in the caller, and
> never twice with a chance to disagree.

---

## T-1502 · **The silence** — clicking un-authored ink does nothing at all

**Do.** Find a run of ink that `Authored paths` leaves **unpainted** — there is plenty; about 90 of
the 149 extracted runs are leader lines and symbol strokes, and every wire you have not traced yet
is dark too. Click straight down the middle of it.

**Expected.** **Nothing.** No card. No highlight. No message. And if something was selected before
you clicked, **it is still selected and still highlighted, exactly as it was.**

**Do.** Click on blank paper, well away from any line.

**Expected.** The same nothing.

**This is the feature, and it is the half worth checking hardest.** *Nothing happened* means **a
path needs to be created here** — the same instrument as the unpainted ink on the Locate tab: your
eye, on the paper.

> ***Why not a verdict (skippable).*** The card used to say *no wire claims this run*. That is the
> **conductor's** question, and it is right for about 90 of the 149 runs for reasons that have
> nothing to do with your authoring — so as an answer it taught a false fact on its first use, and
> as a question it is one you have now struck three times. A screen that says nothing cannot say
> anything wrong.

---

## T-1503 · A hand-traced route is clickable exactly like a lifted one, and says which it is

**Do.** Click a route you drew yourself — one of the 17. The six relay-coil wires are all
hand-traced.

**Expected.** The same card, with **`you drew it`** where a lifted route says *lifted from the
drawing*.

> ***Why it matters that this works at all (skippable).*** A hand-traced route stores its own
> polyline and names **no** conductor, so the old conductor card could never find it: the ink it
> follows read *no wire claims this run* forever, and correctly. The click reads paths now, so a
> route you drew answers exactly like one you lifted.

---

## T-1505 · Two corners, two cards, and `Escape` takes one each

**Do.** Select net `120` from the list on the left. Then click a painted route on the sheet.

**Expected.** **Both cards are on screen.** The path card in the **lower right**, and the
**selection** card in the lower left — which now describes the **wire you just clicked**, because
the click selected it.

**Do.** Press `Escape`.

**Expected.** The path card goes. The wire stays selected and stays highlighted.

**Do.** Press `Escape` again.

**Expected.** Now the selection clears.

> ***Why they no longer take turns (skippable).*** The conductor card and the selection card both
> sat in the lower **left** and there was a precedence rule about which of them won. *What is this
> line* and *where is this identifier* are different questions, the lower right was empty, and you
> asked for the lower right — so the answer to your request also ended a fight rather than joining
> one. The `Escape` order is unchanged: one press takes one thing, most recent first.

---

## T-1506 · A click on a dot takes the corner back

**Do.** With the path card up, click a **dot** — any component or terminal marker.

**Expected.** The path card goes and the dot's card replaces it in the other corner. One gesture,
one answer.

---

## T-1507 · The conductor diagnostic still works, and only when asked for

**Do.** Open <http://localhost:9700/webui/?unclaimed=1> and go to the Drawing tab. Click a painted
route.

**Expected.** **Both** answers: the path card in the lower right, and the old conductor card in the
lower left with its three verdicts — *claimed by `W052`*, *`TB-120`'s commoning*, *no wire claims
this run* — plus the pink overlay and its legend.

**Do.** Press `Escape` **once**.

**Expected.** Both cards go together. They are two halves of the answer to one click, not two
clicks.

**Do.** Go back to <http://localhost:9700/webui/> with no query and click the same run.

**Expected.** Only the path card. **And the runs of ink are not downloaded at all** — every
remaining reader of them is behind the query now, so a reader never pays 32 KB for the
extraction's reading of the paper.

> ***Why the code is still there (skippable).*** *Is the ink there, or did we miss it?* has to stay
> answerable from the screen, and the extractor's layer fix — plan 03 §6 — is the phase that needs
> to ask it. Your own instruction is the rule being followed: *"if you need it for diagnostics then
> it is ok to leave the code in so that you can use it behind the scenes."*

---

## What this phase left open

1. **The selection card still prints conductor ids.** `SelectionCard.tsx:274` shows a route's
   `C####` list in the lower-left card, and that card is now something a **path click** puts on
   screen. It is a different control, it has been there since Phase D, and it has a walked test
   asserting the id is visible (T-1130's sibling), so it was **not** changed without you asking —
   nothing is auto-accepted here. If you want it demoted the same way, it is one prop and one
   line, and the demotion pattern is settled.
2. **The Drawing tab still has no `Authored paths` field of its own.** It is open question 1 in the
   plan and it is now more attractive than it was: a field you can see is a field you can click,
   and this card is the answer to the click. One prop and one toggle. Say so if you want it.
3. **The slate colour is still unjudged** (T-1450), and this phase did not touch it.

---

## The tests behind these

`webui/src/lib/paths.test.ts` — **7 new**, `pickPath` as arithmetic: the tolerance in both
directions, the whole path rather than the run clicked, a block's bus, ties going to the shorter
run **both ways round** so the rule is provably about length and not about which map is searched
first, and the property test that it searches **exactly** the set the field paints.

`webui/src/features/drawing/DrawingTab.test.tsx` — **9 new**: seven on the path click (T-1500 to
T-1507 above, including the nonce check that proves a miss never calls `select` at all), plus two in
the demoted block — both answers at once under the query and one `Escape` for both, and that a
reader never fetches the runs of ink. The **five conductor-card tests kept every assertion they
had** and switch the diagnostic on by query string instead of by click, exactly as the coverage
tests did on 2026-09-15.

**The bundle is already built** — this session ran `npm run build` — so if the screen does not match
this page, it is the page that is wrong.

`16_tests_terminal_wires_and_commoning.md`'s **T-1135, T-1140, T-1145 and T-1150 are spent** and
carry a demotion note. **T-1500 to T-1507 are spent; §4B starts at T-1520.**
