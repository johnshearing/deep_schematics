import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesignatorIndex, DrawingSummary } from '@/api/types'
import { buildLookup } from '@/lib/designators'
import { timedSpeaker, type Speaker } from '@/lib/speech'
import { useAppStore } from '@/stores/appStore'
import { useChatStore, type Message } from '@/stores/chatStore'
import { setSpeakers, useTalkStore } from './talkStore'

const INDEX = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/designators.json'), 'utf8'),
) as DesignatorIndex

/** A speaker that says nothing until told to, and records what was selected when it began. */
function fakeSpeaker(supported = true) {
  let pending: ((how: 'end' | 'cancelled') => void) | null = null
  const said: {
    text: string; selected: string | undefined; pitch?: number; onBoundary?: (charIndex: number) => void
  }[] = []
  const speaker: Speaker & {
    said: typeof said; finish: () => Promise<void>; boundary: (charIndex: number) => void
  } = {
    supported,
    said,
    speak(text, _rate, pitch, onBoundary) {
      speaker.cancel()
      said.push({ text, selected: useAppStore.getState().selection?.id, pitch, onBoundary })
      return new Promise((resolve) => (pending = resolve))
    },
    cancel() {
      const p = pending
      pending = null
      p?.('cancelled')
    },
    async finish() {
      const p = pending
      pending = null
      p?.('end')
      await vi.advanceTimersByTimeAsync(0)
    },
    /** The voice reaches the word at `charIndex` of the utterance in progress. */
    boundary(charIndex) {
      said.at(-1)?.onBoundary?.(charIndex)
    },
  }
  return speaker
}

// Sentences: 0 "Start here." · 1 "Net " "121 goes to " "CR1 now." · 2 "Then " "PB1 lights." · 3 "End."
const TEXT = 'Start here. Net `121` goes to `CR1` now. Then `PB1` lights. End.'
const MESSAGE: Message = {
  id: 'a1', role: 'assistant', text: TEXT, tools: [], denials: [], status: 'done',
  thinking: false, startedAt: 1,
}

const QUESTION: Message = { ...MESSAGE, id: 'u1', role: 'user', text: 'Why is the "Run" wire dead? Check PB1.' }

let voice: ReturnType<typeof fakeSpeaker>
let timed: ReturnType<typeof fakeSpeaker>
const talk = () => useTalkStore.getState()
const texts = (s = voice) => s.said.map((x) => x.text)
const selected = () => useAppStore.getState().selection?.id

beforeEach(() => {
  vi.useFakeTimers()
  voice = fakeSpeaker()
  timed = fakeSpeaker()
  setSpeakers(voice, timed)
  useAppStore.setState({
    designators: INDEX, byToken: buildLookup(INDEX), selection: null, activeTabId: 'ask',
    drawing: { tiles: { count: 4 } } as DrawingSummary,
  })
  useChatStore.setState({ messages: [QUESTION, MESSAGE] })
  useTalkStore.setState({
    dwell: 0, rate: 1, muted: false, palette: null, voice: null, pitch: 1, questionFirst: false, showSay: false, flow: false,
  })
})

afterEach(() => {
  talk().exit()
  vi.useRealTimers()
  useAppStore.setState({ designators: null, byToken: new Map(), drawing: null, selection: null })
})

/** Play through to the segment whose `say` starts with `text`. */
async function speakUntil(text: string, s = voice) {
  for (let k = 0; k < 20 && !texts(s).at(-1)?.startsWith(text); k++) await s.finish()
}

