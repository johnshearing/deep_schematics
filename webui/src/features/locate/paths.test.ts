/**
 * The candidate ranking, as arithmetic — and the place a wrong answer here would actually be
 * wrong.
 *
 * ### Why these fixtures are the real drawing's numbers
 *
 * Every conductor and every pin below is a coordinate measured off `PS20115MLM4-2` and written
 * into `07_drawing_facts.md` on 2026-09-02, and net 120's four wires are there because the
 * pairings between them were worked out **by hand, from the placed points**, after an earlier
 * document got one of them wrong for nine days. That table exists so this ranking has answers to
 * check itself against, and it says so: *"Session 6's ranking should reproduce this table; if it
 * does not, the ranking is what is wrong."*
 *
 * So the four tests at the top of this file are the acceptance criterion for the whole phase:
 *
 *     W052   CR2:14 → TB-120:1        C0109            one run, both ends within 4 pt
 *     W053   TB-120:3 → BYPASS-CB:1   C0080            one run, both ends within 1.7 pt
 *     W063   INFEED1:3 → TB-120:2     C0091 + C0092    an L, the second piece unlabelled
 *     W068   DISCHARGE1:3 → TB-120:2  C0081 + C0057    the crossover hop, 3.5 pt of gap
 *
 * ### The faults each of the rest prevents
 *
 * - a ranking that trusts the printed net name above the geometry, which finds **one end** of a
 *   wire and not the other — the second piece of a real route routinely carries no name at all;
 * - a matcher that assumes the ink runs in the same direction the netlist records the wire, which
 *   would have missed half the sheet (`C0080` runs east to west; `W053` is recorded west to east);
 * - a 10.8 pt diagonal contact-symbol stroke out-ranking real wiring because it happens to touch a
 *   pin, and a **closed loop** — the outline of the INFEED1 connector box — being offered as a
 *   conductor at all;
 * - `NET-PB1` matching nothing because the sheet prints `PB1`, which is `K10` and is worth exactly
 *   two nets of 26.
 */

import { describe, expect, it } from 'vitest'

import type { Conductor, Designator } from '@/api/types'
import {
  candidates,
  chordOf,
  endsOf,
  lengthOf,
  netNames,
  netOf,
  runsOf,
  MIN_RUN_PT,
  NEAR_PT,
} from './paths'

/** A wire, as `/api/designators` publishes one: two member terminals with their placed points. */
function wire(
  id: string,
  spec: string | undefined,
  from: [string, [number, number]],
  to: [string, [number, number]],
): Designator {
  return {
    id,
    kind: 'wire',
    label: id,
    on_sheet: false,
    members: [],
    point: null,
    rect: null,
    ...(spec ? { spec } : {}),
    terminals: [
      { id: from[0], point: from[1], placement: 'confirmed' },
      { id: to[0], point: to[1], placement: 'confirmed' },
    ],
  }
}

/** A run, as `/api/conductors` publishes one. `ends` carries the extraction's own endpoints. */
function run(
  id: string,
  points: [number, number][],
  over: Partial<Conductor> = {},
): Conductor {
  return {
    id,
    points,
    ends: [{ point: points[0] }, { point: points[points.length - 1] }],
    length: lengthOf([points]),
    ...over,
  }
}

// -- net 120, measured 2026-09-02 -----------------------------------------------------------

const W052 = wire('W052', 'BLUE 18AWG', ['CR2:14', [236.1, 563.4]], ['TB-120:1', [300.1, 563.3]])
const W053 = wire('W053', 'BLUE 18AWG', ['TB-120:3', [300.1, 663.7]], ['BYPASS-CB:1', [381.5, 663.8]])
const W063 = wire('W063', 'RED 16AWG', ['INFEED1:3', [563.6, 563.5]], ['TB-120:2', [300.1, 639.6]])
const W068 = wire('W068', 'RED 16AWG', ['DISCHARGE1:3', [602.7, 563.6]], ['TB-120:2', [300.1, 639.6]])

const BLUE = { net_label: '120', spec_label: 'BLUE 18AWG', color: 'BLUE', gauge: '18AWG' }
const RED = { net_label: '120', spec_label: 'RED 16AWG', color: 'RED', gauge: '16AWG' }

const C0080 = run('C0080', [[379.8, 663.7], [301.8, 663.7]], BLUE)
const C0081 = run('C0081', [[301.8, 639.6], [426.3, 639.6]], RED)
const C0091 = run('C0091', [[562.9, 563.4], [301.9, 563.4]], RED)
const C0109 = run('C0109', [[232.6, 563.4], [298.2, 563.4]], BLUE)
/** The vertical 73 pt piece that makes `W063` an L, and it carries **no printed label** — which is
 * the whole reason the geometry outranks the name. */
