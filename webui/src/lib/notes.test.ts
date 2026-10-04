import { describe, expect, it } from 'vitest'

import { withoutNotes } from './notes'

describe('withoutNotes', () => {
  it('drops a note inside a sentence and one on lines of its own, without splitting the paragraph', () => {
    const md = 'First `CR1` closes. <!-- was "opens" --> Then it ends.\n<!-- a reason,\nover two lines -->\nLast line.'
    expect(withoutNotes(md)).toBe('First `CR1` closes.  Then it ends.\nLast line.')
  })

  it('leaves an unclosed note visible, and text with no note untouched', () => {
    expect(withoutNotes('Oops <!-- never closed')).toBe('Oops <!-- never closed')
    expect(withoutNotes('a < b -- c > d')).toBe('a < b -- c > d')
  })

  it('takes a note at the very end, and two notes on one line', () => {
    expect(withoutNotes('Done.\n<!-- end -->')).toBe('Done.\n')
    expect(withoutNotes('A <!-- 1 --> B <!-- 2 --> C')).toBe('A  B  C')
  })
})
