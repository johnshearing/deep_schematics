Also need PB1:1 supply source (24VDC feed) — but that's incidental (assume PB1/PB2 fed from `24E-1` via CB2, which the notes already state). That's enough to write the full answer.

## Answer

With the machine standing alone — no infeed and no discharge cable connected — **the only path that can energize `RUN` is the bypass path through `CR-BP`.** The other path, through `CR-ON`, is structurally dead-ended on an isolated machine. Here is why, and the full chain that does work.

### Why the `CR-ON` path is unavailable

`RUN` (`RUN`) is driven to 24VDC by either of two contacts:

- `CR-ON:14` (via `CR-ON`'s N.O. contact `CR-ON:11`-`CR-ON:14`)
- `CR-BP:24` (via `CR-BP`'s N.O. contact `CR-BP:21`-`CR-BP:24`)

`CR-ON` energizes only when net `110` is pulled down to `0V`, and the drawing shows exactly three ways that can happen:

1. `CR-SW:11`-`CR-SW:14` closing — but `CR-SW`'s coil return is net `130`, which "only completes via the downstream machine" (per `EXTRACTION_NOTES.md`, confirming John's expected answer). With nothing on the discharge interface, `CR-SW` can never energize.
2. A direct wire from the infeed machine at `INFEED1:1` — unavailable with no infeed connected.
3. `CR-BP`'s N.C. contact `CR-BP:11`-`CR-BP:12` linking net `111` back to net `110` — but net `111` terminates at `DISCHARGE1:1`, going nowhere without a downstream machine to ground it.

So on an isolated machine, nothing can pull net `110` low, `CR-ON` cannot energize, and the `CR-ON:14`→`RUN` route is dead.

### The chain that does energize `RUN`: the bypass path

| Step | Component / net | What happens |
|---|---|---|
| 1 | `PB1` | Operator presses/holds start button `PB1`; its switched output at `PB1:4` feeds net `NET-PB1` (printed on the sheet as `PB1`) to `CR1:A1`. |
| 2 | `CR1` | Coil `CR1:A1`/`CR1:A2` energizes (`CR1:A2` returns to `0V`). Its N.O. contact `CR1:11`-`CR1:14` closes, pulling net `121` toward `0V` through `CR1:11`. |
| 3 | `PB2` | Operator presses/holds start button `PB2`; its switched output at `PB2:4` feeds net `NET-PB2` to `CR2:A1`. |
| 4 | `CR2` | Coil `CR2:A1`/`CR2:A2` energizes (`CR2:A2` on `0V`). Its N.O. contact `CR2:11`-`CR2:14` closes. `CR2:11` is on net `121` (now at `0V` from step 2), so `CR2:14` pulls net `120` to `0V`. **Both `CR1` and `CR2` contacts are in series, so both push buttons must be actuated together for net `120` to reach `0V`.** |
| 5 | `BYPASS-CB` | The bypass 5A unit is a manual switch, not protection. The operator must have it closed. Net `120` (now at `0V`) passes through `BYPASS-CB:1`→`BYPASS-CB:2` to net `125`. |
| 6 | `CR-BP` | Coil `CR-BP:A1` (fed from `24E-1`) / `CR-BP:A2` (now at `0V` via net `125`) energizes. Its N.O. contact `CR-BP:21`-`CR-BP:24` closes: `CR-BP:21` is on `24E-1`, so `CR-BP:24` puts 24VDC on net `RUN`. |
| 7 | `RUN` | Net `RUN` reaches receptacle pin 3, terminal `RECEPT1:3` (pin numbering inferred, not printed — inference 1 in `EXTRACTION_NOTES.md`), out to the drive cards. The machine runs. |

### Summary of the required conditions, all simultaneous

1. `PB1` held/latched on → `CR1` energized.
2. `PB2` held/latched on → `CR2` energized (both required — net `121` and net `120` are in series).
3. `BYPASS-CB` closed (operator manually selects bypass).
4. `24E-1` and `0V` present (from `PS1`/`CB2`, assumed healthy and out of scope of this question).

No path through `CR-ON`/`CR-SW`/infeed/discharge can contribute on an isolated machine — that entire branch is inert here.

## Sources
- `EXTRACTION_NOTES.md` — "How the circuit actually works," inference 1 (receptacle pins).
- `circuit_logic.json` → `nets[]` entries for `RUN`, `110`, `111`, `120`, `121`, `125`, `24E-1`, `0V`, `NET-PB1`.
- `circuit_logic.json` → `components[]` entries for `PB1`, `PB2`, `CR1`, `CR2`, `CR-BP`, `CR-ON`, `CR-SW`, `BYPASS-CB`.
