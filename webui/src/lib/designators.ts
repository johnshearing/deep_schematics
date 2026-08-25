/**
 * Turning the designator index into a lookup, and the rules for what may be clicked.
 *
 * **This is an allowlist, and that is the security property.** The text being matched is model
 * output. Pattern-matching it — "anything that looks like `W###`" — would let an answer mint
 * clickable targets, and the whole point of the citation seam is that a clickable span is one
 * the server said exists. So: exact lookup, case-folded, and the one bounded tolerance
 * documented on `resolve` — which still resolves only ids the index holds.
 *
 * Pure, because the ambiguity rules below are the part that can be wrong and a store is an
 * awkward place to assert against.
 */

import type { Designator, DesignatorIndex, Place, Placement } from '@/api/types'

/**
 * How well a point is known, in the words the screen uses — and **one copy of those words.**
 *
 * The Locate tab's row states and the Drawing tab's member roster describe the same three
 * claims, and a reader who learned "on its component" from the editor must meet the same phrase
 * on the reader's side. `null` is not in the map because it is not a placement: nothing is
 * known, and that reads `nowhere`.
 */
export const PLACEMENT_LABEL: Record<Placement, string> = {
  confirmed: 'placed',
  seed: 'estimate',
  parent: 'on its component',
}

/** What a member of a net or a wire says about itself, including the no-point case. */
export const NOWHERE_LABEL = 'nowhere'

export function placementLabel(placement: Placement | null | undefined): string {
  return placement ? PLACEMENT_LABEL[placement] : NOWHERE_LABEL
}

/**
 * What a row in either tab's list is showing.
 *
 * `computed` is a net or a wire whose ends are known from its terminals and whose **printed name
 * has not been placed**. `labelled` is the same thing once somebody has said where that name is
 * written. Neither is ever `parent` or `seed`: nothing estimates a label.
 *
 * **It lives here, in a leaf module, because two lists now read it.** The editor's list computes
 * it from the draft (`model.ts` `rowState`, which is draft-aware and re-exports this type) and the
 * Drawing tab's list computes it from the index alone (`readerRowState` below). The words on the
 * row come from one table either way — `components/DesignatorList.tsx` — so a reader who learns
 * *on its component* in the editor meets the same phrase as a reader with no password at all.
 */
export type RowState = Placement | 'computed' | 'labelled' | 'none'

/**
 * The row state a **reader** sees, from the published index and nothing else.
 *
 * Deliberately not `model.ts`'s `rowState`: that one is handed the editor's draft, which is the
 * unsaved half of the truth and does not exist on a server started without `SWUI_ALLOW_EDITS`.
 * The Drawing tab's list must work for somebody who has no editor password at all, so it reads
 * only what `/api/designators` publishes — which after a save is the same answer, because the
 * store re-reads the index (`refreshDesignators`).
 */
export function readerRowState(entry: Designator): RowState {
  if (entry.kind === 'wire' || entry.kind === 'net') {
    if (entry.label_point) return 'labelled'
    return entry.point ? 'computed' : 'none'
  }
  return entry.placement ?? 'none'
}

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

/**
 * The one span shape tolerated beyond an exact id, and the reason it is safe.
 *
 * `` `net 110` `` is the most natural thing a model can write and it used to resolve to nothing:
 * the entry's id is `110`, nets carry no aliases, and the lookup is of the whole span. The prompt
 * now says to write net `` `110` ``, and `prompts.py` is where that belongs — but the client can
 * meet it halfway for free, and a reader does not care whose fault a dead link was.
 *
 * **This is still not a pattern match.** The id has to be in the index, exactly, and the kind word
 * has to *agree* with the kind the index gave it — so `` `component 1` `` cannot land on a net
 * named `1`. Nothing here can name a target the server did not.
 */
const KIND_WORD: Record<string, Designator['kind']> = {
  COMPONENT: 'component',
  TERMINAL: 'terminal',
  NET: 'net',
  WIRE: 'wire',
}

/** The entry a backticked span points at, or null if it points at nothing. */
export function resolve(
  byToken: Map<string, Designator>,
  token: string | null | undefined,
): Designator | null {
  if (!token) return null
  const key = normalise(token)
  const exact = byToken.get(key)
  // An exact hit always wins, so a component actually called `NET 110` keeps its own span.
  if (exact) return exact

  const parts = /^([A-Z]+) (.+)$/.exec(key)
  const kind = parts && KIND_WORD[parts[1]]
  if (!kind) return null
  const entry = byToken.get(parts![2])
  return entry?.kind === kind ? entry : null
}

/** What to call this kind of thing in a sentence. */
export const KIND_LABEL: Record<Designator['kind'], string> = {
  component: 'component',
  terminal: 'terminal',
  net: 'net',
  wire: 'wire',
}

/** The question a click on the drawing puts in the composer. It is a starting point, not a
 * submission — the reader edits it and presses Ask, so it must be short.
 *
 * **A component's is deliberately open-ended**, asked for by the user 2026-08-19: standing at a
 * marker, the useful first question is not one facet of the thing but everything the extraction
 * has on it — what it is, what it switches, every net and wire that lands on it, and where else
 * it is drawn. A narrow question gets a narrow answer and hides the rest. The other three kinds
 * stay specific because each has one fact a reader is nearly always after, and because a net or
 * a wire's "everything" is a table the deterministic views will give away for free. */
export function suggestedQuestion(entry: Designator): string {
  switch (entry.kind) {
    case 'component':
      return `Please tell me all you can about ${entry.id}`
    case 'terminal':
      return `What lands on ${entry.id}, and what net is it on?`
    case 'net':
      return `What is on net ${entry.id} — how many wires and how many terminals?`
    case 'wire':
      return `Where does the wire ${entry.id} run, and what is it for?`
  }
}
