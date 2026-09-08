/**
 * The wiring editor, end to end against a stubbed server — the queue, the two end slots, the
 * ink's proposal, and the button that changes nothing.
 *
 * ### Why this renders the whole `LocateTab`
 *
 * Because the panel is only half of the feature. The queue and its count are the tab's, the sheet
 * click that fills an armed slot is the tab's, and the `Escape` escalation is a `window` listener
 * the tab owns. Testing the panel alone would have left the three seams where an endpoint can be
 * written by accident untested, and those are the only places this can hurt anybody.
 *
 * ### Its own index, and that is deliberate
 *
 * `LocateTab.test.tsx` has a fixture whose two pins are `placement: 'parent'` — drawn on their
 * component's dot because nobody has placed them. A landing rule that discriminates at **4 pt**
 * has no business being handed a coordinate nobody chose, so this suite brings seven confirmed
 * terminals and three wires shaped like the three cases the census found:
 *
 *     W045   CR1:A2 → TB-0V:2      the ink says `TB-0V:1` — the eleven's shape
 *     W042   PB2:3  → TB-0V:6      the ink stops short — right in the data, wrong on the paper
 *     W019   PS1:-2 → TB-GND-B:2   two nets, and that is the finding rather than an error
 *
 * ### The assertion that matters most
 *
 * *confirming a wire whose endpoints do not change still writes a record and moves the count.*
 * 47 of the real 71 wires are that case, and before this screen the file could not hold it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocateTab } from './LocateTab'
import type {
  Designator,
  DesignatorIndex,
  DrawingSummary,
  Health,
  LocationsDocument,
} from '@/api/types'
import { buildLookup } from '@/lib/designators'
import { useAppStore } from '@/stores/appStore'
import { useLocateStore } from '@/stores/locateStore'
import { useWiringStore } from '@/stores/wiringStore'
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
  editing: { enabled: true, password_required: false, by: 'js' },
  spend: { day: '2026-09-08', spent_usd: 0, ceiling_usd: 10, remaining_usd: 10, exhausted: false },
  in_flight: 0, concurrency_limit: 2, sessions: 0,
} satisfies Health

function terminal(id: string, point: [number, number], parent: string): Designator {
  return {
    id,
    kind: 'terminal',
    label: `terminal on ${parent}`,
    on_sheet: false,
    members: [parent],
    point,
    rect: [point[0], point[1], point[0], point[1]],
    // **Confirmed**, all seven: see the file header on why a `parent` fallback may not be fed to
    // a landing rule that discriminates at 4 pt.
    placement: 'confirmed',
  }
}

function wire(id: string, spec: string, from: string, to: string): Designator {
  const at = (t: string) => PINS.find((p) => p.id === t)!.point as [number, number]
  return {
    id,
    kind: 'wire',
    label: `${spec} wire`,
    on_sheet: false,
    spec,
    members: [],
    point: at(from),
    rect: [0, 0, 1224, 792],
    terminals: [
      { id: from, point: at(from), placement: 'confirmed' },
      { id: to, point: at(to), placement: 'confirmed' },
    ],
  }
}

const PINS: Designator[] = [
  terminal('CR1:A2', [500, 500], 'CR1'),
  terminal('PB2:3', [500, 600], 'PB2'),
  terminal('PS1:-2', [500, 700], 'PS1'),
  // Two rows of one block, 16 pt apart — the pitch that makes this whole project necessary.
  terminal('TB-0V:1', [300, 500], 'TB-0V'),
  terminal('TB-0V:2', [300, 516], 'TB-0V'),
  terminal('TB-0V:6', [300, 600], 'TB-0V'),
  terminal('TB-GND-B:2', [300, 700], 'TB-GND-B'),
]

function net(id: string, terminals: string[]): Designator {
  return {
    id,
    kind: 'net',
    label: `net ${id}`,
    on_sheet: true,
    members: [],
    point: [400, 550],
    rect: [300, 500, 500, 700],
    terminals: terminals.map((t) => ({
      id: t,
      point: PINS.find((p) => p.id === t)!.point as [number, number],
      placement: 'confirmed' as const,
    })),
  }
}

const ENTRIES: Designator[] = [
  ...PINS,
  wire('W019', 'GREEN 12AWG', 'PS1:-2', 'TB-GND-B:2'),
  wire('W042', 'BLUE 22AWG', 'PB2:3', 'TB-0V:6'),
  wire('W045', 'WHITE/BLUE 18AWG', 'CR1:A2', 'TB-0V:2'),
  net('0V', ['CR1:A2', 'PB2:3', 'PS1:-2', 'TB-0V:1', 'TB-0V:2', 'TB-0V:6']),
  net('GND', ['TB-GND-B:2']),
]

const INDEX: DesignatorIndex = {
  drawing_number: 'PS20115MLM4-2',
  counts: { terminal: 7, wire: 3, net: 2 },
  located: ENTRIES.length,
  entries: ENTRIES,
}

/**
 * Two runs of ink, and each is one of the census's cases.
 *
 * `C0010` runs from `CR1:A2` west to **`TB-0V:1`** while the netlist puts `W045` on `:2` — one row
 * down, 16 pt away, which is a different circuit. `C0006` leaves `PB2:3` and **stops 80 pt short**
 * of `TB-0V:6`: the drawing's own error, and the netlist is right.
 */
