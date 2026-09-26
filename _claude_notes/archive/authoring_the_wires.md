# Authoring the wires

**Version 1 — 2026-09-06.** Written after the wires-and-nets plan shipped and using it turned up
what was underneath: **a wire's two endpoints were never read off the sheet.** This document is the
plan to execute. No code was written the session that produced it.

> **The one-sentence diagnosis.** The indexing pass read the components and the terminals and then
> *allocated* the terminal-block end of 40 wires, one screw number after another, as the `W` table
> was typed — and the manual's own rule, *"the indexing pass gets one chance to guess, and after
> that a human owns the positions"*, was never applied to connectivity. It has now been measured:
> **11 of the 71 wires land on the wrong screw, 13 more cannot be settled from the ink, and 47 are
> right.** Nothing that shipped is wrong. What was never built is an editor for the layer below it.

**How to read this.** §0 is what to read. §1 is the decisions. §2 is the diagnosis, and it corrects
the framing this plan was handed. **§3 is the census — measured numbers, and the reason the scope is
not a guess.** §4 answers the eleven questions. §5 is the rollback answer. §6–§8 are the file, the
screens and the migration. §9 is the phases in build order, §10 the verification, §11 the documents
to deliver, §12 what was decided on your behalf and how to flip each one, §13 the sessions with an
honest stopping point after each, and **§14 what you have to author by hand and what it will cost
you.**

---

## 0. Before you start — read this, then §1

**You are a fresh session. Read, in this order:**

1. this document, whole;
2. `_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md` — the index, whole.
   **§5a** is what is in the files, **§7** the known issues, **§8** the rule about routes;
3. `_claude_notes/locate_tab_testing/06_code_map.md` — behaviour → file and symbol, and the hazards
   `H1`–`H22`. Read it before writing anything;
4. `_claude_notes/locate_tab_testing/07_drawing_facts.md` — the real ids and coordinates. **Note the
   correction §4 question 10 makes to its `W063` row.**

**Do not read `geometry.json` (620 KB, ~150,000 tokens) or `circuit_logic.json` in full.** Every
number in §3 was got with a `python3 -c` one-liner that printed a summary, and §3 exists so you do
not have to re-derive it.

**Running it:**

    cd /home/js/schematics/server && .venv/bin/python -m app     # then http://localhost:9700/webui/

Editor password `edit-1234` (`SWUI_EDITOR_PASSWORD` in `server/.env`). Three facts that have each
cost a session: **no `SWUI_ALLOW_EDITS=true`, no Locate tab and no Review tab**; **`python -m app`
has no reloader**; **the client is a built bundle** (`cd webui && npm run build`).

**Start from green, and know what "green" means here.** Measured 2026-09-06: **171 server passing
with `test_the_committed_artifact_is_exactly_what_the_generator_writes` red · 318 web · ruff clean ·
tsc clean.** That one red test is **`K6` doing its job** — `locations.json` is ahead of
`circuit_logic.json` — and it clears with one command, which is a human's by design:

    cd schematic_extraction/PS20115MLM4-2/extracted_docs && python author_circuit_logic.py

Clear it **first**, so you can tell your own breakage from the inherited kind. **Any other red test
in a session that has written no code means something else is wrong — say so loudly.**

**One caution about the tree as this plan was written.** `TB-120:3` was moved in the editor at
2026-09-07T03:04Z from **(300.1, 663.7)** to **(111.5, 625.5)** — 190 pt off the block's own column,
which is `K8`'s shape rather than a placement. **Every number in §3 was measured against the
committed value, (300.1, 663.7)**, which is the one the ink agrees with: `C0080` lands there and it is
`W053`'s run. If that point is still at (111.5, 625.5) when you read this, it wants putting back
before anything else — `git diff` on `locations.json` names it exactly.                                                                            


**Build one session only.** §13 is the schedule. The user walks the lessons between sessions and the
next phase assumes they have.

---

## 1. The decisions on record

| | Decision | Consequence |
|---|---|---|
| **1** | **A wire's two endpoints are authored, in a fourth authored file — `wiring.json`.** They are a claim about *what connects to what*, not about where something is drawn, and unlike a path they **must** make `circuit_logic.json` stale. | §6. `author_circuit_logic.py` reads it the way it already reads `locations.json`, and the `W` table's `from`/`to` columns stop being the source. |
| **2** | **Wire ids stop being positional. Every record carries an explicit `id`, the present 71 are frozen at their current values, and an id is never reused.** | §8. **The 58 authored paths need no migration**, because no id moves. Freezing happens in **Phase 0, before any wire is added.** |
| **3** | **The wires get reassigned; the point numbering does not move.** Confirmed by you 2026-09-06: *no numbers are printed anywhere* — not on the sheet, not on the part. And §3.4 proves numbering and assignment are **not** one degree of freedom. | **48 placed `TB-*` points and 111 end-label overrides stay exactly where they are. No migration.** |
| **4** | **Nothing is confirmed without you, and every wire starts unconfirmed.** *"Author all 71 from nothing"* — chosen by you 2026-09-06 over a cheaper option. An endpoint carries `source: index` until a person sets it, exactly as a component point did. | The queue reads **`0 of 71 wires confirmed`** on the first run. The app keeps working throughout, because the generator falls back to the index's value — the same way it did through the 131-point placement run. |
| **5** | **A wire's `net` stops being stored and becomes derived from its two endpoints.** Net membership already comes from each terminal's own `net` field; a wire's copy is a third statement of the same fact and is what would silently go stale when an endpoint moves. | §6. A wire whose two ends sit on different nets is **flagged, not fixed** — sometimes it is correct (`DISC1`, `CB1`) and sometimes it is the finding (`W019`). |
| **6** | **A terminal block's commoning is authored, and a net's highlight includes it.** Asked for by you 2026-09-06: *"these vertical lines are the block's own commoning, but when we highlight a net the commoning needs to be highlighted too — this will make it easier to see the net."* | §6, Phase C. **8 conductors across 7 blocks**, measured in §3.6. They are **not** wires and do not enter the netlist. |
| **7** | **Clicking a terminal means two different things on two different tabs.** On the **Locate** tab it places or moves a marker, exactly as now. On the **Drawing** tab it highlights every wire attached to it — a reader's question, on the reader's tab, with no password. | §7. That is the same resolution `K9`/T-610 used for nets, and it keeps `H10`'s collision from getting a third occupant. |
| **8** | **Nothing rolls back.** §5 says why, and it is a stronger reason than the four this plan was handed: **the census in §3 could not have been measured without every phase that shipped.** | The repair is a correction to five sentences (§4 q11) and one fixture (§4 q10), plus a new authoring screen. |

---

## 2. What is really wrong, and a correction to the framing

### 2.1 The diagnosis

`EXTRACTION_NOTES.md` *"Inferences"* §2 says the terminal-block point numbers are ours, assigned
*"in drawing order top to bottom"*, and admits *"`TB-0V` is modelled with 12 points; the exact
physical count is not determinable from the sheet."* What it does not say — and what is the whole of
this project — is that **the far end of each of those wires was allocated rather than read.** Taking
each block's points in ascending order and listing the wire on each, 17 of 19 blocks come out in
ascending wire-declaration order. That is not a numbering convention showing through. That is a
counter being incremented.

**OCR never had anything to do with it.** The PDF has no embedded text; the 71 wires were written
into the `W` table by a vision pass reading the 400 DPI tiles. For the 40 wires that land on a
multi-point block, the block end was not read even by that.

So this is **the same failure as the component positions, one layer up** — a guess presented as a
fact, in a file nothing checks. The cure is the one this project already lives by.

### 2.2 The framing this plan was handed, corrected in three places

The session that wrote `claude.md` measured a great deal and got most of it right. Three things in
it are wrong, and each changes what the fix is:

**(a) *"The terminal-block point numbers and the wire assignments are one degree of freedom … only
my eyes on the paper can tell the two apart."* — No. The data can, and it does.** See §3.4: no
permutation of `TB-0V`'s twelve numbers can make the present assignments correct, because `W062` and
`W067` both claim `TB-0V:12` while the ink puts them on two different rows — one id would have to
mean two rows at once. The same contradiction sits at `TB-120:2`. **Renumbering cannot be the fix
even in principle.** Combined with your answer that no numbers are printed anywhere, question 3 —
*"the hardest question here"* — is settled by measurement, and 48 placed points do not move.

**(b) *"`W019` is … an invented edge — a wire that does not exist."* — It exists; its far end is on
a different block.** The ink runs `PS1:-2` to **`TB-GND-B:2`** as conductor `C0056`, 242 pt, whose
printed net label was read as `"GND`. So `W019` is a **0 V-to-ground bond**, not a phantom. That
matters twice: it is a wrong *endpoint* like the other ten rather than a new class of defect, and it
is the wire whose correction **changes its net** (0 V → GND), which is why decision 5 stops storing
a wire's net. It also explains your count: thirteen wires reach `TB-0V` in the netlist and you can
see **twelve** on the sheet. Move `W019` off the block and it is twelve.

**(c) *"`W063`'s block end may have been measured against the wrong pin, and if so the fixture, the
table and the manual are all built on it."* — Half right, and better than feared.** `W063` does
land on `TB-120:1`, not `:2`. But the vertical `C0092` that `07_drawing_facts.md` calls *"the second
piece of `W063`'s L"* is not part of any wire at all — **it is `TB-120`'s commoning**, which is why
it carries no printed label. So the correction is: `W063` is **one** run, `C0091`, ending at
`TB-120:1`; `W068` is unaffected and stays the plan's worked example. `paths.test.ts` keeps passing
either way (§4 q10) — one fixture coordinate and two comments are what is actually wrong.

### 2.3 And one thing the framing got exactly right

> *"You built the editor that made the wrong data visible. What was never built is an editor for the
> layer below it."*

Every number in §3 was measured against **131 human-placed points**, **654 human review decisions**
and **149 conductor polylines published by `/api/conductors`**. None of those existed six weeks ago.
The instrument found the bug; that is what an instrument is for.

---

## 3. The census — measured 2026-09-06

**Method, so it can be re-derived rather than trusted.** For every one of the 149 conductor
polylines, the perpendicular distance from each of the 131 human-placed terminal points to the
polyline, and the arc-length position of that projection. A conductor **lands on** a terminal when
the point is within **4 pt** of the ink and within **30 pt of an end** of the run; the nearest
candidate to the actual endpoint wins. Unterminated ends within 6 pt of each other are joined — that
is a corner or a crossover hop — and a run is followed through junctions of degree 2 until it
reaches a second terminal. Against **16 pt conductor rows**, 4 pt of perpendicular error cannot
reach the wrong row.

