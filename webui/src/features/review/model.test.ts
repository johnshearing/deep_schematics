/**
 * The queue's order and what a decision writes — pure, no React, and the place a wrong answer here
 * would actually be wrong.
 *
 * The faults each of these prevents:
 *
 * - the 84 blank readings sitting at the top of a queue sorted by confidence, so the first screen of
 *   work is the slowest work there is;
 * - a row that moves out from under the caret that just corrected it, because the order reads the
 *   *corrected* text rather than what the machine read;
 * - `was` recording the previous **correction** instead of the machine's reading, which would
 *   destroy the one thing a re-extraction cannot give back;
 * - *Reset* writing the machine's reading in as though a person had chosen it, which is invariant 10
 *   and the reason `locations.json` still means anything;
 * - an empty box being sent as `""`, which the server refuses by name.
 */

import { describe, expect, it } from 'vitest'

import type { CorrectionsDocument, ReviewItem } from '@/api/types'
import {
  ROW_LABEL,
  correctionOf,
  emptyDocument,
  filterItems,
  orderItems,
  progress,
  rowState,
  setCorrection,
} from './model'

const STAMP = { by: 'js', at: '2026-08-25T09:00:00.000Z' }

/** Enough of a sheet to carry every case the order has to get right. */
function item(over: Partial<ReviewItem> & { id: string }): ReviewItem {
  return {
    kind: 'label',
    read: 'X',
    text: 'X',
    confidence: 0.9,
    flagged: false,
    net_name: false,
    rect: [0, 0, 10, 10],
    ...over,
  }
}

const MISREAD = item({ id: 'T0012', read: 'LI-A', text: 'LI-A', confidence: 0.4, flagged: true,
                       net_name: true, conductors: ['C0030'] })
const CONFIDENT = item({ id: 'T0300', read: 'P0WER IN', text: 'P0WER IN', confidence: 0.84,
                         raw_ocr: 'POWER IN' })
const BLANK = item({ id: 'T0200', read: null, text: null, confidence: 0, flagged: true })
const BOUND = item({ id: 'C0030', kind: 'conductor', read: 'LI-A', text: 'LI-A', confidence: null,
                     net_name: true })
const UNBOUND = item({ id: 'C0008', kind: 'conductor', read: null, text: null, confidence: null,
                       flagged: true, net_name: true, missing: ['net_label'] })

const ALL = [CONFIDENT, BOUND, BLANK, MISREAD, UNBOUND]

describe('orderItems', () => {
  it('puts the worst-read string first, because that is where the mistakes are', () => {
    expect(orderItems(ALL).map((i) => i.id)[0]).toBe('T0012')
  })

  it('groups everything nothing was read for at the end, since each needs a decision', () => {
    // Not a correction: somebody has to look at the paper and say what is there, which is slower
    // work than fixing a string that is nearly right — and 163 of them at the top would stall the
    // queue on its first screen.
    // Inside that group a blank *string* still comes before an unbound *run*: the string has a box
    // round it on the paper to go and read, and the run has only two endpoints to follow.
    expect(orderItems(ALL).map((i) => i.id)).toEqual([
      'T0012', 'T0300', 'C0030', 'T0200', 'C0008',
    ])
  })

  it('sorts a run after the strings, because its net name was bound rather than read', () => {
    // A conductor has no confidence to rank it by. Treating a missing confidence as 0 would put
    // every run ahead of the 0.4 misreads that are the actual work.
    const order = orderItems([BOUND, CONFIDENT]).map((i) => i.id)
    expect(order).toEqual(['T0300', 'C0030'])
  })

  it('is stable and total, so nothing shuffles between renders', () => {
    const tie = [item({ id: 'T0002' }), item({ id: 'T0001' })]
    expect(orderItems(tie).map((i) => i.id)).toEqual(['T0001', 'T0002'])
    expect(orderItems(orderItems(ALL))).toEqual(orderItems(ALL))
  })

  it('keeps a corrected blank where it was, rather than moving it under the caret', () => {
    const filled = { ...BLANK, text: '130', correction: { text: '130', was: null } }
    expect(orderItems([CONFIDENT, filled]).map((i) => i.id)).toEqual(['T0300', 'T0200'])
  })
})

describe('filterItems', () => {
  it('shows the extractor’s own doubts by default and everything on request', () => {
    expect(filterItems(ALL, 'flagged', false).map((i) => i.id).sort()).toEqual([
      'C0008', 'T0012', 'T0200',
    ])
    expect(filterItems(ALL, 'all', false)).toHaveLength(5)
  })

  it('narrows to the readings a run’s net name depends on', () => {
    // The set Phase E's ranking reads: every conductor, plus the labels their names are lifted
    // from. Finishing these first is what turns "17 of 26 nets match" into a bigger number.
    expect(filterItems(ALL, 'all', true).map((i) => i.id).sort()).toEqual([
      'C0008', 'C0030', 'T0012',
    ])
  })

  it('combines the scope and the filter rather than one overriding the other', () => {
    expect(filterItems(ALL, 'flagged', true).map((i) => i.id).sort()).toEqual(['C0008', 'T0012'])
  })
})

