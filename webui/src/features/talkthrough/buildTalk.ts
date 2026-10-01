/**
 * An answer, turned into something to speak. `talkthrough_01.md` §4.
 *
 * The talkthrough reads the answer already on the screen and highlights **exactly** the spans
 * that are links in it — so this parses with the grammar `Markdown.tsx` renders with
 * (`remark-parse` + `remark-gfm`) and asks `Citation`'s question of every inline code span:
 * does `resolve` find it, with a point, while there is a sheet to fly to? Nothing here is a
 * pattern over identifiers, for the reason `Citation.tsx` gives.
 *
 * The unit of playback is a **segment**: a sentence is cut immediately before each link, so a
 * segment that carries a `cite` starts with the identifier it names. Playing it is "highlight,
 * dwell, speak" — the eye reaches the sheet just before the ear hears the name, and a pause
 * always falls on a boundary, never mid-word.
 */

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import type { Designator, DesignatorKind } from '@/api/types'
import { resolve } from '@/lib/designators'
import { sayWords, speakId, splitNotation, type Pronunciations } from '@/lib/speakId'

export interface Cite {
  kind: DesignatorKind
  id: string
  token: string // as written
  /** Written with a trailing ` +`: light this and keep what is already lit (§6A). */
  keep?: true
}
export interface Segment {
  show: string
  say: string
  /** Fires before `say`. Absent on text before the first link, and on a repeat (rule 7). */
  cite?: Cite
  /** The link this segment starts with, as written — present on a repeat too, so the set of
   * links can be checked against the screen's before any de-duplication. */
  link?: string
  /** How the link itself is said (the user's form, or the built-in one), for *Say it as…*. */
  spoken?: string
}
/** `'q'` is the question, spoken before the answer when the reader asks for it. */
export interface Sentence {
  segments: Segment[]
  block: 'p' | 'li' | 'h' | 'row' | 'q'
  /**
   * Where it is on screen, so a selection can be mapped back to sentences (`talkthrough_02.md`
   * §5). `keys` are the markdown offsets `Markdown.tsx` writes as `data-md` on the element that
   * holds it — a paragraph's own, and for the first paragraph of a list item the item's too,
   * because a tight list renders its items without a `<p>`. `from`/`to` are the sentence's
   * character range in that element's text. Absent on the question, which is not markdown.
   */
  keys?: number[]
  from?: number
  to?: number
}
/** `items` is every cite, in order, as `{ sentence, segment }`. */
export interface Talk { sentences: Sentence[]; items: { s: number; g: number }[] }

/** Just the mdast this reads. A local shape rather than `@types/mdast`, which is not declared. */
interface MdNode {
  type: string
  value?: string
  alt?: string | null
  children?: MdNode[]
  position?: { start: { offset?: number } }
}

const offsetOf = (node: MdNode) => node.position?.start.offset ?? -1

/** A block's inline content: runs of text, and the inline code spans between them. */
type Piece = { text: string } | { code: string }

/** Past this a voice may cut an utterance off (trap T3), so a link-free stretch splits at commas. */
const LONG = 200
/** Private-use characters stand in for code spans while sentences are found (trap T2). */
const PUA = 0xe000

function inline(node: MdNode, out: Piece[]): Piece[] {
  switch (node.type) {
    case 'text':
      out.push({ text: node.value ?? '' })
      break
    case 'inlineCode':
      out.push({ code: node.value ?? '' })
      break
    case 'break':
      out.push({ text: ' ' })
      break
    case 'image':
    case 'imageReference':
      if (node.alt) out.push({ text: node.alt })
      break
    case 'html':
      break
    default:
      for (const child of node.children ?? []) inline(child, out)
  }
  return out
}

interface Block { block: Sentence['block']; pieces: Piece[]; whole: boolean; keys: number[] }

/** Rule 2 and 3: paragraphs, list items, headings and table body rows; never code or HTML. */
function blocks(node: MdNode, out: Block[], inItem = false, itemKey?: number): Block[] {
  switch (node.type) {
    case 'paragraph': {
      const keys = itemKey === undefined ? [offsetOf(node)] : [offsetOf(node), itemKey]
      out.push({ block: inItem ? 'li' : 'p', pieces: inline(node, []), whole: false, keys })
      break
    }
    case 'heading':
      out.push({ block: 'h', pieces: inline(node, []), whole: true, keys: [offsetOf(node)] })
      break
    case 'table':
      for (const row of (node.children ?? []).slice(1)) {
        const pieces: Piece[] = []
        for (const cell of row.children ?? []) {
          const content = inline(cell, [])
          if (!content.some((p) => ('code' in p ? p.code : p.text).trim())) continue
          if (pieces.length) pieces.push({ text: ', ' })
          pieces.push(...content)
        }
        out.push({ block: 'row', pieces, whole: true, keys: [offsetOf(row)] })
      }
      break
    case 'listItem':
      ;(node.children ?? []).forEach((child, k) =>
        blocks(child, out, child.type === 'paragraph', k === 0 ? offsetOf(node) : undefined),
      )
      break
    case 'code':
    case 'html':
    case 'thematicBreak':
    case 'definition':
      break
    default:
      for (const child of node.children ?? []) blocks(child, out, inItem)
  }
  return out
}

