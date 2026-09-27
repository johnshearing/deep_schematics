/**
 * The talkthrough's engine. `talkthrough_01.md` §5.2.
 *
 * It plays a `Talk` one segment at a time: **highlight the segment's cite, dwell, speak it,
 * advance.** The highlight is the gesture a click on the link makes — `appStore.select` with
 * the default `'text'` origin — and nothing else; this store arms, selects and switches tabs,
 * and never writes a byte of anybody's data.
 *
 * **Every await re-checks `gen`** (trap T4). Every control bumps it and cancels the speaker, so
 * a promise that was pending before a jump can never advance the new position — without that,
 * *next* pressed mid-sentence would advance once for the press and once more when the cancelled
 * utterance settled.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { setPreferredVoice, timedSpeaker, webSpeaker, type Speaker } from '@/lib/speech'
import { useAppStore } from '@/stores/appStore'
import { shownText, useChatStore, type Message } from '@/stores/chatStore'
import { DRAWING_TAB_ID } from '@/tabIds'
import { buildQuestion, buildTalk, sliceTalk, type Talk } from './buildTalk'
import type { Span } from './selection'

export type Dwell = 0 | 2000 | 4000 | 'press'
export type Phase = 'idle' | 'highlighting' | 'dwelling' | 'speaking' | 'paused' | 'done'
export interface Pos { s: number; g: number }

interface TalkState {
  messageId: string | null
  talk: Talk | null
  pos: Pos
  phase: Phase
  /** Whether the current segment's cite is already on the sheet, so a resume speaks at once. */
  shown: boolean
  /** True when only a selection of the answer is being spoken. */
  partial: boolean
  gen: number

  // Settings — the only part persisted.
  dwell: Dwell
  rate: number
  muted: boolean
  /** Where the palette was dragged to; null is the top-right default. */
  palette: { x: number; y: number } | null
  /** A voice chosen by name; null is the automatic choice. */
  voice: string | null
  pitch: number
  /** Speak the question that produced the answer before the answer itself. */
  questionFirst: boolean
  /** Show the spoken form under the caption, so a poor pronunciation can be seen and fixed. */
  showSay: boolean

  /** Talk through an answer, or only the sentences `span` touches when there is a selection. */
  start: (message: Message, span?: Span | null) => void
  play: () => void
  pause: () => void
  nextSentence: () => void
  prevSentence: () => void
  nextItem: () => void
  prevItem: () => void
  exit: () => void
  setDwell: (dwell: Dwell) => void
  setRate: (rate: number) => void
  setMuted: (muted: boolean) => void
  setPalette: (palette: { x: number; y: number } | null) => void
  setVoice: (voice: string | null) => void
  setPitch: (pitch: number) => void
  setQuestionFirst: (on: boolean) => void
  setShowSay: (on: boolean) => void
}

let speakers: { voice: Speaker; timed: Speaker } = { voice: webSpeaker, timed: timedSpeaker() }

/** Tests hand in fakes; the app never calls this. */
export function setSpeakers(voice: Speaker, timed: Speaker) {
  speakers = { voice, timed }
}

/** Whether there is a real voice; without one the talk is timed captions. */
export const voiceSupported = () => speakers.voice.supported

let timer: ReturnType<typeof setTimeout> | null = null

const PLAYING: Phase[] = ['highlighting', 'dwelling', 'speaking']
export const isPlaying = (phase: Phase) => PLAYING.includes(phase)

/** The question that produced an answer: the nearest user message before it. */
function questionOf(answerId: string): string {
  const messages = useChatStore.getState().messages
  const at = messages.findIndex((m) => m.id === answerId)
  for (let k = at - 1; k >= 0; k--) if (messages[k].role === 'user') return shownText(messages[k])
  return ''
}

/** The question's sentences first, then the answer's, with the answer's items shifted to match. */
function withQuestion(answer: Talk, question: string, byToken: Parameters<typeof buildQuestion>[1]): Talk {
  const asked = buildQuestion(question, byToken)
  return {
    sentences: [...asked, ...answer.sentences],
    items: answer.items.map(({ s, g }) => ({ s: s + asked.length, g })),
  }
}

const before = (a: Pos, b: Pos) => a.s < b.s || (a.s === b.s && a.g < b.g)

