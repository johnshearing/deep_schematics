/**
 * *Whose path is this?* — the answer to a click on the ink, and **the third striking of the
 * conductor.**
 *
 * `ConductorCard` answers *what run of ink is this*, which is the extractor's reading of the paper
 * and a question the user has now struck three times: on 2026-09-13 as a thing to author, on
 * 2026-09-15 as a thing to view, and on 2026-09-17 as a thing to click. It is still on the screen
 * behind `?unclaimed=1` because *is the ink there, or did we miss it* has to stay answerable from
 * the screen — this is what the reader gets instead:
 *
 * > *"when clicking over a path, (not a conductor — we are not interested in conductors), the path
 * > would become highlighted and we would see an information box in the lower right that tells us
 * > about the path and the wire that owns the path."*
 *
 * ### The lower right, as asked — and it ends a fight rather than joining one
 *
 * `ConductorCard` and `SelectionCard` both sit `bottom-3 left-3` and there is a whole precedence
 * comment in `DrawingTab.tsx` about which of them wins. This one sits in the other corner, so it
 * **coexists** with the selection card: *what is this line* and *where is this identifier* are
 * different questions, and their answers no longer have to take turns.
 *
 * ### What it may not say
 *
 * **No `C####` anywhere in it.** The ink's own names are the extractor's, they are printed nowhere
 * on the paper, and not showing them is the whole of this line of work. `PathPick.conductors` is
 * read here only to tell a lift from a hand trace, which is a fact about how the *path* was
 * authored rather than a name for the ink.
 */

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { PathPick } from '@/lib/paths'
import { cn } from '@/lib/utils'
import { CardGrip, CopyCard, useCardDrag } from './CardChrome'

interface Props {
  pick: PathPick
  /** Go to the wire that owns this route. */
  onSelectWire: (wireId: string) => void
  /** Go to the block whose bus this is — the component, which is where its commoning lives. */
  onSelectBlock: (componentId: string) => void
  onClose: () => void
}

/** How the path came to exist, in the user's own two phrases. */
const GEOMETRY_WORD = {
  extracted: 'lifted from the drawing',
  human: 'you drew it',
} as const

export function PathCard({ pick, onSelectWire, onSelectBlock, onClose }: Props) {
  const { owner, runs, geometry, length } = pick
  const wire = owner.kind === 'wire'
  // Movable and copyable like the selection card (`talkthrough_03.md` §6), with its own place.
  const { ref, style, handleProps, dragging } = useCardDrag('path')

  return (
    <div
      ref={ref}
      style={style}
      // The viewer's pan handlers are on the container this sits inside.
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      data-path-card={owner.id}
      data-path-owner={owner.kind}
      data-path-geometry={geometry}
      className={cn(
        'pointer-events-auto absolute bottom-3 right-3 z-10 max-w-sm min-w-72 select-text',
        'rounded-lg border bg-card/95 p-3 pt-0 shadow-lg backdrop-blur-sm',
      )}
    >
      <CardGrip handleProps={handleProps} dragging={dragging} testId="path-card-handle" />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <button
              type="button"
              className="font-mono text-sm font-semibold underline-offset-2 hover:underline"
              onClick={() => (wire ? onSelectWire(owner.id) : onSelectBlock(owner.id))}
              title={
                wire
                  ? `Select ${owner.id} and read it in the list`
                  : `Select ${owner.id}, whose own bus this is`
              }
            >
              {owner.id}
            </button>
            <span className="text-[11px] text-muted-foreground">
              {wire ? 'this wire’s route' : 'this block’s own bus'}
            </span>
          </div>

          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            <span>{GEOMETRY_WORD[geometry]}</span>
            <span>
              {runs.length} run{runs.length === 1 ? '' : 's'}
            </span>
            {/* Along the ink, which is the only length this index can honestly give: it publishes
                no terminal coordinates, so the straight line between the pins — the number worth
                comparing it against — is the Locate tab's to print and not this card's. */}
            <span className="tabular-nums">{length.toFixed(1)} pt along the ink</span>
          </p>
        </div>
        <CopyCard card={ref} />
        <Button variant="ghost" size="icon" aria-label="Close the path" onClick={onClose}>
          <X />
        </Button>
      </div>

      {/* The same finding the conductor card spelled out, kept where a reader meets it: a block's
          bus is not field wire, which is why no wire may claim it and why it carries no printed
          name. Said here because this is now the only card a reader can reach it from. */}
      {!wire && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          A terminal block joins its own screws with this. It is not field wire, so no wire may
          claim it — which is why it carries no printed name.
        </p>
      )}

      {/**
        * **Where the control lives, not the control.** A reader has no editor password, and saying
        * where a thing is authored is not the same as offering to author it — that distinction is
        * what keeps this tab the reader's and the Locate tab the author's.
        */}
      <p className="mt-2 text-[10px] text-muted-foreground" data-path-where>
        {wire
          ? 'Drawn and corrected on the Locate tab, on this wire’s own row.'
          : 'Drawn and corrected on the Locate tab, under Commoning.'}
      </p>

      <p className="mt-1 text-[10px] text-muted-foreground">
        pointed at from {pick.off.toFixed(1)} pt away · conductor rows on this sheet are 16 pt apart
      </p>
    </div>
  )
}
