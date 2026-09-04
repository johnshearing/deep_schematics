/**
 * Every rule the review screen applies, pure and with no React in it — the same split
 * `features/locate/model.ts` has, and for the same reason: if the order of the queue or the shape
 * of a written correction is wrong, it is wrong *here*, where it can be asserted without a screen.
 *
 * Four questions live in this file.
 *
 * **What order is the queue in.** Worst-confidence first, and the readings with nothing read at all
 * grouped at the end — they need a *decision* rather than a correction, and mixing them into the
 * confidence ranking would put 71 blanks at the very top of a queue whose first hundred rows are
 * the ones a person can actually fix.
 *
 * **Which rows are showing.** A scope (the extractor's own doubts, everything, or the readings
 * somebody has called *not a label*) and one filter (the readings a run's net name depends on).
 * Deliberately fewer controls than the Drawing tab's list: there is no id worth searching for
 * here — `T0247` means nothing to anybody — so the way in is the order and the scope, not a box.
 *
 * **What a decision writes.** And the one rule worth stating twice: *Reset* **deletes** the entry
 * rather than writing the machine's reading back in as though a person had chosen it. That is
 * invariant 10 in a third set of clothes — a file that cannot tell *nobody has looked at this* from
 * *somebody decided the machine was right* has stopped being a record of who said what.
 *
 * **And, since 2026-09-03, what sort of string a reading now is.** `classifyLabel` is a mirror of
 * `classify_label()` in `schematic_skills/scripts/extract.py`, and it is here for one narrow job:
 * the badge on a corrected row. See its own comment for why a mirror is the right answer and where
 * the drift is bounded.
 */

import type { CorrectionsDocument, ReviewItem, StoredCorrection } from '@/api/types'

/** What this client writes. The server accepts 1 and only 1; a later bump is a migration and this
 * is where the client's half of it lands. */
export const SCHEMA = 1

