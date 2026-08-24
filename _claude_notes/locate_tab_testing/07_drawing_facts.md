# Facts about PS20115MLM4-2 that the tests need

Index: `locate_tab_instruction_and_test_manual.md`.

**This file exists so nobody ever has to read `geometry.json`** (608 KB, about 150,000 tokens — the
cost of ~300 full test runs) **or `circuit_logic.json`** (large) to run or diagnose a test. Every
number below was read out of those files and is stated once, here.

**Two vintages.** The sheet's own geometry was read on 2026-08-17 and has not moved since — a PDF does
not change. Everything about *what has been placed* was re-measured on **2026-08-24**, after a
placement run made the old numbers wrong; §"Current state" and the relay and terminal-block tables
carry the new values with the old seeds beside them. The conductor and label facts in
§"The ink" were added 2026-08-24 for the wires-and-nets work.

---

## The sheet

| | |
|---|---|
| Page | **1224 × 792 pt**, top-left origin. 1 pt = 1/72 inch, so this is 17 × 11 inches |
| Rasters | 16 tiles, 4 × 4, **400 DPI**, 30 pt overlap |
| **Conductor row spacing** | **16 pt** — the number that makes accuracy matter |
| Label text height | median 4.13 pt, which is 22.9 px at 400 DPI |
| Coordinate space | The same for tiles, `components[].location`, and every bbox in `geometry.json`. No registration step exists anywhere. |
| Contents | **47 components · 131 terminals · 26 nets · 71 wires** = 275 index entries |
| Placeable | 178 (components + terminals). Labellable: 97 (nets + wires) |

**Accuracy of the seed points — the measurement that justifies the whole editor.** Screened against
every wire endpoint, terminal dot and junction in `geometry.json`, the 41 seeded components had a
median error of **11 pt**, with **17 over 15 pt** and **10 over 25 pt**. Against 16 pt rows that is a
coin flip on which row, and a dot on the wrong row names a different circuit.

Past tense on purpose: **those seeds have all been replaced by human points** (2026-08-24), so the
11 pt is now a historical figure about the indexing pass, not a description of the file. The relay
table below shows the gap on individual components, and it is worth reading — two of `CR-BP`'s three
candidates were about 20 pt out in y, and one of `CR-SW`'s was exactly right, with nothing to say
which was which in advance.

---

## The relays — the interesting cases

**All five are drawn more than once**, with the coil in the right-hand column and at least one
contact elsewhere. Earlier versions of this table listed only `CR-BP` and `CR-SW` as multi-site;
`CR-ON`, `CR1` and `CR2` are too, and `CR1`/`CR2` put their contacts on the **far left** of the sheet.

**Every point below is now human-confirmed** (2026-08-20 placement run), read out of `locations.json`
on 2026-08-24. The old version of this table gave the *seed* — the vision pass's guess — and is kept
in the right-hand column, because the gap between the two columns is the measurement that justifies
the editor.

| Component | pins | site | **confirmed** | old seed |
|---|---|---|---|---|
| `CR-BP` | `A1 A2 11 12 21 24` | `Coil` | (860.5, 678.8) | (861, 679) |
| | | `NC` | (715.2, 539.8) | candidate said (714, 520) — **20 pt out in y** |
| | | `NO` | (594.1, 241.5) | candidate said (592, 223) — **18 pt out in y** |
| `CR-SW` | `A1 A2 11 14` | `Coil` | (861.0, 704.0) | (861, 704) |
| | | `NO` | (569.5, 473.5) | candidate said (569, 473) — **right** |
| `CR-ON` | `A1 A2 11 14` | `Coil` | (860.6, 463.8) | (861, 464) |
| | | `NO` | (594.0, 208.0) | not previously recorded |
| `CR1` | `A1 A2 11 14` | `Coil` | (861.0, 331.6) | (861, 332) |
| | | `NO` | (155.8, 553.2) | not previously recorded — **far left** |
| `CR2` | `A1 A2 11 14` | `Coil` | (861.0, 381.3) | none; the seed was absent |
| | | `NO` | (229.8, 553.1) | not previously recorded — **far left** |

