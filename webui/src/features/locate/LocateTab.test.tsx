/**
 * The editor, end to end against a stubbed server.
 *
 * What is worth testing here is not the layout. It is the four things that would each produce a
 * plausible-looking editor that quietly does the wrong thing to an authored file:
 *
 * - a click landing on the wrong coordinate, because the projection was re-derived here instead
 *   of reused (the sheet is drawn by one projection and there must not be a second);
 * - a click landing on the wrong *id*, because the target and the row got out of step;
 * - a save that sends something other than the document on screen;
 * - a Locate tab existing on a server that never registered the routes to save to.
 *
 * The password gate is tested too, because "the editor is behind its own password" is a
 * requirement rather than a nicety: spending tokens and changing where the drawing says things
 * are are different permissions.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocateTab } from './LocateTab'
import type { Designator, DesignatorIndex, DrawingSummary, Health } from '@/api/types'
import { buildLookup } from '@/lib/designators'
import { useAppStore } from '@/stores/appStore'
import { useLocateStore } from '@/stores/locateStore'
import { enabledTabs } from '@/tabs'
import { LOCATE_TAB_ID } from '@/tabIds'

const TILES = {
  page_size_pt: [1224, 792] as [number, number],
  dpi: 400,
  rows: 1,
  cols: 1,
  count: 1,
  tiles: [
    {
      file: 'tile_r1c1.png',
      row: 1,
      col: 1,
      pdf_rect: [0, 0, 1224, 792] as [number, number, number, number],
      pixels: [6800, 4400] as [number, number],
    },
  ],
}

const DRAWING = {
  drawing_number: 'PS20115MLM4-2',
  title: null, assembly: null, date: null, revision: null, revision_note: null,
  proprietary_notice: null, notes: [], references: [], counts: {}, subsystems: [],
  component_classes: {}, relationship_types: {}, artifacts: [], source: null,
  tiles: TILES,
} satisfies DrawingSummary

const HEALTH = {
  ok: true, version: '0.1.0', prompt_version: 'v1.1', claude: '2.1.226', drawing_dir: '/x',
  drawing_dir_present: true, models: ['sonnet'], default_model: 'sonnet',
  anonymous_models: ['sonnet'], password_required: false,
  editing: { enabled: true, password_required: true, by: 'js' },
  spend: { day: '2026-08-16', spent_usd: 0, ceiling_usd: 10, remaining_usd: 10, exhausted: false },
  in_flight: 0, concurrency_limit: 2, sessions: 0,
} satisfies Health

const ENTRIES: Designator[] = [
  { id: 'CR-BP', kind: 'component', label: 'relay — Run bypass relay.', on_sheet: true,
    members: ['CR-BP'], point: [861, 679], rect: [861, 679, 861, 679], placement: 'seed' },
  { id: 'CR-BP:A1', kind: 'terminal', label: 'coil terminal on CR-BP', on_sheet: true,
    members: ['CR-BP'], point: [861, 679], rect: [861, 679, 861, 679], placement: 'parent' },
  { id: 'CR-BP:11', kind: 'terminal', label: 'common terminal on CR-BP', on_sheet: true,
    members: ['CR-BP'], point: [861, 679], rect: [861, 679, 861, 679], placement: 'parent' },
  { id: 'W047', kind: 'wire', label: 'BLUE 18AWG wire', on_sheet: false,
    members: ['CR-BP'], point: [861, 679], rect: [861, 679, 861, 679] },
]
const INDEX: DesignatorIndex = {
  drawing_number: 'PS20115MLM4-2',
  counts: { component: 1, terminal: 2, wire: 1 },
  located: 4,
  entries: ENTRIES,
}

const EMPTY_REPORT = {
  file: false, components: 0, sites: 0, confirmed_sites: 0, terminals: 0,
  confirmed_terminals: 0, problems: [] as string[],
}

/** jsdom reports every element as 0×0, and a container with no size has nothing to fit to.
 * 800×600 with 12 pt of padding fits 1224×792 at 776/1224 = 0.63399 px/pt, origin (12, 48.94). */