/** Which readings the queue is over. */
export type Scope = 'flagged' | 'all' | 'rejected'

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
  {
    /**
     * **The way back to a decision that is hard to take back.**
     *
     * *Not a label* is 276 decisions on this drawing and until now there was no way to list them.
     * That matters more on a **run** than on a label, because there the button means *no net name
     * is printed on this run* — `corrected_text()` drops a `null`, so the path matcher never sees
     * that run again. Thirty-four net names were given up that way on 2026-09-01, used as a
     * bookmark, and finding them again took a database query rather than a click.
     *
     * Over **every** reading rather than only the flagged ones, on purpose: a decision is a
     * decision whether or not the extractor had doubts about the row it was taken on.
     */
    id: 'rejected',
    label: 'Not a label',
    title:
      'Every reading somebody has said is not a label at all. On a run that means no net name ' +
      'is printed on it, which is the one decision here the path matcher acts on by ignoring ' +
      'the run — so it is worth being able to come back to. Reset (↺) takes it back.',
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
    // Read off the *stored* decision rather than off `rowState`, which folds a rejection in with
    // four other states. `correction.text === null` is the claim itself, and it is already in the
    // payload — this scope is a predicate and not a new field.
    if (scope === 'rejected' && item.correction?.text !== null) return false
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

// -- what sort of string this is ------------------------------------------------------------

/**
 * The eight roles a string can play on a wiring diagram, as `classify_label()` names them.
 *
 * A **hint for the reader and never a filter** — `ink.py` says so about the same value, and
 * nothing on the server or the client branches on it. It is on the row because *the extractor
 * thinks this is a net number* is useful context for deciding whether it read the string right.
 */
export type LabelKind =
  | 'empty'
  | 'wire_spec'
  | 'wire_colour'
  | 'voltage'
  | 'net_number'
  | 'terminal_number'
  | 'designator'
  | 'note'
  | 'text'

const WIRE_COLOURS = new Set([
  'BLACK', 'WHITE', 'BLUE', 'GREEN', 'RED', 'ORANGE', 'BROWN', 'GREY', 'GRAY', 'YELLOW',
  'VIOLET', 'PURPLE', 'PINK', 'TAN', 'CLEAR', 'SHIELD',
])
const GAUGE = /^\d{1,2}\s*A[VW]G$/i
const NET_NUMBER = /^\d{1,4}$/
const VOLTAGE = /^[+-]?\d{1,3}\s*V(AC|DC)?$/i
const DESIGNATOR =
  /^(CR|CB|PB|PS|PLG|P|S|L|H|TB|FU|F|M|SW|LT|DISC|SPD|GND|PE)[-_]?[A-Z0-9]{0,6}$/
const TERMINAL = /^[A-Z]{1,2}\d{0,2}$/

/**
 * What sort of string this is — **a mirror of `classify_label()` in
 * `schematic_skills/scripts/extract.py`**, rule for rule and in the same order.
 *
 * ### Why a mirror rather than a second opinion, or a server call
 *
 * The original is in the extraction script, which imports PyMuPDF and calls `sys.exit(1)` when it
 * is missing, and which is not on the server's path — so the server cannot import it either. A
 * port is therefore the only way anybody gets this answer, and the honest choice is *where* to put
 * the port. It is here, because `kind` is a hint for a reader and this is the reader's code.
 *
 * ### Where the drift is bounded, which is the part that matters
 *
 * Two copies of a rule can come to disagree, and `labelKind` below is what keeps the cost of that
 * at zero for the 664 rows nobody has touched: an **uncorrected** row shows the extraction's own
 * `kind`, verbatim, which cannot drift because it *is* the extraction's answer. This function is
 * consulted only where a person has changed the text — where the extraction's answer is stale by
 * construction and the alternative is a badge that is certainly wrong.
 *
 * `review/model.test.ts` pins it against a table of 45 strings generated from the Python, which is
 * the other half of the guard: if `classify_label` changes, that table is what says so.
 */
export function classifyLabel(text: string): LabelKind {
  const t = text.trim().toUpperCase()
  if (!t) return 'empty'
  const parts = t.split(/\s+/)
  const colourFirst = WIRE_COLOURS.has(parts[0].split('/')[0])
  const hasGauge = parts.some((part) => GAUGE.test(part))
  if (colourFirst && hasGauge) return 'wire_spec'
  if (colourFirst && parts.length === 1) return 'wire_colour'
  if (parts.length === 1) {
    if (VOLTAGE.test(t) || t === '0V') return 'voltage'
    // One or two digits is a relay contact or a plug pin marking; three or four is a printed net
    // designator on this drawing style. That comment is the Python's own.
    if (NET_NUMBER.test(t)) return t.length <= 2 ? 'terminal_number' : 'net_number'
    if (DESIGNATOR.test(t)) return 'designator'
    if (TERMINAL.test(t)) return 'terminal_number'
  }
  if (parts.length >= 5) return 'note'
  return 'text'
}

/**
 * The badge on one row: **what sort of string it now says it is.**
 *
 * The defect this fixes is small and it was reported three times in different words. The row drew
 * the *extraction-time* `kind`, so after `125,` → `125` the badge went on saying `text` where the
 * classifier would now say `net_number` — and a badge that disagrees with the box beside it reads
 * as a field you are not allowed to correct. There is nothing to author here and no editor to
 * build: `kind` is a pure function of the text and the text is already correctable.
 *
 * Three cases, and the middle one is the whole change:
 *
 * - **a run** is a run. Its reading is a net name printed beside it, not a string with a box, so
 *   there is no kind to classify and the badge says what the row *is*.
 * - **a corrected label** is classified from what it now says. `recomputed` is true, so the row
 *   can say where the word came from.
 * - **anything else** shows the extraction's own `kind`, untouched. That covers every row nobody
 *   has decided about, and it is why this change cannot move a badge under somebody who has not
 *   asked for it — see `classifyLabel` on bounding the drift.
 *
 * A rejection (`text: null`) and a correction that empties the box both fall through to the
 * extraction's answer, deliberately: there is no string left to classify, and *the machine
 * thought this was a designator* is still the most informative thing left to say about the ink.
 */
export function labelKind(
  item: ReviewItem,
  stored: StoredCorrection | undefined,
): { kind: string; recomputed: boolean } {
  if (item.kind !== 'label') return { kind: 'run', recomputed: false }
  const settled = stored?.text
  if (settled && settled !== item.read) return { kind: classifyLabel(settled), recomputed: true }
  return { kind: item.label_kind ?? 'text', recomputed: false }
}

// -- the note ------------------------------------------------------------------------------

/**
 * Attach a note to a decision, or **remove it** with an empty one.
 *
 * `note` has been in the schema, parsed and validated since Session 4, and until now the only way
 * to write one was to stop the server and hand-edit the file. That gap had a cost: asked how to
 * describe a row that is odd, the honest answer was *there is nowhere*, so **not a label** got
 * used as a bookmark — and on a run that button means *no net name is printed here*, which is a
 * claim about the paper. Thirty-four net names went that way. A note is the bookmark, and the text
 * box goes back to being a claim about the ink.
 *
 * **A note rides on a decision and cannot exist without one.** `text` is required by the file — an
 * entry without it *says nothing* and is refused by name — so writing a note on a row nobody has
 * decided about would mean inventing a `text`, and the only value available is the machine's
 * reading. That would record a **confirmation** nobody made, which is invariant 10 exactly: a file
 * that cannot tell *nobody looked* from *somebody decided* has stopped being a record of who said
 * what. So the box is disabled until there is a decision, and it says so.
 *
 * No schema change (it stays 1), no new validator, no migration: `setCorrection` has preserved a
 * hand-written note through an edit since the day it was written, and this is the other half of
 * that.
 */
export function setNote(
  document: CorrectionsDocument,
  item: ReviewItem,
  note: string,
): CorrectionsDocument {
  const existing = document.labels?.[item.id]
  // Nothing to hang it on. Refused rather than invented — see above.
  if (!existing) return document

  const trimmed = note.trim()
  const next: StoredCorrection = { ...existing }
  if (trimmed) next.note = trimmed
  else delete next.note
  return { ...document, labels: { ...document.labels, [item.id]: next } }
}
