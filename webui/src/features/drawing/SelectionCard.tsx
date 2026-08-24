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

import { Crosshair, X } from 'lucide-react'

import type { Designator, EntryTerminal } from '@/api/types'
import { Button } from '@/components/ui/button'
import { KIND_LABEL, placementLabel } from '@/lib/designators'
import { cn } from '@/lib/utils'

interface Props {
  entry: Designator
  /** Members that have a location, so the chips only offer places we can actually go. */
  canSelect: (componentId: string) => boolean
  onSelectMember: (componentId: string) => void
  /** Fly to one of the member terminals and select it. */
  onSelectTerminal: (terminalId: string) => void
  /** Arm this pin on the Locate tab. Absent on a server started without an editor, which is the
   * normal state of a reader's copy — the roster still says what it knows, it just cannot offer
   * to fix it. */
  onPlaceTerminal?: (terminalId: string) => void
  onAsk: () => void
  onClose: () => void
}

/**
 * The card, and for a net or a wire **a roster of what it is made of.**
 *
 * The roster replaced a row of component chips as the substance of a net's card, and the reason
 * is the same one that put `terminals` in the payload: net 120 is seven *terminals*, and its
 * components were a coarser and occasionally misleading summary of them — `CR2` names a coil the
 * net does not touch, and `TB-120` names one dot where there are three. So the members are
 * listed as themselves, each saying how well its point is known, each a click away from being
 * flown to. The component chips stay below, demoted to what they are: which components the run
 * passes through.
 */
export function SelectionCard({
  entry,
  canSelect,
  onSelectMember,
  onSelectTerminal,
  onPlaceTerminal,
  onAsk,
  onClose,
}: Props) {
  // Its own members are noise on a component; on a net or a wire they are the substance.
  const members = entry.kind === 'component' ? [] : entry.members
  const terminals = entry.kind === 'component' ? [] : (entry.terminals ?? [])

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

      {terminals.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] text-muted-foreground">
            {terminals.length === 2 ? 'ends' : `${terminals.length} terminals`}
          </p>
          {/* Scrollable rather than truncated: net 130 has the most members on this sheet, and a
              roster that quietly stops at six is a roster you cannot trust to be the membership. */}
          <ul className="mt-1 max-h-44 divide-y overflow-y-auto rounded border">
            {terminals.map((member, index) => (
              <MemberRow
                // Undeduped by design, so the id alone is not a key.
                key={`${member.id}@${index}`}
                member={member}
                onSelect={() => onSelectTerminal(member.id)}
                onPlace={onPlaceTerminal && (() => onPlaceTerminal(member.id))}
              />
            ))}
          </ul>
        </div>
      )}

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

/** One member terminal: its id, how well its point is known, and — when there is an editor —
 * the way to go and fix it. `nowhere` is not clickable, because there is nowhere to fly to. */
function MemberRow({
  member,
  onSelect,
  onPlace,
}: {
  member: EntryTerminal
  onSelect: () => void
  onPlace?: () => void
}) {
  const known = member.placement
  return (
    <li className="flex items-center gap-1.5 px-1.5 py-1">
      <button
        type="button"
        disabled={!member.point}
        title={member.point ? `Go to ${member.id}` : `${member.id} has no point on this sheet`}
        onClick={onSelect}
        className={cn(
          'min-w-0 flex-1 truncate text-left font-mono text-[11px]',
          member.point ? 'hover:underline' : 'text-muted-foreground opacity-60',
        )}
      >
        {member.id}
      </button>
      <span
        className={cn(
          'shrink-0 text-[10px]',
          known === 'confirmed' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]',
          !known && 'text-muted-foreground',
        )}
      >
        {placementLabel(known)}
      </span>
      {onPlace && known !== 'confirmed' && (
        <button
          type="button"
          aria-label={`Place ${member.id}`}
          title={`Arm ${member.id} on the Locate tab so the next click on the sheet places it`}
          onClick={onPlace}
          className="flex shrink-0 items-center gap-0.5 rounded border px-1 text-[10px] hover:bg-accent"
        >
          <Crosshair className="size-2.5" />
          place it
        </button>
      )}
    </li>
  )
}
