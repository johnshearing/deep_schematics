/**
 * What the ink says a wire's ends are — **and the acceptance criterion for the whole phase.**
 *
 * ### The two halves of this file
 *
 * The first half is arithmetic on hand-built fixtures out of `_claude_notes/authoring_the_wires.md`
 * §3.2 and §3.5, and each one pins a mechanism: the commoning-aware landing, the crossover-hop
 * join, the run that is nothing but a block's bus, and the wire the ink cannot reach.
 *
 * The second half is the criterion the phase is judged by, and it is checked **against the real
 * drawing** rather than against a snapshot of it — the same idiom `test_extraction_generator.py`
 * uses, skipped when the extraction is not in this tree:
 *
 *     the proposal reproduces all eleven corrections §3.2 names,
 *     contradicts the netlist on none of the wires §3 found to be right,
 *     and offers nothing at all for W042.
 *
 * A committed fixture of the 149 runs would have made that a test of a snapshot. Reading the files
 * makes it a test of the sheet, so re-measuring the drawing can never leave a green suite behind a
 * stale answer.
 *
 * **`geometry.json` is read with `node:fs` and never imported.** It is 620 KB and about 150,000
 * tokens; hazard `H17` forbids it reaching a browser or the model, and nothing here puts it in
 * either — the read happens in Node at test time, the conductors are narrowed to the same fields
 * `GET /api/conductors` publishes, and no bundle can see the path.
 *
 * ### Why `W042` is the test that matters most
 *
 * `PB2:3 → TB-0V:6` is **right in the data and wrong on the paper.** The run stops at the west
 * side of the block instead of reaching the commoning line — the drawing's own error, spotted by
 * the user before any of this was measured — so there is no ink within reach of `TB-0V:6` and this
 * module must say nothing. A screen that trained somebody to accept the proposal would be worse
 * than no screen, and this is the assertion that keeps it from becoming one.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Conductor } from '@/api/types'
import {
  inkIndex,
  isCommoning,
  landingsFrom,
  proposalsFor,
  JOIN_PT,
  LANDING_PT,
  ON_INK_PT,
  type TerminalPoint,
} from './wiring'

/** A run, as `/api/conductors` publishes one. */
function run(id: string, points: [number, number][], over: Partial<Conductor> = {}): Conductor {
  return {
    id,
    points,
    ends: [{ point: points[0] }, { point: points[points.length - 1] }],
    ...over,
  }
}

function pin(id: string, x: number, y: number): TerminalPoint {
  return { id, point: [x, y] }
}

// -- TB-0V, measured 2026-09-06 (plan §3.5) ------------------------------------------------
//
// The twelve rows, at the coordinates a person placed them, and the two conductors that make the
// commoning rule matter. `C0105` is one polyline holding `DISCHARGE1:2`'s wire *and* the whole
// vertical of the block's bus; `C0114` is an ordinary wire onto row 10.

const TB0V = [
  pin('TB-0V:1', 954.4, 265.5),
  pin('TB-0V:2', 954.4, 282.0),
  pin('TB-0V:3', 954.4, 298.6),
  pin('TB-0V:4', 954.4, 315.0),
  pin('TB-0V:5', 954.4, 331.6),
  pin('TB-0V:6', 954.4, 364.3),
  pin('TB-0V:7', 954.4, 381.3),
  pin('TB-0V:8', 954.4, 399.6),
  pin('TB-0V:9', 954.4, 415.9),
  pin('TB-0V:10', 954.4, 432.5),
  pin('TB-0V:11', 954.4, 449.1),
  pin('TB-0V:12', 954.4, 546.7),
]

/** `DISCHARGE1:2`'s wire fused with all 279.6 pt of `TB-0V`'s commoning — the case the whole rule
 * exists for. Its polyline **ends** beside row 1 and the wire joins the block at row 12. */
const C0105 = run(
  'C0105',
  [
    [954.38, 267.3],
    [954.38, 546.94],
    [598.87, 546.94],
  ],
  { net_label: '0V', spec_label: 'WHITE/BLUE 18AWG' },
)

/** `INFEED1:2`'s wire, onto row 10 — no commoning in it, and the netlist says row 12. */
const C0114 = run(
  'C0114',
  [
    [954.4, 432.6],
    [430.0, 432.6],
    [430.0, 400.0],
    [200.0, 400.0],
  ],
  { net_label: '0V', spec_label: 'GREEN 16AWG' },
)

const DISCHARGE1_2 = pin('DISCHARGE1:2', 598.9, 546.9)
const INFEED1_2 = pin('INFEED1:2', 200.1, 400.0)