**Site names are `Coil`, `NC`, `NO`** — capitalised, and they are the human's words, not the
software's. An older draft of this file said `coil` and `contact`.

`CR-BP:11` and `CR-BP:21` are **both** function `common`. That is why pin assignment is a human act:
no rule over `function` can separate them. Every one of these sites carries exactly **2** pins.

**The relay coordinates are also the story of the whole project.** Two of `CR-BP`'s three candidates
were about 20 pt out in y against 16 pt conductor rows — the right area, the wrong row, which names a
different circuit. `CR-SW`'s was right. Nothing about the candidate said which was which.

### `CR2:14` — the worked example for a net's membership

`CR2:14` is CR2's **NO contact** at (229.8, 553.1), roughly 630 pt from CR2's coil. It is a member of
net `120`, and it is the reason a net highlight must ring **terminals** rather than their parent
components: ringing "CR2" puts the mark on the coil, most of a sheet away from the circuit being
discussed. Before the placement run it had no point of its own and fell back to the coil; it has one
now, so the same bug shows up as a *ring in the wrong place* rather than as a missing dot.

---

## Terminal blocks worth knowing

Confirmed component points, read from `locations.json` 2026-08-24, with the old seed beside them:

| Component | pins | **confirmed** | old seed |
|---|---|---|---|
| `TB-PB2SP` | `1` | (131.5, 353.8) | (196, 382) |
| `TB-PB1SP` | `1` | (131.5, 255.3) | (196, 282) |
| `TB-110` | `1 2 3 4` | (790.8, 537.4) | (781, 500) |
| `BYPASS-CB` | `1 2` | (385.4, 660.7) | (385, 664) |
| `DISCHARGE1` | `1 2 3 4 5 6` | (596.7, 627.8) | (760, 560) |

### `TB-PB2SP` — the original bug report, and how it turned out

The seed said **(196, 382)**. An earlier version of this file derived the correct terminal dot as
**(154.5, 348.3)** from `geometry.json` conductor `C0142` — printed net label `PB2-SP`, running at
y = 348.3 from x = 143.6 to 252.6.

**The human then placed `TB-PB2SP:1` at (141.8, 348.2)**, which is worth reading carefully:

- **y agrees to a tenth of a point** — 348.2 against 348.3. The derivation had the conductor row
  exactly right, and the row is the part that names the circuit.
- **x is 12.7 pt to the left** of the derivation. Along a horizontal run, x is where on the wire the
  dot sits, and a person looking at the sheet put it further along than the symbol binding did.

That is the whole system in one number: the machine can find the right *row* from the ink, and the
human still owns the *position*. `TB-PB1SP:1`, which this file previously said had never been
measured, is at **(141.8, 249.0)**.

---

## Wires and nets for the label tests

| Wire | Colour / gauge | From → To | Net |
|---|---|---|---|
| `W047` | BLUE 18AWG | `CR-ON:A2` → `TB-110:3` | `110` |
| `W048` | BLUE 18AWG | `CR-BP:A2` → `BYPASS-CB:2` | `125` |

`W048` is the one the prompt uses as its worked example — *"the blue 18AWG wire from `CR-BP:A2` to
the BYPASS 5A breaker (extraction id `W048`)"*. Note it is **W048, not W047**; an earlier note had
that wrong and a wrong example in a prompt teaches a wrong fact.

**Net `110`** has eight member terminals: `CR-BP:12`, `CR-ON:A2`, `CR-SW:14`, `INFEED1:1`,
`TB-110:1`, `TB-110:2`, `TB-110:3`, `TB-110:4`. It spans a wide area, so selecting it zooms **out** —
which is correct, and is why a net's label point is a separate fact from its rectangle.

