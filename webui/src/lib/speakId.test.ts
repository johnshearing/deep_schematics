import { describe, expect, it } from 'vitest'

import type { Designator, DesignatorKind } from '@/api/types'
import { sayWords, speakId, splitNotation } from './speakId'

function entry(kind: DesignatorKind, id: string): Designator {
  return { id, kind, label: id, on_sheet: true, members: [], point: [0, 0], rect: null } as Designator
}

/** `talkthrough_01.md` §4.3 — one case per rule. Real ids, because they are the shapes that
 * matter; the source itself names none. */
describe('speakId', () => {
  it('says a terminal as its block, the word terminal, then its pin', () => {
    expect(speakId(entry('terminal', 'TB-0V:9'), 'TB-0V:9')).toBe('T B zero V terminal 9')
    expect(speakId(entry('terminal', 'CR-BP:A1'), 'CR-BP:A1')).toBe('C R B P terminal A 1')
  })

  it('spells a short run of capitals and says a long one as a word', () => {
    expect(speakId(entry('component', 'PB1'), 'PB1')).toBe('P B 1')
    expect(speakId(entry('component', 'BYPASS-CB'), 'BYPASS-CB')).toBe('bypass C B')
    expect(speakId(entry('terminal', 'RECEPT1:3'), 'RECEPT1:3')).toBe('recept 1 terminal 3')
  })

  it('says a short run as a word when it plainly is one', () => {
    expect(speakId(entry('net', 'RUN'), 'RUN')).toBe('net run')
    expect(speakId(entry('component', 'CR-ON'), 'CR-ON')).toBe('C R on')
    expect(speakId(entry('component', 'CR-SW'), 'CR-SW')).toBe('C R S W')
  })

  it('reads digits after a leading zero one at a time, and leaves any other number whole', () => {
    expect(speakId(entry('wire', 'W048'), 'W048')).toBe('W zero four eight')
    expect(speakId(entry('net', '125'), '125')).toBe('net 125')
  })

  it('turns dashes and underscores into spaces', () => {
    expect(speakId(entry('net', '24E-1'), '24E-1')).toBe('net 24 E 1')
    expect(speakId(entry('component', 'X_Y'), 'X_Y')).toBe('X Y')
  })

  it('says net once, whether the text or the span already did', () => {
    expect(speakId(entry('net', '125'), '125', 'sitting on net')).toBe('125')
    expect(speakId(entry('net', '121'), 'net 121')).toBe('net 121')
    expect(speakId(entry('net', '121'), 'net 121', 'probe the net')).toBe('121')
    expect(speakId(entry('net', 'NET-PB1'), 'NET-PB1')).toBe('net P B 1')
  })

  it('names a polarity pin rather than dropping it', () => {
    expect(speakId(entry('terminal', 'PS1:-'), 'PS1:-')).toBe('P S 1 terminal minus')
  })
})

describe('the user\'s pronunciations (talkthrough_03.md §5)', () => {
  const disc = entry('component', 'DISC1')
  const lists = (global: [string, string][], drawing: [string, string][] = []) => ({
    global: new Map(global), drawing: new Map(drawing),
  })

  it('layers them: built-in, then the global list, then the drawing\'s', () => {
    expect(speakId(disc, 'DISC1')).toBe('disc 1')
    expect(speakId(disc, 'DISC1', '', lists([['DISC1', 'disconnect 1']]))).toBe('disconnect 1')
    expect(speakId(disc, 'DISC1', '', lists([['DISC1', 'disconnect 1']], [['DISC1', 'the disconnect']]))).toBe(
      'the disconnect',
    )
  })

  it('matches the token as written, or the id it resolved to, exactly', () => {
    expect(speakId(disc, 'disc1', '', lists([['DISC1', 'disconnect 1']]))).toBe('disconnect 1') // by id
    expect(speakId(disc, 'component DISC1', '', lists([['DISC1', 'disconnect 1']]))).toBe('disconnect 1')
    expect(speakId(disc, 'DISC1', '', lists([['disc1', 'x']]))).toBe('disc 1')
  })

  it('says a listed form literally: no net, no spelling', () => {
    expect(speakId(entry('net', '0V'), '0V', '', lists([['0V', 'zero volt bus']]))).toBe('zero volt bus')
  })

  it('reads the one-off notation, and empty quotes as silence', () => {
    expect(splitNotation('DISC1 "disconnect 1"')).toEqual({ token: 'DISC1', say: 'disconnect 1', keep: false })
    expect(splitNotation('W12 ""')).toEqual({ token: 'W12', say: '', keep: false })
    expect(splitNotation('DISC1')).toEqual({ token: 'DISC1', say: null, keep: false })
    expect(splitNotation('say "hi" there')).toEqual({ token: 'say "hi" there', say: null, keep: false })
  })

  it('replaces whole words in prose, keeping their punctuation, and nothing else', () => {
    const l = lists([['115VAC', '115 volts AC']])
    expect(sayWords('Feed (115VAC), not 115VACS or 115vac.', l)).toBe('Feed (115 volts AC), not 115VACS or 115vac.')
  })
})
