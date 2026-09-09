# Code map — behaviour to the file that owns it

Index: `locate_tab_instruction_and_test_manual.md`.

**This document exists so that troubleshooting does not begin with a search.** It is never needed to
*run* a test. Read it when a test has failed and you need to know where to look.

Symbol names below were verified against the tree on 2026-08-19. Line numbers are deliberately
absent — they rot; names do not.

**Re-verified 2026-08-24, symbol by symbol: every name in every table below is still real and still
in the file it is attributed to.** `model.test.ts` is still exactly the 20 tests §3 claims, and
`showLabels={viewer.percent >= 30}` (H7) is verbatim in both tabs. Four corrections, all of them
additions rather than repairs: the two test-file lists were partial, `DRAG_SLOP` deserves its value
spelled out, and `fold_in_labels` lives in the generator rather than the server. Marked ▲ below.

---

## 1. The data flow, end to end

    ┌── authored by a human ───────────────────────────────────────────────┐
    │  author_circuit_logic.py     the netlist: what each thing IS         │
    │  wiring.json                 the connectivity: what each wire JOINS  │
    │  locations.json              the geometry: where it is drawn         │
    │  label_corrections.json      the readings: what the ink says         │
    └──────────────────────────────┬───────────────────────────────────────┘
                                   │ python author_circuit_logic.py
                                   │   reads the first three. **Raises** on a
                                   │   missing or broken wiring.json and warns on
                                   │   a broken locations.json — H23.
                                   ▼
                          circuit_logic.json          ← fully generated, never hand-edited
                                   │
                                   │ load_circuit_logic()   + load_locations()
                                   ▼
                        resolve_geometry()             ← THE ONLY PLACE THAT DECIDES
                                   │                      where anything is
                                   ▼
                        designator_index()  →  GET /api/designators
                        paths_index()       →  GET /api/paths     ← the highlight: authored
                                   │                                 runs, each net's wires, and
                                   │                                 each block's commoning
                                   │                                 (out of wiring.json — H20)
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
              Drawing tab                    Locate tab
              (read only)                    (two drafts, two files)
                                                   │
                                    ┌──────────────┴──────────────┐
                                    ▼                             ▼
                          save_locations()              save_wiring()
                            → locations.json              → wiring.json
                            *where* it is drawn           `wires`: *what* it joins
                            artifact goes stale           artifact goes stale **and**
                                                            custom_kg.json does
                                                          `commoning`: a block's own bus
                                                            artifact does **not** move —
                                                            display geometry, like a path,
                                                            and asserted in bytes

**Two files are written from one screen since 2026-09-08**, and that is the narrowest arrangement
available rather than an accident: `H18` is the reasoning, and `wiringStore`'s header is why the two
drafts must not learn about each other. The **Locate** tab is where the wiring editor lives because
confirming a wire's two ends and accepting its route are one act in one sitting — plan §4 q4.

**The third authored file joins that picture at the side rather than in the middle**, and the shape of
the diagram is the argument for it being a separate file:

    geometry.json  ──(reduced, cached)──►  ink.py           the strings and runs lifted off the paper
                                             │
    label_corrections.json ──────────────────┤ resolve_corrections()
                                             ▼
                                    GET / PUT /api/review    ← the Review tab
                                             │
                                             └─→ corrected_text()
                                                      │
                                                      ▼
                                             GET /api/conductors    ← the path editor's proposals
                                                                       (gated; H20 is the pair)

**Nothing in that column reaches `circuit_logic.json`.** `author_circuit_logic.py` does not read
`label_corrections.json` and a test asserts its output is byte-identical with and without one. A
correction is about a *reading of the sheet*, which is a different claim from *what connects*.

*(Corrected 2026-09-07. This used to end "and it is already right (§2 of the wires-and-nets plan
measured it: 26 nets, 131 terminals, no twins)." The netlist has no **duplicates**, which is what
that measured. **What nobody checked is whether a wire's two endpoints are the two the sheet joins,
and 11 of the 71 are not** — `_claude_notes/authoring_the_wires.md` §3. That is why there is a
fourth authored file in the diagram above, and it is the only line of the diagram that changed.)*

Two things to hold on to:

- **`resolve_geometry()` is the only precedence.** Terminal's own point → the site claiming that
  pin → its parent component's point (flagged `parent`) → nothing. Anything that appears to apply a
  different order is either a client-side bug or `editorPlaces` diverging.
- **The editor is a whole-document draft.** It loads once, mutates in memory, and PUTs everything.
  That is the source of hazard H1 below.

---

## 2. Server

| Behaviour | File | Symbol |
|---|---|---|
| The file format, and every validation message | `server/app/locations.py` | `parse`, `_sites`, `_site`, `_terminals`, `_labels`, `_end_labels`, `_placed`, `_label_dir` |
| **Which schema versions are read and written** | `server/app/locations.py` | `SCHEMA` = 2, `READABLE` = (1, 2). Both `parse` and `save_locations` accept either — a stale browser bundle sending 1 must not have every save refused, which would be total silent data loss on the machine least likely to notice. The client stamps 2 on load (`locateStore.load`), so the file is upgraded by being written |
| **The end-label overrides** — wire or net id → terminal id → a side, or hidden | `server/app/locations.py` | `EndLabel`, `Locations.end_labels`, `Geometry.end_labels`, `Geometry.end_label`, `END_LABELS_KEY`. Only the exceptions are stored; absent means *the side the viewer computes* |
| Whether a `labels` key on a wire is a label on a pin that wire touches | `server/app/locations.py` | `resolve_geometry`'s `touches` map — the only refusal in the file whose symptom on screen would otherwise be **nothing at all**. See hazard H14 |
| Which provenance words exist | `server/app/locations.py` | `SOURCES` = `("human","seed")`, `PLACEMENT` = `{human→confirmed, seed→seed}` |
| Wire/net label sections and key | `server/app/locations.py` | `LABEL_SECTIONS` = `("wires","nets")`, `LABEL_KEY` = `"label_point"` |
| The precedence, and cross-checks against the netlist | `server/app/locations.py` | `resolve_geometry` |
| Parse cache — **and the bug it can cause** | `server/app/locations.py` | `load_locations` is `lru_cache`d; `save_locations` calls `load_locations.cache_clear()` |
| Writing: atomic, whole-file, four refusals | `server/app/locations.py` | `save_locations`, `LocationsRefused` |
| The empty document a fresh drawing gets | `server/app/locations.py` | `skeleton` |
| **Where a wire runs, and the two axes that say how we know it** | `server/app/locations.py` | `WirePath`, `_paths`, `PATH_KEY`, `GEOMETRIES` = `("extracted","human")`, `ATTRIBUTIONS` = `("printed","human")`, `DERIVED` — refused **by name** on both axes. The unit of refusal is the **whole path**, unlike everything else in this file: half a route is a line that stops in the middle of the sheet and claims to be a wire |
| **The explicit *nothing here to trace*** | `server/app/locations.py` | `_no_path`, `NO_PATH_KEY`, `Locations.no_path`. `false` is refused as *says nothing*, exactly as `hidden: false` is — invariant 10 |
| **Whether a path is for a wire the netlist has** — and that a **net** carries none | `server/app/locations.py` | `resolve_geometry`'s `known_wires`, and the `section == "nets"` refusal in `_labels`. A net's highlight is the union of its wires' paths, so a path stored on a net would be saved and never drawn: the `H14` treatment again |
| **`GET /api/paths`** — the highlight | `server/app/drawing.py` | `paths_index`. **Three** maps since 2026-09-09: `wires` → the traced ones only (**absent**, never null, when there is none), `nets` → its wires, from `wire.net`, and `commoning` → each block's own bus out of `wiring.json`. Uncached, and **not** behind `allow_edits` — see hazard H20, which the third map is the reason for rewriting |
| **Why a block's bus is published on a free route out of a gated file** | `server/app/drawing.py` `paths_index` | `H20`'s line is **geometry is free and connectivity is not**. A bus never enters the netlist; a wire's endpoints are it. `test_no_wires_endpoints_travel_with_it` asserts the other half in the response text |
| Publishing `point`/`rect`/`places`/`placement`/`label_point` | `server/app/drawing.py` | `designator_index`, `_entry`. **Not paths**: a route travels on its own endpoint, so the index is exactly what it was |
| **What a wire or a net is made of** — its member terminals, in order, **undeduped**, each with its own point and `placement` | `server/app/drawing.py` | `_entry`'s `terminal_ids` parameter and `_member`. `[from, to]` for a wire, `member_terminals` for a net. **Not** `members`, which is those terminals' *parent components* — see hazard H12 |
| **Whether `places` is published at all** — and it must be whenever a place carries a `label_dir`, single dot or not, because that field exists nowhere else in the payload | `server/app/drawing.py` | `_entry`, the `len(places) > 1 or any("label_dir" …)` test. This was the 2026-08-19 label-side fault (T-335): 269 of 275 entries are single, and eliding their `places` elided the side a human chose |
| Which ids the extraction invented (`our id`) | `server/app/drawing.py` | `WIRE_IDS_ARE_OURS`, `INVENTED_TERMINAL_PREFIX`, `INVENTED_TERMINAL_PARENTS`, `INVENTED_NET_PREFIX` |
| **What a wire's end label says** — its colour and gauge, as printed | `server/app/drawing.py` | `_wire_spec`, published as `spec`. 69 of 71 have one. It exists because `WIRE_IDS_ARE_OURS`: a label reading `W052` would name something the reader cannot find on the paper |
| The gate — routes registered or not | `server/app/main.py` | `if settings.allow_edits:` inside `create_app` |
| Password check | `server/app/main.py` | `_require_editor`, `_check_editor_password` |
| `GET`/`PUT /api/locations`, `POST /api/editor/unlock` | `server/app/main.py` | `get_locations`, `put_locations`, `editor_unlock` |
| The `problems` list the UI shows | `server/app/main.py` | `_locations_report` (goes through `resolve_geometry`, so it catches netlist mismatches too) |
| Drawing number / page size guards | `server/app/main.py` | `_drawing_identity` |
| **The reduced read of `geometry.json`** — and the one place the 620 KB file narrows | `server/app/ink.py` | `load_ink` (`lru_cache`), `reduce`, `Label`, `Conductor`, `Binding`, `Flag`, `Ink`. Keeps named fields and drops `symbols`, `boxes`, `rects`, `junctions`, `stats`, `params`. **There is no code path from here to the whole file** — see hazard H17 |
| **A run's own shape, and where its ends land** — read here since 2026-09-03 | `server/app/ink.py` | `Conductor.points`, `Conductor.rect` (min/max over **every** vertex, not the two endpoints — 19 of the 149 differ and `C0057`'s endpoint box does not contain its ink), `Conductor.color`/`gauge`/`length`, `Binding` and `Binding.on_terminal_point`, `_binding`. 7 KB of polylines and 18 KB of narrowed bindings, and the two things that needed them arrived together: `/api/conductors` ranks with them and the review screen rings with them |
| **One candidate run, reduced to what tracing needs** — the second half of the boundary | `server/app/main.py` | `_traceable` — every key explicit, no `**rest`, pinned by `test_a_conductor_carries_only_what_tracing_needs`. `net_label` is the reading **after** corrections (`corrected_text`); `was` appears only where a person changed it |
| **`GET /api/conductors`** — the proposals, and since 2026-09-09 **free** | `server/app/main.py` | Outside `if settings.allow_edits:` and consulting no header. It was gated from 2026-09-03 and Phase D moved it: *what is this line, and does any wire claim it* is a reader's question and needs these polylines. The property that survives is `H17`'s narrowing, not the gate — see the rewritten **H20** |
| **What the sheet prints for a net whose id was renamed** | `server/app/drawing.py` | `printed_net`, published as `printed` on a net entry and only where it differs. Two of 26: `NET-PB1`/`NET-PB2` against `PB1`/`PB2`. This is `K10`, and it is worth two nets to the matcher as well as two labels |
| **Which label a run's net name was read from**, and the other direction of it | `server/app/ink.py` | `net_label_source_of`, `conductors_of`, `net_label_sources`. Matched on the text of a bound label, and it matches for all 70 on this sheet with 0 runs unexplained. This is the link a correction travels along |
| **The corrections file, and every validation message** | `server/app/label_corrections.py` | `parse`, `_correction`, `SCHEMA` = 1, `SECTION` = `"labels"`, `Correction`, `Corrections`. `text` is required and may be `null`; `""` is refused **by name** |
| **Whether a correction is keyed on something on this sheet** | `server/app/label_corrections.py` | `resolve_corrections` — refused by name, because its symptom would otherwise be *nothing at all*. The `H14` treatment, in a second file |
| **What one reading now says**, corrections applied, for the screen and for Phase E | `server/app/label_corrections.py` | `Reading`, `resolve_corrections`, **`corrected_text`** — the function Session 6's candidate ranking reads, put here so the answer is given once |
| Writing corrections: atomic, whole-file, two refusals | `server/app/label_corrections.py` | `save_corrections`, `CorrectionsRefused`, `skeleton`. **No page-size check**: a string does not stop being true at a different page size, which is the one honest difference from `save_locations` |
| `GET`/`PUT /api/review`, and what one item may carry | `server/app/main.py` | `get_review`, `put_review`, **`_reading`** (the second half of the boundary — every key explicit, no spread), `_review_report` |
| **The fourth authored file, and every validation message** | `server/app/wiring.py` | `parse`, `_wire`, `SCHEMA` = 1, `WIRES_SECTION` = `"wires"`, `COMMONING_SECTION` = `"commoning"`, `SOURCES` = `("index","human")`, `ENDS` = `("from","to")`, `Wire`, `Wiring`. `from`/`to` may be **`null`** — a real state — and `source` has two values and deliberately no `derived`: an endpoint is read or it is guessed |
| **What a person actually did to one wire**, as three separate questions | `server/app/wiring.py` | `Wire.confirmed` (a person looked, **including where nothing changed**), `Wire.settled` (both ends named), `Wire.corrected` (the confirmation moved an endpoint, so `was` is present). Spelled out so no caller writes `source == "human" and from and to` and folds two of them together |
| **Whether a wiring record is keyed on something this drawing has** | `server/app/wiring.py` | `resolve_wiring` — three refusals **by name**: an endpoint that is not a terminal, a record for a wire the netlist lacks, a `commoning` key that is not a component. Each has a symptom that would otherwise be *nothing at all*. The `H14` treatment in a fourth file |
| Writing wiring: atomic, whole-file, two refusals | `server/app/wiring.py` | `save_wiring`, `WiringRefused`, `skeleton`. **No page-size check** — this file holds no coordinates, which is the same honest difference `save_corrections` has and the thing that will let it survive a circuit needing several sheets |
| **A terminal block's own bus, and every validation message** | `server/app/wiring.py` | `Commoning`, `_commoning`, `COMMONING_SECTION`, `GEOMETRIES`, `ATTRIBUTIONS`, `DERIVED` — refused **by name** on both axes, as it is on a path. `runs` is a list of **polylines and not conductor ids**, because `C0105` is `DISCHARGE1:2`'s wire fused with all 279.6 pt of `TB-0V`'s vertical. The unit of refusal is the **whole record**, unlike a wire and like `_paths`. An optional `page` is the one page number in this file, and there is deliberately **no page-size check**: a record may name a sheet this server is not serving |
| **`GET`/`PUT /api/wiring`** — and the one save that says the netlist is behind | `server/app/main.py` | `get_wiring`, `put_wiring`, `WiringRequest`, `_wiring_report`. Inside `if settings.allow_edits:` and behind `_require_editor`. Its `stale` names **two** commands, because `build_kg.py` emits no coordinates and only moves when connectivity does |
| **Why this module duplicates the generator's validator** | `server/app/wiring.py` header | `author_circuit_logic.py` cannot import from `server/` — it ships inside an extraction directory. The guard is `test_the_editor_cannot_write_a_record_the_generator_refuses`, which puts twelve record shapes through both and asserts one verdict each. `read_locations()`/`locations.py` have lived that way since the beginning |
| Settings | `server/app/config.py` | `allow_edits`, `editor_password`, `editor_name`, `editor_password_required`. **All three** editing surfaces are gated on `allow_edits`, and all three take `editor_password` |

