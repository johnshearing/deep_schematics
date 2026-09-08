/**
 * What the ink says a wire's ends land on — **the proposal, and never the decision.**
 *
 * The sibling of `paths.ts`'s `candidates()`, one layer down. That one asks *which run of ink is
 * this wire*; this one asks *which terminal does this wire actually reach*, which is the question
 * the `W` table answered by allocating screw numbers as it was typed. 11 of this drawing's 71
 * wires are on the wrong screw because of it, 13 more cannot be settled from the ink at all, and
 * 47 are right — measured, in `_claude_notes/authoring_the_wires.md` §3.
 *
 * ### The one rule that makes this correct rather than nearly correct
 *
 * **A run's landing is where it *leaves* the commoning geometry, not where its polyline ends.**
 *
 * A terminal block's own bus is fused into some wire polylines, because the extractor splits a
 * conductor only at a crossover hop and a T-junction is not one. `C0105` is a single conductor
 * containing `DISCHARGE1:2`'s wire **and** the whole 279.6 pt vertical of `TB-0V`'s commoning: its
 * polyline *ends* beside row 1 while the wire joins the block at row 12, 114 pt and seven landings
 * away. Read the endpoint naively and four wires are mis-proposed — which is exactly how
 * `07_drawing_facts.md` came to say `W063` ends on `TB-120:2`.
 *
 * So a run that passes within `ON_INK_PT` of **two or more terminals of one component** is running
 * along that component's bus over that stretch, and an end of the polyline that sits inside such a
 * stretch is not a landing: the landing is where the stretch ends. A run that is *nothing but*
 * commoning — `C0092`, `C0086`, `C0010` — proposes nothing at all, which is the executable form of
 * the finding that **`C0092` is `TB-120`'s commoning and no wire may claim it.**
 *
 * That test is a statement about **shapes** and not about this drawing: nothing here knows what a
 * `TB-` prefix is, and it would find the same thing on the next schematic. Measured against the
 * real sheet it recovers exactly the 8 commoning conductors §3.6 lists by hand.
 *
 * ### Why the ranking is geometry and nothing else
 *
 * `paths.ts` ranks on the geometry first and the printed name second. Here the printed name is not
 * a weaker signal, it is **an answer to a different question**: the name beside a run is its
 * *net*, and every point of a terminal block is on the same net, so a printed `0V` cannot tell row
 * 3 from row 8. The screw number exists nowhere on the paper — the user confirmed it, and §3.4
 * proved renumbering cannot be the fix. The only thing that can say which of twelve rows a run
 * lands on is where the ink stops, against pins a person placed, on rows **16 pt** apart.
 *
 * So candidates are ordered by **fit** — the worse of the two landing distances — and then by id
 * so the list is stable. The names are carried on the proposal for a person to read, and are not
 * ranked on.
 *
 * ### What it does not do
 *
 * It does not accept, and it must be able to say **nothing**. `W042` is the case the whole phase
 * is checked against: `PB2:3 → TB-0V:6` is **right in the data and wrong on the paper** — the run
 * stops at the west side of the block instead of reaching the commoning line, which is the
 * drawing's own error and the user spotted it before any of this was measured. There is no ink
 * within reach of `TB-0V:6`, so this module offers nothing for it, and a screen that trained
 * somebody to accept the proposal would be worse than no screen.
 *
 * ### Pure, and handed the payload
 *
 * No store, no React, no fetch. The conductors come from `GET /api/conductors` and the terminal
 * points from `/api/designators`, so the whole of this is arithmetic over two payloads and
 * `wiring.test.ts` asserts it as such — including, wire by wire, that it reproduces all eleven
 * corrections §3.2 names and contradicts the netlist on none of the wires §3 found to be right.
 */

import type { Conductor } from '@/api/types'

/**
 * How close a placed pin has to be to the ink, perpendicular, to count as being **on** it.
 *
 * **4 pt against conductor rows 16 pt apart.** A quarter of a row cannot reach the wrong row,
 * which is the only property that matters: the whole defect this module exists to find is a
 * landing read one row out. It is also generous next to what has been measured — every pairing in
 * `07_drawing_facts.md` sits within 2 pt of its pins.
 */
export const ON_INK_PT = 4

/**
 * How far along the run, in points, a pin may sit from an end and still be that end's landing.
 *
 * A run stops a little short of the pin it serves — the ink ends where the extractor says it ends,
 * and the dot is where a person put it. 30 pt is about two rows of slack along the *length* of a
 * run, where being loose costs nothing, while `ON_INK_PT` stays tight across it, where being
 * loose would cost everything.
 */
export const LANDING_PT = 30

