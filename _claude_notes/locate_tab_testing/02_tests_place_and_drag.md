# T-1xx — picking, placing, advancing, dragging

Index: `locate_tab_instruction_and_test_manual.md`. Vocabulary: `01_screen_and_vocabulary.md`.
Ids and coordinates: `07_drawing_facts.md`.

These are the tests that matter most, because they cover the gesture you will perform 178 times.
Work through them in order — each one teaches the thing the next one assumes.

**Before starting:** server running (index §1), Locate tab open, unlocked, filter on **To do**. The
advance checkbox starts **off** — T-120 and T-150 say when to tick it.

---

## T-100 · The list is the work queue

**Do.** Look at the toolbar counts and the list.

**Expected.** Counts read `1 of 178 placed · 177 to do · 0 of 97 wire and net labels` (the `1` is
`DISCHARGE1:4`, already placed — see index §5). The list shows components and terminals only; no
`W###` and no net numbers, **in alphabetical order by id**, so each component is followed by its own
pins (`CR-BP`, `CR-BP:11`, `CR-BP:12`, … `CR-BP:A1`) rather than by the next component.
Rows say `estimate` or `on its component`, except for **six** that say
`nowhere` — the two off-page machines and the four referenced drawings, which have no position
anywhere and never will (see known issue **K7** and `07_drawing_facts.md`).

**If not.** Wrong filter, or `coverage()` in `model.ts`.

---

## T-110 · Picking a row arms it and flies the sheet to it

**Do.** Click the row **`CR-BP`**.

**Expected.** Four things at once:

