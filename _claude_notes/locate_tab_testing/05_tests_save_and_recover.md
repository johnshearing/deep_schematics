# T-4xx — the password, saving, persistence, refusals, regeneration, undo

Index: `locate_tab_instruction_and_test_manual.md`.

These tests are about the file, not the screen. The screen is only a way to write
`locations.json`; if these fail, nothing else matters.

The file:

    schematic_extraction/PS20115MLM4-2/extracted_docs/locations.json

Small enough to `cat` and paste whole into a report. Do that liberally here.

---

## T-400 · The gate

**Do.** Start the server (index §1) and open the **Locate** tab without unlocking anything.

**Expected.** A panel headed **"The Locate editor is locked"**, a paragraph saying it has its own
password separate from the demo password, a password box, and an **Unlock** button. No list, no
sheet, no tiles being downloaded.

**Do.** Type a wrong password and press Enter.

**Expected.** The server's own words: *"That is not the editor password."* Still locked.

**Do.** Type `edit-1234`.

**Expected.** The gate disappears and the list appears.

**Why two passwords.** Permission to spend tokens and permission to change where the drawing says
things are are different permissions. The demo password (`1234`) does **not** open the editor, and
the editor password does not unlock Opus.

**Do, for completeness.** Stop the server, start it with the flag off, and reload:

    cd server && SWUI_ALLOW_EDITS=false .venv/bin/python -m app

**Expected.** **No Locate tab at all** — not a locked one. With edits disallowed the routes are never
registered, so there is nothing to guess a password against. Restart normally afterwards.

---

## T-410 · Autosave, and what the badge is telling you

**Do.** Place a point. Watch the badge without touching anything.

**Expected.** `no changes` → `unsaved` → (about 0.9 s) → `saving…` → `saved`.

**Do.** Place five points quickly, in under a second each.

**Expected.** They coalesce — you should see roughly **one** `saving…`, not five. The debounce means
a run of clicks is one write. The write itself is atomic (`os.replace`), so one landing mid-run
costs nothing.

**Do.** Place a point and click **Save** immediately, before the debounce fires.

**Expected.** `saving…` → `saved` at once. The button is disabled when there is nothing to write.

**If the badge sticks on `unsaved`.** The debounce timer or the `PUT` is not firing. Note whether
**Save** works manually — that separates the timer from the request.

**If the badge says `not saved`.** Read the red text to its left; that is the server's own message.
Paste it verbatim.

---

## T-420 · The Drawing tab is not one save behind

**Do.** Place a point for a component whose dot you can find on the **Drawing** tab. Note the
coordinate. Switch to the **Drawing** tab **without reloading the page** — `F2` is the one
keystroke that does it — and find that component's marker.

**Expected.** It is at the **new** coordinate, and it is **filled** rather than hollow — the Drawing
tab now knows a person placed it. Hover it: the tooltip says *"placed by hand"*.

**Why this can break.** The editor writes the file; the Drawing tab reads a *derived* index from
`/api/designators`. If the index is not re-fetched after a save, the file is right and the viewer
keeps drawing the estimate. Owner: `appStore.refreshDesignators`, called from the store's `save`.

**If it is stale.** Reload the page and check again. If a reload fixes it, the refresh call is not
happening; if a reload does not fix it, the write did not land and this is really T-410.

---

## T-425 · Crossing to the drawing mid-run costs nothing *(added 2026-08-19)*

**Do.** Tick the advance and place two or three points, so you are in the middle of a run. Now,
**immediately after a click** — inside the second, while the badge still says `unsaved` — press
`F2`, look at the drawing, and press `F2` again to come back.

**Expected.** Everything is where you left it: the same row armed, the target panel up with the same
site, the sheet at the same pan and zoom, and the badge reading `saved` — the autosave is a timer in
the store and it fires whether or not the tab is on screen. The Drawing tab keeps its own pan and
zoom independently of this one.