describe('talkStore', () => {
  it('switches to the drawing and selects each cite before its segment is spoken', async () => {
    talk().start(MESSAGE)
    expect(useAppStore.getState().activeTabId).toBe('drawing')
    await speakUntil('P B 1')
    expect(voice.said.map(({ text, selected }) => ({ text, selected }))).toEqual([
      { text: 'Start here.', selected: undefined },
      { text: 'Net', selected: undefined },
      { text: '121 goes to', selected: '121' },
      { text: 'C R 1 now.', selected: 'CR1' },
      { text: 'Then', selected: 'CR1' },
      { text: 'P B 1 lights.', selected: 'PB1' },
    ])
    await voice.finish()
    await voice.finish()
    expect(talk().phase).toBe('done')
    expect(selected()).toBe('PB1') // the last selection stays
  })

  it('dwells the chosen time between the highlight and the speech', async () => {
    useTalkStore.setState({ dwell: 2000 })
    talk().start(MESSAGE)
    await voice.finish() // "Start here."
    await voice.finish() // "Net"
    expect(selected()).toBe('121')
    expect(talk().phase).toBe('dwelling')
    await vi.advanceTimersByTimeAsync(1999)
    expect(texts()).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(texts().at(-1)).toBe('121 goes to')
  })

  it("holds at 'press' until play, then speaks without dwelling again", async () => {
    useTalkStore.setState({ dwell: 'press' })
    talk().start(MESSAGE)
    await voice.finish()
    await voice.finish()
    expect(talk().phase).toBe('paused')
    expect(selected()).toBe('121')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(texts()).toHaveLength(2)
    talk().play()
    expect(texts().at(-1)).toBe('121 goes to')
  })

  it('re-speaks a paused segment from its start', async () => {
    talk().start(MESSAGE)
    await speakUntil('121')
    talk().pause()
    expect(talk().phase).toBe('paused')
    talk().play()
    expect(texts().slice(-2)).toEqual(['121 goes to', '121 goes to'])
  })

  it('steps to the next item while paused: selects it and says nothing', async () => {
    talk().start(MESSAGE)
    talk().pause()
    const before = texts().length
    talk().nextItem()
    expect(selected()).toBe('121')
    talk().nextItem()
    expect(selected()).toBe('CR1')
    talk().prevItem()
    expect(selected()).toBe('121')
    expect(texts()).toHaveLength(before)
    expect(talk().phase).toBe('paused')
  })

  it('goes back like a media player: to this sentence first, then the one before', async () => {
    talk().start(MESSAGE)
    await speakUntil('C R 1') // sentence 1, segment 2
    talk().prevSentence()
    expect(talk().pos).toEqual({ s: 1, g: 0 })
    talk().prevSentence()
    expect(talk().pos).toEqual({ s: 0, g: 0 })
    expect(texts().at(-1)).toBe('Start here.')
  })

  it('never advances twice when a jump lands on a pending speak', async () => {
    talk().start(MESSAGE)
    await speakUntil('121')
    talk().nextSentence()
    expect(talk().pos).toEqual({ s: 2, g: 0 })
    expect(texts().at(-1)).toBe('Then')
    await vi.advanceTimersByTimeAsync(0) // the cancelled "121" settles, and must do nothing
    expect(talk().pos).toEqual({ s: 2, g: 0 })
    await voice.finish()
    expect(talk().pos).toEqual({ s: 2, g: 1 })
  })

  it('ends on a new conversation, and pauses when the reader leaves the sheet', async () => {
    talk().start(MESSAGE)
    useAppStore.getState().setActiveTab('ask')
    expect(talk().phase).toBe('paused')
    talk().play()
    expect(useAppStore.getState().activeTabId).toBe('drawing')
    useChatStore.getState().reset()
    expect(talk().phase).toBe('idle')
    expect(selected()).toBeUndefined() // nothing had been cited yet; exit clears nothing itself
  })

  it('ends when a newer answer starts streaming', () => {
    talk().start(MESSAGE)
    useChatStore.setState((s) => ({ messages: [...s.messages, { ...MESSAGE, id: 'a2', status: 'streaming' }] }))
    expect(talk().phase).toBe('idle')
  })

  it('refuses an answer still streaming, and one with nothing to say', () => {
    talk().start({ ...MESSAGE, status: 'streaming' })
    expect(talk().phase).toBe('idle')
    talk().start({ ...MESSAGE, text: '```\ncode only\n```' })
    expect(talk().phase).toBe('idle')
  })

  it('uses the timed speaker when muted or when there is no voice', async () => {
    useTalkStore.setState({ muted: true })
    talk().start(MESSAGE)
    expect(texts(timed)).toEqual(['Start here.'])
    expect(texts()).toEqual([])
    talk().exit()
    useTalkStore.setState({ muted: false })
    setSpeakers(fakeSpeaker(false), timed)
    talk().start(MESSAGE)
    expect(texts(timed)).toHaveLength(2)
  })

  it('persists the settings and never the position', async () => {
    talk().setDwell(4000)
    talk().setRate(5)
    talk().setPalette({ x: 10, y: 20 })
    talk().start(MESSAGE)
    const saved = JSON.parse(localStorage.getItem('talkthrough-settings')!).state
    expect(saved).toEqual({
      dwell: 4000, rate: 1.3, muted: false, palette: { x: 10, y: 20 },
      voice: null, pitch: 1, questionFirst: false, showSay: false, flow: false,
    })
  })

  it('reads the question first when asked, highlighting nothing in it, then the answer', async () => {
    talk().setQuestionFirst(true)
    talk().start(MESSAGE)
    expect(talk().talk!.sentences.slice(0, 2).map((s) => s.block)).toEqual(['q', 'q'])
    await voice.finish()
    // "Run" in prose stays a word; PB1, a whole word that is exactly an id, is spelt out.
    expect(texts()).toEqual(['Why is the "Run" wire dead?', 'Check P B 1.'])
    expect(selected()).toBeUndefined()
    await speakUntil('121')
    expect(selected()).toBe('121')
    // Items were shifted past the question, and back from the answer's start reaches into it.
    talk().nextItem()
    expect(talk().pos).toEqual({ s: 3, g: 2 })
    talk().pause()
    talk().prevSentence()
    talk().prevSentence()
    talk().prevSentence()
    expect(talk().pos).toEqual({ s: 1, g: 0 })
  })

  it('speaks with the chosen pitch, and persists the voice by name', async () => {
    talk().setPitch(9)
    talk().setVoice('Some Voice')
    talk().start(MESSAGE)
    expect(voice.said[0].pitch).toBe(1.5)
    const saved = JSON.parse(localStorage.getItem('talkthrough-settings')!).state
    expect(saved.voice).toBe('Some Voice')
  })

  it('speaks the edited answer and the edited question, never the originals', async () => {
    useChatStore.getState().editMessage('u1', 'My question.')
    useChatStore.getState().editMessage('a1', 'My own answer.')
    talk().setQuestionFirst(true)
    talk().start(useChatStore.getState().messages[1])
    await voice.finish()
    expect(texts()).toEqual(['My question.', 'My own answer.'])
  })
})