1. The row highlights.
2. The target panel appears below the list, headed `CR-BP` with the badge `site main`.
3. The sheet **flies** — animated, about 0.4 s — and lands with `CR-BP` centred, at **`50%`** zoom.
   That number is not arbitrary: a target with no size of its own gets half of native resolution,
   which is where 4 pt lettering becomes readable and about a quarter of the sheet is still visible.
   The dot under the centre is **hollow** (it is the vision pass's estimate).
4. The cursor over the sheet is a **crosshair**.

**Why hollow matters.** That is the screen refusing to claim it knows where `CR-BP` is. Your click
is what turns it solid.

**Do.** Pan the sheet away from the dot, then click the `CR-BP` row again.

**Expected.** It flies **back**. Asking twice flies twice — that was known issue **K1**, and it was
fixed on 2026-08-19 by making a flight something the click asks for rather than something an effect
works out from the row's id having changed. If nothing happens, K1 has come back: `LocateTab.tsx`
`flyTo`.

**Two exceptions, both deliberate:** a row drawn in more than one place fits the whole sheet instead
of closing in on one of its dots (T-215), and **nothing flies at all while you are zoomed in past
50%** (T-115).

---

## T-115 · Zoomed in past 50%, the sheet stays where you put it (2026-08-19, not yet walked)

**The complaint this came from**, and it is worth having in your head before you test it: *"when I
select a terminal, the page zooms to 50% and centres on the marker. That is good when I am zoomed
all the way out. But when I am already past 50% I usually have the marker in front of me and control
of it, so moving the drawing interrupts the work."*

**Do.** Pick any row and let the sheet fly to it — `50%`, as T-110 says. Now press **`+`** once (or
the toolbar `+`): the readout says `70%`. Pan a little, so the dot is off centre. Now pick a
**different** row in the list.

**Expected.**

- The row arms: it highlights, the target panel changes to it, the cursor stays a crosshair, and a
  click on the sheet would place *that* row. Everything about **arming** is unchanged.
- **The sheet does not move.** The zoom readout still says `70%` and the drawing has not shifted by
  a pixel — not re-centred, not zoomed, nothing.

**Do.** Tick the advance and place two rows in a row, still at `70%`.

**Expected.** Same: each click places and the target moves on down the list, and the sheet stays
still. The same rule covers the site buttons and clicking a dot — **every** flight, not just the
one from the list.

**Do.** Now press `Fit` (or `0`), so the readout says about `11%`, and pick a row again.

**Expected.** It flies, exactly as T-110 describes, landing at `50%`. **Below the ceiling nothing
has changed at all.**

**Do.** Zoom to exactly `50%` — `Fit`, then pick a row, which lands you there — pan away, and pick
another row.

**Expected.** It flies. The rule is *closer in than 50%*, not *at* 50%, so 50% itself still gets the
old behaviour. This is the boundary, and it is the one place to be careful when reporting: say what
the readout said.

**Why 50% and not some other number.** It is the same 50% a flight lands at (`FOCUS_ZOOM`), which
means a flight can never zoom you *in* from there — from anywhere closer it can only take
magnification away. One constant, read from one place; if the flight zoom ever changes, the ceiling
follows it.

**If the sheet still flies while you are zoomed in.** `LocateTab.tsx` — `FLY_CEILING_PERCENT` and
the guard in the flight effect, which reads the zoom from a **ref** so that it is the zoom at the
moment of the flight rather than at the render that asked for one.

**If nothing flies any more, at any zoom** — including from `Fit` — the ref is the first suspect,
then `viewer.percent`.

---

## T-120 · A click places the point — and the pan-versus-place rule

**Do.** With `CR-BP` armed, zoom out a little (`Fit` is fine), then **click** anywhere on the sheet.

**Expected.**

- A **filled red** dot appears exactly where you clicked, labelled `CR-BP` (if zoom ≥ 30%).
- The save badge goes `unsaved`, then `saved` within about a second.
- The `CR-BP` row **leaves the To do list** and the counts go to `2 of 178 placed`.
- The target **stays on `CR-BP`** and the sheet stays where it is, because the advance is off until
  you ask for it. Tick *Move to the next unplaced after each click* and place one more: now the
  target moves to the next unplaced row and the sheet flies there. Untick it again before going on.

**Then do.** Switch the filter to **Components**, click the `CR-BP` row, and read the coordinate in
the target panel.

**Expected.** A number pair with **at most one decimal place** — `612, 396` or `740.5, 511.2`, never
`348.30000000000007`. Points are rounded to a tenth, which is already finer than anything printed on
this sheet and keeps a hand-readable file readable.

**Now the rule.** Press the pointer down on the sheet, **drag 100 px**, release.

**Expected.** The sheet pans. **No point is placed.** The save badge stays as it was.

**Why.** A placement is defined as *a click that did not move the sheet* — not as a click that
moved the pointer less than N pixels. There is no tolerance to pick, and it also refuses a click
that lands while the sheet is still flying to the previous target, where the coordinate under the
cursor is not the one you were aiming at.

**If a pan places a point.** `LocateTab.tsx` `onClick` / `pressedAt` — see `06_code_map.md`.

---

## T-130 · Placing a terminal, and precedence

**Do.** Filter **Terminals**. Click `CR-BP:A1`. Note where the sheet lands and what the panel says.

**Expected.** The panel says `unplaced`, and the prose explains that the viewer is showing
`CR-BP`'s point and that this is *a different claim* from knowing where the pin is. The dot is
hollow.

**Do.** Click the sheet somewhere clearly away from the `CR-BP` dot — 40 pt or so.

**Expected.** A filled dot at your click, labelled `CR-BP:A1`. The `CR-BP` component dot **stays
where it was**. The panel now reads `its own point` with the coordinate.

**The precedence you have just exercised**, and it is the whole reason terminals exist separately:

    a terminal's own point   beats   the site claiming that pin   beats   its parent component

`A1` and `A2` are about 20 pt apart as printed, so both need their own points even though both
belong to the coil site.

---

## T-140 · Dragging a dot

**Do.** Filter **Components**. Zoom to about 100% so you can see clearly. Press on the `CR-BP` dot,
move about 50 px, release.

**Expected.**

- The dot follows the pointer while you hold it.
- On release the save badge goes `unsaved` → `saved`.
- The panel's coordinate updates.
- The sheet does **not** pan.
- Clicking a dot without moving it **selects** that row instead of dragging (this is K5: you cannot
  place a point underneath an existing dot by clicking it — drag it, or zoom in and click beside it).

**What a drag moves, and it is not always obvious.** A drag moves *whatever the dot's row names*:

| Drag this dot | Moves |
|---|---|
| a component's dot | **that site** — and therefore every pin assigned to it |
| a terminal's dot | **that pin's own point** only, even if it was showing its site's point |
| a wire's or net's dot | **the label point** |

Dragging a terminal that was sitting at its site's dot therefore *detaches* it: the site stays, the
pin gets its own point. That is intended — it is how you separate `A1` from `A2`.

**If the dot jumps somewhere far away on the first pixel of movement.** That is the projection, not
the drag: `paint.ts` `cssToPoint`. Report the before and after coordinates.

**If nothing happens at all and the sheet pans instead.** `MarkerLayer.tsx` `onDragPoint` is not
reaching the marker. Note whether the cursor over the dot was a **move** cursor (four arrows) — if
it was a grab hand, the Locate tab is not passing the handler.

---

## T-150 · The advance, and turning it on

**Do.** Tick *Move to the next unplaced after each click* — it starts **off**. Filter **To do**.
Place three rows in a row, clicking the sheet three times without touching the list in between.

**Expected.** Each click places, then jumps to the next unplaced row **down the list** — the list is
alphabetical, so after `CR-BP` comes `CR-BP:11`, not whichever pin the extraction listed first — and
flies there. Counts climb by one each time. You never touch the list.

**Do.** Untick it again. Pick one row and click the sheet twice in two different spots.

**Expected.** Both clicks apply to the **same** row; the second overwrites the first. The target
stays put. This is the mode for correcting one dot, and it is the one you start in.

**Do.** Tick it back on. Place until the *To do* list is short, then keep going past the end.

**Expected.** The advance **wraps** to the first thing still outstanding rather than stopping — so
nothing you skipped is left to be hunted for later. When nothing is left, the target clears and the
panel disappears.

---

## T-160 · Unplacing

**Do.** Filter **Terminals**, pick a terminal you have placed, click **Unplace**.

**Expected.** Save badge cycles to `saved`. The row returns to `on its component` (or `nowhere` if
its parent has no point). The dot goes hollow. In `locations.json` the entry is **gone from
`terminals`** — not set to null, not left as an empty object.

**Do.** Filter **Components**, pick a component with one site, click the **🗑** on that site.

**Expected.** The component is removed from `locations.json` **entirely**, not left as
`{"sites": []}`. Otherwise an untouched drawing's file fills up with empty records for everything
anyone ever clicked, and the file stops being readable by a person — which is half its value.

---

## T-165 · Selecting nothing, and getting the hand back

**Do.** Pick any row, so the cursor over the sheet is a crosshair and one dot is red. Now press
**`Esc`**.

**Expected.**

- The red dot goes back to blue.
- The row stops being highlighted and the target panel disappears.
- The cursor over the sheet is a **hand** again, closing to a grab when you hold the button.
- A click on the sheet now places **nothing** — the save badge does not move.

**Do.** Pick a row again and click the **✕** at the right of the target panel's header.

**Expected.** Exactly the same four things. The key and the button are the same action; the button
exists because a key nobody has been told about is not a way out.

**Do.** Pick a component you have placed, click into its **site-name box**, type a character, and
press `Esc`.

**Expected.** The **first** `Esc` only leaves the box — the target stays armed and the panel stays
up. A **second** `Esc` clears the target. Half a typed name is work, and `Esc` is the key people
press to abandon it, so the field gets first refusal.

**Why this test exists.** Being armed is a *mode*, and it is the one mode in this application where
the next click writes a coordinate into an authored file. Until this existed the only exit from it
was into another one — picking a different row — so somebody who had finished placing and wanted
to read the drawing kept a crosshair and a live target for the rest of the session.

**If not.** `LocateTab.tsx` — the `Escape` effect (a `window` listener, guarded on `activeTabId`).
For the button, `TargetPanel.tsx` `Header`. `isTextField` is in `webui/src/lib/keys.ts` since
2026-08-19, when the Drawing tab got the same key: there are **two** `window` Escape listeners now
and the tab guard is all that separates them, so read `06_code_map.md` §H10 before changing either.

---

## T-170 · The projection is shared with the Drawing tab

This is the test that catches the single worst class of bug here: an editor whose arithmetic
disagrees with the tiles would write coordinates that are wrong *by a consistent offset*, which is
invisible while you are placing and obvious later.

**Do.** Place a point on some visually unmistakable feature — a terminal dot printed on the sheet,
or a corner of a box. Note the coordinate from the panel. Now switch to the **Drawing** tab —
**`F2`** does it in one keystroke from anywhere, and `F2` again brings you back — and click any
answer citation, or switch on the group the designator belongs to (`Components`, `Terminals` or
`Wire & net labels` — see T-190) and find its dot.

**Expected.** The Drawing tab's dot sits on the **same printed feature**, at any zoom, on any
display. Both tabs go through `paint.ts` — there is exactly one projection in this application.

**If they disagree.** Report both coordinates and the zoom percentage on each tab. That narrows it
to `pointToCss` versus `cssToPoint` immediately.

---

## T-180 · The list follows the sheet

**Do.** Filter **To do** and scroll the list a long way down — far enough that the rows near the top
are off screen. Now click a **dot** near the top of the sheet, belonging to one of those rows.

**Expected.** The list **scrolls to the row that dot belongs to**, and that row is the highlighted
one. You should not have to hunt for it.

**Do.** Now click a row that is already visible in the middle of the list.

**Expected.** The list does **not** move. Scrolling is `nearest`: a row already on screen stays
exactly where it is, so picking rows never makes the list jump under the pointer.

**Do.** Tick the advance and place two or three rows in a row.

**Expected.** The list follows the advance down as well.

**Why this test exists.** The armed row was always highlighted; it was just often highlighted
somewhere you could not see. On 275 rows that turns every click on a dot into a scroll-and-search
in the list — which is the searching this whole screen exists to remove.

**If not.** `WorkList.tsx` `armedRow` — the `scrollIntoView` effect, keyed on the target id and on
the entries (the filter re-lays-out the list under an unchanged target).

---

## T-190 · The Drawing tab shows the same three groups (2026-08-19, not yet walked)

**New, and asked for from this manual.** The Locate tab has filtered its list by *Components*,
*Terminals* and *Wire & net labels* since it was written. The Drawing tab drew components and
nothing else, so a placement run had no way to check a **pin** from the reader's side — which is the
side that matters, and which T-170 asks you to check for components only. It now has all three.

**The one difference from this tab, and it is deliberate.** Over here the filter picks which rows you
are *working through*, so exactly one at a time is right. Over there you are reading, and the useful
questions are comparisons — *is that pin on the same conductor row as its relay* — so all three are
**independent switches** and any combination is allowed, including none.

**Do.** Switch to the **Drawing** tab (`F2`). Find the three buttons in the toolbar, left of the
zoom controls.

**Expected.** `Components` is **on**, `Terminals` and `Wire & net labels` are **off** — the view this
tab has always had, so nothing appears unasked. A group with nothing to draw has **no button at
all**.

**Changed 2026-08-24:** the third button is now there on this drawing, where before there were only
two. Nobody has placed a printed-name position, so that group has no *markers* — but it now also
carries the **265 end labels**, one at each wire end and net terminal, and those are text rather than
dots. "Nothing to draw" means both halves are empty. Press it and expect a great deal of text at once
above 30% zoom; that is `10_tests_end_labels.md` T-550, and it is why the group still starts off.

**Expected, added 2026-08-19 on request.** A group that is **on** is a **filled** button — the same
way this tab's filter buttons show which filter is in effect — and one that is off is plain. Press
each in turn and read only the buttons: at any moment you can say which of the three are in effect
without looking at the sheet, which matters here precisely because any combination is legal. It was
`aria-pressed` plus a slightly brighter word before, which a screen reader could tell you and a
person could not.

**Do.** Press `Terminals`.

**Expected.** The pins appear **and the components stay**. Both, at once, is the whole point.

**Expected, and this is the thing to look at.** Most terminals are **hollow dots sitting on top of
their component's dot** — that is a pin nobody has placed, drawn at its component's point, and the
tooltip says so in words. Zoom past 30% and the ids appear; a pin with its own point separates from
its relay by the 10–20 pt that made this editor necessary. **The fog is expected.** It is the honest
picture of how much is still guessed, and it is why the group starts off.

**Do.** Click one of those pin dots.

**Expected.** The card names the **pin** — `CR-BP:A1`, kind `terminal` — not its relay. Press
`Ask about this` and the composer gets the terminal's question, not the component's.

**Why this test exists.** `onMarker` used to raise every click as `{kind: 'component'}`, because
components were the only things with dots. The card looks the entry up by **id**, so a wrong `kind`
would have drawn a perfectly correct-looking card while putting a lie in the store — and every
consumer of a selection switches on `kind`. Nothing on screen would have told you.

**If not.** `DrawingTab.tsx` — `LAYERS` and the `layers` memo for what is drawn, `shown` for the
switches, `onMarker` for the kind. Five tests in `DrawingTab.test.tsx` cover it.
