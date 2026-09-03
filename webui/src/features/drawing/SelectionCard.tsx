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

import { ArrowLeft, Crosshair, X } from 'lucide-react'

import type { Designator, DesignatorKind, EntryTerminal } from '@/api/types'
import { Button } from '@/components/ui/button'
import { KIND_LABEL, placementLabel } from '@/lib/designators'
import type { PathSummary } from '@/lib/paths'
import { cn } from '@/lib/utils'

interface Props {
  entry: Designator
  /** What is highlighted on the sheet for this selection, and how it is known. Null for a
   * component or a terminal, which have no route in the way a stone has no opinion. */
  path?: PathSummary | null
  /** Members that have a location, so the chips only offer places we can actually go. */
  canSelect: (componentId: string) => boolean
  onSelectMember: (componentId: string) => void
  /** Fly to one of the member terminals and select it. */
  onSelectTerminal: (terminalId: string) => void
  /** What sent the reader to this card, when something did. Null for a citation, a click on a
   * dot, or a net nobody arrived at from anywhere. */
  back?: { kind: DesignatorKind; id: string } | null
  onBack?: () => void
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
  path = null,
  canSelect,
  onSelectMember,
  onSelectTerminal,
  back = null,
  onBack,
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
      {/* The way back to the roster, above the heading rather than beside the ✕, because it is
          about where you *were* and the rest of the card is about where you are. Offered only
          when something actually sent you here — a roster row or a `runs through` chip — so a
          citation's card and a click on a dot look exactly as they did. */}
      {back && onBack && (
        <button
          type="button"
          onClick={onBack}
          title={`Back to ${KIND_LABEL[back.kind]} ${back.id}${
            back.kind === 'net' || back.kind === 'wire' ? ', and its list of terminals' : ''
          }`}
          className={cn(
            'mb-1.5 flex items-center gap-1 text-[11px] text-muted-foreground',
            'hover:text-foreground focus-visible:text-foreground focus-visible:outline-none',
          )}
        >
          <ArrowLeft className="size-3" />
          back to <span className="font-mono">{back.id}</span>
        </button>
      )}

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

      {path && <PathNote entry={entry} path={path} />}

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

/**
 * What is highlighted, in one line — **and what is not, which is the half that matters today.**
 *
 * Until Session 6 there is no path editor, so almost every wire on this sheet has no route yet.
 * A card that said nothing about it would leave a reader deciding between *this wire has no path*
 * and *this screen is broken*, on the evidence of an unhighlighted drawing. So the absence is
 * stated, with the count that makes it legible: a net with four wires and none of them traced is
 * a different thing from a net with no wires.
 *
 * The two provenance badges are the amendment of 2026-08-23 made visible. `lifted from the ink`
 * is the PDF's own vector strokes; `hand-traced` is a person following the printed run, and it
 * says so **everywhere it appears** — that was a condition of allowing hand tracing at all.
 */
function PathNote({ entry, path }: { entry: Designator; path: PathSummary }) {
  const wires = entry.kind === 'net' ? `${path.wires} wire${path.wires === 1 ? '' : 's'}` : null

  if (path.traced === 0) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground">
        no path yet
        {wires ? ` — none of its ${wires} has one` : ''}, so nothing is highlighted
      </p>
    )
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
      <span>
        highlighted
        {wires ? `: ${path.traced} of its ${wires}` : ''}
      </span>
      <Badge
        title={
          path.geometry === 'human'
            ? 'Traced by hand along the printed conductor.'
            : path.geometry === 'mixed'
              ? 'Some of these runs are the PDF\u2019s own strokes and some were traced by hand.'
              : 'Lifted from the PDF\u2019s own vector strokes — not a reading of them, and never a line between the wire\u2019s ends.'
        }
      >
        {GEOMETRY_WORD[path.geometry ?? 'extracted']}
      </Badge>
      <Badge
        title={
          path.attribution === 'printed'
            ? 'The net name printed beside this conductor matches this wire\u2019s net.'
            : path.attribution === 'mixed'
              ? 'Some of these runs were matched by their printed name and some were assigned by a person.'
              : 'A person said this run belongs to this wire.'
        }
      >
        {ATTRIBUTION_WORD[path.attribution ?? 'human']}
      </Badge>
      {path.conductors.length > 0 && (
        <span className="font-mono" title="The conductors in geometry.json these runs came from">
          {path.conductors.join(' ')}
        </span>
      )}
    </div>
  )
}

const GEOMETRY_WORD: Record<string, string> = {
  extracted: 'lifted from the ink',
  human: 'hand-traced',
  mixed: 'part hand-traced',
}

const ATTRIBUTION_WORD: Record<string, string> = {
  printed: 'matched by its printed name',
  human: 'assigned by hand',
  mixed: 'part assigned by hand',
}

function Badge({ children, title }: { children: string; title: string }) {
  return (
    <span className="rounded border px-1 text-[10px]" title={title}>
      {children}
    </span>
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
