import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesignatorIndex, DrawingSummary, Health, TileManifest } from '@/api/types'
import { DrawingTab } from '@/features/drawing/DrawingTab'
import { MessageView } from '@/features/ask/MessageView'
import { buildLookup } from '@/lib/designators'
import { useAppStore } from '@/stores/appStore'
import { useChatStore, type Message } from '@/stores/chatStore'
import { TalkPalette } from './TalkPalette'
import { timedSpeaker, webSpeaker } from '@/lib/speech'
import { setSpeakers, useTalkStore } from './talkStore'

/**
 * `talkthrough_01.md` §6.6. The palette beside the real Drawing tab, because the two ways this
 * feature could damage that tab — Escape and dragging — are only tested honestly against it.
 * The speakers are the real ones: jsdom has no `speechSynthesis`, which is the voiceless browser.
 */

const INDEX = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/designators.json'), 'utf8'),
) as DesignatorIndex

const TILES: TileManifest = {
  page_size_pt: [1224, 792], dpi: 400, rows: 1, cols: 1, count: 1,
  tiles: [{ file: 'tile_r1c1.png', row: 1, col: 1, pdf_rect: [0, 0, 1224, 792], pixels: [6800, 4400] }],
}
const DRAWING = {
  drawing_number: 'x', title: 't', assembly: null, date: null, revision: null, revision_note: null,
  proprietary_notice: null, notes: [], references: [], counts: {}, subsystems: [],
  component_classes: {}, relationship_types: {}, artifacts: [],
  source: { name: 'x.pdf', bytes: 1, media_type: 'application/pdf' }, tiles: TILES,
} satisfies DrawingSummary

// Sentences: 0 "Start here." · 1 "Net " "121 goes to " "CR1 now." · 2 "Then " "PB1 lights." · 3 "End."
const MESSAGE: Message = {
  id: 'a1', role: 'assistant', text: 'Start here. Net `121` goes to `CR1` now. Then `PB1` lights. End.',
  tools: [], denials: [], status: 'done', thinking: false, startedAt: 1, costUsd: 0.01, durationMs: 1000,
}

/** jsdom has no `PointerEvent`, and without one a fired pointer event loses its coordinates. */
if (typeof window.PointerEvent !== 'function') {
  class FakePointerEvent extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
  window.PointerEvent = FakePointerEvent as unknown as typeof PointerEvent
}

const talk = () => useTalkStore.getState()
const selected = () => useAppStore.getState().selection?.id
const palette = () => screen.getByRole('dialog', { name: 'Talkthrough' })
const press = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }))

function mount() {
  render(
    <>
      <textarea aria-label="composer" />
      <MessageView message={MESSAGE} />
      <DrawingTab />
      <TalkPalette />
    </>,
  )
}

function begin() {
  mount()
  fireEvent.click(screen.getByRole('button', { name: /talk me through it/i }))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
  useAppStore.setState({
    drawing: DRAWING, designators: INDEX, byToken: buildLookup(INDEX), activeTabId: 'ask',
    selection: null, paths: null, conductors: [], conductorsError: null, health: null,
  })
  useChatStore.setState({ messages: [{ ...MESSAGE, id: 'u1', role: 'user' }, MESSAGE] })
  useTalkStore.setState({
    dwell: 0, where: 'marks', rate: 1, muted: false, palette: null, voice: null, pitch: 1, questionFirst: false, showSay: false, flow: false,
  })
})

afterEach(() => {
  act(() => talk().exit())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useAppStore.setState({ drawing: null, designators: null, byToken: new Map(), selection: null, activeTabId: 'ask' })
  useChatStore.setState({ messages: [] })
})

