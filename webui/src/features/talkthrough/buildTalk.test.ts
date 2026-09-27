import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { DesignatorIndex, DrawingSummary } from '@/api/types'
import { Markdown } from '@/components/Markdown'
import { buildLookup } from '@/lib/designators'
import { useAppStore } from '@/stores/appStore'
import { buildTalk, type Talk } from './buildTalk'

/**
 * `talkthrough_01.md` §4.5. The fixture is two real answers from a committed acceptance run
 * (headings, lists, a fenced block, a table, links and spans that are not links), and the index
 * is the real one, trimmed to the entries those spans can reach.
 */
const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
const ANSWER = fixture('answer.md')
/** The user's own example question from §1.1, asked live on 2026-09-26: a chain of events. */
const RECEPT = fixture('recept1_3.md')
const INDEX = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/designators.json'), 'utf8'),
) as DesignatorIndex
const byToken = buildLookup(INDEX)

const links = (talk: Talk) => talk.sentences.flatMap((s) => s.segments.flatMap((g) => g.link ?? []))
const cites = (talk: Talk) => talk.items.map(({ s, g }) => talk.sentences[s].segments[g].cite!.id)
const shown = (talk: Talk) => talk.sentences.map((s) => s.segments.map((g) => g.show).join(''))

describe('buildTalk agrees with the screen', () => {
  afterEach(() => useAppStore.setState({ designators: null, byToken: new Map(), drawing: null }))

  it.each([['two acceptance answers', ANSWER], ['the RECEPT1:3 chain', RECEPT]])(
    'treats as a link exactly the spans the rendered answer made into buttons, in order (%s)',
    (_, answer) => {
    useAppStore.setState({
      designators: INDEX,
      byToken,
      drawing: { tiles: { count: 4 } } as DrawingSummary,
    })
    const { container } = render(createElement(Markdown, null, answer))
    const buttons = [...container.querySelectorAll('button.cite')].map((b) => b.textContent)
    const talk = buildTalk(answer, byToken, true)

    expect(buttons.length).toBeGreaterThan(10)
    expect(links(talk)).toEqual(buttons)
  })
})

describe('buildTalk rules (§4.2)', () => {
  const one = (md: string, viewer = true) => buildTalk(md, byToken, viewer)

  it('speaks paragraphs, list items and headings, each as its own block', () => {
    const talk = one('# Heading\n\nA paragraph.\n\n- first item\n- second item\n')
    expect(talk.sentences.map((s) => s.block)).toEqual(['h', 'p', 'li', 'li'])
  })

  it('skips fenced code and HTML, and walks a blockquote for its paragraphs', () => {
    const talk = one('Before.\n\n```\n`CR-BP` inside a fence\n```\n\n<div>raw</div>\n\n> Quoted `CR1`.\n')
    expect(shown(talk)).toEqual(['Before.', 'Quoted CR1.'])
    expect(cites(talk)).toEqual(['CR1'])
  })

  it('speaks each table body row as one sentence, cells joined by commas, never the header', () => {
    const talk = one('| Wire | From | Note |\n|---|---|---|\n| `W048` | `CR-BP:A2` | |\n| `W025` | x | y |\n')
    expect(shown(talk)).toEqual(['W048, CR-BP:A2', 'W025, x, y'])
    expect(talk.sentences.every((s) => s.block === 'row')).toBe(true)
  })

  it('does not link a span the index lacks, one with no point, or anything without a sheet', () => {
    const noPoint = new Map(byToken)
    noPoint.set('CR1', { ...byToken.get('CR1')!, point: null })
    expect(buildTalk('See `CR1` and `circuit_logic.json` and `CR2`.', noPoint, true).items).toHaveLength(1)
    expect(one('See `CR1`.', false).items).toHaveLength(0)
    expect(shown(one('See `circuit_logic.json` now.'))).toEqual(['See circuit_logic.json now.'])
  })

  it('never splits a sentence inside an identifier, however it is punctuated', () => {
    const talk = one('Probe `TB-0V`. Then `CR-BP:A1`. Done.')
    expect(shown(talk)).toEqual(['Probe TB-0V.', 'Then CR-BP:A1.', 'Done.'])
    // And a real sentence end still splits, `e.g.` does not.
    expect(one('Use a meter, e.g. a DMM. Then stop.').sentences).toHaveLength(2)
  })

  it('cuts a sentence immediately before each link, and the link rides on its segment', () => {
    const [sentence] = one('Net `121` goes to `CR1` and back.').sentences
    expect(sentence.segments.map((g) => g.show)).toEqual(['Net ', '121 goes to ', 'CR1 and back.'])
    expect(sentence.segments.map((g) => g.cite?.id)).toEqual([undefined, '121', 'CR1'])
    expect(sentence.segments[1].say).toBe('121 goes to') // "Net" was just said
    expect(sentence.segments[2].say).toBe('C R 1 and back.')
  })

  it('keeps a repeated link as a segment but does not fly to it twice in one sentence', () => {
    const talk = one('`CR1` then `CR1` again. And `CR1`.')
    expect(talk.sentences[0].segments.map((g) => g.cite?.id)).toEqual(['CR1', undefined])
    expect(links(talk)).toEqual(['CR1', 'CR1', 'CR1'])
    expect(cites(talk)).toEqual(['CR1', 'CR1'])
    expect(talk.items).toEqual([{ s: 0, g: 0 }, { s: 1, g: 1 }])
  })

  it('says it without emphasis, link syntax or arrows, and shows it as written', () => {
    const [sentence] = one('**Bold** and [a link](https://x.test) go `CR-BP:A1`→`CR-BP:A2`.').sentences
    expect(sentence.segments.map((g) => g.show).join('')).toBe('Bold and a link go CR-BP:A1→CR-BP:A2.')
    expect(sentence.segments.map((g) => g.say)).toEqual([
      'Bold and a link go', 'C R B P terminal A 1 to', 'C R B P terminal A 2.',
    ])
  })

  it('splits a long link-free stretch after a comma so no utterance runs on', () => {
    const long = Array.from({ length: 30 }, (_, k) => `clause ${k}`).join(', ') + '.'
    const [sentence] = one(long).sentences
    expect(sentence.segments.length).toBeGreaterThan(1)
    expect(sentence.segments.every((g) => g.say.length <= 200)).toBe(true)
    expect(sentence.segments.map((g) => g.show).join('')).toBe(long)
  })

  it('speaks an answer with no links, and yields nothing at all for an empty one', () => {
    const plain = one('Nothing to point at here. Just words.')
    expect(plain.sentences).toHaveLength(2)
    expect(plain.items).toEqual([])
    expect(one('').sentences).toEqual([])
    expect(one('  \n\n ').sentences).toEqual([])
  })

  it('finds every cite in the real answer, with items pointing at the segments that carry them', () => {
    const talk = one(ANSWER)
    expect(talk.items.length).toBeGreaterThan(10)
    for (const { s, g } of talk.items) expect(talk.sentences[s].segments[g].cite).toBeTruthy()
    expect(talk.items.length).toBe(
      talk.sentences.flatMap((s) => s.segments).filter((g) => g.cite).length,
    )
  })
})
