/**
 * Every rule the review screen applies, pure and with no React in it — the same split
 * `features/locate/model.ts` has, and for the same reason: if the order of the queue or the shape
 * of a written correction is wrong, it is wrong *here*, where it can be asserted without a screen.
 *
 * Three questions live in this file.
 *
 * **What order is the queue in.** Worst-confidence first, and the readings with nothing read at all
 * grouped at the end — they need a *decision* rather than a correction, and mixing them into the
 * confidence ranking would put 71 blanks at the very top of a queue whose first hundred rows are
 * the ones a person can actually fix.
 *
 * **Which rows are showing.** A scope (the extractor's own doubts, or everything) and one filter
 * (the readings a run's net name depends on). Deliberately fewer controls than the Drawing tab's
 * list: there is no id worth searching for here — `T0247` means nothing to anybody — so the way in
 * is the order and the scope, not a box.
 *
 * **What a decision writes.** And the one rule worth stating twice: *Reset* **deletes** the entry
 * rather than writing the machine's reading back in as though a person had chosen it. That is
 * invariant 10 in a third set of clothes — a file that cannot tell *nobody has looked at this* from
 * *somebody decided the machine was right* has stopped being a record of who said what.
 */

import type { CorrectionsDocument, ReviewItem, StoredCorrection } from '@/api/types'

/** What this client writes. The server accepts 1 and only 1; a later bump is a migration and this
 * is where the client's half of it lands. */
export const SCHEMA = 1

/** Which readings the queue is over. */
export type Scope = 'flagged' | 'all'

export const SCOPES: { id: Scope; label: string; title: string }[] = [
  {
    id: 'flagged',
    label: 'Flagged',
    title:
      'The readings the extractor was unsure of — its own review queue, which has been sitting ' +
      'in geometry.json since the sheet was indexed and which nothing had ever read.',
  },
  {
    id: 'all',
    label: 'All readings',
    title:
      'Every string on the sheet and every run of ink, whether the extractor doubted it or not. ' +
      'It was confident and wrong about some of them, and those are unreachable otherwise.',
  },
]

/**
 * The queue's order.
 *
 * Two buckets, then confidence, then id:
 *
 * 1. **Something was read.** Sorted worst-confidence first, because that is where the mistakes are:
 *    30 of this drawing's 70 printed net names came back at 0.4. A conductor whose net name *was*
 *    bound has a reading and no confidence to rank it by, so it sits after the reads that do — its
 *    name was bound rather than guessed at, which is a different claim about a different thing.
 * 2. **Nothing was read.** The 84 blank labels and the 79 runs with no net name bound. Grouped at
 *    the end on purpose: each needs somebody to look at the paper and decide, which is slower work
 *    than correcting a string that is nearly right, and putting it first would stall the queue.
 *    Inside the group the same confidence rule keeps the blank *strings* ahead of the unbound
 *    *runs* — a blank string has a box round it on the paper to go and read, and a run has only two
 *    endpoints to follow, which is the harder look of the two.
 *
 * The id breaks every tie, so the order is total and stable — a queue that reshuffled between
 * renders would lose your place every time you typed.
 */
