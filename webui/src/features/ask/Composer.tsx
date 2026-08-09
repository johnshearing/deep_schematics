import { useEffect, useRef } from 'react'
import { Send, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'

export function Composer() {
  const { model, health, refreshHealth } = useAppStore()
  const { busy, composerText, setComposerText, send, stop } = useChatStore()
  const textarea = useRef<HTMLTextAreaElement>(null)

  // Grow to fit, up to a point — a troubleshooting question is often a paragraph.
  useEffect(() => {
    const element = textarea.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`
  }, [composerText])

  const exhausted = health?.spend.exhausted ?? false
  const canSend = composerText.trim().length > 0 && !busy && !exhausted

  const submit = async () => {
    if (!canSend) return
    await send(composerText.trim(), model)
    await refreshHealth()
  }

  return (
    <div className="border-t bg-card/40 p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textarea}
          rows={1}
          value={composerText}
          disabled={exhausted}
          onChange={(event) => setComposerText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          placeholder={
            exhausted
              ? "Today's budget for this demo is spent — it resets tomorrow."
              : 'Ask about a wire, a net, a relay, or a symptom you are measuring…'
          }
          className="max-h-[200px] min-h-[38px] flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-60"
        />
        {busy ? (
          <Button variant="danger" onClick={() => void stop()} title="Stop this answer">
            <Square className="fill-current" />
            Stop
          </Button>
        ) : (
          <Button disabled={!canSend} onClick={() => void submit()}>
            <Send />
            Ask
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Enter to send, Shift+Enter for a new line. Answers are read-only and cite wire, net and
        terminal IDs — check them against the drawing before acting on one.
      </p>
    </div>
  )
}