const CONDUCTORS = {
  counts: { conductors: 2, named: 2 },
  problems: [] as string[],
  conductors: [
    {
      id: 'C0010',
      points: [[500, 500], [300, 500]] as [number, number][],
      ends: [{ point: [500, 500] as [number, number] }, { point: [300, 500] as [number, number] }],
      net_label: '0V',
      spec_label: 'WHITE/BLUE 18AWG',
      color: 'WHITE/BLUE',
      gauge: '18AWG',
      length: 200,
    },
    {
      id: 'C0006',
      points: [[500, 600], [380, 600]] as [number, number][],
      ends: [{ point: [500, 600] as [number, number] }, { point: [380, 600] as [number, number] }],
      net_label: '0V',
      spec_label: 'BLUE 22AWG',
      color: 'BLUE',
      gauge: '22AWG',
      length: 120,
    },
  ],
}

const PATHS = { wires: {}, nets: { '0V': ['W042', 'W045'], GND: ['W019'] } }

/** `wiring.json` as `bootstrap_wiring.py` leaves it: one record per wire, every one `index`. */
const WIRING = {
  drawing_number: 'PS20115MLM4-2',
  schema: 1,
  wires: {
    W019: { from: 'PS1:-2', to: 'TB-GND-B:2', source: 'index' as const },
    W042: { from: 'PB2:3', to: 'TB-0V:6', source: 'index' as const },
    W045: { from: 'CR1:A2', to: 'TB-0V:2', source: 'index' as const },
  },
  commoning: {},
}

const WIRING_REPORT = {
  file: true, wires: 3, confirmed: 0, corrected: 0, unset: 0, retired: 0, commoning: 0,
  problems: [] as string[],
}

const LOCATIONS_REPORT = {
  file: true, components: 0, sites: 0, confirmed_sites: 0, terminals: 7, confirmed_terminals: 7,
  labels: 0, confirmed_labels: 0, problems: [] as string[],
}

/** `W045`'s route, accepted against the endpoints the netlist has today — so correcting its `to`
 * end is what makes `path may be stale` true. */
const LOCATIONS_WITH_PATH: LocationsDocument = {
  drawing_number: 'PS20115MLM4-2',
  schema: 2,
  page_size_pt: [1224, 792],
  components: {},
  terminals: {},
  wires: {
    W045: {
      path: {
        runs: [[[500, 500], [300, 500]]],
        geometry: 'extracted',
        attribution: 'human',
        conductors: ['C0010'],
        for: ['CR1:A2', 'TB-0V:2'],
      },
    },
  },
}

const SIZE = { width: 800, height: 600 }

/** Every wiring document the screen would have written, in order. */
let savedWiring: Record<string, unknown>[] = []

