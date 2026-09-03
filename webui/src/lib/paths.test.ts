/**
 * *"A net is just a collection of wire paths."*
 *
 * That sentence is the whole of this module and every test below is a way of getting it wrong:
 * a net that stored its own path, a net that showed only its first wire's, a wire with no path
 * that looked identical to a component with no path, a card that claimed *lifted from the ink*
 * about a route somebody drew by hand.
 */

import { describe, expect, it } from 'vitest'

import { pathsFor } from './paths'
import type { PathIndex } from '@/api/types'

/** Net 120 as the real sheet has it: four wires, and — for now — two of them traced. `C0080` is
 * the BLUE 18AWG run at y = 663.7, and `W063`'s is a hand trace across a crossover hop. */
const INDEX: PathIndex = {
  wires: {
    W052: {
      runs: [
        [
          [379.8, 663.7],
          [301.8, 663.7],
        ],
      ],
      geometry: 'extracted',
      attribution: 'human',
      conductors: ['C0080'],
    },
    W063: {
      runs: [
        [
          [562.9, 563.4],
          [301.9, 563.4],
        ],
        [
          [232.6, 563.4],
          [298.2, 563.4],
        ],
      ],
      geometry: 'human',
      attribution: 'human',
    },
  },
  nets: { '120': ['W052', 'W053', 'W063', 'W068'] },
}

describe('pathsFor', () => {
  it('gives a wire its own runs, and says where they came from', () => {
    const path = pathsFor(INDEX, 'wire', 'W052')
    expect(path?.runs).toEqual([
      [
        [379.8, 663.7],
        [301.8, 663.7],
      ],
    ])
    expect([path?.geometry, path?.attribution]).toEqual(['extracted', 'human'])
    expect(path?.conductors).toEqual(['C0080'])
    expect([path?.wires, path?.traced]).toEqual([1, 1])
  })

  it('gives a net the union of its wires — three runs from two wires, and both provenances', () => {
    // The union is the point: net 120 is four wires, two of them traced, and one of those two is
    // two runs because a crossover hop splits it. A `mixed` axis is a real state and the card
    // must not round it to either word.
    const path = pathsFor(INDEX, 'net', '120')
    expect(path?.runs).toHaveLength(3)
    expect([path?.wires, path?.traced]).toEqual([4, 2])
    expect([path?.geometry, path?.attribution]).toEqual(['mixed', 'human'])
    expect(path?.conductors).toEqual(['C0080'])
  })

  it('says how many wires a net has even when none of them is traced', () => {
    // Which is what lets the card say *none of its four wires has a path yet* rather than leaving
    // a reader to decide between "no path" and "this screen is broken".
    const path = pathsFor({ wires: {}, nets: INDEX.nets }, 'net', '120')
    expect([path?.wires, path?.traced]).toEqual([4, 0])
    expect(path?.runs).toEqual([])
    expect([path?.geometry, path?.attribution]).toEqual([null, null])
  })

  it('answers for a wire nobody has traced, and null for a kind that cannot have a path', () => {
    // Two different answers on purpose. An untraced wire is waiting for the path editor and the
    // card says so; a component has no route in the way a stone has no opinion, and a card that
    // announced *no path yet* on every relay would be noise on 178 of the 275 rows.
    expect(pathsFor(INDEX, 'wire', 'W053')).toEqual({
      runs: [],
      wires: 1,
      traced: 0,
      geometry: null,
      attribution: null,
      conductors: [],
    })
    expect(pathsFor(INDEX, 'component', 'CR2')).toBeNull()
    expect(pathsFor(INDEX, 'terminal', 'CR2:14')).toBeNull()
  })

  it('is still an answer before /api/paths has landed, or after it failed', () => {
    // The index is null while it loads and after a failure, and the tab must not decide that a
    // wire has no path because a fetch was slow. Nothing to paint either way; the difference is
    // that this one is not a claim about the file.
    const path = pathsFor(null, 'wire', 'W052')
    expect(path?.runs).toEqual([])
    expect(pathsFor(null, 'component', 'CR2')).toBeNull()
  })

  it('deduplicates the conductors it names, in the order the wires are listed', () => {
    // Two wires lifted from one conductor is a real case — a run carrying two circuits' worth of
    // ink — and naming `C0080 C0080` on the card would read as a bug in the file.
    const shared: PathIndex = {
      wires: {
        W052: INDEX.wires.W052,
        W053: { ...INDEX.wires.W052, conductors: ['C0080', 'C0081'] },
      },
      nets: { '120': ['W052', 'W053'] },
    }
    expect(pathsFor(shared, 'net', '120')?.conductors).toEqual(['C0080', 'C0081'])
  })
})