One refinement matters and it is the difference between a right answer and a wrong one: **a block's
commoning line is fused into some wire polylines.** `C0105` is a single conductor containing both
`DISCHARGE1:2`'s wire *and* the whole 279.6 pt vertical of `TB-0V`'s commoning, so its *endpoint*
sits at row 1 while the wire actually joins the block at row 12. Landings are therefore read at the
point a run **leaves** the commoning geometry, not at the polyline's end. Reading endpoints naively
mis-assigns four wires.

### 3.1 The headline

| | |
|---|---|
| Wires | **71** |
| **Confirmed by the ink — the netlist's two pins are the two the drawing joins** | **47** |
| **Provably wrong — the ink joins one of the pins to a different one, and names which** | **11** |
| **Unresolved — the ink does not bind one or both ends, so only a person can say** | **13** |
| Wires that touch a **multi-point** block, and so *could* carry this defect | **40** |
| Wires that touch only a single-point block, or none — **cannot** be wrong this way | **31** |

Of the **40**: **21** confirmed, **11** wrong, **8** unresolved. Of the **31**: **26** confirmed by
the ink, **5** the ink cannot chain (`W002`, `W003` — `PLG1`'s runs, which parallel `PLG2`'s onto the
same terminal; `W038`, `W041` — the push-button spares; `W048`, whose `C0079` stops 46 pt short of
`CR-BP:A2`). **None of the 31 can carry a screw-number error**, which is the boundary the previous
session drew and it is right.

### 3.2 The eleven with a provable correction

The ink names the pin. Every one touches a `TB-*` point, exactly as predicted.

| Wire | The netlist says | The ink says | Conductor | Also on your list of 13? |
|---|---|---|---|---|
| `W014` | `TB-GND-B:2` → `PS1:GND` | **`TB-GND-B:1`** | `C0046` GREEN 12AWG | yes |
| `W018` | `PS1:-1` → `TB-0V:1` | **`TB-0V:3`** | `C0001+C0012+C0002` | yes |
| `W019` | `PS1:-2` → `TB-0V:2` | **`TB-GND-B:2`** — a different block; net 0V → **GND** | `C0056` | yes |
| `W036` | `SPD1:2` → `TB-0V:3` | **`TB-0V:2`** | `C0122` WHITE/BLUE 18AWG | yes |
| `W037` | `TB-0V:4` → `RECEPT1:4` | **`TB-0V:1`** | `C0084` WHITE 18AWG | yes |
| `W039` | `PB1:3` → `TB-0V:5` | **`TB-0V:4`** | `C0031` BLUE 22AWG | yes |
| `W045` | `CR1:A2` → `TB-0V:8` | **`TB-0V:5`** | `C0023` WHITE/BLUE 18AWG | yes |
| `W046` | `CR2:A2` → `TB-0V:9` | **`TB-0V:7`** | `C0011` WHITE/BLUE 18AWG | yes |
| `W062` | `INFEED1:2` → `TB-0V:12` | **`TB-0V:10`** | `C0114` GREEN 16AWG | yes |
| `W063` | `INFEED1:3` → `TB-120:2` | **`TB-120:1`** | `C0091` RED 16AWG | yes |
| `W069` | `DISCHARGE1:4` → `TB-130:2` | **`TB-130:1`** | `C0117+C0017` ORANGE 16AWG | yes |

**Every one of the eleven is on your list of thirteen.** Your remaining two — `W044` and `W050` —
are in §3.3, because the ink shows another wire on the pin they claim but does not say where they go
instead. **Your eye and the ink have not disagreed once.**

### 3.3 The thirteen the ink cannot settle

These need you, and for most of them a conductor with the right printed colour and gauge exists to
propose.

| Wire | Why the ink is silent | The candidate ink |
|---|---|---|
| `W044` `LT1:BLUE` → `TB-0V:7` | `TB-0V:7` is `CR2:A2`'s. Must move to `:8`, `:9` or `:11` | `C0006`-class, BLUE 22AWG |
| `W050` `TB-0V:10` → `CR1:11` | `TB-0V:10` is `INFEED1:2`'s. Must move to `:8`, `:9` or `:11` | `C0094`, `C0020` |
| `W057` `TB-0V:11` → `CR-SW:11` | no ink reaches `:11` | `C0020` WHITE/BLUE 18AWG |
| `W024` `TB-24E1-A:6` → `CR-ON:A1` | three coil feeds, one bound landing | `C0099` BLUE 12AWG |
| `W025` `TB-24E1-A:7` → `CR-BP:A1` | ditto | ditto |
| `W026` `TB-24E1-A:8` → `CR-SW:A1` | ditto | ditto |
| `W049` `CR-SW:A2` → `TB-130:1` | `:1` is `DISCHARGE1:4`'s. `TB-130` has **2 points and 3 wires** | `C0100` |
| `W031` `TB-24E1-B:5` → `RECEPT1:5` | `C0008` is both this wire and part of `TB-24E1-B`'s commoning | `C0008+C0125+C0104+C0082` |
| `W042` `PB2:3` → `TB-0V:6` | **the drawing's own error, which you spotted**: the run stops at the west side of the block instead of reaching the commoning line. The netlist is **right** | `C0006` BLUE 22AWG |
| `W002` `PLG1:W` → `TB-N:1` | `PLG1` and `PLG2` land on the same terminal; the binding resolves to `PLG2`'s run | `C0118` WHITE 10AWG |
| `W003` `PLG1:G` → `TB-GND-A:1` | ditto | `C0029` GREEN 10AWG |
| `W038` `PB1:2` → `TB-PB1SP:1` | far end unbound | `C0141` WHITE 22AWG |
| `W041` `PB2:2` → `TB-PB2SP:1` | far end unbound | `C0142` WHITE 22AWG |

`W042` is worth reading twice: **the ink is silent because the drawing is wrong, and the data is
right.** That is the one case in the whole census where a proposal from the ink would have made
things worse, and it is why nothing may be accepted automatically.

### 3.4 The proof that renumbering cannot be the fix

`TB-0V` today: `W062` (`INFEED1:2`) and `W067` (`DISCHARGE1:2`) **both** claim `TB-0V:12`. The ink
puts `INFEED1:2` on the row at y = 432.6 and `DISCHARGE1:2` on the row at y = 546.9 — 114 pt apart,
seven landings apart. For the present assignments to be correct under *some* renumbering, the id
`12` would have to name both rows. `TB-120` is the same shape: `W063` and `W068` both claim
`TB-120:2` and the ink puts them on y = 563.4 and y = 639.6.

**So the numbering and the assignment are not one degree of freedom.** They would be if the mapping
were a permutation, and it is not — it is many-to-one, and the ink's many-to-one is a different one.
Add your answer that nothing is printed on the sheet or the part, and there is no third party for a
numbering to be wrong *against*: the ids name 48 landings a person placed. Measured, and worth
recording because it is what makes decision 3 safe:

| Block | Points | Distinct coordinates | Ordered top-to-bottom in y? |
|---|---|---|---|
| `TB-0V` | 12 | **12** | **yes** |
| `TB-24E1-A` | 8 | **8** | **yes** |
| `TB-24E1-B` | 5 | **5** | **yes** |
| `TB-110` | 4 | **4** | **yes** |
| `TB-120` | 3 | **3** | **yes** — at the committed coordinates; see §0's caution about `TB-120:3` |
| `TB-130` | 2 | **2** | **yes** |
| `TB-GND-B` | 2 | **2** | **yes** |

All 48 are `source: human`, all monotonic, none duplicated. The convention
`EXTRACTION_NOTES.md` claimed is the convention you placed.

### 3.5 `TB-0V`, all twelve rows — and your count confirmed

You said *"twelve wires go to TB-0V; eleven reach the vertical commoning line and the sixth from the
top only touches the west side, which is a mistake on the drawing."* Both halves check out exactly.

| Point | y | The ink lands | The netlist claims | |
|---|---|---|---|---|
| `:1` | 265.5 | `RECEPT1:4` `C0084` | `PS1:-1` | → `W037` |
| `:2` | 282.0 | `SPD1:2` `C0122` | `PS1:-2` | → `W036` |
| `:3` | 298.6 | `PS1:-1` `C0002` | `SPD1:2` | → `W018` |
| `:4` | 315.0 | `PB1:3` `C0031` | `RECEPT1:4` | → `W039` |
| `:5` | 331.6 | `CR1:A2` `C0023` | `PB1:3` | → `W045` |
| `:6` | 364.3 | **nothing — the run stops short** | `PB2:3` | **`W042`, and it is right** |
| `:7` | 381.3 | `CR2:A2` `C0011` | `LT1:BLUE` | → `W046` |
| `:8` | 399.6 | nothing | `CR1:A2` | one of `W044`/`W050`/`W057` |
| `:9` | 415.9 | nothing | `CR2:A2` | one of `W044`/`W050`/`W057` |
| `:10` | 432.5 | `INFEED1:2` `C0114` | `CR1:11` | → `W062` |
| `:11` | 449.1 | nothing | `CR-SW:11` | one of `W044`/`W050`/`W057` |
| `:12` | 546.7 | `DISCHARGE1:2` `C0105` | `INFEED1:2` **and** `DISCHARGE1:2` | **`W067`, and it is right** |

Twelve rows, twelve wires: nine named by the ink, three (`W044`, `W050`, `W057`) to be assigned to
rows 8, 9 and 11 by you, and `W019` off the block entirely. **The count of 12 was right all along** —
`EXTRACTION_NOTES.md`'s admission that it *"is not determinable from the sheet"* is now answerable
and the answer is twelve.

### 3.6 The commoning — 8 conductors, 7 blocks

Every one of these is a conductor between two points of the same block that no wire claims. You
identified them: the block's own commoning, not field wire.