function stubServer(options: { locations?: LocationsDocument; ink?: null } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/editor/unlock')) {
        return json({ unlocked: true, password_required: false })
      }
      if (url.endsWith('/api/wiring') && init?.method === 'PUT') {
        savedWiring.push(JSON.parse(String(init.body)).document)
        return json({
          saved: true,
          report: WIRING_REPORT,
          stale:
            'circuit_logic.json is behind wiring.json — re-run `python author_circuit_logic.py` ' +
            'in the extraction directory, and then `build_kg.py`, because an endpoint is ' +
            'connectivity rather than geometry.',
        })
      }
      if (url.endsWith('/api/wiring')) {
        return json({ present: true, document: WIRING, report: WIRING_REPORT })
      }
      if (url.endsWith('/api/locations') && init?.method === 'PUT') {
        return json({ saved: true, report: LOCATIONS_REPORT, stale: 'behind' })
      }
      if (url.endsWith('/api/locations')) {
        return json({
          present: true,
          document:
            options.locations ??
            ({
              drawing_number: 'PS20115MLM4-2',
              schema: 2,
              page_size_pt: [1224, 792],
              components: {},
              terminals: {},
            } as LocationsDocument),
          report: LOCATIONS_REPORT,
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

function json(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, statusText: '' } as unknown as Response
}

beforeEach(() => {
  savedWiring = []
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true, writable: true, value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true, get: () => SIZE.width,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true, get: () => SIZE.height,
  })
  useAppStore.setState({
    drawing: DRAWING,
    health: HEALTH,
    designators: INDEX,
    paths: PATHS,
    byToken: buildLookup(INDEX),
    activeTabId: LOCATE_TAB_ID,
  })
  useLocateStore.setState({
    document: null, report: null, conductors: null, unlocked: true, loading: false, error: null,
    target: null, advance: false, saveState: 'clean', saveError: null, stale: null,
    undoStack: [], redoStack: [], undoNote: null,
  })
  useLocateStore.getState().endRun()
  useWiringStore.getState().reset()
  stubServer()
})

afterEach(() => {
  for (const name of ['clientWidth', 'clientHeight', 'scrollIntoView'] as const) {
    delete (HTMLElement.prototype as never)[name]
  }
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// -- helpers ---------------------------------------------------------------------------------

/**
 * Open the screen on one wire.
 *
 * The `Wiring` filter is pressed **first**, and that is not incidental: `To do` is this fixture's
 * default and it is *empty*, because all seven terminals are placed. A queue with nothing in it is
 * the correct state of a finished placement run, which is what the real drawing is in too.
 */
async function open(id: string) {
  render(<LocateTab />)
  fireEvent.click(await screen.findByRole('button', { name: 'Wiring' }))
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(`^${id} `) }))
  return screen.findByText('What it joins')
}

function panel() {
  return screen.getByText('What it joins').closest('[data-wiring-panel]') as HTMLElement
}

/** The two end slots, by the wire and the end they belong to. */
function slot(wire: string, end: 'from' | 'to') {
  return document.querySelector(`[data-wiring-end="${wire}@${end}"]`) as HTMLElement
}

function proposal(wire: string, end: 'from' | 'to', terminal: string) {
  return slot(wire, end).querySelector(
    `[data-wiring-proposal="${terminal}"] button`,
  ) as HTMLElement
}

function marker(id: string) {
  return screen.getByRole('button', { name: new RegExp(`^${id} `) })
}

/** The last document the screen sent, after the 900 ms debounce. */
async function written() {
  await waitFor(() => expect(savedWiring.length).toBeGreaterThan(0), { timeout: 3000 })
  return savedWiring[savedWiring.length - 1] as {
    wires: Record<string, Record<string, unknown>>
  }
}

// -- the queue --------------------------------------------------------------------------------

describe('the Wiring queue', () => {
  it('lists every wire nobody has confirmed, and reads 0 of 3', async () => {
    render(<LocateTab />)
    fireEvent.click(await screen.findByRole('button', { name: 'Wiring' }))
    await screen.findByRole('option', { name: /^W045 / })

    // Wires only — the terminals and the nets are not in this queue, because neither has an
    // endpoint anybody can confirm.
    const rows = screen.getAllByRole('option').map((row) => row.textContent ?? '')
    expect(rows.filter((text) => /^W0/.test(text))).toHaveLength(3)
    expect(rows).toHaveLength(3)
    // **The honest number**: every record the bootstrap wrote says `index`, so nothing is
    // confirmed however many of the three are already correct.
    expect(screen.getByText(/0 of 3 wires confirmed/)).toBeTruthy()
  })

  it('lets the count and the queue disagree about nothing', async () => {
    await open('W045')
    fireEvent.click(screen.getByTitle(/Record that you looked at these two terminals/))

    // Both read the draft, and both read it through the same predicate — so the row goes under the
    // click rather than 900 ms later, and the number goes with it.
    await waitFor(() => expect(screen.getByText(/1 of 3 wires confirmed/)).toBeTruthy())
    expect(screen.queryByRole('option', { name: /^W045 / })).toBeNull()
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })
})

// -- the acceptance criterion ----------------------------------------------------------------

