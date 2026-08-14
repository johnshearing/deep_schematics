/**
 * Three things here fail silently in a browser, which is why they are tested.
 *
 * The tab is `keepMounted`, so a mistake in the arming logic downloads 2.2 MB of rasters for
 * a visitor who never opens it — and nothing on screen says so. The canvas backing store must
 * be sized in device pixels, and getting that wrong looks like nothing except blurry text. And
 * a missing `tiles` field has to mean "no tab" rather than "a tab full of 404s".
 *
 * The projection from PDF points onto that backing store is tested in `paint.test.ts`, against
 * a recording context — jsdom has no 2D context to assert through.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DrawingTab, DRAWING_TAB_ID } from './DrawingTab'
import type { Designator, DesignatorIndex, DrawingSummary, TileManifest } from '@/api/types'
import { buildLookup } from '@/lib/designators'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import { enabledTabs } from '@/tabs'

const TILES: TileManifest = {
  page_size_pt: [1224, 792],
  dpi: 400,
  rows: 1,
  cols: 2,
  count: 2,
  tiles: [
    { file: 'tile_r1c1.png', row: 1, col: 1, pdf_rect: [0, 0, 642, 792], pixels: [3567, 4400] },
    {
      file: 'tile_r1c2.png',
      row: 1,
      col: 2,
      pdf_rect: [582, 0, 1224, 792],
      pixels: [3567, 4400],
    },
  ],
}

const DRAWING = {
  drawing_number: 'PS20115MLM4-2',
  title: 'MOD-LINX POWER SUPPLY ASSY',
  assembly: null, date: null, revision: null, revision_note: null, proprietary_notice: null,
  notes: [], references: [], counts: {}, subsystems: [], component_classes: {},
  relationship_types: {}, artifacts: [],
  source: { name: 'PS20115MLM4-2.pdf', bytes: 151164, media_type: 'application/pdf' },
  tiles: TILES,
} satisfies DrawingSummary

const COMPONENTS: Designator[] = [
  { id: 'CR-BP', kind: 'component', label: 'relay — Run bypass relay.', on_sheet: true,
    members: ['CR-BP'], point: [861, 679], rect: [861, 679, 861, 679] },
  { id: 'CB1', kind: 'component', label: 'circuit breaker — 8A main.', on_sheet: true,
    members: ['CB1'], point: [390, 118], rect: [390, 118, 390, 118] },
  { id: 'UPSTREAM-MACHINE', kind: 'component', label: 'external — upstream machine.',
    on_sheet: true, members: ['UPSTREAM-MACHINE'], point: null, rect: null },
]
const NET_110: Designator = {
  id: '110', kind: 'net', label: 'control 24VDC, 8 terminals', on_sheet: true,
  members: ['CR-BP', 'CB1', 'UPSTREAM-MACHINE'], point: [625.5, 398.5],
  rect: [390, 118, 861, 679],
}
const INDEX: DesignatorIndex = {
  drawing_number: 'PS20115MLM4-2',
  counts: { component: 3, net: 1 },
  located: 3,
  entries: [...COMPONENTS, NET_110],
}

/** jsdom reports every element as 0×0, and a container with no size has nothing to fit to. */
const SIZE = { width: 800, height: 600 }
const descriptors = ['clientWidth', 'clientHeight'] as const

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => SIZE.width,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => SIZE.height,
  })
  useAppStore.setState({
    drawing: DRAWING,
    activeTabId: 'ask',
    designators: INDEX,
    byToken: buildLookup(INDEX),
    selection: null,
  })
})

afterEach(() => {
  for (const name of descriptors) delete (HTMLElement.prototype as never)[name]
  useAppStore.setState({
    activeTabId: 'ask', designators: null, byToken: new Map(), selection: null,
  })
  useChatStore.setState({ composerText: '' })
})

function activate() {
  act(() => useAppStore.setState({ activeTabId: DRAWING_TAB_ID }))
}

function marker(id: string): HTMLButtonElement {
  return screen.getByRole('button', { name: new RegExp(`^${id} —`) }) as HTMLButtonElement
}

