/**
 * How to say an identifier out loud. `talkthrough_01.md` §4.3.
 *
 * A voice handed `XB-0V:9` says something between "tee bee dash oh vee colon nine" and nothing
 * at all, and `W012` comes out as "double-u forty-eight". So an identifier is re-spelt before it
 * is spoken — **by shape, never by name.** No drawing's ids appear here: the rules below are the
 * whole of it, which is what lets drawing number two speak with no change.
 *
 * - A terminal (`BLOCK:PIN`) is the block, the word *terminal*, then the pin.
 * - A run of one to three capitals is spelt letter by letter (`CR`, `TB`); a longer run is a word
 *   (`SOCKET`, `BREAKER`), because a voice reads a word better than eight letters. So is a short
 *   run that is plainly a word: consonant-vowel-consonant (`BUS`), or a handful of English words
 *   that turn up in identifiers (`ON`, `OFF`).
 * - A run of digits with a leading zero is read digit by digit (`048`); any other is left for
 *   the voice to read as a number (`125`).
 * - A net says *net* first, unless the words just before it, or its own name, already do.
 */

import type { Designator } from '@/api/types'

/** English, not any drawing's: words short enough to be mistaken for an abbreviation. */
const WORDS = new Set(['ON', 'OFF', 'IN', 'OUT', 'UP', 'DOWN'])

const DIGIT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** A kind word written inside the backticks, as `resolve` accepts it (`` `net 110` ``). */
const KIND_PREFIX = /^(component|terminal|net|wire)\s+/i

function spell(text: string): string {
  if (text === '+') return 'plus'
  if (text === '-') return 'minus'
  const words: string[] = []
  for (const run of text.match(/[A-Z]+|[a-z]+|\d+|[^A-Za-z\d]+/g) ?? []) {
    if (WORDS.has(run) || /^[B-DF-HJ-NP-TV-Z][AEIOU][B-DF-HJ-NP-TV-XZ]$/.test(run)) words.push(run.toLowerCase())
    else if (/^[A-Z]{1,3}$/.test(run)) words.push(...run.split(''))
    else if (/^[A-Z]+$/.test(run)) words.push(run.toLowerCase())
    else if (/^0\d*$/.test(run)) words.push(...run.split('').map((d) => DIGIT[Number(d)]))
    else if (/^[A-Za-z\d]+$/.test(run)) words.push(run)
    // `-`, `_`, `.` and the rest are only separators; the spaces between words say them.
  }
  return words.join(' ')
}

/**
 * The spoken form of `token`, which is the span as written and resolved to `entry`.
 *
 * `before` is the text spoken just ahead of it, so that "on net `125`" is not read as
 * "on net net one two five".
 */
export function speakId(entry: Designator, token: string, before = ''): string {
  const written = token.trim()
  const bare = written.replace(KIND_PREFIX, '')
  const colon = bare.lastIndexOf(':')
  const body =
    entry.kind === 'terminal' && colon > 0
      ? `${spell(bare.slice(0, colon))} terminal ${spell(bare.slice(colon + 1))}`.trim()
      : spell(bare)
  if (entry.kind !== 'net' || /\bnet\s*$/i.test(before) || /^net\b/.test(body)) return body
  return `net ${body}`
}
