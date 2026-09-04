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

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  /**
   * A wire with **two ends and something printed on it**, which is what an end label needs.
   *
   * `spec` is what the label says: `W047` is an id the extraction invented and is printed nowhere,
   * so a label reading it would name something the reader cannot find. The two member points are
   * deliberately different — an end label faces *away from the wire's other end*, and two members
   * on one coordinate would be one dot and so one label.
   */
  { id: 'W047', kind: 'wire', label: 'BLUE 18AWG wire', on_sheet: false, spec: 'BLUE 18AWG',
    members: ['CR-BP'], point: [780, 679], rect: [700, 679, 861, 679],
    terminals: [
      { id: 'CR-BP:A1', point: [861, 679], placement: 'parent' },
      { id: 'CR-BP:11', point: [700, 679], placement: 'parent' },
    ] },
]
const INDEX: DesignatorIndex = {
  drawing_number: 'PS20115MLM4-2',
  counts: { component: 1, terminal: 2, wire: 1 },
  located: 4,
  entries: ENTRIES,
}

/**
 * Three runs of ink, as `/api/conductors` publishes them, and each is a case the ranking has to
 * get right.
 *
 * `C0001` spans **both** of `W047`'s pins — the shape 37 of the real 71 wires are in, and one
 * glance and one click. `C0002` reaches one of them, which is what half a route looks like across
 * a crossover hop. `C0003` carries the same printed net name and is somewhere else entirely.
 */
const CONDUCTORS = {
  counts: { conductors: 3, named: 3 },
  problems: [] as string[],
  conductors: [
    {
      id: 'C0001',
      points: [[700, 679], [861, 679]] as [number, number][],
      ends: [{ point: [700, 679] as [number, number] }, { point: [861, 679] as [number, number] }],
      net_label: '110',
      spec_label: 'BLUE 18AWG',
      color: 'BLUE',
      gauge: '18AWG',
      length: 161,
    },
    {
      id: 'C0002',
      points: [[861, 679], [861, 600]] as [number, number][],
      ends: [{ point: [861, 679] as [number, number] }, { point: [861, 600] as [number, number] }],
      length: 79,
    },
    {
      id: 'C0003',
      points: [[100, 100], [300, 100]] as [number, number][],
      ends: [{ point: [100, 100] as [number, number] }, { point: [300, 100] as [number, number] }],
      net_label: '110',
      spec_label: 'BLUE 18AWG',
      color: 'BLUE',
      gauge: '18AWG',
      length: 200,
    },
  ],
}

/** `W047` is on net `110`, which is the one place that fact is published — see `netOf`. */
const PATHS = { wires: {}, nets: { '110': ['W047'] } }

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

function stubServer(
  options: {
    unlockOk?: boolean
    report?: typeof EMPTY_REPORT
    /** `null` makes `/api/conductors` fail, which is the *the ink did not load* state — the panel
     * must say so and everything else on the screen must go on working. */
    ink?: null
  } = {},
) {
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
      if (url.endsWith('/api/conductors')) {
        return options.ink === null ? json({ detail: 'no ink' }, 404) : json(CONDUCTORS)
      }
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
    paths: PATHS,
    byToken: buildLookup(INDEX),
    activeTabId: LOCATE_TAB_ID,
  })
  // `advance: false` here is the store's own default restated, not a choice this suite is making:
  // the advance is opt-in, and a test that silently arranged for it to be on would be testing a
  // screen nobody is handed.
  useLocateStore.setState({
    document: null, report: null, conductors: null, unlocked: false, loading: false, error: null,
    target: null, advance: false, saveState: 'clean', saveError: null, stale: null,
    undoStack: [], redoStack: [], undoNote: null,
  })
  // Module state `setState` cannot reach: a coalescing run left open by one test would merge
  // into the next one's first edit and hide a missing undo step.
  useLocateStore.getState().endRun()
  stubServer()
})

