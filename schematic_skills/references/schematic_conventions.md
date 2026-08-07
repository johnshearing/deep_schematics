# Electrical Schematic & Wiring Diagram Conventions

Reference for interpreting industrial control schematics during extraction. Written against
the Mod-Linx `PS20115MLM4-2` sheet (DraftSight → Teigha PDF export), but the conventions are
standard for industrial point-to-point wiring diagrams.

---

## 1. Two drawing styles, two tracing strategies

| Style | Looks like | How the netlist is recovered |
|---|---|---|
| **Point-to-point wiring diagram** | Long parallel horizontal runs, each with a designator printed above it and colour+gauge below; devices drawn as boxes with numbered terminals | The drawing **names its own nets**. Read the label above each run; connectivity is mostly explicit. Geometry confirms which two endpoints each run joins. |
| **Ladder / elementary schematic** | Vertical power rails with horizontal rungs, contacts and coils in series | Nets must be **inferred topologically** — follow conductors through junctions and merge everything electrically common. |

`PS20115MLM4-2` is the first kind. Prefer the printed net labels; use geometry to confirm
them and to catch runs whose label was missed.

---

## 2. The label-above / spec-below convention

```
        24E-1                <- net or cable designator (ABOVE the line)
  ──────────────────────     <- the conductor
        BLUE 18AWG           <- wire colour and gauge (BELOW the line)
```

- The **designator above** is the net name (`110`, `120`, `125`, `130`, `0V`, `24V`, `RUN`,
  `DIR`, `SPD`, `L1-A`, `N-1`) or the cable name (`24E-1`).
- The **spec below** is always `COLOUR GAUGE`, e.g. `WHITE/BLUE 18AWG`.
- Adjacent parallel runs sit only ~10 pt apart, so the spec of the run above and the
  designator of the run below occupy nearly the same band. **Attaching labels by nearest
  distance alone will cross-assign them.** Gate by label kind (a `COLOUR GAUGE` string is
  never a net name) and assign each label to exactly one conductor.

---

## 3. Component designator prefixes

| Prefix | Device | Notes |
|---|---|---|
| `CR`, `CR-xx` | Control relay | `CR1`, `CR2`, `CR-ON`, `CR-BP`, `CR-SW`. Suffix is usually functional, not sequential. |
| `CB` | Circuit breaker | `CB1`, `CB2`. See §7 — a breaker is not always protection. |
| `PB` | Push button | `PB1`, `PB2`; often lighted start/stop switches. |
| `PS` | Power supply | `PS1` = 115VAC → 24VDC. |
| `PLG`, `P` | Plug / connector | `PLG1`, `PLG2`. |
| `DISC` | Disconnect switch | Panel disconnect. |
| `TB`, `TERMINAL` | Terminal block | Drawn as a tall rectangle of terminal points. |
| `FU`, `F` | Fuse | |
| `M` | Motor / drive | MDR drive cards on this family of machines. |
| `SPD` | Speed controller | |
| `LT` | Indicator light | |
| `GND`, `PE` | Ground / protective earth | |

Use the **drawing's exact designator** as the canonical entity name. Put the plain-language
name (`bypass relay`) in `aliases` and `description` so a troubleshooting manual's prose
links to the same graph node.

---

## 4. Symbol shapes as they appear in vector geometry

| Symbol | Drawn as | Geometry signature |
|---|---|---|
| Relay coil | Circle with `A1` / `A2` either side | Bezier-only path group, near-square bbox, ~8–13 pt diameter |
| Terminal point | Small open circle on a terminal strip | Bezier-only group, ~3–4 pt diameter |
| Relay contact (N.O.) | Two short leads with a diagonal break, numbered `11`/`14` | Short strokes; identify by the flanking terminal numbers |
| Relay contact (N.C.) | As above with a bar across the break, `11`/`12` | Vision must distinguish N.O. from N.C. |
| Circuit breaker | Two terminals `1`/`2` with a break symbol | Labelled `nAMP CIRCUIT BREAKER` above |
| Terminal block | Tall rectangle enclosing a vertical bus with terminal circles | Closed loop in the conductor graph, not a wire |
| Cable / harness | Long thin ellipse drawn across a wire bundle | Bezier group, very high aspect ratio |
| Ground | Stacked horizontal bars | |
| Receptacle / plug | Box with numbered pins and arrowheads | Arrowheads are the few filled shapes on the sheet |

Circle diameter is the reliable discriminator: **small circle = terminal point, large circle
= device (coil, lamp, meter)**. Which device it is must be confirmed visually.

