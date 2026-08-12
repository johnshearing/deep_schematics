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

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DrawingTab, DRAWING_TAB_ID } from './DrawingTab'
import type { DrawingSummary, TileManifest } from '@/api/types'
import { useAppStore } from '@/stores/appStore'
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
  useAppStore.setState({ drawing: DRAWING, activeTabId: 'ask' })
})

afterEach(() => {
  for (const name of descriptors) delete (HTMLElement.prototype as never)[name]
  useAppStore.setState({ activeTabId: 'ask' })
})

function activate() {
  act(() => useAppStore.setState({ activeTabId: DRAWING_TAB_ID }))
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
