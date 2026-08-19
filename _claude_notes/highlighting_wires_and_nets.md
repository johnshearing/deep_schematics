# Highlighting wires and nets

**Date:** 2026-08-19
**Status:** a report to be read and argued with, then a plan to implement. Nothing has been built.
**Question that produced it:** *"Why is it not recommended that a human place wires, when already I
am placing components, terminals, wire labels and net labels?"*

---

Note: When Claude wrote the following, he left the following comment:
One thing worth flagging for the next session: §7's amendment is the gate. Every phase except A depends on it, so that is the first thing to agree or reject.

---

## 1. The short answer, and a correction I owe you

**It is recommended. A human placing wire paths is the right design, and it is what this plan
builds.** If the last exchange read as "Claude says no", that was my fault: I led with the
prohibition instead of with the permission that follows from it.

Here is what actually happened. `_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md`
§8 is titled **"The one thing that must stay true"** and ends:

> If a change ever appears to let a human author a route, that is the bug, whatever else it fixes.

I wrote that in an earlier session, at your instruction to write down what must not drift. It is
enforced by three named tests and one validator, so it cannot be worked around quietly, and it is
not mine to overrule. Raising it was procedural: **a written invariant that blocks what you asked
for has to come back to you before it is edited, not after.** What I proposed alongside it was an
amendment that *permits* human-traced paths (§7 below). Sequencing the objection ahead of the
permission made a green light look like a red one.

**You are not being taken out of the loop.** This whole subsystem exists to put you in it: the
Locate tab was built after a machine guesser was measured, found to be wrong by 11 pt against 16 pt
conductor rows, and rejected *because* a human is more trustworthy than the guess. Wire paths are
the same argument one step further, and the human doing the tracing is the reason it is safe.

---

## 2. "Do we have terminals for all wires?" — Yes. Every one.

Measured against the shipped netlist, not remembered:

| | |
|---|---|
| Wires | **71**, each with `from_terminal` and `to_terminal` |
| Endpoints | **142**, every one a well-formed `COMPONENT:PIN` id, **0 dangling** |
| Terminals | **131** total; **18** placed by you so far (all `source: human`) |
| Wires with **both** ends human-placed today | **1** (`W061`, `DISCHARGE1:1 → CR-BP:11`) |
| Wires whose ends resolve to *some* point today | **71** — the rest lean on a seed or a parent |

So your intuition is right on the facts: **place the 131 terminals and every wire has two confirmed
ends.** `04_tests_labels.md` already says so in as many words — *"placing the 131 terminals gives all
71 wires their routes for free."*

That sentence is the one thing in the existing documents I now think is wrong, and §3 is why.

---

## 3. Two ends is not a path — and this is the only real objection

It is a geometry objection, not a trust objection.

A schematic conductor does not run diagonally from pin to pin. It runs **orthogonally, with
corners**, and where it crosses another wire it is drawn with a **crossover hop** — this drawing has
88 of those small circles, and mistaking them for terminals was the hardest-won lesson of the whole
extraction. So the straight line between two correctly placed terminals is, on a real sheet, almost
never where the wire is.

Take `W052`, `CR2:14 → TB-120:1`, BLUE 18AWG, on net 120:

| | |
|---|---|
| A straight chord would claim | (861, 381) → (300, 600) — a diagonal ~600 pt long, cutting across the entire relay column and four unrelated circuits |
| The ink actually says | `C0080`: a single horizontal run at y = 663.7, from x = 379.8 to x = 301.8 |

The chord is not slightly wrong. It is somewhere else entirely, and it would cross conductors it has
no business touching — on a sheet where **being one 16 pt row out already names a different
circuit.** For a highlighter whose whole job is "which of these lines is the one I care about", a
wrong line is worse than no line.

**This is why the answer is not "a human cannot be trusted to place a wire."** It is: *a wire needs
more than its two ends to be drawn, and neither you nor the machine should have to supply the
corners by hand if the sheet already contains them.*

---

## 4. What §8 was really protecting, and why you were never its target

Read the rule's own rationale, which is repeated verbatim in four places in the codebase
(`locations.py` `_labels`, the module docstring, `test_locations.py:163`,
`test_extraction_generator.py:135`):

