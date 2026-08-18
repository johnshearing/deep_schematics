/**
 * Every indexed designator, and whether anybody has said where it is.
 *
 * The list is the editor. 275 entries on this drawing — 47 components, 131 terminals, 26 nets,
 * 71 wires — and the only honest way to get from a vision pass's estimates to a drawing you can
 * trust is to walk them. So the row is deliberately plain and dense: an id you can scan for, a
 * state you can see without reading, and nothing that needs a decision to skip past.
 *
 * **Nets and wires are shown and are not work.** A wire's geometry is its two endpoint terminals
 * and a net's is its members, so they are computed and never placed — placing the 131 terminals
 * gives all 71 wires their positions for free. They are in the list anyway, marked `computed`,
 * because being able to see the consequence of the terminals you just placed is most of what
 * tells you whether you placed them right.
 */

import { CircleCheck, CircleDashed, CircleSlash, Link2, Tag } from 'lucide-react'

import type { Designator } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RowState } from './model'

/** Filled, hollow, hollow-and-quieter, computed, nowhere. Same vocabulary as the dots on the
 * sheet, so a row and its marker say the same thing. */
const STATE: Record<RowState, { label: string; tone: string; Icon: typeof CircleCheck }> = {
  confirmed: {
    label: 'placed',
    tone: 'text-[var(--color-success)]',
    Icon: CircleCheck,
  },
  seed: {
    label: 'estimate',
    tone: 'text-[var(--color-warning)]',
    Icon: CircleDashed,
  },
  parent: {
    label: "on its component",
    tone: 'text-[var(--color-warning)]',
    Icon: CircleDashed,
  },
  // Its route is known and its name has not been placed. Both halves matter: the first is why
  // this is not work to do, the second is why the row is still clickable.
  computed: {
    label: 'route from its terminals',
    tone: 'text-muted-foreground',
    Icon: Link2,
  },
  labelled: {
    label: 'label placed',
    tone: 'text-[var(--color-success)]',
    Icon: Tag,
  },
  none: {
    label: 'nowhere',
    tone: 'text-muted-foreground',
    Icon: CircleSlash,
  },
}

export const STATE_LABEL: Record<RowState, string> = {
  confirmed: STATE.confirmed.label,
  seed: STATE.seed.label,
  parent: STATE.parent.label,
  computed: STATE.computed.label,
  labelled: STATE.labelled.label,
  none: STATE.none.label,
}

interface Props {
  entries: Designator[]
  stateOf: (entry: Designator) => RowState
  targetId: string | null
  onPick: (entry: Designator) => void
}

export function WorkList({ entries, stateOf, targetId, onPick }: Props) {
  if (!entries.length) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        Nothing matches this filter.
      </p>
    )
  }

  return (
    <ul className="divide-y" role="listbox" aria-label="Indexed designators">
      {entries.map((entry) => {
        const state = stateOf(entry)
        const { label, tone, Icon } = STATE[state]
        const picked = entry.id === targetId
        return (
          <li key={entry.id}>
            <button
              type="button"
              role="option"
              aria-selected={picked}
              onClick={() => onPick(entry)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                picked && 'bg-accent',
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', tone)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-foreground">{entry.id}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {entry.label}
                </span>
              </span>
              {!entry.on_sheet && (
                <Badge
                  tone="default"
                  title="This identifier was invented during extraction — you will not find it printed on the sheet."
                >
                  our id
                </Badge>
              )}
              <span className={cn('shrink-0 text-[11px]', tone)}>{label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
