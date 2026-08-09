import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { TABS } from './tabs'

/**
 * A smoke test, but not a pointless one.
 *
 * `tabs.ts` imports `AskTab`, which imports `appStore`, which imports `TABS` back out of
 * `tabs.ts` — a genuine import cycle. It resolves correctly today only because `appStore`
 * reads `TABS[0].id` inside the store initialiser rather than at module top level. Move that
 * read and the app renders a blank screen with `TABS` undefined, which is a very confusing
 * five minutes. This test fails loudly instead.
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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.endsWith('/health') ? HEALTH : url.endsWith('/drawing') ? DRAWING : QUESTIONS
    return new Response(JSON.stringify(body), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }))
})

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('has a tab registry that is populated at module load despite the import cycle', () => {
    expect(TABS.length).toBeGreaterThan(0)
    expect(TABS[0].id).toBe('ask')
    expect(TABS[0].Component).toBeTypeOf('function')
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
