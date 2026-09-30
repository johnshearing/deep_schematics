import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { DesignatorIndex, DrawingSummary } from '@/api/types'
import { Markdown } from '@/components/Markdown'
import { buildLookup } from '@/lib/designators'
import { useAppStore } from '@/stores/appStore'
import { buildQuestion, buildTalk, sliceTalk, type Talk } from './buildTalk'

/**
 * `talkthrough_01.md` §4.5. The fixture is two real answers from a committed acceptance run
 * (headings, lists, a fenced block, a table, links and spans that are not links), and the index
 * is the real one, trimmed to the entries those spans can reach.
 */
const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
const ANSWER = fixture('answer.md')
/** The user's own example question from §1.1, asked live on 2026-09-26: a chain of events. */
const RECEPT = fixture('recept1_3.md')
/** The RECEPT1:3 answer with the one-off notation on every code span, in turn a spoken form,
 * silence, and none (`talkthrough_03.md` §5.2), links and plain spans alike. */
let spans = 0
const QUOTED = RECEPT.replace(/`([^`\n]+)`/g, (whole, token: string) =>
  ++spans % 3 === 1 ? `\`${token} "spoken ${spans}"\`` : spans % 3 === 2 ? `\`${token} ""\`` : whole,
)
const INDEX = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/designators.json'), 'utf8'),
) as DesignatorIndex
const byToken = buildLookup(INDEX)

const links = (talk: Talk) => talk.sentences.flatMap((s) => s.segments.flatMap((g) => g.link ?? []))
const cites = (talk: Talk) => talk.items.map(({ s, g }) => talk.sentences[s].segments[g].cite!.id)
const shown = (talk: Talk) => talk.sentences.map((s) => s.segments.map((g) => g.show).join(''))

