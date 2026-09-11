# Results log

Index: `locate_tab_instruction_and_test_manual.md`.

**Fill this in as you go, and this becomes the one file a new session needs to read to know what is
broken.** Mark the Result column and leave everything that passed alone; write detail only for
failures. Anything unmarked reads as "not run yet", which is useful information too.

Result codes: **P** pass · **F** fail · **?** unsure what I was looking at · **–** skipped

    Tested on: 2026-__-__    by: ____    server started with: `.venv/bin/python -m app`

---

> **Reported by John in `claude.md`, 2026-09-03, and recorded here because an unmarked table
> otherwise reads as *nobody has run this*:**
>
> > *"I have gone through all the lessons/tests and everything worked as expected."*
>
> That covers **T-800–T-840** (Session 5, the first walk of the highlighter) and everything before
> them. The columns below are left blank because they are yours to mark and marking them on your
> behalf would put a claim in this file that nobody made row by row — but the sentence above is the
> answer to *what is broken*, and the answer is nothing so far.

> **Reported by John, 2026-09-09, about the wiring editor:**
>
> > *"I went through the lessons/tests in `15_tests_wiring_editor.md`. I will admit that I didn't
> > understand everything that I was being shown, but that likely does not matter for now. The
> > important thing is that I am convinced that everything is working and so it is reasonable to
> > work on the next phases."*
>
> That covers **T-1000–T-1090**. Nothing was reported broken. The rows are left unmarked for the
> same reason as above.
>
> **The second sentence is a result too, and it is the one worth acting on.** A lesson document
> that a person works through successfully and does not fully understand has taught the gestures
> and not the reasons — which is half of what these documents are for, since the other audience is
> a session troubleshooting them. `16_tests_terminal_wires_and_commoning.md` is being written
> plainer for it: shorter sentences, the *why* in one line under the *do* rather than woven through
> it, and the arguments that belong to the code left in the code. Recorded here rather than only in
> `claude.md` so it does not get lost when the next plan is written.

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

## T-70x–T-74x — correcting what the extraction read — `12_tests_label_corrections.md`

*Added 2026-08-25 with Session 4 (Phase F). **A new `Review` tab; needs the editor password and a
server restart.** None walked. A new authored file appears the first time you correct anything:
`label_corrections.json`. **T-740 is the acceptance criterion** — the netlist must not move.*

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-700 | Four tabs; the screen is locked and fetches nothing until unlocked · `278 flagged · 515 strings · 149 runs` · **worst-read first**, `T0012` `LI-A` at 40% at the top · the 150 blanks grouped at the end | | |
| T-705 | A row says what was read, how sure, and what sort · **the caret's row is ringed on the sheet**, one ring only · a run has no confidence and says what it is missing | | |
| T-710 | `LI-A` → `L1-A` saves itself · **the run `C0030` reads it too**, `via T0012` · the file has one entry with `was` · `was` stays the *machine's* reading across a second correction | | |
| T-715 | `Net names` leaves **149** — 30 flagged labels + 119 runs · the nine misreads by id · the header count is over what is on screen | | |
| T-720 | **`All readings` reaches what the extractor was confident and wrong about** · `T0300` reads `BLACK 22 AW6` and its raw OCR said `AWG` · 51 tidyings, 2 flagged · correcting an unflagged row does not make it flagged | | |
| T-725 | **not a label** writes `null`, never `""` · `YY` at 75% and `NOT CONNECTED` at **100%** are both real cases · an emptied box is Reset, not an empty correction | | |
| T-730 | **Reset deletes the entry** rather than writing the machine's reading in · ✓ on an unchanged row records a **confirmation**, and that is deliberately kept · **blur alone records nothing** · Reset is disabled with nothing to take back | | |
| T-735 | The 79 runs with no net name bound · naming one directly writes `was: null` · a run's own correction beats the label beside it · a blank string | | |
| T-740 | **The netlist does not move** — one new untracked file and nothing else · re-running the generator changes nothing · 141 server / 232 web green, artifact test **not** stale · the Drawing and Ask tabs unchanged | | |

## T-80x–T-84x — a wire highlighted along the ink — `13_tests_paths_highlight.md`