describe('confirming a wire that was already right', () => {
  it('writes a record and moves the count, with no `was`', async () => {
    // **Phase A's whole point.** `W019`'s endpoints are exactly what the index says and the file
    // still gains a decision — because *I looked and it was right* is one, and 47 of the real 71
    // wires need nothing else.
    await open('W019')
    fireEvent.click(screen.getByTitle(/Record that you looked at these two terminals/))

    const document_ = await written()
    expect(document_.wires.W019).toEqual({
      from: 'PS1:-2',
      to: 'TB-GND-B:2',
      source: 'human',
      by: 'js',
      at: expect.any(String),
    })
    expect(document_.wires.W019).not.toHaveProperty('was')
    // And the other two records are untouched, still saying what the machine guessed.
    expect(document_.wires.W042).toEqual({ from: 'PB2:3', to: 'TB-0V:6', source: 'index' })
  })

  it('says who confirmed it and when, in the words the placement list uses', async () => {
    await open('W019')
    // Three of them: the section's badge, and one under each end slot. The words are one table in
    // `lib/designators.ts`, beside the placement list's, so the two cannot drift apart.
    expect(screen.getAllByText('from the index')).toHaveLength(3)

    fireEvent.click(screen.getByTitle(/Record that you looked at these two terminals/))
    // The day rather than the instant: a confirmation is something somebody remembers doing on an
    // afternoon, and the file keeps the whole ISO string for an audit.
    await waitFor(() =>
      expect(screen.getAllByText(/^you, on \d{4}-\d{2}-\d{2}$/).length).toBeGreaterThan(0),
    )
  })

  it('can be taken back, without a text editor', async () => {
    await open('W019')
    fireEvent.click(screen.getByTitle(/Record that you looked at these two terminals/))
    await waitFor(() => expect(screen.getByText(/1 of 3 wires confirmed/)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Take it back/ }))
    await waitFor(() => expect(screen.getByText(/0 of 3 wires confirmed/)).toBeTruthy())

    const document_ = await written()
    // Back to `index`, and the record is still there: a vanished record would read in `git diff`
    // as a wire somebody deleted, which is a much louder claim than *nobody has checked this*.
    expect(document_.wires.W019).toEqual({ from: 'PS1:-2', to: 'TB-GND-B:2', source: 'index' })
  })

  it('will not confirm a wire with an end nobody has set', async () => {
    // A wire somebody started. It is **still in the queue** however confirmed the record says it
    // is — *confirmed* and *finished* are two questions, and the queue asks the second.
    useWiringStore.setState({
      document: {
        ...WIRING,
        wires: { ...WIRING.wires, W019: { from: 'PS1:-2', to: null, source: 'human' } },
      },
    })
    await open('W019')
    expect(
      screen.getByTitle(/Record that you looked at these two terminals/).hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.getByText('nobody has set this end')).toBeTruthy()
  })
})

// -- the ink's proposal -----------------------------------------------------------------------

