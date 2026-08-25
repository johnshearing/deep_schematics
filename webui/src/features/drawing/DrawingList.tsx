/**
 * The reader's way in to all 275 designators, down the left of the sheet.
 *
 * ### Why a reader needs a list at all
 *
 * Until now the only way to point at something on this tab was to already know where it was: click
 * a dot, or click an identifier in an answer. That left a hole with a name — `K9` in the manual —
 * **a net could not be selected from the sheet.** The dots are components, terminals and printed
 * names; a net is none of those, so the only route to net `120`'s highlight was a citation in an
 * answer, which costs a question and a wait. Typing `120` into a box is the same act with none of
 * the cost, and it works for the 275th entry as well as the first.
 *
 * ### The division of labour, which is the whole design of this screen
 *
 * **The switches in the toolbar change what the *drawing* shows. The buttons over this list change
 * what the *list* shows. The box narrows the list further. Neither set touches the other.** So a
 * wire can be picked out of the list and highlighted on the sheet while `Wires` is switched off —
 * the selection is a mode and always draws (H11) — and pressing `Nets` here hides 249 rows and
 * moves nothing on the paper.
 *
 * Saying it that plainly is worth a paragraph because the two rows of buttons look alike and sit a
 * few pixels apart, which is the strongest possible invitation to assume they are the same control
 * twice. They are not, and the words on them are deliberately the same words: `Components`,
 * `Terminals`, `Wires`, `Nets` name the same four groups everywhere in this application.
 *
 * ### Two smaller decisions
 *
 * **The four filters are independent, and none on means everything.** The Locate tab's filters are
 * exclusive because over there the filter picks the queue you are *working through*, and exactly
 * one at a time is what that means. Here you are looking something up: *terminals and nets*, or
 * everything, are both ordinary requests. It also matches the switches directly above — filled
 * means on, any combination is legal — rather than teaching two idioms for two rows of identical
 * buttons. And there is no *All* button because there is no state to get back from: pressing the
 * last live filter off leaves the whole index, which is where you started.
 *
 * **No fifth `Labels` filter**, deliberately: a label is not a row. It belongs to the wire or net
 * whose name it writes, which is a row, and giving it a filter of its own would imply the index
 * holds 265 more entries than it does.
 */

import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

import type { Designator, DesignatorKind } from '@/api/types'
import { DesignatorList } from '@/components/DesignatorList'
import { Button } from '@/components/ui/button'
import { readerRowState } from '@/lib/designators'
import { cn } from '@/lib/utils'

/** The four kinds the list can be narrowed to — every kind the index holds, and no label. */
export type ListKind = Extract<DesignatorKind, 'component' | 'terminal' | 'wire' | 'net'>

export const LIST_FILTERS: { id: ListKind; label: string; title: string }[] = [
  {
    id: 'component',
    label: 'Components',
    title: 'Show components in the list. This filters the list only — the sheet is unchanged.',
  },
  {
    id: 'terminal',
    label: 'Terminals',
    title: 'Show terminals in the list. This filters the list only — the sheet is unchanged.',
  },
  {
    id: 'wire',
    label: 'Wires',
    title: 'Show wires in the list. This filters the list only — the sheet is unchanged.',
  },
  {
    id: 'net',
    label: 'Nets',
    title: 'Show nets in the list. This filters the list only — the sheet is unchanged.',
  },
]

/**
 * The rows a filter set and a search string leave, as a pure function so it can be asserted
 * without a screen.
 *
 * An empty `kinds` is **every** kind rather than none: see the header. The text is matched against
 * the id *and* the one-line label, case-insensitively, as a plain substring — `relay` finds the
 * eleven relays by their description and `TB-1` finds the terminal block by its id, and neither is
 * a pattern the reader has to learn. It is not the citation allowlist and does not need to be:
 * nothing here is minted from model output, and the worst a loose match can do is show a row.
 */
export function filterEntries(
  entries: readonly Designator[],
  kinds: ReadonlySet<ListKind>,
  text: string,
): Designator[] {
  const needle = text.trim().toLowerCase()
  return entries.filter((entry) => {
    if (kinds.size && !kinds.has(entry.kind as ListKind)) return false
    if (!needle) return true
    return (
      entry.id.toLowerCase().includes(needle) || (entry.label ?? '').toLowerCase().includes(needle)
    )
  })
}