const SIZE = { width: 800, height: 600 }

/** Every PUT the editor made, in order, so a test can look at the file it would have written. */
let saved: Record<string, unknown>[] = []

/** Every `scrollIntoView` the list asked for, and the row it asked for it on. jsdom has no
 * layout and so no implementation of its own — the list calls it optionally for that reason. */
let scrolled: ReturnType<typeof vi.fn>

function stubServer(options: { unlockOk?: boolean; report?: typeof EMPTY_REPORT } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/editor/unlock')) {
        return options.unlockOk === false
          ? json({ detail: 'That is not the editor password.' }, 401)
          : json({ unlocked: true, password_required: true })
      }
      if (url.endsWith('/api/locations') && init?.method === 'PUT') {
        saved.push(JSON.parse(String(init.body)).document)
        return json({
          saved: true,
          report: options.report ?? EMPTY_REPORT,
          stale: 'circuit_logic.json is behind locations.json — re-run it.',
        })
      }
      if (url.endsWith('/api/locations')) {
        return json({
          present: false,
          document: {
            drawing_number: 'PS20115MLM4-2',
            schema: 1,
            page_size_pt: [1224, 792],
            components: {},
            terminals: {},
          },
          report: options.report ?? EMPTY_REPORT,
        })
      }
      if (url.endsWith('/api/designators')) return json(INDEX)
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

/** Every URL the page has fetched, so a test can assert on what was *not* asked for. */
function calls(): string[] {
  return (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(
    ([url]) => url,
  )
}

function json(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    statusText: '',
  } as unknown as Response
}

beforeEach(() => {
  saved = []
  scrolled = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrolled,
  })
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
    health: HEALTH,
    designators: INDEX,
    byToken: buildLookup(INDEX),
    activeTabId: LOCATE_TAB_ID,
  })
  // `advance: false` here is the store's own default restated, not a choice this suite is making:
  // the advance is opt-in, and a test that silently arranged for it to be on would be testing a
  // screen nobody is handed.
  useLocateStore.setState({
    document: null, report: null, unlocked: false, loading: false, error: null,
    target: null, advance: false, saveState: 'clean', saveError: null, stale: null,
  })
  stubServer()
})

afterEach(() => {
  for (const name of ['clientWidth', 'clientHeight', 'scrollIntoView'] as const) {
    delete (HTMLElement.prototype as never)[name]
  }
  vi.unstubAllGlobals()
})