const C0092 = run('C0092', [[300.1, 565.2], [300.1, 637.9]])
/** The other side of `W068`'s crossover hop: three segments out to x = 798 and back. */
const C0057 = run('C0057', [
  [429.8, 639.6],
  [798, 639.6],
  [798, 563.5],
  [598.9, 563.5],
])
/** 10.8 pt and diagonal: the slanted bar of `CR-BP`'s normally-closed contact, which
 * `trace_conductors` collected because it is a short stroke like any other. 46 of the real 149 are
 * this. */
const C0107 = run('C0107', [[717.9, 525.9], [711.4, 534.5]])

const NET120 = [C0080, C0081, C0091, C0109, C0092, C0057, C0107]

/** The ids the panel would show, in the order it would show them. */
function ranked(entry: Designator, ink = NET120, options = { net: '120' }) {
  return candidates(entry, ink, options).map((candidate) => candidate.conductor.id)
}

describe('the four pairings measured off the sheet', () => {
  it('puts `C0109` first for `W052`, not `C0080`', () => {
    /**
     * **This is the pairing every document had wrong for nine days**, including the plan's §3 and
     * §6. It was written from `CR2:14`'s *pre-placement* position — its parent relay's coil, 630 pt
     * away — and `C0080` is `W053`'s run. Both of `W052`'s pins are within 4 pt of `C0109`'s ends.
     */
    const list = candidates(W052, NET120, { net: '120' })
    expect(list[0].conductor.id).toBe('C0109')
    expect(list[0].reasons).toContain('both ends')
    expect(list[0].fit).toBeLessThan(4)
    // And it is the only run that spans both of this wire's pins, so there is no ambiguity at the
    // top of the list — which is true of 37 of the 71 wires.
    expect(list.filter((c) => c.reasons.includes('both ends'))).toHaveLength(1)
  })

  it('puts `C0080` first for `W053`, whose ink runs the other way round', () => {
    // `C0080` is recorded (379.8, 663.7) → (301.8, 663.7) and `W053` is `[TB-120:3,
    // BYPASS-CB:1]` — west to east against east to west. A matcher that assumed the two orders
    // agreed would have missed half the sheet, so both pairings are tried and the better wins.
    const list = candidates(W053, NET120, { net: '120' })
    expect(list[0].conductor.id).toBe('C0080')
    expect(list[0].fit).toBeLessThan(2)
  })

  it('offers `C0091` and `C0092` for `W063` — and `C0092` carries no printed name', () => {
    /**
     * The lesson `07_drawing_facts.md` draws out of this table in as many words: *the second half
     * of a real path is routinely a conductor with no printed net label, so ranking on the printed
     * name alone finds one end of a wire and not the other.*
     */
    const list = candidates(W063, NET120, { net: '120' })
    expect(list[0].conductor.id).toBe('C0091')
    const c0092 = list.find((c) => c.conductor.id === 'C0092')
    expect(c0092).toBeDefined()
    expect(c0092?.reasons).toContain('one end')
    expect(c0092?.conductor.net_label).toBeUndefined()
    // Neither piece reaches both pins, which is what half a route looks like from here: 33 of the
    // 71 wires are in this shape.
    expect(list.every((c) => !c.reasons.includes('both ends'))).toBe(true)
  })

  it('offers `C0081` and `C0057` for `W068`, the crossover hop', () => {
    /**
     * **The example the whole plan should have used.** `W068`'s straight chord is 312 pt diagonally
     * across the middle of the sheet; its ink is 644 pt going out to x = 798 and back, in two
     * pieces with a 3.5 pt gap where the drawing puts a hop arc to mean *no connection*. That is
     * both halves of the argument at once — why a route may never be computed, and why `runs` is a
     * list.
     */
    const list = candidates(W068, NET120, { net: '120' })
    const ids = list.map((c) => c.conductor.id)
    expect(ids).toContain('C0081')
    expect(ids).toContain('C0057')
    expect(chordOf(W068)).toBe(312)
    expect(lengthOf([C0081.points, C0057.points])).toBeGreaterThan(600)
  })
})

