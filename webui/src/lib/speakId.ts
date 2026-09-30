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
 *
 * **The user's own spellings win over all of that** (`talkthrough_03.md` §5), in layers, each
 * over the one before: these rules, then the global list, then the drawing's list, then a one-off
 * `` `DISC1 "disconnect 1"` `` in the answer itself. The lists are data handed in, never code, so
 * this file still names no drawing's ids.
 */

import type { Designator } from '@/api/types'

/** English, not any drawing's: words short enough to be mistaken for an abbreviation. */
const WORDS = new Set(['ON', 'OFF', 'IN', 'OUT', 'UP', 'DOWN'])

const DIGIT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** The user's pronunciation lists, `match` → `say`: exact, case-sensitive, never a pattern. */
export interface Pronunciations {
  global: ReadonlyMap<string, string>
  drawing: ReadonlyMap<string, string>
}

export const NO_PRONUNCIATIONS: Pronunciations = { global: new Map(), drawing: new Map() }

/** The most specific listed form of any of `keys`: the drawing's list, then the global one. */
export function listed(lists: Pronunciations | undefined, ...keys: string[]): string | undefined {
  for (const layer of lists ? [lists.drawing, lists.global] : []) {
    for (const key of keys) if (layer.has(key)) return layer.get(key)
  }
  return undefined
}

/**
 * The one-off notation inside a code span: the token, a space, and the spoken form in double
 * quotes (`` `DISC1 "disconnect 1"` ``). Empty quotes (`` `W12 ""` ``) show it and say nothing.
 * `say` is null for a span without the notation.
 */
export function splitNotation(span: string): { token: string; say: string | null } {
  const m = /^(.+?) "(.*)"$/.exec(span)
  return m ? { token: m[1], say: m[2] } : { token: span, say: null }
}

/** Plain words, each replaced by its listed form when it is one exactly, punctuation aside. */
export function sayWords(text: string, lists: Pronunciations | undefined): string {
  if (!lists || (!lists.global.size && !lists.drawing.size)) return text
  return text.replace(/\S+/g, (word) => {
    const [, lead, core, tail] = /^([("'“‘]*)(.*?)([)"'”’.,;:!?]*)$/.exec(word)!
    const said = core ? listed(lists, core) : undefined
    return said === undefined ? word : `${lead}${said}${tail}`
  })
}

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
export function speakId(entry: Designator, token: string, before = '', lists?: Pronunciations): string {
  const written = token.trim()
  const bare = written.replace(KIND_PREFIX, '')
  const own = listed(lists, written, bare, entry.id)
  if (own !== undefined) return own // the user's words, literally: no *net*, no spelling
  const colon = bare.lastIndexOf(':')
  const body =
    entry.kind === 'terminal' && colon > 0
      ? `${spell(bare.slice(0, colon))} terminal ${spell(bare.slice(colon + 1))}`.trim()
      : spell(bare)
  if (entry.kind !== 'net' || /\bnet\s*$/i.test(before) || /^net\b/.test(body)) return body
  return `net ${body}`
}