> a line drawn between them **because no conductor joined them** would be an invented route, and the
> netlist's authority rests on never having invented one.

The load-bearing clause is *"because no conductor joined them."* The thing being banned is a line
**no ink justifies** — a line the software would have computed and then displayed as fact. It was
aimed at the machine, and at one specific failure mode: the rejected guesser produced coordinates
that were confidently wrong, and once a wrong line is on the screen it looks exactly like a right
one.

So why did the rule read as a ban on *you*? Because of a gap in the file format, not a judgement
about people:

> **`locations.json` had no way to say "a person traced this."** With only `source: human | seed`
> available, any route written into the file would have been indistinguishable, six months later,
> from one some earlier version had derived. Faced with a field that could not carry its own
> provenance, the safe rule was to have no field at all.

That is a fixable problem, and fixing it *is* the amendment. Give a path provenance that can
distinguish *lifted from the ink*, *traced by a person* and *computed* — and then keep banning only
the third. Nothing about your authority changes; what changes is that the file can finally record
it.

---

## 5. The discovery that makes this cheap: the ink is already extracted

I went into `geometry.json` (620 KB, the file nothing is supposed to read in full) to count what is
in it. `pages[0]` holds, in the **same PDF-point space as the tiles and every marker** — no
registration step:

| | |
|---|---|
| `conductors` | **149** polylines, each with `points`, `endpoints`, `node_ids`, `length` |
| of those, multi-segment | **50**, up to **5 segments** — `C0008` is a real 4-corner orthogonal route |
| with a printed net label | **70** (`net_label`, read off the sheet beside the run) |
| with colour and gauge | **67** (`spec_label`, e.g. `BLUE 18AWG`) |
| `endpoint_bindings` | per endpoint: the `terminal_point` symbol it lands on and how far away, in points |
| `nets` (conductor groups) | **111**, keyed by printed label, with `member_conductors` |
| `symbols` | 98, of which 88 `terminal_point` |
| `junctions` | 2 |

These coordinates come from the **PDF's own vector strokes** — they are the drawing, not a reading of
it. That is a categorically stronger kind of machine fact than the 11 pt vision seeds, and it is why
this changes the economics rather than repeating a rejected idea.

Worked example, net `120`:

| Conductor | Run | Spec |
|---|---|---|
| `C0080` | (379.8, 663.7) → (301.8, 663.7) | BLUE 18AWG |
| `C0081` | (301.8, 639.6) → (426.3, 639.6) | RED 16AWG |
| `C0091` | (562.9, 563.4) → (301.9, 563.4) | RED 16AWG |
| `C0109` | (232.6, 563.4) → (298.2, 563.4) | BLUE 18AWG |

Net 120's four wires in the netlist are `W052`/`W053` BLUE 18AWG and `W063`/`W068` RED 16AWG. **Four
runs, four wires, specs matching exactly.** Highlighting net 120 can stroke ink that is genuinely on
the paper.

### How much of the tracing is picking rather than drawing

Matching each wire against conductors whose printed `net_label` equals the wire's net **and** whose
`spec_label` equals its colour and gauge:

| Wires (71) | Candidates | What the human does |
|---|---|---|
| **19** | exactly 1 | glance and confirm — one click |
| **33** | 2 or 3 | pick which is which — one click, from a list of two or three highlighted on the sheet |
| **19** | 0 | choose from the 79 unlabelled conductors ranked by proximity to the wire's terminals; hand-trace only if nothing fits |

And at net level, **17 of 26** nets already match a printed conductor group on an exact id
comparison. The 9 that do not are mostly OCR twins — `LI-A` for `L1-A`, `TINSP1` for `IINSP1`, `PB2`
for `NET-PB2`, `130.` for `130` — each one human decision. (Connectivity growth does not help: this
sheet has 2 junctions, and I measured that walking shared `node_ids` adds exactly 0 conductors.)

**So the work is confirming and disambiguating, not draughting.** Your hand supplies the judgement;
the PDF supplies the corners.

---

## 6. On the model, and on simulation — you are right, and it is a design decision

> *"I don't think this visual representation needs to interfere with the model's knowledge of the
> wire paths."*