/**
 * Two ends of ink this close together, neither of them landing on a pin, are one continuous run.
 *
 * That is a corner the extractor split, or a **crossover hop** — this sheet has 88 of them, and
 * mistaking one for a terminal was the hardest-won lesson of the whole extraction. `W069` is why
 * this constant exists: its ink is `C0117` plus `C0017` with a **3.5 pt** gap between them, and
 * without the join its correction to `TB-130:1` is unfindable.
 */
export const JOIN_PT = 6

/** A placed terminal, as `/api/designators` publishes one. */
export interface TerminalPoint {
  id: string
  point: [number, number]
}

/** Why a proposal is what it is, in the words the panel shows. */
export type Landed =
  /** One conductor, end to end. */
  | 'one run'
  /** Two or more, joined across a corner or a crossover hop. */
  | 'chained'
  /**
   * The landing was read where the run **leaves** a block's commoning rather than at the
   * polyline's end. The tag exists so the one refinement that makes this correct is visible on
   * screen rather than buried in this file — it is what puts `W067` on `TB-0V:12` and not row 1.
   */
  | 'past the commoning'
  /** The net name printed beside the ink is the one this terminal is on. Carried, not ranked on. */
  | 'printed name'
  /** …and it is a name a **person** read off the paper and corrected. */
  | 'corrected name'

/** One thing the ink says: *start at that terminal, follow the conductor, and you arrive here.* */
export interface Landing {
  /** The terminal the ink arrives at. */
  terminal: string
  /** The conductors walked, in order, starting from the terminal the walk began at. */
  conductors: string[]
  /**
   * The worse of the two landing distances, in points — so smaller is a better fit. This is the
   * whole of the ranking, and the file header says why the printed name is not part of it.
   */
  fit: number
  reasons: Landed[]
  /** What the sheet prints beside the run, for a person to read. Null where nothing is bound —
   * which is 79 of the 149 runs, and a blank rather than a mistake. */
  netLabel: string | null
  specLabel: string | null
}

/** The ink, indexed once: which pins are on which run, where each run really ends, and which
 * stretches of it are a block's own bus. Build it once per payload — see `inkIndex`. */
export interface InkIndex {
  runs: IndexedRun[]
  /** Component id → the conductors running along that component's bus. §3.6's eight, found by
   * shape. Phase C will author these; this is what will propose them. */
  commoning: Record<string, string[]>
}

interface IndexedRun {
  id: string
  points: [number, number][]
  length: number
  netLabel: string | null
  specLabel: string | null
  /** True where a person corrected the printed name on the Review tab (`Conductor.was`). */
  corrected: boolean
  /** Terminal id → how far off the ink it is, and how far along. */
  on: Record<string, { off: number; along: number }>
  /** The two ends as they should be read: arc position, coordinate, and what lands there. */
  ends: RunEnd[]
  /** Nothing but a block's bus. Proposes nothing, and `C0092` is the worked example. */
  onlyCommoning: boolean
  /** True where either end had to be moved inward past a commoning stretch. */
  trimmed: boolean
}

interface RunEnd {
  along: number
  point: [number, number]
  terminal: string | null
  off: number
}

/**
 * Index the ink for a whole drawing. **Do this once per payload, not once per wire.**
 *
 * 149 runs against 131 pins is about twenty thousand projections, which is nothing — but doing it
 * inside the panel's render would do it again on every hover, so the caller memoises this and
 * calls `proposalsFor` per wire.
 */
export function inkIndex(
  conductors: readonly Conductor[],
  terminals: readonly TerminalPoint[],
): InkIndex {
  const runs: IndexedRun[] = []
  for (const conductor of conductors) {
    const points = usable(conductor)
    if (points.length < 2) continue
    runs.push(index(conductor, points, terminals))
  }

  const commoning: Record<string, string[]> = {}
  for (const run of runs) {
    for (const component of Object.keys(stretches(run))) {
      commoning[component] = [...(commoning[component] ?? []), run.id]
    }
  }
  return { runs, commoning }
}

/**
 * What the ink says about a wire's two ends, given whatever they are today.
 *
 * **The proposal for one end comes from walking the ink that starts at the other**, which is the
 * whole shape of the answer: a wire's component end is the one the indexing pass read off a
 * printed callout and its block end is the one it allocated, so following the conductor away from
 * the end that is trustworthy is what names the end that is not. Both directions are offered,
 * because nothing here knows which of a wire's two ends is the block.
 *
 * An end with no terminal set gets no proposals, and neither does an end whose partner is unset —
 * there is nowhere to start the walk from. That is honest rather than unhelpful: `Pick from the
 * sheet` is what a wire with two empty slots needs.
 */
export function proposalsFor(
  index: InkIndex,
  ends: readonly [string | null, string | null],
): { from: Landing[]; to: Landing[] } {
  const [from, to] = ends
  return {
    from: to ? landingsFrom(index, to) : [],
    to: from ? landingsFrom(index, from) : [],
  }
}

