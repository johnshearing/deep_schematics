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
 *
 * **Natural flow** (`talkthrough_03.md` §4) is a second loop, `runFlow`, beside the first and
 * chosen by the `flow` setting: it speaks each sentence as **one utterance** and lights each link
 * as the voice reaches the word before it, so a link mid-sentence no longer breaks the sentence
 * in two. With `flow` off, or a dwell chosen, `run` plays exactly as before — the switch is the
 * rollback.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Pronunciations } from '@/lib/speakId'
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
  /** Speak each sentence as one utterance, links and all, when there is no dwell. */
  flow: boolean

  /** Talk through an answer, or only the sentences `span` touches when there is a selection. */
  start: (message: Message, span?: Span | null) => void
  /** Rebuild the talk in place, keeping the place in it: a pronunciation was just saved. */
  refresh: () => void
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
  setFlow: (on: boolean) => void
}

let speakers: { voice: Speaker; timed: Speaker } = { voice: webSpeaker, timed: timedSpeaker() }

/** Tests hand in fakes; the app never calls this. */
export function setSpeakers(voice: Speaker, timed: Speaker) {
  speakers = { voice, timed }
}

/** Whether there is a real voice; without one the talk is timed captions. */
export const voiceSupported = () => speakers.voice.supported

let timer: ReturnType<typeof setTimeout> | null = null

/** Which loop is playing, so switching natural flow on mid-talk can take over at the next sentence. */
let mode: 'old' | 'flow' = 'old'

/** Joined utterances longer than this are split at a segment (some Chrome builds cut off at ~15 s). */
const FLOW_CHARS = 220
/** The pace estimated links are lit at when a voice sends no word boundaries; `timedSpeaker`'s. */
const FLOW_WPM = 170

/** The segments from `g` joined into one utterance, with each one's offset in it, up to FLOW_CHARS. */
export function joinSegments(segments: { say: string }[], g: number): { text: string; starts: number[] } {
  let text = ''
  const starts: number[] = []
  for (let k = g; k < segments.length; k++) {
    const say = segments[k].say
    if (!say && starts.length) {
      starts.push(text.length) // silent: lit with the word before it, adding nothing to say
      continue
    }
    if (starts.length && text.length + 1 + say.length > FLOW_CHARS) break
    starts.push(text ? text.length + 1 : 0)
    text = text ? `${text} ${say}` : say
  }
  return { text, starts }
}

/** Where the word just before offset `at` starts: a link is lit as that word is spoken. */
const cueAt = (text: string, at: number) => {
  const word = text.slice(0, at).trimEnd().search(/\S+$/)
  return word < 0 ? 0 : word
}

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
function withQuestion(
  answer: Talk, question: string, byToken: Parameters<typeof buildQuestion>[1], lists: Pronunciations,
): Talk {
  const asked = buildQuestion(question, byToken, lists)
  return {
    sentences: [...asked, ...answer.sentences],
    items: answer.items.map(({ s, g }) => ({ s: s + asked.length, g })),
  }
}

/** How the current talk was made, so `refresh` can make it again the same way. */
let built: { span: Span | null; questionFirst: boolean } = { span: null, questionFirst: false }

