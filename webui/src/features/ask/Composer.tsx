import { useEffect, useRef } from 'react'
import { Send, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'

export function Composer() {
  const { model, health, refreshHealth, unlocked } = useAppStore()
  // Only advertise the shortcut where there is a Drawing tab for it to reach; an extraction that
  // was never tiled has none. `App` owns the key itself — see the comment on its handler.
  const hasDrawing = useAppStore((s) => !!s.drawing?.tiles?.count)
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
  // Refuse locally rather than letting the question go and come back 403. The server still
  // enforces it; this only spares the visitor typing a paragraph into a dead box.
  const needsPassword =
    !!health?.password_required &&
    !unlocked &&
    !(health.anonymous_models ?? []).includes(model)
  const blocked = exhausted || needsPassword
  const canSend = composerText.trim().length > 0 && !busy && !blocked

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
          disabled={blocked}
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
              : needsPassword
                ? `${model} needs the demo password — use Unlock, top right.`
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
        Enter to send, Shift+Enter for a new line.{' '}
        {hasDrawing && <>F2 shows the drawing, and brings you back.{' '}</>}
        Answers are read-only and cite wire, net and terminal IDs — check them against the drawing
        before acting on one.
      </p>
    </div>
  )
}
