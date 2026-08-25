import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatUsd } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import { Composer } from './Composer'
import { MessageView } from './MessageView'
import { StarterQuestions } from './StarterQuestions'

/**
 * Where the reader had got to, kept **outside the component** on purpose.
 *
 * This tab is the one that is *not* `keepMounted` — the Drawing and Locate tabs are, because a
 * pan, a zoom and an unsaved draft are expensive to rebuild, while a transcript is cheap. So
 * every trip to the drawing unmounts this tab and every trip back mounts a fresh one, with
 * `pinned` starting true and the follow effect firing on its first run: the reader lands at the
 * **bottom** of the answer they were half way through.
 *
 * That is the wrong end. The loop this whole seam exists for is *read a line, click the
 * identifier in it, look at the sheet, come back to the same line* — `F2` there and `F2` back —
 * and a reader who has to find their place again each time is being charged for the round trip.
 *
 * Module state rather than a store field, and that is not laziness: the offset changes on every
 * scroll event, and `AskTab` subscribes to the whole of `useChatStore`, so writing it into a
 * store would re-render the entire transcript sixty times a second while somebody scrolls. It
 * survives an unmount, dies with the page, and nothing renders from it.
 *
 * `pinned` is remembered beside it, because "I was at the bottom" and "I was 3000 px down, which
 * happens to be the bottom of what existed then" are different intentions: the first should follow
 * a growing answer and the second should not.
 */
const view = { top: 0, pinned: true }

/** How close to the bottom still counts as "following the stream". */
const PINNED_SLACK = 80

export function AskTab() {
  const { messages, busy, sessionCostUsd, reset } = useChatStore()
  const drawing = useAppStore((s) => s.drawing)
  const bottom = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // Follow the stream, but stop following the moment the reader scrolls up — they are
  // probably re-reading the probe sequence while the rest arrives.
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const onScroll = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight
      view.pinned = distance < PINNED_SLACK
      view.top = element.scrollTop
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [])

  /**
   * Put the reader back where they were, before the browser paints.
   *
   * A layout effect rather than an effect, so the restored offset is never briefly visible as a
   * jump. It runs once per mount, which is exactly the event being corrected for. If they were at
   * the bottom, going to the bottom *is* their position — and it is also what the follow effect
   * below would do, so the two agree rather than fighting.
   */
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    if (view.pinned) bottom.current?.scrollIntoView({ block: 'end' })
    else element.scrollTop = view.top
  }, [])

  useEffect(() => {
    if (view.pinned) bottom.current?.scrollIntoView({ block: 'end' })
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
            /* A new conversation is a new place to be, so the remembered offset goes with the
               old one — otherwise the first trip to the drawing and back would restore a scroll
               position measured against a transcript that no longer exists. */
            onClick={() => {
              view.top = 0
              view.pinned = true
              reset()
            }}
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