describe('what outranks what', () => {
  it('ranks the geometry above the printed name', () => {
    /**
     * The order the plan asks for, weakest assumption first. Both of `W052`'s pins landing on
     `C0109` is geometry against geometry — a human-placed point against a vector stroke, with no
     * reading of the paper in between. A printed name is *read*, and 30 of this sheet's 70 came
     * back at confidence 0.4 with nine of them wrong.
     */
    // `C0091` carries the same printed name and the same net, and reaches only one pin.
    expect(ranked(W052).indexOf('C0109')).toBeLessThan(ranked(W052).indexOf('C0091'))
  })

  it('ranks a matching spec above one that only matches on colour', () => {
    const blueish = run('C9001', [[236.1, 563.4], [300.1, 563.3]], {
      net_label: '120',
      spec_label: 'BLUE 16AWG',
      color: 'BLUE',
      gauge: '16AWG',
    })
    const list = candidates(W052, [C0109, blueish], { net: '120' })
    expect(list.map((c) => c.conductor.id)).toEqual(['C0109', 'C9001'])
    expect(list[1].reasons).toContain('colour only')
  })

  it('demotes a symbol stroke that happens to touch a pin, and drops one that does not', () => {
    // 46 of the 149 runs are under 15 pt. `C0107` is 10.8 pt and **diagonal** on an orthogonal
    // drawing: it is the slanted bar of a contact symbol, and it is not wiring.
    expect(C0107.length).toBeLessThan(MIN_RUN_PT)
    expect(ranked(W052)).not.toContain('C0107')

    const touching = run('C0107', [[236.1, 563.4], [242.6, 571.9]])
    const list = candidates(W052, [C0109, touching], { net: '120' })
    // Kept, because *why does the ink stop here* is worth being able to look at — and last,
    // because a wrong line is worse than no line.
    expect(list.map((c) => c.conductor.id)).toEqual(['C0109', 'C0107'])
    expect(list[1].reasons).toContain('suspect')
  })

  it('treats a closed loop as suspect, because it is a box outline and not a run', () => {
    /**
     * `C0115` on the real sheet: a 75.6 × 105.8 pt rectangle whose two endpoints are 0.4 pt apart
     * — **the outline of the INFEED1 connector box** — with a `BLUE 16AWG` spec falsely bound from
     * a label printed *inside* it. Offering that as a candidate would hand a person a box to
     * accept as a conductor.
     */
    const loop = run(
      'C0115',
      [[500, 500], [575.6, 500], [575.6, 605.8], [500, 605.8], [500.2, 500.2]],
      { spec_label: 'BLUE 16AWG', color: 'BLUE', gauge: '16AWG' },
    )
    const near = wire('W900', 'BLUE 16AWG', ['X:1', [500, 500]], ['X:2', [900, 900]])
    const list = candidates(near, [loop], {})
    expect(list[0].reasons).toContain('suspect')
  })

  it('keeps a run labelled with another net only when the geometry fits, and ranks it last', () => {
    /**
     * The most interesting case on the sheet, and the reason it is kept rather than filtered out: a
     * run whose two ends are exactly on this wire's two pins while the name beside it says another
     * net is either a misread nobody caught or a wire on the wrong row. Both want a person's eyes.
     * Nothing can be accepted by accident, because nothing here accepts anything.
     */
    const wrong = run('C9002', [[236.1, 563.4], [300.1, 563.3]], {
      net_label: '130',
      spec_label: 'BLUE 18AWG',
      color: 'BLUE',
      gauge: '18AWG',
    })
    const elsewhereOnTheSheet = run('C9003', [[900, 100], [980, 100]], { net_label: '130' })
    const list = candidates(W052, [C0109, wrong, elsewhereOnTheSheet], { net: '120' })
    expect(list.map((c) => c.conductor.id)).toEqual(['C0109', 'C9002'])
    expect(list[1].reasons).toContain('another net')
  })

  it('offers unlabelled ink by proximity when nothing carries the name', () => {
    // The escape hatch for the wires with no labelled candidate: *choose from the unlabelled
    // conductors, ranked by proximity*. Offered, and behind the real ink.
    const near = run('C9004', [[320, 563.4], [400, 563.4]])
    const far = run('C9005', [[900, 100], [980, 100]])
    const list = candidates(W052, [near, far], { net: '120' })
    expect(list.map((c) => c.conductor.id)).toEqual(['C9004'])
    expect(list[0].reasons).toContain('nearby')
  })

  it('is the same list however the ink is ordered', () => {
    // A proposal list that reshuffled between renders is one nobody could compare against the
    // sheet. The id breaks every tie, so the order is total.
    expect(ranked(W063, [...NET120].reverse())).toEqual(ranked(W063))
  })
})

