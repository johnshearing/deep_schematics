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
import { speakId } from '@/lib/speakId'

export interface Cite { kind: DesignatorKind; id: string; token: string } // token = as written
export interface Segment {
  show: string
  say: string
  /** Fires before `say`. Absent on text before the first link, and on a repeat (rule 7). */
  cite?: Cite
  /** The link this segment starts with, as written — present on a repeat too, so the set of
   * links can be checked against the screen's before any de-duplication. */
  link?: string
}
export interface Sentence { segments: Segment[]; block: 'p' | 'li' | 'h' | 'row' }
/** `items` is every cite, in order, as `{ sentence, segment }`. */
export interface Talk { sentences: Sentence[]; items: { s: number; g: number }[] }

/** Just the mdast this reads. A local shape rather than `@types/mdast`, which is not declared. */
interface MdNode { type: string; value?: string; alt?: string | null; children?: MdNode[] }

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

interface Block { block: Sentence['block']; pieces: Piece[]; whole: boolean }

/** Rule 2 and 3: paragraphs, list items, headings and table body rows; never code or HTML. */
function blocks(node: MdNode, out: Block[], inItem = false): Block[] {
  switch (node.type) {
    case 'paragraph':
      out.push({ block: inItem ? 'li' : 'p', pieces: inline(node, []), whole: false })
      break
    case 'heading':
      out.push({ block: 'h', pieces: inline(node, []), whole: true })
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
        out.push({ block: 'row', pieces, whole: true })
      }
      break
    case 'listItem':
      for (const child of node.children ?? []) blocks(child, out, child.type === 'paragraph')
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

/** What is spoken for plain text: the words, without the glyphs a voice reads by name. */
function sayPlain(text: string): string {
  return text.replace(/→/g, ' to ').replace(/[*_`#|]/g, ' ').replace(/\s+/g, ' ').trim()
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

export function buildTalk(
  markdown: string,
  byToken: Map<string, Designator>,
  hasViewer: boolean,
): Talk {
  const root = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MdNode
  const sentences: Sentence[] = []
  const items: Talk['items'] = []

  for (const { block, pieces, whole } of blocks(root, [])) {
    // Rule 5: each code span becomes one private-use character, so no identifier is ever split
    // or read as a sentence end, and is restored afterwards.
    const codes: string[] = []
    let flat = ''
    for (const piece of pieces) {
      if ('code' in piece) {
        flat += String.fromCharCode(PUA + codes.length)
        codes.push(piece.code)
      } else flat += piece.text.replace(/\s+/g, ' ')
    }
    const texts = whole ? [flat] : [...segmenter.segment(flat)].map((s) => s.segment)

    for (const raw of texts) {
      const text = raw.trim()
      if (!text) continue
      const segments: Segment[] = []
      // The segment being built: its link, the text after the link, and what came before it.
      let link: { token: string; entry: Designator } | null = null
      let rest = ''
      let lastCite: string | null = null

      const close = () => {
        if (!link && !rest.trim()) return
        const parts = chunks(rest)
        parts.forEach((part, k) => {
          const before = segments.at(-1)?.say ?? ''
          if (k === 0 && link) {
            const key = `${link.entry.kind}:${link.entry.id}`
            const spoken = speakId(link.entry, link.token, before)
            const say = `${spoken} ${sayPlain(part)}`.replace(/\s+([.,;:!?)'’])/g, '$1').trim()
            const segment: Segment = { show: link.token + part, say, link: link.token }
            if (key !== lastCite) {
              segment.cite = { kind: link.entry.kind, id: link.entry.id, token: link.token }
              lastCite = key
            }
            segments.push(segment)
          } else if (part.trim()) {
            segments.push({ show: part, say: sayPlain(part) })
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
          link = { token, entry }
        } else rest += token // Rule 4: a span that is not a link is spoken as plain text.
      }
      close()

      if (!segments.length) continue
      const s = sentences.length
      segments.forEach((segment, g) => segment.cite && items.push({ s, g }))
      sentences.push({ segments, block })
    }
  }
  return { sentences, items }
}
