/**
 * *Is there a wire here?* — naming the line under the pointer, and saying honestly what is known
 * about it.
 *
 * ### The question, and why it took a plan to answer it
 *
 * A technician with the paper points at a run of ink and asks what it is. Until now the only way
 * to find out was to already know the wire's id and select it, which is the search this project
 * exists to remove. The three answers this returns are plan §4 q6's, verbatim:
 *
 * - ***claimed by `W063`*** — a wire's authored route was lifted from this conductor;
 * - ***`TB-120`'s commoning*** — it is a terminal block's own bus;
 * - ***no wire claims this run.***
 *
 * ### And the honesty requirement, which is not optional
 *
 * Until the authoring run is finished, the third answer is right for around **90 of the 149** —
 * most of them label leader lines and symbol strokes, and some of them wires nobody has traced
 * yet. A card that said *no wire claims this run* and stopped would teach a false fact on its
 * first use. So `traced` and `wires` come back with every verdict and the card prints them: *no
 * wire claims this run — 58 of 71 wires have a route so far.*
 *
 * ### Point space, through the one projection
 *
 * The click is turned into PDF points by `paint.ts` `cssToPoint` — invariant 2, the same
 * projection every marker and every highlight goes through — and everything here is arithmetic in
 * that space, at a tolerance in **points**, so the hit stays the same width of paper at 11% and at
 * 400%. Measuring in CSS pixels would make a zoomed-out click grab whatever conductor happened to
 * be nearest on a sheet where the rows are a fifth of a pixel apart.
 *
 * Pure, and handed the payloads: no store, no fetch, no React.
 */

import type { BlockCommoning, Conductor, PathIndex } from '@/api/types'
import { project } from '@/lib/polyline'

/**
 * How near a click has to land, in **points**, to count as pointing at a run.
 *
 * 6 pt is a little over a third of a conductor row, and the number is a compromise the other
 * constants in this project do not have to make: `ON_INK_PT` is 4 because a *placed pin* is
 * deliberate to a tenth of a point, and a pointer is not. Below about 5 pt the sheet is hard to
 * hit at fit zoom; above half a row (8) a click between two rows could take the wrong one, which
 * on this drawing names a different circuit.
 */
export const PICK_PT = 6

/** What the sheet says about the line under the pointer. */
export interface Pick {
  conductor: Conductor
  /** How far the click landed from it, in points — shown, because a 5.8 pt hit on a sheet with
   * three runs nearby is a different thing from a 0.3 pt one. */
  off: number
  /** Which wire's authored route was lifted from this run, if any. */
  claimedBy: string | null
  /** Which block's bus this run is part of, and how well that is known. */
  commoning: { block: string; confirmed: boolean } | null
}

/**
 * The nearest run of ink to a point, or null for bare paper.
 *
 * Nearest **and** within `PICK_PT`: a click in the white space between two circuits must answer
 * *nothing here* rather than reaching for the closest thing on the sheet, or the card would name a
 * conductor the reader was not pointing at and be believed.
 *
 * Ties go to the shorter run, which matters exactly where two runs meet at a pin: the short stub
 * is the one a person is pointing at when they click near its end, and the long bus passing
 * through is not.
 */
export function pickRun(
  conductors: readonly Conductor[] | null,
  at: readonly [number, number],
  claims: Claims,
  within: number = PICK_PT,
): Pick | null {
  if (!conductors) return null
  let best: { conductor: Conductor; off: number } | null = null
  for (const conductor of conductors) {
    const points = conductor.points ?? []
    if (points.length < 2) continue
    const { off } = project(at, points)
    if (off > within) continue
    if (!best || off < best.off || (off === best.off && lengthOf(conductor) < lengthOf(best.conductor))) {
      best = { conductor, off }
    }
  }
  if (!best) return null
  return {
    conductor: best.conductor,
    off: Math.round(best.off * 10) / 10,
    claimedBy: claims.byConductor[best.conductor.id] ?? null,
    commoning: claims.commoning[best.conductor.id] ?? null,
  }
}

/**
 * Who claims what, built once per payload — the reverse of `/api/paths`.
 *
 * `wires` is *this route was lifted from these conductors* and this is the transposition, exactly
 * as `wiresByTerminal` is the transposition of a wire's member terminals. One pass, on the client,
 * over a payload already on the page.
 */
export interface Claims {
  /** Conductor id → the wire whose route was lifted from it. */
  byConductor: Record<string, string>
  /** Conductor id → the block whose bus it is, and whether a person has said so. */
  commoning: Record<string, { block: string; confirmed: boolean }>
  /** How many wires the drawing has, and how many have a route. **The honesty requirement**: a
   * verdict of *no wire claims this run* means very little at 3 of 71 and a great deal at 71. */
  wires: number
  traced: number
}

/**
 * Build it.
 *
 * `authored` is `/api/paths`'s `commoning` — blocks a person has confirmed. `proposed` is the
 * shape rule's answer out of `features/locate/wiring.ts`, and the two are kept apart rather than
 * merged because the card says different words for them: *`TB-120`'s commoning* against *looks
 * like `TB-120`'s commoning — nobody has confirmed it*. Collapsing them would let the screen claim
 * a decision nobody made, which is invariant 10 wearing a third hat.
 */
export function claimsFrom(
  index: PathIndex | null,
  wires: number,
  proposed: Record<string, string[]> = {},
): Claims {
  const byConductor: Record<string, string> = {}
  const commoning: Record<string, { block: string; confirmed: boolean }> = {}

  for (const [block, runs] of Object.entries(proposed)) {
    for (const id of runs) commoning[id] = { block, confirmed: false }
  }
  for (const [block, bus] of Object.entries(index?.commoning ?? {})) {
    for (const id of (bus as BlockCommoning).conductors ?? []) {
      commoning[id] = { block, confirmed: true }
    }
  }
  for (const [wire, path] of Object.entries(index?.wires ?? {})) {
    for (const id of path.conductors ?? []) byConductor[id] = wire
  }

  return {
    byConductor,
    commoning,
    wires,
    traced: Object.keys(index?.wires ?? {}).length,
  }
}

function lengthOf(conductor: Conductor): number {
  return conductor.length ?? Infinity
}
