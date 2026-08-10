/**
 * The demo-password entry point.
 *
 * `SWUI_DEMO_PASSWORD` was enforced server-side long before anything could send it: the
 * `X-Demo-Password` header was wired up in `api/client.ts`, but nothing ever called
 * `setDemoPassword`, so turning the password on locked the gated models with no way to unlock
 * them. This is that missing control.
 *
 * The password lives in memory only, so it is asked for once per tab and never written to
 * storage — see the note on `demoPassword` in `api/client.ts`.
 */

import { useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'

export function UnlockButton() {
  const { health, unlocked, unlockError, submitUnlock } = useAppStore()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  if (!health?.password_required) return null

  if (unlocked) {
    return (
      <span
        className="flex items-center gap-1 text-[11px] text-muted-foreground"
        title="This tab is unlocked. Reloading asks again."
      >
        <LockOpen className="size-3.5" />
        unlocked
      </span>
    )
  }

  const submit = async () => {
    if (!value || busy) return
    setBusy(true)
    const ok = await submitUnlock(value)
    setBusy(false)
    if (ok) {
      setOpen(false)
      setValue('')
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Enter the demo password">
        <Lock />
        Unlock
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="password"
          value={value}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit()
            if (event.key === 'Escape') setOpen(false)
          }}
          placeholder="demo password"
          aria-label="Demo password"
          className="w-36 rounded-md border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        />
        <Button size="sm" disabled={!value || busy} onClick={() => void submit()}>
          {busy ? '…' : 'Go'}
        </Button>
      </div>
      {unlockError && (
        <p className="max-w-56 text-right text-[11px] text-[var(--color-danger)]">{unlockError}</p>
      )}
    </div>
  )
}
