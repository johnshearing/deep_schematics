# Results log

Index: `locate_tab_instruction_and_test_manual.md`.

**Fill this in as you go, and this becomes the one file a new session needs to read to know what is
broken.** Mark the Result column and leave everything that passed alone; write detail only for
failures. Anything unmarked reads as "not run yet", which is useful information too.

Result codes: **P** pass · **F** fail · **?** unsure what I was looking at · **–** skipped

    Tested on: 2026-__-__    by: ____    server started with: `.venv/bin/python -m app`

---

## T-1xx — picking, placing, advancing, dragging — `02_tests_place_and_drag.md`

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-100 | The list is the work queue, alphabetical; counts read `1 of 178 placed` | | |
| T-110 | Picking a row arms it, panel appears, sheet flies to 50% | | |
| T-115 | Past 50% zoom the sheet stays put; below it, unchanged | | |
| T-120 | A click places; a pan does **not** place | | |
| T-130 | Placing a terminal; own point beats parent | | |
| T-140 | Dragging a dot; what a drag moves | | |
| T-150 | The advance: off to begin with, turned on, wrapping | | |
| T-160 | Unplace, and removing the last site drops the record | | |
| T-165 | `Esc` (or ✕) selects nothing and gives the hand back | | |
| T-170 | The Locate and Drawing tabs agree on where a point is | | |
| T-180 | The list scrolls the armed row into view, and stays put when it need not move | | |
| T-190 | The Drawing tab shows the same three groups, filled when on; a clicked pin is a **terminal** | | |

## T-2xx — sites and pins — `03_tests_sites_and_pins.md`

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-200 | One site, created by the first click, named `main` | | |
| T-210 | Three sites on `CR-BP`, three dots | | |
| T-215 | Getting to the site you meant: the row fits the sheet, a dot arms itself, the site buttons fly | | |
| T-220 | Renaming sites to `coil` / `nc` / `no` — a whole word, one write, a visible refusal | | |
| T-230 | Assigning pins; a pin moves rather than duplicating | | |
| T-240 | `A1` and `A2` get their own points, 20 pt apart | | |
| T-250 | Removing a site returns its pins to `on its component` | | |
| T-260 | `CR-SW:14` lands on the contact — **the reported fault** | | |

## T-3xx — labels — `04_tests_labels.md`

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-300 | Wires and nets are listed and are not counted as work | | |
| T-310 | Placing a wire's label point; no `point` key in the file | | |
| T-320 | A net label lands in the `nets` section | | |
| T-330 | The eight label sides; the dot does not move | | |
| T-335 | The side you chose survives to the Drawing tab — **the reported fault** | | |
| T-340 | Removing a label point leaves the route intact | | |
| T-350 | A wire citation lands on its label on the Drawing tab | | |
| T-360 | Every placed label at once on the Drawing tab; no dot on blank paper | | |

## T-4xx — saving and recovering — `05_tests_save_and_recover.md`

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-400 | The gate; the demo password does not open the editor | | |
| T-410 | Autosave, coalescing, the Save button | | |
| T-420 | The Drawing tab is not one save behind | | |
| T-425 | `F2` to the drawing and back mid-run loses nothing | | |
| T-426 | The **Ask** tab comes back to the line you were reading, not the bottom | | |
| T-430 | Refusals appear in the red strip, per field | | |
| T-440 | **The stale-draft hazard — confirm or refute** | | |
| T-450 | Regeneration, and the test that goes red until you do | | |
| T-460 | Survives a restart; `by` and `at` are recorded | | |

## T-47x–T-49x — undo, and nudging a marker — `05_tests_save_and_recover.md`

*Added 2026-08-24 with Session 1 of the wires-and-nets plan. None of these has been walked.*

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-470 | `Ctrl+Z` puts back the exact coordinate, says so, and saves · `Ctrl+Shift+Z` redoes · 50 deep · gone after a reload | | |
| T-480 | Undo covers **document mutations only** — not the zoom, not the filter · it arms the row it changed · a rename, a pin, a label side, an unplace, a label point all undo · the caret in a text box keeps its own `Ctrl+Z` | | |
| T-490 | `Shift`+arrow = 1.0 pt · `Shift`+`Alt`+arrow = 0.1 pt · **the same step at 11% and at 400%** · a bare arrow still pans · `Shift`+`+` still zooms · ten nudges undo in one press · nothing armed or nothing placed does nothing | | |

## T-5xx — what a net is made of — `09_tests_net_membership.md`