**Server tests, after Session 3 of the authoring-the-wires plan, 2026-09-09: 245 over eleven
files.** No new file: Phases C and D add a *format* to a file that already had a validator and take
a gate off a route that already had tests. `test_wiring.py` gained **11** for the `commoning`
record — the polylines-not-conductor-ids shape, `derived` refused by name on both axes, eight
refusals each naming the block, the optional `page`, and *one bad block costs that block and leaves
the wires alone*. `test_paths.py` gained **3**: a block's bus published on the free route, **no
wire's endpoints travelling with it**, and a bus on a block the netlist lacks being absent here as
well as in the red strip. `test_extraction_generator.py` gained **2**, and the first is Phase C's
acceptance criterion in bytes — `test_commoning_does_not_reach_the_netlist`.
`test_conductors.py` did not grow and **two of its tests were rewritten**:
`test_a_reader_never_downloads_the_ink` is now
`test_a_reader_may_ask_what_a_line_on_the_sheet_is` and asserts the opposite verdict for the
reasoning in the rewritten `H20`, and the password test became
`test_asking_what_a_line_is_needs_no_password_even_where_there_is_one`.

**Server tests, after Session 2 of the authoring-the-wires plan, 2026-09-08: 228 over eleven
files.** The new one is **`test_wiring.py`** (44), and three of its groups are the session rather
than the feature. The first assertion in the file is Phase A's acceptance criterion —
*a confirmation that changes nothing is still a decision* — because 47 of the 71 wires are that case
and a file recording only corrections would have left them indistinguishable from the wires nobody
opened. Ten refusals are asserted **by name**, one per record shape, because a wiring file is read
by a person and *"the file is invalid"* is a problem nobody can act on. And twelve are
`test_the_editor_cannot_write_a_record_the_generator_refuses`, parameterised over the same records
put through **both** validators — the guard on a duplication that is deliberate and cannot be
removed. `test_extraction_generator.py` gained `_whats_ahead`, which is `K12` narrowed: the artifact
test's failure names which authored file is newer.

**Server tests, after Session 1 of the authoring-the-wires plan, 2026-09-07: 184 over ten files.**
Eleven new in `test_extraction_generator.py` (18), all of them about the third authored input:
the id freeze (`wiring.json`'s ids **are** the netlist's wire ids, so the `W` table fallback is
never exercised), the byte-identity pair, the two loud failures of `H23`, three refusals by name,
and one each for a confirmed correction moving a net, a retired wire and a half-set one. Nothing
existing moved except `test_review.py`'s byte-identity test, which now copies `wiring.json` into
its scratch directories because the generator will not run without one.

**Server tests, after Session 6: 172 over ten files.** The new one is **`test_conductors.py`**
(13), and three of its assertions are the session rather than the feature: the run key set is
*pinned* so a careless spread cannot widen the boundary (`H17`), `load_ink` is asserted to parse
once for N requests, and `/api/conductors` is asserted **404** with `allow_edits` false *in the same
test* that asserts `/api/paths` answers — because the interesting fact is not that one is gated but
that they are on opposite sides of the same gate (`H20`). `test_api.py` gained
`test_a_renamed_net_publishes_the_name_the_sheet_actually_prints` (`K10`) and `test_review.py`
gained `test_a_run_is_framed_by_its_own_polyline_and_not_by_the_box_round_its_ends` — and its
pinned `ITEM_KEYS` gained `points`, while `points` left the *dropped sections* list, because a
polyline is now published on purpose and `node_ids` is the tell that something unnarrowed got
through.

**Server tests, after Session 5: 157 over nine files.** The new one is **`test_paths.py`** (7), and
two of its assertions are the session rather than the feature: `/api/paths` is asserted to answer
with `allow_edits` **false**, and `ink.load_ink` is monkeypatched to raise, so a route that ever
started reading `geometry.json` fails rather than merely being slower (`H17`). The eight new cases in
`test_locations.py` are the refusals — one point, off the page, `derived` by name, a net carrying a
path — and `test_extraction_generator.py` gained
**`test_a_path_does_not_reach_the_netlist`**, which compares the generator's output in bytes with
and without a path. That last one is the proof of Phase D.

**Server tests, after Session 4: 141 over eight files.** The new one is **`test_review.py`** (24), and
four of its assertions are the session rather than the feature: the item key set is *pinned* so a
careless spread cannot widen the boundary, `load_ink` is asserted to parse once for N requests,
`/api/review` is asserted absent with `allow_edits` false, and the generator's output is compared **as
bytes** with and without a corrections file.

**Server tests** ▲ — all seven files, since the three listed before were only the editor's:
`test_locations.py` (format, precedence, refusals, labels), `test_editor.py` (the gate, the write
path, the cache-clear), `test_extraction_generator.py` (the generated artifact), **`test_api.py`**
(the designator index and every other route — this is where an `_entry` change is tested),
`test_config.py`, `test_invocation.py`, `test_runner.py` (the model child). **117 tests as of Session
2 on 2026-08-24** (was 106), of which the artifact one is red exactly while `locations.json` is ahead
of `circuit_logic.json`.

---

## 3. Client

