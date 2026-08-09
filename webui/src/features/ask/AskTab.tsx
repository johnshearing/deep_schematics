import { useEffect, useRef } from 'react'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatUsd } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import { Composer } from './Composer'
import { MessageView } from './MessageView'
import { StarterQuestions } from './StarterQuestions'

export function AskTab() {
  const { messages, busy, sessionCostUsd, reset } = useChatStore()
  const drawing = useAppStore((s) => s.drawing)
  const bottom = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  // Follow the stream, but stop following the moment the reader scrolls up — they are
  // probably re-reading the probe sequence while the rest arrives.
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const onScroll = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight
      pinned.current = distance < 80
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (pinned.current) bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
          {messages.length === 0 ? (
            <>
              <Intro title={drawing?.title ?? null} />
              <StarterQuestions />
            </>
          ) : (
            messages.map((message) => <MessageView key={message.id} message={message} />)
          )}
          <div ref={bottom} />
        </div>
      </div>

      {messages.length > 0 && (
        <div className="flex items-center gap-2 border-t px-4 py-1.5 text-[11px] text-muted-foreground">
          <span>This conversation: {formatUsd(sessionCostUsd)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2"
            disabled={busy}
            onClick={reset}
          >
            <RotateCcw className="size-3" />
            New conversation
          </Button>
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl">
        <Composer />
      </div>
    </div>
  )
}

function Intro({ title }: { title: string | null }) {
  return (
    <div className="space-y-2">
      <h2 className="text-base font-semibold">Ask this schematic a question</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {title ? <span className="text-foreground">{title}. </span> : null}
        Claude reads the extracted netlist directly — the notes, then the component, terminal,
        net and wire tables — and answers citing the identifiers it used. It is read-only and
        confined to this one drawing.
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        It will tell you when the sheet cannot answer the question. Net 130 and CR-SW complete
        only through the downstream machine, so the honest answer there is{' '}
        <em>cannot be determined from this sheet</em> — and getting that answer is the demo
        working, not failing.
      </p>
    </div>
  )
}
