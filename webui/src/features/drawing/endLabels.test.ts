/**
 * The end-label rule, tested as arithmetic.
 *
 * Everything here is a fault that reads as a cosmetic problem and is not one. A label on the wrong
 * side sits **on the conductor it names**, which is the one place it must not be when the whole job
 * of the highlight is *which of these lines is the one I care about*. A label that moves when an
 * unrelated switch is pressed is a label a reader stops believing is attached to anything. And a
 * default written into the file as though a human chose it destroys the distinction the file exists
 * for, which no screen will ever show you.
 */

import { describe, expect, it } from 'vitest'

import { defaultSide, planEndLabels, type PlannedLabel } from './endLabels'
import type { Compass, Designator } from '@/api/types'

/** Two pins 100 pt apart on a horizontal run, and a third off to the south. */
const A: [number, number] = [200, 500]
const B: [number, number] = [300, 500]
const C: [number, number] = [250, 700]

function wire(over: Partial<Designator> = {}): Designator {
  return {
    id: 'W052', kind: 'wire', label: 'BLUE 18AWG wire, X:1 → Y:2', on_sheet: false,
    members: ['X', 'Y'], point: [250, 500], rect: [200, 500, 300, 500], spec: 'BLUE 18AWG',
    terminals: [
      { id: 'X:1', point: A, placement: 'confirmed' },
      { id: 'Y:2', point: B, placement: 'confirmed' },
    ],
    ...over,
  }
}

function net(over: Partial<Designator> = {}): Designator {
  return {
    id: '120', kind: 'net', label: 'control 24VDC, 3 terminals', on_sheet: true,
    members: ['X', 'Y', 'Z'], point: [250, 566], rect: [200, 500, 300, 700],
    terminals: [
      { id: 'X:1', point: A, placement: 'confirmed' },
      { id: 'Y:2', point: B, placement: 'confirmed' },
      { id: 'Z:3', point: C, placement: 'confirmed' },
    ],
    ...over,
  }
}

const sides = (planned: PlannedLabel[]) =>
  Object.fromEntries(planned.map((label) => [`${label.owner}@${label.terminal}`, label.dir]))

describe('defaultSide', () => {
  it('faces away from the thing it belongs to, snapped to the nearest of eight', () => {
    // The run heads east from A, so A's label sits west of it — clear of its own conductor.
    expect(defaultSide(A, B)).toBe('w')
    expect(defaultSide(B, A)).toBe('e')
    // y is down, as the page is.
    expect(defaultSide([200, 400], [200, 500])).toBe('n')
    expect(defaultSide([200, 600], [200, 500])).toBe('s')
    expect(defaultSide([300, 400], [200, 500])).toBe('ne')
  })

  it('starts at east when there is no direction to compute', () => {
    // A net of one member, or an end whose partner nobody has placed. Not an error, and not a
    // reason to guess: east is what the marker layer does with a label nobody has placed.
    expect(defaultSide(A, A)).toBe('e')
  })

  it('steps clockwise past a side something else already has', () => {
    const taken = new Set<Compass>(['w', 'nw'])
    // `w` is the honest answer and it is occupied, so it walks n, ne, e… — adjacent, so the two
    // labels read as one cluster belonging to one dot.
    expect(defaultSide(A, B, taken)).toBe('n')
    expect(defaultSide(A, B, new Set<Compass>(['w']))).toBe('nw')
  })
})

