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

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AskTab } from './AskTab'
import type { Message } from '@/stores/chatStore'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'

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
