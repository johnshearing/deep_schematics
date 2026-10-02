import { useMemo, useRef, useState, type RefObject } from 'react'
import { Check, Copy, Pencil, ShieldAlert, TriangleAlert, Volume2 } from 'lucide-react'

import { Markdown } from '@/components/Markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatDuration, formatUsd } from '@/lib/utils'
import { buildTalk } from '@/features/talkthrough/buildTalk'
import { readSelection } from '@/features/talkthrough/selection'
import { useTalkStore } from '@/features/talkthrough/talkStore'
import { useAppStore } from '@/stores/appStore'
import { shownText, type Message } from '@/stores/chatStore'
import { EditBox } from './EditBox'
import { ToolStrip } from './ToolStrip'

export function MessageView({ message }: { message: Message }) {
  // An empty half of `Write your own` opens ready to write; there is nothing else it could show.
  const [editing, setEditing] = useState(
    () => !!message.composed && message.edited === undefined,
  )
  const answerRef = useRef<HTMLDivElement>(null)

  if (message.role === 'user') {
    // Editable for the talkthrough, which may read the question aloud: a video may want it phrased
    // better than it was typed. The pencil shows only on hover, so it is not on camera.
    return (
      <div className="group flex items-start justify-end gap-1">
        {!editing && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Edit question"
            title="Edit the question (for reading it aloud)"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3" />
          </Button>
        )}
        <div
          className={cn(
            'rounded-lg rounded-br-sm bg-accent px-3 py-2 text-sm whitespace-pre-wrap text-accent-foreground',
            editing ? 'w-full max-w-[85%]' : 'max-w-[85%]',
          )}
        >
          {editing ? <EditBox message={message} onDone={() => setEditing(false)} /> : shownText(message)}
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

      {editing ? (
        <EditBox message={message} onDone={() => setEditing(false)} />
      ) : (
        shownText(message) && (
          <div ref={answerRef} className={cn(streaming && 'caret')}>
            <Markdown>{shownText(message)}</Markdown>
          </div>
        )
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

      {!streaming && !editing && (
        <Footer message={message} answerRef={answerRef} onEdit={() => setEditing(true)} />
      )}
    </div>
  )
}

function Footer({ message, answerRef, onEdit }: {
  message: Message
  answerRef: RefObject<HTMLDivElement | null>
  onEdit: () => void
}) {
  const [copied, setCopied] = useState(false)
  const byToken = useAppStore((s) => s.byToken)
  const hasViewer = useAppStore((s) => !!s.drawing?.tiles?.count)
  const done = message.status === 'done'
  // One parse per finished answer, never one per streamed chunk (trap T8).
  const text = shownText(message)
  const speakable = useMemo(
    () => done && buildTalk(text, byToken, hasViewer).sentences.length > 0,
    [done, text, byToken, hasViewer],
  )
  const talking = useTalkStore((s) => s.messageId === message.id && s.phase !== 'idle')
  const start = useTalkStore((s) => s.start)
  /**
   * The reader's selection, read as the button is *pressed*: a click can collapse it before the
   * click handler runs, in some browsers (trap T1). A keyboard press has no pointer-down, and its
   * selection is still there at the click.
   */
  const pressed = useRef<ReturnType<typeof readSelection> | undefined>(undefined)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
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
      {speakable && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 px-2"
          title={
            'Switch to the drawing and read this answer aloud, highlighting each identifier as it ' +
            'is named. Select part of the answer first to hear only that part.'
          }
          onPointerDown={() => (pressed.current = readSelection(answerRef.current))}
          onClick={() => {
            const span = pressed.current !== undefined ? pressed.current : readSelection(answerRef.current)
            pressed.current = undefined
            // While this answer is being talked, the palette owns it.
            if (!talking) start(message, span)
          }}
        >
          <Volume2 className="size-3" />
          {talking ? 'Talking…' : 'Talk me through it'}
        </Button>
      )}
      {done && (
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-6 px-2', !speakable && 'ml-auto')}
          title="Rewrite this answer, or replace it with your own. The talkthrough speaks what you write."
          onClick={onEdit}
        >
          <Pencil className="size-3" />
          Edit
        </Button>
      )}
      {shownText(message) && (
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-6 px-2', !speakable && !done && 'ml-auto')}
          onClick={copy}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy markdown'}
        </Button>
      )}
    </div>
  )
}
