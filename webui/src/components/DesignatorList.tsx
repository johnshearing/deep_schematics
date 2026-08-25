/**
 * Every indexed designator, and whether anybody has said where it is.
 *
 * **One list, two screens.** It was `features/locate/WorkList.tsx` until 2026-08-25 and it moved
 * here unchanged, because the Drawing tab now shows the same 275 rows to a reader. Both tabs hand
 * it the same four props — `{entries, stateOf, targetId, onPick}` — and the reason to move it
 * rather than write a second one is the row itself: the state words, the `our id` badge, the
 * truncation and the `scrollIntoView` below are all decisions somebody made once, and two copies
 * of them would drift in exactly the way the two tabs' *vocabularies* must not.
 *
 * What each tab supplies is the part that genuinely differs: the editor computes `stateOf` from
 * its unsaved draft and arms a row for the next click on the sheet, and the reader computes it
 * from the published index (`readerRowState`) and *selects*. So nothing about editing is in here,
 * and the list works with `SWUI_ALLOW_EDITS=false` — which is the acceptance criterion for the
 * Drawing tab's list, not a nicety.
 *
 * On the editor's side the list *is* the editor. 275 entries on this drawing — 47 components, 131
 * terminals, 26 nets, 71 wires — and the only honest way to get from a vision pass's estimates to
 * a drawing you can trust is to walk them. So the row is deliberately plain and dense: an id you
 * can scan for, a state you can see without reading, and nothing that needs a decision to skip
 * past.
 *
 * **Nets and wires are shown and are not work.** Placing the 131 terminals gives all 71 wires
 * their two known ends for free; what a wire may still be missing is where its *printed name* is
 * written, which is optional. They are in the list anyway, because being able to see the
 * consequence of the terminals you just placed is most of what tells you whether you placed them
 * right — and, on the Drawing tab, because a net you cannot click is a net you cannot look at.
 */

import { useEffect, useRef } from 'react'
import { CircleCheck, CircleDashed, CircleSlash, Link2, Tag } from 'lucide-react'

import type { Designator } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { NOWHERE_LABEL, PLACEMENT_LABEL, type RowState } from '@/lib/designators'
import { cn } from '@/lib/utils'

/** Filled, hollow, hollow-and-quieter, computed, nowhere. Same vocabulary as the dots on the
 * sheet, so a row and its marker say the same thing — and the three placement words come from
 * `lib/designators` rather than being spelled again here, because the Drawing tab's member
 * roster shows the same three claims and the two must not drift into different English. */
const STATE: Record<RowState, { label: string; tone: string; Icon: typeof CircleCheck }> = {
  confirmed: {
    label: PLACEMENT_LABEL.confirmed,
    tone: 'text-[var(--color-success)]',
    Icon: CircleCheck,
  },
  seed: {
    label: PLACEMENT_LABEL.seed,
    tone: 'text-[var(--color-warning)]',
    Icon: CircleDashed,
  },
  parent: {
    label: PLACEMENT_LABEL.parent,
    tone: 'text-[var(--color-warning)]',
    Icon: CircleDashed,
  },
  // Its two ends are known and its printed name has not been placed. Both halves matter: the
  // first is why this is not work to do, the second is why the row is still clickable.
  //
  // It said *"route from its terminals"* until 2026-08-24, and that sentence is now false by
  // decision: a wire's route is lifted from the PDF's own conductor strokes or traced by a person,
  // and a path computed from the two endpoints is the one thing it may never be. Nothing about the
  // *state* changed — only a phrase that would have taught the reader the wrong rule.
  computed: {
    label: 'ends known, no path',
    tone: 'text-muted-foreground',
    Icon: Link2,
  },
  labelled: {
    label: 'label placed',
    tone: 'text-[var(--color-success)]',
    Icon: Tag,
  },
  none: {
    label: NOWHERE_LABEL,
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
  /** The row to shade and scroll to: the editor's armed target, or the reader's selection. */
  targetId: string | null
  onPick: (entry: Designator) => void
  /** What the list says when the filter or the search box matches nothing. Two tabs, two truths:
   * the editor filters by kind, the reader also has a text box. */
  emptyNote?: string
}

export function DesignatorList({ entries, stateOf, targetId, onPick, emptyNote }: Props) {
  /**
   * **Bring the armed row to where it can be seen.**
   *
   * The list is 275 rows and the armed one is marked only by its shading, so a target that
   * arrives from anywhere other than a click in the list — a dot on the sheet, the advance, a
   * site button on the panel, a citation in an answer — was being highlighted somewhere off
   * screen. The user then had to scroll the list hunting for the row the editor had already
   * chosen for them, which is exactly the searching this screen exists to remove.
   *
   * `block: 'nearest'` so a row that is already visible does not move: picking rows in the list
   * must not make the list jump under the pointer, and re-picking the row you are looking at
   * should do nothing at all.
   *
   * Keyed on the entries as well as the target, because changing the filter re-lays-out the list
   * under an unchanged target and the row lands somewhere new.
   */
  const armedRow = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    // Optional-called: jsdom has no layout and so no `scrollIntoView`, and a list that throws
    // when a row is picked is worse than one that does not scroll in a test.
    armedRow.current?.scrollIntoView?.({ block: 'nearest' })
  }, [targetId, entries])

  if (!entries.length) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {emptyNote ?? 'Nothing matches this filter.'}
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
          <li key={entry.id} ref={picked ? armedRow : undefined}>
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
