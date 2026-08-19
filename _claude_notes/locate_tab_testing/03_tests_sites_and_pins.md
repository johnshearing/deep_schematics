# T-2xx — components drawn more than once, and which pins are where

Index: `locate_tab_instruction_and_test_manual.md`. Ids and coordinates: `07_drawing_facts.md`.

This is the part of the model a real drawing forces, and the part most likely to feel confusing
before you have done it once. `CR-BP` is the worked example throughout because it is the hardest
case on this sheet.

**Before starting:** T-1xx passed, so you know click-to-place works. Filter **Components**.

---

## Why sites exist at all

`CR-BP` is a relay. On this sheet it is drawn in **three separate places**, because its coil and its
two contacts belong to three different circuits:

| Site | Pins drawn there | Roughly |
|---|---|---|
| coil | `A1`, `A2` | (861, 679) — right-hand column |
| NC contact | `11`, `12` | (714, 520) |
| NO contact | `21`, `24` | (592, 223) |

One point per component cannot say that. If you place `CR-BP` once and stop, then any answer
citing `CR-BP:24` flies the reader to the coil — about eight inches from the contact they wanted.
That is the reported fault this model exists to fix.

**And the pins cannot be worked out from what they do.** `11` and `21` are both function `common`.
No rule over function can tell you which contact each belongs to. Only a person looking at the
drawing can, which is why the pin chips are checkboxes and not a heuristic.

---

## T-200 · One site, the default

**Do.** Pick `CR-ON` (a relay drawn once, as far as we know). Read the panel before clicking
anything.

**Expected.** The panel shows **no site blocks** and one button: **Place this component**. Below it,
a line saying nothing is placed yet and that the dot on the sheet is the indexing pass's estimate.

**Do.** Click the sheet on the relay's coil.

**Expected.** A site block appears, named **`main`**, with your coordinate, showing `placing`. Its
pin chips are `A1 A2 11 14`, none of them ticked. In `locations.json`:

```json
"CR-ON": { "sites": [ { "id": "main", "terminals": [], "point": [x, y],
                        "source": "human", "by": "js", "at": "..." } ] }
```

**Note what did *not* happen.** No site existed until you clicked. "Add a site" is a state of the
editor, not of the file — a site with no point would be refused by the server's validation and
reported as a problem, so the file only ever holds sites that are somewhere.

---

## T-210 · Three sites on one component

**Do.** Pick `CR-BP`. Place its first site on the **coil**. Then click **+ Another site** and place
that one on the **NC contact**. Then **+ Another site** again, and place the **NO contact**.

**Expected.**

- Three site blocks, named `main`, `site-2`, `site-3`.
- **Three dots on the sheet**, all filled, all labelled `CR-BP`.
- Hovering each dot shows its site name in the tooltip — `CR-BP — relay … (site-2). placed by hand`.
- The `CR-BP` row still counts as **one** placed component in the toolbar. Sites are not units of
  work; components are.

**If you only ever see one dot.** `model.ts` `editorPlaces` is collapsing the list, or the filter is
hiding the others. Report how many site blocks the panel shows versus how many dots you can count.

---

## T-215 · Getting to the site you meant

Three dots under one id is the moment this screen can lose you: the row names all three, and until
2026-08-19 everything that moved the sheet moved it to whichever one was created first. These four
gestures are the way around a component drawn more than once. **Do them with `CR-BP`'s three sites
from T-210 in place.**

**Do.** Pan and zoom somewhere else entirely, then click the `CR-BP` **row**.

**Expected.** The sheet zooms out to **fit the whole drawing** — not to one of the three dots — and
you can see all three at once, spread across the sheet. That is the fact worth having: a relay drawn
in three circuits looks exactly like a relay drawn once if you are shown only one of its dots.
Rows drawn in a single place are unchanged and still fly in to `50%` (T-110).

**Do.** Now click the dot on the **NO contact** — the third site created, near (592, 223).

**Expected.** The sheet closes in on **that** dot, at `50%`. The panel's armed site becomes `no`
(the `no` block says `placing`, the others say `place`), and the list scrolls to `CR-BP` if it had
moved away. Before this it armed `coil` and flew to the coil, most of a sheet away, so anybody who
clicked a dot in order to **move** it had to drag the sheet back to where they had just been.

**Do.** With the panel showing all three site blocks, press the **`place`** button on `nc`.

**Expected.** The sheet flies to the **NC contact** and `nc` becomes the armed site. The site blocks
are the only thing on screen that names one site of several, so their buttons are how you visit
them.

**Do.** Pan away, then press the **`placing`** button — the one on the site already armed.

**Expected.** It flies **back** to that site. The button that is already active is not inert; it is
how you return to where you were working. (That is **K1**, and it is fixed.)

**Do.** Press **+ Another site**, then drag a dot.

**Expected.** Neither moves the sheet. A site that does not exist yet has nowhere to fly to, and a
drag must never pull the sheet out from under the gesture.

