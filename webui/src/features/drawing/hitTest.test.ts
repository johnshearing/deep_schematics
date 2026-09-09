/**
 * *Is there a wire here?* — the three verdicts, as arithmetic.
 *
 * The faults each of these prevents:
 *
 * - a card that names the nearest conductor **anywhere on the sheet**, so a click on blank paper
 *   confidently points at a run 200 pt away;
 * - a tolerance in **CSS pixels**, which at the 11% fit would swallow four conductor rows and at
 *   400% would be unclickable — everything here is in points, because the paper is;
 * - *no wire claims this run* printed without the count beside it, which is a false fact for
 *   around 90 of the 149 runs until the authoring run is finished;
 * - a bus the **shape rule** found being reported in the same words as one a person confirmed.
 */

import { describe, expect, it } from 'vitest'

import type { Conductor, PathIndex } from '@/api/types'
import { claimsFrom, pickRun, PICK_PT } from './hitTest'

function run(id: string, points: [number, number][], over: Partial<Conductor> = {}): Conductor {
  return {
    id,
    points,
    ends: [{ point: points[0] }, { point: points[points.length - 1] }],
    length: points.reduce(
      (total, point, i) =>
        i === 0 ? 0 : total + Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]),
      0,
    ),
    ...over,
  }
}

/** Net 120's ink, at the coordinates `07_drawing_facts.md` measured. `C0091` is `W063`'s route and
 * `C0092` is `TB-120`'s bus — the pair §4 q10 is about. */
const C0091 = run('C0091', [[562.9, 563.4], [301.9, 563.4]], {
  net_label: '120',
  spec_label: 'RED 16AWG',
  color: 'RED',
  gauge: '16AWG',
})
const C0092 = run('C0092', [[300.1, 565.2], [300.1, 637.9]])
const C0059 = run('C0059', [[900, 200], [1000, 200]], { net_label: '110' })

const INK = [C0091, C0092, C0059]

const PATHS: PathIndex = {
  wires: {
    W063: {
      runs: [[[562.9, 563.4], [301.9, 563.4]]],
      geometry: 'extracted',
      attribution: 'human',
      conductors: ['C0091'],
    },
  },
  nets: { '120': ['W052', 'W053', 'W063', 'W068'] },
}

/** What the shape rule finds before anybody has authored anything: `C0092` is `TB-120`'s. */
const PROPOSED = { 'TB-120': ['C0092'] }

describe('pointing at a line', () => {
  it('names the run under the pointer and how far off the click landed', () => {
    const claims = claimsFrom(PATHS, 71, PROPOSED)
    const hit = pickRun(INK, [420, 564.4], claims)
    expect(hit?.conductor.id).toBe('C0091')
    expect(hit?.off).toBe(1)
    expect(hit?.claimedBy).toBe('W063')
  })

  it('answers nothing for bare paper rather than reaching for the nearest thing', () => {
    // **The fault this exists to prevent.** A click in the white space between two circuits must
    // say *nothing here*: naming a conductor 40 pt away would be believed, and on a sheet whose
    // rows are 16 pt apart a wrong line is worse than no line.
    const claims = claimsFrom(PATHS, 71, PROPOSED)
    expect(pickRun(INK, [420, 610], claims)).toBeNull()
    // And the boundary is in **points**, so it is the same width of paper at every zoom.
    expect(pickRun(INK, [420, 563.4 + PICK_PT - 0.5], claims)).not.toBeNull()
    expect(pickRun(INK, [420, 563.4 + PICK_PT + 0.5], claims)).toBeNull()
  })

  it('says a block owns a run, and whether that is the shape rule or a person', () => {
    /**
     * **Plan §4 q10 as a card**: *`C0092` is `TB-120`'s commoning and no wire may claim it.*
     *
     * The two answers are kept apart because they are different claims. The shape rule *found* it
     * — two of one block's terminals on one run — and that is a proposal, already known to be
     * incomplete on this sheet. A person confirming it is a decision, and a screen that reported
     * the two in the same words would be claiming one nobody made.
     */
    const proposed = pickRun(INK, [300.1, 600], claimsFrom(PATHS, 71, PROPOSED))
    expect(proposed?.commoning).toEqual({ block: 'TB-120', confirmed: false })
    expect(proposed?.claimedBy).toBeNull()

    const authored: PathIndex = {
      ...PATHS,
      commoning: {
        'TB-120': {
          runs: [C0092.points],
          geometry: 'extracted',
          attribution: 'human',
          conductors: ['C0092'],
        },
      },
    }
    const confirmed = pickRun(INK, [300.1, 600], claimsFrom(authored, 71, PROPOSED))
    expect(confirmed?.commoning).toEqual({ block: 'TB-120', confirmed: true })
  })

  it('says no wire claims a label leader, and carries the count that makes that honest', () => {
    // Around 90 of the real 149 are this: leader lines, earth symbols, the internal strokes of a
    // contact. The verdict is right and it is worthless on its own — *1 of 71 wires has a route*
    // is what tells a reader whether to believe it.
    const claims = claimsFrom(PATHS, 71, PROPOSED)
    const hit = pickRun(INK, [950, 200], claims)
    expect(hit?.conductor.id).toBe('C0059')
    expect(hit?.claimedBy).toBeNull()
    expect(hit?.commoning).toBeNull()
    expect([claims.traced, claims.wires]).toEqual([1, 71])
  })

  it('is an honest null before the ink has landed, rather than *no wire claims this*', () => {
    expect(pickRun(null, [420, 563.4], claimsFrom(PATHS, 71, PROPOSED))).toBeNull()
  })

  it('gives a short stub the click where it crosses a long run', () => {
    // Two runs meeting at a pin is the ordinary case at every terminal block. A click near the
    // end of the stub is a click on the stub; the bus passing through is not what anybody is
    // pointing at, and ties on distance would otherwise go to whichever was listed first.
    const bus = run('C0100', [[0, 100], [1000, 100]])
    const stub = run('C0101', [[500, 100], [520, 100]])
    const claims = claimsFrom(null, 71)
    expect(pickRun([bus, stub], [510, 100], claims)?.conductor.id).toBe('C0101')
    expect(pickRun([stub, bus], [510, 100], claims)?.conductor.id).toBe('C0101')
  })
})