describe('progress', () => {
  it('counts decisions over what is on screen, so the number adds up to the list', () => {
    const decided = { ...MISREAD, correction: { text: 'L1-A', was: 'LI-A' } }
    expect(progress([decided, CONFIDENT, BLANK])).toEqual({ decided: 1, total: 3 })
  })
})

describe('setCorrection', () => {
  const empty = (): CorrectionsDocument => emptyDocument('PS20115MLM4-2')

  it('records the reading and what the machine had, so the original stays auditable', () => {
    const next = setCorrection(empty(), MISREAD, 'L1-A', STAMP)
    expect(correctionOf(next, 'T0012')).toEqual({
      text: 'L1-A', was: 'LI-A', by: 'js', at: STAMP.at,
    })
  })

  it('writes null for “this is not a label”, which no string can say', () => {
    const next = setCorrection(empty(), MISREAD, null, STAMP)
    expect(correctionOf(next, 'T0012')?.text).toBeNull()
    expect(correctionOf(next, 'T0012')?.was).toBe('LI-A')
  })

  it('keeps the machine’s reading in `was` across a second correction', () => {
    // The whole value of the field. `geometry.json` is regenerated by a re-extraction and takes the
    // original with it, so a `was` that drifted to the previous *correction* would leave nothing to
    // audit against at all.
    const once = setCorrection(empty(), MISREAD, 'L1-B', STAMP)
    const twice = setCorrection(once, MISREAD, 'L1-A', STAMP)
    expect(correctionOf(twice, 'T0012')).toMatchObject({ text: 'L1-A', was: 'LI-A' })
  })

  it('deletes the entry on Reset rather than writing the machine’s reading back in', () => {
    // Invariant 10 in a third set of clothes: a file that cannot tell *nobody has looked at this*
    // from *somebody decided the machine was right* has stopped being a record of who said what.
    const once = setCorrection(empty(), MISREAD, 'L1-A', STAMP)
    const reset = setCorrection(once, MISREAD, undefined, STAMP)
    expect(reset.labels).toEqual({})
    expect(correctionOf(reset, 'T0012')).toBeUndefined()
  })

  it('treats an emptied box as Reset, never as an empty correction', () => {
    // The server refuses `""` by name — it would read as *"I looked and there is no text here"*,
    // which is a claim about the ink — so offering a way to send it is offering a refusal.
    const once = setCorrection(empty(), MISREAD, 'L1-A', STAMP)
    expect(setCorrection(once, MISREAD, '   ', STAMP).labels).toEqual({})
  })

  it('trims what was typed, so a stray space is not a different reading', () => {
    expect(correctionOf(setCorrection(empty(), MISREAD, ' L1-A ', STAMP), 'T0012')?.text).toBe(
      'L1-A',
    )
  })

  it('records a confirmation when the reading is left as the machine had it', () => {
    // Kept, deliberately, and it is the one thing this project stores that agrees with the computed
    // value: a side would have been produced anyway with nobody looking, and nothing produces *a
    // person checked this* but a person.
    const next = setCorrection(empty(), CONFIDENT, 'P0WER IN', STAMP)
    expect(correctionOf(next, 'T0300')).toMatchObject({ text: 'P0WER IN', was: 'P0WER IN' })
  })

  it('carries a hand-written note through a retyped reading', () => {
    const noted: CorrectionsDocument = {
      ...empty(),
      labels: { T0012: { text: null, was: 'LI-A', note: 'crossover hop, not a name' } },
    }
    expect(correctionOf(setCorrection(noted, MISREAD, 'L1-A', STAMP), 'T0012')?.note).toBe(
      'crossover hop, not a name',
    )
  })

  it('leaves every other reading alone', () => {
    const one = setCorrection(empty(), MISREAD, 'L1-A', STAMP)
    const two = setCorrection(one, UNBOUND, '130', STAMP)
    expect(Object.keys(two.labels).sort()).toEqual(['C0008', 'T0012'])
    expect(one.labels).not.toBe(two.labels)
  })

  it('names a run’s net name for a conductor that never had one bound', () => {
    const next = setCorrection(empty(), UNBOUND, '130', STAMP)
    expect(correctionOf(next, 'C0008')).toMatchObject({ text: '130', was: null })
  })
})

describe('rowState', () => {
  it('tells apart nobody looking, a doubt, a correction, a confirmation and a rejection', () => {
    expect(rowState(CONFIDENT)).toBe('read')
    expect(rowState(MISREAD)).toBe('doubted')
    expect(rowState(BLANK)).toBe('blank')
    expect(rowState({ ...MISREAD, correction: { text: 'L1-A', was: 'LI-A' } })).toBe('corrected')
    expect(rowState({ ...MISREAD, correction: { text: 'LI-A', was: 'LI-A' } })).toBe('confirmed')
    expect(rowState({ ...MISREAD, correction: { text: null, was: 'LI-A' } })).toBe('rejected')
  })

  it('has a word for every state, so no row can be drawn with a blank badge', () => {
    for (const state of Object.keys(ROW_LABEL)) expect(ROW_LABEL[state as never]).toBeTruthy()
  })
})