afterEach(() => {
  for (const name of ['clientWidth', 'clientHeight', 'scrollIntoView'] as const) {
    delete (HTMLElement.prototype as never)[name]
  }
  vi.unstubAllGlobals()
  // Insurance: fake timers left installed by a test that timed out would hang every test after
  // it, because `findBy*` polls on a timer and would never fire again.
  vi.useRealTimers()
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

/**
 * One row of the wire or net panel — the compass for one end.
 *
 * By `data-end` rather than by role, because the *list* rows are `listitem`s too: a `getAllByRole`
 * here would hand back the W047 row from the left-hand list first and quietly assert against the
 * wrong element.
 */
function endRow(terminal: string): HTMLElement {
  const row = document.querySelector(`[data-end="${terminal}"]`)
  if (!row) throw new Error(`no end-label row for ${terminal}`)
  return row as HTMLElement
}

/** The ends the panel is offering, in order. A wire's `[from, to]` order is content. */
function endRows(): string[] {
  return [...document.querySelectorAll('[data-end]')].map(
    (row) => row.getAttribute('data-end') ?? '',
  )
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
    // The wires are counted as things in the index, not as labels waiting to be placed. There is
    // no "0 of 71" here on purpose: every wire end already has a label, so a progress number over
    // them would be `K7` — a count that can never be finished — on four times the scale.
    expect(screen.getByText(/0 of 1 wire paths · 0 nets · 0 end labels moved by hand/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    // Not "route from its terminals" any more: a route is lifted from the sheet's own conductor
    // strokes or traced by a person, and computing one from the two ends is the one thing it may
    // never be.
    expect(screen.getByRole('option', { name: /^W047/ }).textContent).toContain(
      'ends known, no path',
    )
  })

  it('places where a wire’s name is written, and refuses to place the wire itself', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))

    // The panel has to say this out loud, because a list row called "W047" invites someone to
    // try to place the run — and a line drawn where no conductor goes is an invented route.
    expect(screen.getByText(/Nothing counts this as missing/)).toBeTruthy()

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
    // Nor does it move any count: the printed name is a nicety on work that is already complete.
    expect(screen.getByText(/0 end labels moved by hand/)).toBeTruthy()
  })

  /**
   * Session 2's own screen: **a compass per end**, and a file that records only what was changed.
   *
   * The controls are headed with the endpoint terminal ids because *"this end"* is not an answer on
   * a sheet where a wire's two ends can be 600 pt apart — and because a wire's `[from, to]` order
   * is content: swapping them would mislabel both ends of all 71 wires with nothing visible to
   * show it.
   */
  it('gives a wire one compass per end, headed with the pin each one hangs off', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))

    expect(endRows()).toEqual(['CR-BP:A1', 'CR-BP:11'])
    // Nothing has been placed, and both compasses are already live: the anchor is a terminal
    // point that exists, which is why `K4` — the control that does nothing until a point is
    // placed — does not apply to a wire or a net any more.
    expect(useLocateStore.getState().document!.wires).toBeUndefined()
    expect(within(endRow('CR-BP:A1')).getByText('computed')).toBeTruthy()

    fireEvent.click(within(endRow('CR-BP:A1')).getByRole('button', { name: 'Label to the n' }))
    // Only the end that was changed, and only the side: no default written in beside it, and
    // nothing at all for the other end.
    expect(useLocateStore.getState().document!.wires).toEqual({
      W047: { labels: { 'CR-BP:A1': { dir: 'n' } } },
    })
    expect(within(endRow('CR-BP:A1')).getByText('by hand')).toBeTruthy()

    fireEvent.click(
      within(endRow('CR-BP:11')).getByRole('button', { name: 'Label to the sw' }),
    )
    expect(useLocateStore.getState().document!.wires).toEqual({
      W047: { labels: { 'CR-BP:A1': { dir: 'n' }, 'CR-BP:11': { dir: 'sw' } } },
    })
  })

  it('resets an end label by deleting it, not by writing the default in', async () => {
    // The rule the whole file rests on. A default stored as though a human chose it makes
    // `locations.json` stop distinguishing *nobody has looked at this* from *a person decided
    // this* — and that distinction is the only reason this editor exists rather than a guesser.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))

    const end = () => endRow('CR-BP:A1')
    // Nothing to reset until there is an override, so no button offering to.
    expect(
      within(end()).queryByRole('button', { name: /reset the label/i }),
    ).toBeNull()

    fireEvent.click(within(end()).getByRole('button', { name: 'Label to the n' }))
    fireEvent.click(within(end()).getByRole('button', { name: /reset the label/i }))

    // The record went with it: an empty shell in the file is a record that says nothing.
    expect(useLocateStore.getState().document!.wires).toEqual({})
    expect(useLocateStore.getState().undoNote).toBeNull()
    // And it is undoable like every other mutation, in a person's words.
    act(() => useLocateStore.getState().undo())
    expect(useLocateStore.getState().undoNote).toContain('reset')
    expect(useLocateStore.getState().document!.wires).toEqual({
      W047: { labels: { 'CR-BP:A1': { dir: 'n' } } },
    })
  })

  it('hides one end’s label, and takes it off the sheet', async () => {
    landsAtOnce()
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    // A wire with no label point is framed on its run, which for this one is 20% — and all label
    // text is hidden below 30%, so this zooms in the way a person would before checking a side.
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(percent()).toBeGreaterThan(30)

    // Both ends are labelled with what is printed on the wire, at points somebody already placed
    // — and neither of them is in the file.
    const drawn = () =>
      [...sheet().querySelectorAll('[data-end-label]')].map((el) =>
        el.getAttribute('data-end-label'),
      )
    expect(drawn()).toEqual(['W047@CR-BP:A1', 'W047@CR-BP:11'])

    fireEvent.click(
      within(endRow('CR-BP:A1')).getByRole('button', { name: /hide the label/i }),
    )
    expect(useLocateStore.getState().document!.wires).toEqual({
      W047: { labels: { 'CR-BP:A1': { hidden: true } } },
    })
    expect(drawn()).toEqual(['W047@CR-BP:11'])
  })

  it('shows the side in force, including one a collision moved', async () => {
    // The compass must never disagree with the sheet: it is handed the *planned* labels rather
    // than recomputing the rule, so a side that stepped clockwise past the pin's own id label
    // shows as the side that stepped.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))

    // `CR-BP:A1` sits at 861,679 with the run heading west, so its label wants east — where
    // `CR-BP`'s own id and the pin's own id are already written, so it takes the next one
    // clockwise.
    const pressed = within(endRow('CR-BP:A1'))
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Label to the se',
    ])
  })

  it('separates Wires from Nets, because they are different work', async () => {
    await open()
    // One button per kind since 2026-08-24: a wire has two ends and a pair of compasses, a net
    // has up to nine members and a list, and finding one among the other 96 rows was the cost of
    // the merge.
    expect(screen.queryByRole('button', { name: 'Wire & net labels' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    expect(ids()).toEqual(['W047'])

    fireEvent.click(screen.getByRole('button', { name: 'Nets' }))
    expect(screen.getByText(/nothing matches this filter/i)).toBeTruthy()
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
    // patch protocol to get wrong. Everything the loader gave it survives the round trip —
    // **except the schema, which is stamped to the version this editor writes.** That one line is
    // the whole 1 → 2 migration: schema 2 only added a key, so a schema-1 file has nothing to
    // convert, and the upgrade happens the next time anything is saved.
    expect(saved[0]).toMatchObject({
      drawing_number: 'PS20115MLM4-2',
      schema: 2,
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

  it('leaves the sheet alone when it is already closer in than a flight would take it', async () => {
    // Reported after a placement run: picking a row at working magnification threw the sheet back
    // to 50% and re-centred it, which is the flight doing exactly what it was built for — and
    // exactly the wrong thing. Past `FOCUS_ZOOM` you are at a magnification you chose in order to
    // work on one dot: it is on screen, the pointer is beside it, and every flight from there is a
    // zoom *out*. So above the ceiling neither the scale nor the position moves.
    landsAtOnce()
    await open()
    fireEvent.click(row('CR-BP:11'))
    expect(percent()).toBe(50)

    // 50% × 1.4 = 70%: the first zoom past the ceiling rather than at it.
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(percent()).toBe(70)
    // Panned off centre, so "the sheet did not move" is a claim about the position as well as the
    // scale: a flight re-centres, which in an 800 px container means the dot at 400 px.
    fireEvent.keyDown(sheet(), { key: 'ArrowRight' })
    const off = dot(/^CR-BP:11 — common terminal/).style.left
    expect(off).not.toBe('400px')

    fireEvent.click(row('CR-BP:A1'))

    // Armed, and the panel followed — the row was picked, only the sheet stayed put.
    expect(useLocateStore.getState().target).toEqual({ id: 'CR-BP:A1', site: null })
    expect(percent()).toBe(70)
    expect(dot(/^CR-BP:11 — common terminal/).style.left).toBe(off)

    // And at the ceiling exactly a flight is still a flight — this is a rule about being closer
    // in than 50%, not about being at it.
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }))
    expect(percent()).toBe(11)
    fireEvent.click(row('CR-BP:11'))
    expect(percent()).toBe(50)
    fireEvent.keyDown(sheet(), { key: 'ArrowRight' })
    fireEvent.click(row('CR-BP:A1'))
    expect(percent()).toBe(50)
    expect(dot(/^CR-BP:A1 — coil terminal/).style.left).toBe('400px')
  })

  // Not tested here: that dragging a dot leaves the sheet where it is. Dragging retargets, and
  // while the flight was keyed on the target's id that meant dragging a dot belonging to some
  // other row flew the sheet out from under the gesture. It is fixed — a drag asks for no
  // flight — but jsdom's pointer events carry no coordinates, so a drag written here reports
  // `NaN` for where it was dropped and would be pinning nothing. Same reason as T-140.

  /**
   * The keyboard, which is the cure for the accident that started all this: a dot moved a tenth
   * of a point by a drag that ended near where it began, and the coordinate it replaced was gone.
   *
   * Two halves, and they have to be tested together. Undo covers the accident. The nudge makes a
   * small move something you can do **on purpose**, exactly, without a mouse — which is why a
   * minimum-drag threshold was rejected rather than added: on this sheet a 0.1 pt correction and
   * a twitch are the same gesture, and refusing an intention is worse than allowing an accident
   * you can take back.
   */
  it('nudges the armed point a whole point, and a tenth of one with Alt', async () => {
    await open()
    fireEvent.click(row('CR-BP:A1'))
    clickSheet(400, 300)
    const point = () => useLocateStore.getState().document!.terminals['CR-BP:A1'].point

    expect(point()).toEqual([612, 396])
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true })
    expect(point()).toEqual([613, 396])
    fireEvent.keyDown(window, { key: 'ArrowUp', shiftKey: true })
    expect(point()).toEqual([613, 395])
    // A tenth is exactly the precision `locations.json` records, so this is the finest thing the
    // file can say — and the rounding must not turn it into 395.09999999999997 either.
    fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true, altKey: true })
    expect(point()).toEqual([613, 395.1])
    fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true, altKey: true })
    expect(point()).toEqual([612.9, 395.1])
  })

  it('nudges by the same number of points at any zoom', async () => {
    // The reason the step is in points and not pixels. A correction that is 1 pt at fit zoom and
    // a quarter of that at 400% would be a control you cannot form a habit with.
    await open()
    fireEvent.click(row('CR-BP:A1'))
    clickSheet(400, 300)
    const point = () => useLocateStore.getState().document!.terminals['CR-BP:A1'].point

    expect(percent()).toBe(11)
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true })
    expect(point()).toEqual([613, 396])

    // Eight times the magnification — a step measured in CSS pixels would be an eighth of the
    // correction here, and there is nothing on screen that would tell you.
    for (let n = 0; n < 6; n += 1) fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(percent()).toBeGreaterThan(80)
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true })
    expect(point()).toEqual([614, 396])
  })

  it('does not pan the sheet while nudging, and still zooms with Shift and +', async () => {
    // The other half of the modifier decision, and it lives in `useTileViewport`: the sheet's own
    // key handler declines a *modified* arrow, or a nudge would move the dot 1 pt while the sheet
    // slid 60 px underneath it and the correction would be invisible. The guard is narrowed to
    // the arrows on purpose — `+` needs Shift on most keyboards, and a blanket `shiftKey` guard
    // there would quietly stop zooming in.
    await open()
    fireEvent.click(row('CR-BP:A1'))
    clickSheet(400, 300)
    const at = () => parseFloat(dot(/^CR-BP:A1 — coil terminal/).style.left)
    const before = at()

    fireEvent.keyDown(sheet(), { key: 'ArrowRight', shiftKey: true })
    // 1 pt at the fit scale of 0.634 px/pt, rounded to a device pixel. A pan would be 60.
    expect(Math.abs(at() - before)).toBeLessThan(5)

    const zoom = percent()
    fireEvent.keyDown(sheet(), { key: '+', shiftKey: true })
    expect(percent()).toBeGreaterThan(zoom)
  })

  it('leaves a bare arrow panning the sheet, and moves no point with it', async () => {
    // Deliberately *not* "bare arrows nudge whatever is armed". The moment you are working on a
    // dot is exactly the moment you also want to pan, and a key that silently means two things
    // depending on hidden state is worse than a modifier.
    await open()
    fireEvent.click(row('CR-BP:A1'))
    clickSheet(400, 300)
    const before = dot(/^CR-BP:A1 — coil terminal/).style.left

    fireEvent.keyDown(sheet(), { key: 'ArrowRight' })
    expect(useLocateStore.getState().document!.terminals['CR-BP:A1'].point).toEqual([612, 396])
    // The sheet moved, so the dot is drawn somewhere else while sitting at the same coordinate.
    expect(dot(/^CR-BP:A1 — coil terminal/).style.left).not.toBe(before)
  })

  it('will not nudge something into existence', async () => {
    await open()
    // Nothing armed at all.
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true })
    expect(useLocateStore.getState().document!.terminals).toEqual({})

    // Armed, and drawn on its parent component — resolvable on screen, and still not a point
    // anybody placed. Nudging it would turn the indexing pass's estimate into a human's
    // confirmation of a coordinate 1 pt from it. Placing is a click and stays a click.
    fireEvent.click(row('CR-BP:A1'))
    expect(dot(/^CR-BP:A1 — coil terminal/)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true })
    expect(useLocateStore.getState().document!.terminals).toEqual({})
  })

  it('takes a run of ten nudges back in one Ctrl+Z, and saves the result', async () => {
    await open()
    fireEvent.click(row('CR-BP:A1'))
    clickSheet(400, 300)
    const point = () => useLocateStore.getState().document!.terminals['CR-BP:A1'].point

    for (let n = 0; n < 10; n += 1) {
      fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true, altKey: true })
    }
    expect(point()).toEqual([612, 397])
    // A nudge is a mutation and schedules a write like any other.
    expect(useLocateStore.getState().saveState).toBe('pending')
    await act(async () => {
      await useLocateStore.getState().save()
    })
    expect(
      (saved.at(-1) as { terminals: Record<string, { point: number[] }> }).terminals['CR-BP:A1']
        .point,
    ).toEqual([612, 397])

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    // The start of the run, not the ninth press. Ten undos to walk back one gesture is the
    // thing that makes an undo stack useless.
    expect(point()).toEqual([612, 396])
    expect(screen.getByText('undid: nudged CR-BP:A1')).toBeTruthy()

    // Forced rather than waited for — the debounce is tested elsewhere; what matters here is
    // that an undo goes down the same write path, because an undo that does not persist is a
    // lie the moment the page reloads.
    await act(async () => {
      await useLocateStore.getState().save()
    })
    const last = saved.at(-1) as { terminals: Record<string, { point: number[] }> }
    expect(last.terminals['CR-BP:A1'].point).toEqual([612, 396])
  })

  it('gives Ctrl+Z to the site-name box when the caret is in it', async () => {
    // A `window` listener sees every keystroke in the application, including the ones being
    // typed into a box. Undoing a *dot* because somebody pressed Ctrl+Z while renaming a site
    // is the worst version of this feature.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    fireEvent.click(row('CR-BP'))
    clickSheet(400, 300)
    const box = screen.getByLabelText('Name of site main')

    fireEvent.keyDown(box, { key: 'z', ctrlKey: true })
    expect(useLocateStore.getState().document!.components['CR-BP'].sites).toHaveLength(1)
    expect(useLocateStore.getState().undoNote).toBeNull()
  })

  it('leaves the zoom and the list filter exactly where they were', async () => {
    // Undo covers document mutations and nothing else. An undo that also walked back the view
    // or the filter would interleave with them, and then nobody can predict what the key does.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Terminals' }))
    fireEvent.click(row('CR-BP:A1'))
    clickSheet(400, 300)
    const zoom = percent()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(useLocateStore.getState().document!.terminals).toEqual({})
    expect(percent()).toBe(zoom)
    expect(screen.getByRole('button', { name: 'Terminals' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    // Redo puts it back, and says so.
    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(useLocateStore.getState().document!.terminals['CR-BP:A1'].point).toEqual([612, 396])
    expect(screen.getByText('redid: placed CR-BP:A1')).toBeTruthy()
  })

  it('ignores the keys while the Drawing tab has the screen', async () => {
    // Hazard H10: both tabs are `keepMounted`, so the `activeTabId` guard is the only thing
    // stopping a keystroke meant for the reader's side from mutating an authored file. This is
    // now the third `window` key listener in the application.
    await open()
    fireEvent.click(row('CR-BP:A1'))
    clickSheet(400, 300)
    act(() => useAppStore.setState({ activeTabId: 'drawing' }))

    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true })
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(useLocateStore.getState().document!.terminals['CR-BP:A1'].point).toEqual([612, 396])
  })

  /**
   * Phase G's second trigger, and the smallest thing in Session 5: arming a wire lights whatever
   * somebody has traced for it.
   *
   * Off the **armed target** rather than off the Drawing tab's selection — the two screens keep
   * their own idea of what you are looking at, deliberately (`H10`) — but through the same
   * `pathsFor`, so the two can never come to disagree about what a net is made of. The canvas
   * cannot be read in jsdom, so what is asserted is the runs that reached the sheet.
   */
  it('highlights the armed wire’s traced run along the ink', async () => {
    useAppStore.setState({
      paths: {
        wires: {
          W047: {
            runs: [
              [
                [700, 679],
                [861, 679],
              ],
            ],
            geometry: 'extracted',
            attribution: 'human',
            conductors: ['C0080'],
          },
        },
        nets: { '110': ['W047'] },
      },
    })
    await open()
    const runs = () => Number(sheet().querySelector('canvas')?.dataset.runs ?? -1)
    expect(runs()).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    await waitFor(() => expect(runs()).toBe(1))

    // Arming something with no route puts the sheet back to plain ink — one at a time, and a
    // terminal has no route to draw.
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    fireEvent.click(row('CR-BP:A1'))
    await waitFor(() => expect(runs()).toBe(0))
  })

  it('shows every coordinate the server refused', async () => {
    stubServer({
      report: { ...EMPTY_REPORT, problems: ["CR-GHOST is not in circuit_logic.json"] },
    })
    await open()
    // A coordinate a human typed and the server silently ignored is the worst outcome
    // available here, so nothing is refused quietly.
    expect(screen.getByText(/CR-GHOST is not in circuit_logic\.json/)).toBeTruthy()
  })

  // -- Phase E: where the wire runs ---------------------------------------------------------

  it('offers the ranked runs of ink for an armed wire, best first', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    const list = await screen.findByRole('list', { name: 'Candidate runs for W047' })
    // `C0001` spans both of this wire's pins; `C0002` reaches one; `C0003` carries the same
    // printed net name and is 700 pt away. **The geometry outranks the name**, which is the whole
    // order — the second piece of a real route routinely carries no printed name at all.
    expect([...list.querySelectorAll('[data-candidate]')].map((li) =>
      li.getAttribute('data-candidate'),
    )).toEqual(['C0001', 'C0002', 'C0003'])
    expect(within(list).getByText('both ends')).toBeTruthy()
  })

  it('lights one candidate on the sheet while the pointer is over it', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    const candidates = () =>
      Number(sheet().querySelector('canvas')?.dataset.candidates ?? -1)
    await waitFor(() => expect(candidates()).toBe(0))

    const row1 = document.querySelector('[data-candidate="C0001"] button') as HTMLElement
    fireEvent.mouseEnter(row1)
    // A proposal, painted in its own colour under the accepted stripe: a person is comparing it
    // against the ink underneath, and a proposal that looked like a decision on a 16 pt pitch is
    // how the wrong conductor gets accepted.
    await waitFor(() => expect(candidates()).toBe(1))
    fireEvent.mouseLeave(row1)
    await waitFor(() => expect(candidates()).toBe(0))
  })

  it('writes path.runs and its conductor, and nothing that looks like a point', async () => {
    /**
     * **The assertion §10 of the plan asks for by name.** A `point` on a wire would be a route
     * synthesised from the centre of a bounding box, which is usually blank paper, and the
     * netlist's authority rests on never having invented one. `derived` is refused by name at both
     * ends and must not appear anywhere in the document either.
     */
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    fireEvent.click(document.querySelector('[data-candidate="C0001"] button') as HTMLElement)

    await waitFor(() => expect(saved).toHaveLength(1))
    const record = (saved[0].wires as Record<string, Record<string, unknown>>).W047
    expect(record.path).toMatchObject({
      runs: [[[700, 679], [861, 679]]],
      geometry: 'extracted',
      attribution: 'human',
      conductors: ['C0001'],
      by: 'js',
    })
    expect(record).not.toHaveProperty('point')
    expect(JSON.stringify(saved[0])).not.toContain('derived')
    // And a single candidate still needed a click. There is no *accept all* and no auto-accept
    // for an exact match: at 16 pt row spacing a confident proposal one row out is a different
    // circuit, and it looks right.
    expect(screen.queryByRole('button', { name: /accept all/i })).toBeNull()
  })

  it('paints the accepted route immediately, before the save has landed', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    const runs = () => Number(sheet().querySelector('canvas')?.dataset.runs ?? -1)
    await waitFor(() => expect(runs()).toBe(0))
    fireEvent.click(document.querySelector('[data-candidate="C0001"] button') as HTMLElement)
    // Off the **draft**, not off `/api/paths`: a highlight that waited 900 ms for the debounce
    // would make every acceptance feel like it had not registered.
    await waitFor(() => expect(runs()).toBe(1))
  })

  it('assembles a route across a crossover hop from two runs, and keeps the gap', async () => {
    // `runs` is a list because the gap is real: where a horizontal run crosses a vertical trunk
    // the drawing puts a hop arc meaning *no connection*, and this sheet has 88 of them.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    fireEvent.click(document.querySelector('[data-candidate="C0001"] button') as HTMLElement)
    await waitFor(() => expect(saved).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: /Add a run/ }))
    fireEvent.click(document.querySelector('[data-add-run="C0002"] button') as HTMLElement)
    await waitFor(() => {
      const record = (saved[saved.length - 1].wires as Record<string, Record<string, unknown>>).W047
      expect((record.path as { runs: unknown[] }).runs).toHaveLength(2)
      expect((record.path as { conductors: string[] }).conductors).toEqual(['C0001', 'C0002'])
    })
  })

  it('will not let a lifted run be dragged until it has been made hand-drawn', async () => {
    /**
     * **The price of moving a corner, and it is stated on screen before it is paid.**
     * `geometry: extracted` is a claim about the polyline — *these corners are the drawing's, not
     * mine* — and a dragged vertex would leave that claim standing over an altered line. Same
     * class of lie as storing a computed label side as though somebody had chosen it.
     */
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    fireEvent.click(document.querySelector('[data-candidate="C0001"] button') as HTMLElement)
    await waitFor(() => expect(saved).toHaveLength(1))

    expect(screen.getByText('from the ink')).toBeTruthy()
    expect(document.querySelector('[data-path-handle]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Make it editable/ }))
    await waitFor(() => expect(screen.getByText('hand-drawn')).toBeTruthy())
    // Now there are corners to drag — one per vertex — and the conductor id has gone with the
    // claim, because the run is no longer the run it was lifted from.
    expect(document.querySelectorAll('[data-path-handle]')).toHaveLength(2)
    await waitFor(() => {
      const record = (saved[saved.length - 1].wires as Record<string, Record<string, unknown>>).W047
      expect(record.path).not.toHaveProperty('conductors')
      expect((record.path as { geometry: string }).geometry).toBe('human')
    })
  })

  it('traces a route by hand with all four keys, and writes nothing until Enter', async () => {
    landsAtOnce()
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    fireEvent.click(screen.getByRole('button', { name: /Trace by hand/ }))
    expect(document.querySelector('[data-tracing]')).toBeTruthy()

    clickSheet(100, 100)
    clickSheet(200, 100)
    clickSheet(200, 200)
    expect(screen.getByText(/3 corners so far/)).toBeTruthy()
    // Backspace takes one back, and nothing has been written yet — the file is untouched until
    // Enter, which is what makes Esc safe to press.
    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(screen.getByText(/2 corners so far/)).toBeTruthy()
    expect(saved).toHaveLength(0)

    fireEvent.keyDown(window, { key: 'Enter' })
    await waitFor(() => expect(saved).toHaveLength(1))
    const record = (saved[0].wires as Record<string, Record<string, unknown>>).W047
    expect(record.path).toMatchObject({ geometry: 'human', attribution: 'human' })
    // No conductor named, and that absence **is** the record: there was no run to lift.
    expect(record.path).not.toHaveProperty('conductors')
    expect(((record.path as { runs: number[][][] }).runs)[0]).toHaveLength(2)
  })

  it('abandons a trace on Escape and leaves the wire armed', async () => {
    /**
     * Two things want this key and the order is not arbitrary: a half-drawn route is the more
     * recent, more fragile thing, and one press taking away both it *and* the armed row would mean
     * losing your place as the price of abandoning a line. So the first Escape drops the corners;
     * the second disarms.
     */
    landsAtOnce()
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    fireEvent.click(screen.getByRole('button', { name: /Trace by hand/ }))
    clickSheet(100, 100)
    clickSheet(200, 100)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('[data-tracing]')).toBeNull()
    expect(saved).toHaveLength(0)
    // Still armed: the panel is still showing W047.
    expect(document.querySelector('[data-path-panel="W047"]')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('[data-path-panel="W047"]')).toBeNull()
  })

  it('counts the wires dealt with, and lets *no path here* finish the count', async () => {
    /**
     * **The `K7` defence, demonstrated.** Some wires run to a connector whose other end is on
     * another drawing, so a count of only the traced ones could never reach its own total — and a
     * progress number that stops short for a reason nobody can act on is worse than no number.
     * This screen made that mistake once already, with the six `nowhere` rows in *To do*.
     */
    await open()
    expect(screen.getByText(/0 of 1 wire paths/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Paths' }))
    expect(ids()).toEqual(['W047'])

    fireEvent.click(row('W047'))
    fireEvent.click(screen.getByRole('button', { name: /No path on this sheet/ }))
    await waitFor(() => expect(screen.getByText(/1 of 1 wire paths/)).toBeTruthy())
    // And the queue is empty, which is the point: this one can reach zero.
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    await waitFor(() => expect(saved).toHaveLength(1))
    const record = (saved[0].wires as Record<string, Record<string, unknown>>).W047
    expect(record).toEqual({ no_path_on_this_sheet: true })
  })

  it('never writes `no_path_on_this_sheet: false`, and deletes it instead', async () => {
    // Invariant 10 in a fourth set of clothes, and the server refuses `false` by name from the
    // other side. A file that cannot tell *nobody has looked* from *somebody decided* has stopped
    // being a record of who said what.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    fireEvent.click(screen.getByRole('button', { name: /No path on this sheet/ }))
    await waitFor(() => expect(saved).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: /No path on this sheet/ }))
    await waitFor(() => expect(saved).toHaveLength(2))
    expect(JSON.stringify(saved[1])).not.toContain('no_path_on_this_sheet')
  })

  it('says the ink did not load rather than offering nothing without explanation', async () => {
    // The panel loses its candidates and the screen loses nothing else: `Trace` still works and
    // every point is still placeable. A 32 KB read of `geometry.json` must not be able to stop
    // somebody placing a terminal.
    stubServer({ ink: null })
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    expect(await screen.findByText(/extracted ink did not load/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Trace by hand/ })).toBeTruthy()
  })

  it('offers no path controls on a net, which stores none of its own', async () => {
    // A net's highlight is the union of its wires' routes, so there is nothing on it to author —
    // and the server refuses a path under `nets` by name for the same reason.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    fireEvent.click(row('W047'))
    expect(document.querySelector('[data-path-panel="W047"]')).toBeTruthy()
    fireEvent.click(row('CR-BP:A1'))
    expect(document.querySelector('[data-path-panel]')).toBeNull()
  })

  it('shows the route’s length beside the straight line it is not', async () => {
    // Published only to be compared against, and never drawn: `W068`'s chord is 312 pt across the
    // middle of the sheet while its ink is 644 pt the long way round.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    fireEvent.click(row('W047'))
    fireEvent.click(document.querySelector('[data-candidate="C0001"] button') as HTMLElement)
    const note = await screen.findByText(/pt of ink/)
    // 161 pt of ink along `C0001`, against the 161 pt straight line between `W047`'s two pins —
    // they agree here because this fixture's run *is* horizontal between them. On the real sheet
    // `W068` is 644 pt of ink against a 312 pt chord, and that difference is the argument.
    expect(note.closest('p')?.textContent).toContain('161')
    expect(note.closest('p')?.textContent).toContain('chord')
  })
})