describe('the commoning-aware landing', () => {
  it('reads a fused run where it leaves the bus, not where its polyline ends', () => {
    // The naive answer is row 1: that is where `C0105` stops. The right answer is row 12, 279 pt
    // and eleven landings later, and getting this wrong mis-proposes four of the 71 wires.
    const index = inkIndex([C0105], [...TB0V, DISCHARGE1_2])
    expect(landingsFrom(index, 'DISCHARGE1:2').map((l) => l.terminal)).toEqual(['TB-0V:12'])
    expect(landingsFrom(index, 'TB-0V:1')).toEqual([])
  })

  it('says so on the proposal, so the refinement is visible rather than buried', () => {
    const index = inkIndex([C0105], [...TB0V, DISCHARGE1_2])
    expect(landingsFrom(index, 'DISCHARGE1:2')[0].reasons).toContain('past the commoning')
  })

  it('finds a block bus from its shape alone — two of one component on one run', () => {
    // No prefix, no class, nothing about this drawing: `C0105` passes twelve `TB-0V` pins, and
    // that is the whole test. It is what will find the next schematic's blocks too.
    const index = inkIndex([C0105], [...TB0V, DISCHARGE1_2])
    expect(index.commoning).toEqual({ 'TB-0V': ['C0105'] })
  })

  it('offers nothing at all for a run that is only a bus, and names it', () => {
    // `C0092` is `TB-120`'s commoning. Plan §4 q10: *`C0092` is `TB-120`'s commoning and no wire
    // may claim it* — here as a predicate instead of a sentence in a document.
    const C0092 = run('C0092', [
      [300.1, 565.2],
      [300.1, 637.9],
    ])
    const index = inkIndex([C0092], [pin('TB-120:1', 300.1, 563.3), pin('TB-120:2', 300.1, 639.6)])
    expect(isCommoning(index, 'C0092')).toBe(true)
    expect(landingsFrom(index, 'TB-120:1')).toEqual([])
    expect(landingsFrom(index, 'TB-120:2')).toEqual([])
  })
})

describe('the eleven the ink can name', () => {
  it('puts W062 on TB-0V:10, where the netlist says :12', () => {
    const index = inkIndex([C0105, C0114], [...TB0V, DISCHARGE1_2, INFEED1_2])
    const { to } = proposalsFor(index, ['INFEED1:2', 'TB-0V:12'])
    expect(to[0].terminal).toBe('TB-0V:10')
    expect(to[0].conductors).toEqual(['C0114'])
    expect(to[0].reasons).toContain('one run')
  })

  it('puts W067 on TB-0V:12 and leaves it agreeing with the netlist', () => {
    // The other half of the same measurement, and the reason `W067` turned out to be **right**
    // once the fusion was accounted for: two wires reach the bottom of this block and only one of
    // them is on row 12.
    const index = inkIndex([C0105, C0114], [...TB0V, DISCHARGE1_2, INFEED1_2])
    const { to } = proposalsFor(index, ['DISCHARGE1:2', 'TB-0V:12'])
    expect(to[0].terminal).toBe('TB-0V:12')
  })

  it('joins a 3.5 pt crossover hop, which is the whole of W069', () => {
    // `C0117` + `C0017`, with a gap the extractor split at. Without the join, `W069`'s correction
    // to `TB-130:1` is unfindable — and `C0017` is 17.2 pt long, shorter than `LANDING_PT`, so it
    // is also the case that needs a landing to be nearer *this* end than the other.
    const C0117 = run(
      'C0117',
      [
        [598.9, 580.0],
        [796.3, 580.0],
      ],
      { net_label: '130', spec_label: 'ORANGE 16AWG' },
    )
    const C0017 = run('C0017', [
      [799.8, 580.0],
      [817.0, 580.0],
    ])
    const index = inkIndex(
      [C0117, C0017],
      [pin('DISCHARGE1:4', 601.6, 579.9), pin('TB-130:1', 818.6, 579.9), pin('TB-130:2', 818.7, 650.9)],
    )
    const { to } = proposalsFor(index, ['DISCHARGE1:4', 'TB-130:2'])
    expect(to[0].terminal).toBe('TB-130:1')
    expect(to[0].conductors).toEqual(['C0117', 'C0017'])
    expect(to[0].reasons).toContain('chained')
  })

  it('carries the printed name for a person to read, and does not rank on it', () => {
    // The name beside a run is its **net**, and every point of a block is on the same net — so a
    // printed `0V` cannot tell row 3 from row 8. It is information, not a signal.
    const index = inkIndex([C0105, C0114], [...TB0V, DISCHARGE1_2, INFEED1_2])
    const [landed] = landingsFrom(index, 'INFEED1:2')
    expect(landed.netLabel).toBe('0V')
    expect(landed.specLabel).toBe('GREEN 16AWG')
    expect(landed.reasons).toContain('printed name')
  })

  it('says `corrected name` where a person read the name off the paper', () => {
    // `Conductor.was` is set only where somebody changed the binding on the Review tab. Same
    // vocabulary as the path panel's tag, so a reader meets one set of words.
    const corrected = run('C0054', [...C0114.points] as [number, number][], {
      net_label: 'PB1',
      was: 'PBL',
    })
    const index = inkIndex([corrected], [...TB0V, INFEED1_2])
    expect(landingsFrom(index, 'INFEED1:2')[0].reasons).toContain('corrected name')
  })
})

