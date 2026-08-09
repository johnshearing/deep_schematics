import { useState } from 'react'
import { Check, Copy, ShieldAlert, TriangleAlert } from 'lucide-react'

import { Markdown } from '@/components/Markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatDuration, formatUsd } from '@/lib/utils'
import type { Message } from '@/stores/chatStore'
import { ToolStrip } from './ToolStrip'

export function MessageView({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-accent px-3 py-2 text-sm whitespace-pre-wrap text-accent-foreground">
          {message.text}
        </div>
      </div>
    )
  }

  const streaming = message.status === 'streaming'

  return (
    <div className="space-y-1">
      <ToolStrip tools={message.tools} live={streaming} />

      {message.thinking && !message.text && (
        <p className="text-xs text-muted-foreground italic">Thinking…</p>
      )}

      {message.denials.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-xs">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-[var(--color-warning)]" />
          <div>
            <strong>
              {message.denials.length} tool call{message.denials.length > 1 ? 's were' : ' was'}{' '}
              denied.
            </strong>{' '}
            The session is confined to the drawing directory. Surfaced rather than hidden — a
            denial is either an allowlist that is too tight, or a request that had no business
            being made.
            <ul className="mt-1 space-y-0.5 font-mono opacity-80">
              {message.denials.map((denial, index) => (
                <li key={index}>
                  {denial.tool}: {JSON.stringify(denial.input)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {message.text && (
        <div className={cn(streaming && 'caret')}>
          <Markdown>{message.text}</Markdown>
        </div>
      )}

      {message.status === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-[var(--color-danger)]" />
          <span>{message.error}</span>
        </div>
      )}

      {message.status === 'cancelled' && (
        <p className="text-xs text-muted-foreground italic">Stopped.</p>
      )}

      {!streaming && <Footer message={message} />}
    </div>
  )
}

function Footer({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
      {message.model && <Badge>{message.model}</Badge>}
      {/* Cost and latency, always. It keeps the economics visible to whoever is paying. */}
      <span>{formatUsd(message.costUsd)}</span>
      <span>·</span>
      <span>{formatDuration(message.durationMs)}</span>
      {message.text && (
        <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={copy}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy markdown'}
        </Button>
      )}
    </div>
  )
}