---

## 5. Terminal numbering

| Marking | Meaning |
|---|---|
| `A1`, `A2` | Relay/contactor **coil** terminals |
| `11`, `12`, `14` | Contact set 1: `11` common, `12` N.C., `14` N.O. |
| `21`, `22`, `24` | Contact set 2, same pattern |
| `1`, `2` | Two-terminal device (breaker, switch) |
| `L1`, `L2`, `L3` | Line (phase) |
| `N` | Neutral |
| `G`, `GND`, `PE` | Ground |
| `+24V`, `0V` | DC supply and common return |

The `11/12/14` triple is what makes `COIL_CONTROLS_CONTACT` derivable: terminals `A1`/`A2`
belong to the coil, and `11`/`12`/`14` on the *same designator* are the contacts that coil
operates — even though the drawing may place them far apart on the sheet.

---

## 6. Junction vs crossover — the main accuracy risk

Two wires whose lines cross may or may not be connected.

- **Connected**: a solid dot at the intersection, or the drawing simply terminates one
  conductor on the other (a T, giving a degree-3 node in the conductor graph).
- **Not connected**: a plain crossing (degree-4 node with two collinear pairs), or a hop/bridge
  arc over the crossed wire.

Rules used by `extract.py`:
- A node of degree ≥ 3 is reported as a junction.
- A degree-4 node whose four legs form two collinear pairs is a **crossover, not a junction**,
  and must not merge the two nets.
- On this drawing style, crossovers are rare because runs terminate at terminal blocks
  instead of tapping mid-run — but **every junction must still be confirmed visually**. A
  wrong junction merges two nets and produces confidently wrong answers.

---

## 7. Domain gotchas that are not visible on the drawing

- **A circuit breaker used as a switch.** On this machine family the `REVERSE 5AMP` and
  `BYPASS 5AMP` breakers are used as **manual switches**, not over-current protection
  (they DIN-rail mount conveniently). Keep `class: "circuit_breaker"` because that is the
  physical part, but the `function`/`description` must say it is used as a switch, and the
  edges must be `ACTUATES`-style gating of a control path — **not** `PROTECTS`. Only `CB1`,
  `CB2` and the supply's own protection are genuine over-current devices.
- **Off-page nets.** Designators leaving the sheet (to `MXCS-M9`, `MXCS-M11`, `MXCS-P9`,
  `MXCS-P11`, or "previous machine" / "subordinate machine") must be modelled explicitly as
  boundary entities with a `REFERENCES` edge. Otherwise the graph silently fragments and a
  query gets a confident half-answer instead of "this continues on drawing X".
- **Bus nets.** `0V`, `24V` and ground appear all over the sheet in disconnected fragments.
  They are one net each. Merging by printed designator is what stitches them together.

---

## 8. Wire colour / gauge vocabulary

Colours seen: `BLACK`, `WHITE`, `BLUE`, `GREEN`, `RED`, `ORANGE`, `BROWN`, `GREY`,
plus compounds written with a slash: `WHITE/BLUE`.

Gauges: `10AWG`, `12AWG`, `16AWG`, `18AWG`, `22AWG` (standard set also includes 8, 14, 20, 24).

Rough convention on this drawing: heavier gauge = 115VAC power (10–12AWG), 16–18AWG = 24VDC
distribution, 22AWG = control/signal.

---

## 9. OCR gotchas specific to CAD stroke fonts

Many CAD PDFs — including this one — contain **no font text at all**: every character is
plotted as line geometry. `page.get_text()` returns an empty string, and labels can only be
recovered by clustering the short strokes and OCRing the rendered crop.

Recurring misreads and their fixes (all handled by `extract.py`, all worth double-checking
by eye):

| Reads as | Actually | Cause |
|---|---|---|
| `CR-DN`, `MDD-LINX` | `CR-ON`, `MOD-LINX` | The font's `O` is slashed, so it looks like `D` or `0` |
| `OV` | `0V` | Same slashed-zero confusion, inverted |
| `10AVG`, `1GAWG` | `10AWG`, `16AWG` | `W`→`V`, `6`→`G` |
| `ALL` | `A1` | Short token fuzzy-matched against a prose dictionary — never fuzzy-match tokens of 3 characters or fewer |
| `4E-1` | `24E-1` | Leading glyph fell outside the clustered bounding box |
| `10` | `110` | Same, one digit clipped |

Numeric labels are the highest-risk category: they are short, they carry the net identity,
and a single wrong digit silently rewires the graph. Verify every net designator visually.