// Natural flow, talkthrough_03.md §4. Sentence 1 joined is "Net 121 goes to C R 1 now.": the
// segments start at 0, 4 and 16, and the word before "C R 1" ("to") starts at 13.
describe('natural flow', () => {
  const JOINED = 'Net 121 goes to C R 1 now.'
  beforeEach(() => useTalkStore.setState({ flow: true }))

  it('speaks a sentence as one utterance and lights each link on the word before it', async () => {
    talk().start(MESSAGE)
    await voice.finish() // "Start here."
    expect(texts()).toEqual(['Start here.', JOINED])
    voice.boundary(0) // "Net", the word before 121
    expect(selected()).toBe('121')
    expect(talk().pos).toEqual({ s: 1, g: 1 })
    voice.boundary(4) // "121"
    voice.boundary(8) // "goes"
    expect(selected()).toBe('121')
    voice.boundary(13) // "to", the word before C R 1
    expect(selected()).toBe('CR1')
    expect(talk().pos).toEqual({ s: 1, g: 2 })
    await vi.advanceTimersByTimeAsync(10_000) // the estimates were dropped at the first boundary
    await voice.finish()
    expect(texts()).toEqual(['Start here.', JOINED, 'Then P B 1 lights.'])
    await voice.finish()
    await voice.finish()
    expect(texts().at(-1)).toBe('End.')
    await voice.finish()
    expect(talk().phase).toBe('done')
  })

  it('lights the links on an estimate for a voice that sends no boundaries, and the rest at its end', async () => {
    talk().start(MESSAGE)
    await voice.finish()
    expect(selected()).toBe('121') // estimated at once: nothing comes before "Net"
    await vi.advanceTimersByTimeAsync(1000)
    expect(selected()).toBe('121')
    await vi.advanceTimersByTimeAsync(100) // three words at 170 a minute: 1059 ms
    expect(selected()).toBe('CR1')
  })

  it('lights any link still unlit when the utterance ends, so none is skipped', async () => {
    talk().start(MESSAGE)
    await voice.finish()
    expect(selected()).toBe('121')
    await voice.finish() // ends before CR1's estimate at 1059 ms
    expect(voice.said.at(-1)).toEqual(expect.objectContaining({ text: 'Then P B 1 lights.', selected: 'CR1' }))
  })

  it('ignores a boundary from a cancelled utterance', async () => {
    talk().start(MESSAGE)
    await voice.finish()
    voice.boundary(0)
    const stale = voice.said.at(-1)!.onBoundary!
    talk().nextItem()
    expect(talk().pos).toEqual({ s: 1, g: 2 })
    expect(texts().at(-1)).toBe('C R 1 now.')
    stale(0)
    stale(13)
    stale(1000)
    expect(talk().pos).toEqual({ s: 1, g: 2 })
    expect(selected()).toBe('CR1')
  })

  it('re-speaks from the current item after a pause', async () => {
    talk().start(MESSAGE)
    await voice.finish()
    voice.boundary(0)
    talk().pause()
    talk().play()
    expect(texts().at(-1)).toBe('121 goes to C R 1 now.')
    voice.boundary(9) // "to", now at 9
    expect(selected()).toBe('CR1')
  })

  it("follows the timed speaker's own boundaries when muted", async () => {
    setSpeakers(voice, timedSpeaker())
    useTalkStore.setState({ muted: true })
    talk().start(MESSAGE)
    await vi.advanceTimersByTimeAsync(710) // "Start here.": two words at 170 a minute, 706 ms
    expect(talk().pos).toEqual({ s: 1, g: 1 })
    expect(selected()).toBe('121')
    await vi.advanceTimersByTimeAsync(1000)
    expect(selected()).toBe('121')
    await vi.advanceTimersByTimeAsync(100) // "to" is the fourth of eight words over 2824 ms: 1059 ms
    expect(selected()).toBe('CR1')
    expect(texts()).toEqual([])
  })

  it('splits a long sentence at a segment', async () => {
    const long = 'word '.repeat(50).trim()
    talk().start({ ...MESSAGE, text: `${long} \`CR1\` then \`PB1\` too.` })
    expect(texts()).toEqual([long])
    await voice.finish()
    expect(texts().at(-1)).toBe('C R 1 then P B 1 too.')
    expect(selected()).toBe('CR1')
  })

  it('plays the old way, item by item, when a dwell is chosen', async () => {
    useTalkStore.setState({ dwell: 2000 })
    talk().start(MESSAGE)
    await voice.finish()
    await voice.finish()
    expect(texts()).toEqual(['Start here.', 'Net'])
    await vi.advanceTimersByTimeAsync(2000)
    expect(texts().at(-1)).toBe('121 goes to')
  })

  it('switching it mid-talk takes effect at the next sentence, either way', async () => {
    talk().start({ ...MESSAGE, text: `${TEXT} So \`CR1\` feeds \`PB1\`.` })
    await voice.finish()
    talk().setFlow(false)
    await voice.finish()
    expect(texts().slice(1)).toEqual([JOINED, 'Then'])
    talk().setFlow(true)
    await voice.finish() // "P B 1 lights." is still the old way
    await voice.finish() // the old loop begins "End." and natural flow takes it over at once
    await voice.finish()
    expect(texts().slice(3)).toEqual(['P B 1 lights.', 'End.', 'End.', 'So C R 1 feeds P B 1.'])
    expect(JSON.parse(localStorage.getItem('talkthrough-settings')!).state.flow).toBe(true)
  })
})

// A link written `` `CR1 ""` `` is lit and not said (talkthrough_03.md §5).
describe('a silent link', () => {
  const SILENT = { ...MESSAGE, text: 'Press `PB1` then `CR1 ""`. End.' }

  it('is lit on the word before it within one utterance, and adds nothing to it', async () => {
    useTalkStore.setState({ flow: true })
    talk().start(SILENT)
    expect(texts()).toEqual(['Press P B 1 then'])
    voice.boundary(6)
    expect(selected()).toBe('PB1')
    voice.boundary(12) // "then"
    expect(selected()).toBe('CR1')
    await voice.finish()
    expect(texts().at(-1)).toBe('End.')
  })

  it('is lit and passed over at once on the old path, with nothing to wait for', async () => {
    setSpeakers(fakeSpeaker(false), timedSpeaker())
    talk().start(SILENT)
    await vi.advanceTimersByTimeAsync(600) // "Press": the 600 ms minimum
    await vi.advanceTimersByTimeAsync(1420) // "P B 1 then": four words at 170 a minute, 1412 ms
    expect(selected()).toBe('CR1')
    expect(talk().pos).toEqual({ s: 1, g: 0 })
  })
})
