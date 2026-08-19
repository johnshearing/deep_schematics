# T-4xx — the password, saving, persistence, refusals, regeneration

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
