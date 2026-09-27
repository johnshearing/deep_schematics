## What the reading actually shows

**The drawing shows** net `125` sitting between `CR-BP:A2` and `BYPASS-CB:2` (`circuit_logic.json` → `wires[]` entry for `W048`, and the `nets[]` entry for `125`). `CR-BP:A1` is tied permanently to the `24E-1` bus (`W025`). For the `CR-BP` coil to energize, `A1` must be at 24 V **and** `A2` must be pulled down to 0 V — through the closed `BYPASS 5A` switch (`BYPASS-CB:2→1`, net `120`→`125`) and then through the series contacts `CR2:11-14`→`CR1:11-14` all the way to `0V` (`EXTRACTION_NOTES.md` §"How the circuit actually works").

**24 V measured on net 125 is the wrong reading for a running machine.** If the bypass path were actually complete, net `125` should be pulled down close to `0V`, not sitting at 24 V. A high‑impedance meter reading 24 V there is your source voltage (from `A1` through the de‑energized coil) leaking across an open — it tells you **there is an open somewhere between net 125 and 0V**, not where.

## Candidate path (source: A1, sink you expect: 0V)

```
CR-BP:A1 → net 24E-1 (always 24V, confirmed by design)
CR-BP:A2 → net 125 → W048 → BYPASS-CB:2 ─[BYPASS 5A switch]─ BYPASS-CB:1 → net 120
   → CR2:14 ─[CR2 11-14 contact]─ CR2:11 → net 121
   → CR1:14 ─[CR1 11-14 contact]─ CR1:11 → 0V
```

Any open in that chain leaves `A2` floating high, which is exactly what you're seeing.

## Suspects, ranked

1. **`CR1` or `CR2` N.O. contacts 11‑14 not actually closing**, even though `PB1`/`PB2` are lit green. *Reason:* a lit push button proves its lamp supply is present and that the contact block moved (per the domain rule) — it proves nothing about the CR1/CR2 coil or its 11‑14 contacts downstream. This is the single most likely explanation for 24 V surviving on 125 despite "both buttons green."
2. **`BYPASS-CB` switch contact itself** — mechanically indicating "closed" but not making internal contact (breaker mechanism failed, or the handle position doesn't reflect the internal blades). Ranked second because it's a single point of failure directly in this path and DIN-rail breakers-as-switches do fail this way.
3. **A break in wire `W048`** (CR-BP:A2 to BYPASS-CB:2) or in the conductor from `BYPASS-CB:1` to net `120` — less likely than a contact failure but still on the direct path.
4. **CR1 or CR2 coil itself not energized** (i.e., `PB1`/`PB2` lamp circuit works but the coil circuit is separately broken) — this collapses into suspect 1; same net effect.

## Probe procedure

With power on, buttons "green," bypass switch closed:

1. **Meter black lead on true chassis 0V (e.g. `PS1:-` or `TB-0V`), red lead on net `120`.**
   - Reads ~0V → net 120 is genuinely pulled down; CR1/CR2 contacts are fine, problem is downstream of 120 (suspects 2–3).
   - Reads ~24V (or floating) → net 120 is *not* pulled down; CR1 and/or CR2 contacts are not actually closed despite the green lamps — go to step 2.
2. **Isolate which relay: probe `net 121` (between CR1:14 and CR2:11) against 0V.**
   - ~0V → CR1's contact is closed, CR2's is open → suspect CR2 contact block or its actuator.
   - ~24V → CR1's contact is open → suspect CR1 contact block or its actuator, regardless of what the PB1 lamp shows.
3. **If step 1 showed net 120 at 0V (contacts good):** probe across `BYPASS-CB:1` (net 120) to `BYPASS-CB:2` (net 125) with the switch closed.
   - Significant voltage drop across a closed switch confirms the switch contact is open internally (suspect 2) — replace/inspect `BYPASS-CB`.
   - No drop, but `CR-BP:A2` still reads 24 V → check continuity of `W048` between `BYPASS-CB:2` and `CR-BP:A2` (suspect 3).

## Premise to challenge

"Both push buttons are green" is not evidence that `CR1`/`CR2` are actually latched — per the domain rule, an illuminated PB proves the lamp supply and that the contact block has moved, not that the load-side contact (`11-14`) is actually making up. Given that your 24 V reading on `125` is exactly consistent with net `120` never having been pulled down, I'd verify step 1 before touching the `BYPASS` breaker at all.

## Alternatives eliminated

- **`CR-ON` path (net 110)** is a separate route to `RUN` and doesn't touch net `125` at all — not relevant to this symptom.
- **CB1/CB2** are true over-current protection upstream of the whole 24 V bus; if either had tripped you'd have 0 V on `24E-1` and the lamps wouldn't be lit either. Since the lamps are lit, `24E-1` is healthy — ruled out.
- **Net `130`/`CR-SW`** — off-sheet, only completed by the downstream machine; unrelated to the bypass path and cannot be diagnosed from this sheet.

Net 110 has **4 wires** connecting **8 terminals**.

## Wires on Net 110

| Wire | Colour | Gauge | Endpoint A | Endpoint B | Notes |
|---|---|---|---|---|---|
| W047 | BLUE | 18AWG | CR-ON:A2 | TB-110:3 | |
| W058 | BLUE | 18AWG | CR-SW:14 | TB-110:1 | |
| W059 | BLUE | 16AWG | INFEED1:1 | TB-110:2 | Part of `CABLE-INFEED1` |
| W060 | BLUE | 18AWG | CR-BP:12 | TB-110:4 | |

## Terminals on the net (for reference — 8 total)
`CR-SW:14`, `TB-110:1`, `TB-110:2`, `TB-110:3`, `TB-110:4`, `INFEED1:1`, `CR-ON:A2`, `CR-BP:12`

The drawing shows all four wires as blue, matching **EXTRACTION_NOTES.md**'s note that Q2's expected answer (blue) checks out for this net. Note W059 is 16AWG while the other three are 18AWG — the infeed cable conductor is heavier gauge than the internal panel wiring.

Electrically this implies TB-110 is the physical terminal block where CR-SW's contact, the upstream infeed interface, CR-ON's coil return, and CR-BP's N.C. contact all land in common (per `circuit_logic.json` component description at line 748).