describe('DrawingTab', () => {
  it('downloads nothing until the tab has been opened once', () => {
    const { container } = render(<DrawingTab />)
    // Mounted from the first paint, because the pan and zoom have to survive a tab switch.
    expect(screen.getByRole('application')).toBeTruthy()
    expect(container.querySelectorAll('img')).toHaveLength(0)

    activate()
    // Hidden loaders, not content — the canvas is the only thing that draws. They exist
    // because they are how the browser fetches, decodes, caches and reports load and error.
    const loaders = [...container.querySelectorAll('img')] as HTMLImageElement[]
    expect(loaders).toHaveLength(2)
    expect(loaders[1].getAttribute('src')).toBe('/api/tiles/tile_r1c2.png')
  })

  it('sizes the canvas backing store in device pixels, not CSS pixels', () => {
    // The heart of the blurry-text fix. jsdom reports a 1× display, so the numbers coincide
    // here; `paint.test.ts` covers the projection at 2× and 3×.
    const { container } = render(<DrawingTab />)
    activate()

    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas).toBeTruthy()
    expect(canvas.width).toBe(SIZE.width * window.devicePixelRatio)
    expect(canvas.height).toBe(SIZE.height * window.devicePixelRatio)
    // Sized by CSS to the container, so the backing store is the only thing carrying density.
    expect(canvas.className).toContain('h-full')
  })

  it('fits the sheet to the container and reports the zoom against device resolution', () => {
    render(<DrawingTab />)
    activate()

    // 776 px of usable width over 1224 pt, versus 576 over 792 — width binds, so the scale is
    // 0.634 px/pt. Native is now `dpi / 72 / dpr` = 400/72/1 = 5.56, so that is 11%. On a 2×
    // display native would be 2.78 and the same view would read 23% — which is the point: the
    // readout tracks the panel, not the CSS coordinate system.
    expect(screen.getByText('11%')).toBeTruthy()
  })

  it('keeps the raw PDF one click away, for printing and second monitors', () => {
    render(<DrawingTab />)
    expect(screen.getByRole('link', { name: /source pdf/i }).getAttribute('href')).toBe(
      '/api/source',
    )
  })

  it('places a marker on every component that has a location, and only those', () => {
    render(<DrawingTab />)
    activate()

    // Fit is 0.634 px/pt with the sheet centred, so CR-BP at (861, 679) lands at
    // 12 + 861 × 0.634 = 558 px across. The projection itself is `paint.test.ts`'s job; what
    // this pins is that the marker uses it at all rather than sitting at the origin.
    expect(marker('CR-BP').style.left).toBe('558px')
    expect(marker('CB1')).toBeTruthy()
    // No location, so nowhere to put it — it stays citable, not clickable.
    expect(screen.queryByRole('button', { name: /^UPSTREAM-MACHINE —/ })).toBeNull()
  })

  it('clicking a marker says what it is without moving the sheet', () => {
    render(<DrawingTab />)
    activate()
    const before = screen.getByText('11%').textContent

    fireEvent.click(marker('CR-BP'))

    expect(useAppStore.getState().selection).toMatchObject({ id: 'CR-BP', origin: 'drawing' })
    expect(screen.getByText('Run bypass relay.', { exact: false })).toBeTruthy()
    // You do not move the sheet under someone who has just put a finger on it.
    expect(screen.getByText('11%').textContent).toBe(before)
  })

  it('flies to a citation raised by an answer, and rings what the net runs through', async () => {
    render(<DrawingTab />)
    activate()
    expect(screen.getByText('11%')).toBeTruthy()

    act(() => useAppStore.getState().select('net', '110'))

    // Net 110 spans 471 × 561 pt; framing that with padding is 420/561 = 0.749 px/pt, which
    // against a native scale of 5.56 reads as 13%. The animation gets there over ~420 ms.
    // The flight is a real rAF animation of about 420 ms, so this waits for the landing
    // rather than the first frame. The timeout is generous because jsdom's rAF is a timer.
    await waitFor(() => expect(screen.getByText('13%')).toBeTruthy(), { timeout: 4000 })
    // Both located members are ringed, and the card names the third even though it has no
    // marker — "runs through" is the answer to "what is on net 110".
    expect(screen.getByRole('button', { name: 'CR-BP' })).toBeTruthy()
    const offSheet = screen.getByRole('button', { name: 'UPSTREAM-MACHINE' }) as HTMLButtonElement
    expect(offSheet.disabled).toBe(true)
  })

  it('hands a clicked component back to the composer as a question', () => {
    render(<DrawingTab />)
    activate()
    fireEvent.click(marker('CB1'))
    fireEvent.click(screen.getByRole('button', { name: /ask about this/i }))

    // The loop closes: drawing → question → answer → drawing.
    expect(useChatStore.getState().composerText).toContain('CB1')
    expect(useAppStore.getState().activeTabId).toBe('ask')
  })

  it('keeps the selected marker visible when the overlay is switched off', () => {
    render(<DrawingTab />)
    activate()
    fireEvent.click(marker('CR-BP'))
    fireEvent.click(screen.getByRole('button', { name: /components/i }))

    // Hiding the thing an answer just pointed at would be the one case the toggle must not
    // cover — the reader turned the other 46 off, not this one.
    expect(marker('CR-BP')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^CB1 —/ })).toBeNull()
  })

  it('offers no tab at all when the sheet has never been rendered to tiles', () => {
    const ids = (tilesAvailable: boolean) =>
      enabledTabs({ drawingAvailable: true, tilesAvailable }).map((tab) => tab.id)

    expect(ids(true)).toContain(DRAWING_TAB_ID)
    expect(ids(false)).not.toContain(DRAWING_TAB_ID)

    useAppStore.setState({ drawing: { ...DRAWING, tiles: null } })
    const { container } = render(<DrawingTab />)
    expect(container.firstChild).toBeNull()
  })
})
