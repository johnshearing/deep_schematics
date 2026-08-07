# Extraction Notes — PS20115MLM4-2

Audit trail for `circuit_logic.json`. Extraction date: 2026-07-26.

| Artifact | What it is |
|---|---|
| `geometry.json` | Deterministic output of `schematic_skills/scripts/extract.py` (`--layers SCHEMATIC`) |
| `tiles/` | 16 overlapping 400 DPI renders — the vision pass read all of them |
| `author_circuit_logic.py` | The human-read tables + derivation of the mechanical edges |
| `circuit_logic.json` | The master artifact (47 components, 131 terminals, 26 nets, 71 wires, 402 edges) |
| `custom_kg.json` | LightRAG custom KG (693 chunks, 291 entities, 402 relationships) |

Re-run after correcting any reading: `python author_circuit_logic.py`, then `build_kg.py`.

---

## Corrections to earlier assumptions

1. **The PDF contains no text.** Exported by DraftSight/Teigha with all text stroked as
   geometry. `page.get_text()` returns an empty string. Every label here was read visually
   from the tiles; the OCR in `geometry.json` was a cross-check only.

2. **"Revision D" is wrong — D is the sheet size.** The title block has a `SIZE` box
   containing `D` and no revision field. The only revision information on the sheet is a
   stamp: *"REVISED — destroy previous drawing with the same number. DATE: 04/08/2020."*
   `revision` is therefore recorded as `null`.

3. **The company is CONVEYX CORP, not "Convex Corp."**

4. **The drawing date is 9/19/2017 3:07:13 PM**, revised 04/08/2020 (which matches the PDF's
   own creation date).

5. **The small circles on wire runs are crossover hops, not terminals.** `extract.py`
   classified all 88 as `terminal_point` because it only sees a small circle. Where a
   horizontal run crosses vertical trunk wires the drawing puts a semicircular hop arc
   meaning *no connection*. Genuine terminal points appear only inside terminal-block
   rectangles. This is the junction-vs-crossover risk the skill warns about, and it is the
   single most important thing a vision pass has to catch here.

6. **Every long run is labelled twice, sometimes with two different colours.** The callout
   near the panel device gives the panel wire colour; the callout near a receptacle gives the
   cordset conductor colour. Examples: the DIR run reads `GREEN 18AWG` at terminal DIR and
   `GREY 18AWG` at the receptacle; the SPD run reads `BLUE 18AWG` then `BROWN 18AWG`; the
   24E-1 run to the receptacle reads `RED 18AWG` then `BLUE 18AWG`. Both callouts are
   recorded in the wire's `description`.

---

## How the circuit actually works

- **115VAC in** → PLG1/PLG2 (paralleled) → L1/N/GND terminals → DISC1 (poles L1-T1 and
  L3-T3; L2-T2 spare) → CB1 (8A) → PS1.
- **24VDC** → PS1:+ → CB2 (20A) → net `24E-1`, the whole DC bus. PS1's two minus terminals
  establish `0V`.
- **Start/stop chain:** PB1 → CR1 coil, PB2 → CR2 coil. The CR1 and CR2 N.O. contacts are
  wired **in series**: `0V` → CR1:11-14 → net `121` → CR2:11-14 → net `120`. So net 120 is
  pulled to 0V only when *both* buttons are on.
- **Bypass:** CR-BP coil sits between `24E-1` (A1) and net `125` (A2); the BYPASS 5A
  breaker-used-as-switch links `125` to `120`. CR-BP therefore energizes only when both
  buttons are on **and** the bypass switch is closed — which matches John's expected answer
  to §8.1 Q8 exactly.
- **Run:** the `RUN` net is driven to 24VDC by *either* CR-ON:11-14 *or* CR-BP:21-24, and
  leaves via receptacle pin 3 to the drive cards.
- **CR-ON** energizes when net `110` is pulled to 0V — by CR-SW:11-14, or by the infeed
  machine, or through CR-BP's N.C. contact from net `111`.
- **CR-SW** returns through net `130`, which only completes via the *downstream* machine.
  Nothing on this sheet can energize it — consistent with John's expected answers to Q7/Q12.

### Verification against John's ground truth (plan §8.1)

Q1 asked what wire 110 connects to. Expected: CR-SW:14, terminal 110, wire 111 of the
previous machine, CR-ON:A2, CR-BP:12. Extracted net `110` members:
`CR-SW:14`, `TB-110:1..4`, `INFEED1:1`, `CR-ON:A2`, `CR-BP:12` — an exact match, including
the off-page infeed connection. Q2 (blue), Q4/Q17 (two switches, PB1/PB2), Q27 (five relays),
Q28 (CB1 8A, CB2 20A, REVERSE 5A, BYPASS 5A) also match.

---

## Inferences and open uncertainties

Flagged so a reviewer can challenge them:

1. **Receptacle pin numbers are inferred, not printed.** The 5-pin micro receptacle's pins
   are drawn as arrows with no numbers. Conductor colours are brown/grey/black/white/blue —
   the standard M12 5-pin cordset code (1 brown, 2 white, 3 blue, 4 black, 5 grey). Terminals
   are numbered `RECEPT1:1..5` in **drawing order top to bottom** (SPD, DIR, RUN, 0V, 24E-1);
   the standard-code mapping is noted in the component description. Same for the 6-pin
   infeed/discharge interfaces.

2. **Terminal-block point numbering is ours.** Blocks like `TB-0V` and `TB-24E1-A` show one
   marked circle and land the rest of their wires on the box edge. Point numbers are assigned
   in drawing order top to bottom. `TB-0V` is modelled with 12 points; the exact physical
   count is not determinable from the sheet.

3. **The two ground terminal blocks are modelled as one `GND` net.** `TB-GND-A` (plug
   grounds) and `TB-GND-B` (door + PS1 chassis) each carry their own earth symbol. They are
   electrically common through earth, but the drawing shows no wire directly between them.

4. **PB terminal 2 is landed, not floating.** John's §8.1 Q18 says PB terminal 2 is "not
   connected." The drawing does route it — white 22AWG to a terminal marked `PB1-SP` /
   `PB2-SP`. That terminal goes nowhere else on this sheet, so both readings agree in
   substance; the netlist records the wire that is actually drawn.

5. **Nets renamed to avoid collisions.** The drawing prints the CR1/CR2 coil feed nets as
   `PB1` and `PB2`, which are already the push-button component names. They are stored as
   `NET-PB1` / `NET-PB2`, with the printed designator stated in the description.

6. **Not net-assigned, by design:** `DISC1:L2`, `DISC1:T2` (the disconnect's spare third
   pole) and `LT1:BROWN`, `LT1:WHITE` (explicitly "NOT CONNECTED" on the drawing, to be cut
   back and heat-shrunk).

7. **The REVERSE and BYPASS 5A breakers are modelled as switches**, per the domain
   correction in plan §8: `class` stays `circuit_breaker` (that is the physical part) but
   their function text says they are used as manual switches and they carry `ACTUATES`
   edges, not `PROTECTS`. Only CB1 and CB2 are true over-current devices.