/** Get past the gate the way a person does. */
async function open() {
  render(<LocateTab />)
  fireEvent.change(screen.getByLabelText('Editor password'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
  await screen.findByRole('option', { name: /^CR-BP / })
}

/** The trailing space matters: without it `^CR-BP` also matches `CR-BP:A1`, which is exactly
 * the confusion the whole `PARENT:PIN` citation rule exists to prevent. */
function row(id: string) {
  return screen.getByRole('option', { name: new RegExp(`^${id} `) })
}

function sheet() {
  return screen.getByRole('application')
}

/** The ids in the list, in the order they are on screen — the row's monospace first line. */
function ids(): string[] {
  return screen
    .getAllByRole('option')
    .map((option) => option.querySelector('.font-mono')?.textContent ?? '')
}

function advance() {
  return screen.getByLabelText(/move to the next unplaced/i) as HTMLInputElement
}

/** Click somewhere on the sheet. `fireEvent.click` alone is not enough: the tab snapshots the
 * viewport on the press, because a placement is a click that did not move the sheet. */
function clickSheet(x: number, y: number) {
  fireEvent.pointerDown(sheet(), { pointerId: 1, button: 0 })
  fireEvent.pointerUp(sheet(), { pointerId: 1 })
  fireEvent.click(sheet(), { clientX: x, clientY: y })
}

/**
 * Make every flight arrive at once, so a test can say **where the sheet went**.
 *
 * `panTo` interpolates over 420 ms of real time, and what is worth pinning here is the
 * destination rather than the easing — so this borrows the path the viewport already has for
 * somebody who asked their operating system for less motion, which sets the final viewport
 * directly. Stubbed per test rather than in `beforeEach`: the placement tests click the sheet
 * immediately after arming a row, and they mean the coordinate under the *unmoved* sheet.
 */
function landsAtOnce() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

/** The zoom the toolbar is showing. 11% is the whole sheet fitted, 9% is the whole sheet with
 * the wider padding a *flight* uses, and 50% is `FOCUS_ZOOM` — one dot, closed in on. */
function percent(): number {
  return Number(screen.getByText(/^\d+%$/).textContent!.replace('%', ''))
}

/** A dot on the sheet. Its accessible name is `id — label (site). how well it is known`. */
function dot(name: RegExp) {
  return screen.getByRole('button', { name })
}

/** Give `CR-BP` the two sites a relay drawn twice has, and leave the second one armed. On the
 * `All` filter, because a placed component is no longer in `To do` and these tests go back to
 * its row afterwards. */
function twoSites() {
  fireEvent.click(screen.getByRole('button', { name: 'All' }))
  fireEvent.click(row('CR-BP'))
  clickSheet(300, 200)
  fireEvent.click(screen.getByRole('button', { name: 'Another site' }))
  clickSheet(500, 400)
}

describe('LocateTab', () => {
  it('is behind its own password, and says why', async () => {
    stubServer({ unlockOk: false })
    render(<LocateTab />)

    expect(screen.getByText(/locate editor is locked/i)).toBeTruthy()
    // No list, no tiles, and — the part that matters — the file has not been asked for. The
    // sheet's container *is* mounted underneath, because a container that appears after the
    // viewport hook is a container that is never measured; the gate covers it instead.
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(calls()).not.toContain('/api/locations')

    fireEvent.change(screen.getByLabelText('Editor password'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => expect(screen.getByText(/not the editor password/i)).toBeTruthy())
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(calls()).not.toContain('/api/locations')
  })

  it('offers no tab at all on a server that does not allow edits', () => {
    // Not a locked tab — an absent one. With `allow_edits` false the routes are never
    // registered, so a Locate tab there would be a screen that cannot save.
    const ids = (editingEnabled: boolean) =>
      enabledTabs({ drawingAvailable: true, tilesAvailable: true, editingEnabled }).map((t) => t.id)
    expect(ids(true)).toContain(LOCATE_TAB_ID)
    expect(ids(false)).not.toContain(LOCATE_TAB_ID)
  })

  it('lists the work, and does not count wire labels as work', async () => {
    await open()

    // The default filter is what is left to do: two terminals and one component, and the wire
    // is not among them because its route is already its endpoints'.
    expect(row('CR-BP')).toBeTruthy()
    expect(screen.queryByRole('option', { name: /^W047/ })).toBeNull()
    expect(screen.getByText(/0 of 3 placed/)).toBeTruthy()
    // Reported on its own, and never inside the "to do" number.
    expect(screen.getByText(/0 of 1 wire and net labels/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Wire & net labels' }))
    expect(screen.getByRole('option', { name: /^W047/ }).textContent).toContain(
      'route from its terminals',
    )
  })

  it('places where a wire’s name is written, and refuses to place the wire itself', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wire & net labels' }))
    fireEvent.click(row('W047'))

    // The panel has to say this out loud, because a list row called "W047" invites someone to
    // try to place the run — and a line drawn where no conductor goes is an invented route.
    expect(screen.getByText(/never will be/)).toBeTruthy()

    clickSheet(400, 300)

    const document = useLocateStore.getState().document!
    expect(document.wires).toEqual({
      W047: { label_point: [612, 396], source: 'human', by: 'js', at: expect.any(String) },
    })
    // Nothing that could be read as geometry: no `point`, and the terminals are untouched.
    expect(document.wires!.W047).not.toHaveProperty('point')
    expect(document.terminals).toEqual({})
    // And placing a label does not throw you into an unrelated run of terminals.
    expect(useLocateStore.getState().target).toEqual({ id: 'W047', site: null, label: true })
    expect(screen.getByText(/1 of 1 wire and net labels/)).toBeTruthy()
  })

  it('lists everything in alphabetical order, and that is the order the advance walks', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'All' }))

    // The index arrives grouped by kind, which is the order the extraction happened to walk: the
    // component, then its pins in netlist order, then the wires. By id a component and its pins
    // arrive together, because a terminal's id *is* its parent's plus its pin.
    expect(ids()).toEqual(['CR-BP', 'CR-BP:11', 'CR-BP:A1', 'W047'])
  })

  it('leaves the advance off until it is asked for', async () => {
    // Off in the store itself, not merely in this suite's setup: the advance is the one control
    // that moves the target without being asked, and someone meeting the screen for the first
    // time reads that as having lost their place.
    expect(useLocateStore.getInitialState().advance).toBe(false)
    await open()
    expect(advance().checked).toBe(false)
  })

  it('places the picked row where the sheet was clicked, then moves to the next', async () => {
    await open()
    fireEvent.click(advance())
    fireEvent.click(row('CR-BP'))

    // (400, 300) in the container. Fit is 776/1224 = 0.63399 px/pt at origin (12, 48.94), so
    // this is (612, 396) on the sheet. If the editor derived its own projection instead of
    // reusing `paint.ts`, this is the number that would be wrong — and nothing on screen
    // would say so.
    clickSheet(400, 300)

    const document = useLocateStore.getState().document!
    expect(document.components['CR-BP'].sites[0]).toMatchObject({
      id: 'main',
      point: [612, 396],
      source: 'human',
      by: 'js',
    })
    // Placed, so the run moves on rather than making the user choose what to do next — and it
    // moves to the next row *down the list as displayed*, which is alphabetical, so `:11` and not
    // the `:A1` that happened to come first out of the extraction.
    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP:11', site: null })
    expect(screen.getByText(/1 of 3 placed/)).toBeTruthy()
  })

  it('stays put while the advance is off, for correcting one dot', async () => {
    await open()
    fireEvent.click(row('CR-BP'))
    clickSheet(400, 300)
    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP', site: 'main' })
  })

  it('refuses to place when the sheet moved under the press', async () => {
    // The hazard: a target is armed, the user drags the sheet to look somewhere else, and the
    // trailing click plants a coordinate where they happened to let go. A placement is a click
    // that did not move the sheet, so panning between press and release cancels it — asserted
    // here through the keyboard, because jsdom has no `PointerEvent` and so no drag that
    // carries coordinates. What is pinned is the mechanism, not the gesture.
    await open()
    fireEvent.click(row('CR-BP'))

    fireEvent.pointerDown(sheet(), { pointerId: 1, button: 0 })
    fireEvent.keyDown(sheet(), { key: 'ArrowRight' })
    fireEvent.pointerUp(sheet(), { pointerId: 1 })
    fireEvent.click(sheet(), { clientX: 400, clientY: 300 })

    expect(useLocateStore.getState().document!.components).toEqual({})
  })

  it('gives Escape back the empty screen it started with', async () => {
    // Armed is a mode, and it is the mode where a click writes into an authored file. Before
    // this the only exit from it was into another one — picking a different row — so somebody
    // who had finished placing and just wanted to look at the sheet kept a crosshair and a live
    // target for the rest of the session.
    await open()
    fireEvent.click(row('CR-BP'))
    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP', site: 'main' })
    expect(sheet().className).toContain('cursor-crosshair')

    // On `window`, because what you are escaping from was armed in the *list* and the sheet does
    // not have focus then.
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(useLocateStore.getState().target).toBeNull()
    expect(screen.queryByRole('option', { selected: true })).toBeNull()
    // The hand is back, and — the part that matters — a click is a click again.
    expect(sheet().className).toContain('cursor-grab')
    clickSheet(400, 300)
    expect(useLocateStore.getState().document!.components).toEqual({})
  })

  it('offers the same way out as a button, because a key nobody knows about is not a way out', async () => {
    await open()
    fireEvent.click(row('CR-BP'))
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))

    expect(useLocateStore.getState().target).toBeNull()
    // The panel is the visible evidence that something is armed, so it goes with the target.
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull()
  })

  it('lets a text field have the first Escape, so half a typed name is not lost', async () => {
    await open()
    fireEvent.click(row('CR-BP'))
    clickSheet(400, 300)

    const name = screen.getByLabelText('Name of site main') as HTMLInputElement
    name.focus()
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(globalThis.document.activeElement).not.toBe(name)
    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP', site: 'main' })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useLocateStore.getState().target).toBeNull()
  })

  it('takes a whole word into the site name without losing focus', async () => {
    // The fault this pins: the box used to rename the site on every keystroke, which changed
    // `site.id` — the row's React key — and unmounted the input from under the caret, so a person
    // got one character per trip to the mouse. The intermediate names are also ones `renameSite`
    // would refuse, so nothing may be written until the name is finished.
    await open()
    fireEvent.click(row('CR-BP'))
    clickSheet(400, 300)

    const name = screen.getByLabelText('Name of site main') as HTMLInputElement
    name.focus()
    for (const value of ['mai', 'ma', 'm', '', 'c', 'co', 'coi', 'coil']) {
      fireEvent.change(name, { target: { value } })
      expect(globalThis.document.activeElement).toBe(name)
      expect(name.value).toBe(value)
    }
    const sites = () => useLocateStore.getState().document!.components['CR-BP'].sites
    expect(sites()[0].id).toBe('main')

    fireEvent.keyDown(name, { key: 'Enter' })
    fireEvent.blur(name)

    expect(sites()).toHaveLength(1)
    expect(sites()[0].id).toBe('coil')
    // The target has to follow the rename, or the next click on the sheet would write a *second*
    // site under the old name.
    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP', site: 'coil' })
  })

  it('keeps a refused site name on screen with its reason, rather than snapping back', async () => {
    await open()
    fireEvent.click(row('CR-BP'))
    clickSheet(400, 300)
    fireEvent.click(screen.getByRole('button', { name: 'Another site' }))
    clickSheet(500, 300)

    const second = screen.getByLabelText('Name of site site-2') as HTMLInputElement
    fireEvent.change(second, { target: { value: 'main' } })
    fireEvent.blur(second)

    // Two sites called `main` is not a document the server would accept, so the rename does not
    // happen — but what the user typed stays on screen to be corrected, and says why. A value
    // somebody typed and the editor discarded in silence is the worst outcome available here.
    expect(second.value).toBe('main')
    expect(screen.getByText(/already has a site called main/)).toBeTruthy()
    const sites = useLocateStore.getState().document!.components['CR-BP'].sites
    expect(sites.map((site) => site.id)).toEqual(['main', 'site-2'])

    // And Escape is the way to give it up, which puts the stored name back.
    fireEvent.keyDown(second, { key: 'Escape' })
    expect(second.value).toBe('site-2')
  })

  it('makes its dots draggable, unlike the read-only viewer', async () => {
    // Drag is `MarkerLayer`'s `onDragPoint`, and the property that matters at this seam is which
    // tab passes it: a stray drag on the Drawing tab must pan the sheet, never edit the file.
    // The gesture's arithmetic is `cssToPoint` and is tested in `paint.test.ts`; the gesture
    // itself needs a browser, as every other gesture in this project does.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Components' }))
    expect(screen.getByRole('button', { name: /^CR-BP — relay/ }).className).toContain(
      'cursor-move',
    )
  })

  it('writes the whole file, and only when something changed', async () => {
    await open()
    expect(saved).toHaveLength(0)

    fireEvent.click(row('CR-BP'))
    clickSheet(400, 300)
    await act(async () => {
      await useLocateStore.getState().save()
    })

    expect(saved).toHaveLength(1)
    // Whole-file: the editor holds the document it loaded and sends it back, so there is no
    // patch protocol to get wrong. Everything the loader gave it survives the round trip.
    expect(saved[0]).toMatchObject({
      drawing_number: 'PS20115MLM4-2',
      schema: 1,
      page_size_pt: [1224, 792],
      terminals: {},
    })
    expect((saved[0].components as Record<string, unknown>)['CR-BP']).toBeTruthy()
  })

  it('says that circuit_logic.json is behind, rather than re-running Python itself', async () => {
    await open()
    fireEvent.click(row('CR-BP'))
    clickSheet(400, 300)
    await act(async () => {
      await useLocateStore.getState().save()
    })

    // The viewer is current the moment the write lands; the artifact the model reads is not,
    // and re-running the generator is a human's job at a terminal.
    expect(screen.getByText(/circuit_logic\.json is behind/)).toBeTruthy()
  })

  it('scrolls the list to the row a dot on the sheet just armed', async () => {
    // The row was already being highlighted; it was being highlighted somewhere off screen. On
    // 275 rows that left the user scrolling the list to find the row the editor had chosen for
    // them, which is the searching this screen exists to remove.
    await open()
    scrolled.mockClear()
    fireEvent.click(dot(/^CR-BP:11 — common terminal/))

    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP:11', site: null })
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' })
    // On the armed row itself, and `nearest` so a row already in view does not move.
    const row = scrolled.mock.instances.at(-1) as HTMLElement
    expect(row.textContent).toContain('CR-BP:11')
  })

  it('arms the dot that was clicked, not the row’s first one', async () => {
    // `CR-BP` is drawn three times on the real sheet. Clicking its NO contact used to arm the
    // *coil* — whichever site was created first — and fly there, so somebody who clicked a dot in
    // order to move it was dropped somewhere else entirely and had to drag the sheet back.
    landsAtOnce()
    await open()
    twoSites()
    fireEvent.click(row('CR-BP'))
    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP', site: 'main' })

    fireEvent.click(dot(/^CR-BP — relay.*\(site-2\)/))

    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP', site: 'site-2' })
    // And the sheet closed in on the dot under the pointer rather than going to the other one.
    expect(percent()).toBe(50)
  })

  it('shows the whole sheet for a row that is drawn in more than one place', async () => {
    landsAtOnce()
    await open()
    twoSites()

    fireEvent.click(row('CR-BP'))

    // 9%: the whole 1224×792 sheet in an 800×600 container, at the padding a flight uses. Flying
    // to one of a relay's three sites says nothing about the other two — it looks exactly like a
    // component drawn once, which is the misreading that matters most on this screen.
    expect(percent()).toBe(9)
    // A row drawn in one place is still framed on it, at FOCUS_ZOOM.
    fireEvent.click(row('CR-BP:11'))
    expect(percent()).toBe(50)
  })

  it('takes the sheet to the site whose button was pressed, including the armed one', async () => {
    landsAtOnce()
    await open()
    twoSites()
    fireEvent.click(row('CR-BP'))
    expect(percent()).toBe(9)

    // The site rows are the only thing on screen that names one site of several, so the button
    // that aims the next click is also the way to go and look at it.
    fireEvent.click(screen.getByRole('button', { name: 'place' }))
    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP', site: 'site-2' })
    expect(percent()).toBe(50)

    // And pressing it again on the site already armed — the one that says "placing" — flies back
    // to it. That is index K1: the fly used to be keyed on the row's id, so asking for the same
    // one twice was silent, and after panning away there was no way back.
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }))
    expect(percent()).toBe(11)
    fireEvent.click(screen.getByRole('button', { name: 'placing' }))
    expect(percent()).toBe(50)
  })

  // Not tested here: that dragging a dot leaves the sheet where it is. Dragging retargets, and
  // while the flight was keyed on the target's id that meant dragging a dot belonging to some
  // other row flew the sheet out from under the gesture. It is fixed — a drag asks for no
  // flight — but jsdom's pointer events carry no coordinates, so a drag written here reports
  // `NaN` for where it was dropped and would be pinning nothing. Same reason as T-140.

  it('shows every coordinate the server refused', async () => {
    stubServer({
      report: { ...EMPTY_REPORT, problems: ["CR-GHOST is not in circuit_logic.json"] },
    })
    await open()
    // A coordinate a human typed and the server silently ignored is the worst outcome
    // available here, so nothing is refused quietly.
    expect(screen.getByText(/CR-GHOST is not in circuit_logic\.json/)).toBeTruthy()
  })
})