export function orderItems(items: readonly ReviewItem[]): ReviewItem[] {
  return [...items].sort((a, b) => {
    const bucket = rank(a) - rank(b)
    if (bucket) return bucket
    const confidence = (a.confidence ?? 2) - (b.confidence ?? 2)
    if (confidence) return confidence
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** 0 for a reading, 1 for a blank. Read from `read` rather than `text`, so correcting a blank does
 * not make the row jump out from under the caret that just corrected it. */
function rank(item: ReviewItem): number {
  return item.read ? 0 : 1
}

/**
 * The rows a scope and the net-name filter leave.
 *
 * `netNames` narrows to what Phase E's candidate ranking actually reads: every conductor, plus the
 * 70 labels a run's net name is lifted from. Finishing those 149 before the other 515 is worth
 * doing, because they are the ones that turn *17 of 26 nets match a printed conductor group* into a
 * bigger number — and the other 515 do not move that at all.
 */
export function filterItems(
  items: readonly ReviewItem[],
  scope: Scope,
  netNames: boolean,
): ReviewItem[] {
  return items.filter((item) => {
    if (scope === 'flagged' && !item.flagged) return false
    if (netNames && !item.net_name) return false
    return true
  })
}

/** How much of a filtered queue still has nobody's name on it. The honest denominator: the count in
 * the header is over what is *on screen*, so pressing `Net labels` narrows the target as well as
 * the list rather than leaving a number nothing on screen adds up to. */
export function progress(items: readonly ReviewItem[]): { decided: number; total: number } {
  return {
    decided: items.filter((item) => item.correction !== undefined).length,
    total: items.length,
  }
}

export function emptyDocument(drawingNumber: string | null): CorrectionsDocument {
  return { drawing_number: drawingNumber, schema: SCHEMA, labels: {} }
}

/** What a person decided about one reading, or `undefined` for *nobody has looked at this*. */
export function correctionOf(
  document: CorrectionsDocument,
  id: string,
): StoredCorrection | undefined {
  return document.labels?.[id]
}

export interface Stamp {
  by?: string
  at: string
}

/**
 * Record a decision about one reading — or, with `text` left `undefined`, **delete it**.
 *
 * `text: null` is *not a label*, `text: '…'` is what the ink says, and no `text` at all is *Reset*.
 * Three states in one function because they are one question with three answers, and splitting them
 * would leave three call sites to keep in step over what happens to `was`.
 *
 * **`was` is the machine's reading, never the last correction.** A second correction on the same
 * row must still record what the *extraction* saw: that is the only thing a re-extraction will
 * destroy, and the only thing anybody will ever want to audit against.
 *
 * Whole-document and returning a new one, exactly like `locate/model.ts`, so the store's single
 * write path stays the single write path.
 */
export function setCorrection(
  document: CorrectionsDocument,
  item: ReviewItem,
  text: string | null | undefined,
  stamp: Stamp,
): CorrectionsDocument {
  const labels = { ...(document.labels ?? {}) }
  if (text === undefined) {
    delete labels[item.id]
    return { ...document, labels }
  }

  const trimmed = typeof text === 'string' ? text.trim() : null
  // An empty box is *Reset*, not an empty correction. The server refuses `""` by name, and offering
  // a way to send it would be offering a way to be refused.
  if (trimmed === '') {
    delete labels[item.id]
    return { ...document, labels }
  }

  const correction: StoredCorrection = { text: trimmed, was: item.read }
  // Carried through rather than dropped: this server does not write a `note`, and a hand-written
  // one must survive somebody re-typing the reading beside it.
  const previous = document.labels?.[item.id]
  if (typeof previous?.note === 'string') correction.note = previous.note
  if (stamp.by) correction.by = stamp.by
  correction.at = stamp.at

  return { ...document, labels: { ...labels, [item.id]: correction } }
}

/** What the row says about itself, in the words the screen uses. One function so the badge, the
 * `aria` state and the test all read the same vocabulary. */
export type RowState = 'corrected' | 'rejected' | 'confirmed' | 'blank' | 'doubted' | 'read'

export function rowState(item: ReviewItem): RowState {
  const correction = item.correction
  if (correction) {
    if (correction.text === null) return 'rejected'
    if (correction.text === item.read) return 'confirmed'
    return 'corrected'
  }
  if (!item.read) return 'blank'
  return item.flagged ? 'doubted' : 'read'
}

export const ROW_LABEL: Record<RowState, string> = {
  corrected: 'corrected',
  rejected: 'not a label',
  confirmed: 'confirmed',
  blank: 'nothing read',
  doubted: 'unsure',
  read: 'read',
}