describe('planEndLabels', () => {
  it('puts a wire’s two labels at its two ends, each away from the other', () => {
    const planned = planEndLabels([wire()])
    expect(planned.map((label) => label.text)).toEqual(['BLUE 18AWG', 'BLUE 18AWG'])
    expect(sides(planned)).toEqual({ 'W052@X:1': 'w', 'W052@Y:2': 'e' })
  })

  it('shows the spec rather than the id, and nothing where there is no spec', () => {
    // `W052` is an id the extraction invented: a reader holding the sheet will not find it
    // anywhere. The spec is what is written beside the conductor.
    expect(planEndLabels([wire({ spec: undefined })])).toEqual([])
  })

  it('faces a net terminal away from the rest of the net', () => {
    // Z:3 is 200 pt south of the other two, so its label goes south; X:1 and Y:2 face outward
    // from a centroid between and above them.
    expect(sides(planEndLabels([net()]))).toEqual({
      '120@X:1': 'nw', '120@Y:2': 'ne', '120@Z:3': 's',
    })
  })

  it('gives three labels on one terminal three different sides', () => {
    // The pin's own id, its wire's spec and its net's number, all hanging off one dot. Precedence
    // is fixed rather than negotiable per terminal: a rule a reader cannot predict is worse than
    // a collision.
    const pin: Designator = {
      id: 'X:1', kind: 'terminal', label: 'terminal on X, net 120', on_sheet: true,
      members: ['X'], point: A, rect: [...A, ...A], placement: 'confirmed',
    }
    const planned = planEndLabels([pin, wire(), net()])
    const at = planned.filter((label) => label.terminal === 'X:1').map((label) => label.dir)

    // The terminal keeps east, which is where its own id is written. The other two take what is
    // left, and all three are distinct.
    expect(at).toEqual(['w', 'nw'])
    expect(new Set([...at, 'e']).size).toBe(3)
  })

  it('is the same plan however the index is ordered', () => {
    // The one property that makes a label trustworthy: it depends on the points and nothing else —
    // not on payload order, not on which layer is switched on, not on what is selected.
    const forwards = sides(planEndLabels([wire(), net()]))
    const backwards = sides(planEndLabels([net(), wire()]))
    expect(backwards).toEqual(forwards)
  })

  it('honours a side a human chose, even one the rule would not have picked', () => {
    const chosen = wire({
      terminals: [
        { id: 'X:1', point: A, placement: 'confirmed', label_dir: 'se' },
        { id: 'Y:2', point: B, placement: 'confirmed' },
      ],
    })
    const planned = planEndLabels([chosen])
    expect(sides(planned)).toEqual({ 'W052@X:1': 'se', 'W052@Y:2': 'e' })
    // And it says so, because *Reset to default* has to know whether there is anything to delete.
    expect(planned[0].authored).toBe(true)
    expect(planned[1].authored).toBe(false)
  })

  it('draws nothing for an end somebody hid', () => {
    const hidden = wire({
      terminals: [
        { id: 'X:1', point: A, placement: 'confirmed', hidden: true },
        { id: 'Y:2', point: B, placement: 'confirmed' },
      ],
    })
    expect(planEndLabels([hidden]).map((label) => label.terminal)).toEqual(['Y:2'])
  })

  it('lets the draft override the file, so a compass click lands before the save does', () => {
    // `editorPlaces`' rule applied to sides: the server has not seen the last click. It
    // disappears the moment the save round-trips.
    const planned = planEndLabels([wire()], (owner, terminal) =>
      owner === 'W052' && terminal === 'X:1' ? { dir: 'ne' } : undefined,
    )
    expect(sides(planned)).toEqual({ 'W052@X:1': 'ne', 'W052@Y:2': 'e' })

    const hiddenInDraft = planEndLabels([wire()], () => ({ hidden: true }))
    expect(hiddenInDraft).toEqual([])
  })

  it('writes one label per dot, not one per member', () => {
    // Three members of a net on one coordinate is one `120`, not three fanned around it saying
    // the same word. The membership is still three — `terminals` is undeduped on purpose (H12).
    const stacked = net({
      terminals: [
        { id: 'X:1', point: A, placement: 'confirmed' },
        { id: 'X:2', point: A, placement: 'confirmed' },
        { id: 'Z:3', point: C, placement: 'confirmed' },
      ],
    })
    expect(planEndLabels([stacked]).map((label) => label.terminal)).toEqual(['X:1', 'Z:3'])
  })

  it('skips an end with nowhere to sit rather than inventing somewhere', () => {
    const half = wire({
      terminals: [
        { id: 'X:1', point: A, placement: 'confirmed' },
        { id: 'Y:2', point: null, placement: null },
      ],
    })
    const planned = planEndLabels([half])
    expect(planned.map((label) => label.terminal)).toEqual(['X:1'])
    // No other end to face away from, so east — and never the run's midpoint, which is the centre
    // of a bounding box and usually blank paper.
    expect(planned[0].dir).toBe('e')
  })
})