describe('what it refuses to say', () => {
  it('offers nothing where the ink stops short of the block — W042', () => {
    // `C0006` stops at the west side of `TB-0V` instead of reaching the bus. The netlist's
    // `TB-0V:6` is **right** and the drawing is wrong, which is the one case in the whole census
    // where a proposal would have made things worse.
    const C0006 = run(
      'C0006',
      [
        [900.0, 364.3],
        [700.0, 364.3],
      ],
      { net_label: '0V', spec_label: 'BLUE 22AWG' },
    )
    const index = inkIndex([C0006], [...TB0V, pin('PB2:3', 699.9, 364.3)])
    const { to, from } = proposalsFor(index, ['PB2:3', 'TB-0V:6'])
    expect(to).toEqual([])
    expect(from).toEqual([])
  })

  it('stops at a junction with more than one way on rather than guessing', () => {
    // Three ways out of a corner is not a run. This is what leaves `W031` to a person: `C0008`
    // is half wire and half bus and its far end meets more than one unterminated piece.
    const spine = run('C1', [
      [0, 0],
      [100, 0],
    ])
    const left = run('C2', [
      [102, 0],
      [102, 80],
    ])
    const right = run('C3', [
      [102, 0],
      [200, 0],
    ])
    const index = inkIndex([spine, left, right], [pin('A:1', 0, 0), pin('B:1', 200, 0)])
    expect(landingsFrom(index, 'A:1')).toEqual([])
  })

  it('says nothing for an end whose partner nobody has set', () => {
    // There is nowhere to start the walk from, and that is honest rather than unhelpful: a wire
    // with two empty slots is what `Pick from the sheet` is for.
    const index = inkIndex([C0114], [...TB0V, INFEED1_2])
    expect(proposalsFor(index, [null, null])).toEqual({ from: [], to: [] })
    expect(proposalsFor(index, ['INFEED1:2', null]).from).toEqual([])
  })

  it('never proposes the terminal the walk started from', () => {
    const index = inkIndex([C0105], [...TB0V, DISCHARGE1_2])
    for (const landed of landingsFrom(index, 'DISCHARGE1:2')) {
      expect(landed.terminal).not.toBe('DISCHARGE1:2')
    }
  })

  it('keeps its three tolerances inside half a conductor row where it matters', () => {
    // Rows on this sheet are 16 pt apart and being one row out names a different circuit, so the
    // perpendicular tolerance has to stay under half a row. Along the run it can be loose, and
    // the hop tolerance is the measured 3.5 pt gap plus a little.
    expect(ON_INK_PT).toBeLessThan(16 / 2)
    expect(LANDING_PT).toBeGreaterThan(ON_INK_PT)
    expect(JOIN_PT).toBeGreaterThan(3.5)
  })
})

// -- the acceptance criterion, against the real drawing -------------------------------------

const EXTRACTION = path.resolve(
  __dirname,
  '../../../../schematic_extraction/PS20115MLM4-2/extracted_docs',
)

/** The eleven §3.2 names, and the end of each that the ink corrects. */
const ELEVEN: Record<string, string> = {
  W014: 'TB-GND-B:1',
  W018: 'TB-0V:3',
  W019: 'TB-GND-B:2',
  W036: 'TB-0V:2',
  W037: 'TB-0V:1',
  W039: 'TB-0V:4',
  W045: 'TB-0V:5',
  W046: 'TB-0V:7',
  W062: 'TB-0V:10',
  W063: 'TB-120:1',
  W069: 'TB-130:1',
}

/** The thirteen §3.3 says only a person can settle. Their proposals are allowed to disagree with
 * the netlist — for three of them that disagreement *is* §3.3's explanation. */
const UNSETTLED = new Set([
  'W002', 'W003', 'W024', 'W025', 'W026', 'W031', 'W038', 'W041', 'W042', 'W044', 'W049', 'W050',
  'W057',
])