describe('the talkthrough palette', () => {
  it('opens on the button, switches to the drawing, and the button says it is talking', () => {
    mount()
    expect(screen.queryByRole('dialog', { name: 'Talkthrough' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /talk me through it/i }))
    expect(palette()).toBeTruthy()
    expect(useAppStore.getState().activeTabId).toBe('drawing')
    expect(screen.getByRole('button', { name: /talking…/i })).toBeTruthy()
    expect(document.activeElement).toBe(palette())
  })

  it('wires every control to its action', () => {
    begin()
    press(/^pause/i)
    expect(talk().phase).toBe('paused')
    press(/^next item/i)
    expect(selected()).toBe('121')
    press(/^next item/i)
    expect(selected()).toBe('CR1')
    press(/^previous item/i)
    expect(selected()).toBe('121')
    press(/^next sentence/i)
    expect(talk().pos).toEqual({ s: 2, g: 0 })
    press(/^previous sentence/i)
    expect(talk().pos).toEqual({ s: 1, g: 0 })
    fireEvent.click(screen.getByRole('radio', { name: 'until I press ▶' }))
    expect(talk().dwell).toBe('press')
    fireEvent.change(screen.getByRole('slider', { name: 'Speed' }), { target: { value: '1.2' } })
    expect(talk().rate).toBe(1.2)
    press(/^mute/i)
    expect(talk().muted).toBe(true)
    press(/^play/i)
    expect(talk().phase).not.toBe('paused')
    press(/^end the talkthrough/i)
    expect(talk().phase).toBe('idle')
    expect(screen.queryByRole('dialog', { name: 'Talkthrough' })).toBeNull()
  })

  it('ends on Escape and leaves the last item selected, despite the Drawing tab’s own Escape', () => {
    begin()
    press(/^pause/i)
    press(/^next item/i)
    press(/^next item/i)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(talk().phase).toBe('idle')
    expect(selected()).toBe('CR1')
  })

  it('leaves an Escape pressed in the composer to the composer', () => {
    begin()
    const composer = screen.getByRole('textbox', { name: 'composer' })
    composer.focus()
    fireEvent.keyDown(composer, { key: 'Escape' })
    expect(talk().phase).not.toBe('idle')
  })

  it('steps with the arrows while focus is in it, and the keys go no further', () => {
    begin()
    press(/^pause/i)
    const beyond = vi.fn()
    window.addEventListener('keydown', beyond)
    fireEvent.keyDown(palette(), { key: 'ArrowRight' })
    expect(talk().pos).toEqual({ s: 1, g: 0 })
    fireEvent.keyDown(palette(), { key: 'ArrowRight', shiftKey: true })
    expect(selected()).toBe('121')
    fireEvent.keyDown(palette(), { key: 'ArrowLeft' })
    expect(talk().pos).toEqual({ s: 1, g: 0 })
    fireEvent.keyDown(palette(), { key: ' ' })
    expect(talk().phase).not.toBe('paused')
    window.removeEventListener('keydown', beyond)
    expect(beyond).not.toHaveBeenCalled()
  })

  it('drags by its title bar, keeps the place, clamps it into the window, and resets on double-click', () => {
    begin()
    vi.spyOn(palette(), 'getBoundingClientRect').mockReturnValue(
      { left: 672, top: 12, width: 340, height: 300, right: 1012, bottom: 312, x: 672, y: 12 } as DOMRect,
    )
    const handle = screen.getByTestId('talk-handle')
    const sheetPress = vi.fn()
    window.addEventListener('pointerdown', sheetPress)
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 900, clientY: 20 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300, clientY: 208 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 300, clientY: 208 })
    window.removeEventListener('pointerdown', sheetPress)
    expect(sheetPress).not.toHaveBeenCalled() // a drag never starts a sheet pan
    expect(talk().palette).toEqual({ x: 72, y: 200 })
    expect(palette().style.left).toBe('72px')
    expect(JSON.parse(localStorage.getItem('talkthrough-settings')!).state.palette).toEqual({ x: 72, y: 200 })

    act(() => talk().setPalette({ x: 5000, y: 5000 }))
    expect(talk().palette).toEqual({ x: window.innerWidth - 48, y: window.innerHeight - 48 })

    fireEvent.doubleClick(handle)
    expect(talk().palette).toBeNull()
    expect(palette().style.right).toBe('12px')
  })

  it('says captions only where there is no voice, and advances them at reading pace', async () => {
    begin()
    expect(screen.getByText(/captions only/i)).toBeTruthy()
    expect(screen.getByTestId('talk-caption').textContent).toBe('Start here.')
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByTestId('talk-caption').textContent).toBe('Net 121 goes to CR1 now.')
    expect(screen.getByTestId('talk-caption').querySelector('strong')).toBeNull() // "Net "
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(screen.getByTestId('talk-caption').querySelector('strong')?.textContent).toBe('121')
    expect(selected()).toBe('121')
  })

  it('offers the browser’s voices, English first, and a pitch, where there is a voice', () => {
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [{ name: 'Robert', lang: 'fr-FR' }, { name: 'Ann', lang: 'en-US' }],
      addEventListener() {}, removeEventListener() {}, cancel() {},
    })
    setSpeakers({ supported: true, speak: () => new Promise(() => {}), cancel() {} }, timedSpeaker())
    try {
      begin()
      const menu = screen.getByRole('combobox', { name: 'Voice' }) as HTMLSelectElement
      expect([...menu.options].map((o) => o.textContent)).toEqual(['Automatic', 'Ann (en-US)', 'Robert (fr-FR)'])
      fireEvent.change(menu, { target: { value: 'Robert' } })
      expect(talk().voice).toBe('Robert')
      fireEvent.change(screen.getByRole('slider', { name: 'Pitch' }), { target: { value: '0.7' } })
      expect(talk().pitch).toBe(0.7)
      expect(screen.queryByText(/captions only/i)).toBeNull()
    } finally {
      setSpeakers(webSpeaker, timedSpeaker())
    }
  })

  it('shows the spoken form under the caption, and labels the question when it is read first', () => {
    useTalkStore.setState({ questionFirst: true })
    useChatStore.setState({ messages: [{ ...MESSAGE, id: 'u1', role: 'user', text: 'Is PB1 lit?' }, MESSAGE] })
    begin()
    expect(screen.getByText(/^Question · /)).toBeTruthy()
    expect(screen.queryByTestId('talk-say')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show spoken text' }))
    expect(screen.getByTestId('talk-say').textContent).toBe('Is P B 1 lit? ')
    expect(screen.getByTestId('talk-caption').textContent).toBe('Is PB1 lit?')
  })

  it('says an item the way the user saved it, from the next time it is spoken', async () => {
    const put = vi.fn(async (_url: string, init: RequestInit) =>
      new Response(JSON.stringify({ entries: JSON.parse(init.body as string).entries }), { status: 200 }),
    )
    vi.stubGlobal('fetch', put)
    useAppStore.setState({
      health: { editing: { enabled: true, password_required: false } } as Health,
      pronunciationLists: { global: [], drawing: [] },
    })
    useTalkStore.setState({ showSay: true })
    begin()
    press(/^pause/i)
    press(/^next item/i) // 121
    press(/^next item/i) // CR1
    expect(screen.getByTestId('talk-say').textContent).toContain('C R 1 now.')
    press(/^say it as/i)
    const field = screen.getByRole('textbox', { name: 'Say CR1 as' }) as HTMLInputElement
    expect(field.value).toBe('C R 1')
    fireEvent.change(field, { target: { value: 'control relay one' } })
    await act(async () => press(/^save for this drawing/i))

    const [url, init] = put.mock.calls[0]
    expect(url).toBe('/api/pronunciations/drawing')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string).entries).toEqual([
      expect.objectContaining({ match: 'CR1', say: 'control relay one' }),
    ])
    expect(screen.getByTestId('talk-say').textContent).toContain('control relay one now.')
    expect(talk().pos).toEqual({ s: 1, g: 2 }) // still on the same item
    expect(screen.getByText(/Saved\. CR1 is said this way/)).toBeTruthy()
  })

  it('offers Say it as… only with the editor routes, and asks for the unlock inside the palette', () => {
    useTalkStore.setState({ showSay: true })
    useAppStore.setState({ health: { editing: { enabled: false, password_required: true } } as Health })
    begin()
    press(/^pause/i)
    press(/^next item/i)
    expect(screen.queryByRole('button', { name: /^say it as/i })).toBeNull()
    act(() => useAppStore.setState({ health: { editing: { enabled: true, password_required: true } } as Health }))
    press(/^say it as/i)
    expect(screen.getByText('Unlock the editor (Locate tab) to save.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^save for/i })).toBeNull()
  })

  it('switches natural flow, and remembers it', () => {
    begin()
    const box = screen.getByRole('checkbox', { name: 'Natural flow' }) as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    expect(talk().flow).toBe(true)
    expect(JSON.parse(localStorage.getItem('talkthrough-settings')!).state.flow).toBe(true)
    fireEvent.click(box)
    expect(talk().flow).toBe(false)
  })

  it('speaks only the sentences a selection in the answer touches', () => {
    mount()
    const answer = document.querySelector('.answer')!
    const paragraph = answer.querySelector('p')!
    // From inside "Net " to inside "CR1": sentence 1 only.
    const range = document.createRange()
    const text = [...paragraph.childNodes]
    range.setStart(text[0], 14) // "Start here. Ne|t "
    range.setEnd(paragraph.querySelectorAll('code')[1].firstChild!, 2) // "CR|1"
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    const button = screen.getByRole('button', { name: /talk me through it/i })
    fireEvent.pointerDown(button)
    window.getSelection()!.removeAllRanges() // as a click may collapse it before the handler runs
    fireEvent.click(button)
    expect(talk().talk!.sentences.map((x) => x.segments.map((g) => g.show).join(''))).toEqual([
      'Net 121 goes to CR1 now.',
    ])
    expect(screen.getByText(/\(selection\)/)).toBeTruthy()
  })

  it('ignores a selection outside the answer and speaks the whole of it', () => {
    mount()
    const composer = screen.getByRole('textbox', { name: 'composer' })
    composer.textContent = 'elsewhere'
    const range = document.createRange()
    range.selectNodeContents(composer)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    fireEvent.click(screen.getByRole('button', { name: /talk me through it/i }))
    expect(talk().talk!.sentences).toHaveLength(4)
    expect(talk().partial).toBe(false)
  })
})