**Why this test exists.** Both tabs are `keepMounted`, and this is the test that says so out loud.
If that ever changes, coming back here **remounts** the editor, which calls `load()` again — and
`load()` reads the file, so a draft that had not been saved yet would be silently replaced by what
is on disk. That is hazard H1 wearing different clothes, and now that `F2` makes the crossing
effortless it will happen a hundred times a session instead of twice.

**If the target or the zoom resets.** Read `webui/src/tabs.ts` first: `keepMounted: true` on both
the Drawing and Locate entries is what this test is really checking. Then `06_code_map.md` §H1.

**If a point you placed just before pressing `F2` is missing from the file.** That is a genuine
fault and worth a full report — `SAVE_DEBOUNCE_MS` is 900, so the write should have gone out while
you were on the other tab.

---

## T-426 · The Ask tab keeps your place *(added 2026-08-24)*

**Not a Locate test at all** — it lives here because T-425 above is the other half of the same
crossing, and `F2` is what both are about.

**Do.** Ask something that produces a long answer, so the transcript scrolls. Scroll **up** into the
middle of it and find a clickable identifier. Click it — you land on the drawing. Now press `F2` to
come back.

**Expected.** You are back at **the same line you were reading**, not at the bottom of the answer.

**Do.** Cross back and forth a few times, from different places in the answer.

**Expected.** Each time you return to wherever you last were.

**Do.** Now scroll to the very bottom, cross over and come back.

**Expected.** The bottom — and if an answer is still streaming, it keeps following it. *"I was at the
end"* and *"I was 3000 px down, which happened to be the end at the time"* are different intentions
and the tab remembers which one you had.

**Do.** Press **New conversation**, then cross over and back.

**Expected.** The top of an empty screen. A remembered offset measured against a transcript that no
longer exists would leave you looking at blank space.

**Why it was wrong.** The Ask tab is the one tab that is **not** `keepMounted` — a transcript is
cheap to rebuild, where a pan, a zoom and an unsaved draft are not — so every crossing unmounts it
and every return builds a fresh one, which started at the bottom. That is the whole point of the
`F2` seam undone: the loop it exists for is *read a line, click the identifier in it, check the
sheet, come back to the same line*, and a reader who has to find their place again each time is
being charged for the round trip.

**If it lands in the wrong place.** `webui/src/features/ask/AskTab.tsx` — the offset is module state
beside the component, on purpose: it changes on every scroll event, and putting it in a store would
re-render the whole transcript sixty times a second while somebody scrolls.

---

## T-430 · Refusals, and the red strip

Validation is **per field**: one bad value costs that value and nothing else, and everything refused
is published rather than dropped — because a coordinate you typed and the server silently ignored is
the worst outcome available here.

**Do.** Stop the server. Hand-edit `locations.json` to add a component that does not exist:

```json
"components": {
  "CR-GHOST": { "sites": [ { "id": "main", "point": [100, 100], "terminals": [],
                             "source": "human" } ] }
}
```

Start the server, open the Locate tab, unlock.

**Expected.** A **red strip** across the top:
*"locations.json places 'CR-GHOST', which is not in circuit_logic.json"*. Everything else in the
file still works — the strip is a report, not a failure.

**Do.** Now make a genuinely broken value — a coordinate with a letter in it:

```json
"terminals": { "TB-110:1": { "point": [100, "2O0"], "source": "human" } }
```

**Expected.** A strip saying *"has no usable point"*, naming the entry. `TB-110:1` stays unplaced.
Every other entry is unaffected.

**Do.** Change `"schema": 1` to `"schema": 2`.

**Expected.** One strip saying the file declares schema 2, and **the whole file is ignored** — every
point reverts to its estimate. A half-understood coordinate file is worse than none.

**Do.** Change `"drawing_number"` to something else and try to **save from the editor**.

**Expected.** The save fails with `not saved` and a message naming both drawing numbers. Points from
one sheet are meaningless on another, and this is the mistake someone with two tabs open will
actually make.

**Clean up.** Undo your hand edits before continuing.

---

## T-440 · The stale-draft hazard — please confirm or refute this one

This is **known issue K2** and I consider it the most serious gap in the current design. I want to
know how easy it is to hit in practice.