/** And two more the census counted as confirmed that this measurement cannot settle. Both are a
 * relay's coil `A2`, and see the test that names them. */
const COIL_FED = new Set(['W047', 'W048'])

const present = existsSync(path.join(EXTRACTION, 'geometry.json'))
const real = present ? loadReal() : null

function loadReal() {
  /**
   * The real drawing, narrowed here to exactly what `GET /api/conductors` and
   * `/api/designators` publish.
   *
   * `readFileSync` rather than an import, deliberately: `geometry.json` is 620 KB and hazard
   * `H17` is that it must never reach a browser or the model. A path resolved at test time is in
   * no bundle and in no prompt.
   */
  const ink = JSON.parse(readFileSync(path.join(EXTRACTION, 'geometry.json'), 'utf-8'))
  const netlist = JSON.parse(readFileSync(path.join(EXTRACTION, 'circuit_logic.json'), 'utf-8'))
  const locations = JSON.parse(readFileSync(path.join(EXTRACTION, 'locations.json'), 'utf-8'))

  const conductors: Conductor[] = (ink.pages[0].conductors ?? []).map(
    (c: Record<string, unknown>) => ({
      id: c.id as string,
      points: (c.points ?? c.endpoints) as [number, number][],
      ends: ((c.endpoints ?? []) as [number, number][]).map((point) => ({ point })),
      net_label: (c.net_label ?? undefined) as string | undefined,
      spec_label: (c.spec_label ?? undefined) as string | undefined,
      length: (c.length ?? undefined) as number | undefined,
    }),
  )
  const terminals: TerminalPoint[] = Object.entries(
    (locations.terminals ?? {}) as Record<string, { point: [number, number] }>,
  ).map(([id, stored]) => ({ id, point: stored.point }))
  const wires = (netlist.wires ?? []).map(
    (w: { id: string; from_terminal: string | null; to_terminal: string | null }) => ({
      id: w.id,
      from: w.from_terminal,
      to: w.to_terminal,
    }),
  )
  return { index: inkIndex(conductors, terminals), wires, terminals }
}

