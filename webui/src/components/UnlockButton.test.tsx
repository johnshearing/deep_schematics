/**
 * The password prompt has to actually appear, which is not a given: it renders only when the
 * server reports `password_required`, and it is the sole way into a locked demo. When it is
 * missing the failure looks like "the locks do nothing" — the model buttons still show 🔒
 * because that is driven by a different field, so the UI seems fine until you try to unlock.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UnlockButton } from './UnlockButton'
import { useAppStore } from '@/stores/appStore'

const HEALTH = {
  ok: true, version: '0.1.0', prompt_version: 'v1.0', claude: '2.1.226',
  drawing_dir: '/x', drawing_dir_present: true, models: ['opus', 'sonnet'],
  default_model: 'sonnet', anonymous_models: [] as string[], password_required: true,
  spend: { day: '2026-08-09', spent_usd: 0, ceiling_usd: 10, remaining_usd: 10,
           exhausted: false },
  in_flight: 0, concurrency_limit: 2, sessions: 0,
}

function setHealth(overrides: Partial<typeof HEALTH> = {}) {
  useAppStore.setState({
    health: { ...HEALTH, ...overrides },
    unlocked: false,
    unlockError: null,
  })
}

beforeEach(() => setHealth())
afterEach(() => vi.unstubAllGlobals())

describe('UnlockButton', () => {
  it('offers a way in when the server requires a password', async () => {
    render(<UnlockButton />)
    const button = screen.getByRole('button', { name: /unlock/i })

    fireEvent.click(button)

    // Clicking must reveal an actual input — a button that does nothing is the bug this
    // whole file exists for.
    expect(screen.getByLabelText(/demo password/i)).toBeTruthy()
  })

  it('stays out of the way when no password is configured', () => {
    setHealth({ password_required: false, anonymous_models: ['sonnet'] })
    const { container } = render(<UnlockButton />)
    expect(container.firstChild).toBeNull()
  })

  it('reports a wrong password instead of silently appearing to work', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ detail: 'That is not the demo password.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )))
    render(<UnlockButton />)

    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    fireEvent.change(screen.getByLabelText(/demo password/i), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: /go/i }))

    await waitFor(() => expect(screen.getByText(/not the demo password/i)).toBeTruthy())
    expect(useAppStore.getState().unlocked).toBe(false)
  })

  it('switches to unlocked on the right password', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ unlocked: true, password_required: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    render(<UnlockButton />)

    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    fireEvent.change(screen.getByLabelText(/demo password/i), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: /go/i }))

    await waitFor(() => expect(screen.getByText(/unlocked/i)).toBeTruthy())
    expect(useAppStore.getState().unlocked).toBe(true)
  })
})