describe('what the ink says', () => {
  it('offers the terminal the ink actually reaches, and marks the one that agrees', async () => {
    await open('W045')

    // `C0010` leaves `CR1:A2` and lands on `TB-0V:1`. The netlist says `:2`, one row down.
    expect(proposal('W045', 'to', 'TB-0V:1')).toBeTruthy()
    expect(slot('W045', 'to').textContent).toContain('the ink does not offer TB-0V:2 at all')

    // Nothing is marked as agreeing, because nothing does.
    expect(slot('W045', 'to').textContent).not.toContain('agrees with the index')

    // And the **other** end has nothing offered at all — the walk that would name it starts at
    // `TB-0V:2`, and no ink reaches `TB-0V:2`. That is the real `W045` exactly: §3.5 says nothing
    // lands on rows 8, 9 or 11 of `TB-0V`, so its from-end proposals are empty on the real sheet
    // too. Two ends, two different kinds of silence, and neither is a fault.
    expect(slot('W045', 'from').querySelectorAll('[data-wiring-proposal]')).toHaveLength(0)
  })

  it('marks the proposal that agrees with the record, once it does', async () => {
    // **Not by promoting it.** A list that put the record's own answer first by construction could
    // never disagree with the record, which is the only thing it is for. So the order stays the
    // fit and the agreement is a tag — here, after the correction that makes the ink and the file
    // say the same thing.
    await open('W045')
    fireEvent.click(proposal('W045', 'to', 'TB-0V:1'))
    await waitFor(() =>
      expect(slot('W045', 'to').textContent).toContain('agrees with the index'),
    )
    expect(slot('W045', 'to').textContent).not.toContain('does not offer')
  })

  it('carries the conductor, the printed spec and the fit', async () => {
    await open('W045')
    const row = proposal('W045', 'to', 'TB-0V:1')
    expect(row.textContent).toContain('C0010')
    expect(row.textContent).toContain('WHITE/BLUE 18AWG')
    expect(row.textContent).toContain('one run')
    expect(row.textContent).toContain('0V')
  })

  it('writes the correction and keeps what it replaced', async () => {
    await open('W045')
    fireEvent.click(proposal('W045', 'to', 'TB-0V:1'))

    const document_ = await written()
    expect(document_.wires.W045).toMatchObject({
      from: 'CR1:A2',
      to: 'TB-0V:1',
      source: 'human',
      was: ['CR1:A2', 'TB-0V:2'],
    })
    // And the panel says so, beside the end it moved.
    await waitFor(() => expect(slot('W045', 'to').textContent).toContain('was TB-0V:2'))
  })

  it('offers nothing at all where the ink stops short — W042', async () => {
    // **The assertion this phase is judged by.** `C0006` leaves `PB2:3` and stops 80 pt from
    // `TB-0V:6`: the drawing's own error, and the netlist is right. A screen that offered
    // something here would be training a person to break correct data.
    await open('W042')
    expect(slot('W042', 'to').querySelectorAll('[data-wiring-proposal]')).toHaveLength(0)
    expect(slot('W042', 'from').querySelectorAll('[data-wiring-proposal]')).toHaveLength(0)
    expect(screen.getAllByText(/The ink says nothing about this end/).length).toBeGreaterThan(0)
    // It is still confirmable, and confirming it is the right answer.
    expect(
      screen.getByTitle(/Record that you looked at these two terminals/).hasAttribute('disabled'),
    ).toBe(false)
  })

  it('says the conductors did not load rather than offering nothing without explanation', async () => {
    stubServer({ ink: null })
    await open('W045')
    expect(screen.getAllByText(/conductors did not load/).length).toBeGreaterThan(0)
    // And `Pick from the sheet` still works, which is the whole of the degradation.
    expect(screen.getAllByRole('button', { name: /Pick from the sheet/ })).toHaveLength(2)
  })
})

// -- Pick from the sheet ----------------------------------------------------------------------

describe('picking an end from the sheet', () => {
  it('arms one slot, and the next terminal click fills it', async () => {
    await open('W045')
    const pick = slot('W045', 'to').querySelector('[data-wiring-pick]') as HTMLElement
    fireEvent.click(pick)
    expect(pick.getAttribute('aria-pressed')).toBe('true')

    // Every terminal is on the sheet while a slot is armed — without that, the `Wiring` filter's
    // rows are wires and there would be nothing to aim at.
    fireEvent.click(marker('TB-0V:6'))

    const document_ = await written()
    expect(document_.wires.W045).toMatchObject({ to: 'TB-0V:6', source: 'human' })
    // The mode does not outlive the gesture.
    await waitFor(() =>
      expect(
        (slot('W045', 'to').querySelector('[data-wiring-pick]') as HTMLElement).getAttribute(
          'aria-pressed',
        ),
      ).toBe('false'),
    )
  })

  it('does not place the wire’s label point while a slot is armed', async () => {
    // The trap this guard exists for: the armed row is a **wire**, so a click on bare paper would
    // write its `label_point` — into the *other* authored file, from a click meant for a dot.
    await open('W045')
    fireEvent.click(slot('W045', 'to').querySelector('[data-wiring-pick]') as HTMLElement)

    const sheet = screen.getByRole('application')
    fireEvent.pointerDown(sheet, { pointerId: 1, button: 0 })
    fireEvent.pointerUp(sheet, { pointerId: 1 })
    fireEvent.click(sheet, { clientX: 400, clientY: 300 })

    expect(useLocateStore.getState().saveState).toBe('clean')
    expect(useLocateStore.getState().document?.wires ?? {}).toEqual({})
  })

  it('gives Escape the slot before the row', async () => {
    // `H22` extended: text field → **slot** → trace → target. Each press takes exactly one thing
    // away, and the slot goes first among the modes because it is the one where the next click
    // writes into a different authored file.
    await open('W045')
    fireEvent.click(slot('W045', 'to').querySelector('[data-wiring-pick]') as HTMLElement)
    expect(useWiringStore.getState().armed).toEqual({ wire: 'W045', end: 'to' })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useWiringStore.getState().armed).toBeNull()
    expect(useLocateStore.getState().target?.id).toBe('W045')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useLocateStore.getState().target).toBeNull()
  })

  it('disarms when the armed row changes, so a click cannot land on the wrong wire', async () => {
    await open('W045')
    fireEvent.click(slot('W045', 'to').querySelector('[data-wiring-pick]') as HTMLElement)
    fireEvent.click(screen.getByRole('option', { name: /^W019 / }))
    await waitFor(() => expect(useWiringStore.getState().armed).toBeNull())
  })
})