Agreed, and this plan writes it down as a rule: **wire paths do not go into `circuit_logic.json`.**

- The netlist answers *what connects to what*, and `from_terminal`/`to_terminal` already says it.
  A polyline adds nothing the model can reason with.
- 149 polylines, half of them multi-segment, would inflate the one file the model reads end to end,
  and `prompts.py` already forbids it `geometry.json` for exactly this reason.
- **A bonus that matters day to day:** because the generator never reads paths, saving a path does
  **not** make `circuit_logic.json` stale. No banner, and
  `test_the_committed_artifact_is_exactly_what_the_generator_writes` stays green. Paths are the one
  authored thing that costs you no regeneration.

And for the simulator on the roadmap (`webui_ideas.md` §3): the boolean network is solved from the
**netlist** — nets, `COIL_CONTROLS_CONTACT`, `normal_state`. The paths are what lets you *watch* it:
net 121 going dead, then 120, then CR-BP picking up, each drawn on the conductors a technician can
see. Paths are display geometry, and display is the right layer for them. Your instinct about that
is the reason the layering below is clean.

---

## 7. The amendment to §8, as I propose to write it

Replacing the current §8 with this, keeping the section title:

> **A wire's route is never computed.** It is either **lifted from the ink** — one or more conductor
> polylines out of `geometry.json`, which are the PDF's own vector strokes rather than a reading of
> them — or **traced by a person along the printed conductor**. It carries which of those it was,
> forever, and a hand-traced path says so on screen.
>
> What stays forbidden is a route **synthesised from its endpoints**: no straight line between two
> terminals, no interpolation, no path derived from anything but ink. A highlight computed from
> terminal positions is the bug, whatever else it fixes.

Provenance gains a second axis, because a traced conductor is **exact geometry with uncertain
attribution**, and that is precisely the pair a human is confirming:

| Axis | Values | Means |
|---|---|---|
| `geometry` | `extracted` | the polyline is a conductor from `geometry.json` — the PDF's own strokes |
| | `human` | a person traced it corner by corner on the sheet |
| `attribution` | `printed` | the net name printed beside that conductor matches this wire's net |
| | `human` | a person said this run is this wire |

`derived` remains a **rejected** value on both axes, and the test that proves it stays — three tests
get renamed from *"never a route"* to *"never a route derived from its endpoints"*, which is what
they were always testing for:

- `test_locations.py::test_a_wire_gets_a_label_position_and_never_a_route`
- `test_extraction_generator.py::test_a_wire_gets_where_its_name_is_written_and_never_a_route`
- and the `_labels` docstring in `locations.py` that states the rule for the next reader

**Nothing in this plan proceeds until you accept that amendment**, because it is your rule.

---

## 8. What is broken today, separately from all of this

Your other report — *"clicking `120` marks Bypass-CB, DISCHARGE1, INFEED1 and TB-120, but not CR2"* —
is a real bug and is **not** about paths. I traced it through the live index.

CR2 *is* in the highlight set and a dot *is* rendered for it. Two things are wrong at once:

1. **The ring is on the wrong one of CR2's drawn places.** The highlight set is `entry.members`,
   which the server builds as the **parent components** of the net's terminals. Net 120's actual
   membership is *terminals*: `BYPASS-CB:1, CR2:14, DISCHARGE1:3, INFEED1:3, TB-120:1, TB-120:2,
   TB-120:3`. `CR2:14` is CR2's **NO contact**; nobody has placed it, so it falls back to CR2's coil
   seed at (861, 381) — 480 pt away from the other four members, at the extreme corner of the framed
   region, drawn as a hollow white dot on white paper. Easy to miss, and in the wrong place even
   when found.
2. **The same disagreement, quieter, on `DISCHARGE1`.** Its ring sits on the component point
   (596.9, 521.5) while the net's placed member terminal `DISCHARGE1:3` is at (660.7, 563.6) — 75 pt
   apart. And `TB-120:1/2/3` collapse onto one dot, so 7 members show as at most 5.

The fix is to highlight **the terminals a net is made of**, each carrying its own provenance, and to
have the lower-left box name every member and its state out loud — so an unplaced pin appears as
*"`CR2:14` — shown on its component, not this pin"* with a way to go place it, instead of as silence.
That is Phase A, and it is worth doing whether or not paths ever ship.