| Block | Conductor | Covers points | Length |
|---|---|---|---|
| `TB-0V` | `C0105` (fused with `DISCHARGE1:2`'s wire) | 1–12 | 279.6 pt of vertical |
| `TB-24E1-A` | `C0086` | 1–8 | 527.5 |
| `TB-24E1-B` | `C0010` | 1–3 | 31.4 |
| `TB-24E1-B` | `C0008` (fused with `RECEPT1:5`'s wire) | 3–5 | 376.1 whole |
| `TB-110` | `C0060` | 2–3 | 12.8 |
| `TB-110` | `C0077` | 3–4 | 11.1 |
| `TB-120` | `C0092` | 1–2 | 72.7 |
| `TB-GND-B` | `C0041` | 1–2 | 10.9 |

**`C0105` and `C0008` are the awkward two**: one polyline that is partly a wire and partly commoning,
because the extractor splits a conductor only at a crossover hop and a T-junction is not one. Phase C
has to be able to say *"this conductor is commoning from here to here"*, which means a commoning
record stores its own polyline like a path does, not just a conductor id. §6 says how.

`TB-130` and `TB-120:3` have **no commoning conductor at all** — `TB-130`'s two points are 71 pt
apart with nothing joining them, and `TB-120:3` is 24 pt below `:2` off the end of `C0092`. Worth
your eye during the run; it may be a third landing rather than a separate point.

### 3.7 Missing wires — the honest answer is *almost none*

You asked for a way to tell whether a wire exists where you clicked. The count you were expecting to
be large is small:

| | |
|---|---|
| Runs of ink joining two placed terminals that **no** wire claims | **18** |
| ...of which are a block's own **commoning** (§3.6) | **8** |
| ...of which are the **corrected route of a wire that already exists** (§3.2) | **10** |
| **Genuinely missing field wires** | **0** |
| Conductors in no terminal-to-terminal run at all | **76** of 149 |
| ...of those, ≥ 15 pt long | **39** |
| ...of those, carrying a printed colour and gauge — *what the sheet writes beside a wire* | **11** |
| ...of those 11, matching the colour+gauge+net of a wire that already exists | **10 of 11** |

The single exception is `C0115` (BLUE 16AWG, 362 pt, no printed net name), which is a middle piece of
either `W059` or `W061`'s route rather than a wire of its own. The other 28 residual conductors over
15 pt carry no spec and are symbol strokes: `DISC1`'s three internal poles (`C0024`, `C0032`,
`C0033`, 15.4 pt each), the two `NOT CONNECTED` stubs on `LT1`, earth symbols, and label leader
lines.

**So the thing that looked like *"wires on the sheet that are not in our data"* is mostly the eleven
wrong screws.** A wire drawn to `TB-0V:1` that the data puts on `TB-0V:4` is invisible at row 1 and
wrong at row 4, and clicking row 1 reasonably looks like *there is no wire here.* Once the eleven are
corrected, the only unclaimed ink is the commoning — which is why Phase C matters more than a
missing-wire hunt would have.

### 3.8 What is *not* broken

The path editor, the highlighter, `/api/conductors`, the ranking, the Review tab's 654 decisions, the
net highlight, the placement editor and its 131 points. §1's decision 8 and §5.

---

## 4. The eleven questions, answered

### q1 — Where does a corrected or new wire live?

**A fourth authored file, `wiring.json`, beside `locations.json` and `label_corrections.json`, folded
in by the generator.**

`label_corrections.py`'s docstring is the project's own argument for when a new file is right, and it
gives three reasons. Run them against wires and **two of the three hold, and the one that fails does
not matter:**

- *"It keys on a different id space."* **Fails** — a wire record keys on `W###` and terminal
  designators, the same space `locations.json` uses. This is the reason to fold in, and it is the
  weakest of the three.
- *"It is written from a different screen."* **Holds.** A wiring run and a placement run are
  different sittings, and folding in would widen the `K2`/`H1` whole-document-save window across two
  more workflows. `label_corrections.json` bought its separation with exactly this argument.
- *"It is a different claim."* **Holds, and it is decisive.** `locations.json` has never made a
  connectivity statement. Every rule in this project that keeps a highlight honest — §8's *"a route
  is never computed"* above all — depends on *where a thing is drawn* and *what it connects to* being
  two claims a person makes separately. A file that holds both cannot tell you which one you
  changed.

And a fourth reason `label_corrections.json` did not need, which settles it:

- **Regeneration.** A path must **not** make `circuit_logic.json` stale and an endpoint **must**.
  That is the difference between display geometry and netlist content, and it is `K6`'s whole
  meaning. If both live in `locations.json` then *"do I need to re-run the generator?"* depends on
  which key you touched, and the stale banner would have to diff the file to know. Two files, and the
  rule is one sentence each: **touch `wiring.json`, re-run the generator; touch `locations.json`,
  don't.**

**Not the `W` table.** It stays as the home of what was *read off the printed callouts* — colour,
gauge, cable, note — because those are readings of the ink and this plan is not reopening them. What
leaves it is `from`, `to` and `net`.

**One asymmetry to build in deliberately.** `read_locations()` tolerates a broken file with a
warning, because *"a broken locations.json must not stop the netlist being written."* **`wiring.json`
must do the opposite and fail loudly**: a missing point degrades a drawing, a missing endpoint
changes what the model says connects to what. That difference is worth a test named after it.

### q2 — How does a wire get an id that survives an insertion?

**An explicit `id` on every record; the present 71 frozen at their current values; ids never reused.**

The two alternatives both fail:

- **Freeze and append only** is not an id scheme, it is a promise not to exercise the bug. It also
  forbids ever *removing* a wire, and `W019` came within one measurement of needing removal.
- **Key a wire on its endpoint pair** fails on the data as it stands. `TB-0V:12` carries two wires
  today (`W062`, `W067`); so do `TB-RUN:1` (`W054`, `W055`) and `TB-24E1-B:1` (`W020`, `W027`);
  `PLG1`/`PLG2` land in pairs on `TB-L1:1` and `TB-N:1`. Worse, the key would change under the exact
  operation this plan exists to perform — correcting an endpoint would rename the wire and orphan its
  path.

**Consequence for the 58 paths: no migration.** Every path keys on `W###`, every `W###` keeps its
present meaning, and Phase 0 is the commit that makes that permanent *before* anything is inserted.
The test that guards it is a one-liner and it is the acceptance criterion of Phase 0:

> `wiring.json`'s 71 records, read in id order, reproduce the `W` table's endpoints exactly, and the
> generator's output is **byte-identical** with and without the file present at that moment.

New ids are allocated from **`W072`** upward, monotonically, and a retired wire leaves a tombstone
(`"retired": "<reason>"`) rather than a hole, so a stale path or a stale citation gets an answer
rather than silence — the same reasoning that keeps `was` on a label correction forever.

### q3 — Numbering or assignment?

**Assignment. The numbering does not move, and this is no longer a judgement call.** §3.4 is the
proof and §2.2(a) is the correction to the framing. Your answer that no numbers are printed anywhere
removes the only reason renumbering could have been owed.

**So: 48 placed `TB-*` points stay, 111 end-label overrides stay, and nothing migrates.** This was
billed as the hardest question in the plan and it turned out to be the one the measurement answered.

### q4 — What does *create a wire* look like on screen?

**A mode on the Locate tab, not a new tab.** Three reasons: the 131 terminals are already on that
sheet and already armable from that list; the ranked-proposal panel is `PathPanel`'s shape and
`candidates()`'s shape, both built and tested; and confirming a wire's two ends and accepting its
route are one act in one sitting — a fifth tab would split it across two screens and two selections.

**The screen.** A sixth toolbar filter, **`Wiring`**, beside `Paths`, and a queue that reads
`n of 71 wires confirmed`. Arm a wire and the panel shows:

- **two end slots**, each naming the terminal it currently holds and **where that came from** —
  `from the index` (a guess) or `you, on 2026-09-07`. This is the `placed` / `estimate` /
  `on its component` vocabulary already in `PLACEMENT_LABEL`, and it should reuse it;
- **what the ink says**, per end: *`TB-0V:3` — `C0002`, WHITE/BLUE 12AWG, net `0V`, both ends within
  1 pt*, with the same tag words the path panel uses (`both ends`, `one end`, `printed name`,
  `spec`, `nearby`). One click accepts the ink's reading into the slot;
- **`Pick from the sheet`** per end, which arms that slot so the next terminal click binds it;
- **the two ends' nets**, side by side, and a **flag** where they differ — never a fix. `W019`
  corrected reads `0V` at one end and `GND` at the other and that is the finding, not an error;
- **`Add a wire`**, which creates a record with both slots empty at the next free id, and
  **`Retire this wire`**, which tombstones one.

**What a wire needs besides its two ends.** Colour, gauge, cable and note stay in the `W` table —
they were read off printed callouts and nothing here changes them. **The net is not authored at
all**: decision 5 derives it from the endpoints' `net` fields, which is where net membership already
comes from. That removes the third copy of the same fact, which is the copy that would have gone
silently stale when an endpoint moved — and it is what makes `W019`'s correction visible instead of
quiet.

**Nothing is ever accepted automatically**, not for the 47 wires the ink confirms and least of all
for `W042`, where the ink is wrong and the data is right. That is the same rule Session 6 wrote for
paths and the same reason.

### q5 — How do the two meanings of clicking a terminal stay apart?

**They live on two tabs, and within the editor a slot must be armed first.**

- **Drawing tab** — clicking a terminal **highlights every wire attached to it** (q7). A reader's
  question, on the reader's tab, no password, no draft, nothing to move. Clicking a terminal there
  already selects it, so this is a change to what the selection *paints*, not to what the click
  *means*.
- **Locate tab** — a click on the sheet still places or moves the armed point, unchanged, **unless an
  end slot is armed**, which only `Pick from the sheet` can do. Then the next terminal click fills
  that slot and disarms it. Two modal states, one already exists (`placing`), and the badge and the
  crosshair say which you are in.
- **`Escape` takes the slot before the row**, exactly as it takes a trace before the row (`H22`).
  Three `window` key listeners become three with one more guarded state; **`H10` gains a paragraph
  and no new occupant.**

`K5` — *you cannot place a point under an existing dot* — is untouched and stays a design question.
It gets slightly less painful here, because in wiring mode the dot you want to hit is the thing you
are aiming at rather than the thing in the way.

### q6 — How does the sheet answer *is there a wire here*?

**Yes, and it is buildable on what exists — with one server change.**

`/api/conductors` already publishes all 149 polylines with their `points`, `net_label`, `spec_label`,
`color`, `gauge` and `length`. A click hit-tests them in **point space** through the same
`tileDestRect` projection every marker uses (invariant 2 — one projection, no second one), picks the
nearest polyline within a few points, and the card says: **`C0059`, RED 16AWG, printed `120`** and
then one of

- *claimed by `W063`* — from a reverse index over the 58 (soon 71) paths' `conductors` lists;
- *`TB-120`'s commoning* — from the Phase C records;
- ***no wire claims this run.***

**The server change**: `GET /api/conductors` sits behind the editor password today, because Session 6
built it for the path editor. *Is there a wire here* is a **reader's** question, so it needs the
treatment `GET /api/paths` already got — free of the password, on the argument in hazard `H20`. That
is the only server work this phase needs, and it needs a restart.

**One honesty requirement.** Until the authoring run is finished, *"no wire claims this run"* will be
the answer for around 90 of the 149, most of them label leaders and symbol strokes. The card must say
**how many wires have a route yet** beside the verdict, or the feature will teach a false fact on its
first use. `PathSummary` already carries `wires` and `traced` for exactly this reason.

### q7 — A terminal's wires, highlighted

**Confirmed: `pathsFor` is nearly all it takes, plus one reverse index.**

`pathsFor(index, kind, id)` returns `null` for anything that is not a wire or a net — deliberately,
and the docstring explains why. Extending it:

- a third case, `kind === 'terminal'`: the wires whose endpoints include that terminal, the union of
  their runs, **plus the commoning of that terminal's block** (decision 6), with the same
  `geometry`/`attribution`/`mixed` collapsing it already does;
- the reverse index — **terminal → wires** — does not exist in the payload. `/api/designators`
  publishes `terminals` on each wire and net, not wires on each terminal. It is one pass over the
  wire entries the client already has, so it belongs in `lib/designators.ts` beside
  `readerRowState`, not in a new endpoint. **No server change for this one.**

**And this is the feature that makes a missing wire visible by its absence** — which only works once
the wires are authored, so it is the *verification instrument* for the authoring run rather than a
prerequisite for it. Build it before the run, use it during, and expect it to find things §3 could
not: `TB-130`'s missing commoning and `TB-120:3` are the two I would look at first.

### q8 — The census

**§3.** Measured, not estimated: **47 confirmed · 11 provably wrong · 13 unresolved · 0 missing
field wires · 8 commoning conductors to author.** The scope is not a guess, and it is smaller than
the framing feared: the previous session's *"assume all 40 need a human look"* is right as a policy
and wrong as an estimate of the damage — 21 of the 40 are confirmed by the ink.

### q9 — What of the 58 paths survives a correction?

**The rule: a path is a claim about ink, the ink has not moved, and a path survives unless the
correction moves the end it reaches.** Measured against the file:

| | |
|---|---|
| Wire records in `locations.json` | **62** |
| ...with a `path` | **58** (42 `extracted`, 16 `human`; 56 one run, 2 two runs) |
| ...marked `no_path_on_this_sheet` | **0** |
| Wires with **no** path at all | **13** |
| **Paths on a wire §3.2 proves wrong** | **0** |
| Paths on a wire the ink cannot chain end to end | **14** |

**Zero of the 58 paths is invalidated**, and the reason is worth stating plainly: **you authored no
path for any of the thirteen wires you flagged.** `W014`, `W018`, `W019` and `W063` have a record and
no path; `W036`, `W037`, `W039`, `W044`, `W045`, `W046`, `W050`, `W062` and `W069` have no record at
all. The census then found two more wrong-looking wires you had not flagged (`W031`, `W067`) — and
`W067` turned out to be **right** once the commoning fusion was accounted for. Your judgement about
which wires not to trust was correct thirteen times out of thirteen.

**How a person is told which paths to re-check.** Do not re-derive it and do not ask the person to
remember: **stamp each path with the endpoints it was authored against.**

    "path": { "runs": [...], "conductors": ["C0091"], "geometry": "extracted",
              "attribution": "human", "for": ["INFEED1:3", "TB-120:1"], "by": "js", "at": "..." }

`for` is written by the editor at save time and is true by construction for the 58 that exist —
Phase 0 back-fills it from the `W` table, which is exactly what the panel was showing when each was
accepted. Then the row state gains one word, **`path may be stale`**, whose predicate is one
comparison, and the `Paths` filter can show them. One field, one predicate, no re-authoring, and it
keeps working for every future correction rather than just this batch.

### q10 — The four measured pairings and their fixtures

`07_drawing_facts.md` §*"Which conductor belongs to which wire"* carries four pairings measured
2026-09-02, and `paths.test.ts` turned all four into fixtures whose header calls them *"the
acceptance criterion for the whole phase"*. Here is exactly what happens to each:

| Pairing | Verdict |
|---|---|
| `W052` → `C0109` | **untouched.** `CR2:14` → `TB-120:1`, both ends within 4 pt. Confirmed by §3. |
| `W053` → `C0080` | **untouched.** `TB-120:3` → `BYPASS-CB:1`. Confirmed. |
| `W068` → `C0081 + C0057` | **untouched, and it stays the plan's worked example.** `DISCHARGE1:3` → `TB-120:2` across the 3.5 pt hop at x ≈ 428. Confirmed. |
| `W063` → `C0091 + C0092` | **wrong, in two ways.** The wire ends at **`TB-120:1`**, not `:2`; and `C0092` is not the second half of an L — it is **`TB-120`'s commoning**, which is why it carries no printed label. `W063` is **one run, `C0091`.** |

**What actually has to change, and it is less than it sounds:**

- `paths.test.ts`: the `W063` fixture's second endpoint, `['TB-120:2', [300.1, 639.6]]` →
  `['TB-120:1', [300.1, 563.3]]`; the file header's `W063` line; and the name of the test
  *"offers `C0091` and `C0092` for `W063`"*.
- **The ranking does not change and nothing goes red for the right reason.** Both of that test's
  assertions still hold after the correction — `C0091` ranks first *more* strongly, because it now
  reaches **both** of `W063`'s pins instead of one, and `C0092` stays in the candidate list because
  it is still near `TB-120:1`. That is a trap: a fixture can be corrected carelessly here and the
  suite will not notice. **So add the assertion that carries the finding**: *`C0092` is `TB-120`'s
  commoning and no wire may claim it.* Then the fact is executable rather than a comment.
- `07_drawing_facts.md`: the `W063` row, and the sentence under the table claiming *"the second half
  of a real path is routinely a conductor with no printed net label (`C0092`, `C0057`)"*. **`C0057`
  still makes that point and `C0092` never did** — a commoning line has no printed name because it
  is not a wire. The argument survives on one example instead of two, and it is the better one.
- **T-910 stands as the acceptance criterion**, and the manual's §note that the ranking reproduces
  the table stays true once the table is corrected.

### q11 — The sentences that are now too confident

*"The netlist is already right"* appears in **six** places, and `EXTRACTION_NOTES.md`'s inference §2
is the seventh. Correct each **in place, with the reason**, the way the `W052`/`C0080` pairing was —
a wrong fact in a document the next session reads is how nine days went by last time.

| File | Line | What it says |
|---|---|---|
| `_claude_notes/highlighting_wires_and_nets.md` | §*Not in this plan* (~874) | *"The netlist is already right; a test asserts the generator ignores the file."* |
| `_claude_notes/highlighting_wires_and_nets.md` | ~808 | *"...is already right and nothing here changes it."* |
| `_claude_notes/locate_tab_testing/06_code_map.md` | ~736 (invariant 6) | *"the netlist is already right"* |
| `_claude_notes/locate_tab_testing/12_tests_label_corrections.md` | ~43 | *"The netlist is already right — 26 nets, 131 terminals..."* |
| `_claude_notes/locate_tab_testing/locate_tab_instruction_and_test_manual.md` | ~79 (§2a) | *"...never the netlist, which is already right"* |
| `_claude_notes/review_tab_questions.md` | ~285 (Fact 1) | *"`circuit_logic.json` was already right"* |
| `server/tests/test_review.py` | ~506 (docstring) | *"The netlist is already right — §2 of the plan measured it"* |
| `EXTRACTION_NOTES.md` | Inferences §2 | *"Point numbers are assigned in drawing order top to bottom. `TB-0V` is modelled with 12 points; the exact physical count is not determinable from the sheet."* |

**The replacement, one sentence, used verbatim in all seven:**

> The netlist has **no duplicates** — 26 nets, 131 terminals, 47 components, no twins — and §2 of
> `highlighting_wires_and_nets.md` measured that correctly. **What it never checked is whether a
> wire's two endpoints are the two the sheet joins, and 11 of the 71 are not**
> (`_claude_notes/authoring_the_wires.md` §3). It was checked for twins and not for truth. Nothing on
> the `Review` tab changes the netlist, which is what these tests assert and is still exactly true.

Note what the correction **preserves**: every claim about the *Review* tab not touching the netlist
is unaffected — `T-740` compares bytes and is still right. The sentence was doing two jobs and only
one of them was false.

And `EXTRACTION_NOTES.md` gets an answer rather than a hedge: **`TB-0V` has twelve landings, counted
by a human on 2026-09-06, and every one of the twelve is now accounted for** (§3.5).

---

## 5. Whether to roll anything back

**No. Nothing rolls back, and the reason is stronger than the four this plan was handed.**

The four it was given are all true — nothing that shipped is wrong; the path editor is the
instrument; the 58 paths are real authored work; the plan's assumption broke rather than its code.
Test them and they hold. But there is a fifth that settles it, and it only became visible once the
census was run:

> **§3 could not have been measured without every phase that shipped.** The 11 corrections were read
> off **131 human-placed points** — against 16 pt rows, the vision pass's 11 pt median error would
> have made every one of them a coin flip. The printed names that rank the candidates are usable
> because of **654 review decisions**. The polylines are in the browser at all because of
> **`/api/conductors`**, built in Session 6. Roll any of it back and the diagnosis in this document
> becomes unmeasurable — you would be back to guessing which of 40 wires is wrong, which is exactly
> where the previous session started.

**On the narrow rollback the framing floated** — *"wires should perhaps never have been entities in a
generated netlist at all; they may belong in an authored file keyed on their endpoints"* — it is
**half right, and the wrong half is the one that would have hurt.**

- **Right:** a wire's endpoints do not belong in a Python literal that the WebUI cannot reach. That
  is decision 1, and `wiring.json` is exactly the *"authored file the generator reads the way it
  already reads points"* the framing describes.
- **Wrong:** *keyed on their endpoints* — q2 shows the key collides today and would rename a wire
  under the very operation being built.
- **Wrong, and this is the important one:** wires must **stay entities in `circuit_logic.json`**.
  Your `Ask`-tab question failed because `CONNECTS_TO PS1:-2 → TB-0V:2` is in the netlist **and** in
  `custom_kg.json`, and the model answered it faithfully. Moving wires out of the netlist would not
  have prevented that answer; it would have removed the model's ability to answer the question at
  all. **The defect was the endpoint, and the fix is the endpoint.**

So: **nothing is deleted, no file format from Session 5 or 6 is revisited, and no test is removed.**
What gets *added* is a file, a screen and a queue. What gets *corrected* is seven sentences, one
fixture and eleven endpoints.

**The one thing I would call a real loss** is smaller than any of that and worth naming so it is not
discovered later: `07_drawing_facts.md`'s `W063` row and the `paths.test.ts` fixture built on it were
**measured from the ink and still wrong**, because the measurement did not know that a block's
commoning gets fused into a wire's polyline. That is a lesson about the *method*, not about the
project, and §3's method paragraph is where it now lives.

---

## 6. `wiring.json` — the fourth authored file

Schema 1. Two sections, and neither of them holds a coordinate.

```json
{
  "drawing_number": "PS20115MLM4-2",
  "schema": 1,
  "wires": {
    "W063": {
      "from": "INFEED1:3",
      "to": "TB-120:1",
      "source": "human",
      "by": "js",
      "at": "2026-09-07T14:22:03.118Z",
      "was": ["INFEED1:3", "TB-120:2"],
      "note": "the ink runs C0091 west along y=563.4 and stops at point 1"
    },
    "W019": {
      "from": "PS1:-2",
      "to": "TB-GND-B:2",
      "source": "human",
      "by": "js", "at": "...",
      "was": ["PS1:-2", "TB-0V:2"],
      "note": "a 0V-to-ground bond; the two ends are on different nets and that is correct"
    },
    "W042": { "from": "PB2:3", "to": "TB-0V:6", "source": "human", "by": "js", "at": "...",
              "note": "the run stops at the west side of the block - the drawing's error, not ours" },
    "W072": { "from": null, "to": null, "source": "human", "by": "js", "at": "..." }
  },
  "commoning": {
    "TB-0V": {
      "runs": [[[954.4, 267.3], [954.4, 546.9]]],
      "conductors": ["C0105"],
      "geometry": "extracted",
      "attribution": "human",
      "by": "js", "at": "..."
    },
    "TB-110": { "runs": [...], "conductors": ["C0060", "C0077"], ... }
  }
}
```

**`wires`** — keyed on the wire id, which is now explicit and permanent (q2).

- **`from` / `to`** are terminal designators, or **`null`** for an end nobody has set. `null` is a
  real state and the only honest one for a wire added on screen before its second click.
- **`source`** is `index` or `human`, the same two words `locations.json` uses for a point. **The
  file only ever contains records a person touched** — the 71 `index` values live in the `W` table
  and are the fallback, exactly as a component's vision-pass estimate is. Phase 0 is the one
  exception and it is a one-off script, not a save.
- **`was`** keeps the endpoints this record replaced, forever, for the same reason a label
  correction keeps `was`: the `W` table is hand-maintained and a future edit would destroy the
  original. Absent where nothing was replaced.
- **No `net`.** Decision 5. The generator derives it from the two ends' `net` fields and **records
  the mismatch** where they differ rather than picking one.
- **No colour, gauge, cable or note-about-the-callout.** Those stay in the `W` table: they were read
  off the printed callouts, which is a different claim and one this plan does not reopen. `note` here
  is about the *connection*.
- **`retired`** — a string reason, in place of `from`/`to`, tombstoning an id so nothing reuses it.

**`commoning`** — keyed on the **component id of the block**, not on a terminal.

- It stores its own **`runs`**, a list of polylines, for the reason §3.6 gives: `C0105` and `C0008`
  are each partly a wire and partly commoning, so *"conductor `C0105`"* is not a sufficient
  description of `TB-0V`'s commoning and pointing at the whole conductor would highlight
  `DISCHARGE1:2`'s wire as though it were the bus. `conductors` records which runs it was lifted
  from, and the two provenance axes mean what they already mean.
- **It is not a wire and it never enters the netlist.** No `W###`, no `CONNECTS_TO` edge, no entity.
  It is display geometry, like a path — so **saving one does not make `circuit_logic.json` stale**,
  and a test should assert that in bytes the way `test_a_path_does_not_reach_the_netlist` does.
- **`derived` stays a rejected value on both axes**, refused by name, per §8's rule.

**Where it is validated.** `server/app/wiring.py`, a new module beside `locations.py` and
`label_corrections.py`, with the same split: `parse()` checks shape and knows nothing about this
drawing; `resolve()` checks that a designator exists, and refuses **by name** an endpoint that is not
a terminal in the index or a `commoning` key that is not a component — because a wiring entry keyed
on something that does not exist is the one hand-edit mistake whose symptom would otherwise be
nothing at all. Same reasoning as `H14`.

**And the asymmetry from q1, stated as code:** `read_locations()` warns and continues;
`read_wiring()` **raises**. A drawing with a missing dot is a worse drawing; a netlist with a missing
endpoint is a different netlist.

---

## 7. The two screens

### The Locate tab — a `Wiring` mode

The sixth filter, the queue, the panel, the two end slots, `Pick from the sheet`, `Add a wire`,
`Retire this wire`, the net-mismatch flag, the ink's proposal per end with its tag words. All of it
is q4; it is not repeated here.

Three things about it that are decisions rather than description:

- **The queue counts confirmations, not corrections.** `0 of 71` on the first run, `71 of 71` at the
  end. That is `K7` avoided the way the `Paths` count avoided it — a count that can reach its own
  total, because every wire has a state a person can put it in.
- **A wire the ink and the index agree on is still unconfirmed.** 47 of them. One glance and one
  click each, and the reward is that the file afterwards distinguishes *nobody looked* from
  *somebody decided* — which is the distinction `locations.json` exists for and the one invariant 10
  protects.
- **`W042` is in the lesson document by name.** A wire where the ink is wrong and the data is right,
  chosen as a test case on purpose, because a screen that trains you to accept the proposal is worse
  than no screen.

### The Drawing tab — a terminal's wires, and *is there a wire here*

- **Click a terminal → every wire attached to it is highlighted**, plus its block's commoning (q7).
  The selection card lists them with their spec, and each is one click from being selected on its
  own. No password, no draft.
- **Click the bare sheet → the nearest conductor is named** (q6): `C0059`, its printed spec and net
  name, and which wire claims it — or that none does, beside the count of how many wires have a route
  yet.
- **A net's highlight gains its blocks' commoning** (decision 6). This is the change you asked for
  and it is a change to `pathsFor`'s net case: the union of the net's wires' runs **plus** the
  commoning of every block holding one of the net's member terminals. Net `0V` becomes the eleven
  runs *and* the 279.6 pt vertical they all land on, which is the thing that makes the net legible.

**Hazard to write down:** the commoning of a block belongs to *one* net today — every multi-point
block's points share a single net — but nothing enforces that, and a block whose points ever span two
nets would paint the whole bus for both. Assert the one-net property in a test now, while it is true,
so the day it stops being true the test says so rather than the highlight.

---

## 8. The migration — what moves, and what does not

**What does not move, and this is most of it:**

| | |
|---|---|
| 131 placed terminal points | untouched |
| 48 placed `TB-*` points | **untouched** — decision 3, proved in §3.4 |
| 111 end-label overrides | **untouched** — they key on terminal ids, which do not change |
| 41 component sites over 47 drawings | untouched |
| 654 review decisions | untouched |
| **58 authored paths** | **untouched** — q2 freezes every id, so no path reattaches |
| `locations.json` schema | **stays 2.** One optional key is added to a `path` (`for`), which schema 2 tolerates the way it tolerated `path` itself |

**What moves, all of it in Phase 0 and all of it by script:**

1. **`wiring.json` is written** from the current `W` table: 71 records, explicit ids `W001`–`W071`,
   endpoints exactly as they are today, `source: index`. This file is *"what the machine guessed"*
   and is the last time anything writes that.
2. **`for` is back-filled onto the 58 existing paths** from the same table — true by construction,
   because those endpoints are what the path panel was showing when each route was accepted.
3. **`author_circuit_logic.py` reads `wiring.json`** and takes `from`/`to` from it where a record
   exists. `net` becomes derived. **Acceptance: the generator's output is byte-identical before and
   after Phase 0**, because at that moment the file says exactly what the literal said.
4. **`build_kg.py` is re-run** after the first real correction, not after Phase 0 — Phase 0 changes
   nothing. Note the finding from Session 6's small batch: `build_kg.py` emits no coordinates, so it
   only moves when connectivity does. **This work moves connectivity, so unlike the placement run it
   really does need the second command.**

**One-off script, not a migration framework.** It runs once, its output is committed, and it is
deleted. A migration that survives is a migration somebody will run twice.

---

## 9. The phases, in build order

### Phase 0 — freeze the ids, lift the endpoints out of the literal

Everything in §8. **No screen, no behaviour change, no authored decision.** The point of doing it
alone and first is that inserting a wire before the ids are frozen would silently reattach all 58
paths, and nothing on screen would look different.

**Acceptance:** generator output byte-identical; `wiring.json` reproduces the `W` table; the four
checks green; a test that a **missing or broken `wiring.json` raises** rather than warning.

### Phase A — the wiring queue and the endpoint editor

`Wiring` filter, the queue, the panel, two end slots, `Pick from the sheet`, `source: human` on
confirm, the `was` stamp, the net-mismatch flag, `Escape` taking the slot before the row. **Server:
`wiring.py`, `GET`/`PUT` behind the editor password. Restart needed.**

**Acceptance:** confirming a wire whose endpoints do not change still writes a record and moves the
count — *I looked and it was right* is a decision, and this is the phase where that becomes storable.

### Phase B — the ink proposes an endpoint

`features/locate/wiring.ts`, pure, the sibling of `paths.ts`'s `candidates()`: for an armed wire,
what the ink says each end lands on. **This is where §3's measurement becomes shipped code**, and it
must carry the commoning-aware landing rule from §3's method paragraph — a run's landing is where it
**leaves** the commoning geometry, not where its polyline ends. Get that wrong and it mis-proposes
four wires, which is how `07_drawing_facts.md` got `W063` wrong.

**Acceptance, and it is the phase's whole point:** fixtures built from §3.2 and §3.5. The proposal
reproduces all eleven corrections, agrees with the netlist on all 47 confirmed wires, and **offers
nothing for `W042`** rather than offering `TB-0V:1`.

### Phase C — commoning, and a net you can see

Author a block's commoning; a net's highlight unions it in; a wire's and a terminal's do too. The
`runs`-not-just-`conductors` structure of §6, and the one-net assertion of §7.

**Acceptance:** selecting net `0V` paints eleven wire runs and the vertical they land on; saving a
commoning record leaves `circuit_logic.json` current, asserted in bytes.

### Phase D — a terminal's wires, and *is there a wire here*

`pathsFor`'s third case, the terminal → wires reverse index in `lib/designators.ts`, the sheet
hit-test, and `GET /api/conductors` **losing the password**. **Server change — restart needed.**

**Acceptance:** clicking `TB-0V:6` highlights `W042` and the commoning and says so; clicking `C0092`
says *`TB-120`'s commoning*; clicking a label leader says *no wire claims this run*, beside the count
of how many wires have a route.

### Phase E — add and retire a wire

`Add a wire` at the next free id, `Retire this wire` with a tombstone, and the generator handling
both. Small, and last on purpose: **§3.7 found zero missing field wires**, so this phase is
insurance for drawing number two rather than work this sheet needs. If a session runs short, this is
the one to drop.

### Phase F — the authoring run, then the repairs

**Yours, not a coding session.** §14 is what it costs. Then, in one sitting afterwards:

- re-run `author_circuit_logic.py` **and** `build_kg.py` (§8 item 4);
- correct the `W063` fixture and add the *`C0092` is commoning* assertion (q10);
- correct the seven sentences (q11);
- update `07_drawing_facts.md`, the manual's §5a and §7, and `change_history.md`.

### Not in this plan, and why

- **Renumbering the terminal blocks** — decision 3, proved unnecessary in §3.4 and confirmed by you.
- **Wires leaving `circuit_logic.json`** — §5. They are what the model reasons over.
- **Storing a wire's net** — decision 5. Derived from the ends, mismatch flagged.
- **Modelling the commoning as wires** — your answer 2026-09-06. They are the block's own, and
  §3.7's *"0 missing field wires"* depends on that reading.
- **Re-authoring the 58 paths** — q9. Zero are invalidated; `for` flags any future staleness.
- **Auto-accepting the 47 the ink confirms** — `W042` is why, and it is the same rule Session 6 wrote.
- **Fixing `K2`/`H1`** — still out, still deferred by you, but note this plan adds a **fourth**
  authored file written from the **same** screen as the second. That is a narrower exposure than a
  second screen, and it is the strongest reason yet to keep the wiring editor on the Locate tab.
- **A `spec` field on a run** (`K11`) — still not doing it, and §3 is more evidence: the binding
  signal was endpoint geometry again.

---

## 10. Verification

At every phase boundary:

```
cd server && .venv/bin/python -m pytest -q && .venv/bin/python -m ruff check .
cd ../webui && npx vitest run && npx tsc -b --noEmit
```

**Baseline 2026-09-06: 171 server passing plus the `K6` artifact test red · 318 web · ruff clean · tsc clean.** Clear `K6` with the generator before measuring anything against this. Expect roughly **35 new
server tests** (`test_wiring.py`, the byte-identity pair, the loud-failure test, the commoning
refusals) and **55 new web tests** (`wiring.ts` against the §3 fixtures, the panel, the reverse
index, the hit-test, `pathsFor`'s third case).

`test_the_committed_artifact_is_exactly_what_the_generator_writes` is red whenever `locations.json`
or `wiring.json` is ahead of `circuit_logic.json`. **That is now true of two files**, and the K6
banner has to name which one — otherwise the honest instruction *"re-run the generator"* becomes a
guess about what you changed.

---

## 11. The documents to deliver with it

| File | Covers |
|---|---|
| `15_tests_wiring_editor.md` | **T-1000–T-1090.** The `Wiring` filter and the count that reaches 71 · the two end slots and what `from the index` means · the ink's proposal and its tag words · `Pick from the sheet`, and `Escape` taking the slot before the row · confirming a wire that was already right · **`W042`, where the ink is wrong and the data is right** · the net-mismatch flag on `W019` · `Add a wire` and `Retire this wire` · `was`. **Editor password and a restart.** |
| `16_tests_terminal_wires_and_commoning.md` | **T-1100–T-1160.** Clicking a terminal on the Drawing tab · a missing wire visible by its absence · a net highlighted *with* its commoning · authoring a block's commoning · the sheet hit-test and its three verdicts · `/api/conductors` with **`SWUI_ALLOW_EDITS=false`**, which is the acceptance criterion. **Both tabs; no password for the reader's half.** |

Both go in `locate_tab_testing/`, which keeps its name for the reason §11 of the last plan gave.

**A session that ships code and no lessons has not finished.** The lessons are written for a person.

---

## 12. What I decided on your behalf, and how to flip it

| Decision | Taken | Flip it to |
|---|---|---|
| Where endpoints live | a fourth authored file, `wiring.json` | fold into `locations.json` — one file to commit, but the stale-banner rule stops being one sentence and two claims share a document |
| Wire ids | explicit, present 71 frozen, never reused | keep them positional and forbid insertion — no Phase 0, and the bug stays one careless edit away |
| A wire's `net` | derived from its two ends, mismatch flagged | keep storing it — one less derivation, and a third copy of a fact that goes stale silently |
| Colour, gauge, cable | stay in the `W` table | move them too — one home per wire, at the cost of mixing a reading of the ink with a claim about connectivity |
| Where the wiring editor lives | a mode on the **Locate** tab | its own tab — less density on the busiest screen, at the cost of splitting one act across two selections |
| Where *a terminal's wires* lives | the **Drawing** tab | the Locate tab with a modifier key — one screen, and `H10` gets a third occupant |
| Commoning | authored per block, in `wiring.json`, **not** wires | model each as a wire with a `kind` — appears in the netlist and in `custom_kg.json`, which would put six edges the sheet does not mean in front of the model |
| Commoning geometry | its own `runs`, because `C0105` and `C0008` are half wire | just `conductors` — simpler, and highlighting `TB-0V`'s bus would drag `DISCHARGE1:2`'s wire in with it |
| Telling you which paths are stale | a `for` stamp on the path, compared on load | a one-off list in the plan — no schema change, and it stops working the next time an endpoint moves |
| `/api/conductors` and the password | free it, per `H20` | keep it gated and proxy the hit-test through an editor route — no, the reader's question is the point |
| Phase order | Phase 0 alone and first | fold it into Phase A — one fewer commit, and the id freeze stops being independently verifiable |
| `Add a wire` | last (Phase E) | earlier — but §3.7 measured **0** missing field wires, so it earns its place last |
| The 47 confirmed wires | still require a click each | trust the ink for them — cheaper, and the file loses the only thing it exists to record |

---

## 13. The sessions

Four sessions, plus yours. Each has an honest stopping point: the app works, the tests are green, and
nothing is half-authored.

### Session 1 — Phase 0

The script, the file, the generator reading it, the loud failure, the `for` back-fill. **Nothing on
screen changes.** Stop when the generator's bytes are identical and `wiring.json` is committed.

*Honest stopping point:* the ids are frozen forever and the endpoints are reachable from a file. If
the project stopped here, the next session could correct eleven endpoints in a text editor and be
right — which is worth knowing, because it means **Session 1 alone removes the defect**, and
everything after it is about not needing a text editor and about knowing who checked what.

### Session 2 — Phases A and B

The screen and the proposal, together, because a queue with nothing to propose is a form to fill in
and the two are one lesson. `15_tests_wiring_editor.md`.

*Honest stopping point:* you can confirm all 71 wires. **Do not start the run yet** — Phase C changes
what a net looks like and you will want to see it while you work.

### Session 3 — Phases C and D

Commoning, a net you can see, a terminal's wires, the hit-test.
`16_tests_terminal_wires_and_commoning.md`.

*Honest stopping point:* every question you asked has a screen. **This is where the authoring run
should start.**

### Session 4 — Phase E, and the repairs of Phase F's second half

`Add a wire`, `Retire this wire`, and — after your run — the fixture, the seven sentences, the
documents, the regeneration. Split it if your run is not finished; the repairs need it to be.

### If even that is too much

**Session 1 on its own is worth doing and stands alone.** It freezes the ids, moves the endpoints
somewhere a person can reach, and makes the eleven corrections a one-line edit each that the
generator picks up. Everything after it buys three things: that a person's *confirmation* is
recorded rather than just their corrections, that the sheet can answer *is there a wire here*, and
that drawing number two starts from a screen instead of a Python literal.

---

## 14. What you have to author by hand, and what it will cost you

You have done **131 points** and **654 readings**. **This is much smaller than either.**

| | Count | Per item | Notes |
|---|---|---|---|
| Wires the ink and the index agree on | **47** | a glance and one click | The panel says *both ends, within 1 pt*; you are checking, not deciding |
| Wires with a correction the ink names | **11** | read it, look at the sheet, one click | §3.2 is the list. You found ten of them already |
| Wires only you can settle | **13** | 30–60 s each: zoom, look, two clicks | §3.3 is the list, with the candidate ink for each |
| Blocks whose commoning wants authoring | **7** (8 conductors) | one or two clicks | `TB-0V` and `TB-24E1-B` need a *run*, not a conductor, because theirs are fused with a wire |
| Questions only your eyes can close | **3** | a zoom each | `TB-130`'s missing commoning and third wire · `TB-120:3`, 24 pt below the end of `C0092` · which of `W044`/`W050`/`W057` is on `TB-0V:8`, `:9`, `:11` |
| Paths to re-check afterwards | **0 invalidated**, 14 worth a look | one click | q9. The `for` stamp will tell you if that ever changes |

**Call it 100 gestures and 45–75 minutes**, in one or two sittings, on a screen that proposes and
never decides. For comparison: the placement run was 178 placements over a day, and the review run
was 654 readings over two.

**And what you get for it**, stated plainly because it is the reason to spend the time: every one of
the 402 edges in `circuit_logic.json` and every relationship in `custom_kg.json` becomes something a
person said, rather than something a counter allocated. The `Ask` tab stops being able to answer
*"what is `PS1:-2` connected to"* wrongly, because there will be no unchecked answer left for it to
be faithful to.

**End the run in a commit.** `wiring.json` joins `locations.json` and `label_corrections.json` as
authored content git cannot regenerate, and after this work there are **three** of them.


!!!! The following is an addition to this document that was manually written by John, your human coworker.  
1. I think this is probably specifed somewhere above in this document, but one of the goals is as follows:  
When on the "Ask" tab, the model should be able to reason about and answer questions about the highlighted wires.  
Also the model should be able to turn on the highlighting on selected wires when providing explainations.

2. Currently we are doing work on one particular schematic. This is helping us work out what features we would like to have in this application and it is helping us tryout different ways to create that funtionality. But the long term goal is to create processes that will work on any schematic. Then we will use these methods to create indexes for a whole range of schematics and eventually we will be creating a library of schematic indexes that a model can answer questions about. Now imagine that all the schematics for a factory or for a sort center are indexed. Then no matter what circuits need repair, we can get troubleshooting assistance from the model. The point I am making here is that while the current work is about a specific drawing, eventually we need to create an abstraction that can be applied to other schematics. So please build with that idea in mind.  

 3. Currently, we are doing work on a schematic that has only one page which describes the circuit. But eventually we will be working with more complex circuits which will require several pages of drawings in order to fully describe them. The point I am making here is that while the current work is on just a single page, eventually we need to create an abstraction that can be applied to other circuits which require several pages to describe. So please build with that idea in mind.  
---

## 15. What actually happened — the record, appended as each session lands

*Added 2026-09-07. The sections above are the plan as written and are not edited when reality
disagrees with them; this is where the disagreements go, so a reader can tell one from the other.
`_claude_notes/change_history.md` has the full entry for each.*

### Session 1 — Phase 0. **Done, 2026-09-07.**

`wiring.json` exists with 71 records, all `source: index`. The generator reads it, derives each
wire's net from its two ends, flags a wire whose ends are on different nets, and **raises** on a
missing or broken file. All 58 paths carry a `for`. **The artifact is byte-identical** and
`custom_kg.json` re-ran to the same bytes. 184 server tests, 320 web, ruff and tsc clean.

Four places where the execution departed from §8 and §9, each with its reason:

1. **The bootstrap script is kept, not deleted.** §8 said *"a migration that survives is a
   migration somebody will run twice"*. `schematic_skills/scripts/bootstrap_wiring.py` **refuses to
   overwrite an existing `wiring.json`** and only adds a `for` to a path that has none, so running
   it twice does nothing — which removes the reason to delete it and leaves the bootstrap that
   **drawing number two** needs. It reads `circuit_logic.json` and `locations.json` by name out of
   whatever directory it is pointed at and knows nothing about this sheet.

2. **The `W` table keeps its `from`, `to` and `net` columns.** §6 says what leaves it is those
   three, and §6 also says the table is *the fallback* for a wire with no record — which it cannot
   be if they are gone. The columns stayed: the endpoints are the fallback the plan describes, and
   `net` is kept as what it always was, *the name printed beside the run*. Neither is the source
   any more. A record that disagrees with the table is **printed** by the generator, so the copy
   decision 5 was worried about cannot go stale *silently*, which is the word that mattered. The
   standing test is that every record still saying `source: index` reproduces the table exactly —
   written that way so it stays green through the authoring run instead of going red on the first
   correction.

3. **Byte-identity is asserted against an empty file rather than an absent one.** q2 asks for
   *"byte-identical with and without the file present"*, and §9 asks for *"a missing or broken
   `wiring.json` raises"*. Both cannot be run at once. A `wiring.json` whose `wires` section is
   `{}` is the honest stand-in for *absent* — present, valid, saying nothing — and the test
   compares the real records against it. The absent case is its own test, and it raises.

4. **The seven sentences were corrected now rather than in Session 4.** §13 schedules them after
   the authoring run. They were pulled forward for the reason §4 q11 itself gives: *a wrong fact in
   a document the next session reads is how nine days went by last time* — and Session 2's required
   reading is `06_code_map.md` and the manual, which were two of the six. The `W063` fixture and the
   `07_drawing_facts.md` row were **not** pulled forward; they belong with the proposal work in
   Phases B and C, and §4 q10 warns that a fixture corrected carelessly there will not go red.

Two things the plan did not ask for and that were built anyway, both because the format was being
defined and adding them later would be a schema change:

- **A `retired` record removes the wire and its `CONNECTS_TO` edge.** Retiring is Phase E, but the
  *dangerous* half of it is that a tombstone silently ignored leaves an edge a person deleted. A
  record for an id the `W` table does not have is still **refused by name**, so `Add a wire` stays
  Phase E's to unlock deliberately.
- **`from` or `to` may be `null`, and such a wire earns no edge.** It stays in `wires`, because
  somebody started it and a queue has to be able to show it.

### What §14 now costs

Unchanged: **about 100 gestures**. Nothing in Phase 0 is an authored decision, and the queue will
read `0 of 71 wires confirmed` the first time Session 2's screen is opened, exactly as decision 4
says it should.

### Session 2 — Phases A and B. **Done, 2026-09-08.**

There is a screen. A sixth **`Wiring`** filter on the Locate tab, a queue reading
`0 of 71 wires confirmed`, two end slots per wire with `Pick from the sheet`, `I looked and it was
right`, `Take it back`, the `was` stamp, the net-mismatch flag, a note, and `path may be stale`.
`features/locate/wiring.ts` is the ink's proposal, pure, carrying the commoning-aware landing rule.
`server/app/wiring.py` is the fourth authored file's validator and `GET`/`PUT /api/wiring` are
behind the editor password. **228 server tests, 392 web, ruff and tsc clean.**

**Both acceptance criteria are met.** Confirming a wire whose endpoints do not change writes a
record and moves the count — asserted in `wiringModel.test.ts`, in `WiringPanel.test.tsx` end to end
through the `PUT`, and in `test_wiring.py` as the first test in the file. And the proposal, measured
against the real drawing rather than a fixture of it:

| | |
|---|---|
| §3.2's eleven corrections reproduced, each at the top of its end | **11 of 11** |
| …and the screw the netlist claims **not even offered** on that end | **11 of 11** |
| Ends of a census-confirmed wire where the declared terminal is missing from the proposals | **0 of 90** |
| Offered for `W042` | **nothing, at either end** |
| §3.6's commoning conductors recovered from shape alone | **8 of 8** |

**Four places where the execution departed from §4 and §9, each with its reason:**

1. **`path may be stale` is a word on the row and not a filter.** §4 q9 says *"the `Paths` filter
   can show them"*. `pathSettled` is unchanged and the filter is untouched. `T-940` is that the path
   count and the `Paths` filter share **one** predicate, so a corrected endpoint quietly
   un-finishing wires would walk that count backwards in the middle of a run — a worse thing to do
   to a person than a word being only a word. The session's instructions ask for *"one word on a row
   and one predicate in `rowState`"*, which is what shipped.

2. **`ENDPOINT_LABEL` sits beside `PLACEMENT_LABEL` rather than reusing it.** §4 q4 says the slots
   should reuse the `placed` / `estimate` / `on its component` vocabulary. Mapped literally that
   calls an endpoint *placed*, which says the wrong thing — nothing about an endpoint is a position
   — and *estimate* is too soft for a screw number a counter allocated. The words §4 q4 actually
   asks for shipped (`from the index`, `you, on 2026-09-08`), in the **same module**,
   cross-referenced, so the concern behind the instruction is met structurally.

3. **The proposal is ranked on geometry alone and the printed name is carried, not scored.** §4 q4's
   worked panel line implies the name is part of the answer. It is not, and the reason is stronger
   here than in `paths.ts`: a run's printed name is its **net**, every point of a terminal block is
   on the same net, so `0V` cannot tell row 3 from row 8 — and the screw number is printed nowhere
   at all. Ordering is fit and then id; the names and specs are shown for a person to read.

4. **The proposal does not promote whatever the record already says.** Eleven of this sheet's 90
   endpoints have another wire's landing ranked above the declared one, because two wires land on
   one pin (`PLG1`/`PLG2` onto `TB-L1:1` and `TB-N:1`, `CR-ON:14` beside `CR-BP:24`). Reordering to
   put the record's own answer first would produce a list that could never disagree with the record,
   which is the only thing it exists to do. The one that agrees is **tagged** instead.

**Three things §3 got slightly wrong, all now measured by shipped code:**

- **The proposal settles 48 wires, not 47.** It also chains `W002` and `W003` — `PLG1`'s runs
  paralleling `PLG2`'s — and `W031`, whose block end the commoning rule reads past the bus §3.3 says
  it could not get through.
- **It cannot settle `W047` or `W048`**, which §3 counts among the 47. Both land on a relay coil's
  `A2`, and the ink stops **46 pt short**: the vertical bus runs at x ≈ 917.5 while the coil pins
  were placed on the symbol at x ≈ 871. §3.1 names that shortfall for `W048` itself and stops there.
  Together with `W024`, `W025`, `W026` and `W049` that is **six wires reaching a relay coil, none of
  them settleable from the ink** — the same shape §3.3 calls *"three coil feeds, one bound
  landing"*. §3.1's arithmetic is also internally short by one: §3.3's table has 13 rows and the
  *"5 of the 31"* list adds `W048`, which is not one of them.
- **§3.6 is *8 conductors across 6 blocks*, not 7.** Its own table lists six distinct blocks.

**Two things built that the plan did not ask for, both because the alternative was worse:**

- **`Take it back`** on a confirmation. §7 has no control for it, and the alternative for somebody
  who confirms the row above the one they meant is a text editor — on a screen whose entire purpose
  is that a decision is a person's. It writes `source: index` with the endpoints `was` was holding,
  and it does **not** delete the record: the bootstrap wrote one for all 71, and a vanished record
  reads in `git diff` as a wire somebody removed.
- **A `note` box**, disabled until the record has a decision to ride on. §6 defines the field and
  the plan's own examples are the shape it is for — *"a 0V-to-ground bond; the two ends are on
  different nets and that is correct"*. Without a control the field would have been unreachable
  during the run it exists for.

**And one hazard worth reading before Phase C touches this: `H24`.** The commoning-aware landing has
three parts and only the first is obvious. A landing must also be **nearer this end of a run than
the other** — `C0017` is 17.2 pt long, shorter than the tolerance, and without that clause `W069`'s
correction vanishes entirely. And only `placement: 'confirmed'` pins may be fed to it: a terminal
resolved to its parent's dot is a coordinate nobody chose, and a rule discriminating at 4 pt handed
one would invent landings on whatever ink passes the component.

### What §14 now costs

**Unchanged: about 100 gestures, 45–75 minutes.** What changes is where the time goes. The 47 the
ink agrees with are **faster** than estimated — the panel says `agrees with the index` and it is one
button. The **six coil wires are slower**: the ink offers nothing for `W024`, `W025`, `W026`,
`W047`, `W048` and `W049`, so those are `Pick from the sheet` and judgement. And **`W042` is the one
to do deliberately** — press `I looked and it was right` on a wire the ink says nothing about, and
notice that the screen did not try to talk you out of correct data.

### Session 3 — Phases C and D. **Done, 2026-09-09.**

A terminal block's commoning is authored and a net's highlight includes it; clicking a terminal on
the Drawing tab highlights every wire that reaches it; a click on bare paper names the run of ink
and gives one of three verdicts; and `GET /api/conductors` has lost the editor password.
**245 server tests, 433 web, ruff and tsc clean.** `16_tests_terminal_wires_and_commoning.md` is the
lesson document, T-1100–T-1160.

**Both acceptance criteria are met, and one of them is met with a caveat worth stating.**

| | |
|---|---|
| A commoning save leaves `circuit_logic.json` current, asserted in bytes | **yes** — `test_commoning_does_not_reach_the_netlist`, and proved again on the real drawing: written through the running server, generator re-run, same md5, `git checkout` empty |
| `/api/conductors` answers with `SWUI_ALLOW_EDITS=false` | **yes**, verified live: 200 against `/api/wiring`'s 404 |
| Clicking `TB-0V:6` highlights `W042` and the bus and says so | **yes** |
| Clicking `C0092` says *`TB-120`'s commoning* | **yes** — and it distinguishes the shape rule's answer from a person's |
| Clicking a label leader says *no wire claims this run*, beside the route count | **yes** |
| Selecting net `0V` paints eleven wire runs **and** the vertical | **the vertical, yes. Eleven runs, not yet** — see below |

**The one criterion that is only half true, and it is data rather than code.** Net `0V` has 13
wires and **3** of them have a route authored. The union works and the vertical is painted; the
number of wire runs is whatever the `Paths` queue has reached, and it climbs on its own during the
authoring run. Nothing further needs building for the eleven to appear.

**Six places where the execution departed from §7 and §9, each with its reason:**

1. **A wire's highlight does not include the commoning.** §9 asks for all three cases; a net's and
   a terminal's shipped. `C0092` is `TB-120`'s bus and `07_drawing_facts.md` called it *"the second
   piece of `W063`'s L"* for a week — painting a block's bus in the highlight colour underneath a
   selected wire is that picture exactly, and it would teach the error on every wire that lands on
   a block. A net and a terminal are questions about a **place in the circuit**, where the bus
   belongs in the answer; a wire is a claim about **one piece of ink**.

2. **The commoning is published on `/api/paths`.** §6 does not say where it travels, and the
   obvious home — `/api/wiring` — is gated, which would have put the reader's half of Phase C
   behind the editor password. `H20` was rewritten round it and the line it draws now is **geometry
   is free and connectivity is not**; `test_no_wires_endpoints_travel_with_it` asserts the other
   half.

3. **The `Commoning` count's denominator comes from the ink.** Every other count on that screen is
   out of `circuit_logic.json`, and nothing in the netlist says which components have a bus. The
   honest total is *blocks the ink offers plus blocks already authored* — a set that can be
   finished, so `K7` is avoided. The cost is that **a block the ink cannot see cannot be authored
   here at all**, which is `TB-130` and is §14's first question.

4. **`candidates()` excludes a bus by the shape rule, not by the authored record.** §4 q10 asks for
   the exclusion *once a block's commoning is authored*. Keyed that way it would be **wrong**: a
   record stores stretches, `C0105` and `C0008` are each partly a wire, and excluding by the
   conductor ids a record names would take `DISCHARGE1:2`'s and `RECEPT1:5`'s real routes out of
   the list. `isCommoning` answers the narrower question the ranking needs and answers it before
   anything is authored — which matters, because the run starts now. The runs are **removed** and
   the panel **names them**: a tag on a row somebody can press is not enforcement, and a list that
   drops things silently is one nobody can trust.

5. **The conductor card keeps the selection rather than replacing it**, and `Escape` takes the card
   before the selection. `H22`'s escalation on the reader's tab. Asking *what is this line* while
   reading a net is a question about the net.

6. **`lib/polyline.ts` was not asked for.** The hit-test needed point-to-polyline distance and
   `wiring.ts` already had it privately. Two copies of *how far is this point from that run*, on a
   sheet whose rows are 16 pt apart, is how a hit-test comes to name a conductor the landing rule
   says a pin is not on. One module, three callers: the proposal, the bus, and the hit-test.

**Two things built that the plan did not ask for:**

- **An optional `page` on a commoning record**, at the user's request in the session brief. It is
  the one page number in a file that otherwise holds only designators, it costs nothing on a
  one-page drawing, and it would be a schema change on the first two-page one.
- **`wiringStore.save` refreshes `/api/paths`.** That store deliberately refreshed nothing, and the
  argument holds for the half it was about — an endpoint changes nothing visible until the
  generator runs. A bus is the opposite, so the highlight the user asked for appears without a
  reload.

**The `W063` repair went in here rather than in Phase F**, because item 4 made it executable rather
than a documentation fix. The fixture, the `07_drawing_facts.md` row, the sentence under that table
(*"`C0057` still makes the point and `C0092` never did"*), and **`14_tests_path_editor.md` T-915 —
which had been instructing the user to add `TB-120`'s bus to `W063`'s route.** The assertion that
carries the finding was added, exactly as q10 warned it must be.

**And §7's one-net assertion is written and green**: every block with a bus has all its terminals on
one net, measured against the real drawing. It is what makes painting a whole vertical for one net
honest, and the day it stops being true a test says so rather than a highlight.

### What §14 now costs

**About 100 gestures for the wires, unchanged, plus six and three.** Six clicks confirm the six
blocks' commoning. Three zooms close the questions only the user's eyes can close — `TB-130`,
`TB-120:3`, and which of `W044`/`W050`/`W057` belongs on `TB-0V:8`, `:9` and `:11`. **T-1115 and
T-1130 are the two screens that show them**, and the second is the one to use throughout the run:
a pin nothing reaches now says so in as many words.

### Session 4 — Phase E. **Done, 2026-09-10.**

`Add a wire` above the `Wiring` queue and `Retire this wire` at the foot of an armed wire's panel.
The `W` table stopped being the list of wires that exist: a record saying **`"added": true`**, at
an id the table does not have, is a wire a person put on the drawing and the generator folds it in.
**261 server tests, 458 web, ruff and tsc clean.**
`17_tests_add_and_retire_a_wire.md` is the lesson document, T-1200–T-1255.

**§9's acceptance is met in both halves**, and there is nothing in this phase that could only be
half-met, because §3.7 measured **0** genuinely missing field wires — nothing on this sheet needs
it and nothing on this sheet tests it in anger.

| | |
|---|---|
| `Add a wire` at the next free id | **yes**, and the id counts past every tombstone as well as every live record |
| `Retire this wire` with a tombstone | **yes**, and it will not write one without a reason in words |
| The generator handling both | **yes** — an added wire becomes a netlist wire with an edge and no spec; a retired one leaves |
| Verified end to end against the running server | **yes** — `W072` written through `PUT /api/wiring`, generator run, 72 wires, then restored and `md5sum`-checked byte-identical |

**Six places where the execution departed from §4 q4, §6 and §9, each with its reason:**

1. **A record carries `"added": true`, which §6's own example does not have.** §6 shows an added
   wire as `{ "from": null, "to": null, "source": "human", ... }` and nothing more. Written that
   way the id past the end of the table *is* the marker — and it cannot be, for two reasons that
   only appear together. The first is that an unmarked unknown id is exactly the typo `resolve` and
   `build_wires` refuse by name, so opening the door with no marker opens it for the typo too. The
   second is worse: the `W` table is hand-maintained, and a wire added at `W072` plus a 72nd row
   typed into that table afterwards are **two different wires with one id**. Folded together they
   make one wire with the record's endpoints and the row's colour, the other wire gone and nothing
   saying so. With the marker that pair is refused by name. Hazard **`H25`**.

2. **`Add a wire` is above the queue, not in the panel.** §4 q4 lists it beside `Retire this wire`
   among an armed wire's controls. Adding a wire is not something you do *to* the wire you are
   looking at, and in the panel you would have to arm an unrelated row to reach it. It sits over
   the queue it adds to, on the filter that owns that queue.

3. **An added wire is born `source: 'human'` and is confirmed by picking its two ends**, with no
   separate *I looked and it was right* to press. `index` means *the indexing pass's own answer*
   and the indexing pass never saw this wire, so there is no third value it could honestly take.
   And there is nothing to confirm *against*: the button exists for wires whose ends the machine
   proposed. `wiringDecided` still wants both ends named, so a new wire sits at the top of the
   queue with two empty slots until somebody fills them — which is where it belongs.

4. **`unconfirm` refuses an added wire and the button is hidden**, which §7's `Take it back` does
   not anticipate. Writing `source: index` there would claim the indexing pass answered for a wire
   it never saw. The way out of an added wire is to retire it, which says what actually happened.

5. **A tombstone keeps no endpoints, so `Take it back` may return two empty slots.** §6 says a
   retired wire has no ends and the plan does not say what undoing one restores. It restores from
   the **netlist**, which still has the wire until the generator next runs — and after that it
   restores nothing, and the panel says so *before* you press. The alternative was a second field
   holding the pair, and it would have collided with `was`: retiring a corrected wire would either
   overwrite the machine's original answer or need a third key for the same shape of fact.

6. **Retiring does not touch the wire's authored route, and the route is now *reported*.** §9 says
   nothing about this and it is the one interaction between the two authored files that Phase E
   creates. Deleting the route would be `H18` exactly — a wiring decision reaching into
   `locations.json` — and it would destroy authored work over a decision reversible in the next
   press. So the route stays, the panel warns before you retire, and `resolve_geometry` names the
   orphan in the red strip. It used to be filtered out silently, which was invariant 5's one
   exception.

**Two things built that the plan did not ask for:**

- **`draftWireEntries` — the editor's own row for a wire the netlist has not got yet.** Nothing in
  §9 says where an added wire *appears*, and the answer turned out to be a small piece of design
  rather than a detail: `/api/designators` is built from `circuit_logic.json`, so between the save
  and the re-run an added wire has no entry, and without a row it is a record with no panel and no
  way to give it two ends. `entries` stays the netlist's and `listed` is the union — `ink` is
  memoised on `entries`, and folding the draft in there would rebuild 149 × 131 projections on
  every keystroke in the wiring panel.
- **One sentence in the artifact, repaired.** Every `CONNECTS_TO` on a wire with no printed callout
  read *"a an unlabelled conductor conductor"* — true of `W012` and `W015` since the beginning, and
  about to be true of every added wire, which is what made it this session's. `circuit_logic.json`
  and `custom_kg.json` were regenerated: **two edges changed and nothing else.**

**And trap 4 was paid a third time, in advance of the run rather than after it.** `INDEXED` now
drops an added record as well as a retired one — there is no machine answer to reconstruct for a
wire the indexing pass never saw — and
`test_wiring_json_covers_every_wire_in_the_netlist_and_invents_none` compares the **live** records
against the netlist and asserts the tombstones are absent, instead of comparing one set against
another. Both would have gone red on the user's first retirement.

### What §14 now costs

**Unchanged, and this phase adds nothing to it.** About 100 gestures for the wires, six clicks for
the commoning, three zooms for the questions only the user's eyes can close. The expected number of
times either of Phase E's controls is pressed during the authoring run is **zero** — §3.7 measured
no missing field wires — and if one of them *is* pressed, that is a finding rather than a gesture.

**The plan is now finished except for the run**, which is §13's Phase F and is the user's.