export const useTalkStore = create<TalkState>()(
  persist(
    (set, get) => {
      const speaker = () => (get().muted || !speakers.voice.supported ? speakers.timed : speakers.voice)

      /** Stop whatever is in flight and return the generation the next run belongs to. */
      const interrupt = () => {
        if (timer) clearTimeout(timer)
        timer = null
        speakers.voice.cancel()
        speakers.timed.cancel()
        const gen = get().gen + 1
        set({ gen })
        return gen
      }

      const segmentAt = ({ s, g }: Pos) => get().talk?.sentences[s]?.segments[g]

      const highlight = (pos: Pos) => {
        const cite = segmentAt(pos)?.cite
        if (!cite) return
        useAppStore.getState().select(cite.kind, cite.id, 'text')
        set({ shown: true })
      }

      const following = ({ s, g }: Pos): Pos | null => {
        const sentences = get().talk!.sentences
        if (g + 1 < sentences[s].segments.length) return { s, g: g + 1 }
        return s + 1 < sentences.length ? { s: s + 1, g: 0 } : null
      }

      /** The loop. Plays from `pos` until the talk ends or `gen` moves on. */
      const run = async (gen: number) => {
        const live = () => get().gen === gen
        for (;;) {
          const { pos, shown, dwell } = get()
          const segment = segmentAt(pos)
          if (!segment) return

          if (segment.cite && !shown) {
            set({ phase: 'highlighting' })
            highlight(pos)
            set({ phase: 'dwelling' })
            if (dwell === 'press') return set({ phase: 'paused' })
            if (dwell > 0) {
              await new Promise<void>((resolve) => (timer = setTimeout(resolve, dwell)))
              if (!live()) return
            }
          }

          set({ phase: 'speaking' })
          setPreferredVoice(get().voice)
          const how = await speaker().speak(segment.say, get().rate, get().pitch)
          if (!live() || how === 'cancelled') return

          const next = following(pos)
          if (!next) return set({ phase: 'done' })
          set({ pos: next, shown: false })
        }
      }

      /** Move to `pos`, then carry on playing if it was, or hold still if it was not. */
      const jump = (pos: Pos, show: boolean) => {
        const wasPlaying = isPlaying(get().phase)
        const gen = interrupt()
        set({ pos, shown: false })
        // Playing, the loop highlights it and dwells as usual; paused, it is shown at once.
        if (wasPlaying) void run(gen)
        else if (show) highlight(pos)
        if (!wasPlaying) set({ phase: 'paused' })
      }

      return {
        messageId: null,
        talk: null,
        pos: { s: 0, g: 0 },
        phase: 'idle',
        shown: false,
        partial: false,
        gen: 0,

        dwell: 0,
        rate: 1,
        muted: false,
        palette: null,
        voice: null,
        pitch: 1,
        questionFirst: false,
        showSay: false,

        start: (message, span) => {
          if (message.status !== 'done') return
          const app = useAppStore.getState()
          const full = buildTalk(shownText(message), app.byToken, !!app.drawing?.tiles?.count)
          const sliced = span ? sliceTalk(full, span.from, span.to) : full
          // A selection with nothing speakable in it (only a code block) speaks the whole answer.
          const answer = sliced.sentences.length ? sliced : full
          if (!answer.sentences.length) return
          const talk = get().questionFirst ? withQuestion(answer, questionOf(message.id), app.byToken) : answer
          const gen = interrupt()
          set({
            messageId: message.id, talk, pos: { s: 0, g: 0 }, shown: false, phase: 'highlighting',
            partial: answer !== full,
          })
          app.setActiveTab(DRAWING_TAB_ID)
          void run(gen)
        },

        play: () => {
          const { talk, phase } = get()
          if (!talk || isPlaying(phase)) return
          if (useAppStore.getState().activeTabId !== DRAWING_TAB_ID) {
            useAppStore.getState().setActiveTab(DRAWING_TAB_ID)
          }
          const gen = interrupt()
          if (phase === 'done') set({ pos: { s: 0, g: 0 }, shown: false })
          set({ phase: 'speaking' })
          void run(gen)
        },

        pause: () => {
          if (!isPlaying(get().phase)) return
          interrupt()
          set({ phase: 'paused' })
        },

        nextSentence: () => {
          const { talk, pos } = get()
          if (talk && pos.s + 1 < talk.sentences.length) jump({ s: pos.s + 1, g: 0 }, false)
        },

        // As a media player's back button: to the start of this sentence, unless already there.
        prevSentence: () => {
          const { talk, pos } = get()
          if (!talk) return
          jump({ s: pos.g > 0 ? pos.s : Math.max(0, pos.s - 1), g: 0 }, false)
        },

        // Items always re-highlight, even when paused — a reader can step through them silently.
        nextItem: () => {
          const { talk, pos } = get()
          const item = talk?.items.find((i) => before(pos, i))
          if (item) jump(item, true)
        },

        prevItem: () => {
          const { talk, pos } = get()
          const item = talk?.items.filter((i) => before(i, pos)).at(-1)
          if (item) jump(item, true)
        },

        // The selection stays: the reader is left on the last thing they were shown.
        exit: () => {
          if (get().phase === 'idle') return
          interrupt()
          set({ phase: 'idle', talk: null, messageId: null, pos: { s: 0, g: 0 }, shown: false })
        },

        setDwell: (dwell) => set({ dwell }),
        setRate: (rate) => set({ rate: Math.min(1.3, Math.max(0.8, rate)) }),
        setMuted: (muted) => {
          set({ muted })
          // Swap voices mid-segment by re-saying it with the other speaker.
          if (get().phase === 'speaking') void run(interrupt())
        },
        setPalette: (palette) => set({ palette }),
        setVoice: (voice) => {
          set({ voice })
          if (get().phase === 'speaking') void run(interrupt())
        },
        setPitch: (pitch) => set({ pitch: Math.min(1.5, Math.max(0.5, pitch)) }),
        setQuestionFirst: (questionFirst) => set({ questionFirst }),
        setShowSay: (showSay) => set({ showSay }),
      }
    },
    {
      name: 'talkthrough-settings',
      partialize: ({ dwell, rate, muted, palette, voice, pitch, questionFirst, showSay }) => ({
        dwell, rate, muted, palette, voice, pitch, questionFirst, showSay,
      }),
    },
  ),
)

// A new question, or a new conversation, ends the talk: the answer it was reading is gone or
// no longer the latest.
useChatStore.subscribe(({ messages }) => {
  const { messageId, exit } = useTalkStore.getState()
  if (!messageId) return
  const at = messages.findIndex((m) => m.id === messageId)
  if (at < 0 || messages.slice(at + 1).some((m) => m.status === 'streaming')) exit()
})

// Leaving the sheet pauses: the reader is no longer looking at what is being pointed at.
useAppStore.subscribe((state, previous) => {
  if (state.activeTabId === previous.activeTabId || state.activeTabId === DRAWING_TAB_ID) return
  useTalkStore.getState().pause()
})