**These need a hand edit** — there is no path editor until Session 6, and T-800 says which block to
paste, with the server stopped. It is scaffolding, and T-840 asks you to decide what to keep.

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-800 | The hand-edited `W052` block parses · `/api/paths` publishes it · a wire with no path is **absent**, and `nets` lists all 26 with their wires | | |
| T-805 | **The proof: 157 server tests green and the artifact test *not* stale after saving a path** | | |
| T-810 | `W052` highlighted along `C0109` · the ink readable through the stripe · it stops short of the pins rather than being stretched to meet them | | |
| T-815 | The two provenance badges and the conductor id · **`no path yet` on a wire that has none** · no path line at all on a component | | |
| T-820 | **A net is the union of its wires' runs** — four stripes, `3 of its 4 wires` · `W068`'s crossover gap · **nothing under `"nets"` in the file** | | |
| T-825 | The highlight survives `Nets`, `Labels` and `Components` being switched off (`H11`) · one at a time · `Esc` clears it | | |
| T-830 | The stroke is in **points**: visible at the 11% fit, thickened at 200%, and never reaching the rows 16 pt away | | |
| T-835 | An Ask-tab citation of `120` lands on the net and paints it — same `select()` as a list row | | |
| T-840 | Arming a wire on the **Locate** tab highlights it · a terminal clears it · **the pasted `path` survives an end-label edit on the same wire** · the cleanup, and the four checks | | |

## T-74x–T-77x — the small batch — `12_tests_label_corrections.md`

*Added 2026-09-03 at the head of Session 6, **before** Phase E. Four things that change what you
see while making 71 judgements about conductors, plus the polyline the path editor needed anyway and
one generated file that looked behind. None walked. No schema change and no correction moves.*

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-745 | The `kind` badge is recomputed from the text you typed · `125,` → `125` becomes `net_number` · an **uncorrected** row still shows the extraction's own word verbatim | | |
| T-750 | A third scope, **`Not a label`** — 276 decisions, flagged or not · narrows with `Net names` to the runs the matcher acts on · `Reset` takes one back | | |
| T-755 | The ✖ tooltip on a **run** says *no net name is printed on this run*, and that it is **not a bookmark** · a label row keeps its own wording | | |
| T-760 | A **note** box beside each decision · **disabled until the row is decided**, and it says why · survives a retyped reading · an empty one **deletes** rather than storing `""` · the row grows a ✎ mark | | |
| T-765 | A **run** is ringed along its own polyline; a **label** keeps its exact bbox · `C0002` is an L rather than a 206 × 215 pt box | | |
| T-770 | `build_kg.py` re-run · 693 chunks / 291 entities / 402 relationships · **`git diff` empty** — it emits no coordinates, so the staleness was a timestamp | | |

## T-90x–T-96x — the path editor — `14_tests_path_editor.md`

**The last session of the plan.** Needs the editor password and a restart. **The hand edit is over**
— T-800's pasted block was scaffolding and this is the screen that replaces it. Nothing here changes
`locations.json`'s schema: Session 5 built `path` and `no_path_on_this_sheet`, and this writes them.

**T-910 is the acceptance criterion**: the ranking has to reproduce the four pairings measured off
the sheet by hand in `07_drawing_facts.md`, and `W052` has to come back **`C0109`** and not `C0080`.

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-900 | The **Where it runs** panel · a ranked list with its reasons tagged on every row · **the geometry outranks the printed name** · hovering lights one run on the sheet, in its own colour | | |
| T-905 | Accept one click · what is written: `runs`, `conductors`, `geometry: extracted`, `attribution: **human**` · **no `point` and no `derived` anywhere** · the ink's own coordinates, unrounded | | |
| T-910 | **The four measured pairings** — `W052`→`C0109`, `W053`→`C0080`, `W063`→`C0091`+`C0092`, `W068`→`C0081`+`C0057` | | |
| T-915 | The **crossover hop**: `Add a run`, `W068` as 644 pt of ink against a 312 pt chord, **the gap left open** · `C0092` has no printed name and is still found | | |
| T-920 | **Clear** · the wire leaves the file entirely when the route was all it had · the end labels in the same record survive · clicking another candidate **replaces** rather than adds | | |
| T-925 | **No handles on a lifted run** · `Make it editable` converts to `geometry: human` and **drops `conductors`** · a dragged corner rounds to a tenth and undoes in one press | | |
| T-930 | **Trace**, all four keys — click, `Backspace`, `Esc`, `Enter` · nothing written until `Enter` · `Esc` abandons the trace and **leaves the wire armed** · one corner is refused · no `conductors` key | | |
| T-935 | **No path on this sheet** · the count goes up · pressing it again **deletes** the key rather than writing `false` · it and a route retract each other | | |
| T-940 | The **`Paths`** filter and `n of 71 wire paths` · the row leaves the queue before the save lands · held against `To do`, which still cannot reach zero (`K7`) | | |
| T-945 | **`K10`** — `NET-PB1`'s end labels read **`PB1`** · its wire's top candidate is `C0054`, tagged `corrected name` · **26 of 26 nets** | | |
| T-950 | The Review tab's ring on a **run** follows the ink; on a **label** it is still the exact bbox | | |
| T-955 | With `SWUI_ALLOW_EDITS=false`: the highlight still works and `/api/conductors` is **404, not 401** | | |
| T-960 | **172 server · 318 web · ruff clean · tsc clean**, artifact test **green** after authoring paths · only `locations.json` changed under `schematic_extraction/` | | |