**All 26 net ids:** `L1  L1-A  L1-A1  N  N-1  GND  +24V  24E-1  0V  SPD  DIR  RUN  110  111  120
121  125  130  NET-PB1  NET-PB2  PB1-SP  PB2-SP  IINSP1  IINSP2  DINSP1  DINSP2`

---

## The six ids with no position at all

These read **`nowhere`** in the list and can never be placed. They are legitimate citation targets —
dropping them would make a citation unresolvable rather than merely unclickable.

| Id | Class |
|---|---|
| `MXCS-M9`, `MXCS-M11`, `MXCS-P9`, `MXCS-P11` | `external_drawing` — referenced drawings |
| `UPSTREAM-MACHINE`, `DOWNSTREAM-MACHINE` | `external_machine` — off-page |

---

## Invented ids — what the `our id` badge means

Not printed anywhere on the sheet; the reader is holding the paper and will not find them.

| Shape | Example |
|---|---|
| every `W###` | `W048` |
| `TB-…:<n>` point numbers | `TB-110:3` |
| connector pins on `RECEPT1` / `INFEED1` / `DISCHARGE1` | `DISCHARGE1:4` |
| `NET-…` renames (printed as `PB1`, `PB2`) | `NET-PB1` |

Component ids themselves **are** printed and carry no badge.

---

## Current state of `locations.json`, 2026-08-24

**The placement run is finished for points.** The single-entry snapshot that used to be here was from
2026-08-17 and described a file with one terminal in it; it is gone rather than corrected, because the
shape of the file is what changed and not just the numbers.

| | |
|---|---|
| Schema | 1 · page 1224 × 792 pt |
| Components | **41 ids over 47 sites**, every one `source: human` |
| Terminals | **131 — all of them**, every one `source: human` |
| Terminals with a chosen label side | **52** of 131; the other 79 sit at the default |
| Multi-site components | `CR-BP` (3), `CR-SW`, `CR-ON`, `CR1`, `CR2` (2 each) |
| `wires` / `nets` | **both empty.** Three wire label points and one net label point existed at commit `8f1ae5d` and **were deleted on purpose** — see the index §5a. Not a fault, not work waiting |

**The consequence that matters to everything downstream:** every one of the 71 wires now has two
human-confirmed endpoint terminals, and all 127 net member terminals resolve to human-confirmed
points. Nothing on this sheet falls back to a seed or to a parent any more.

`circuit_logic.json` was regenerated at commit `1ae36ce` and folds all of it in: 41 of 47 components
and **all 131 terminals** carry `"source": "human"`. The 6 components with no `location` are the
`nowhere` six below. Test baseline in that state: **106 server** (105 green plus the artifact test,
which is red exactly while `locations.json` is ahead of the generated file), **127 web**, `ruff` and
`tsc` clean.

**`DISCHARGE1:4`**, the one entry the old snapshot showed at (669.3, 627.2), is now at
**(601.6, 579.9)** with its label to the south. If a test or a note anywhere still quotes the old
pair, that is why.

---

## The ink — `geometry.json`'s conductors and labels

*Added 2026-08-24 for the wires-and-nets work, so that project never opens `geometry.json` either.
All of it is `pages[0]`, in the **same PDF-point space as the tiles and every marker** — there is no
registration step.*