/**
 * Every terminal the ink joins this one to, best fit first.
 *
 * Walks out along each run that lands on `terminal`, through unterminated ends that meet within
 * `JOIN_PT`, and stops at the first pin it reaches. A junction with more than one candidate
 * onward stops the walk: three ways out of a corner is not a run, it is a guess, and this module
 * does not guess. That is what leaves `W031` to be settled by a person rather than by arithmetic.
 *
 * Deduplicated by arrival, so a terminal reached two ways is one proposal with its better fit.
 */
export function landingsFrom(index: InkIndex, terminal: string): Landing[] {
  const out: Landing[] = []
  for (const run of index.runs) {
    if (run.onlyCommoning) continue
    for (let side = 0; side < run.ends.length; side += 1) {
      if (run.ends[side].terminal !== terminal) continue
      const walked = walk(index, run, side)
      if (!walked || walked.arrival.terminal === null) continue
      if (walked.arrival.terminal === terminal) continue
      out.push(landing(run, side, walked))
    }
  }

  out.sort(
    (a, b) =>
      a.fit - b.fit ||
      a.conductors.length - b.conductors.length ||
      (a.terminal < b.terminal ? -1 : a.terminal > b.terminal ? 1 : 0),
  )

  const seen = new Set<string>()
  return out.filter((one) => (seen.has(one.terminal) ? false : (seen.add(one.terminal), true)))
}

/** Whether this conductor is a terminal block's own bus and no wire may claim it. `C0092` is the
 * one the plan names, and this is that finding as a predicate rather than a comment. */
export function isCommoning(index: InkIndex, conductor: string): boolean {
  return index.runs.some((run) => run.id === conductor && run.onlyCommoning)
}

// -- the arithmetic ------------------------------------------------------------------------

function landing(
  run: IndexedRun,
  side: number,
  walked: { chain: IndexedRun[]; arrival: RunEnd },
): Landing {
  const { chain, arrival } = walked
  const reasons: Landed[] = [chain.length > 1 ? 'chained' : 'one run']
  if (chain.some((piece) => piece.trimmed)) reasons.push('past the commoning')
  const named = chain.find((piece) => piece.netLabel)
  if (named) reasons.push(named.corrected ? 'corrected name' : 'printed name')
  return {
    terminal: arrival.terminal as string,
    conductors: chain.map((piece) => piece.id),
    fit: round(Math.max(run.ends[side].off, arrival.off)),
    reasons,
    netLabel: named?.netLabel ?? null,
    specLabel: chain.find((piece) => piece.specLabel)?.specLabel ?? null,
  }
}

/** Follow the ink outward from one end of one run. */
function walk(
  index: InkIndex,
  start: IndexedRun,
  side: number,
): { chain: IndexedRun[]; arrival: RunEnd } | null {
  const chain = [start]
  let far = 1 - side
  for (;;) {
    const end = chain[chain.length - 1].ends[far]
    if (end.terminal !== null) return { chain, arrival: end }
    const onward = joinable(index, chain[chain.length - 1], far, chain)
    // More than one way on is a junction rather than a run, and this module does not guess.
    if (onward.length !== 1) return null
    chain.push(onward[0].run)
    far = 1 - onward[0].side
  }
}

function joinable(
  index: InkIndex,
  run: IndexedRun,
  side: number,
  chain: readonly IndexedRun[],
): { run: IndexedRun; side: number }[] {
  const at = run.ends[side].point
  const out: { run: IndexedRun; side: number }[] = []
  for (const other of index.runs) {
    if (other.onlyCommoning || other === run || chain.includes(other)) continue
    for (let i = 0; i < other.ends.length; i += 1) {
      if (other.ends[i].terminal !== null) continue
      if (gap(at, other.ends[i].point) <= JOIN_PT) out.push({ run: other, side: i })
    }
  }
  return out
}

