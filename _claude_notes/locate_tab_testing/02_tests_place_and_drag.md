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

**One exception, and it is deliberate:** a row drawn in more than one place fits the whole sheet
instead of closing in on one of its dots. That is T-215.

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
answer citation, or use the Components overlay to find the same designator.

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
