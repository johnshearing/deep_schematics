/**
 * Where a citation lands.
 *
 * The animation around this cannot be asserted on in jsdom and is not the part that can be
 * wrong anyway. What can be wrong is the destination: too far in and the reader sees a patch of
 * white paper with no landmarks, too far out and the thing they clicked is a dot among fifty.
 * These pin both ends of that.
 */

import { describe, expect, it } from 'vitest'

import { centreOn, focusScale } from './useTileViewport'

/** The real sheet at 400 DPI on a 1× display: 5.56 screen px per PDF point at native zoom. */
const NATIVE = 400 / 72
const CONTAINER = { width: 800, height: 600 }

describe('focusScale', () => {
  it('zooms a component to a readable half of native resolution', () => {
    // `components[].location` is a single point, so a degenerate rectangle is the common case,
    // not an edge case. Fit-to-rectangle is meaningless there; the fallback is what runs.
    expect(focusScale([861, 679, 861, 679], CONTAINER, NATIVE)).toBeCloseTo(NATIVE * 0.5, 6)
  })

  it('frames a net rather than diving into the middle of it', () => {
    // Net 110 spans 241 × 240 pt. 800 − 2×90 = 620 px of usable width over 241 pt is 2.57
    // px/pt, and the height binds slightly harder: 420 / 240 = 1.75.
    const scale = focusScale([620, 464, 861, 704], CONTAINER, NATIVE)
    expect(scale).toBeCloseTo(420 / 240, 6)
    // Zooming *out* to frame a region is the right answer to "where is net 110".
    expect(scale).toBeLessThan(NATIVE * 0.5)
  })

  it('never zooms past the readable ceiling for a rectangle smaller than the padding', () => {
    expect(focusScale([100, 100, 101, 101], CONTAINER, NATIVE)).toBeCloseTo(NATIVE * 0.5, 6)
  })

  it('survives a container smaller than its own padding', () => {
    // A phone in portrait, or the tab measured mid-animation. Must produce a usable scale
    // rather than a negative one, which would flip the sheet inside out.
    expect(focusScale([0, 0, 100, 100], { width: 40, height: 40 }, NATIVE)).toBeGreaterThan(0)
  })
})

describe('centreOn', () => {
  it('puts the middle of the target in the middle of the container', () => {
    const viewport = centreOn([100, 200, 300, 400], CONTAINER, 2)
    // Centre of the rect is (200, 300) pt → 400, 600 px into the sheet; the container's centre
    // is (400, 300), so the sheet's origin lands at x = 0, y = -300.
    expect(viewport).toEqual({ scale: 2, x: 0, y: -300 })
  })

  it('treats a point target as a rectangle of no size', () => {
    expect(centreOn([50, 50, 50, 50], CONTAINER, 4)).toEqual({ scale: 4, x: 200, y: 100 })
  })
})
