import { Activity, CircleAlert, CircleCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn, formatUsd } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'

/** Per-question costs, measured on this drawing (plan §1.6). Shown next to the toggle so the
 * choice is made with the price visible rather than after the bill arrives. */
const MODEL_BLURB: Record<string, string> = {
  opus: '~$0.64 · ~110 s · deepest, most self-sceptical',
  sonnet: '~$0.16 · ~60 s · still gets the hard question right',
}

export function Header() {
  const { health, healthError, drawing, model, setModel } = useAppStore()
  const busy = useChatStore((s) => s.busy)

  const models = health?.models ?? ['sonnet', 'opus']
  const spend = health?.spend
  const locked = health?.password_required
    ? (health?.anonymous_models ?? [])
    : models

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-sm font-semibold">
            {drawing?.drawing_number ?? 'Schematic Q&A'}
          </h1>
          {drawing?.revision_note && (
            <Badge tone="warning" title={drawing.revision_note}>
              no revision
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground" title={drawing?.title ?? ''}>
          {drawing?.assembly ?? 'Read-only questions about one electrical schematic'}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {spend && (
          <div
            className="hidden text-right text-[11px] leading-tight text-muted-foreground sm:block"
            title={`Daily ceiling ${formatUsd(spend.ceiling_usd)}, resets ${spend.day}`}
          >
            <div className={cn(spend.exhausted && 'text-[var(--color-danger)]')}>
              {formatUsd(spend.spent_usd)} / {formatUsd(spend.ceiling_usd)} today
            </div>
            <div>{spend.exhausted ? 'budget spent' : `${formatUsd(spend.remaining_usd)} left`}</div>
          </div>
        )}

        <div
          className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
          role="radiogroup"
          aria-label="Model"
        >
          {models.map((name) => {
            const allowed = locked.includes(name)
            return (
              <button
                key={name}
                role="radio"
                aria-checked={model === name}
                disabled={busy}
                onClick={() => setModel(name)}
                title={`${MODEL_BLURB[name] ?? ''}${allowed ? '' : ' · needs the demo password'}`}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-50',
                  model === name
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {name}
                {!allowed && ' 🔒'}
              </button>
            )
          })}
        </div>

        <HealthDot ok={!!health?.ok && !healthError} detail={healthError ?? health?.claude ?? ''} />
      </div>
    </header>
  )
}

function HealthDot({ ok, detail }: { ok: boolean; detail: string }) {
  const Icon = ok ? CircleCheck : healthUnknown(detail) ? Activity : CircleAlert
  return (
    <span
      title={detail || (ok ? 'server up' : 'server unreachable')}
      className={cn(
        'flex size-7 items-center justify-center rounded-md',
        ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

function healthUnknown(detail: string) {
  return detail === ''
}