**If a flight goes to the wrong dot, or does not happen.** `LocateTab.tsx` `framing` decides *what*
is framed — a named site, the whole sheet, or one point — and `flyTo` is what every call site asks.
Say which gesture you used and what the zoom percentage read afterwards: `50%` is "one dot, closed
in on", and anything near the `Fit` percentage is "the whole sheet" — which of the two you got says
immediately which branch of `framing` ran.

---

## T-220 · Renaming a site

**Do.** In the `main` block, backspace the name away a character at a time, type `coil`, and press
`Enter`. Rename `site-2` to `nc` and `site-3` to `no` the same way.

**Expected.** The box takes the whole word without the caret ever leaving it — backspacing to
empty is fine, and so is typing on afterwards. **Nothing is written while you type.** The name
lands in the file when you press `Enter` or click away: the save badge goes `unsaved` once, not
once per keystroke, and the dots' tooltips follow. The file shows `"id": "coil"` etc.

**Then do.** Rename `nc` to `coil` — a name the component already uses — and click away.

**Expected.** The rename is refused, because two sites called `coil` is not a document the server
would accept. What you typed **stays in the box** with a red edge and the reason under it
(`CR-BP already has a site called coil`), so it can be corrected rather than retyped. `Esc` gives
the stored name back.

*(This was known issue **K3** — the box used to accept one character at a time and appear frozen
if you emptied it. Both halves are fixed: the box holds its own text, and the document is written
once. If it ever behaves per-keystroke again, `TargetPanel.tsx` `SiteName` is the owner.)*

---

## T-230 · Assigning pins to sites

This is the step that makes the sites mean anything.

**Do.** With the `coil` site armed, click the chips `A1` and `A2`. Then arm `nc` and click `11` and
`12`. Then arm `no` and click `21` and `24`.

**Expected.**

- Ticked chips highlight in the site they belong to.
- In every *other* site block, those chips show **struck through** — that is "claimed by another
  site", and the tooltip says which.
- The file records the assignment:

```json
{ "id": "nc", "terminals": ["11", "12"], "point": [714, 520], "source": "human", ... }
```

**Now the payoff.** Filter **Terminals** and look at `CR-BP:24`.

**Expected.** It reads **`placed`**, not `on its component`, and its dot is on the **NO contact** —
even though you never placed `CR-BP:24` itself. Assigning the pin to a placed site is what gives it
a position. This is why placing 47 components well is worth more than placing 131 terminals badly.

**Do.** Arm the `coil` site and click the chip `11` (currently owned by `nc`).

**Expected.** `11` **moves** to `coil` — it does not appear in both. A pin claimed by two sites is a
human error the server reports rather than arbitrates, and it is cheaper never to create one.

**If a pin ends up in two site blocks at once.** `model.ts` `assignTerminal` — it is supposed to
strip the pin from every site before adding it to the target one. Paste the `"CR-BP"` block from the
file.

---

## T-240 · A pin with its own point beats its site

**Do.** With `coil` holding `A1` and `A2`, filter **Terminals**, pick `CR-BP:A1`, and place it about
20 pt above the coil dot. Then pick `CR-BP:A2` and place it about 20 pt below.

**Expected.** Three dots in that area: the coil site, and `A1` and `A2` at their own points. The
site's dot does not move. Both terminals read `its own point` in their panels.

**Why this is the normal case, not an edge case.** `A1` and `A2` are printed about 20 pt apart on
every relay on this sheet. The site gets you to the right circuit; the terminal's own point gets you
to the right screw.

---

## T-250 · Removing a site does not orphan its pins

**Do.** Arm the `no` site and click its **🗑**.

**Expected.**

- The `no` block disappears, and so does its dot.
- `CR-BP:21` and `CR-BP:24` go back to `on its component` (hollow dots at the coil), because the
  site that positioned them is gone.
- `CR-BP` still counts as placed — it has two sites left.
- The file's `"CR-BP"` block has two entries in `sites` and no trace of `no`.

**Do.** Now remove the other two sites as well.

**Expected.** `CR-BP` disappears from `locations.json` **entirely** — no `{"sites": []}` left
behind. Its row goes back to `estimate`.

---

## T-260 · `CR-SW`, the reported fault

The original bug report was that `CR-SW:14` flew to (861, 704) — the coil — while the contact is
drawn at about (569, 473), most of the sheet away. This test closes it by hand.

**Do.** Pick `CR-SW`. Place `main` on the coil at the bottom right. Rename it `coil` and assign
`A1` and `A2`. Add a second site, place it on the contact block near (569, 473), rename it
`contact`, and assign `11` and `14`.

**Expected.** Filter **Terminals**, pick `CR-SW:14`: it reads `placed`, and its dot is on the
**contact**. Switch to the **Drawing** tab and select `CR-SW:14` (via a citation, or the marker) —
it lands on the contact there too.

**This is the end-to-end proof of the whole design**: a human's assignment, in an authored file,
changing where the reader is taken. If it works, say so — it is worth knowing.
