/**
 * The one thing on this tab that a browser will not tell you about: **where the reader is.**
 *
 * The Ask tab is the tab that is not `keepMounted`, so crossing to the drawing and back with `F2`
 * unmounts and remounts it. A fresh mount starts pinned to the bottom and the follow effect fires,
 * so a reader who was three screens up in a long answer — which is exactly where somebody clicking
 * a citation is — came back to the end of it. That is the whole point of the `F2` seam undone.
 *
 * jsdom has no layout: every element reports 0 for `scrollHeight`, `clientHeight` and `scrollTop`,
 * and assigning `scrollTop` is clamped to 0. So the three geometry properties are stubbed here, per
 * element, which is the same thing `DrawingTab.test.tsx` does to give the sheet a size. What is
 * being asserted is what the component *writes*, which is the part that can be wrong.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AskTab } from './AskTab'
import type { Message } from '@/stores/chatStore'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import type { DesignatorIndex, DrawingSummary, Health } from '@/api/types'
import { buildLookup } from '@/lib/designators'
import { useTalkStore } from '@/features/talkthrough/talkStore'

/** Two turns, so the transcript is long enough to have a middle. */
const MESSAGES: Message[] = [
  { id: 'u1', role: 'user', text: 'Why is there no 24 V at the bypass relay?', tools: [],
    denials: [], status: 'done', thinking: false, startedAt: 1 },
  { id: 'a1', role: 'assistant', text: 'Follow `110` from `CB1:2` to `CR-BP:A1`.', tools: [],
    denials: [], status: 'done', thinking: false, startedAt: 2 },
]

/** Where the fake layout says the scroller is. `top` is written by the component and read back. */
const box = { top: 0, height: 600, content: 2000 }
const tops = new WeakMap<HTMLElement, number>()

function scroller(container: HTMLElement): HTMLElement {
  return container.querySelector('.overflow-y-auto') as HTMLElement
}

beforeEach(() => {
  box.top = 0
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get() {
      return tops.get(this as HTMLElement) ?? 0
    },
    set(value: number) {
      tops.set(this as HTMLElement, value)
      box.top = value
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => box.height,
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => box.content,
  })
  useChatStore.setState({ messages: MESSAGES, busy: false, sessionCostUsd: 0.04 })
  useAppStore.setState({ drawing: null })
})

afterEach(() => {
  for (const name of ['scrollTop', 'clientHeight', 'scrollHeight'] as const) {
    delete (HTMLElement.prototype as never)[name]
  }
  useChatStore.getState().reset()
})

