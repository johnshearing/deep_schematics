/**
 * Where this wire runs — **the machine proposes, a person accepts, and the file records which.**
 *
 * ### The three things this panel is for
 *
 * They are the three requirements the phase was asked for, in order:
 *
 * 1. **Where the information exists, offer it.** The ranked candidate runs, each lighting on the
 *    sheet as you hover, one click to accept. 37 of the 71 wires have a single run whose two ends
 *    land on both of their placed pins — those are a glance and a click.
 * 2. **Let it be checked and changed.** An accepted route shows both provenance badges, the runs it
 *    was lifted from, and its length beside the straight line it is *not*. **Clear**, re-pick, and
 *    — for a hand-traced route — draggable corners.
 * 3. **Where it does not exist, let one be drawn.** **Trace**, corner by corner, offered *after*
 *    the unlabelled runs because 79 unlabelled conductors are real ink and beat a hand trace every
 *    time.
 *
 * ### Why a single candidate still asks for a click
 *
 * Because that is the whole reason this application is trustworthy. A better guesser was built for
 * the component positions and rejected: at 11 pt median error against 16 pt conductor rows, a
 * proposal has to be audited, auditing costs about what deciding costs, and it costs **more** when
 * the proposal is confidently wrong — because first you have to notice. One conductor on this pitch
 * is exactly that case. So there is no *accept all*, no auto-accept for an exact match, and
 * `attribution` says **`human`** on every route this panel writes, even the ones the printed name
 * chose.
 *
 * ### Why an extracted run cannot be dragged
 *
 * `geometry: extracted` is a claim about the polyline: *these corners are the drawing's, not
 * mine*. Moving one would leave that claim standing over a line a person had altered, which is the
 * same class of lie as storing a computed label side as though somebody had chosen it. So the
 * conversion to `geometry: human` is an explicit press, stated before it happens, and it takes the
 * `conductors` list with it — the run is no longer the run it was lifted from.
 */

import { useMemo, useState } from 'react'
import { Ban, Check, PencilLine, Plus, Trash2 } from 'lucide-react'

import type { Conductor, Designator, LocationsDocument, Polyline } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  candidates as rank,
  chordOf,
  lengthOf,
  type Candidate,
  type Reason,
} from './paths'
import {
  addRun,
  clearPath,
  convertPath,
  pathOf,
  setNoPath,
  setPath,
  storedLabel,
  type Stamp,
} from './model'

/**
 * How many proposals the list shows before it says *and N more*.
 *
 * Measured on this drawing: the median wire has six candidates and the busiest has fourteen, most
 * of the tail being other runs on the same net elsewhere on the sheet. Six is enough to hold every
 * candidate with a pin on it for almost every wire, and a list of fourteen is a wall rather than a
 * proposal. Nothing is hidden — the rest are one press away.
 */
const SHOWN = 6

/** What each reason means, in a sentence, because the ranking is only trustworthy if it says why. */
const WHY: Record<Reason, string> = {
  'both ends': 'Both of this wire’s placed pins are on this run’s two ends.',
  'one end': 'One of them is. That is half a route — the normal shape across a crossover hop.',
  'printed name': 'The net name printed beside it is this wire’s net.',
  'corrected name': 'Its net name is one a person read off the paper and corrected.',
  spec: 'Its printed colour and gauge are this wire’s.',
  'colour only': 'Its colour matches and its gauge does not.',
  nearby: 'No net name is printed on it, and it runs close to this wire.',
  'another net': 'A different net’s name is printed beside it — but the geometry fits. Look twice.',
  suspect: 'Shorter than 15 pt, or a closed loop. 46 runs on this sheet are symbol strokes.',
}

interface Props {
  entry: Designator
  document: LocationsDocument
  /** Null while the ink has not arrived, or if it could not be read. `[]` is a drawing with no
   * vector extraction beside it — a different thing, and still traceable by hand. */
  conductors: Conductor[] | null
  /** The wire's net, and the name the sheet prints for it where that differs (`K10`). */
  net: string | null
  printedNet: string | null
  /** Corners so far, when a hand trace is in progress. Owned by the tab, because the clicks that
   * add them land on the sheet. */
  tracing: [number, number][] | null
  stamp: () => Stamp
  onEdit: (change: (d: LocationsDocument) => LocationsDocument, note?: string) => void
  /** Light one proposal, or a set of them, on the sheet. `null` puts the sheet back. */
  onPreview: (runs: Polyline[] | null) => void
  onTrace: (start: boolean) => void
}

