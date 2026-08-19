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
| T-100 | The list is the work queue; counts read `1 of 178 placed` | | |
| T-110 | Picking a row arms it, panel appears, sheet flies to 50% | | |
| T-120 | A click places; a pan does **not** place | | |
| T-130 | Placing a terminal; own point beats parent | | |
| T-140 | Dragging a dot; what a drag moves | | |
| T-150 | The advance, wrapping, and turning it off | | |
| T-160 | Unplace, and removing the last site drops the record | | |
| T-165 | `Esc` (or ✕) selects nothing and gives the hand back | | |
| T-170 | The Locate and Drawing tabs agree on where a point is | | |

## T-2xx — sites and pins — `03_tests_sites_and_pins.md`

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-200 | One site, created by the first click, named `main` | | |
| T-210 | Three sites on `CR-BP`, three dots | | |
| T-220 | Renaming sites to `coil` / `nc` / `no` | | |
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
| T-340 | Removing a label point leaves the route intact | | |
| T-350 | A wire citation lands on its label on the Drawing tab | | |

## T-4xx — saving and recovering — `05_tests_save_and_recover.md`

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-400 | The gate; the demo password does not open the editor | | |
| T-410 | Autosave, coalescing, the Save button | | |
| T-420 | The Drawing tab is not one save behind | | |
| T-430 | Refusals appear in the red strip, per field | | |
| T-440 | **The stale-draft hazard — confirm or refute** | | |
| T-450 | Regeneration, and the test that goes red until you do | | |
| T-460 | Survives a restart; `by` and `at` are recorded | | |

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
