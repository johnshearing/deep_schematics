import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { ApiError, ask, cancelTurn } from '@/api/client'
import type { ServerEvent } from '@/api/types'

export interface ToolCall {
  id: string
  name: string
  detail: string
  ok?: boolean
  startedAt: number
  endedAt?: number
}

export interface Denial {
  tool: string | null
  input: unknown
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  model?: string
  tools: ToolCall[]
  denials: Denial[]
  status: 'streaming' | 'done' | 'cancelled' | 'error'
  thinking: boolean
  costUsd?: number
  durationMs?: number
  error?: string
  startedAt: number
  /** The server's id for the turn that produced an answer — what an edit is saved under. */
  turnId?: string
  /**
   * The user's rewrite of this message, question or answer (`talkthrough_02.md` §6). When present
   * it is what the screen shows, what `Copy markdown` copies and what the talkthrough speaks.
   * **`text` is never overwritten**: it stays the original, off screen, for comparison.
   */
  edited?: string
  /** One half of `Write your own`: written by the user, with no original of the model's. */
  composed?: boolean
}

/** What a message says now: the user's edit if there is one, else the original. */
export const shownText = (message: Message) => message.edited ?? message.text

/** What an answer the user wrote themselves is marked with, in place of a model's name. */
export const COMPOSED = 'composed'

/** A finished question and answer put back into the transcript (`talkthrough_03.md` §7). */
export interface Pair {
  turnId: string
  question: string
  questionEdited?: string | null
  answer: string
  answerEdited?: string | null
  model?: string | null
}

interface ChatState {
  sessionId: string | null
  messages: Message[]
  busy: boolean
  turnId: string | null
  composerText: string
  sessionCostUsd: number

  setComposerText: (text: string) => void
  send: (question: string, model: string) => Promise<void>
  stop: () => Promise<void>
  reset: () => void
  /** Replace what a message shows with `text`, or put the original back with null. */
  editMessage: (id: string, text: string | null) => void
  /** Append a past turn as a finished pair, its saved edits applied and its `turnId` kept. */
  open: (pair: Pair) => void
  /** Append an empty answer for the user to write, under `question` if they typed one. */
  compose: (question: string) => void
}

let controller: AbortController | null = null

/**
 * Text arrives in bursts and every store write re-renders the markdown for the *whole*
 * growing answer. Batching the appends onto one animation frame is the difference between a
 * smooth stream and a long answer that visibly stutters near the end — the server already
 * coalesces on its side (50 ms / 512 chars), and this is the matching half.
 */
let pendingText = ''
let frame: number | null = null

type Setter = (fn: (state: ChatState) => Partial<ChatState>) => void

function flushInto(set: Setter) {
  frame = null
  const chunk = pendingText
  pendingText = ''
  if (!chunk) return
  set((state) => ({ messages: patchLast(state.messages, (m) => ({ text: m.text + chunk })) }))
}

function patchLast(messages: Message[], patch: (message: Message) => Partial<Message>): Message[] {
  if (messages.length === 0) return messages
  const last = messages[messages.length - 1]
  if (last.role !== 'assistant') return messages
  return [...messages.slice(0, -1), { ...last, ...patch(last) }]
}

const finished = (id: string, role: Message['role'], text: string, edited?: string | null,
  extra: Partial<Message> = {}): Message => ({
  id, role, text, tools: [], denials: [], status: 'done', thinking: false, startedAt: Date.now(),
  ...(edited != null && edited !== text ? { edited } : {}), ...extra,
})

/**
 * Kept in `sessionStorage` (`talkthrough_03.md` §7), so an F5 in the middle of preparing a video
 * loses nothing, and closing the tab still ends it. **The messages only**: never `sessionId` —
 * the model session it named lives in the server's memory and a reload may have outlived it, so
 * a restored conversation's next question starts a fresh one, and the composer says so — never
 * `busy`, and an answer caught mid-stream comes back stopped rather than streaming forever.
 */