function index(
  conductor: Conductor,
  points: [number, number][],
  terminals: readonly TerminalPoint[],
): IndexedRun {
  const length = polylineLength(points)
  const on: Record<string, { off: number; along: number }> = {}
  for (const terminal of terminals) {
    const hit = project(terminal.point, points)
    if (hit.off <= ON_INK_PT) on[terminal.id] = hit
  }

  const run: IndexedRun = {
    id: conductor.id,
    points,
    length,
    netLabel: conductor.net_label?.trim() || null,
    specLabel: conductor.spec_label?.trim() || null,
    corrected: Boolean(conductor.was),
    on,
    ends: [],
    onlyCommoning: false,
    trimmed: false,
  }

  /**
   * The effective ends — **the whole of the commoning rule.**
   *
   * From arc 0 walk forward past the far boundary of any commoning stretch the end sits in, and
   * from the far end walk backward the same way, until neither moves. If the two meet or cross,
   * the run is nothing but bus and lands on nothing.
   */
  const spans = Object.values(stretches(run))
  let lo = 0
  for (;;) {
    const next = Math.max(
      lo,
      ...spans.filter(([a, b]) => a - ON_INK_PT <= lo && lo <= b + ON_INK_PT).map(([, b]) => b),
    )
    if (next <= lo) break
    lo = next
  }
  let hi = length
  for (;;) {
    const next = Math.min(
      hi,
      ...spans.filter(([a, b]) => a - ON_INK_PT <= hi && hi <= b + ON_INK_PT).map(([a]) => a),
    )
    if (next >= hi) break
    hi = next
  }
  run.trimmed = lo > 0 || hi < length
  run.onlyCommoning = lo >= hi

  run.ends = [lo, hi].map((along) => {
    const found = landingAt(run, along, along === lo ? hi : lo)
    return { along, point: atArc(points, along), terminal: found?.id ?? null, off: found?.off ?? 0 }
  })
  return run
}

/**
 * The pin this end lands on, or none.
 *
 * Two conditions, and the second is the one that is easy to leave out. Within `LANDING_PT` along
 * the run — and **nearer this end than the other**, or a run shorter than the tolerance reports
 * the same pin at both of its ends. `C0017` is 17.2 pt long with `TB-130:1` on one end, and
 * without that clause its other end looks terminated, the 3.5 pt join to `C0117` is never made,
 * and `W069`'s correction disappears.
 */
function landingAt(
  run: IndexedRun,
  along: number,
  other: number,
): { id: string; off: number } | null {
  let best: { id: string; off: number; away: number } | null = null
  for (const [id, { off, along: at }] of Object.entries(run.on)) {
    const away = Math.abs(at - along)
    if (away > LANDING_PT || away > Math.abs(at - other)) continue
    if (!best || away < best.away || (away === best.away && off < best.off)) {
      best = { id, off, away }
    }
  }
  return best ? { id: best.id, off: best.off } : null
}

/**
 * Which stretches of this run are a component's own bus: component id → `[from, to]` in arc
 * length.
 *
 * **Two or more of one component's terminals on one run, spanning some length of it.** That is the
 * shape of a terminal block's commoning and it is the whole test — no prefix, no class, nothing
 * about this drawing. Against the real sheet it finds exactly the eight conductors
 * `authoring_the_wires.md` §3.6 lists, having been told nothing about any of them.
 */
function stretches(run: IndexedRun): Record<string, [number, number]> {
  const grouped: Record<string, number[]> = {}
  for (const [id, { along }] of Object.entries(run.on)) {
    const component = id.split(':', 1)[0]
    grouped[component] = [...(grouped[component] ?? []), along]
  }
  const out: Record<string, [number, number]> = {}
  for (const [component, along] of Object.entries(grouped)) {
    if (along.length < 2) continue
    const lo = Math.min(...along)
    const hi = Math.max(...along)
    if (hi > lo) out[component] = [lo, hi]
  }
  return out
}

/** The polyline to measure against: the extraction's own corners. A run with fewer than two is
 * kept out of the index rather than guessed at. */
function usable(conductor: Conductor): [number, number][] {
  const points = (conductor.points ?? []).filter(
    (point): point is [number, number] => Array.isArray(point) && point.length === 2,
  )
  if (points.length >= 2) return points
  const ends = (conductor.ends ?? [])
    .map((end) => end.point)
    .filter((point): point is [number, number] => Array.isArray(point))
  return ends.length >= 2 ? ends : []
}

/** Perpendicular distance to the polyline, and how far along the projection falls. */
function project(
  point: [number, number],
  polyline: readonly [number, number][],
): { off: number; along: number } {
  let best = { off: Infinity, along: 0 }
  let arc = 0
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i]
    const b = polyline[i + 1]
    const span = gap(a, b)
    let t = 0
    let off: number
    if (span === 0) {
      off = gap(point, a)
    } else {
      t = ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / (span * span)
      t = Math.max(0, Math.min(1, t))
      off = gap(point, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
    if (off < best.off) best = { off, along: arc + t * span }
    arc += span
  }
  return best
}

function atArc(polyline: readonly [number, number][], along: number): [number, number] {
  let arc = 0
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i]
    const b = polyline[i + 1]
    const span = gap(a, b)
    if (arc + span >= along - 1e-9) {
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, (along - arc) / span))
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
    }
    arc += span
  }
  return polyline[polyline.length - 1]
}

function polylineLength(polyline: readonly [number, number][]): number {
  let total = 0
  for (let i = 1; i < polyline.length; i += 1) total += gap(polyline[i - 1], polyline[i])
  return total
}

function gap(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