| Behaviour | File | Symbol |
|---|---|---|
| **The one projection**, both directions | `webui/src/features/drawing/paint.ts` | `pointToCss`, `cssToPoint` |
| **The highlighter** — a wire's route painted along the ink | `webui/src/features/drawing/paint.ts` | `polylineToDevice`, `paintRuns`, `HIGHLIGHT` (5 pt wide, floor 3 device px, translucent), `Polyline`, `RunStyle`. Every vertex goes through `tileDestRect`, which is invariant 2: one projection, or the highlight drifts off the conductor it names |
| **Where it is painted** — under the DOM markers, in the tiles' own rAF pass | `webui/src/features/drawing/TileSheet.tsx` | the optional `runs` prop, painted after `paintSheet`. `data-runs` on the canvas is how a test knows what reached the sheet: `test-setup.ts` forces `getContext('2d')` to null, so nothing painted can be read back |
| **Which runs of ink might be this wire** — the ranking, and the whole of it | `webui/src/features/locate/paths.ts` | `candidates`, `Candidate`, `Reason`, `compare`, `NEAR_PT` = 8 (half a conductor row), `NEARBY_PT` = 24, `MIN_RUN_PT` = 15, `netNames` (both forms — `K10`), `netOf`, `endsOf`, `chordOf`, `lengthOf`, `runsOf`, `draftRuns`. Pure, 19 unit tests, and four of them are the pairings measured off the sheet in `07_drawing_facts.md`. **The geometry outranks the printed name**, because a pin against a vector stroke has no reading of the paper in between and because the second half of a real route routinely carries no name at all |
| **Which terminal a wire's end actually lands on** — the proposal, and the whole of it | `webui/src/features/locate/wiring.ts` | `inkIndex`, `proposalsFor`, `landingsFrom`, `isCommoning`, `Landing`, `Landed`, `ON_INK_PT` = 4 (a quarter of a conductor row), `LANDING_PT` = 30, `JOIN_PT` = 6 (`W069`'s measured 3.5 pt hop, plus a little). Pure, 23 unit tests, nine of which read the **real drawing** rather than a fixture of it. **The one rule that makes it correct: a run's landing is where it *leaves* a block's commoning, not where its polyline ends** — `C0105` holds `DISCHARGE1:2`'s wire *and* all 279.6 pt of `TB-0V`'s bus, so its polyline ends beside row 1 while the wire joins at row 12. The test for a bus is a **shape** — two or more of one component's terminals on one run — and it finds §3.6's eight conductors having been told nothing |
| **Why the printed name is carried and not ranked on** | `webui/src/features/locate/wiring.ts` header | The opposite of `paths.ts`, and for a reason rather than an inconsistency: a run's printed name is its **net**, and every point of a block is on the same net, so `0V` cannot tell row 3 from row 8. The screw number is printed nowhere. Ordering is **fit** and then id |
| **Every rule the wiring editor applies** | `webui/src/features/locate/wiringModel.ts` | `confirmEndpoints` (the acceptance criterion: a record with no `was`), `setEndpoint` (`was` stamped **once** and dropped when a correction is taken back), `unconfirm`, `setWiringNote`, `endpointsOf`, `sourceOf`, `confirmed`/`corrected`/`settled`, `wiringDecided`, `wiringPending`, `wiringCoverage`, `terminalNets`, `netsAcross`, `pathStale`, `SCHEMA` = 1. Pure, 27 unit tests. Its import of `model.ts` is **type-only**, deliberately: `model.ts` imports `pathStale` from here, so a value import back would close a runtime cycle between the two documents' rule modules |
| **The wiring panel** — two end slots, the proposal, and the button that changes nothing | `webui/src/features/locate/WiringPanel.tsx` | `WiringPanel`, `Ready`, `EndSlot`, `ProposalRow`, `NetsAcross`, `NoteBox`, `WHY`, `SHOWN` = 4. `data-wiring-panel`, `data-wiring-end`, `data-wiring-pick`, `data-wiring-proposal`, `data-wiring-confirm`, `data-wiring-mismatch`, `data-wiring-stale` and `data-wiring-note` are how a test finds them |
| **Which end slot the next terminal click fills**, and the draft it writes into | `webui/src/stores/wiringStore.ts` | `document`, `report`, `armed`, `edit`, `load`, `save`, `arm`, `reset`, `SAVE_DEBOUNCE_MS` = 900. **No undo stack** — `reviewStore`'s argument, and its header says why: an endpoint is one of 131 named terminals, `was` keeps what it replaced forever, and `unconfirm` is one press. **A `stale` banner, unlike `reviewStore`** — an endpoint *is* the netlist |
| **The three endpoint/placement words, in one module** | `webui/src/lib/designators.ts` | `PLACEMENT_LABEL`, and beside it `ENDPOINT_LABEL` / `endpointLabel` — `from the index` and `you, on 2026-09-08`. The **claim** is the same distinction one file down (the machine guessed against a person looked); the **words** differ because an endpoint is not *placed*. Same module so the two tables cannot drift into different English |
| **The wire panel** — propose, accept, assemble, convert, trace | `webui/src/features/locate/PathPanel.tsx` | `PathPanel`, `CandidateRow`, `Accepted`, `AddRun`, `Tracing`, `WHY`, `SHOWN` = 6. `data-path-panel`, `data-candidate` and `data-add-run` are how a test finds them |
| **The corners of a hand-traced route** | `webui/src/features/locate/PathHandles.tsx` | `PathHandles`, `Handle`, `DRAG_SLOP` = 3. Rendered **only** for `geometry: human`; `data-path-handle` finds one |
| **Writing a route into the draft** | `webui/src/features/locate/model.ts` | `setPath`, `addRun`, `tracePath`, `convertPath`, `movePathVertex`, `clearPath`, `setNoPath`, `writeWire`, and the readers `pathOf`/`pathSettled`. **`attribution` is always `human`**, `no_path_on_this_sheet: false` is deleted rather than written, and `movePathVertex` refuses a lifted run from this side as well as the panel's |
| **What a route was accepted *against*** — the two endpoints, stamped into the path | `webui/src/features/locate/model.ts` · `features/locate/paths.ts` | `setPath` and `tracePath` take an optional `endpoints` and write it as `path.for`; `endPinsOf` is where it comes from. Since 2026-09-07 a wire's endpoints are authored in `wiring.json` and can be **corrected**, and a path is a claim about ink that survives a correction *unless the correction moves the end it reaches* — so the comparison has to be possible. `addRun`, `convertPath` and `movePathVertex` spread the path they found, so the stamp survives an edit that is not a re-acceptance. Back-filled onto all 58 by `bootstrap_wiring.py`; **not published by `/api/paths`**, because the only reader is the editor's own draft |
| **A hand trace in progress, and the four keys** | `webui/src/features/locate/LocateTab.tsx` | `tracing`, `trace`, `traceRef`, and the two `window` effects — `Enter`/`Backspace` in the key effect, `Escape` in its own. **`Esc` takes the trace before the target**, and the sheet's `onClick` adds a corner instead of placing while one is running |
| **One proposal, lit on the sheet** | `webui/src/features/drawing/paint.ts` · `TileSheet.tsx` | `CANDIDATE` (3.5 pt, floor 2 device px, blue) and the optional `candidates` prop, painted **under** `runs`. `data-candidates` on the canvas is the only assertable trace. One layer for the hovered candidate *and* the trace in progress, because the two cannot happen at once |
| **What a selection highlights** — a wire's runs; a net's *and a terminal's* with the block's bus | `webui/src/lib/paths.ts` | `pathsFor`, `PathSummary`, `PathContext`, `blocksOf`. Pure, 14 unit tests, shared by **both** tabs. Three cases since 2026-09-09: a **wire** is its own runs and **no commoning**; a **net** is the union of its wires' plus the bus of every block its member terminals sit on; a **terminal** is the wires that reach it plus its own block's bus. Null for a component only — a terminal stopped being null, and the docstring replaces the reason rather than deleting it |
| **Why a wire paints no bus when a net and a terminal do** | `webui/src/lib/paths.ts` header | The one departure from plan §9. `C0092` was recorded as *"the second piece of `W063`'s L"* for a week; painting a block's bus in the highlight colour under a selected wire would teach that error on every wire landing on a block. A net and a terminal are questions about a **place in the circuit**; a wire is a claim about **one piece of ink** |
| **Terminal → the wires that reach it**, and the block a pin is on | `webui/src/lib/designators.ts` | `wiresByTerminal`, `blockOf`. One pass over the wire entries already on the page — plan §4 q7 is explicit that this must not become a second endpoint — and it lives beside `readerRowState` because the Drawing tab reads it with **no password** |
| **A block's bus as geometry a screen can paint** | `webui/src/features/locate/wiring.ts` | `commoningFor`, `BusProposal`, and `IndexedRun.spans`. The exported half of the arithmetic `landingsFrom` has used privately since Phase B: exporting it rather than re-deriving it keeps **one** answer to *where is this block's bus*. It returns the **stretch** of each run, not the conductor |
| **Point-space arithmetic, and there is one of it** | `webui/src/lib/polyline.ts` | `project`, `atArc`, `between`, `polylineLength`, `gap`. Not a screen projection — that is `paint.ts` and invariant 2. This is *how far is this pin from that run, and how far along*, and it had one caller until Phase D gave it three: the endpoint proposal, the bus a commoning record is cut out of, and the sheet hit-test. A hit-test with its own distance function could name a run the landing rule says a pin is not on |
| **What line am I pointing at** — the sheet hit-test and its three verdicts | `webui/src/features/drawing/hitTest.ts` | `pickRun`, `claimsFrom`, `Pick`, `Claims`, `PICK_PT` = 6 (a third of a conductor row, in **points**, so the target is the same width of paper at every zoom). Nearest **and** within tolerance: a click on blank paper answers *nothing here* rather than reaching for the closest run. A confirmed bus and one the shape rule merely found are kept **apart**, because they are different claims |
| **The card that names a run of ink** | `webui/src/features/drawing/ConductorCard.tsx` | `ConductorCard`, `Verdict`. `data-conductor-card`, `data-conductor-verdict` and `data-conductor-coverage` find it. It prints *`n` of 71 wires have a route so far* beside **every** verdict — the honesty requirement, because until the authoring run *no wire claims this run* is right for about 90 of the 149 |
| **Authoring a block's commoning** | `webui/src/features/locate/CommoningPanel.tsx` | `CommoningPanel`, `NoteBox`. On a **component** row, through `wiringStore` — `H18`, and the reason it is not a store of its own. `data-commoning-panel`, `-accept`, `-clear`, `-runs`, `-note` |
| **Every rule the commoning editor applies** | `webui/src/features/locate/wiringModel.ts` | `commoningOf`, `setCommoning`, `clearCommoning`, `setCommoningNote`, `commonedBlocks`, `commoningCoverage`. `setCommoning` writes `extracted`/`human` and never `derived`; `clearCommoning` **deletes**, unlike `unconfirm` one section up, because nothing bootstrapped a bus and *no record* is the same state as *nobody authored this* |
| **The runs a wire may not be offered**, and the sentence that says which | `webui/src/features/locate/paths.ts` · `PathPanel.tsx` | `candidates()`'s `commoning` option, and `Refused`. Keyed on the **shape rule** (`isCommoning`) and **not** on the authored records: a record stores stretches, and `C0105`/`C0008` are each partly a wire, so excluding by a record's conductor ids would take two real routes out of the list. Removed rather than tagged — the failure is a click — and named, because invariant 5 |
| **What the card says about a path**, including that there is none | `webui/src/features/drawing/SelectionCard.tsx` | `PathNote`, `GEOMETRY_WORD`, `ATTRIBUTION_WORD`. *`no path yet`* is load-bearing while 70 of 71 wires have none: an unhighlighted sheet cannot say which of *not traced* and *broken* it is |
| Pan, zoom, fly-to | `webui/src/features/drawing/useTileViewport.ts` | `panTo`, `focusScale`, `centreOn` |
| Dots: one per place, filled vs hollow, label side, drag | `webui/src/features/drawing/MarkerLayer.tsx` | `Marker`, `LABEL_SIDE`, `PLACEMENT_NOTE`, `onDragPoint`, `DRAG_SLOP` |
| ▲ **How far a press must travel before it is a drag** | `webui/src/features/drawing/MarkerLayer.tsx` | **`DRAG_SLOP = 3`** CSS pixels of *pointer* travel, in `onPointerMove`: `if (!dragged.current && Math.hypot(dx, dy) < DRAG_SLOP) return`. Its own comment is the design: *"Small enough that a deliberate nudge works, large enough that a shaky click still selects."* **A minimum-drag threshold therefore already exists** — anyone asked to add one should read this first. Note what it does *not* prevent: once the press has travelled past 3 px the handler fires on every subsequent move with the delta from the press origin, so a press that goes out and comes most of the way back commits the small residual it ended on. That is not a twitch getting through; it is a real drag ending near where it started, and the cure for it is undo, not a bigger number |
| **Which dot was clicked** — `onSelect` carries the `place`, not just the entry | `webui/src/features/drawing/MarkerLayer.tsx` | `onSelect(entry, place)` |
| **Which groups the Drawing tab draws** — **five** independent switches since 2026-08-25 | `webui/src/features/drawing/DrawingTab.tsx` | `Layer`, `LAYERS`, the `layers` memo, `shown`, the `markers` memo. `wires` and `nets` split out of `labels`, and `labels` is now the **text**: it has no markers of its own and gates the end labels |
| **The list down the left of the sheet** | `webui/src/features/drawing/DrawingList.tsx` | `DrawingList`, `filterEntries`, `ListKind`, `LIST_FILTERS`. `filterEntries` is pure: an empty `kinds` means every kind, and the text matches the id **and** the one-line label, case-folded. Nothing here is an allowlist — it is not model output being matched (contrast `lib/designators.ts` `resolve`) |
| **The rows themselves, for both tabs** | `webui/src/components/DesignatorList.tsx` | `DesignatorList`, `STATE`, `STATE_LABEL`, `armedRow`. This was `features/locate/WorkList.tsx` until 2026-08-25 and moved **unchanged**; the Locate tab imports it from here now and `WorkList.tsx` is gone |
| **The row state a reader sees** — from the index, never from a draft | `webui/src/lib/designators.ts` | `readerRowState`, and `RowState` itself, which `features/locate/model.ts` re-exports. This is what lets the Drawing tab's list work with `SWUI_ALLOW_EDITS=false`. **It never says `traced` or `no path here`** and that divergence is chosen: a path is not in the designator index at all, so this list would have to be handed a second endpoint (`H20`), and the reader's way to a route is to select the wire — the card says `no path yet` or names the conductors, which is more than a word on a row could carry |
| **The row state the editor sees** — including whether the wire has been dealt with | `webui/src/features/locate/model.ts` | `rowState` — `traced` and `no-path` come first for a wire, read off the **draft**, so the row changes under the click. `pathSettled` is the predicate the `Paths` filter and `coverage().settled` share, which is what stops the count and the queue from ever disagreeing |
| Which kinds the list is filtered to, what has been typed, and whether it is open at all | `DrawingTab.tsx` (`kinds`, `text`, `toggleKind`, `rows`, `visibleRows`) · `stores/appStore.ts` (`drawingListOpen`, `setDrawingListOpen`) | The split is deliberate: **open/closed is persisted**, the filters are not. See hazard H16 |
| What a click on a row raises | `webui/src/features/drawing/DrawingTab.tsx` | `onRow` — `select(row.kind, row.id)` with the default `'text'` origin, so the sheet flies. The same function a citation calls, and the row's **own** kind (the `onMarker` lesson again) |
| A wire or net turned into something drawable — **its label point, never its route** | `webui/src/features/drawing/DrawingTab.tsx` | `atLabelPoint` (shared by the layer and by `selectedMarker`, so a label dot cannot exist in one path and not the other) |
| What kind a click on the sheet raises | `webui/src/features/drawing/DrawingTab.tsx` | `onMarker` — `marker.kind`, **not** the `'component'` it was hard-coded to before 2026-08-19 |
| Which components the selection card may offer as links | `webui/src/features/drawing/DrawingTab.tsx` | `located` — built from the components group whether or not it is switched on; see hazard H11 |
| **Everything the selection marks**, which for a net or a wire is its member terminals **and nothing else** | `webui/src/features/drawing/DrawingTab.tsx` | `relatedIds` — `entry.terminals[].id` where there are any, `entry.members` otherwise. Changed 2026-08-24: it was the union of both, and ringing the parent components put more than half the marks on places the net does not touch. A component or a terminal still uses `members`, which for a terminal is the one relay it hangs off |
| **Where every wire and net end label goes** | `webui/src/features/drawing/endLabels.ts` | `planEndLabels`, `defaultSide`, `CLOCKWISE`, `DEFAULT_SIDE`, `PlannedLabel`, `Overrides`. Pure, 13 unit tests. Planned over the **whole** index, never over the visible subset — see invariant 9 |
| Which end labels are drawn, and the selection's exemption from the switches | `webui/src/features/drawing/DrawingTab.tsx` | `endLabels` (the plan), `drawnEndLabels` (the subset), `drawable`. Since 2026-08-25 a label needs **two** switches — `Labels` and its own kind — and the selection's own labels need **neither**. `drawable` counts a kind's end labels towards whether that kind gets a button at all, which is why `Wires` and `Nets` are offered on a drawing where no printed name has been placed |
| The text itself, and its side | `webui/src/features/drawing/MarkerLayer.tsx` | `EndLabel` — a `pointer-events-none` span at a dot-sized anchor, through the same `LABEL_SIDE` table as a marker's own id. `data-end-label="<owner>@<terminal>"` is how a test finds one |
| The compass per end, and what *Reset* does | `webui/src/features/locate/TargetPanel.tsx` | `LabelPanel`, `EndLabelRow`, `LabelSide`'s `note`. The row is found by `data-end` |
| **Recording or deleting one end-label decision** | `webui/src/features/locate/model.ts` | `setEndLabel`, `endLabelsOf`. Normalises to nothing and **deletes** — see invariant 10 |
| The member roster on the selection card, and its state words | `webui/src/features/drawing/SelectionCard.tsx` | `MemberRow`; the words come from `lib/designators.ts` `PLACEMENT_LABEL` / `placementLabel` |
| **The three placement words, in one place** — `placed`, `estimate`, `on its component`, and `nowhere` for no placement at all | `webui/src/lib/designators.ts` | `PLACEMENT_LABEL`, `NOWHERE_LABEL`, `placementLabel`. Imported by `WorkList.tsx`'s `STATE` and by the roster, so the editor's list and the reader's card cannot drift into different English |
| *place it* on a roster row — the one place outside the Locate feature that touches `locateStore` | `webui/src/features/drawing/DrawingTab.tsx` | `placeTerminal`, offered only when `health.editing.enabled`. Sets the target; writes nothing |
| **Undo and redo over the draft** | `webui/src/stores/locateStore.ts` | `undoStack`, `redoStack`, `undoNote`, `undo`, `redo`, `UNDO_DEPTH` = 50, `Snapshot`, and the `coalescing` module variable with `endRun` |
| Which mutations are undoable | `webui/src/stores/locateStore.ts` | **all of them**, because `edit` is the only writer. `note` is what the badge will say; `coalesce` makes a run of frames or keypresses one step |
| **The keyboard** — `Ctrl+Z`, `Ctrl+Shift+Z`, `Shift`(+`Alt`)+arrows | `webui/src/features/locate/LocateTab.tsx` | `NUDGE`, `NUDGE_PT` = 1, `FINE_NUDGE_PT` = 0.1, `nudge`, and the third `window` key effect. See hazard **H10** — it applies to this listener too |
| **What a nudge is allowed to move** | `webui/src/features/locate/model.ts` | `draftPoint` — the point the draft's own record holds, **not** `editorPlaces`. Nudging a resolved estimate would turn it into a confirmation |
| Why a `Shift`+arrow does not also pan | `webui/src/features/drawing/useTileViewport.ts` | `onKeyDown`'s first line: a *modified* arrow is declined. Narrowed to `event.key.startsWith('Arrow')` on purpose — `+` needs `Shift` to type, and a blanket guard would stop zooming in |
| **Where the sheet goes, and who asks** | `webui/src/features/locate/LocateTab.tsx` | `flyTo`, `framing`, `at`, `sheetRect` — and see hazard H3 |
| **When the sheet goes nowhere however hard it is asked** | `webui/src/features/locate/LocateTab.tsx` | `FLY_CEILING_PERCENT` (= `FOCUS_ZOOM` × 100, imported, never restated) and the `percent` ref in the flight effect. Above it no flight moves anything: T-115 |
| Which groups the Drawing tab has switched on, visibly | `webui/src/features/drawing/DrawingTab.tsx` | the `LAYERS.map` in the toolbar — `variant={shown[id] ? 'default' : 'ghost'}`, filled meaning on, as on this tab's filters |
| Scrolling the armed — or selected — row into view | `webui/src/components/DesignatorList.tsx` | `armedRow`. Both tabs get it: on the Drawing tab it is what puts the list on the row a citation just selected |
| **Every rule the editor applies** | `webui/src/features/locate/model.ts` | see below |
| The screen, click-to-place, the advance, the overlay | `webui/src/features/locate/LocateTab.tsx` | `LocateTab`, `put`, `aim`, `editable`, `PasswordGate`, `SaveStatus` |
| Leaving placing mode — `Esc`, and the ✕ on the panel | `webui/src/features/locate/LocateTab.tsx` | the `Escape` effect (a `window` listener guarded on `activeTabId`); `TargetPanel.tsx` `Header`. **`isTextField` moved out on 2026-08-19** — it is `webui/src/lib/keys.ts` now, shared with the Drawing tab's Escape. See hazard H10 |
| Which tab is on screen, and the key that changes it | `webui/src/App.tsx` | the `F2` effect (`hasDrawingTab`, bare key only) — `F2` crosses to the Drawing tab from here and back; `tabIds.ts` holds the ids |
| **Where the reader was in the transcript**, across an `F2` round trip | `webui/src/features/ask/AskTab.tsx` | `view` — module state, not a store field: it changes on every scroll event and this component subscribes to the whole of `useChatStore`, so a store write would re-render every message sixty times a second while somebody scrolls. Restored in a `useLayoutEffect`, cleared by *New conversation* |
| **The way back to the card that sent you here** | `webui/src/stores/appStore.ts` | `Selection.from`, set by `select(kind, id, origin, from)` — only from a roster row or a `runs through` chip. `SelectionCard.tsx` `back`/`onBack`; `DrawingTab.tsx` `onBack`. One step, deliberately not a stack |
| Rows and their state words | `webui/src/components/DesignatorList.tsx` | `STATE` |
| **The order of every list on the left**, and so the order the advance walks | `webui/src/features/locate/LocateTab.tsx` | the `entries` memo, `BY_ID` (an `Intl.Collator`, `numeric`) |
| Sites, pins, the compass, the wire/net panel | `webui/src/features/locate/TargetPanel.tsx` | `ComponentPanel`, `TerminalPanel`, `LabelPanel`, `LabelSide` |
| The site-name box: local text, one write, visible refusal | `webui/src/features/locate/TargetPanel.tsx` | `SiteName` — and see hazard H4 |
| Draft, debounced autosave, unlock, load | `webui/src/stores/locateStore.ts` | `edit`, `place`, `save`, `load`, `unlock`, `SAVE_DEBOUNCE_MS` = 900 |
| Re-reading the index after a save | `webui/src/stores/appStore.ts` | `refreshDesignators` — **and the paths with it since 2026-09-02**: one `PUT /api/locations` moves both, so refreshing one and not the other leaves the sheet half a save behind |
| Where the paths live on the client | `webui/src/stores/appStore.ts` | `paths`, loaded by `loadAll` beside `designators`. Null while loading and after a failure, which is *nothing is highlighted* and not *nothing is traced* |
| **The review queue's order, its filters, and what a decision writes** | `webui/src/features/review/model.ts` | `orderItems`, `filterItems`, `setCorrection`, `setNote`, `rowState`, `ROW_LABEL`, `SCOPES` (three since 2026-09-03 — `flagged`, `all`, **`rejected`**), `progress`, `SCHEMA`. Pure, 33 unit tests. **`setCorrection` with no `text` deletes** — invariant 10, in a third file — and **`setNote` refuses a row nobody has decided about** rather than inventing the `text` the file requires, which would record a confirmation nobody made |
| **What sort of string a reading now is** — the badge, recomputed | `webui/src/features/review/model.ts` | `classifyLabel`, `labelKind`, `LabelKind`. A **mirror** of `classify_label()` in `schematic_skills/scripts/extract.py`, which imports PyMuPDF and exits without it, so neither the server nor the browser can import the original. The drift is bounded by `labelKind`: an **uncorrected** row shows the extraction's own answer verbatim, and the mirror is consulted only where a person changed the text. `review/model.test.ts` pins it against 45 strings generated from the Python |
| **The review screen** — the queue, the boxes, the ring on the ink | `webui/src/features/review/ReviewTab.tsx` | `ReviewTab`, `ReadingRow`, **`InkRing`**, `PasswordGate`, `SaveStatus`, `TONE`. `data-reading="<id>"` finds a row and `data-ink-ring="<id>"` finds the ring |
| **The ring, and why it is DOM rather than canvas** | `webui/src/features/review/ReviewTab.tsx` | `InkRing` — through **`pointToCss`** and, for a run, **`polylineToDevice`**, like everything else that lands on the sheet (invariant 2). `test-setup.ts` forces `getContext('2d')` to null, so a canvas mark could not be asserted at all while this one has a position a test can read. Since 2026-09-03 a **run** is drawn as an SVG polyline along its own corners and a **label** keeps its exact filled bbox — a label *is* a box, and framing it exactly is how a person sees the box is wrong. `data-ink-shape` finds the polyline |
| **The note on a row, and why it is disabled until there is a decision** | `webui/src/features/review/ReviewTab.tsx` | `NoteBox`. Same `H4` local-state rule and same `H19` baseline rule as the reading above it |
| **The corrections draft, and its debounced save** | `webui/src/stores/reviewStore.ts` | `document`, `items`, `edit`, `save`, `load`, `refresh`, `setCurrent`, `SAVE_DEBOUNCE_MS` = 900. Deliberately **no undo stack** and **no `stale`** — the header of that file says why for both |
| Whether the tab exists | `webui/src/tabs.ts` | `isEnabled: tilesAvailable && editingEnabled`; `editingEnabled` from `health.editing.enabled` in `App.tsx`. **Both** editing tabs use that rule, and for the Review tab both halves are load-bearing: no editor means no routes, and no tiles means no ink to read against |
| Wire contract | `webui/src/api/types.ts` | `Designator`, `Place`, `Placement`, `LocationsDocument`, `StoredSite`, `StoredLabel` |
| The three HTTP calls | `webui/src/api/client.ts` | `editorUnlock`, `getLocations`, `putLocations` |

