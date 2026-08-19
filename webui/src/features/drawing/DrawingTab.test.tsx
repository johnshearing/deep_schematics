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
    members: ['CR-BP'], point: [861, 679], rect: [861, 679, 861, 679], placement: 'seed' },
  { id: 'CB1', kind: 'component', label: 'circuit breaker — 8A main.', on_sheet: true,
    members: ['CB1'], point: [390, 118], rect: [390, 118, 390, 118], placement: 'confirmed' },
  { id: 'UPSTREAM-MACHINE', kind: 'component', label: 'external — upstream machine.',
    on_sheet: true, members: ['UPSTREAM-MACHINE'], point: null, rect: null, placement: null },
]
/** Two pins of the same relay. `A1` has been placed; `A2` has not, so the index hands back
 * `CR-BP`'s own point and flags it `parent`. Both cases have to draw and read differently. */
const TERMINALS: Designator[] = [
  { id: 'CR-BP:A1', kind: 'terminal', label: 'coil terminal on CR-BP, net 110', on_sheet: true,
    members: ['CR-BP'], point: [858, 668], rect: [858, 668, 858, 668], placement: 'confirmed' },
  { id: 'CR-BP:A2', kind: 'terminal', label: 'coil terminal on CR-BP, net 0V', on_sheet: true,
    members: ['CR-BP'], point: [861, 679], rect: [861, 679, 861, 679], placement: 'parent' },
]
const NET_110: Designator = {
  id: '110', kind: 'net', label: 'control 24VDC, 8 terminals', on_sheet: true,
  members: ['CR-BP', 'CB1', 'UPSTREAM-MACHINE'], point: [625.5, 398.5],
  rect: [390, 118, 861, 679],
}
const INDEX: DesignatorIndex = {
  drawing_number: 'PS20115MLM4-2',
  counts: { component: 3, terminal: 2, net: 1 },
  located: 5,
  entries: [...COMPONENTS, ...TERMINALS, NET_110],
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

  it('anchors the dot on the point, so a label cannot drag it sideways', () => {
    // The bug this pins was invisible to the assertion above: the marker's `left` was always
    // the projected point, but the button was a flex row of dot *then* label centred on it, so
    // the dot itself sat half a label's width to the left — further for a longer id, and it
    // moved when labels appeared at the 30% threshold. jsdom does no layout, so what is
    // asserted is the mechanism: the button's box is the dot's box, and the label is out of
    // flow and therefore cannot contribute to it.
    render(<DrawingTab />)
    activate()

    const dot = marker('CR-BP')
    expect(dot.style.left).toBe('558px')
    expect(dot.className).toContain('-translate-x-1/2')
    expect(dot.className).not.toMatch(/\bflex\b|\bgap-/)
    expect(dot.querySelectorAll('span')).toHaveLength(1)

    // Selecting it makes the label appear regardless of zoom — the case that used to move the
    // dot. It must not move, and the label must be positioned out of the button's flow.
    fireEvent.click(dot)
    const spans = marker('CR-BP').querySelectorAll('span')
    expect(spans).toHaveLength(2)
    expect(spans[1].textContent).toBe('CR-BP')
    expect(spans[1].className).toContain('absolute')
    expect(marker('CR-BP').style.left).toBe('558px')
  })

  it('labels a selected terminal with its own id, at its own point', async () => {
    // The fault: the tab reduced a selection to `entry.kind === 'component' ? entry.id : null`
    // and let the parent component's marker stand in for a selected terminal, so clicking a
    // citation of `CR-BP:A1` ringed a dot labelled `CR-BP` — and put it wherever `CR-BP` is,
    // which on the real sheet is the coil centre rather than the pin. Two wrong things at once,
    // and both look like a working link.
    render(<DrawingTab />)
    activate()
    // Raised as if from the sheet, so the viewer does not fly and the fit scale still holds —
    // the flight itself is the net test's job, and it would centre the dot at 400 px.
    act(() => useAppStore.getState().select('terminal', 'CR-BP:A1', 'drawing'))
    await waitFor(() => expect(marker('CR-BP:A1')).toBeTruthy())

    const dot = marker('CR-BP:A1')
    expect(dot.getAttribute('aria-pressed')).toBe('true')
    expect([...dot.querySelectorAll('span')].at(-1)?.textContent).toBe('CR-BP:A1')
    // 858 pt, not CR-BP's 861: 12 + 858 × 0.634 = 556 px, against the relay's 558.
    expect(dot.style.left).toBe('556px')
    // And the component keeps its own dot, unpressed, under its own name.
    expect(marker('CR-BP').getAttribute('aria-pressed')).toBe('false')
  })

  it('admits when a dot is the component’s point rather than the pin’s', async () => {
    // `CR-BP:A2` has no point of its own, so the index hands back its parent's and says so.
    // Drawing that identically to a placed point would tell the reader we know where A2 is.
    render(<DrawingTab />)
    activate()
    act(() => useAppStore.getState().select('terminal', 'CR-BP:A2', 'drawing'))
    await waitFor(() => expect(marker('CR-BP:A2')).toBeTruthy())

    const unplaced = marker('CR-BP:A2')
    expect(unplaced.getAttribute('title')).toContain("the component's point, not this pin's")
    // Hollow: white fill with the marker's colour as an inner ring, rather than a solid dot.
    expect(unplaced.querySelector('span')?.className).toContain('bg-white')
    expect(unplaced.querySelector('span')?.getAttribute('style')).toContain('inset')

    // A placed one is filled and says who placed it, with no inline ring at all.
    const placed = marker('CB1')
    expect(placed.getAttribute('title')).toContain('placed by hand')
    expect(placed.querySelector('span')?.className).not.toContain('bg-white')
    expect(placed.querySelector('span')?.getAttribute('style')).toBeNull()
  })

  it('draws one dot per place for a component drawn more than once', () => {
    // `CR-BP` is drawn three times on the real sheet — coil, NC contact, NO contact — and one
    // dot per component would put the marker on a circuit the reader is not looking at.
    const relay: Designator = {
      ...COMPONENTS[0],
      rect: [592, 223, 861, 679],
      places: [
        { point: [861, 679], placement: 'confirmed', site: 'coil' },
        { point: [714, 520], placement: 'confirmed', site: 'nc' },
        { point: [592, 223], placement: 'seed', site: 'no' },
      ],
    }
    const index = { ...INDEX, entries: [relay, ...COMPONENTS.slice(1), ...TERMINALS, NET_110] }
    useAppStore.setState({ designators: index, byToken: buildLookup(index) })

    render(<DrawingTab />)
    activate()
    expect(screen.getAllByRole('button', { name: /^CR-BP — relay/ })).toHaveLength(3)
    // Each dot names its site, so a tooltip can say which of the three you are looking at.
    // 12 + 714 × 0.634 = 465 px, the NC contact rather than the coil's 558.
    const nc = screen.getByRole('button', { name: /^CR-BP —.*\(nc\)/ }) as HTMLButtonElement
    expect(nc.style.left).toBe('465px')
  })

  it('lands a wire citation on its name once somebody has placed it', async () => {
    // A wire's `point` is the midpoint of its run, which is blank paper. Before a label point
    // exists there is nothing honest to put a dot on, so the viewer frames the run and rings the
    // ends. Once one exists the marker sits on the printed text — which is what a reader
    // following `W048` is looking for.
    const wire: Designator = {
      id: 'W048', kind: 'wire', label: 'BLUE 18AWG wire, CR-BP:A2 → CB1:2', on_sheet: false,
      members: ['CR-BP', 'CB1'], point: [625, 398], rect: [390, 118, 861, 679],
    }
    const bare = { ...INDEX, entries: [...COMPONENTS, ...TERMINALS, wire] }
    useAppStore.setState({ designators: bare, byToken: buildLookup(bare) })

    const view = render(<DrawingTab />)
    activate()
    act(() => useAppStore.getState().select('wire', 'W048', 'drawing'))
    await waitFor(() => expect(screen.getByText(/BLUE 18AWG/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /^W048 —/ })).toBeNull()
    view.unmount()

    const placed = { ...bare, entries: [...COMPONENTS, ...TERMINALS,
      { ...wire, label_point: [742, 511] as [number, number], label_dir: 'w' as const }] }
    useAppStore.setState({ designators: placed, byToken: buildLookup(placed) })
    render(<DrawingTab />)
    activate()
    act(() => useAppStore.getState().select('wire', 'W048', 'drawing'))

    // 12 + 742 × 0.634 = 482 px — the label, not the 625 pt midpoint of the run.
    const dot = await waitFor(() => marker('W048'))
    expect(dot.style.left).toBe('482px')
    expect([...dot.querySelectorAll('span')].at(-1)?.textContent).toBe('W048')
  })

  it('does not let a stray drag on the read-only sheet edit anything', () => {
    // `MarkerLayer` becomes draggable only when it is handed an `onDragPoint`, and only the
    // Locate editor hands it one. The Drawing tab must pan.
    render(<DrawingTab />)
    activate()
    expect(marker('CR-BP').className).not.toContain('cursor-move')
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

  it('gives Escape the same job as the ✕ on the card', () => {
    // A selection is a mode — a ringed dot, a card over the corner of the sheet, and a marker
    // that shows through the Components toggle — and the only way out used to be a 20 px target
    // in a corner. Same key, same meaning as the Locate tab's Escape.
    render(<DrawingTab />)
    activate()
    fireEvent.click(marker('CR-BP'))
    expect(screen.getByText('Run bypass relay.', { exact: false })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(useAppStore.getState().selection).toBeNull()
    expect(screen.queryByText('Run bypass relay.', { exact: false })).toBeNull()
  })

  it('leaves Escape alone when this tab is not the one on screen', () => {
    // The listener is on `window`, because a selection usually arrives from a citation on the
    // Ask tab and nothing here has focus afterwards. That makes the tab guard the only thing
    // stopping this from disarming the Locate editor's target from a hidden tab.
    render(<DrawingTab />)
    activate()
    fireEvent.click(marker('CR-BP'))
    act(() => useAppStore.setState({ activeTabId: 'locate' }))

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(useAppStore.getState().selection).not.toBeNull()
  })

  it('lets a box being typed into have the first Escape', () => {
    // The unlock field lives in the header, outside the tabs, and is on screen while this tab
    // is. Escape in a text field means "abandon what I am typing", and that is its own event.
    render(<DrawingTab />)
    activate()
    fireEvent.click(marker('CR-BP'))

    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()
    fireEvent.keyDown(field, { key: 'Escape' })

    expect(useAppStore.getState().selection).not.toBeNull()
    expect(document.activeElement).not.toBe(field)
    field.remove()
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
      enabledTabs({ drawingAvailable: true, tilesAvailable, editingEnabled: false }).map(
        (tab) => tab.id,
      )

    expect(ids(true)).toContain(DRAWING_TAB_ID)
    expect(ids(false)).not.toContain(DRAWING_TAB_ID)

    useAppStore.setState({ drawing: { ...DRAWING, tiles: null } })
    const { container } = render(<DrawingTab />)
    expect(container.firstChild).toBeNull()
  })
})