describe('K10 — the name the sheet prints', () => {
  it('matches a run printed `PB1` against the net the netlist calls `NET-PB1`', () => {
    /**
     * Worth exactly two nets of 26, and they were the only two left after the whole review queue
     * had been worked. The sheet prints `PB1`; the netlist prefixed it because the drawing also has
     * a *push button* called `PB1`, and the rename was right. Comparing against both forms takes
     * the matcher to 26 of 26.
     */
    const pb1 = run('C0054', [[100, 100], [180, 100]], {
      net_label: 'PB1',
      spec_label: 'BLACK 22AWG',
      color: 'BLACK',
      gauge: '22AWG',
    })
    const w040 = wire('W040', 'BLACK 22AWG', ['PB1:4', [100, 100]], ['CR1:A1', [180, 100]])

    expect(candidates(w040, [pb1], { net: 'NET-PB1' })).toHaveLength(1)
    const withPrinted = candidates(w040, [pb1], { net: 'NET-PB1', printedNet: 'PB1' })
    expect(withPrinted[0].reasons).toContain('printed name')
    // Without it the run is still offered — the geometry fits — but as *another net*, which is a
    // row a person has to look twice at rather than one they can accept at a glance.
    expect(candidates(w040, [pb1], { net: 'NET-PB1' })[0].reasons).toContain('another net')
  })

  it('folds case, because a printed name is OCR of stroked glyphs', () => {
    expect(netNames('NET-PB1', 'PB1')).toEqual(['NET-PB1', 'PB1'])
    expect(netNames('120', null)).toEqual(['120'])
    expect(netNames(null, null)).toEqual([])
  })
})

describe('a corrected name', () => {
  it('says it was corrected, so a person can see where the string came from', () => {
    // The join Phase F built: 30 of the 70 printed net names came back at 0.4 and nine were
    // wrong, and `was` is the extraction's own binding kept beside the correction forever.
    const fixed = run('C0030', [[236.1, 563.4], [300.1, 563.3]], {
      net_label: '120',
      was: 'I20',
      spec_label: 'BLUE 18AWG',
      color: 'BLUE',
      gauge: '18AWG',
    })
    const list = candidates(W052, [fixed], { net: '120' })
    expect(list[0].reasons).toContain('corrected name')
    expect(list[0].reasons).not.toContain('printed name')
  })
})

describe('the arithmetic the panel shows', () => {
  it('measures a route along the ink, not across it', () => {
    // `W068`: 312 pt of straight line against 644 pt of conductor. The chord is published only to
    // be compared against, and is never drawn.
    expect(chordOf(W068)).toBe(312)
    expect(lengthOf([C0057.points])).toBeCloseTo(643.6, 0)
    expect(lengthOf([])).toBe(0)
  })

  it('hands back the runs of the candidates chosen, and skips a degenerate one', () => {
    const list = candidates(W052, NET120, { net: '120' })
    expect(runsOf(list.slice(0, 1))).toEqual([C0109.points])
    expect(runsOf([{ conductor: run('C9', [[1, 1]]), reasons: [], fit: null, ends: 0 }])).toEqual([])
  })

  it('reads a wire’s ends in `[from, to]` order, and admits an unplaced one', () => {
    expect(endsOf(W052)).toEqual([[236.1, 563.4], [300.1, 563.3]])
    const unplaced: Designator = {
      ...W052,
      terminals: [{ id: 'CR2:14', point: null, placement: null }, W052.terminals![1]],
    }
    expect(endsOf(unplaced)[0]).toBeNull()
    // With one end unknown a run can reach at most one of them, so nothing claims `both ends`.
    expect(candidates(unplaced, NET120, { net: '120' }).every((c) => c.ends < 2)).toBe(true)
  })

  it('reads a wire’s net out of the path index’s membership map', () => {
    // The one place it is published: `/api/paths` computes it from `wire.net` for the highlight's
    // sake, so reading it from there is what stops a second answer existing.
    const paths = { wires: {}, nets: { '120': ['W052', 'W053'], '130': ['W049'] } }
    expect(netOf(paths, 'W053')).toBe('120')
    expect(netOf(paths, 'W049')).toBe('130')
    expect(netOf(paths, 'W001')).toBeNull()
    expect(netOf(null, 'W053')).toBeNull()
  })

  it('holds the tolerance at half a conductor row', () => {
    /**
     * 8 pt, and the number is the whole discrimination: the rows on this sheet are 16 pt apart and
     * being one row out names a different circuit, so a tolerance at or over a full row would stop
     * telling one row from the next. It is also twice the worst pairing anybody has measured here.
     */
    expect(NEAR_PT).toBe(8)
    const justOff = wire('W901', 'BLUE 18AWG', ['A:1', [232.6, 570.4]], ['A:2', [298.2, 570.4]])
    // 7 pt out at both ends: still the same row, still a match.
    expect(candidates(justOff, [C0109], { net: '120' })[0].ends).toBe(2)
    const nextRow = wire('W902', 'BLUE 18AWG', ['A:1', [232.6, 579.4]], ['A:2', [298.2, 579.4]])
    // 16 pt out is the next row down, which is a different circuit.
    expect(candidates(nextRow, [C0109], { net: '120' })[0].ends).toBe(0)
  })
})
