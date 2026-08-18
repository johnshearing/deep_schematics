# Facts about PS20115MLM4-2 that the tests need

Index: `locate_tab_instruction_and_test_manual.md`.

**This file exists so nobody ever has to read `geometry.json`** (608 KB, about 150,000 tokens — the
cost of ~300 full test runs) **or `circuit_logic.json`** (large) to run or diagnose a test. Every
number below was read out of those files on 2026-08-17 and is stated once, here.

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

**Accuracy of the seed points.** Screened against every wire endpoint, terminal dot and junction in
`geometry.json`, the 41 located components have a median error of **11 pt**, with **17 over 15 pt**
and **10 over 25 pt**. Against 16 pt rows, that is a coin flip on which row. This is the measurement
that justifies the whole editor.

---

## The relays — the interesting cases

All five have their coil in the right-hand column and at least one contact elsewhere.
`loc` is the **seed** point in `circuit_logic.json`, i.e. the vision pass's guess.

| Component | seed `loc` | pins | notes |
|---|---|---|---|
| `CR-BP` | (861, 679) | `A1 A2 11 12 21 24` | **Drawn three times.** The hard case; see below |
| `CR-SW` | (861, 704) | `A1 A2 11 14` | Drawn twice. The reported fault: `CR-SW:14` flew to the coil |
| `CR-ON` | (861, 464) | `A1 A2 11 14` | `CR-ON:A2` should get its own point near **(870, 468)** |
| `CR1` | (861, 332) | `A1 A2 11 14` | |
| `CR2` | — | `A1 A2 11 14` | |

### `CR-BP`'s three sites

The worked example for T-21x. Coordinates are **from the earlier investigation and are candidates,
not confirmed** — place them by eye and treat these as "look here".

| Site | Pins | Roughly | Evidence |
|---|---|---|---|
| coil | `A1`, `A2` | (861, 679) | the seed point |
| NC contact | `11`, `12` | (714, 520) | a printed `CR-BP` label there |
| NO contact | `21`, `24` | (592, 223) | a printed `CR-BP` label, plus a `24` at (602, 236) |

`11` and `21` are **both** function `common`. That is why pin assignment is a human act: no rule over
function can separate them.

### `CR-SW`'s two sites

| Site | Pins | Roughly |
|---|---|---|
| coil | `A1`, `A2` | (861, 704) — the seed point |
| contact | `11`, `14` | **(569, 473)** — about eight inches from the coil |

---

## Terminal blocks worth knowing

| Component | seed `loc` | pins |
|---|---|---|
| `TB-PB2SP` | (196, 382) | `1` |
| `TB-PB1SP` | (196, 282) | `1` |
| `TB-110` | (781, 500) | `1 2 3 4` |
| `BYPASS-CB` | (385, 664) | |
| `INFEED1` | (620, 560) | `1 …` |
| `DISCHARGE1` | (760, 560) | `1 2 3 4 5 6` |
| `RECEPT1` | (980, 150) | |

### `TB-PB2SP` — the original bug report

The seed says **(196, 382)**. The correct terminal dot is at **(154.5, 348.3)** — one and a half
conductor rows up, on the `PB2-SP` white 22AWG run. Evidence: `geometry.json` conductor `C0142`,
printed net label `PB2-SP`, running at y = 348.3 from x = 143.6 to 252.6, with terminal point `1`
at (154.5, 348.3). This is the point the user's own screenshot identified, so it is human authority
and needs no re-derivation.

`TB-PB1SP` shows the same kind of error. **It has not been measured** — place it by eye.

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

## Current state of `locations.json`

As of 2026-08-17, one entry:

```json
{
  "drawing_number": "PS20115MLM4-2",
  "schema": 1,
  "page_size_pt": [1224, 792],
  "components": {},
  "terminals": {
    "DISCHARGE1:4": { "point": [669.3, 627.2], "source": "human", "by": "js",
                      "at": "2026-08-17T18:21:01.004Z" }
  },
  "wires": {},
  "nets": {}
}
```

`circuit_logic.json` has been regenerated to match, so `DISCHARGE1:4` carries
`"location": {"x": 669.3, "y": 627.2, "source": "human"}` and nothing else has a `location` beyond
its seed. All 105 server tests pass in that state.

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
