import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { useAppStore } from './stores/appStore'
import { TABS } from './tabs'

/**
 * A smoke test, but not a pointless one.
 *
 * `tabs.ts` used to sit in an import cycle — it imports tab components, and `appStore`
 * imported `TABS` back out of it — which built the registry with `undefined` ids and
 * `undefined` components whenever a tab component happened to be evaluated first. That is a
 * blank screen with no error, and it is a very confusing five minutes. The cycle is gone
 * (`appStore` no longer knows the registry exists), and this asserts the registry is whole so
 * that reintroducing one fails loudly.
 */

const HEALTH = {
  ok: true, version: '0.1.0', prompt_version: 'v1.0', claude: '2.1.226',
  drawing_dir: '/x', drawing_dir_present: true, models: ['opus', 'sonnet'],
  default_model: 'sonnet', anonymous_models: ['sonnet'], password_required: false,
  spend: { day: '2026-08-08', spent_usd: 0.37, ceiling_usd: 10, remaining_usd: 9.63,
           exhausted: false },
  in_flight: 0, concurrency_limit: 2, sessions: 0,
}

const DRAWING = {
  drawing_number: 'PS20115MLM4-2', title: 'MOD-LINX POWER SUPPLY ASSY',
  assembly: 'Mod-Linx Power Supply Assembly', date: '2017-09-19', revision: null,
  revision_note: "Revision: none — the 'D' in the title block is the sheet size.",
  proprietary_notice: null, notes: ['Keep DC 4" from 115VAC.'], references: ['MXCS-M9'],
  counts: { components: 47, terminals: 131, nets: 26, wires: 71, cables: 8, subsystems: 7,
            relationships: 402 },
  subsystems: [], component_classes: {}, relationship_types: {},
  artifacts: [{ name: 'circuit_logic.json', bytes: 191819 }],
}

const QUESTIONS = {
  questions: [
    { id: 'net-110-wires', text: 'How many wires are in Net 110?',
      note: 'the counting trap', kind: 'model' },
  ],
}

const DESIGNATORS = {
  drawing_number: 'PS20115MLM4-2',
  counts: { component: 1 },
  located: 1,
  entries: [
    { id: 'CR-BP', kind: 'component', label: 'relay — Run bypass relay.', on_sheet: true,
      members: ['CR-BP'], point: [861, 679], rect: [861, 679, 861, 679] },
  ],
}

function stubFetch(drawing: object = DRAWING) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.endsWith('/health')
      ? HEALTH
      : url.endsWith('/drawing')
        ? drawing
        : url.endsWith('/designators')
          ? DESIGNATORS
          : QUESTIONS
    return new Response(JSON.stringify(body), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }))
}

beforeEach(() => {
  stubFetch()
  // `activeTabId` is persisted, so one test's tab switch is the next test's starting state.
  useAppStore.setState({ activeTabId: '' })
})

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('has a tab registry that is whole at module load', () => {
    expect(TABS.length).toBeGreaterThan(0)
    expect(TABS[0].id).toBe('ask')
    for (const tab of TABS) {
      expect(tab.id).toBeTypeOf('string')
      expect(tab.Component).toBeTypeOf('function')
    }
  })

  it('hides the tab strip until there is more than one tab', async () => {
    render(<App />)
    await screen.findByText('PS20115MLM4-2')
    // This drawing has never been tiled, so the Drawing tab does not exist and a strip of one
    // is noise.
    expect(screen.queryByRole('tab', { name: /drawing/i })).toBeNull()
  })

  it('shows a Drawing tab once the sheet has been rendered to tiles', async () => {
    stubFetch({
      ...DRAWING,
      tiles: {
        page_size_pt: [1224, 792], dpi: 400, rows: 1, cols: 1, count: 1,
        tiles: [{ file: 'tile_r1c1.png', row: 1, col: 1, pdf_rect: [0, 0, 1224, 792],
                  pixels: [6800, 4400] }],
      },
    })
    render(<App />)
    expect(await screen.findByRole('tab', { name: /drawing/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /ask/i })).toBeTruthy()
  })

  it('shuttles between Ask and Drawing on F2, and only where there is a drawing', async () => {
    // Reading an answer and checking it on the sheet is one job in two places. The two ways
    // across that existed both had a side effect — a citation moves the sheet, "Ask about this"
    // rewrites the composer — so neither was a way to simply look.
    stubFetch({
      ...DRAWING,
      tiles: {
        page_size_pt: [1224, 792], dpi: 400, rows: 1, cols: 1, count: 1,
        tiles: [{ file: 'tile_r1c1.png', row: 1, col: 1, pdf_rect: [0, 0, 1224, 792],
                  pixels: [6800, 4400] }],
      },
    })
    render(<App />)
    await screen.findByRole('tab', { name: /drawing/i })

    fireEvent.keyDown(window, { key: 'F2' })
    await waitFor(() => expect(useAppStore.getState().activeTabId).toBe('drawing'))
    fireEvent.keyDown(window, { key: 'F2' })
    await waitFor(() => expect(useAppStore.getState().activeTabId).toBe('ask'))

    // The browser and the screen readers own every F2 with a modifier on it.
    fireEvent.keyDown(window, { key: 'F2', ctrlKey: true })
    expect(useAppStore.getState().activeTabId).toBe('ask')
  })

  it('does not bind F2 when the sheet was never rendered to tiles', async () => {
    // There is no Drawing tab then, and a key that silently does nothing is worse than no key.
    render(<App />)
    await screen.findByText('PS20115MLM4-2')
    const before = useAppStore.getState().activeTabId

    fireEvent.keyDown(window, { key: 'F2' })

    expect(useAppStore.getState().activeTabId).toBe(before)
  })

  it('renders the drawing, the counts and the starter questions', async () => {
    render(<App />)
    expect(await screen.findByText('PS20115MLM4-2')).toBeTruthy()
    expect(await screen.findByText(/47 components/)).toBeTruthy()
    expect(await screen.findByText(/How many wires are in Net 110/)).toBeTruthy()
    // Free, deterministic, and answering §12 Q21 before anyone spends a token.
    expect(screen.getAllByText(/sheet size/).length).toBeGreaterThan(0)
  })

  it('shows the measured spend against the daily ceiling', async () => {
    render(<App />)
    expect(await screen.findByText(/\$0\.37 \/ \$10\.00 today/)).toBeTruthy()
  })

  it('offers both models and defaults the composer to disabled', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByRole('radio', { name: /opus/i })).toBeTruthy())
    const ask = screen.getByRole('button', { name: /^Ask$/ }) as HTMLButtonElement
    // Nothing typed yet, so nothing can be spent by a stray click.
    expect(ask.disabled).toBe(true)
  })
})