/** What is spoken for plain text: the listed words, then without the glyphs a voice reads by name. */
function sayPlain(text: string, lists?: Pronunciations): string {
  return sayWords(text, lists).replace(/→/g, ' to ').replace(/[*_`#|]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Trap T3: cut a long link-free stretch after a comma, so no one utterance runs on. */
function chunks(text: string): string[] {
  if (text.length <= LONG) return [text]
  const out: string[] = []
  let rest = text
  while (rest.length > LONG) {
    const cut = rest.lastIndexOf(', ', LONG)
    if (cut <= 0) break
    out.push(rest.slice(0, cut + 2))
    rest = rest.slice(cut + 2)
  }
  out.push(rest)
  return out
}

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })

/** Stands for a span that is not a link but carries the one-off notation, until it is restored. */
const QUOTED = 0xf000
/** What the voice is given for a stretch that contains no word at all (a lone `.` after a silent link). */
const nothingSaid = (say: string) => (/^[\p{P}\s]*$/u.test(say) ? '' : say)

export function buildTalk(
  markdown: string,
  byToken: Map<string, Designator>,
  hasViewer: boolean,
  lists?: Pronunciations,
): Talk {
  const root = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MdNode
  const sentences: Sentence[] = []
  const items: Talk['items'] = []

  for (const { block, pieces, whole, keys } of blocks(root, [])) {
    // Rule 5: each code span becomes one private-use character, so no identifier is ever split
    // or read as a sentence end, and is restored afterwards.
    // `codes` holds each span as shown, so offsets count what is on screen (trap 5); `quoted` its
    // one-off spoken form, or null.
    const codes: string[] = []
    const quoted: (string | null)[] = []
    const keeps: boolean[] = []
    let flat = ''
    for (const piece of pieces) {
      if ('code' in piece) {
        flat += String.fromCharCode(PUA + codes.length)
        const { token, say, keep } = splitNotation(piece.code)
        codes.push(token)
        quoted.push(say)
        keeps.push(keep)
      // One for one, not collapsed: a sentence's offsets must line up with the DOM's text.
      } else flat += piece.text.replace(/\s/g, ' ')
    }
    const texts = whole ? [flat] : [...segmenter.segment(flat)].map((s) => s.segment)
    /** A stretch's length on screen, where each placeholder is its whole identifier again. */
    const onScreen = (text: string) =>
      [...text].reduce((n, ch) => {
        const k = ch.charCodeAt(0) - PUA
        return n + (k >= 0 && k < codes.length ? codes[k].length : 1)
      }, 0)
    let at = 0

    for (const raw of texts) {
      const start = at
      at += onScreen(raw)
      const text = raw.trim()
      if (!text) continue
      const from = start + (raw.length - raw.trimStart().length)
      const to = at - (raw.length - raw.trimEnd().length)
      const segments: Segment[] = []
      // The segment being built: its link, the text after the link, and what came before it.
      let link: { token: string; entry: Designator; say: string | null; keep: boolean } | null = null
      // A quoted span that is not a link is kept as one character until each part is built.
      const shown = (part: string) =>
        part.replace(/[\uf000-\uf8ff]/g, (c) => codes[c.charCodeAt(0) - QUOTED] ?? c)
      const said = (part: string) =>
        sayPlain(part, lists).replace(/[\uf000-\uf8ff]/g, (c) => quoted[c.charCodeAt(0) - QUOTED] ?? c)
      let rest = ''
      let lastCite: string | null = null

      const close = () => {
        if (!link && !rest.trim()) return
        const parts = chunks(rest)
        parts.forEach((part, k) => {
          const before = segments.at(-1)?.say ?? ''
          if (k === 0 && link) {
            // A repeat that changes ` +` is not a repeat: `B +` then `B` clears the build-up.
            const key = `${link.entry.kind}:${link.entry.id}${link.keep ? ' +' : ''}`
            const spoken = link.say ?? speakId(link.entry, link.token, before, lists)
            const say = nothingSaid(`${spoken} ${said(part)}`.replace(/\s+([.,;:!?)'’])/g, '$1').trim())
            const segment: Segment = { show: link.token + shown(part), say, link: link.token, spoken }
            if (key !== lastCite) {
              segment.cite = { kind: link.entry.kind, id: link.entry.id, token: link.token }
              if (link.keep) segment.cite.keep = true
              lastCite = key
            }
            segments.push(segment)
          } else if (part.trim()) {
            segments.push({ show: shown(part), say: said(part) })
          }
        })
        link = null
        rest = ''
      }

      for (const ch of text) {
        const n = ch.charCodeAt(0) - PUA
        if (n < 0 || n >= codes.length) {
          rest += ch
          continue
        }
        const token = codes[n]
        const entry = hasViewer ? resolve(byToken, token) : null
        if (entry?.point) {
          close()
          link = { token, entry, say: quoted[n], keep: keeps[n] }
        } else if (quoted[n] !== null) rest += String.fromCharCode(QUOTED + n)
        else rest += token // Rule 4: a span that is not a link is spoken as plain text.
      }
      close()

      if (!segments.length) continue
      const s = sentences.length
      segments.forEach((segment, g) => segment.cite && items.push({ s, g }))
      sentences.push({ segments, block, keys, from, to })
    }
  }
  return { sentences, items }
}

/**
 * The question, as sentences to speak before the answer. `talkthrough_02.md` §4.
 *
 * A question is plain text, not markdown, and nothing in it is a link on screen — so nothing in it
 * is highlighted, which keeps the promise that what is spoken as a link is what is shown as one.
 * An identifier is still *said* well: a whole word that is exactly an id or alias in the index,
 * **case included**, is spoken through `speakId`. Case matters here where it does not for a link,
 * because a question is prose, and "the `Run` wire" must not become "the net run wire".
 */
export function buildQuestion(
  text: string, byToken: Map<string, Designator>, lists?: Pronunciations,
): Sentence[] {
  const exact = (word: string) => {
    const entry = byToken.get(word.toUpperCase())
    return entry && (entry.id === word || entry.aliases?.includes(word)) ? entry : null
  }
  const sentences: Sentence[] = []
  for (const { segment } of segmenter.segment(text.replace(/\s+/g, ' '))) {
    const show = segment.trim()
    if (!show) continue
    for (const part of chunks(show)) {
      const say = part.split(' ').map((word) => {
        // Leading quotes and trailing punctuation are the sentence's, not the identifier's.
        const [, lead, core, tail] = /^([("'“‘]*)(.*?)([)"'”’.,;:!?]*)$/.exec(word)!
        const entry = core && exact(core)
        return entry ? `${lead}${speakId(entry, core, '', lists)}${tail}` : word
      })
      sentences.push({ segments: [{ show: part, say: sayPlain(say.join(' '), lists) }], block: 'q' })
    }
  }
  return sentences
}

/** A place in the rendered answer: the `data-md` of the block it is in, and how far into its text. */
export interface Mark { key: number; offset: number }

/**
 * Only the sentences a selection touches, in order, with `items` recomputed. `talkthrough_02.md`
 * §5: whole sentences, because half of one is spoken badly and can cut a link in half.
 *
 * A mark in a block that holds no sentence (a code block, say) is placed by order instead, which
 * works because a `data-md` key is a markdown offset and so increases down the page.
 */
export function sliceTalk(talk: Talk, from: Mark, to: Mark): Talk {
  const { sentences } = talk
  const order = (s: Sentence) => Math.min(...(s.keys ?? [Infinity]))
  const whole = (s: Sentence) => s.block === 'row' || s.block === 'h'
  const holding = (key: number) => sentences.flatMap((s, k) => (s.keys?.includes(key) ? [k] : []))

  const inFrom = holding(from.key)
  const first = inFrom.length
    ? inFrom.find((k) => whole(sentences[k]) || from.offset < sentences[k].to!) ?? inFrom.at(-1)! + 1
    : sentences.findIndex((s) => order(s) >= from.key)
  const inTo = holding(to.key)
  const last = inTo.length
    ? [...inTo].reverse().find((k) => whole(sentences[k]) || to.offset > sentences[k].from!) ?? inTo[0] - 1
    : sentences.reduce((found, s, k) => (order(s) <= to.key ? k : found), -1)

  const kept = first < 0 || last < first ? [] : sentences.slice(first, last + 1)
  const items: Talk['items'] = []
  kept.forEach((s, k) => s.segments.forEach((g, j) => g.cite && items.push({ s: k, g: j })))
  return { sentences: kept, items }
}
