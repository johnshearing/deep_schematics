/**
 * Three things here fail silently in a browser, which is why they are tested.
 *
 * The tab is `keepMounted`, so a mistake in the arming logic downloads 2.2 MB of rasters for
 * a visitor who never opens it — and nothing on screen says so. The tiles are positioned from
 * `pdf_rect` in points; get the units wrong and you still get a picture, just the wrong one.
 * And a missing `tiles` field has to mean "no tab" rather than "a tab full of 404s".
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
    expect(container.querySelectorAll('img')).toHaveLength(2)
  })

  it('places each tile at its own rectangle, in PDF points', () => {
    const { container } = render(<DrawingTab />)
    activate()

    const [, second] = [...container.querySelectorAll('img')] as HTMLImageElement[]
    expect(second.getAttribute('src')).toBe('/api/tiles/tile_r1c2.png')
    // `pdf_rect` straight through: left 582 pt, 642 pt wide, 792 pt tall. The plane's own
    // units are points and one CSS transform turns them into pixels.
    expect(second.style.left).toBe('582px')
    expect(second.style.width).toBe('642px')
    expect(second.style.height).toBe('792px')
  })

  it('fits the sheet to the container and reports the zoom against tile resolution', () => {
    render(<DrawingTab />)
    activate()

    // 776 px of usable width over 1224 pt, versus 576 over 792 — width binds, so the scale is
    // 0.634 px/pt against a native 400/72 = 5.56. That is 11%.
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