---

## 9. The plan

Four phases. A is independent; B is the highlight; C is the editor; D is the triggers you asked
for. Each is separately shippable and separately testable.

### Phase A — make the highlight tell the truth about membership

*Fixes §8 above. No new file format, no amendment needed.*

- **`server/app/drawing.py` `_entry()`** — wire and net entries gain
  `terminals: [{id, point|null, placement|null, site?}]`, **undeduped and in order**: `[from, to]`
  for a wire, `member_terminals` for a net. `members`, `places`, `point` and `rect` are untouched, so
  nothing existing breaks. ~273 small objects added to a payload that already carries 275 entries.
- **`webui/src/api/types.ts`** — the matching optional field on `Designator`.
- **`webui/src/features/drawing/DrawingTab.tsx`** — when the selection is a net or a wire, render
  **terminal** markers for its members alongside the component markers, ringed, each styled by its
  own `placement` (filled = confirmed, hollow = seed/parent) through the existing `MarkerLayer`.
- **`webui/src/features/drawing/SelectionCard.tsx`** — becomes a roster: one row per member terminal
  with its state in the words the Locate tab already uses (`placed`, `estimate`, `on its component`,
  `nowhere`), clickable to fly there, plus a *"place it"* link that arms that terminal on the Locate
  tab when editing is enabled. The component chips stay, demoted.
- Framing already boxes every member's point (`rect` is their bbox), so nothing ringed can be off
  screen once the rings are on the terminals — assert it rather than assume it.

### Phase B — wire paths: the file, the API, the painting

*Requires the §7 amendment.*

- **`locations.json` schema 1 → 2.** The `wires` section gains `path` beside `label_point`:

  ```json
  "wires": {
    "W052": {
      "label_point": [340.2, 655.1],
      "path": {
        "runs": [[[379.8, 663.7], [301.8, 663.7]]],
        "conductors": ["C0080"],
        "geometry": "extracted",
        "attribution": "human",
        "by": "js",
        "at": "2026-08-19T18:04:11.512Z"
      }
    }
  }
  ```

  `runs` is a **list of polylines**, not one, because a crossover hop is a real gap in the ink and a
  path that spans two conductors should show that gap rather than close it. `conductors` records
  which extracted runs it was lifted from, and is absent on a hand trace.
  *One file rather than a new `paths.json`: one editor, one validator, one lock, one thing to commit.
  The cost is the schema bump and rewriting three test names, which §7 requires anyway.*
- **`server/app/locations.py`** — `_paths()` beside `_labels()`: validates each polyline (≥2 points,
  numbers, on the page, rounded to one decimal), each field, and **refuses per field** into
  `problems` like everything else. `Placed`/`Spot` gain nothing; paths are their own resolved
  structure so no existing precedence changes. `save_locations` and its atomic write are unchanged.
- **`GET /api/paths`** (new, uncached, alongside `/api/designators`) →
  `{"wires": {"W052": {"runs": [...], "geometry": "...", "attribution": "..."}}, "nets": {"120": ["W052","W053","W063","W068"]}}`.
  The `nets` map is the net → wire mapping computed from `wire.net`, which the client does not
  otherwise have. **A net stores nothing: its highlight is the union of its wires' paths** — exactly
  your "a net is just a collection of wire paths".
- **`webui/src/features/drawing/paint.ts`** — `polylineToDevice(points, viewport, dpr)` and
  `paintRuns({ctx, dpr, viewport, runs, style})`, routed through the **same** `tileDestRect`
  arithmetic as `pointToCss` so a highlight can never disagree with the tiles. `MarkerLayer`'s own
  header already prescribes this: *"149 conductor polylines… are far cheaper painted, so they will go
  into `paint.ts`."*
- **`webui/src/features/drawing/TileSheet.tsx`** — an optional `runs` prop painted in the same rAF
  pass, after the tiles and under the DOM markers. One highlighter stroke: width in **points** so it
  tracks the zoom, clamped in device pixels so it survives 11% fit, translucent, round caps, one
  colour per selection. Never more than one net or one wire at a time, per your answer 3.