---

## T-100x–T-109x — the wiring editor — `15_tests_wiring_editor.md`

**Phases A and B of the authoring-the-wires plan, 2026-09-08.** Needs the editor password **and a
restart** — `server/app/wiring.py` is new and `python -m app` has no reloader. It writes
`wiring.json`, the one authored file whose save really does make `circuit_logic.json` stale.

**Two acceptance criteria, and T-1010 and T-1030 are them.** *Confirming a wire whose endpoints do
not change still writes a record and moves the count* — 47 of the 71 wires need exactly that. And
**`W042` must be offered nothing at all**, because there the ink is wrong and the data is right: a
screen that trains you to accept the proposal is worse than no screen.

| Test | What it checks | Result | Notes if not P |
|---|---|:--:|---|
| T-1000 | The sixth filter, **`Wiring`** · 71 rows · **`0 of 71 wires confirmed`**, which is the honest number and not a claim the wires are wrong · held against `To do`, which still cannot reach zero (`K7`) | | |
| T-1005 | The **What it joins** section · two end slots · `from the index` · the proposal for one end comes from walking the ink away from the **other** | | |
| T-1010 | **`I looked and it was right` on `W067`, which changes nothing** · `source: human`, a `by` and an `at`, and **no `was`** · the count moves and the row leaves the queue before the save lands · a **second** stale banner naming `build_kg.py` too | | |
| T-1015 | **`Take it back`** · back to `source: index` · the record **stays** rather than being deleted | | |
| T-1020 | `W063`'s proposal — `TB-120:1` on `C0091` · *the ink does not offer `TB-120:2` at all* · the five tag words · hovering lights the run in **blue** · why the printed name is carried and not ranked on | | |
| T-1025 | **The eleven, in order** — the two-minute check that the instrument is right before you spend an hour on it | | |
| T-1030 | **`W042`: nothing offered, at either end** · and confirming it unchanged is the correct answer | | |
| T-1035 | **`was`** · a second thought does not overwrite the machine's original · putting it back **deletes** `was` and keeps the confirmation | | |
| T-1040 | **`Pick from the sheet`** on `W057` · every terminal gets a dot while a slot is armed · the slot disarms itself · **bare paper does nothing** while armed · `K5` finally helping | | |
| T-1045 | **`Escape`**: text field → **slot** → trace → row, one thing per press · changing rows disarms the slot | | |
| T-1050 | The two ends' nets side by side · **`two nets — look at it`** on `W019` corrected · a flag and never a fix | | |
| T-1055 | **`path may be stale`** on the row and in the panel · it does **not** put the wire back in the `Paths` queue · silent on a path with no `for` | | |
| T-1060 | **The commoning** — `W067` lands on `TB-0V:12` and not row 1, tagged `past the commoning` · **`C0092` is never offered to anything** · eight conductors found from shape alone | | |
| T-1065 | The **note**, disabled until the record has a decision to ride on · emptying it deletes the key | | |
| T-1070 | **Two banners saying different things** · the generator, then `build_kg.py` · `endpoints: {source: human}` in the artifact | | |
| T-1075 | With `SWUI_ALLOW_EDITS=false`: `/api/wiring` is **404** and `/api/paths` is **200** | | |
| T-1080 | Hand-editing: eight refusals, every one **by name** · the three that are checked against the netlist because their symptom would otherwise be nothing at all · the generator says `REFUSED:` and writes nothing | | |
| T-1085 | **228 server · 392 web · ruff clean · tsc clean** · the artifact test's failure **names which authored file is ahead** (`K12` narrowed) | | |
| T-1090 | What is deliberately **not** here: `Add a wire`, `Retire this wire`, authoring the commoning, a net's highlight including it, a terminal's wires, `/api/conductors` losing its password *(the last four landed 2026-09-09 and the first two on 2026-09-10 — see the next two tables; nothing on that row is still unbuilt)* | | |

---

## T-110x–T-116x — a terminal's wires, a block's commoning, and *is there a wire here* — `16_tests_terminal_wires_and_commoning.md`

Added 2026-09-09 with Phases C and D. **Most of this needs no password**, which is the point of it:
the reader's half runs on a server started with `SWUI_ALLOW_EDITS=false`.