describe('buildTalk agrees with the screen', () => {
  afterEach(() => useAppStore.setState({ designators: null, byToken: new Map(), drawing: null }))

  it.each([['two acceptance answers', ANSWER], ['the RECEPT1:3 chain', RECEPT], ['the chain with the notation', QUOTED]])(
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

describe('where each sentence is on screen (§5)', () => {
  afterEach(() => useAppStore.setState({ designators: null, byToken: new Map(), drawing: null }))

  it.each([['two acceptance answers', ANSWER], ['the RECEPT1:3 chain', RECEPT], ['the chain with the notation', QUOTED]])(
    'finds every sentence in the rendered block its keys name, at its offsets (%s)',
    (_, answer) => {
      useAppStore.setState({ designators: INDEX, byToken, drawing: { tiles: { count: 4 } } as DrawingSummary })
      const { container } = render(createElement(Markdown, null, answer))
      const talk = buildTalk(answer, byToken, true)
      let checked = 0
      for (const sentence of talk.sentences) {
        const element = sentence.keys!
          .map((k) => container.querySelector(`[data-md="${k}"]`))
          .find(Boolean)
        expect(element, sentence.segments[0].show).toBeTruthy()
        if (sentence.block === 'row' || sentence.block === 'h') continue // spoken whole
        const text = sentence.segments.map((g) => g.show).join('')
        expect(element!.textContent!.slice(sentence.from, sentence.to)).toBe(text)
        checked++
      }
      expect(checked).toBeGreaterThan(10)
    },
  )
})

describe('sliceTalk (§5)', () => {
  // p@0 "One. Two." · list item "Three `CR1`." (tight: its <li> is at 11, its text at 13) ·
  // row "`PB1`, x" · p "Four."
  const MD = 'One. Two.\n\n- Three `CR1`.\n- Five.\n\n| A | B |\n|---|---|\n| `PB1` | x |\n\nFour.\n'
  const talk = buildTalk(MD, byToken, true)
  const texts = (t: Talk) => t.sentences.map((s) => s.segments.map((g) => g.show).join(''))
  const keyOf = (text: string) => talk.sentences.find((s) => texts({ ...talk, sentences: [s] })[0] === text)!

  it('keeps whole sentences, even when the selection cuts one in half', () => {
    const p = keyOf('One.').keys![0]
    expect(texts(sliceTalk(talk, { key: p, offset: 2 }, { key: p, offset: 7 }))).toEqual(['One.', 'Two.'])
    expect(texts(sliceTalk(talk, { key: p, offset: 5 }, { key: p, offset: 9 }))).toEqual(['Two.'])
  })

  it('crosses blocks, a list and a table, and recounts the items', () => {
    const p = keyOf('One.').keys![0]
    const item = keyOf('Three CR1.').keys!.at(-1)! // the <li>'s own offset, as a tight list renders
    const row = keyOf('PB1, x').keys![0]
    const sliced = sliceTalk(talk, { key: p, offset: 6 }, { key: row, offset: 1 })
    expect(texts(sliced)).toEqual(['Two.', 'Three CR1.', 'Five.', 'PB1, x'])
    expect(sliced.items).toEqual([{ s: 1, g: 1 }, { s: 3, g: 0 }])
    expect(texts(sliceTalk(talk, { key: item, offset: 0 }, { key: item, offset: 3 }))).toEqual(['Three CR1.'])
  })

  it('places an end in an unmarked block by order, and finds nothing in a gap', () => {
    const four = keyOf('Four.').keys![0]
    expect(texts(sliceTalk(talk, { key: four - 1, offset: 0 }, { key: 10_000, offset: 0 }))).toEqual(['Four.'])
    const p = keyOf('One.').keys![0]
    expect(sliceTalk(talk, { key: p, offset: 9 }, { key: p, offset: 9 }).sentences).toEqual([])
  })
})

describe('buildQuestion', () => {
  it('spells out a whole-word identifier, case included, and highlights nothing', () => {
    const [first, second] = buildQuestion('Is "Run" live at RECEPT1:3? Check run and cr1.', byToken)
    expect(first.segments).toEqual([{ show: 'Is "Run" live at RECEPT1:3?', say: 'Is "Run" live at recept 1 terminal 3?' }])
    expect(second.segments[0].say).toBe('Check run and cr1.')
    expect(first.block).toBe('q')
  })
})

describe('pronunciation (talkthrough_03.md §5)', () => {
  const lists = (global: Record<string, string>, drawing: Record<string, string> = {}) => ({
    global: new Map(Object.entries(global)), drawing: new Map(Object.entries(drawing)),
  })
  const says = (talk: Talk) => talk.sentences.flatMap((s) => s.segments.map((g) => g.say))

  it('says the one-off form literally, shows only the token, and keeps the link', () => {
    const talk = buildTalk('Open `PB1 "push button one"` now.', byToken, true, lists({ PB1: 'listed' }))
    expect(says(talk)).toEqual(['Open', 'push button one now.'])
    expect(shown(talk)).toEqual(['Open PB1 now.'])
    expect(cites(talk)).toEqual(['PB1'])
    expect(talk.sentences[0].segments[1].spoken).toBe('push button one')
  })

  it('lights a link with empty quotes and says nothing for it', () => {
    const talk = buildTalk('Press `PB1` and `CR1 ""` closes.', byToken, true)
    expect(says(talk)).toEqual(['Press', 'P B 1 and', 'closes.'])
    expect(cites(talk)).toEqual(['PB1', 'CR1'])
    expect(says(buildTalk('Then `CR1 ""`.', byToken, true))).toEqual(['Then', ''])
  })

  it('says a quoted span that is not a link its way, and shows only its token', () => {
    const talk = buildTalk('See `no-such-thing "the other one"` here.', byToken, true)
    expect(says(talk)).toEqual(['See the other one here.'])
    expect(shown(talk)).toEqual(['See no-such-thing here.'])
    expect(links(talk)).toEqual([])
  })

  it('uses the lists for links and for whole words in prose, case-sensitively', () => {
    const talk = buildTalk('`PB1` gets 115VAC, not 115vac.', byToken, true, lists({ PB1: 'push', '115VAC': '115 volts AC' }))
    expect(says(talk)).toEqual(['push gets 115 volts AC, not 115vac.'])
  })

  it('says a question with the lists too', () => {
    expect(buildQuestion('Is PB1 on?', byToken, lists({ PB1: 'the button' }))[0].segments[0].say).toBe('Is the button on?')
  })
})