interface Props {
  /** Everything, in the list's order, for the count. */
  total: number
  /** What `filterEntries` left. */
  entries: Designator[]
  kinds: ReadonlySet<ListKind>
  onToggleKind: (kind: ListKind) => void
  text: string
  onText: (text: string) => void
  /** The selected row — shaded, and scrolled to when the selection arrived from elsewhere. */
  selectedId: string | null
  onPick: (entry: Designator) => void
  open: boolean
  onOpen: (open: boolean) => void
}

export function DrawingList({
  total,
  entries,
  kinds,
  onToggleKind,
  text,
  onText,
  selectedId,
  onPick,
  open,
  onOpen,
}: Props) {
  /**
   * Closed, it is a rail rather than nothing.
   *
   * A panel that vanishes leaves a reader looking for the button that brings it back, and on a
   * screen whose whole point is a 1224 pt drawing the honest trade is a few pixels for a way back
   * in. The rail says how many rows are waiting, because that number is the reason to reopen it.
   */
  if (!open) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center border-r py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Show the list"
          title={`Show the list of all ${total} identifiers on this drawing`}
          aria-expanded={false}
          onClick={() => onOpen(true)}
        >
          <ChevronRight />
        </Button>
        <span className="mt-1 text-[10px] tabular-nums text-muted-foreground">{total}</span>
      </div>
    )
  }

  return (
    <div className="flex w-72 shrink-0 flex-col border-r">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <span className="flex-1 text-[11px] font-medium">
          Index{' '}
          <span className="tabular-nums text-muted-foreground">
            {entries.length === total ? total : `${entries.length} of ${total}`}
          </span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide the list"
          title="Collapse the list and give the space to the drawing"
          aria-expanded
          onClick={() => onOpen(false)}
        >
          <ChevronLeft />
        </Button>
      </div>

      <div className="relative border-b px-2 py-1.5">
        <Search className="absolute top-1/2 left-3.5 size-3 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={text}
          onChange={(event) => onText(event.target.value)}
          aria-label="Search the list"
          placeholder="Find an id or a description"
          className={cn(
            'h-7 w-full rounded border bg-background pr-2 pl-6 text-xs',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none',
          )}
        />
      </div>

      {/* Labelled as a group so that `Components` here and `Components` in the toolbar are
          distinguishable to a screen reader — and to a test — without either of them having to be
          renamed into something a person would not say out loud. */}
      <div
        role="group"
        aria-label="Filter the list"
        className="flex flex-wrap gap-1 border-b px-2 py-1.5"
      >
        {LIST_FILTERS.map(({ id, label, title }) => (
          <Button
            key={id}
            variant={kinds.has(id) ? 'default' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[11px]"
            aria-pressed={kinds.has(id)}
            title={title}
            onClick={() => onToggleKind(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DesignatorList
          entries={entries}
          /* The **index's** answer, not the editor's draft: this list is a reader's and has to
             work on a server started without `SWUI_ALLOW_EDITS`, where there is no draft and no
             Locate tab at all. */
          stateOf={readerRowState}
          targetId={selectedId}
          onPick={onPick}
          emptyNote={
            /* Three different silences, and telling them apart is the whole value of saying
               anything: nobody has typed anything and there is no index yet, a filter is on, or
               the search found nothing. "Nothing matches" while the index is still arriving would
               be a lie about the drawing. */
            total === 0
              ? 'The index has not arrived yet.'
              : text.trim()
                ? `Nothing here matches “${text.trim()}”.`
                : 'Nothing matches these filters.'
          }
        />
      </div>

      <p className="border-t px-2 py-1 text-[10px] leading-snug text-muted-foreground">
        These buttons filter <span className="font-medium text-foreground">this list</span>. The
        switches above the sheet decide what the{' '}
        <span className="font-medium text-foreground">drawing</span> shows. Click a row to select
        it — a wire or a net highlights even with its own switch off.
      </p>
    </div>
  )
}