- **Drawing tab** reads `appStore.selection`; **Locate tab** reads its own `target`. Deliberately not
  shared: hazard **H10** is what two coupled `window` listeners already cost us.

### Phase C — the path editor: propose, check, modify, create

*Your requirements 1, 2 and 3. Lives on the Locate tab, behind the editor password like everything
else that writes.*

- **`GET /api/conductors`** — registered only under `settings.allow_edits`, so the reader never
  downloads it. Publishes the 149 conductors reduced to what tracing needs: `id`, `points`,
  `net_label`, `color`, `gauge`, and each endpoint's bound `terminal_point` symbol and distance.
  `geometry.json` is parsed once behind an `lru_cache`, the subset kept, the rest discarded — the
  file itself never reaches the browser and never reaches the model.
- **`webui/src/features/locate/paths.ts`** — pure, unit-tested like `model.ts`:
  `candidates(wire, conductors, geometry)` returning a **ranked** list. Ranking, worst assumptions
  first: printed `net_label` equals the wire's net → `spec_label` equals its colour and gauge →
  endpoint bindings closest to the wire's two resolved terminal points → total length plausible.
  Never auto-accepts anything; **19 of 71 will come back with a single candidate and still want a
  click.**
- **The panel for a wire** (`TargetPanel.tsx`, beside the existing label controls):
  - *Requirement 1 — where information exists:* the ranked candidates, each highlighting on the
    sheet as you hover it. Click to accept. Multi-select to assemble a path from several conductors
    across a hop.
  - *Requirement 2 — check and modify:* an accepted path shows its provenance badges, its
    conductor ids and its length; **Clear**; re-pick; and drag a vertex of a hand-traced run to
    adjust it (extracted runs are not draggable — editing lifted ink would silently turn it into
    something else, so the UI makes you say so by converting it to `geometry: human` first).
  - *Requirement 3 — create where information does not exist:* **Trace**, a click-along-the-
    conductor polyline tool (click each corner, `Enter` to finish, `Esc` to abandon, `Backspace` to
    undo a corner), stamped `geometry: human` and badged as hand-drawn everywhere it appears. Offered
    **after** the proximity-ranked unlabelled conductors, so that hand-drawing is the last resort
    rather than the first tool — 79 unlabelled conductors are real ink and beat a hand trace.
- **Counts and filters.** A third toolbar count — `… · 0 of 71 wire paths` — and a **Paths** filter.
  This reverses `04_tests_labels.md` T-300's *"wires are not work"*, so it needs an explicit
  **"no path on this sheet"** state a person can set, or the count can never reach 71. That is
  exactly the **K7** mistake (six rows in *To do* that can never be finished), and it gets avoided
  deliberately this time rather than discovered later.
- **Placing terminals gets easier, which is the quiet win.** Arm net 120 on the Locate tab, see its
  four runs lit, and place `CR2:14` on the end of the conductor instead of by eye. The highlighter
  turns out to be a placement aid, and placement accuracy is what the whole project rests on.

### Phase D — the triggers

- **Ask tab hyperlink** — already works end to end: `Citation.tsx` calls
  `select(entry.kind, entry.id)` then `setActiveTab('drawing')`. A net or wire citation will now
  paint runs and the roster. No change beyond Phase A and B.
  *One thing to know:* `Citation.tsx` only makes a citation clickable when `entry.point` is
  non-null, so a net with no positioned member is deliberately dead text; that stays.
- **Locate tab list item** — arming a wire or net in the list highlights it. `target` already exists;
  the wire and net rows already exist under the *Wire & net labels* filter. Small.
- **Drawing tab net list** — a **Nets** button in the toolbar beside the Components toggle, opening a
  searchable list of the 26 nets: id, signal type, terminal count, and *"3 of 4 wires traced"* so the
  gaps are visible from the list. Clicking one calls the same `select('net', id)` the citation does —
  one code path, so the two entry points cannot drift. A toggle on the same panel switches it to the
  71 wires.

### Not in this plan, and why

- **Paths in `circuit_logic.json`** — §6. Explicitly out.
- **Net-level path storage** — a net is the union of its wires' paths. Nothing to author.
- **Highlighting more than one net at a time** — your answer 3. One at a time, one colour.
- **Auto-accepting the 17 exact net matches** — proposals only. That is the rejected guesser's
  lesson: the machine ranks, you confirm.