describe.skipIf(!present)('against PS20115MLM4-2 itself', () => {
  /** Every wire's two ends, and the terminals the ink proposes for each, best fit first. */
  function readings() {
    const out = new Map<
      string,
      { from: string[]; to: string[]; wire: { from: string; to: string } }
    >()
    for (const wire of real!.wires) {
      const p = proposalsFor(real!.index, [wire.from, wire.to])
      out.set(wire.id, {
        from: p.from.map((l) => l.terminal),
        to: p.to.map((l) => l.terminal),
        wire,
      })
    }
    return out
  }

  it('has the drawing it thinks it has: 149 runs and 131 placed pins', () => {
    expect(real!.index.runs.length).toBeGreaterThanOrEqual(140)
    expect(real!.terminals.length).toBe(131)
    expect(real!.wires.length).toBe(71)
  })

  it('reproduces all eleven corrections the census names, each at the top of its end', () => {
    const got = readings()
    const missed: string[] = []
    for (const [wire, want] of Object.entries(ELEVEN)) {
      const seen = got.get(wire)!
      // Either end may be the one the ink corrects — nothing in this module knows which of a
      // wire's two ends is the terminal block, and it must not have to.
      if (seen.from[0] !== want && seen.to[0] !== want) {
        missed.push(`${wire}: wanted ${want}, got from=[${seen.from}] to=[${seen.to}]`)
      }
    }
    expect(missed).toEqual([])
  })

  it('does not even offer the screw the netlist claims, on any of the eleven', () => {
    // **The strong form of the same finding, and it is the one worth having.** Ranking the right
    // answer first could be luck; *never mentioning the wrong one* is the ink positively
    // contradicting the allocation. Measured: on all eleven the declared terminal is absent from
    // the proposals for that end, which is what makes each of them provable rather than likely.
    const got = readings()
    const offered: string[] = []
    for (const [wire, want] of Object.entries(ELEVEN)) {
      const seen = got.get(wire)!
      const side = seen.to[0] === want ? seen.to : seen.from
      const declared = seen.to[0] === want ? seen.wire.to : seen.wire.from
      if (side.includes(declared)) offered.push(`${wire}: still offers ${declared}`)
    }
    expect(offered).toEqual([])
  })

  it('never fails to offer the endpoint a wire the census found right already has', () => {
    // **The half of the criterion that keeps the screen honest.** Reproducing eleven corrections
    // is worth nothing if the price is contradicting a twelfth wire that was already correct. So
    // for every end of every wire §3 found right, the declared terminal has to be *in* the
    // proposals — not necessarily first, and the test below says why not.
    //
    // Measured on this sheet: **90 ends, 90 of them offered, 0 absent, 0 silent.**
    const got = readings()
    const wrong: string[] = []
    for (const [id, seen] of got) {
      if (id in ELEVEN || UNSETTLED.has(id) || COIL_FED.has(id)) continue
      if (seen.to.length && !seen.to.includes(seen.wire.to)) {
        wrong.push(`${id}: to offers [${seen.to}] and not ${seen.wire.to}`)
      }
      if (seen.from.length && !seen.from.includes(seen.wire.from)) {
        wrong.push(`${id}: from offers [${seen.from}] and not ${seen.wire.from}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('sometimes puts another wire above yours, where two wires land on one pin', () => {
    // **A real property of the sheet, not a defect, and the lesson document says so by name.**
    // `PLG1` and `PLG2` are wired in parallel onto `TB-L1:1` and `TB-N:1`; `CR-ON:14` and
    // `CR-BP:24` share a pin. Walk the ink away from a pin two wires land on and the nearer run
    // may be the other wire's — which is exactly why §3.3 could not settle `W002` and `W003`.
    //
    // Eleven of the 90 ends are that case. The ranking is **not** patched to prefer whatever the
    // record already says, because a proposal that agreed with the record by construction would
    // be no proposal at all. The panel marks the one that agrees instead.
    const got = readings()
    const shared = [...got].filter(([id, seen]) => {
      if (id in ELEVEN || UNSETTLED.has(id) || COIL_FED.has(id)) return false
      return (
        (seen.to.length > 1 && seen.to[0] !== seen.wire.to) ||
        (seen.from.length > 1 && seen.from[0] !== seen.wire.from)
      )
    })
    expect(shared.length).toBe(11)
  })

  it('agrees with the netlist on 48 wires, which is the census plus three', () => {
    // §3.1 measured **47 confirmed**. This settles 48: it also chains `W002` and `W003` — the
    // parallel plug runs — and `W031`, because the commoning rule reads `C0008`'s block end past
    // the bus §3.3 says it could not get through. A number rather than a description, so a change
    // to the arithmetic has to come and edit this line.
    const got = readings()
    const agreed = [...got].filter(
      ([, seen]) => seen.to[0] === seen.wire.to || seen.from[0] === seen.wire.from,
    )
    expect(agreed.length).toBe(48)
  })

  it('offers nothing whatever for W042, where the ink is wrong and the data is right', () => {
    // The assertion this whole phase is judged by. `PB2:3 → TB-0V:6`: the run stops at the west
    // side of the block instead of reaching the commoning line. Anything offered here would be a
    // proposal to break correct data.
    const seen = readings().get('W042')!
    expect(seen.from).toEqual([])
    expect(seen.to).toEqual([])
  })

  it('finds the eight commoning conductors the census listed by hand', () => {
    // §3.6, measured with a script and written into the plan as a table. This module was told
    // nothing about any of them: two pins of one component on one run is the whole test.
    //
    // One correction to the plan while we are here: §3.6's heading says *8 conductors, 7 blocks*
    // and its own table has **six** distinct blocks. Six is right.
    const found = Object.entries(real!.index.commoning)
      .flatMap(([block, runs]) => runs.map((id) => `${block} ${id}`))
      .sort()
    expect(found).toEqual([
      'TB-0V C0105',
      'TB-110 C0060',
      'TB-110 C0077',
      'TB-120 C0092',
      'TB-24E1-A C0086',
      'TB-24E1-B C0008',
      'TB-24E1-B C0010',
      'TB-GND-B C0041',
    ])
    expect(Object.keys(real!.index.commoning).length).toBe(6)
  })

  it('cannot settle a wire onto a relay coil, and that is the ink and not the arithmetic', () => {
    // `W047` and `W048` are the two the census counted as confirmed and this cannot. Both land on
    // a relay's coil `A2`, and on this sheet the ink stops **46 pt short** of those dots: the
    // vertical bus runs at x ≈ 917.5 and the coil pins were placed on the symbol at x ≈ 871.
    // §3.1 names that shortfall for `W048` itself and does not draw the conclusion for `W047`.
    // Held as a test so the next session meets the reason rather than the gap — it is the same
    // shape as `W024`/`W025`/`W026`, which §3.3 calls *"three coil feeds, one bound landing"*.
    const got = readings()
    for (const id of COIL_FED) {
      expect(got.get(id)!.from).toEqual([])
      expect(got.get(id)!.to).toEqual([])
    }
  })
})