| | |
|---|---|
| `conductors` | **149** polylines, each with `points`, `endpoints`, `node_ids`, `length` |
| multi-segment | **50**, up to 5 segments. `C0008` is a real 4-corner orthogonal route |
| with a printed `net_label` | **70** conductors, **34** distinct label strings |
| with a `spec_label` | **67**, e.g. `BLUE 18AWG` |
| `endpoint_bindings` | per endpoint: which `terminal_point` symbol it lands on, and how far in points |
| `nets` — conductor groups | **111**, of which **34** labelled |
| `symbols` | 98, of which **88** `terminal_point` — the crossover hops, and the hardest-won lesson of the extraction was not to mistake them for terminals |
| `junctions` | **2**. Walking shared `node_ids` to grow a net adds **exactly 0** conductors — measured, not assumed |
| `review_queue` | **278** items: **159** `low_confidence_label` (with `raw_ocr`, `text`, `confidence`, `bbox`) and **119** `incomplete_conductor` (with `endpoints` and which of `net_label`/`spec_label`/`unbound_endpoints` it lacks) |
| text labels | **502** on the sheet, **431** read, **159** flagged low-confidence, **71** of those read as empty |

**Net `120`, the worked example** — four conductors, four wires, specs matching exactly:

| Conductor | Run | Spec |
|---|---|---|
| `C0080` | (379.8, 663.7) → (301.8, 663.7) | BLUE 18AWG |
| `C0081` | (301.8, 639.6) → (426.3, 639.6) | RED 16AWG |
| `C0091` | (562.9, 563.4) → (301.9, 563.4) | RED 16AWG |
| `C0109` | (232.6, 563.4) → (298.2, 563.4) | BLUE 18AWG |

Net 120's four wires are `W052`/`W053` BLUE 18AWG and `W063`/`W068` RED 16AWG.

### The 34 printed net labels, and the nine misreads

These are the strings read off the sheet beside a conductor. **They are not entities** — the netlist's
26 nets are curated and contain no twins — but they are what any conductor-to-wire matching compares
against, and they are why only **17 of 26** nets match a printed conductor group on an exact id test.

    good        +24V  0V  110  120  125  130  24E-1  DINSP1  DINSP2  DIR  GND
                N  N-1  PB1-SP  PB2-SP  RUN  SPD
    misread     LI-A → L1-A          LI-A1 → L1-A1        TINSP1 → IINSP1
                TINSP2 → IINSP2      130. → 130           OV. → 0V
                "GND → GND           PB2 → NET-PB2        C4E-1 → 24E-1
    not labels  +4  4  50  A  U  YY  NOT CONNECTED

`LI-A` for `L1-A` is a capital I read as the digit 1, and it is the pair a human remembers as *"a1
and al"*. **`L1-A` and `L1-A1` are genuinely two different nets** — `DISC1:T1 → CB1:1` and
`CB1:2 → PS1:L1`, with circuit breaker CB1 between them. Merging them would be the error.

### How much of matching a wire to its ink is picking rather than drawing

Each of the 71 wires against conductors whose printed `net_label` equals the wire's net **and** whose
`spec_label` equals its colour and gauge:

| Wires | Candidates | What a human does |
|---|---|---|
| **19** | exactly 1 | glance and confirm |
| **33** | 2 or 3 | say which is which |
| **19** | 0 | choose from the 79 unlabelled conductors, ranked by proximity |

### Totals the wires-and-nets work needs

| | |
|---|---|
| Wire endpoints | **142** — every one a well-formed `COMPONENT:PIN`, **0 dangling** |
| Wires with a colour and gauge | **69** of 71 |
| Net member terminals | **127** across the 26 nets |
| Wire ids printed on the sheet | **none.** `WIRE_IDS_ARE_OURS` is true, so all 71 are `on_sheet: false` and a reader will not find `W052` anywhere. What *is* printed is the spec |

---

## Where the numbers came from

So that a future session can re-derive rather than trust:

- component seeds, pin lists, wires, nets → `circuit_logic.json` (generated from
  `author_circuit_logic.py`)
- conductor and label geometry, the 11 pt screening, `C0142` → `geometry.json` (**do not read in
  full**; query it with a script if a new number is needed)
- page size, DPI, grid → `tiles/tiles.json`
- the `TB-PB2SP` correction → the user's screenshot, cross-checked against `C0142`
- the `CR-BP` and `CR-SW` site candidates → `_claude_notes/drawing_fixes_plan_01.md` §Context