/** An answer's talk: the whole of it, or the sentences a selection touches, and its question. */
function derive(message: Message, span: Span | null, questionFirst: boolean) {
  const app = useAppStore.getState()
  const lists = app.pronunciations
  const full = buildTalk(shownText(message), app.byToken, !!app.drawing?.tiles?.count, lists)
  const sliced = span ? sliceTalk(full, span.from, span.to) : full
  // A selection with nothing speakable in it (only a code block) speaks the whole answer.
  const answer = sliced.sentences.length ? sliced : full
  const talk = questionFirst ? withQuestion(answer, questionOf(message.id), app.byToken, lists) : answer
  return { talk, empty: !answer.sentences.length, partial: answer !== full }
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

      /**
       * Natural flow. Plays from `pos` a sentence (or a FLOW_CHARS piece of one) per utterance,
       * moving `pos` and lighting each cite as the voice's word boundaries reach it. A voice that
       * sends none is followed by an estimate, and the utterance's end lights anything left, so no
       * link is skipped. Hands over to `run` whenever flow is off or a dwell is chosen.
       */
      const runFlow = async (gen: number) => {
        const live = () => get().gen === gen
        for (;;) {
          const { pos, flow, dwell } = get()
          if (!flow || dwell !== 0) {
            mode = 'old'
            return run(gen)
          }
          const segments = get().talk?.sentences[pos.s]?.segments
          if (!segments?.[pos.g]) return

          set({ phase: 'speaking' })
          if (segments[pos.g].cite && !get().shown) highlight(pos)

          const { text, starts } = joinSegments(segments, pos.g)
          const cues = starts.map((at, k) => ({
            g: pos.g + k,
            at: k === 0 ? 0 : segments[pos.g + k].cite ? cueAt(text, at) : at,
          }))
          // Lighting a link a word early must never overtake the segment before it.
          for (let k = cues.length - 1; k > 0; k--) cues[k - 1].at = Math.min(cues[k - 1].at, cues[k].at)
          let reached = 0 // cues[0] is where this utterance starts
          const reach = (charIndex: number) => {
            if (!live()) return
            while (reached + 1 < cues.length && cues[reached + 1].at <= charIndex) {
              reached += 1
              const at = { s: pos.s, g: cues[reached].g }
              set({ pos: at, shown: false })
              highlight(at)
            }
          }
          const rate = get().rate
          const estimates = cues.slice(1).map(({ at }) => {
            const words = text.slice(0, at).split(/\s+/).filter(Boolean).length
            return setTimeout(() => reach(at), (words / (FLOW_WPM * rate)) * 60_000)
          })
          const dropEstimates = () => estimates.splice(0).forEach(clearTimeout)

          setPreferredVoice(get().voice)
          const how = await speaker().speak(text, rate, get().pitch, (charIndex) => {
            dropEstimates()
            reach(charIndex)
          })
          dropEstimates()
          if (!live() || how === 'cancelled') return
          reach(Infinity)

          const last = cues[cues.length - 1].g
          const next = following({ s: pos.s, g: last })
          if (!next) return set({ phase: 'done' })
          set({ pos: next, shown: false })
        }
      }

      /** Plays from `pos` by whichever loop the settings choose. */
      const go = (gen: number) => {
        mode = get().flow && get().dwell === 0 ? 'flow' : 'old'
        return mode === 'flow' ? runFlow(gen) : run(gen)
      }

      /** Move to `pos`, then carry on playing if it was, or hold still if it was not. */
      const jump = (pos: Pos, show: boolean) => {
        const wasPlaying = isPlaying(get().phase)
        const gen = interrupt()
        set({ pos, shown: false })
        // Playing, the loop highlights it and dwells as usual; paused, it is shown at once.
        if (wasPlaying) void go(gen)
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
        flow: true,

        start: (message, span) => {
          if (message.status !== 'done') return
          const { talk, empty, partial } = derive(message, span ?? null, get().questionFirst)
          if (empty) return
          built = { span: span ?? null, questionFirst: get().questionFirst }
          const gen = interrupt()
          set({ messageId: message.id, talk, pos: { s: 0, g: 0 }, shown: false, phase: 'highlighting', partial })
          useAppStore.getState().setActiveTab(DRAWING_TAB_ID)
          void go(gen)
        },

        // A pronunciation changes what is said, never where the sentences and links fall, so
        // the position still points at the same item.
        refresh: () => {
          const message = useChatStore.getState().messages.find((m) => m.id === get().messageId)
          if (!message) return
          const { talk, empty } = derive(message, built.span, built.questionFirst)
          if (!empty) set({ talk })
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
          void go(gen)
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
          if (get().phase === 'speaking') void go(interrupt())
        },
        setPalette: (palette) => set({ palette }),
        setVoice: (voice) => {
          set({ voice })
          if (get().phase === 'speaking') void go(interrupt())
        },
        setPitch: (pitch) => set({ pitch: Math.min(1.5, Math.max(0.5, pitch)) }),
        setQuestionFirst: (questionFirst) => set({ questionFirst }),
        setShowSay: (showSay) => set({ showSay }),
        // Takes effect at the next sentence: `runFlow` checks it there, and the subscriber below
        // hands an old-path talk over when it is switched on.
        setFlow: (flow) => set({ flow }),
      }
    },
    {
      name: 'talkthrough-settings',
      partialize: ({ dwell, rate, muted, palette, voice, pitch, questionFirst, showSay, flow }) => ({
        dwell, rate, muted, palette, voice, pitch, questionFirst, showSay, flow,
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

// Natural flow switched on while the old loop plays takes over when it reaches the next sentence.
// Deferred, so the old loop has finished its step; a pause and play restarts by the new loop.
useTalkStore.subscribe((state, previous) => {
  if (mode !== 'old' || !state.flow || state.dwell !== 0) return
  if (state.pos.s === previous.pos.s || !isPlaying(state.phase)) return
  const gen = state.gen
  void Promise.resolve().then(() => {
    const now = useTalkStore.getState()
    if (mode !== 'old' || now.gen !== gen || !now.flow || !isPlaying(now.phase)) return
    now.pause()
    now.play()
  })
})
