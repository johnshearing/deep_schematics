/**
 * What the line you just pointed at is — and **how much that answer is worth today.**
 *
 * The reader's half of Phase D. Everything else on this tab starts from an identifier: you know
 * you want `W048`, you find it in the list or in an answer, and the sheet takes you there. This
 * starts from the paper, which is where a technician actually starts: *there is a wire here, what
 * is it, and is it in your index at all?*
 *
 * Three verdicts, and the third one is the reason the count is printed beside all of them. Until
 * the authoring run is finished *no wire claims this run* is the honest answer for around 90 of
 * the 149 — mostly label leaders and symbol strokes, but also every wire nobody has traced — so a
 * card that stopped at the verdict would be teaching a false fact on its first use. `PathSummary`
 * has carried `wires` and `traced` since Session 5 for exactly this.
 *
 * It sits where the selection card sits, and only ever one of the two is on screen: they answer
 * the same question from opposite ends, and two cards in one corner would be a fight over the
 * bottom-left of the sheet.
 */

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Claims, Pick } from './hitTest'

interface Props {
  pick: Pick
  claims: Claims
  /** Go to the wire that claims this run. Absent where nothing does. */
  onSelectWire: (wireId: string) => void
  /** Go to the block whose bus this is. */
  onSelectBlock: (componentId: string) => void
  onClose: () => void
}

export function ConductorCard({ pick, claims, onSelectWire, onSelectBlock, onClose }: Props) {
  const { conductor } = pick
  const spec = conductor.spec_label ?? [conductor.color, conductor.gauge].filter(Boolean).join(' ')

  return (
    <div
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      data-conductor-card={conductor.id}
      className={cn(
        'pointer-events-auto absolute bottom-3 left-3 z-10 max-w-sm min-w-72',
        'rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur-sm',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-sm font-semibold">{conductor.id}</span>
            <span className="text-[11px] text-muted-foreground">a run of ink</span>
            <span
              className="rounded border border-[var(--color-warning)]/50 px-1 text-[10px] text-[var(--color-warning)]"
              title="An identifier the extraction gave this stroke of the PDF. You will not find it printed on the drawing — what is printed beside a wire is its colour and gauge."
            >
              our id
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            {spec ? <span>{spec}</span> : <span className="italic">no colour or gauge printed</span>}
            {conductor.net_label && (
              <span>
                printed <span className="font-mono text-foreground">{conductor.net_label}</span>
                {conductor.was && (
                  <span
                    className="ml-1 text-[10px]"
                    title={`The extraction read this as “${conductor.was}” and you corrected it on the Review tab.`}
                  >
                    (you read it; the machine said {conductor.was})
                  </span>
                )}
              </span>
            )}
            {conductor.length !== undefined && (
              <span className="tabular-nums">{conductor.length.toFixed(1)} pt</span>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Clear selection" onClick={onClose}>
          <X />
        </Button>
      </div>

      <Verdict pick={pick} onSelectWire={onSelectWire} onSelectBlock={onSelectBlock} />

      {/* **The honesty requirement, and it is beside every verdict rather than only the third.**
          *Claimed by W063* is also worth less while 13 wires have no route: the reader deserves
          to know how much of the drawing this index has actually been told about. */}
      <p className="mt-2 text-[10px] text-muted-foreground" data-conductor-coverage>
        {claims.traced} of {claims.wires} wires have a route so far, so{' '}
        <span className="font-medium">no wire claims this run</span> can also mean{' '}
        <span className="italic">nobody has traced it yet</span>.
      </p>

      <p className="mt-1 text-[10px] text-muted-foreground">
        pointed at from {pick.off.toFixed(1)} pt away · conductor rows on this sheet are 16 pt apart
      </p>
    </div>
  )
}

function Verdict({
  pick,
  onSelectWire,
  onSelectBlock,
}: {
  pick: Pick
  onSelectWire: (wireId: string) => void
  onSelectBlock: (componentId: string) => void
}) {
  if (pick.claimedBy) {
    return (
      <p className="mt-2 text-xs" data-conductor-verdict="claimed">
        claimed by{' '}
        <button
          type="button"
          className="font-mono font-medium underline-offset-2 hover:underline"
          onClick={() => onSelectWire(pick.claimedBy as string)}
          title={`Select ${pick.claimedBy} and highlight its whole route`}
        >
          {pick.claimedBy}
        </button>
      </p>
    )
  }

  if (pick.commoning) {
    const { block, confirmed } = pick.commoning
    return (
      <p
        className="mt-2 text-xs"
        data-conductor-verdict={confirmed ? 'commoning' : 'commoning-proposed'}
      >
        <button
          type="button"
          className="font-mono font-medium underline-offset-2 hover:underline"
          onClick={() => onSelectBlock(block)}
          title={`Select ${block}`}
        >
          {block}
        </button>
        &apos;s commoning
        {!confirmed && (
          <span
            className="ml-1 text-[10px] text-[var(--color-warning)]"
            title="Two or more of this block's terminals lie on this one run, which is the shape of a block's own bus — but nobody has confirmed it on the Locate tab, so no net's highlight includes it yet."
          >
            — by its shape, and nobody has confirmed it
          </span>
        )}
        {/* The finding, spelled out where a reader meets it rather than only in the plan. */}
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          A terminal block joins its own screws with this. It is not field wire, so no wire may
          claim it — which is why it carries no printed name.
        </span>
      </p>
    )
  }

  return (
    <p className="mt-2 text-xs" data-conductor-verdict="unclaimed">
      no wire claims this run
      <span className="mt-0.5 block text-[10px] text-muted-foreground">
        Around 90 of this sheet&apos;s 149 runs are label leader lines, earth symbols and the
        internal strokes of a symbol rather than wiring.
      </span>
    </p>
  )
}