export const useChatStore = create<ChatState>()(persist((set, get) => ({
  sessionId: null,
  messages: [],
  busy: false,
  turnId: null,
  composerText: '',
  sessionCostUsd: 0,

  setComposerText: (composerText) => set({ composerText }),

  editMessage: (id, text) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== id) return m
        const { edited: _, ...rest } = m
        // An edit identical to the original is no edit.
        return text === null || text === m.text ? rest : { ...rest, edited: text }
      }),
    })),

  open: (pair) =>
    set((state) => ({
      messages: [
        ...state.messages,
        finished(`u${pair.turnId}`, 'user', pair.question, pair.questionEdited),
        finished(`a${pair.turnId}`, 'assistant', pair.answer, pair.answerEdited, {
          turnId: pair.turnId, model: pair.model ?? undefined,
        }),
      ],
    })),

  compose: (question) => {
    // A uuid4, the shape the server's turn ids have, so `Save` keeps it beside the model's.
    const turnId = crypto.randomUUID()
    set((state) => ({
      composerText: '',
      messages: [
        ...state.messages,
        finished(`u${turnId}`, 'user', '', question.trim() || null, { composed: true }),
        finished(`a${turnId}`, 'assistant', '', null, { turnId, model: COMPOSED, composed: true }),
      ],
    }))
  },

  reset: () => {
    controller?.abort()
    controller = null
    set({ sessionId: null, messages: [], busy: false, turnId: null, sessionCostUsd: 0 })
  },

  stop: async () => {
    const { turnId } = get()
    // Both, deliberately: the explicit cancel reaches a server that is blocked waiting on the
    // model, and the abort tears down the request this end.
    if (turnId) await cancelTurn(turnId)
    controller?.abort()
  },

  send: async (question, model) => {
    if (get().busy) return
    const now = Date.now()
    controller = new AbortController()

    set((state) => ({
      busy: true,
      composerText: '',
      messages: [
        ...state.messages,
        { id: `u${now}`, role: 'user', text: question, tools: [], denials: [], status: 'done',
          thinking: false, startedAt: now },
        { id: `a${now}`, role: 'assistant', text: '', model, tools: [], denials: [],
          status: 'streaming', thinking: false, startedAt: now },
      ],
    }))

    const flush = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame)
        frame = null
      }
      flushInto(set)
    }

    const onEvent = (event: ServerEvent) => {
      switch (event.t) {
        case 'start':
          set((state) => ({
            sessionId: event.session_id,
            turnId: event.turn_id,
            messages: patchLast(state.messages, () => ({ turnId: event.turn_id })),
          }))
          break

        case 'text':
          pendingText += event.d
          if (frame === null) frame = requestAnimationFrame(() => flushInto(set))
          break

        case 'status':
          set((state) => ({ messages: patchLast(state.messages, () => ({ thinking: true })) }))
          break

        case 'tool':
          flush()
          set((state) => ({
            messages: patchLast(state.messages, (m) => ({
              thinking: false,
              tools: [
                ...m.tools,
                { id: event.id ?? `t${m.tools.length}`, name: event.name, detail: event.detail,
                  startedAt: Date.now() },
              ],
            })),
          }))
          break

        case 'tool_result':
          set((state) => ({
            messages: patchLast(state.messages, (m) => ({
              tools: m.tools.map((tool) =>
                tool.id === event.id ? { ...tool, ok: event.ok, endedAt: Date.now() } : tool,
              ),
            })),
          }))
          break

        case 'denial':
          // Never swallowed. A denial is either an allowlist that is too tight or somebody
          // probing the filesystem, and both are things the operator should see.
          flush()
          set((state) => ({
            messages: patchLast(state.messages, (m) => ({
              denials: [...m.denials, { tool: event.tool, input: event.input }],
            })),
          }))
          break

        case 'done':
          flush()
          set((state) => ({
            sessionCostUsd: event.session_cost_usd ?? state.sessionCostUsd + event.cost_usd,
            messages: patchLast(state.messages, () => ({
              // A turn can end `is_error` with no text at all — the per-question budget
              // ceiling does exactly that. Without the message it renders as a blank bubble.
              status: event.cancelled ? 'cancelled' : event.error ? 'error' : 'done',
              thinking: false,
              error: event.error ?? undefined,
              costUsd: event.cost_usd,
              durationMs: event.duration_ms,
            })),
          }))
          break

        case 'error':
          flush()
          set((state) => ({
            messages: patchLast(state.messages, () => ({
              status: 'error',
              thinking: false,
              error: event.message,
            })),
          }))
          break

        case 'init':
        case 'heartbeat':
          break
      }
    }

    try {
      await ask({ question, model, sessionId: get().sessionId, signal: controller.signal, onEvent })
    } catch (error) {
      flush()
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      set((state) => ({
        messages: patchLast(state.messages, (m) => ({
          status: aborted ? 'cancelled' : 'error',
          thinking: false,
          error: aborted ? undefined : describe(error, m),
        })),
      }))
    } finally {
      flush()
      controller = null
      set({ busy: false, turnId: null })
    }
  },
}), {
  name: 'ask-transcript',
  storage: createJSONStorage(() => sessionStorage),
  partialize: ({ messages, sessionCostUsd }) => ({
    messages: messages.map((m) => (m.status === 'streaming' ? { ...m, status: 'cancelled' as const, thinking: false } : m)),
    sessionCostUsd,
  }),
}))

function describe(error: unknown, message: Message): string {
  if (error instanceof ApiError) return error.message
  if (message.text) return 'The connection dropped part-way through the answer.'
  return error instanceof Error ? error.message : String(error)
}