**Do.** Open the Locate tab in **two browser tabs**, both unlocked. In tab A place a point for
`CR-ON`. Wait for `saved`. Now in tab B — which has *not* been reloaded — place a point for `CR1`
and wait for `saved`.

**Expected, and this is the problem.** Tab B's save is a **whole document**, and its document was
loaded before `CR-ON` existed. So `CR-ON` is likely to **vanish** from `locations.json`. Tab A's
screen still shows it, because tab A does not re-read the file either.

**Report either way**, with the file contents after each step. If it does *not* happen I want to
know that too.

**The same shape without two tabs:** leave the Locate tab open, hand-edit `locations.json`, then
place one more point in the tab. The hand edit is likely to be lost.

**Why it is like this.** The save is deliberately whole-file: the editor holds the document it
loaded and sends it back, so there is no patch protocol to get wrong and the file stays a text file
a person can read. What is missing is a **version check** — the server should refuse a save written
against a document it has since replaced. That is the fix, and it is not large.

**Practical rule until it is fixed: one Locate tab, and do not hand-edit while it is open.**

---

## T-450 · Regenerating `circuit_logic.json`

**Do.** After any save, look at the banner under the toolbar.

**Expected.** *"circuit_logic.json is behind locations.json — re-run `python
author_circuit_logic.py` in the extraction directory."* plus a note that the sheet you are looking
at is already current.

**Why the editor does not do it for you.** Running Python from a web request is a different kind of
program from the one this is, and the generator prints a summary a person should read.

**Do.** Run it:

    cd schematic_extraction/PS20115MLM4-2/extracted_docs && \
      /home/js/schematics/server/.venv/bin/python author_circuit_logic.py

**Expected.** A summary ending with a line like
`from locations.json: 3 sites, 6 terminals, 1 labels` — the numbers should match what you have
placed. Sites and terminals count what was folded in; labels counts wire and net label points.

**Do.** Run the server test suite.

    cd server && .venv/bin/python -m pytest -q

**Expected.** All green. Specifically
`test_the_committed_artifact_is_exactly_what_the_generator_writes` passes, which is the check that
`circuit_logic.json` is exactly what the generator produces from the two authored inputs.

**Do.** Now place one more point in the editor and run the suite again **without** regenerating.

**Expected.** That one test **fails**. That is deliberate and useful: the staleness the banner warns
about is also a red test, so it cannot be quietly forgotten. Regenerate and it goes green.

**What the fold-in should look like** in `circuit_logic.json` afterwards — a component:

```json
"location": { "x": 861, "y": 679, "zone": "bottom-right", "source": "human", "site": "coil" },
"sites": [ { "id": "coil", "point": [861, 679], "terminals": ["A1", "A2"], "source": "human" } ]
```

and a wire, which gets `label_location` and **never** `location`:

```json
"label_location": { "x": 742, "y": 511, "source": "human" }
```

**Check one absence.** A terminal nobody placed must have **no** `location` key at all — not its
parent's point. "Somewhere on `CR-ON`" and "on `CR-ON:A2`" are different claims and the generated
artifact must not blur them; the server does that substitution at read time and labels it `parent`.

---

## T-460 · Survives a restart

**Do.** Place several points, let them save, then stop the server, start it again, reload the
browser, unlock, and look.

**Expected.** Every point is exactly where you left it, all rows read `placed`, the counts match,
and the stale banner is **gone** (it is a per-session flag, not a file fact — it comes back on your
next save).

**Do.** Check `by` and `at` in the file.

**Expected.** `"by": "js"` on everything you placed — from `SWUI_EDITOR_NAME` — and an ISO timestamp
from your **browser's** clock, not the server's. A point with an owner is the whole argument for a
human tier over a computed one.

---

## T-470 · `Ctrl+Z` — putting back the point you did not mean to move *(added 2026-08-24)*

This is **`K8`**, and it is here because of a real accident: on 2026-08-24 `BYPASS-CB:1` moved from
y 663.8 to y 663.7 — a tenth of a point, a 160th of a conductor row, invisible on screen — and the
coordinate it replaced was gone from the running program. Git recovers the last **commit**; it has
never recovered the last **action**.

**Do.** Unlock, pick any terminal that is already `placed`, and note its coordinate from the target
panel — it is printed there, *"Placed by hand at 385.4, 663.8"*. Now drag its dot a little way and
let go.

**Expected.** The panel shows the new coordinate and the badge goes `unsaved` → `saved`.

**Do.** Press `Ctrl+Z` (`Cmd+Z` on a Mac).

**Expected.** Three things at once:

1. the coordinate in the panel is **exactly** the old one again, to the tenth of a point;
2. the toolbar says **`undid: moved BYPASS-CB:1`** beside the save badge — an undo that happens
   silently on a 275-row document is indistinguishable from a key that did nothing;
3. the badge goes `unsaved` → `saved` again. **An undo is a mutation and is written to the file.**
   An undo that did not persist would be a lie the moment you reloaded.

**Do.** Press `Ctrl+Shift+Z`.

**Expected.** The drag is back, and the toolbar says `redid: moved …`.

**Do.** Undo once more, then place a *different* point. Now press `Ctrl+Shift+Z`.

**Expected.** **Nothing happens.** A new edit after an undo is a new branch of history, and the
redo you abandoned is gone. This is how every editor behaves and it is worth meeting once.

**Do.** Press `Ctrl+Z` about sixty times.

**Expected.** It walks back fifty steps and then stops doing anything. Fifty whole-document
snapshots is the depth, chosen because the document is 38 KB and fifty of them is under 2 MB — next
to the 2.2 MB of tiles on the same page, that is nothing, and it buys an undo that **cannot be
subtly wrong**. An inverse-patch scheme would be smaller and a bug in it would lose work, which is
the exact thing being fixed.

**Do.** Reload the page, unlock, and press `Ctrl+Z`.

**Expected.** **Nothing.** The stack is in memory and dies with the page — deliberately. Loading a
file also clears it, because a stack over one document would undo this file's points into that
file's coordinates. **Cross-session recovery is still git's job**, and this is why a run of
placement should end in a commit:

    git diff schematic_extraction/PS20115MLM4-2/extracted_docs/locations.json

names the point and its old coordinate exactly. That is the whole recovery story beyond the page.

**If `Ctrl+Z` does nothing at all.** Check the Locate tab is the tab on screen. There are now
**three** `window` key listeners in the application — this tab's `Escape`, the Drawing tab's
`Escape`, and this one — and the `activeTabId` guard is the only thing keeping them apart
(`06_code_map.md` §H10).

---

## T-480 · What undo covers, and what it deliberately does not *(added 2026-08-24)*

The rule is **document mutations only**. An undo that also walked back where you were looking would
interleave with navigation, and then nobody can predict what the key will do.

**Do.** Zoom to about 200%, pick the `Terminals` filter, arm a row, place a point. Press `Ctrl+Z`.

**Expected.** The point is unplaced. The **zoom is unchanged**, the **filter is still `Terminals`**,
and the sheet has not moved.

**Do.** Note which row is armed, then arm a *different* row, and press `Ctrl+Z`.

**Expected.** The armed row jumps to **the row whose value just changed** — and the list scrolls it
into view. That is the one exception, and it is announcement rather than history: undo never
restores whatever happened to be armed *before*, it points at what it changed. On a list of 275 rows
you would otherwise have to go and find it.

**Do.** Now undo each of these in turn and watch the toolbar's words:

| Do this | Then `Ctrl+Z` should say |
|---|---|
| rename a site from `main` to `Coil` | `undid: renamed CR-BP's site main to Coil` |
| tick pin `A1` onto a site | `undid: put pin A1 on CR-BP site Coil` |
| pick a label side with the compass | `undid: label side of CR-BP (Coil)` |
| press **Unplace** on a terminal | `undid: unplaced CR-BP:A1` |
| remove a site with the bin icon | `undid: removed site Coil of CR-BP` |
| place a wire's label point | `undid: placed W047's label point` |

**Every one of them is undoable, and none of them needed its own code.** Every mutation in this
editor already funnelled through one function, so the stack is a push inside it — which is why this
was a small change rather than a large one.

**Do.** Click into a site-name box, type a few characters, and press `Ctrl+Z` with the caret still
in the box.

**Expected.** The **typing** is undone by the browser. No dot moves anywhere and the toolbar says
nothing. A `window` listener sees every keystroke in the application including the ones being typed
into a box, and undoing a coordinate because somebody was renaming a site would be the worst version
of this feature.

---

## T-490 · `Shift`+arrows — moving a marker a little, exactly *(added 2026-08-24)*

The other half of the cure, and the reason **a minimum-drag threshold was considered and rejected**:
on this drawing a twitch and a deliberate 0.1 pt correction are the same gesture, so no threshold can
tell them apart. Undo covers the accident; this makes a small move something you can do **on
purpose**, without a mouse.

*(There already is a small threshold, and it is not the one that was rejected: a press must travel
3 CSS pixels before it counts as a drag at all. What it cannot catch is a real drag that goes out and
comes most of the way back — see `06_code_map.md` on `DRAG_SLOP`.)*

**Do.** Arm a terminal that is already `placed` and note its coordinate in the panel. Press
`Shift`+`→`.

**Expected.** The coordinate's **x goes up by exactly 1.0**. The dot moves a hair; at fit zoom that
is about half a screen pixel, so watch the **number in the panel**, not the sheet.

**Do.** Press `Shift`+`Alt`+`→`.

**Expected.** x goes up by exactly **0.1** — one tenth is the precision `locations.json` records, so
this is the finest thing the file can say and there is deliberately nothing smaller.

**Do.** `Shift`+`↑` and `Shift`+`↓`.

**Expected.** Up **decreases** y. The page's origin is its top-left corner, and up the sheet is
toward it.

**Do. This is the test that matters.** Fit the sheet (about 11%), press `Shift`+`→` once and note
the coordinate. Now zoom in to 200% or more and press `Shift`+`→` again.

**Expected.** **The same 1.0 pt both times.** The step is in **points, not pixels**, so a nudge is
the same correction at every magnification — against 16 pt conductor rows, one point is a sixteenth
of a row wherever you are standing. A step measured in screen pixels would be twenty times coarser
at fit zoom than at 200% with nothing on screen to tell you.

**Do.** Press a **bare** `→`, with the row still armed.

**Expected.** **The sheet pans** and the coordinate does not change. Bare arrows are the viewport's
and stay the viewport's: the moment you are working on a dot is exactly the moment you also want to
pan, and a key that silently means two things depending on hidden state is worse than a modifier.

**Do.** Press `Shift`+`+` (that is, `Shift` and `=` on most keyboards).

**Expected.** It still **zooms in**. The sheet ignores *modified arrows* only — a blanket
"`Shift` is not mine" would have quietly broken zooming, because `+` needs `Shift` to type.

**Do.** Press `Shift`+`→` ten times, then `Ctrl+Z` **once**.

**Expected.** The dot goes back to where the run **started** — not one tenth of the way back. A run
of nudges is one undo step, the way a text editor coalesces typing. The same is true of a drag: one
gesture is one step, however many frames it took.

**Do.** With **nothing** armed, press `Shift`+`→`.

**Expected.** Nothing at all.

**Do.** Arm a terminal that reads **`on its component`** — one nobody has placed, drawn hollow on its
parent's dot — and press `Shift`+`→`.

**Expected.** **Nothing, and this is deliberate.** There is a dot on screen, so it looks like
something that should move. But that dot is the *component's* point, and nudging it would turn
*"we guessed `CR-BP:12` is at the coil"* into *"a human confirmed `CR-BP:12` is 1 pt from the
coil"* — a lie of exactly the kind this whole file exists to prevent. **Placing is a click and stays
a click**; the keyboard only corrects what a person already put somewhere.

**Do.** Check the file after a nudge.

**Expected.** `source: human`, your `by`, a fresh `at`, and the coordinate rounded to one decimal.
A nudge goes down the same write path a drag does, so it inherits all of that and there was nothing
new to validate.