describe('AskTab', () => {
  it('comes back to the line the reader left, not to the end of the answer', () => {
    const first = render(<AskTab />)
    const element = scroller(first.container)

    // The reader scrolls up to re-read something and clicks a citation in it.
    element.scrollTop = 420
    fireEvent.scroll(element)
    first.unmount()

    // `F2` to the drawing and back: a brand new mount, and the same place.
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    const second = render(<AskTab />)
    expect(scroller(second.container).scrollTop).toBe(420)
    // And deliberately *not* scrolled to the bottom, which is what a fresh mount used to do.
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('keeps following a growing answer for a reader who was already at the bottom', () => {
    const first = render(<AskTab />)
    const element = scroller(first.container)

    // 2000 − 1400 − 600 = 0 away from the end: still following the stream.
    element.scrollTop = 1400
    fireEvent.scroll(element)
    first.unmount()

    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    render(<AskTab />)
    // At the bottom, going to the bottom *is* the remembered position — and it has to be the
    // bottom of the transcript as it is now, which is a different number from 1400 the moment
    // one more line has streamed in.
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('forgets the offset when the conversation is thrown away', () => {
    const first = render(<AskTab />)
    const element = scroller(first.container)
    element.scrollTop = 420
    fireEvent.scroll(element)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /new conversation/i }))
    })
    first.unmount()

    // A scroll position measured against a transcript that no longer exists is meaningless, and
    // restoring it would leave the reader looking at blank space below an empty screen.
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
    const second = render(<AskTab />)
    expect(scroller(second.container).scrollTop).toBe(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

/** `talkthrough_01.md` §6.6: the answer footer's half of the talkthrough. */
describe('Talk me through it, in the answer footer', () => {
  const talkButton = () => screen.queryByRole('button', { name: /talk me through it/i })

  it('appears once an answer has finished, never while it streams', () => {
    useChatStore.setState({ messages: [MESSAGES[0], { ...MESSAGES[1], status: 'streaming' }] })
    const { rerender } = render(<AskTab />)
    expect(talkButton()).toBeNull()
    act(() => useChatStore.setState({ messages: MESSAGES }))
    rerender(<AskTab />)
    expect(talkButton()).not.toBeNull()
    // It sits before Copy markdown.
    const footer = talkButton()!.parentElement!
    const labels = [...footer.querySelectorAll('button')].map((b) => b.textContent)
    expect(labels.indexOf('Talk me through it')).toBeLessThan(labels.indexOf('Copy markdown'))
  })

  it('stays away from an answer with nothing to say aloud', () => {
    useChatStore.setState({ messages: [MESSAGES[0], { ...MESSAGES[1], text: '```\nonly code\n```' }] })
    render(<AskTab />)
    expect(talkButton()).toBeNull()
    expect(screen.getByRole('button', { name: /copy markdown/i })).toBeTruthy()
  })
})

/** `talkthrough_02.md` §6: rewriting an answer or a question in place. */
describe('editing an answer or a question', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useAppStore.setState({ health: null })
  })

  it('shows only the edit once saved, keeps the original off screen, and reverts', async () => {
    render(<AskTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const box = screen.getByRole('textbox', { name: 'Edit the answer' }) as HTMLTextAreaElement
    expect(box.value).toBe(MESSAGES[1].text)
    expect(screen.getByText(/kept for this conversation only/i)).toBeTruthy()
    fireEvent.change(box, { target: { value: 'My own answer about `CR1`.' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
    expect(screen.getByText(/My own answer about/)).toBeTruthy()
    expect(screen.queryByText(/Follow/)).toBeNull() // no trace of the original, and no badge
    const saved = useChatStore.getState().messages[1]
    expect([saved.text, saved.edited]).toEqual([MESSAGES[1].text, 'My own answer about `CR1`.'])

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Revert to original' })))
    expect(screen.getByText(/Follow/)).toBeTruthy()
    expect(useChatStore.getState().messages[1].edited).toBeUndefined()
  })

  it('shows the §6B marks in the edit box and nowhere else', async () => {
    // **T-1992.** Edit mode holds the markdown source, so `~` and `@` are visible only there.
    render(<AskTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const written = 'Follow `110 ~` then `~` and `@CB1:2`.'
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit the answer' }), { target: { value: written } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
    expect(screen.queryByText(/~|@CB1/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect((screen.getByRole('textbox', { name: 'Edit the answer' }) as HTMLTextAreaElement).value).toBe(written)
  })

  it('edits the question in its bubble', async () => {
    render(<AskTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit question' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit the question' }), {
      target: { value: 'Where does the bypass relay get 24 V?' },
    })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
    expect(screen.getByText('Where does the bypass relay get 24 V?')).toBeTruthy()
    expect(useChatStore.getState().messages[0].text).toBe(MESSAGES[0].text)
  })

  it('saves the edit beside the original when the editor is available', async () => {
    const fetch = vi.fn(async () => new Response('{"saved":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    useAppStore.setState({ health: { editing: { enabled: true, password_required: false }, spend: { exhausted: false } } as never })
    useChatStore.setState({ messages: [MESSAGES[0], { ...MESSAGES[1], turnId: 't-1', model: 'sonnet' }] })
    render(<AskTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText(/saved beside the drawing/i)).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit the answer' }), { target: { value: 'Mine.' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })))
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/edited-answers\/t-1$/)
    expect(JSON.parse(init.body as string)).toEqual({
      question: MESSAGES[0].text, question_edited: null,
      answer: MESSAGES[1].text, answer_edited: 'Mine.', model: 'sonnet',
    })
    expect(screen.queryByRole('textbox', { name: 'Edit the answer' })).toBeNull()
  })
})

const INDEX = JSON.parse(
  readFileSync(path.join(__dirname, '../talkthrough/fixtures/designators.json'), 'utf8'),
) as DesignatorIndex
const TURN = '0f5c2a8e-1b2c-4d3e-8f90-123456789abc'
/** An editor that needs no password, so `savesToDisk()` holds and the routes answer. */
const EDITOR = {
  editing: { enabled: true, password_required: false, by: null }, spend: { exhausted: false },
} as unknown as Health

describe('keeping and reopening (talkthrough_03.md §7)', () => {
  let calls: { url: string; init?: RequestInit }[]
  const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

  beforeEach(() => {
    calls = []
    useChatStore.setState({ messages: [], sessionId: null, composerText: '' })
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.endsWith('/turns')) {
        return reply({ turns: [{ turn_id: TURN, saved: '2026-10-01T09:30:00Z', model: 'sonnet',
          prompt_version: 'v1.3', question: 'Why, exactly?', preview: 'Because `CR1` is open.', edited: true }] })
      }
      if (url.endsWith(`/turns/${TURN}`)) {
        return reply({ turn_id: TURN, model: 'sonnet', question: 'Why?', answer: 'Because `CR1`.',
          edit: { question: { original: 'Why?', edited: 'Why, exactly?' },
            answer: { original: 'Because `CR1`.', edited: 'Because `CR1` is open.' } } })
      }
      return reply({ saved: true, record: {} })
    }))
  })

  afterEach(() => {
    useTalkStore.getState().exit()
    vi.unstubAllGlobals()
    useAppStore.setState({ health: null, byToken: new Map(), designators: null, drawing: null })
  })

  it('writes your own question and answer without asking the model, and saves them as composed', async () => {
    useAppStore.setState({ health: EDITOR })
    useChatStore.setState({ composerText: 'How is 24 V made?' })
    render(<AskTab />)
    fireEvent.click(screen.getByRole('button', { name: /Write your own/ }))
    // The question came from the composer; the empty answer opens ready to write.
    expect(screen.getByText('How is 24 V made?')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Edit the answer'), { target: { value: '`PS1` makes it.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'PUT')).toBe(true))
    const put = calls.find((c) => c.init?.method === 'PUT')!
    const [, answer] = useChatStore.getState().messages
    expect(put.url).toContain(`/edited-answers/${answer.turnId}`)
    expect(answer.turnId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(JSON.parse(put.init!.body as string)).toEqual({
      question: '', question_edited: 'How is 24 V made?', answer: '', answer_edited: '`PS1` makes it.',
      model: 'composed',
    })
    expect(screen.getByText('PS1')).toBeTruthy()
  })

  it('lists past answers only for the editor', () => {
    const { container } = render(<AskTab />)
    expect(container.querySelector('details')).toBeNull()
    expect(screen.getByRole('button', { name: /Write your own/ })).toBeTruthy()
  })

  it('opens a past answer with its edits applied, then edits it and talks it through', async () => {
    useAppStore.setState({
      health: EDITOR, designators: INDEX, byToken: buildLookup(INDEX),
      drawing: { tiles: { count: 4 } } as DrawingSummary,
    })
    const { container } = render(<AskTab />)
    const details = container.querySelector('details')!
    details.open = true
    fireEvent(details, new Event('toggle'))
    expect(await screen.findByText('Why, exactly?')).toBeTruthy()
    expect(screen.getByText(/sonnet · edited/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => expect(useChatStore.getState().messages).toHaveLength(2))

    const [question, answer] = useChatStore.getState().messages
    expect([question.text, question.edited]).toEqual(['Why?', 'Why, exactly?'])
    expect([answer.text, answer.edited, answer.turnId]).toEqual(['Because `CR1`.', 'Because `CR1` is open.', TURN])
    // Already in the conversation: not opened twice.
    expect((screen.getByRole('button', { name: 'Open' }) as HTMLButtonElement).disabled).toBe(true)
    // Not this server's model session any more.
    expect(screen.getByText(/A new question starts a fresh conversation/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Edit the answer'), { target: { value: 'Because `CR1` is shut.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.find((c) => c.init?.method === 'PUT')?.url).toContain(`/edited-answers/${TURN}`))
    expect(JSON.parse(calls.find((c) => c.init?.method === 'PUT')!.init!.body as string).answer).toBe('Because `CR1`.')

    fireEvent.click(await screen.findByRole('button', { name: /Talk me through it/ }))
    expect(useTalkStore.getState().messageId).toBe(answer.id)
    expect(useAppStore.getState().activeTabId).toBe('drawing')
  })

  it('comes back after a reload, with an answer caught mid-stream stopped rather than streaming', async () => {
    useChatStore.setState({
      messages: [MESSAGES[0], { ...MESSAGES[1], edited: 'Mine.', turnId: TURN },
        { ...MESSAGES[1], id: 'a2', status: 'streaming', thinking: true }],
      sessionId: 'sid-1', busy: true,
    })
    const kept = JSON.parse(sessionStorage.getItem('ask-transcript')!).state
    expect(Object.keys(kept).sort()).toEqual(['messages', 'sessionCostUsd'])
    // The reload: memory is gone, the tab's storage is not. (Emptying the store writes through,
    // so the stored copy is put back the way the browser would have kept it.)
    const stored = sessionStorage.getItem('ask-transcript')!
    useChatStore.setState({ messages: [], sessionId: null, busy: false })
    sessionStorage.setItem('ask-transcript', stored)
    await useChatStore.persist.rehydrate()
    const messages = useChatStore.getState().messages
    expect(messages.map((m) => m.id)).toEqual(['u1', 'a1', 'a2'])
    expect([messages[1].edited, messages[1].turnId, messages[2].status]).toEqual(['Mine.', TURN, 'cancelled'])
    render(<AskTab />)
    expect(screen.getByText('Mine.')).toBeTruthy()
    expect(screen.getByText(/A new question starts a fresh conversation/)).toBeTruthy()
  })
})