// -- the flag, and the stale path -------------------------------------------------------------

describe('the things it flags and never fixes', () => {
  it('shows the two ends’ nets side by side and flags W019’s two', async () => {
    // Corrected, `W019` is a 0 V-to-ground **bond**. Two nets is the finding, and a screen that
    // quietly picked one would hide the only interesting thing about the wire — which is exactly
    // what storing a wire's net used to do.
    await open('W019')
    const nets = panel().querySelector('[data-wiring-nets]') as HTMLElement
    expect(nets.textContent).toContain('0V')
    expect(nets.textContent).toContain('GND')
    expect(nets.querySelector('[data-wiring-mismatch]')).toBeTruthy()
  })

  it('does not flag a wire whose two ends are on one net', async () => {
    await open('W045')
    expect(panel().querySelector('[data-wiring-mismatch]')).toBeNull()
  })

  it('says `path may be stale` once a correction moves the end the route reaches', async () => {
    stubServer({ locations: LOCATIONS_WITH_PATH })
    await open('W045')
    // Before the correction the route is simply traced.
    expect(screen.getByRole('option', { name: /^W045 / }).textContent).toContain('path traced')

    fireEvent.click(proposal('W045', 'to', 'TB-0V:1'))
    await waitFor(() => expect(panel().querySelector('[data-wiring-stale="W045"]')).toBeTruthy())

    // On the row too — and on the `Wires` filter rather than this one, because confirming an
    // endpoint takes the wire out of the wiring queue by design. The word follows the wire
    // wherever it is listed; it does **not** put it back into the `Paths` queue, which shares one
    // predicate with the path count and must not walk that count backwards mid-run.
    fireEvent.click(screen.getByRole('button', { name: 'Wires' }))
    expect(screen.getByRole('option', { name: /^W045 / }).textContent).toContain(
      'path may be stale',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Paths' }))
    expect(screen.queryByRole('option', { name: /^W045 / })).toBeNull()
  })
})

// -- what a save says -------------------------------------------------------------------------

describe('saving', () => {
  it('says the netlist is behind, and names both commands', async () => {
    // The one authored file whose save really does make `circuit_logic.json` stale. A path and a
    // label correction never reach it and tests compare bytes for each; an endpoint **is** the
    // netlist, and unlike a placement run this work needs `build_kg.py` too.
    await open('W019')
    fireEvent.click(screen.getByTitle(/Record that you looked at these two terminals/))
    await written()
    await waitFor(() => {
      const banner = screen.getByText(/circuit_logic\.json is behind wiring\.json/)
      expect(banner.textContent).toContain('author_circuit_logic.py')
      expect(banner.textContent).toContain('build_kg.py')
    })
  })

  it('names the file whose draft is unsaved, rather than showing a second identical badge', async () => {
    await open('W019')
    fireEvent.click(screen.getByTitle(/Record that you looked at these two terminals/))
    expect(document.querySelector('[data-wiring-save]')).toBeTruthy()
    expect(screen.getByText('wiring')).toBeTruthy()
  })

  it('writes a note beside a confirmation, and will not write one without', async () => {
    await open('W019')
    const note = document.querySelector('[data-wiring-note="W019"]') as HTMLInputElement
    expect(note.disabled).toBe(true)

    fireEvent.click(screen.getByTitle(/Record that you looked at these two terminals/))
    await waitFor(() =>
      expect((document.querySelector('[data-wiring-note="W019"]') as HTMLInputElement).disabled)
        .toBe(false),
    )
    const enabled = document.querySelector('[data-wiring-note="W019"]') as HTMLInputElement
    fireEvent.change(enabled, { target: { value: 'a 0V-to-ground bond' } })
    fireEvent.blur(enabled)

    await waitFor(async () => {
      const document_ = await written()
      expect(document_.wires.W019.note).toBe('a 0V-to-ground bond')
    })
  })
})
