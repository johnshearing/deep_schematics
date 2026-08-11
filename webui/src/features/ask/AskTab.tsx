import { useEffect, useRef, type ReactNode } from 'react'
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
              <Intro
                title={drawing?.title ?? null}
                drawingNumber={drawing?.drawing_number ?? null}
                hasDrawingTab={!!drawing?.tiles?.count}
              />
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

/**
 * Separate blocks, not one paragraph stack.
 *
 * The drawing title is a 20-word all-caps run out of the title block, and the two notes below
 * it are independent claims — what the model reads, and what it does when the sheet has no
 * answer. Run together they read as one grey wall and none of it lands. Each idea gets its own
 * card and its own label instead.
 */
function Intro({
  title,
  drawingNumber,
  hasDrawingTab,
}: {
  title: string | null
  drawingNumber: string | null
  hasDrawingTab: boolean
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Ask this schematic a question</h2>

      {/* A sentence, not a button. The button that used to sit here vanished with the empty
          state; the Drawing tab does not, so pointing at it is all this needs to do. */}
      {hasDrawingTab && (
        <p className="text-sm text-muted-foreground">
          The sheet itself is in the{' '}
          <span className="font-medium text-foreground">Drawing</span> tab above — pan and zoom
          it to check any answer against the drawing it came from.
        </p>
      )}

      {title && (
        <div className="rounded-lg border bg-card px-4 py-3">
          {drawingNumber && (
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Drawing {drawingNumber}
            </p>
          )}
          <p className="mt-1 text-sm leading-relaxed font-medium">{title}</p>
        </div>
      )}

      <IntroNote label="What it is reading">
        Claude reads the extracted netlist directly — the notes, then the component, terminal,
        net and wire tables — and answers citing the identifiers it used. It is read-only and
        confined to this one drawing.
      </IntroNote>

      <IntroNote label="When the sheet has no answer">
        It will tell you when the sheet cannot answer the question. Net 130 and CR-SW complete
        only through the downstream machine, so the honest answer there is{' '}
        <em>cannot be determined from this sheet</em> — and getting that answer is the demo
        working, not failing.
      </IntroNote>
    </div>
  )
}

function IntroNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-dashed px-4 py-3">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  )
}
