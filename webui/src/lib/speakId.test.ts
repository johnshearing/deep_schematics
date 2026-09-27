import { describe, expect, it } from 'vitest'

import type { Designator, DesignatorKind } from '@/api/types'
import { speakId } from './speakId'

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