- **Fixing K2/H1** (whole-file save, last write wins). Out of scope, but note that this plan puts
  *more* authored work in the one file that has no version check, so the case for that fix gets
  stronger. Worth doing before a long tracing run.

---

## 10. Verification

Run at each phase boundary, from `_claude_notes/locate_tab_testing/…manual.md` §1:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

Expected today: 105 server, 119 web, ruff and tsc clean. New tests, named in the house style — one
`it` per behaviour, named for the fault it prevents:

| Where | Test |
|---|---|
| `server/tests/test_api.py` | a net entry names every member terminal, in order, undeduped, with each one's placement |
| `server/tests/test_locations.py` | a path made of a single point is refused and costs that path only · a path off the page is refused · `geometry: derived` is refused by name · the three renamed *"never a route derived from its endpoints"* tests |
| `server/tests/test_paths.py` (new) | net 120 resolves to the paths of `W052/W053/W063/W068` · a wire with no path is absent rather than null · `/api/conductors` is 404 with `allow_edits` false |
| `webui/.../paint.test.ts` | every vertex of a projected polyline agrees with `pointToCss` on the same point — the existing agreement idiom, which is what keeps one projection |
| `webui/.../paths.test.ts` (new) | `candidates()` ranks the printed-label match first · returns 2 for `W052` and does not pick one · returns the unlabelled-by-proximity list when the label matches nothing |
| `webui/.../DrawingTab.test.tsx` | selecting net 120 draws a dot for `CR2:14` and the roster says *on its component* · a net whose wires have no paths says so instead of drawing |
| `webui/.../LocateTab.test.tsx` | arming a wire and accepting a candidate writes `path.runs` and `conductors` and nothing that looks like a `point` · a hand trace writes `geometry: human` |

Note for whoever runs these: `test-setup.ts` forces `getContext('2d') → null`, so **the canvas
highlight cannot be asserted through the DOM.** It is tested as pure geometry in `paint.test.ts` plus
the runs handed to `TileSheet`. That split is deliberate and is the same one `paint.ts` already has.

Then walk it by hand, server on `localhost:9700`:

1. Ask a question whose answer cites `120`; click it. Four runs light up; the roster names all seven
   member terminals; `CR2:14` reads *on its component*.
2. `F2` to Locate, arm `W052`, accept `C0080`, watch the badge go `saved`. Paste `locations.json`
   and confirm the block has `runs` and **no** `point`.
3. Re-run nothing. `circuit_logic.json` stays current and the artifact test stays green — the proof
   that paths are display geometry.
4. Trace one wire by hand from the 19 with no candidate; confirm it is badged hand-drawn on both
   tabs.
5. Restart the server, reload: everything comes back.

Documents to update in the same change, or the next session pays for it:
`locate_tab_instruction_and_test_manual.md` (§5 state, §7 known issues, **§8 amended**),
`01_screen_and_vocabulary.md` (the highlighter stroke, the two provenance axes, the third count),
`04_tests_labels.md` (T-300 no longer stands as written; new T-36x for paths),
`06_code_map.md` (new files and symbols, and the new hazards: `geometry.json` must never reach the
browser whole, and a hand-traced path must never be silently converted), `08_results_log.md` (new
rows), and `change_history.md`.

---

## 11. Decisions I have taken for you, and how to flip them

Each is a real fork; I picked one and said why. Say the word and it changes.

| Decision | Taken | Flip it to |
|---|---|---|
| Where paths live | `locations.json`, schema 2 | a separate `paths.json` — untouched existing tests, but two authored files and two save races |
| The escape hatch for the 19 no-candidate wires | proximity-ranked unlabelled conductors first, hand trace last | hand trace those 19 directly — simpler, more hand-drawn geometry in the file |
| Paths as work | a third count, plus an explicit *no path on this sheet* state | leave them uncounted like labels, T-300 stands |
| Paths in the model's file | no | fold into `circuit_logic.json`, accepting the size and a new staleness banner |
| Editing a lifted run | must convert to `geometry: human` first | allow dragging extracted vertices in place |