describe('marked pauses and hidden links in the palette (talkthrough_03.md §6B)', () => {
  it('names the hidden links that resolve to nothing, in the palette and never on the answer', () => {
    // **T-1990.**
    const typo = { ...MESSAGE, text: 'Look `@ZZ9` at `@CR1` and `@TB-12O ~`. End.' }
    useChatStore.setState({ messages: [{ ...typo, id: 'u1', role: 'user' }, typo] })
    render(<><MessageView message={typo} /><DrawingTab /><TalkPalette /></>)
    fireEvent.click(screen.getByRole('button', { name: /talk me through it/i }))
    expect(screen.getByTestId('talk-missing').textContent).toBe('2 hidden links not found: ZZ9, TB-12O')
    expect(screen.getAllByTestId('talk-missing')).toHaveLength(1)
  })

  it("offers 'where' beside the length, persisted, and only while a pause is chosen", () => {
    // **T-1991.**
    begin()
    expect(screen.getByRole('radio', { name: 'at every item' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('radio', { name: '2 s' }))
    fireEvent.click(screen.getByRole('radio', { name: 'at every item' }))
    expect(talk().where).toBe('every')
    expect(JSON.parse(localStorage.getItem('talkthrough-settings')!).state.where).toBe('every')
    fireEvent.click(screen.getByRole('radio', { name: 'at marks ~' }))
    expect(talk().where).toBe('marks')
  })
})