export function PathPanel({
  entry,
  document,
  conductors,
  net,
  printedNet,
  tracing,
  stamp,
  onEdit,
  onPreview,
  onTrace,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const path = pathOf(document, entry.id)
  const none = Boolean(storedLabel(document, entry.id)?.no_path_on_this_sheet)

  const proposals = useMemo(
    () => (conductors ? rank(entry, conductors, { net, printedNet }) : []),
    [entry, conductors, net, printedNet],
  )

  const chord = chordOf(entry)

  if (tracing) return <Tracing corners={tracing} chord={chord} />

  return (
    <div className="space-y-1.5 border-t pt-1.5" data-path-panel={entry.id}>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium">Where it runs</span>
        {path && (
          <>
            {/* The two axes, always both, because a lifted conductor is **exact geometry with
                uncertain attribution** and that pair is precisely what a person is confirming. */}
            <Badge
              tone={path.geometry === 'human' ? 'warning' : 'info'}
              title={
                path.geometry === 'human'
                  ? 'Traced by hand along the printed conductor. Not the PDF’s own strokes.'
                  : 'Lifted from the PDF’s own vector strokes — not a reading of them.'
              }
            >
              {path.geometry === 'human' ? 'hand-drawn' : 'from the ink'}
            </Badge>
            <Badge
              tone="default"
              title="Who says this run is this wire’s. Always a person: nothing here accepts a ranking on its own."
            >
              {path.attribution === 'printed' ? 'printed match' : 'you said so'}
            </Badge>
          </>
        )}
      </div>

      {path ? (
        <Accepted
          entry={entry}
          path={path}
          chord={chord}
          conductors={conductors}
          net={net}
          printedNet={printedNet}
          stamp={stamp}
          onEdit={onEdit}
          onPreview={onPreview}
        />
      ) : none ? (
        <p className="text-[11px] text-muted-foreground">
          Nothing to trace on this sheet — you said so. That is a decision, not a gap, and it is
          what lets the count reach {' '}
          <span className="font-mono">71</span> instead of stopping short at the wires whose run is
          on another drawing.
        </p>
      ) : conductors === null ? (
        <p className="text-[11px] text-muted-foreground">
          The extracted ink did not load, so there is nothing to offer you. Everything else on this
          screen still works, and <span className="font-medium">Trace</span> below does too.
        </p>
      ) : proposals.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No run of ink is near either of this wire&apos;s pins and none carries its net name. Trace
          it by hand, or say there is nothing here.
        </p>
      ) : (
        <ul className="space-y-1" aria-label={`Candidate runs for ${entry.id}`}>
          {(expanded ? proposals : proposals.slice(0, SHOWN)).map((candidate) => (
            <CandidateRow
              key={candidate.conductor.id}
              candidate={candidate}
              first={candidate === proposals[0]}
              onHover={(on) => onPreview(on ? [candidate.conductor.points] : null)}
              onAccept={() => {
                onPreview(null)
                onEdit(
                  (d) =>
                    setPath(
                      d,
                      entry.id,
                      [candidate.conductor.points],
                      [candidate.conductor.id],
                      stamp(),
                    ),
                  `traced ${entry.id} along ${candidate.conductor.id}`,
                )
              }}
            />
          ))}
          {proposals.length > SHOWN && (
            <li>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-[11px]"
                onClick={() => setExpanded((on) => !on)}
              >
                {expanded ? 'fewer' : `and ${proposals.length - SHOWN} more`}
              </Button>
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px]"
          title={
            'Draw the route corner by corner along the printed conductor. Click each corner, ' +
            'Enter to finish, Backspace to take one back, Esc to abandon. It is the last resort ' +
            'on purpose: a run out of the PDF is exact geometry and a hand trace is not.'
          }
          onClick={() => onTrace(true)}
        >
          <PencilLine />
          Trace by hand
        </Button>
        {!path && (
          <Button
            variant={none ? 'default' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[11px]"
            aria-pressed={none}
            title={
              none
                ? 'Take that back: this wire goes back to needing a route.'
                : 'This wire’s run is not on this sheet — a connector whose other end is on ' +
                  'another drawing. A decision, not a gap, and it is what lets the count reach 71.'
            }
            onClick={() =>
              onEdit(
                (d) => setNoPath(d, entry.id, !none),
                none
                  ? `${entry.id} needs a path again`
                  : `said ${entry.id} has no path on this sheet`,
              )
            }
          >
            <Ban />
            No path on this sheet
          </Button>
        )}
      </div>
    </div>
  )
}

/** One proposal. The row leads with its strongest reason and lists the rest, because a ranking
 * nobody can check is a ranking nobody should trust. */
function CandidateRow({
  candidate,
  first,
  onHover,
  onAccept,
}: {
  candidate: Candidate
  first: boolean
  onHover: (on: boolean) => void
  onAccept: () => void
}) {
  const { conductor, reasons, fit } = candidate
  return (
    <li data-candidate={conductor.id}>
      <button
        type="button"
        className={cn(
          'w-full rounded-md border px-2 py-1 text-left hover:bg-accent',
          first && 'border-[var(--color-ring)]',
          reasons.includes('suspect') && 'opacity-60',
        )}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        onClick={onAccept}
        title={`Accept this run as ${' '}where this wire goes.\n${reasons
          .map((reason) => `• ${WHY[reason]}`)
          .join('\n')}`}
      >
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-[11px] text-foreground">{conductor.id}</span>
          {conductor.net_label && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {conductor.net_label}
            </span>
          )}
          {conductor.spec_label && (
            <span className="truncate text-[10px] text-muted-foreground">
              {conductor.spec_label}
            </span>
          )}
          {fit !== null && (
            <span
              className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground"
              title="How far this run’s ends are from the pins it was matched against. Conductor rows on this sheet are 16 pt apart."
            >
              {fit.toFixed(1)} pt
            </span>
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-1">
          {reasons.map((reason) => (
            <span
              key={reason}
              className={cn(
                'rounded px-1 text-[9px]',
                reason === 'both ends'
                  ? 'bg-[var(--color-success)]/15 text-foreground'
                  : reason === 'another net' || reason === 'suspect'
                    ? 'bg-[var(--color-danger)]/15 text-foreground'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {reason}
            </span>
          ))}
        </span>
      </button>
    </li>
  )
}

/** An accepted route: what it is, what it cost, and every way to change your mind. */
function Accepted({
  entry,
  path,
  chord,
  conductors,
  net,
  printedNet,
  stamp,
  onEdit,
  onPreview,
}: {
  entry: Designator
  path: NonNullable<ReturnType<typeof pathOf>>
  chord: number | null
  conductors: Conductor[] | null
  net: string | null
  printedNet: string | null
  stamp: () => Stamp
  onEdit: Props['onEdit']
  onPreview: Props['onPreview']
}) {
  const ink = lengthOf(path.runs)
  const lifted = path.geometry === 'extracted'
  /**
   * What could be appended: the same ranking, minus the runs already in.
   *
   * **The same ranking on purpose**, rather than a list of everything nearby. The piece that
   * continues a route is the one whose end lands on the pin the accepted piece did not reach, and
   * `candidates()` already puts a run with a pin on it above one without — so the run at the top of
   * this list is the other half of the wire. On `W068` that is `C0057`, the 3-segment detour out to
   * x = 798.
   */
  const more = useMemo(
    () =>
      conductors
        ? rank(entry, conductors, { net, printedNet }).filter(
            (candidate) => !path.conductors?.includes(candidate.conductor.id),
          )
        : [],
    [conductors, entry, net, printedNet, path.conductors],
  )

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">
        {path.runs.length === 1 ? 'One run' : `${path.runs.length} runs`}
        {path.conductors?.length ? (
          <>
            {' '}
            along{' '}
            <span className="font-mono text-foreground">{path.conductors.join(' + ')}</span>
          </>
        ) : (
          ' you drew'
        )}
        , <span className="tabular-nums">{ink}</span> pt of ink
        {chord !== null && (
          <span
            title="The straight line between this wire’s two pins, for comparison only — it is never drawn. W068’s is 312 pt against 644 pt of conductor."
          >
            {' '}
            against a <span className="tabular-nums">{chord}</span> pt chord
          </span>
        )}
        .
      </p>

      {path.runs.length > 1 && (
        <p className="text-[10px] text-muted-foreground">
          The gap between them is a crossover hop and is drawn as a gap: the sheet puts a hop arc
          there to mean <span className="italic">no connection</span>, so closing it would be
          drawing a join nobody drew.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          title="Take the route back. The end labels and the printed name in the same record stay exactly as they are."
          onClick={() => {
            onPreview(null)
            onEdit((d) => clearPath(d, entry.id), `cleared ${entry.id}'s path`)
          }}
        >
          <Trash2 />
          Clear
        </Button>
        {more.length > 0 && (
          <AddRun
            entry={entry}
            proposals={more}
            taken={path.conductors ?? []}
            stamp={stamp}
            onEdit={onEdit}
            onPreview={onPreview}
          />
        )}
        {lifted ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            title="These corners are the drawing’s, not yours, and the file says so. To move one, the route has to stop claiming that first — this converts it to hand-drawn and drops the conductor ids, because it is no longer the run it was lifted from."
            onClick={() =>
              onEdit(
                (d) => convertPath(d, entry.id, stamp()),
                `made ${entry.id}'s path hand-drawn so it can be edited`,
              )
            }
          >
            <PencilLine />
            Make it editable
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            Drag a corner on the sheet to move it.
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Append a second run — **the crossover hop.**
 *
 * A separate control from accepting, because they are different acts: accepting *replaces* the
 * route, and this *continues* it. `W068` is the case it exists for — one physical wire, two
 * conductor records, a 3.5 pt gap between them — and 33 of the 71 wires have a best candidate that
 * reaches only one of their two pins, which is what half a route looks like from here.
 */
function AddRun({
  entry,
  proposals,
  taken,
  stamp,
  onEdit,
  onPreview,
}: {
  entry: Designator
  /** Already ranked, and already without the runs this path holds. */
  proposals: Candidate[]
  taken: string[]
  stamp: () => Stamp
  onEdit: Props['onEdit']
  onPreview: Props['onPreview']
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[11px]"
        aria-expanded={open}
        title="A route may be several runs: where the drawing puts a crossover hop the ink really does stop and start again, and the path shows the gap rather than closing it."
        onClick={() => setOpen((on) => !on)}
      >
        <Plus />
        Add a run
      </Button>
      {open && (
        <ul
          className="w-full space-y-1 rounded-md border p-1"
          aria-label={`Runs to add to ${entry.id}`}
        >
          {proposals.slice(0, SHOWN).map(({ conductor, reasons }) => (
            <li key={conductor.id} data-add-run={conductor.id}>
              <button
                type="button"
                className="flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left hover:bg-accent"
                onMouseEnter={() => onPreview([conductor.points])}
                onMouseLeave={() => onPreview(null)}
                onClick={() => {
                  onPreview(null)
                  setOpen(false)
                  onEdit(
                    (d) => addRun(d, entry.id, conductor.points, conductor.id, stamp()),
                    `added ${conductor.id} to ${entry.id}'s path`,
                  )
                }}
              >
                <Check className="size-3 opacity-40" />
                <span className="font-mono text-[11px]">{conductor.id}</span>
                {conductor.net_label && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {conductor.net_label}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">
                  {reasons[0]}
                </span>
              </button>
            </li>
          ))}
          {taken.length > 0 && (
            <li className="px-1 text-[10px] text-muted-foreground">
              already in: <span className="font-mono">{taken.join(', ')}</span>
            </li>
          )}
        </ul>
      )}
    </>
  )
}

/** A hand trace in progress: the count, and the four keys. Nothing is written until `Enter`. */
function Tracing({ corners, chord }: { corners: [number, number][]; chord: number | null }) {
  return (
    <div className="space-y-1 border-t pt-1.5" data-tracing>
      <p className="text-[11px] font-medium">Tracing by hand</p>
      <p className="text-[11px] text-muted-foreground">
        {corners.length === 0
          ? 'Click the first corner on the sheet, following the printed conductor.'
          : `${corners.length} corner${corners.length === 1 ? '' : 's'} so far` +
            (corners.length > 1 ? ` · ${lengthOf([corners])} pt of line` : '')}
        {chord !== null && corners.length > 1 && (
          <span> against a {chord} pt straight line between the pins.</span>
        )}
      </p>
      <p className="text-[10px] text-muted-foreground">
        <Key>Enter</Key> finishes · <Key>Backspace</Key> takes back a corner · <Key>Esc</Key>{' '}
        abandons it. Two corners is the minimum: one point is not a run.
      </p>
    </div>
  )
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border px-1 py-px font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  )
}
