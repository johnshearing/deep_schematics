/**
 * What the thing you just clicked on actually is — for free, and instantly.
 *
 * Half of this job is answering "where is `CR-BP`". The other half is that once you are there,
 * the next question is "and what is it?" — which `circuit_logic.json` already answers, at no
 * cost and with no model in the loop. That is `webui_ideas.md` §4's thesis applied to a click:
 * spend the model only on what the netlist cannot say by itself.
 *
 * Pinned to a corner of the viewer rather than anchored to the marker. An anchored popover has
 * to dodge the container edges and would sit on top of the very thing it describes, which is
 * the one part of the screen the reader is looking at.
 */

import { X } from 'lucide-react'

import type { Designator } from '@/api/types'
import { Button } from '@/components/ui/button'
import { KIND_LABEL } from '@/lib/designators'
import { cn } from '@/lib/utils'

interface Props {
  entry: Designator
  /** Members that have a location, so the chips only offer places we can actually go. */
  canSelect: (componentId: string) => boolean
  onSelectMember: (componentId: string) => void
  onAsk: () => void
  onClose: () => void
}

export function SelectionCard({ entry, canSelect, onSelectMember, onAsk, onClose }: Props) {
  // Its own members are noise on a component; on a net or a wire they are the substance.
  const members = entry.kind === 'component' ? [] : entry.members

  return (
    <div
      // The viewer's pan handlers are on the container this sits inside.
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn(
        'pointer-events-auto absolute bottom-3 left-3 z-10 max-w-sm min-w-72',
        'rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur-sm',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-sm font-semibold">{entry.id}</span>
            <span className="text-[11px] text-muted-foreground">{KIND_LABEL[entry.kind]}</span>
            {!entry.on_sheet && (
              // The reader is holding the sheet. `prompts.py` makes the model say this in
              // prose; the UI has to say it too, or a click implies a label that is not there.
              <span
                className="rounded border border-[var(--color-warning)]/50 px-1 text-[10px] text-[var(--color-warning)]"
                title="An identifier assigned during extraction. You will not find it printed on the drawing."
              >
                our id
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.label}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Clear selection" onClick={onClose}>
          <X />
        </Button>
      </div>

      {members.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-muted-foreground">runs through</span>
          {members.map((id) => (
            <button
              key={id}
              type="button"
              disabled={!canSelect(id)}
              title={canSelect(id) ? `Go to ${id}` : `${id} has no location on this sheet`}
              onClick={() => onSelectMember(id)}
              className={cn(
                'rounded border px-1 py-px font-mono text-[10px]',
                canSelect(id)
                  ? 'hover:bg-accent hover:text-accent-foreground'
                  : 'text-muted-foreground opacity-60',
              )}
            >
              {id}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex justify-end">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onAsk}>
          Ask about this
        </Button>
      </div>
    </div>
  )
}