**The acceptance criterion is T-1100** — `/api/conductors` answering without one. **The two worth
reporting loudly if they are wrong** are T-1110 (a commoning save must not move the netlist) and
T-1145 (the route count printed beside every verdict, without which the card teaches a false fact).

| Test | What it checks | Result | Notes |
|---|---|---|---|
| T-1100 | **`/api/conductors` 200, `/api/paths` 200, `/api/wiring` 404** with `SWUI_ALLOW_EDITS=false` · a line on the sheet can be named with no password anywhere | | |
| T-1105 | The seventh filter, **`Commoning`** · six blocks · `0 of 6 blocks commoned` · the proposal is a **stretch** of `C0105`, stopping at row 12 rather than following the wire west · the record holds `runs`, not a conductor id | | |
| T-1110 | **A commoning save leaves `circuit_logic.json` current** — no banner, same md5 after the generator | | |
| T-1115 | **`TB-130` has no bus to offer** and no section at all · and `TB-120:3`, 24 pt below `:2` · **two of the three questions only your eyes can close** | | |
| T-1120 | **A net highlighted with its commoning** — the change asked for on 2026-09-06 · it survives its own layer switch being off · and a **wire** deliberately does not paint the bus | | |
| T-1125 | **Clicking a terminal highlights every wire that reaches it** · the chip takes you to the wire and offers the way back · the same click on the **Locate** tab still places | | |
| T-1130 | **`TB-0V:8`, `:9`, `:11` — a missing wire visible by its absence**, beside the count that makes the claim honest | | |
| T-1135 | The hit-test, verdict 1: **claimed by `W052`** · the link selects the wire · **blank paper does nothing** | | |
| T-1140 | Verdict 2: **`TB-120`'s commoning** · *by its shape* before you confirm it, and without the caveat after | | |
| T-1145 | Verdict 3: **no wire claims this run**, and *`n` of 71 wires have a route so far* beside it | | |
| T-1150 | One corner, two cards · `Escape` takes the run of ink **before** the selection, one thing per press | | |
| T-1155 | **`C0092` is never offered as a route**, and the panel says which runs it kept out and whose bus they are | | |
| T-1160 | What is deliberately **not** here: hand-tracing a bus, `Add a wire`/`Retire this wire` *(these two landed 2026-09-10 — see the next table)*, a wire's highlight including the bus, the Ask tab reasoning about highlights | | |

---

## T-120x–T-125x — adding a wire, and taking one away — `17_tests_add_and_retire_a_wire.md`

Added 2026-09-10 with Phase E. **Needs the editor password**, and **T-1250 puts your file back with
`git checkout` — commit before you start.**

**None of this is repair.** §3.7 measured **0** genuinely missing field wires on this sheet, so the
expected number of times either control is used during the authoring run is zero. What is worth
reporting loudly is **T-1200** if the id offered is one something already holds, and **T-1250** if
`git status --short` is not empty at the end.

| Test | What it checks | Result | Notes |
|---|---|---|---|
| T-1200 | **`Add a wire`** above the queue · it offers **`W072`** · both slots empty, the badge reads `you added it`, the count goes to `of 72` | | |
| T-1205 | **`Not in the netlist yet`**, and it is really not — absent from the Drawing tab and from the `Paths` queue until the generator runs | | |
| T-1210 | Picking its two ends · **no `was` and no `corrected` badge** · it leaves the queue with no *I looked and it was right* to press · **no `Take it back`** on an added wire | | |
| T-1215 | The generator folds it in: 72 wires, an edge, and **`color`, `gauge`, `cable`, `description` all null** | | |
| T-1220 | **`Retire this wire` wants a reason** — `Retire it` disabled until there is one · the tombstone has no `from` or `to` · the count goes **up**, because it is dealt with | | |
| T-1225 | A retired wire leaves the netlist, **nothing is renumbered**, and the next `Add a wire` offers **`W073`** | | |
| T-1230 | `Take it back` returns it **unconfirmed** — the netlist's pair where there is one, two empty slots where there is not, and the panel said which before you pressed | | |
| T-1235 | **Retiring does not delete your route** · the warning before, and the red strip after: *`locations.json` has a route for `W0xx`, which is not a wire in this netlist* | | |
| T-1240 | Two refusals if you hand-edit: an unknown id with **no `added`**, and `"added": false` | | |
| T-1250 | **`git status --short` is empty** after putting the file back | | |
| T-1255 | What is deliberately **not** here: a spec on an added wire, deleting outright, bulk retiring, adding from the Drawing tab, renumbering | | |

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
