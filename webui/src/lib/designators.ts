/**
 * Turning the designator index into a lookup, and the rules for what may be clicked.
 *
 * **This is an allowlist, and that is the security property.** The text being matched is model
 * output. Pattern-matching it — "anything that looks like `W###`" — would let an answer mint
 * clickable targets, and the whole point of the citation seam is that a clickable span is one
 * the server said exists. So: exact lookup, case-folded, nothing else.
 *
 * Pure, because the ambiguity rules below are the part that can be wrong and a store is an
 * awkward place to assert against.
 */

import type { Designator, DesignatorIndex, Place } from '@/api/types'

/**
 * Everywhere this identifier is drawn, as one list whether the server sent one place or five.
 *
 * The payload omits `places` for the 269 of 275 entries that have a single point, because
 * duplicating a coordinate into a second field costs bytes and says nothing. That optimisation
 * must not leak into every caller: read the geometry through here, and a relay drawn in three
 * places behaves like a terminal drawn in one.
 */
export function placesOf(entry: Designator): Place[] {
  if (entry.places?.length) return entry.places
  if (!entry.point) return []
  return [{ point: entry.point, placement: entry.placement ?? 'seed' }]
}

/** Case and surrounding space are the only variation worth absorbing. An answer writes
 * `` `cr-bp` `` for `CR-BP` often enough; anything looser starts guessing. */
export function normalise(token: string): string {
  return token.trim().replace(/\s+/g, ' ').toUpperCase()
}

/**
 * Build the token → entry map.
 *
 * Two rules, both of which the real extraction needs:
 *
 * - **Ids beat aliases.** `CR-BP` is its own alias, and `MXCS-M9` is both a component and an
 *   alias of one; the id must always win or a citation resolves to the wrong thing.
 * - **An ambiguous alias is dropped, not arbitrated.** Three aliases in this extraction are
 *   claimed by two components each ("switch relay", "run bypass relay", "24E-1 terminal").
 *   Flying the reader to whichever one happened to be parsed first is worse than leaving the
 *   span as plain text, because it looks authoritative.
 */
export function buildLookup(index: DesignatorIndex | null): Map<string, Designator> {
  const byToken = new Map<string, Designator>()
  // Tolerant of a payload that is not the shape promised, not just of a missing one: this is
  // the only consumer, an empty map means "no clickable citations", and that is a far better
  // failure than a render-time throw inside every answer.
  const entries = Array.isArray(index?.entries) ? index.entries : []

  for (const entry of entries) byToken.set(normalise(entry.id), entry)

  const claimed = new Map<string, Designator | null>()
  for (const entry of entries) {
    for (const alias of entry.aliases ?? []) {
      const key = normalise(alias)
      if (!key || byToken.has(key)) continue
      const owner = claimed.get(key)
      // `null` marks a key two entries have claimed. It stays null however many follow.
      claimed.set(key, owner === undefined || owner === entry ? entry : null)
    }
  }
  for (const [key, entry] of claimed) if (entry) byToken.set(key, entry)

  return byToken
}

/** The entry a backticked span points at, or null if it points at nothing. */
export function resolve(
  byToken: Map<string, Designator>,
  token: string | null | undefined,
): Designator | null {
  if (!token) return null
  return byToken.get(normalise(token)) ?? null
}

/** What to call this kind of thing in a sentence. */
export const KIND_LABEL: Record<Designator['kind'], string> = {
  component: 'component',
  terminal: 'terminal',
  net: 'net',
  wire: 'wire',
}

/** The question a click on the drawing puts in the composer. It is a starting point, not a
 * submission — the reader edits it and presses Ask, so it must be short and specific. */
export function suggestedQuestion(entry: Designator): string {
  switch (entry.kind) {
    case 'component':
      return `What does ${entry.id} do, and what is connected to it?`
    case 'terminal':
      return `What lands on ${entry.id}, and what net is it on?`
    case 'net':
      return `What is on net ${entry.id} — how many wires and how many terminals?`
    case 'wire':
      return `Where does the wire ${entry.id} run, and what is it for?`
  }
}