*Added 2026-08-24. **Drawing tab, no password needed.** None walked. T-500 costs one question — see
the note there.*

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-500 | Net `120` rings **seven terminals**, not five components · `CR2:14` on the NO contact and not on CR2's coil · the three `TB-120` pins are three dots | | |
| T-505 | Every ringed dot is on screen after the flight | | |
| T-510 | The card is a roster: every member, in order, undeduped, each with its own state · a wire says `ends` and lists `[from, to]` in that order · a long net scrolls rather than truncating | | |
| T-515 | Clicking a roster row flies to that pin · a `nowhere` row is not clickable | | |
| T-520 | **place it** arms that pin on the Locate tab · absent on a row that is `placed` · absent entirely with `SWUI_ALLOW_EDITS=false`, and the roster still works | | |
| T-525 | **← back to `120`** returns to the roster and re-frames the net · no back link on a card nothing sent you to | | |
| T-530 | A net marks **terminals only** · switching `Components` off takes the component dots away · a selected *terminal* still rings its parent | | |

*T-500 point 4 was **amended** the same day: the parent components are no longer marked. T-525 and
T-530 are the change.*

## T-55x–T-59x — a label at every end — `10_tests_end_labels.md`

*Added 2026-08-24 with Session 2 (Phase B). None walked. Half of these are `git diff` assertions:
what did **not** get written matters as much as what did.*

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-550 | 265 labels appear on the sheet and `locations.json` does not change · a wire shows its spec, never `W###` | | |
| T-555 | Each label faces away from its own run · nothing moves when switches are pressed or the page is reloaded | | |
| T-560 | `Wires` and `Nets` are separate filters · the counts have no "0 of 97" in them · the row reads `ends known, no path` | | |
| T-565 | One compass per end, headed with the pin id, live before anything is placed (`K4` narrowed) · one `labels` key written · `schema` is now 2 | | |
| T-570 | **Reset deletes the override** rather than writing the computed side · `Ctrl+Z` brings it back and says so | | |
| T-575 | The eye hides one end's label · pressing it off deletes the override too | | |
| T-580 | Three labels on one pin get three sides, in the fixed order · moving the pin's own label moves the others out of the way | | |
| T-585 | A net's compass per member, scrolling · labels face away from the net's centre · one label per dot, not per member | | |
| T-590 | A wire with no colour or gauge has no end labels and says why | | |

## T-60x–T-65x — the Drawing tab's list — `11_tests_drawing_list.md`

*Added 2026-08-25 with Session 3 (Phase C). **Drawing tab, no password.** None walked. Nothing in this
range writes anything: `git diff` on `schematic_extraction/` should be empty after all of them.*

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-600 | The list is there: 275 rows, the Locate tab's order, a component with its pins, the same state words and the `our id` badge | | |
| T-605 | **Five** switches over the sheet — `Wires`, `Nets` and `Labels` where there was one button · an end label needs its kind **and** `Labels` | | |
| T-610 | Net `120` selected from the list: seven pins ringed, the roster, no question spent — **`K9`** | | |
| T-615 | A wire row frames the run · **no dot on blank paper** · both ends say `BLUE 18AWG` with its switches off · `W012` has no end labels and that is right | | |
| T-620 | **The list filters the list, the switches filter the sheet, and neither touches the other** · filters are additive · none on means all · the `runs through` chips stay live | | |
| T-625 | `relay` finds five · `120` finds sixteen · `cr-bp:` finds thirteen · `zzz` says so | | |
| T-630 | Collapse to a rail and back · survives `F2` **and a reload** · the filter and the text deliberately do not | | |
| T-635 | A dot, a citation and a roster row each move the list to their row and shade it | | |
| T-640 | The six `nowhere` rows are listed, selectable, and have no dot and no flight · no editing control anywhere on a row | | |
| T-650 | **`SWUI_ALLOW_EDITS=false`: no Locate tab, and the whole list works exactly as before** — the acceptance criterion | | |

---

## Failure detail

One block per **F** or **?**. Copy the template from the index (§4) and fill it in. More is better
than less — especially the save badge, the zoom percentage, and the file contents.

```
TEST:      T-___
EXPECTED:  
GOT:       
SCREEN:    save badge said ____ · zoom said ____% · filter was ____
FILE:      
```

---

## Anything the manual did not cover

Things you tried that the manual has no test for, and what happened. This section is often the most
valuable one — it is where "I do not know how to use this" turns into a specific gap.

```

```

---

## Questions the manual left unanswered

If a test told you what to expect but not *why it matters*, or you could not tell whether what you
saw counted as a pass, say so here. An expectation you cannot check is a badly written test and it
is worth fixing before the next round.

```

```