### `model.ts`, by question

Everything here is pure and has no React in it, which is why 20 unit tests cover it. If a rule is
wrong, it is wrong here.

| Question | Symbol |
|---|---|
| Which kinds need a point? | `PLACEABLE` = component, terminal |
| Which kinds have only a label? | `LABELLABLE` = wire, net |
| What does this row say? | `rowState`, and `draftPlacement` for the draft's half |
| Where are this entry's dots? | `editorPlaces` |
| What do the toolbar counts mean? | `coverage` — `placeable/confirmed/remaining`, then `wires`/`nets`, then `authored` (end-label decisions) and **`settled`** (wires with a route *or* a *no path* decision — the one count here that reaches its own total) |
| What does the advance pick next? | `nextUnplaced` (skips `LABELLABLE`, wraps once) |
| What does a click write? | `place` → `setSitePoint` \| `setTerminalPoint` \| `setLabelPoint` |
| Which site holds this pin? | `siteClaiming` (first claim wins) |
| Pin assignment | `assignTerminal` (strips the pin from every other site first) |
| Site naming | `nextSiteId` (`main`, `site-2`, …), `renameSite` (refuses empty/colliding), `canRenameSite` (the same rule, asked before typing is committed) |
| Removing things | `clear`, `removeSite` — both drop the parent record when it empties |
| Rounding and provenance stamping | `signed` (private) — one decimal place, `source: human`, `by`, `at` |
| What may be nudged from the keyboard? | `draftPoint` — a point this target's own record already holds, and nothing resolved |
| What has a person decided about one wire end? | `endLabelsOf`, `setEndLabel` — and `SCHEMA`, which this module owns on the client side |
| Is this wire's route still reaching the ends it was accepted against? | `rowState`'s optional third argument, which is the wiring draft, and `wiringModel.pathStale`. **One word, and no change to `pathSettled`** — see below |

