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
import type { BlockCommoning, PathIndex } from '@/api/types'

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
      commoning: [],
      here: [],
    })
    expect(pathsFor(INDEX, 'component', 'CR2')).toBeNull()
    // A **terminal** stopped being null on 2026-09-09 — see the third block of tests below.
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

// -- Phase C: a net you can see ---------------------------------------------------------------

/** `TB-120`'s bus, as `/api/paths` publishes one. 72.7 pt of vertical joining `:1` to `:2`, and
 * **no wire may claim it** — plan §4 q10. */
const TB120_BUS: BlockCommoning = {
  runs: [
    [
      [300.1, 565.2],
      [300.1, 637.9],
    ],
  ],
  geometry: 'extracted',
  attribution: 'human',
  conductors: ['C0092'],
}

const COMMONED: PathIndex = { ...INDEX, commoning: { 'TB-120': TB120_BUS } }

/** Net 120's member terminals, as `/api/designators` publishes them. Three of them are `TB-120`'s
 * and one is on a relay contact 630 pt away, which is why the blocks are read off the members
 * rather than guessed. */
const NET120_TERMINALS = ['CR2:14', 'TB-120:1', 'TB-120:2', 'TB-120:3', 'BYPASS-CB:1']

describe('a net highlighted with its commoning', () => {
  it('paints its wires and the vertical they land on', () => {
    /**
     * **The change the user asked for on 2026-09-06, as arithmetic:** *"these vertical lines are
     * the block's own commoning, but when we highlight a net the commoning needs to be highlighted
     * too — this will make it easier to see the net."*
     *
     * Three runs from the two traced wires, and a fourth that is `TB-120`'s bus. On the real sheet
     * net `0V` is eleven runs and the 279.6 pt vertical they all land on.
     */
    const path = pathsFor(COMMONED, 'net', '120', { terminals: NET120_TERMINALS })
    expect(path?.runs).toHaveLength(4)
    expect(path?.commoning).toEqual(['TB-120'])
    expect(path?.conductors).toEqual(['C0080', 'C0092'])
    // And the counts are still about *wires*: a bus is not one and must not inflate them.
    expect([path?.wires, path?.traced]).toEqual([4, 2])
  })

  it('names each block once, however many of its pins the net lands on', () => {
    // Net 120 touches `TB-120:1`, `:2` and `:3`. One block, one bus, painted once — the same
    // reasoning that made `relatedIds` ring terminals rather than their parents, run backwards.
    const path = pathsFor(COMMONED, 'net', '120', { terminals: NET120_TERMINALS })
    expect(path?.commoning).toEqual(['TB-120'])
    expect(path?.runs.filter((one) => one[0][0] === 300.1 && one[0][1] === 565.2)).toHaveLength(1)
  })

  it('folds the bus into the provenance rather than claiming the wires answer for it', () => {
    // A net of lifted routes whose block was hand-traced is `part hand-traced`, and the card says
    // so. Rounding it to either word would put a badge on the screen that is false about part of
    // what is painted — the same honesty `mixed` was added for.
    const traced: PathIndex = {
      wires: { W052: INDEX.wires.W052 },
      nets: { '120': ['W052'] },
      commoning: { 'TB-120': { ...TB120_BUS, geometry: 'human', conductors: undefined } },
    }
    const path = pathsFor(traced, 'net', '120', { terminals: NET120_TERMINALS })
    expect(path?.geometry).toBe('mixed')
    expect(path?.conductors).toEqual(['C0080'])
  })

  it('highlights a net whose blocks nobody has commoned yet, and says nothing about them', () => {
    // **Which is every block until the authoring run happens.** A net that refused to highlight
    // its eleven runs because nobody had confirmed a bus would be a worse answer than one that
    // highlights them, so an unauthored block is silently absent rather than an error.
    const path = pathsFor(INDEX, 'net', '120', { terminals: NET120_TERMINALS })
    expect(path?.runs).toHaveLength(3)
    expect(path?.commoning).toEqual([])
  })

  it('does not paint a block bus under a selected wire, and that is the W063 lesson', () => {
    /**
     * **The one place this departs from plan §9**, which asks for a wire's highlight to union the
     * commoning in as well.
     *
     * `W063` runs `INFEED1:3 → TB-120:1` along `C0091`. `C0092` is `TB-120`'s bus, and
     * `07_drawing_facts.md` called it *"the second piece of `W063`'s L"* for a week because it
     * looks exactly like one. Painting it in the highlight colour underneath a selected wire would
     * teach that error to every reader, on every wire that lands on a block — which is the error
     * this session exists to repair.
     *
     * A net and a terminal are questions about a place in the circuit and the bus is part of the
     * answer. A wire is a claim about one piece of ink, and it is not.
     */
    const path = pathsFor(COMMONED, 'wire', 'W063', { terminals: ['INFEED1:3', 'TB-120:1'] })
    expect(path?.commoning).toEqual([])
    expect(path?.runs).toHaveLength(2)
    expect(path?.conductors).toEqual([])
  })
})

// -- Phase D: what reaches this pin -----------------------------------------------------------

/** The reverse index `lib/designators.ts` builds from the wire entries the client already has. */
const REACHING = { 'TB-120:1': ['W052', 'W063'], 'TB-0V:6': ['W042'] }

describe('a terminal, which used to be null', () => {
  it('gives a pin the wires that reach it and the bus of its own block', () => {
    /**
     * Decision 7, and the feature that makes a missing wire visible by its absence. Clicking
     * `TB-120:1` on the **Drawing** tab is a reader's question — no password, no draft, nothing to
     * move — and the click already selected the terminal, so this changes what the selection
     * *paints* and not what the click *means*.
     */
    const path = pathsFor(COMMONED, 'terminal', 'TB-120:1', { wiresByTerminal: REACHING })
    expect(path?.here).toEqual(['W052', 'W063'])
    expect(path?.commoning).toEqual(['TB-120'])
    // `W052`'s one run, `W063`'s two, and the bus.
    expect(path?.runs).toHaveLength(4)
    expect([path?.wires, path?.traced]).toEqual([2, 2])
  })

  it('is an answer and not a shrug for a pin no wire reaches', () => {
    // The absence *is* the finding, and it is why this was built before the authoring run rather
    // than after it: `TB-0V:8`, `:9` and `:11` have no wire on them in the ink today, and three
    // wires that have to be assigned to them. An empty highlight with `0 wires` beside it is the
    // instrument for that; null would have been a shrug.
    const path = pathsFor(COMMONED, 'terminal', 'TB-120:3', { wiresByTerminal: REACHING })
    expect(path).not.toBeNull()
    expect(path?.here).toEqual([])
    expect(path?.wires).toBe(0)
    // The block's bus still paints: *nothing lands here and this is the block it is on* is a more
    // useful answer than a blank sheet.
    expect(path?.commoning).toEqual(['TB-120'])
    expect(path?.runs).toHaveLength(1)
  })

  it('survives a payload that has not landed, without claiming the pin is bare', () => {
    const path = pathsFor(null, 'terminal', 'TB-120:1', { wiresByTerminal: REACHING })
    expect(path?.here).toEqual(['W052', 'W063'])
    expect(path?.runs).toEqual([])
    expect(path?.commoning).toEqual([])
  })
})
