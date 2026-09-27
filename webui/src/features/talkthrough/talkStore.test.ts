import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesignatorIndex, DrawingSummary } from '@/api/types'
import { buildLookup } from '@/lib/designators'
import type { Speaker } from '@/lib/speech'
import { useAppStore } from '@/stores/appStore'
import { useChatStore, type Message } from '@/stores/chatStore'
import { setSpeakers, useTalkStore } from './talkStore'

const INDEX = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/designators.json'), 'utf8'),
) as DesignatorIndex

/** A speaker that says nothing until told to, and records what was selected when it began. */
function fakeSpeaker(supported = true) {
  let pending: ((how: 'end' | 'cancelled') => void) | null = null
  const said: { text: string; selected: string | undefined; pitch?: number }[] = []
  const speaker: Speaker & { said: typeof said; finish: () => Promise<void> } = {
    supported,
    said,
    speak(text, _rate, pitch) {
      speaker.cancel()
      said.push({ text, selected: useAppStore.getState().selection?.id, pitch })
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
    dwell: 0, rate: 1, muted: false, palette: null, voice: null, pitch: 1, questionFirst: false, showSay: false,
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
      voice: null, pitch: 1, questionFirst: false, showSay: false,
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