**Client tests** ▲ — all nine files and their counts, since the four listed before were only this
feature's. **127 tests.**

| File | Tests | |
|---|---|---|
| `features/locate/model.test.ts` | 20 | the rules — pure, no React |
| `features/locate/LocateTab.test.tsx` | 23 | the screen against a stubbed server |
| `features/drawing/DrawingTab.test.tsx` | 26 | markers, provenance styling, wire labels |
| `features/drawing/paint.test.ts` | 14 | the projection, both directions |
| `features/drawing/useTileViewport.test.ts` | 6 | pan, zoom, `focusScale`, `centreOn` |
| `lib/designators.test.ts` | 13 | `placesOf` and the id helpers |
| `components/Markdown.test.tsx` | 13 | |
| `components/UnlockButton.test.tsx` | 4 | |
| `App.test.tsx` | 8 | the tabs, and the `F2` effect |

**After Session 3 of the authoring-the-wires plan, 2026-09-09: 433 web tests over 20 files.**
One new file, **`features/drawing/hitTest.test.ts`** (**6** — the three verdicts as arithmetic,
plus the two failures that would make the card untrustworthy: naming the nearest run anywhere on
the sheet, and a tolerance measured in CSS pixels rather than points). The rest grew:
`lib/paths.test.ts` (**14**, +8 — the net's commoning, the terminal case that used to be null, and
*a wire paints no bus*, which is the one departure from plan §9);
`features/drawing/DrawingTab.test.tsx` (**58**, +11 — the reader's half end to end, including the
`Escape` order and *nothing happens on blank paper*);
`features/locate/WiringPanel.test.tsx` (**30**, +8 — the commoning editor, which is tested here
rather than in a file of its own because it writes through the same store on the same screen, which
is the `H18` property worth asserting); `features/locate/wiring.test.ts` (**28**, +5 — including
**the one-net assertion §7 asked for while it is still true**, measured against the real drawing);
and `lib/designators.test.ts` (**16**, +3 — the reverse index).

Two idioms worth knowing before adding to it. The Drawing tab's suite now sets
`conductors: []` in `beforeEach`, because the tab fetches the ink on its first activation and no
test in that file stubs `fetch`. And a test that needs to click a **point on the sheet** reads a
marker's `style.left`/`style.top` — `MarkerLayer` positions through `pointToCss`, which is the one
projection, so clicking there hit-tests back to that point without the test having to know the
viewport.

**After Session 2 of the authoring-the-wires plan, 2026-09-08: 392 web tests over 19 files.**
Three new files. **`features/locate/wiring.test.ts`** (**23**) is the ink's proposal: fourteen of
them arithmetic on hand-built fixtures out of the plan's §3.2 and §3.5, and **nine that read the
real drawing** — `geometry.json` with `node:fs` and never an import, so `H17` is untouched and no
bundle can see the path. Those nine are Phase B's acceptance criterion, and they are against the
files rather than a snapshot of them so that re-measuring the sheet can never leave a green suite
behind a stale answer. **`features/locate/wiringModel.test.ts`** (**27**) is the document's rules,
led by *a confirmation that changes nothing is still a decision*. **`features/locate/
WiringPanel.test.tsx`** (**22**) is the screen, and it renders the whole `LocateTab` because the
queue, the sheet click and the `Escape` escalation are the tab's — with **its own index**, because
`LocateTab.test.tsx`'s two pins are `placement: 'parent'` and a rule that discriminates at 4 pt may
not be handed a coordinate nobody chose. Nothing existing moved except `LocateTab.test.tsx`'s stub,
which now answers `/api/wiring` and resets the third store in `beforeEach`.

**After Session 1 of the authoring-the-wires plan, 2026-09-07: 320 web tests over 17 files.** Two
new in `locate/model.test.ts` (**47**), both about `path.for` — that a route records the endpoints
it was accepted against, and that adding a second run across a hop does not lose them. No new file:
Phase 0 has no screen.

**After Session 6, 2026-09-03: 318 web tests over 17 files.** One new file,
**`features/locate/paths.test.ts`** (**19** — the ranking as arithmetic, and four of them are the
pairings measured off the real sheet), plus 17 in `locate/model.test.ts` (**45** — the path writers,
and what may never be written), 13 in `LocateTab.test.tsx` (**51**), 12 in `review/model.test.ts`
(**33**), five in `ReviewTab.test.tsx` (**24**) and one in `endLabels.test.ts` (**14**).

Two idioms worth knowing before adding to it. The stubbed review server now **folds the last saved
document back onto the readings it answers with**, the way `resolve_corrections` does on every
request — without that, anything reading `item.correction` (the `decided` count, the `Not a label`
scope) looks broken in a test while working in the browser. And the ranked candidate rows are found
through `data-candidate` rather than by role: `getAllByRole('listitem')` would hand back the
left-hand list's rows first, which is the same trap `data-end` was introduced for in Session 2.

**After Session 5, 2026-09-02: 251 web tests over 16 files.** One new file, `lib/paths.test.ts`
(**6** — the union rule as arithmetic), plus five in `paint.test.ts` (**20** — the highlighter's
projection and its stroke), five in `DrawingTab.test.tsx` (**47**), one in `LocateTab.test.tsx`
(**38**) and one in `model.test.ts` (**28**). The last of those is the odd one and is worth knowing
why it exists: until Session 6 the only way to author a path is a hand edit, so
*leaves a hand-edited path alone while the same wire's labels change* guards the scaffolding the
lesson document asks the user to paste in.

**After Session 4, 2026-08-25: 232 web tests over 15 files.** Two new files, both the Review tab's:
`features/review/model.test.ts` (**21** — the queue's order and what a decision writes, pure) and
`features/review/ReviewTab.test.tsx` (**19** — the screen against a stubbed server). Nothing existing
moved: the tab is additive, and `App.test.tsx`'s tab assertions did not need touching because they
were written against `enabledTabs(context)` rather than against a list of four names.

Two idioms in the new suite worth knowing before adding to it. The **ring** is asserted through
`pointToCss` plus the viewer's own exported `focusScale`/`centreOn`, with
`prefers-reduced-motion: reduce` stubbed so the flight *lands* instead of animating — asserting a
position mid-`panTo` is asserting on the machine's load, and it was, for one test run. And the
**900 ms debounce** is waited out with a real timer plus a 3 s `waitFor`, not faked, because the store
chains a second save when the draft moved in flight.

**After Session 3, 2026-08-25: 192 web tests over 13 files** — seven new in `DrawingTab.test.tsx`
(42), all of them about the list and the seam between it and the sheet, plus the existing switch tests
re-pointed at five switches and every by-name query scoped to one of the two labelled groups (H16). No
new file: the moved `DesignatorList` is exercised by both tabs' suites, which is the point of moving
it rather than copying it.

**After Session 2, 2026-08-24: 185 web tests over 13 files.** New: `features/ask/AskTab.test.tsx`
(3 — the remembered scroll position, which no browser will tell you about), and
`features/drawing/endLabels.test.ts` (13 — the whole label rule as arithmetic, because a label on
the wrong side sits *on the conductor it names*). Grown: `LocateTab.test.tsx` (37),
`DrawingTab.test.tsx` (35), `model.test.ts` (27).

~~**There is no test file for `stores/locateStore.ts`.**~~ **There is one now** — written 2026-08-24
with the undo stack, which is exactly the case that sentence anticipated: 12 tests in
`stores/locateStore.test.ts`, reading the draft document rather than the screen, because the document
is the deliverable. Current counts: **155 web tests over 10 files**, adding those 12, nine keyboard
tests in `LocateTab.test.tsx` (32), five roster tests in `DrawingTab.test.tsx` (31) and two
`draftPoint` tests in `model.test.ts` (22).

---

## 4. Known hazards, with reasoning

### H1 — Whole-file save, no version check *(index K2, test T-440)*

The editor loads the document **once** per mount and PUTs the whole thing. There is no version,
etag or merge, so **the last save wins and silently discards everything it never saw.** Two ways to
hit it: two browser tabs, or hand-editing the file while a tab is open.

Compounded by the fact that `load()` runs once: the guard in `LocateTab`'s effect is
`if (ready || loading) return`, and the tab is `keepMounted`, so nothing re-reads the file for the
life of the page.

*Why it is like this:* whole-file means no patch protocol to get wrong, and the file stays something
a person can open. *The fix:* a monotonic `version` (or the file's mtime) in the document; the server
refuses a `PUT` whose version is not the current one, with a message telling the editor to reload.
Small, and it turns silent data loss into a visible refusal. ~~**This is the first thing I would
fix.**~~ **Deferred by the user, 2026-08-24**, and the sentence is struck rather than deleted because
the reasoning behind it was sound and may become right again. Two things changed: a gap in the file's
history that looked like this hazard having fired turned out to be a deliberate deletion, so **H1 has
still never been observed**; and the user works in a single tab, where it cannot fire. What went in
instead is `Ctrl+Z` — undo addresses the loss a person actually suffered (their own last action)
rather than the loss the code makes possible. The day a second editor or a hand-edit habit appears,
this becomes the first thing to fix again. Written up in
`_claude_notes/highlighting_wires_and_nets.md` §9, Phase 0, including why a `rev` counter does **not**
make the system multi-user.

### H2 — `load_locations` is cached

`lru_cache` on the parse, keyed by directory. Any writer **must** call `cache_clear()` or it saves a
point and is handed the old one back. `save_locations` does. If a new write path is ever added
elsewhere, this is the trap. `test_a_saved_point_is_visible_to_the_very_next_read` fails without it.

### H3 — A flight inferred from the target — **fixed 2026-08-19** *(index K1)*

The fly effect used to be keyed `[measured, target?.id]`, and three separate complaints came out of
that one line, all of them because **the row's id is not enough to say where to go, and "the target
changed" is not the same question as "the user wants to be taken there"**:

- arming `CR-BP`'s NO contact flew to its coil, because the id names three dots and the effect took
  the first;
- arming the same site twice did nothing, because the id had not changed *(K1)*;
- dragging a dot belonging to another row flew the sheet away mid-gesture, because the drag
  retargets as a side effect.

Now every call site asks: `flyTo(rect)` bumps a nonce and the effect flies to it, and `framing`
decides what the rectangle is — a named site's dot, the **whole sheet** for a row drawn in more than
one place, one point, or the server's estimate rectangle. `flyTo(null)` is "stay where you are", and
it is what the drag, a rename, and a site with no point yet all pass. The nonce is load-bearing:
`entry.rect` is the same array object on two picks of the same row, so without it React would bail
out of the state change and the second ask would be silent.

The effect is still an effect rather than a direct call, because a row can be picked before the
container has been measured — the flight is remembered and made when the sheet has a size.

### H4 — Controlled inputs driven off the document — **fixed 2026-08-18** *(index K3)*

It was two faults that looked like one. The box's `value` was the document's, and `renameSite`
refuses an empty or colliding name by returning the document unchanged, so the box snapped back and
looked frozen; and a rename that *was* accepted changed `site.id`, which is the site row's React
key, so the input was unmounted between keystrokes and the focus went with it. Either way: one
character per trip to the mouse.

Now `TargetPanel.tsx` `SiteName` holds its own text and calls `renameSite` **once**, on `Enter` or
blur. `model.ts` `canRenameSite` is the same rule asked in advance, so a refusal is shown with its
reason instead of reverting silently, and the panel cannot drift from what `renameSite` will accept.
Two details worth knowing before changing it: the commit reads a **ref**, not the state, because the
blur that follows `Esc` can be dispatched before React has re-rendered with the reverted text; and a
successful rename **retargets** (`onTarget`) when that site is the armed one, or the next click on
the sheet would write a second site under the old name.

*The general lesson, which still applies elsewhere:* any input whose `value` comes from a document a
pure function may refuse needs local state. `PasswordGate` and the Ask composer are fine — nothing
refuses their intermediate values.

### H5 — The compass needs the point to exist first *(index K4)*

`setLabelDir` looks the target up and returns the document unchanged when it is not there, so the
control silently does nothing before a point is placed. Fix: create-on-set, or disable the control.

### H6 — A dot swallows the click *(index K5)*

`MarkerLayer`'s markers stop pointer events so a press on one never starts a pan. The side effect is
that you cannot place a new point *underneath* an existing dot by clicking it — the click retargets
instead. Workarounds: zoom in, or drag the existing dot. Whether this should change is a design
question, not a bug.

### H7 — Labels hidden below 30% zoom

`showLabels={viewer.percent >= 30}`. Reads as "labels are broken". Always confirm the zoom
percentage in a report about labels.

### H8 — Browser clock

`at` comes from `new Date().toISOString()` in the browser, not the server. A wrong workstation clock
puts a wrong timestamp in an authored file. Not worth fixing; worth knowing.

### H9 — `circuit_logic.json` goes stale *(index K6, test T-450)*

By design, and now enforced: `test_the_committed_artifact_is_exactly_what_the_generator_writes` is
red until the generator is re-run. Not a bug.

### H10 — Two `window` Escape listeners, and only a tab guard between them *(added 2026-08-19)*

Since the Drawing tab got the same key on 2026-08-19, **two components bind `Escape` on `window`**:
this tab's clears the armed target, the Drawing tab's clears the selection. Both are mounted at all
times (`keepMounted`), so the *only* thing keeping them apart is the `if (activeTabId !== …) return`
at the top of each effect. Drop or mistype one of those guards and pressing `Escape` while placing
also clears the reader's selection on the other tab, or worse, the reverse — a hidden tab disarming
the target under a run of placements. If a report says *"`Esc` did something I did not ask for"*,
that guard is the first thing to read.

Three details they deliberately share, held in `webui/src/lib/keys.ts` and in the comment on each
effect:

- **A text field gets the first `Esc`** (`isTextField`, which counts a checkbox as *not* a field —
  the pin chips hold focus but nothing is being composed in them).
- **Neither swallows an `Escape` it has no use for.** With nothing armed and nothing selected the
  event is left alone, so a dialog can still close on it.
- **They clear different things, and neither clears the other's.** `Esc` on this tab leaves the
  Drawing tab's selection card exactly as it was, which is correct — the selection is the reader's
  place in the sheet, not a mode this editor owns — but it does mean "`Esc` did not close the box"
  is a true observation about the *other* tab and not a bug.

### H11 — "Which dots do I want" is not "which components exist" *(added 2026-08-19)*

The Drawing tab's layer switches — **five of them since 2026-08-25, which is five chances to get
this wrong instead of three** — decide what gets **drawn**. Two other things read the same component
list and must not be answered by a switch:

- **`located`**, which decides whether a `runs through` chip on the selection card is a live link or a
  dead one. It is built from the components group **whether or not that group is switched on**. Wire
  it to the visible markers instead and switching Components off silently kills every link on every
  net's card — which looks exactly like the extraction not knowing where those components are.
- **The selection, and anything the selection runs through, shows through a switched-off group.**
  Hiding the thing an answer just pointed at is the one case the overlay must stay visible for. That
  is why `markers` filters *per group* rather than gating one list on a boolean: `layers[id].markers`
  when the group is on, `…filter(m => relatedIds.has(m.id))` when it is off.

If a report says *"the chips went dead"* or *"my citation stopped landing on anything"* and the
person had been pressing toolbar buttons, this is it.

### H12 — `members` is the parents, not the membership *(added 2026-08-24)*

This is the fault Phase A fixed, written down as a hazard because the wrong field is the *plausible*
one and reads correctly at a glance.

A wire's or a net's **`members`** are the **parent components** of its terminals. Its **`terminals`**
are what it is actually made of. Marking `members` is what produced *"clicking `120` marks
Bypass-CB, DISCHARGE1, INFEED1 and TB-120, but not CR2"*: CR2 **was** marked, on its coil, because
the net's member is `CR2:14` — CR2's NO contact, 630 pt away on the far left of the sheet. And
`TB-120:1`, `:2` and `:3` share a parent, so **seven members were shown as at most five dots**.

Three consequences to keep straight:

- **`terminals` is undeduped and ordered; `places` is deduplicated.** They answer different
  questions. Two members on one coordinate is one dot and two members, and both facts are published.
  A wire's order is `[from, to]` and that order is content — Session 2's two-ended compass heads its
  controls with those ids.
- **Each member carries its own `placement`.** A net of two placed pins and one nobody has touched
  is three claims, and one `placement` on the net could only lie about two of them.
- **`relatedIds` in `DrawingTab.tsx` must include them**, or two things break at once: the rings go
  back onto parent components, and — because a switched-off group only contributes what is in
  `relatedIds` (H11) — a selected net's pins vanish the moment `Terminals` is off.

### H13 — Undo lives inside `edit`, and three other writers must clear it *(added 2026-08-24)*

`set({ document: … })` appears in **four** places in `locateStore.ts`. One of them, `edit`, is the
user's mutation and pushes a snapshot. The other three — `load`, `save`'s reconciliation, and
`reset` — are not user actions and must **clear** the stack rather than push to it. A stack that
survived a `load` would undo this document's points into the coordinates of the file that was open
before it.

Two more details that are easy to get wrong and hard to notice:

- **`coalescing` is module state**, beside `saveTimer`, and `setState` in a test cannot reach it. A
  run left open leaks into the next thing that edits. Both test suites call `endRun()` in
  `beforeEach` for that reason.
- **A drag calls `edit` on every pointer move**, and a nudge on every keypress. Without a coalescing
  key one gesture pushes dozens of snapshots and shoves the thing you actually wanted off the end of
  a 50-deep stack. If a report says *"undo only moved it back a bit"*, that key is the first thing to
  read.

Whole-document snapshots rather than inverse patches, on purpose: 38 KB × 50 is under 2 MB next to
2.2 MB of tiles already on the page, and a patch scheme that is subtly wrong loses work — which is
the thing being fixed. `_claude_notes/highlighting_wires_and_nets.md` §12 records the fork.

### H14 — A label on a terminal the wire does not touch draws nothing *(added 2026-08-24)*

`labels` in `locations.json` is keyed by terminal id, and the key has to be one of that **wire's two
endpoint terminals** or one of that **net's member terminals**. Anything else is a decision about an
end that does not exist: nothing is drawn, nothing is broken, and on screen it is indistinguishable
from a compass control that does not work.

So `resolve_geometry` builds a `touches` map from the netlist, refuses the override **by name**
(*"puts a label on 'TB-110:1' for W047, which W047 does not touch"*) and drops it. It is the only
refusal in this file whose symptom would otherwise be *nothing at all*, which is why it is checked
against the netlist rather than only for shape.

Two things to keep straight if this moves: the shape check belongs in `parse` (which knows nothing
about this drawing) and the membership check belongs in `resolve_geometry` (which is handed the
netlist). And the **count** in the report says what is *in the file*, so an orphaned override is
counted and reported — the same convention a `label_point` for a wire the netlist does not have has
always had.

### H15 — The end-label plan must see everything, not just what is on screen *(added 2026-08-24)*

`planEndLabels` is handed the **whole** designator index and plans **all 265** labels, and the caller
then draws whichever subset it wants. That looks wasteful and is not optional.

The plan is what decides who gets a contested side: a label whose computed side is already occupied
steps clockwise. Plan only the *visible* labels and that arithmetic changes with every layer switch,
every selection and every zoom past the 30% floor — so pressing `Terminals` would slide an unrelated
wire's label around its pin. A label that wanders when you press something unrelated is a label a
reader stops believing is attached to anything, and the cost of the alternative is one pass over 275
entries in a memo.

The same reasoning is why the reservations include **every** marker's own id label whether or not
that group is switched on.

### H16 — Two rows of buttons with the same words, doing different things *(added 2026-08-25)*

The Drawing tab now carries `Components`, `Terminals`, `Wires` and `Nets` **twice**: once in the
toolbar, where they decide what the *sheet* draws, and once over the list, where they decide what the
*list* shows. That is the design and it is what the screen is for — but it has two consequences worth
writing down before somebody tidies them into one control.

- **They must stay separate in the code.** `shown` (a `Record<Layer, boolean>` in `DrawingTab`) and
  `kinds` (a `Set<ListKind>`) are different shapes over different vocabularies on purpose: `Layer`
  has a `labels` member and `ListKind` does not, because a label is not a row. Anything that "unifies"
  them has to answer what pressing `Labels` should do to the list, and the answer is nothing.
- **They must stay distinguishable to anything that finds a button by its name** — a screen reader, a
  test. Each row is a labelled `role="group"`: **`Layers on the sheet`** and **`Filter the list`**.
  `DrawingTab.test.tsx`'s `group()` and `listFilter()` helpers scope through those labels, and
  dropping either label turns a dozen tests into *"found multiple elements"* — which is the honest
  failure, and better than a test that silently presses the wrong one.

The other half of the split is what is **persisted**: `appStore.drawingListOpen` is (it is a decision
about how much sheet you want to see), and the filters and the search text are not (a list that came
back tomorrow showing only wires reads as a broken index rather than as yesterday's filter).

### H17 — `geometry.json` must never reach the browser, or the model, whole *(added 2026-08-25)*

620 KB, about **150,000 tokens**. `prompts.py` §3 has forbidden the model from reading it since v1,
and until Session 4 nothing on the server read it either. Now one route does, and the rule is kept
**structurally rather than by remembering it** — which is the only way a rule about a 620 KB file
survives five more sessions.

Two narrowings, both with names:

- **`ink.py` `reduce()`** keeps named fields and drops the rest at the parse boundary: `symbols`,
  `boxes`, `rects`, `junctions`, `stats`, `params`. What survives is 664 small records. **There is
  no function in `ink.py` that returns the raw parse**, so no route can leak it by spreading
  something.
- **`main.py` `_reading()`** and **`_traceable()`** narrow again to what each screen draws, key by
  key, with **no `**rest`**. `test_a_review_item_carries_only_the_fields_the_screen_draws` and
  `test_a_conductor_carries_only_what_tracing_needs` pin the two sets and assert the response text
  contains none of the dropped section names.

The result is a **119 KB** payload for all 664 readings and a **32 KB** one for all 149 runs, both
behind the editor password.

**Two fields joined the kept set on 2026-09-03**, exactly as the paragraph above used to predict
they would: the conductor **`points`** polylines (7 KB for 393 vertices) and the per-endpoint
**`endpoint_bindings`**, narrowed as they are read to the bound symbol and its distance (18 KB).
Both are read *in `ink.py`*, named, behind the same cache, and the routes decide what to publish;
the loader still never returns the file. `points` therefore left the *dropped sections* list in
`test_review.py` and joined `ITEM_KEYS`, which is the honest place for it — **the rule the list
defends has not changed.** What may not reach a browser is a section of the file nobody narrowed,
and `node_ids` is now the tell.

A route that reads `geometry.json` itself would be the regression, and it would look like nothing.

### H18 — **Three** whole-document drafts now, in three stores, and two of them on one screen *(added 2026-08-25, extended 2026-09-08)*

`H1` was *the editor loads the document once and PUTs the whole thing, so the last save wins.* There
are now **three** of those: `locateStore` over `locations.json`, `reviewStore` over
`label_corrections.json`, and `wiringStore` over `wiring.json`. That is deliberate and is the safer
of the two arrangements — **three files, three drafts, no overlap** — rather than one store over one
document written from several screens, which would make `H1` fire between them as a matter of
course.

**What changed on 2026-09-08 is that two of the three are edited from the same screen**, and that is
the closest this rule has come to being tested. The plan says so out loud: it is a *narrower*
exposure than a second tab, and it is the strongest reason yet to keep the wiring editor on the
Locate tab rather than giving it one of its own. The seam is exact and worth knowing before touching
it:

- **`LocateTab.tsx` reads both documents and hands them to pure functions.** Neither store reads the
  other's state. There is no `useWiringStore` call inside `locateStore` and no `useLocateStore` call
  inside `wiringStore`.
- **The one place the two documents meet is `wiringModel.pathStale`**, and it meets them as
  *arguments*. `rowState` in `model.ts` takes an optional wiring draft for the same reason. Anything
  that made a wiring decision *write* into `locations.json`, or a placement write into
  `wiring.json`, would re-create the single-draft problem inside the code instead of in the file.
- **`wiringModel.ts`'s import of `model.ts` is type-only**, because `model.ts` imports `pathStale`
  from `wiringModel.ts`. A value import in that direction would close a runtime cycle between the
  two rule modules — the code-level shape of exactly the coupling this hazard forbids between their
  stores.
- **`wiringStore` has no undo stack and it does have a `stale` banner** — the opposite of
  `reviewStore` on the second count. An endpoint *is* the netlist.

What it means in practice:

- **a hand edit to either file while its tab is open is overwritten by that tab's next save.** `K2` is
  still theoretical and is now theoretical about two files;
- **the two stores must not learn about each other.** The one existing exception is the roster's
  *place it*, which sets a target and writes nothing. Anything that made a review decision touch
  `locateStore`, or a placement touch `reviewStore`, would re-create the single-draft problem inside
  the code instead of in the file;
- `reviewStore` has **no undo stack**, and the header of that file argues it: `Ctrl+Z` there is the
  *text box's*, which is what somebody typing a string expects, and every correction is one field of
  one row that the row still shows with its `was` beside it. The Locate tab needed a stack because a
  drag destroys a coordinate that is then nowhere on screen. If that turns out to be wrong, the stack
  is the same eight lines inside `edit` that it already is over there.

### H19 — A blur is not a decision, and the box's baseline is what decides that *(added 2026-08-25)*

`ReadingRow`'s input holds its own text and commits on `Enter` or blur — the `H4` rule. The subtlety
is **what it compares against** before writing:

    if (typed.current.trim() === settled) return          // settled = the correction, else item.text

Compare against the *stored correction* instead — `stored?.text ?? ''` — and every untouched row
writes itself the moment it loses focus, because the box was showing the machine's reading and the
correction was empty. **Tabbing down the queue would sign all 278 readings**, each as
`{text: 'LI-A', was: 'LI-A'}`, and the file would say a person had confirmed things nobody looked at.
That was a real bug for the length of one test run;
`records nothing when a box is left exactly as the machine read it` is the assertion that caught it.

The second half of the same decision: `settled` falls back to **`item.text`** rather than `item.read`,
because a run's reading can change without anybody touching that row — correcting the label its net
name is bound from does exactly that (`via`). A box still showing the superseded string would invite
somebody to correct it a second time on the run itself.

And saying *the machine was right* is therefore an **explicit press**, the ✓ — which is disabled on an
empty box, where there is nothing to accept and the honest decision is *not a label*.

### H20 — **geometry is free and connectivity is not** *(added 2026-09-02, rewritten 2026-09-09)*

**Read this version. The one underneath it was right for two sessions and is kept because the
reasoning it was replaced by is a refinement of it, not a reversal.**

Three routes publish something out of this drawing without an editor password: `/api/paths` (a
wire's authored route, and since Phase C a block's own commoning), `/api/conductors` (the 149 runs
of ink, narrowed), and `/api/designators`. One does not: **`/api/wiring`**, which says *what
connects to what*.

That is the line, and it is about **what is published** rather than about **who is asking**:

- **Geometry is free.** A route, a bus, a polyline, a dot. It is what a reader with the paper
  wants, and *which of these lines is the one I care about* was always a reader's question. Phase D
  added the sharper form of it — **what is this line, and does any wire claim it** — which is
  answerable only with the raw polylines, and that is why `/api/conductors` lost its gate.
- **Connectivity is not.** `wiring.json`'s `wires` section is the `CONNECTS_TO` edge the model
  answers from and the one authored claim whose save makes `circuit_logic.json` stale. There is no
  reader's half of it to free. `test_no_wires_endpoints_travel_with_it` asserts that publishing a
  block's bus on `/api/paths` did not smuggle an endpoint out with it.

**What survives from the old version is the property, not the gate**, and it is `H17` rather than
this hazard: what a reader may not have is **a section of `geometry.json` nobody narrowed**.
`ink.py` `reduce()` keeps named fields at the parse boundary and `main.py` `_traceable()` narrows
again key by key with no `**rest`. `test_a_conductor_carries_only_what_tracing_needs` pins the set,
and freeing this route makes that test **more** load-bearing rather than less — it is now the only
thing between 620 KB and a browser on a public copy.

*The pair that used to be asserted in one test is gone with the gate.*
`test_a_reader_never_downloads_the_ink` became
`test_a_reader_may_ask_what_a_line_on_the_sheet_is`, and it asserts the new line instead:
`/api/conductors` **200**, `/api/paths` **200**, `/api/wiring` **404**, on one reader's server. The
old test's docstring is quoted in the new one, because a rule that changes should show its working.

---

*The original, 2026-09-02 to 2026-09-09, kept because it is the argument this one refines:*

### H20 (as written 2026-09-02) — the highlight is free, and that is a decision rather than an oversight

Every other route that reads an authored file is behind `allow_edits`: `/api/locations`,
`/api/review`. **`/api/paths` is not**, and the reasoning is the two things that put the others
behind the gate, neither of which applies here.

- **What it reads.** `/api/review` is the one route that opens `geometry.json` — 608 KB, ~150,000
  tokens, `H17`. A path is authored and lives in `locations.json`; the ink loader is never touched,
  and `test_nothing_here_opens_the_ink` monkeypatches `load_ink` to raise so that a later session
  cannot quietly change that.
- **Who wants it.** 664 OCR readings are no use to somebody who cannot correct them. *Which of these
  lines is the one I care about* is a **reader's** question before it is an editor's — a technician
  with the drawing and no password is exactly the person the highlight is for. The Drawing tab's
  list already had that as its acceptance criterion (T-650), and this inherits it.

What that means for anyone adding to this route: it may publish **authored display geometry and
nothing else.** Session 6's `/api/conductors` — 149 candidate polylines out of the ink — is a
different route with a different gate, and the two must not be merged for convenience.

**Built 2026-09-03, and the pair now exists in code**: `test_a_reader_never_downloads_the_ink`
asserts both halves in one test — `/api/conductors` **404** and `/api/paths` **200**, on the same
reader's server — because the fact worth pinning is not that one is gated, it is that two routes
which look like siblings are on opposite sides of the same gate. Anything that "tidies" them
together has to answer what a technician with no password is supposed to do with 149 proposals.

*(**And on 2026-09-09 that last question got an answer**, which is why the version above replaces
this one: a technician with no password uses them to ask **what is this line**, one at a time, by
pointing at it. The sentence *"it may publish authored display geometry and nothing else"* is still
the rule for `/api/paths` — a block's commoning satisfies it and a wire's endpoints do not.)*

### H21 — an extracted run may not be edited in place *(added 2026-09-03)*

`geometry: extracted` is not a quality rating. It is a **claim about the polyline**: *these corners
are the PDF's own vector data, not mine.* So dragging a vertex of one would leave that claim
standing over a line a person had altered — and nothing on screen would ever say so, because the
badge would go on reading `from the ink`.

That is invariant 10 in a fifth set of clothes: a file that cannot tell *the drawing said this* from
*somebody adjusted this* has stopped being a record of who said what. The cure is a conversion a
person has to ask for:

- **`PathHandles` is rendered only for `geometry: human`.** No handles exist on a lifted run, so
  there is nothing to drag.
- **`model.movePathVertex` refuses one anyway**, returning the document unchanged, so a second
  caller cannot reintroduce it.
- **`model.convertPath` is the only way across**, it is an explicit press with the consequence
  stated beside it, and **it deletes `conductors`** — the run is no longer the run it was lifted
  from, and naming it would be a claim that is no longer true.

If a report says *"I cannot move a corner"*, that is this, and T-925 is the walk-through. If a
report says *"a stripe says `from the ink` and does not follow the ink"*, that is this hazard having
been broken.

### H22 — **three** things want `Escape`, and the escalation is written down *(added 2026-09-03, extended 2026-09-08 and 2026-09-09)*

There are **four** `window` key listeners in this application — this tab's `Escape`, this tab's
`Ctrl+Z`/arrows, and the Drawing tab's `Escape` — and `H10`'s `activeTabId` guard is still all that
separates the tabs. Inside the Locate tab there are now **three** modal states that all want this
key, and the order is not arbitrary:

    a text field  →  an armed end slot  →  a trace in progress  →  the armed row

**Each press takes exactly one thing away, and each step is more recent and more fragile than the
one after it.** A half-drawn route is more fragile than the armed row, and one press taking away
both would mean losing your place as the price of abandoning a line.

**The end slot goes first among the three modes, and that is the 2026-09-08 addition.** It is the
one state where *the next click writes into a different authored file*: with a slot armed a terminal
click binds an endpoint into `wiring.json`, and leaving it armed while believing it was gone is how
an endpoint gets written by a click meant to place a dot. The most dangerous mode should be the
cheapest to leave.

Both halves are held in **refs** rather than in state — `traceRef` and `slotRef` — for the reason
`panTo` is: the listener is bound once per active tab and re-binding it on every corner or every
click would be a cost with no benefit.

**And there is a fourth way out of the slot that is not a key at all:** changing the armed row
disarms it, in its own effect. Without that, arming `W063`'s `to` slot and then picking `W068` would
leave the next terminal click writing into `W063` — an endpoint written into a wire the person is no
longer looking at, which is the worst shape a silent write can have.

If a report says *"`Esc` cleared my row when I meant to drop a corner"*, the trace had already
ended — and if it says *"`Esc` did nothing"*, check `isTextField` first.

**And since 2026-09-09 the Drawing tab has an escalation of its own**, which is this rule applied
to the reader's side rather than a fourth occupant of the Locate tab's:

    a text field  →  the run of ink you pointed at  →  the selection

The conductor card goes **before** the selection for the same reason the end slot goes before the
trace: most recent first, and cheapest to lose. Asking *what is this line* in the middle of reading
net `120` is a question **about** net `120`, and taking the selection away as the price of
dismissing the card would make the feature cost something to use. So the selection is **kept** while
the card is up — the two share the bottom-left corner and the card simply wins — and `Escape` gives
it back. `pickRef` in `DrawingTab.tsx` is the same ref trick `traceRef` and `slotRef` use, and for
the same reason: the listener is bound once per activation.

### H23 — one authored file stops the generator and two do not *(added 2026-09-07)*

Three files are read by `author_circuit_logic.py` and they are **not** treated alike, which looks
like an inconsistency and is the design:

- **`locations.json`** — unreadable? `read_locations()` prints `WARNING: locations.json ignored`
  and the netlist is written without it. The netlist does not depend on the geometry, so a typo in
  one must not cost the other, and `test_a_broken_locations_file_still_writes_the_netlist` pins it.
- **`wiring.json`** — unreadable, absent, naming a terminal the netlist does not have, or naming a
  wire the `W` table does not have? `read_wiring()` **raises**, the script exits non-zero saying
  `REFUSED:`, and `circuit_logic.json` is not touched.

The asymmetry is one sentence: **a missing point makes a worse drawing, and a missing endpoint
makes a different netlist.** The failure mode being defended against is not a crash, it is the
opposite — a `wiring.json` deleted or mistyped, the generator falling back to the `W` table, and
71 endpoints quietly reverting to the guesses that 11 of them are wrong in, with git showing a
change to a generated file and nothing anywhere saying why.

Two consequences for anyone adding to it. **Anything that runs the generator has to supply the
file** — `test_review.py`'s byte-identity test copies it into its scratch directories for exactly
this reason, and so does `run()` in `test_extraction_generator.py`. And **the refusal has to say
how to fix itself**: the missing-file message names `bootstrap_wiring.py`, and a test asserts that
it does, because a loud failure that leaves a person stuck is only half of the bargain.

### H24 — the ink's landing is not the polyline's end, and four wires prove it *(added 2026-09-08)*

The single most breakable thing in Phase B, written down because breaking it produces an answer that
is **confidently wrong** rather than absent.

A terminal block's own vertical bus is **fused into some wire polylines**, because the extractor
splits a conductor only at a **crossover hop** and a T-junction is not one. `C0105` is one conductor
holding `DISCHARGE1:2`'s wire *and* the whole 279.6 pt vertical of `TB-0V`'s commoning: its polyline
**ends beside row 1** while the wire joins the block at **row 12**, 114 pt and seven landings away.

So `wiring.ts` reads a landing at the point a run **leaves** the commoning geometry:

- a run passing within `ON_INK_PT` (4) of **two or more terminals of one component** is running
  along that component's bus over that stretch;
- an end of the polyline sitting inside such a stretch is not a landing — the landing is the far
  boundary of the stretch;
- a run that is *nothing but* bus (`C0092`, `C0086`, `C0010`) lands on nothing and is never offered,
  which is plan §4 q10's *`C0092` is `TB-120`'s commoning and no wire may claim it* as a predicate.

**Three things to keep straight if this moves.**

1. **The test is a shape, not a prefix.** Nothing in `webui/src/` knows what `TB-` means and nothing
   should — the next drawing will not name its blocks the same way. Handed the real sheet and told
   nothing, it recovers exactly the 8 conductors the plan's §3.6 lists by hand.
2. **A landing must be nearer *this* end of a run than the other**, and that clause is easy to leave
   out. `C0017` is 17.2 pt long — shorter than `LANDING_PT` — so without it the same pin is reported
   at both of its ends, the 3.5 pt join to `C0117` is never made, and `W069`'s correction to
   `TB-130:1` disappears entirely.
3. **Only `placement: 'confirmed'` pins may be fed to it.** A terminal resolved to its parent
   component's dot is a coordinate nobody chose, and a rule discriminating at 4 pt handed one would
   invent landings on whatever ink happens to pass the component. All 131 on this sheet are
   confirmed; the guard in `LocateTab.tsx`'s `ink` memo is for the next drawing, half-placed.

Get the first of these wrong and **four wires are mis-proposed** — which is precisely how
`07_drawing_facts.md` came to record `W063` as ending on `TB-120:2`.

**All of that was corrected on 2026-09-09**, and the shape rule grew a second job with it. The row,
the `paths.test.ts` fixture and `14_tests_path_editor.md` T-915 — which had been *instructing* a
person to add `TB-120`'s bus to `W063`'s route — now say `W063` is one run, `C0091`, ending at
`TB-120:1`. And `onlyCommoning` is no longer only a filter on *proposals*: `paths.ts`
`candidates()` is handed the set and **does not offer** a run that is nothing but a bus, with the
panel naming what it kept out. Two things follow for anyone touching `stretches` or the effective
ends:

- **`commoningFor` is the exported form of the same arithmetic**, and the authoring screen writes
  what it returns. Change the spans and you change what is written into `wiring.json`, not just
  what is proposed.
- **The exclusion is keyed on `onlyCommoning`, never on an authored record's `conductors`.**
  `C0105` and `C0008` are each partly a wire, so a record's conductor ids name runs that *are*
  legitimate routes for `DISCHARGE1:2` and `RECEPT1:5`. The narrow question — *is the whole of this
  run a bus* — is the only one safe to exclude on.

---

## 5. Invariants — if one of these is violated, that is the bug

1. **A wire's route is never *computed*.** Not in the file, not in the editor, not in the API.
   *(Phase E, 2026-09-03, is the first thing that ever writes one, and it writes only the two legal
   kinds: `setPath` copies a polyline out of `/api/conductors` — the PDF's own strokes — and
   `tracePath` records corners a person clicked. Nothing in `features/locate/paths.ts` produces a
   coordinate: `candidates()` ranks runs that already exist and `runsOf` hands back their own
   points. `attribution` is written `human` on every route, including the ones an exact printed-name
   match proposed, because **nothing here accepts a ranking on its own** — 37 of the 71 wires have
   a single run whose two ends land on both their pins and every one of them still needs a click.
   `chordOf` is the one function that computes anything from the endpoints, and it exists **only**
   to be printed beside the ink's length for comparison: it is never drawn, and `W068`'s 312 pt
   against 644 pt is why.)*
   *(Amended in force since 2026-09-02, which is the whole of Phase D: a wire may now carry a
   `path` — one or more polylines **lifted from the PDF's own conductor strokes** or **traced by a
   person** — and it says forever which of the two it was. A route **synthesised from its
   endpoints** never becomes legal, and that is what this invariant always actually guarded:
   `derived` is refused by name on both axes, in `_paths`, with a test per axis. Nothing computes a
   run, nothing stretches one to meet the pins it stops short of, and nothing draws a chord when
   there is no path — the card says *no path yet* instead. The index's §8 carries the full
   wording.)* Owner: `LABELLABLE` (`model.ts`), `_labels`
   (`server/app/locations.py`), and ▲ `fold_in_labels` — which is **not** in the server: it is in
   `schematic_extraction/PS20115MLM4-2/extracted_docs/author_circuit_logic.py`, the generator.
   **Nor is one ever drawn.** No dot appears at a wire's or a net's `point` — that is the centre of a
   bounding box, which is usually blank paper — on either tab. `atLabelPoint` in `DrawingTab.tsx`
   returns `null` until somebody has said where the *name* is printed, and the wire/net layer and the
   selected marker both go through it, so neither can grow the behaviour the other lacks.
2. **There is exactly one projection.** Every screen coordinate goes through `paint.ts`. A second
   one would eventually disagree with the tiles.
3. **There are three placements and no fourth.** `confirmed`, `seed`, `parent`. Nothing derives a
   coordinate; that was built once and rejected. `derived` is a *rejected* value in `SOURCES`, and
   `test_a_bad_field_costs_that_field_and_nothing_else` uses it as its example of one.
4. **A pin belongs to a site explicitly.** Never inferred from `function` — `CR-BP` has two `common`
   pins at different sites.
5. **Nothing refused is silent.** Every rejected value lands in `problems` and the UI shows it.
6. **Generated files stay generated.** `circuit_logic.json` is only ever written by
   `author_circuit_logic.py`. *(Extended again 2026-09-08: since Phases A and B there is a
   **screen** that writes `wiring.json`, and it is the only editing surface in this application
   whose save moves what the netlist says connects to what. It still does not write the artifact —
   `PUT /api/wiring` puts a banner up naming two commands and this server does not run Python on
   request. The two validators over that file are deliberately duplicated and
   `test_the_editor_cannot_write_a_record_the_generator_refuses` is the guard, because the editor
   writing something the generator refuses is the one failure here that nothing else would
   notice.)* *(Extended 2026-08-25 and corrected 2026-09-07: the generator reads
   **three** authored inputs — `locations.json`, and since Phase 0 of the wiring plan `wiring.json`,
   which says which two terminals each wire joins. `label_corrections.json` is still not one of
   them: it corrects a reading of the ink and must never reach the netlist, and a session wiring the
   corrections in would move the artifact every answer is checked against with nothing else in the
   project noticing. Owner:
   `test_the_generator_output_is_byte_identical_with_and_without_a_corrections_file`, which compares
   bytes rather than making an argument.*

   *The sentence that used to sit here — "the netlist is already right" — was doing two jobs and
   only one of them was true. The netlist has **no duplicates**, which is what §2 of
   `highlighting_wires_and_nets.md` measured; **what nobody checked is whether a wire's two
   endpoints are the two the sheet joins, and 11 of the 71 are not**
   (`_claude_notes/authoring_the_wires.md` §3). It was checked for twins and not for truth. Every
   claim about the Review tab not touching the netlist is unaffected and still exactly true.)*
7. **A terminal nobody placed has no location in the generated artifact** — not its parent's.
   The substitution happens at read time and is labelled `parent`.
8. **Nothing writes a coordinate a person did not choose.** *(added 2026-08-24 with the keyboard.)*
   A click places, a drag moves, a nudge corrects — and the nudge only ever moves a point the draft
   **already owns** (`draftPoint`), never a resolved seed or a parent fallback. Turning an estimate
   into a `source: human` point one arrow-press away from it would be a `derived` tier by the back
   door, which is invariant 3 in different clothes.
9. **A label's position depends on the points and nothing else.** *(added 2026-08-24 with the end
   labels.)* Not on what is selected, which layer is on, what the zoom is, or the order the payload
   arrived in. Owner: `planEndLabels` in `features/drawing/endLabels.ts`; hazard H15 is the reasoning
   and *"is the same plan however the index is ordered"* is the test.
10. **A default is never written into the file as though a human chose it.** *(added 2026-08-24.)*
   *Reset to default* **deletes** the override, un-hiding deletes it, and `hidden: false` is stripped
   on the way in and refused on the way back out. Owner: `setEndLabel` (`model.ts`) and `_end_labels`
   (`locations.py`) — refused from *both* ends deliberately. This is invariant 3 in a third set of
   clothes: a file that cannot distinguish *nobody has looked at this* from *a person decided this*
   has stopped being a record of who said what, which is the only thing it is for. T-570 walks it,
   and it is the one assertion in that document worth reporting loudly.

   *Extended 2026-09-08 to the fourth file, and it is the same distinction one layer down.* A
   **confirmation** of a wire's two endpoints is **kept** even where nothing changed — `source:
   human` with no `was` — for the reason `label_corrections.py` argues at length: nothing produces
   *a person checked this* but a person, and 47 of the 71 wires need exactly that and nothing else.
   But a **`was`** is deleted the moment a correction is taken back: put an endpoint back where it
   started and the file must stop claiming a move that did not happen. And `unconfirm` writes
   `source: index` rather than **deleting the record**, because the bootstrap wrote one for all 71
   and a vanished record says *somebody removed a wire*, which is a louder claim than *nobody has
   checked this*. Owners: `confirmEndpoints`, `setEndpoint`, `unconfirm`, `setWiringNote`
   (`features/locate/wiringModel.ts`), `_wire` (`server/app/wiring.py`).

   *Extended 2026-09-03 to two more, and both are deletions.* **`no_path_on_this_sheet: false`** is
   never written — pressing the control off **deletes** the key, and `locations.py` `_no_path`
   refuses a written `false` by name from the other side, because `false` is the shape a *Reset*
   that wrote instead of deleting would leave behind. And a **`note`** is refused on a row nobody
   has decided about: `note` rides on a `text`, the file requires one, and inventing the machine's
   reading to hang a note off would record *a person checked this* about a row nobody checked.
   Owners: `setNoPath` and `writeWire` (`features/locate/model.ts`), `_no_path`
   (`server/app/locations.py`), `setNote` (`features/review/model.ts`).

   *Extended 2026-08-25 to the third file, with the line drawn exactly.* On the Review tab **Reset
   deletes** the correction rather than writing the machine's reading back in (`setCorrection` with no
   `text`; T-730). But a **confirmation** — the ✓ pressed on an unchanged string — **is kept**, and
   that is not an exception to this invariant. The test is whether the value would have existed
   without a person: an end label's side is *computed*, so storing it as a decision is a lie, whereas
   **nothing produces *a person checked this* but a person.** A verified low-confidence reading is new
   information and the queue's job is to get smaller. Owners: `features/review/model.ts`
   `setCorrection`, `label_corrections.py` `_correction` (which refuses `""`, the shape that would
   blur the two).
