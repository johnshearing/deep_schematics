/**
 * Which two terminals this wire joins — **the ink proposes, a person decides, and the file says
 * which.**
 *
 * ### What this panel is for
 *
 * One layer below `PathPanel`. That one asks *which line on the paper is this wire*; this asks
 * *which terminal does it actually reach* — the question the indexing pass answered by allocating
 * screw numbers as the `W` table was typed. 11 of this drawing's 71 wires are on the wrong screw
 * because of it, 13 more cannot be settled from the ink, and 47 are right.
 *
 * ### The button that matters most is the one that changes nothing
 *
 * **`I looked and it was right`.** 47 of the 71 wires need exactly that and nothing else, and
 * until this panel existed the file could not hold it: a correct wire and an unexamined one were
 * the same bytes. So confirming an unchanged wire writes a record, stamps `source: human`, and
 * moves the count — which is Phase A's whole acceptance criterion and the reason the queue reads
 * `0 of 71` on its first run rather than `47 of 71`.
 *
 * ### Three things it will not do
 *
 * - **It never accepts a proposal on its own.** Not for the 47 the ink agrees with, and least of
 *   all for `W042`, where the ink is **wrong** and the data is **right**: the run stops at the west
 *   side of the block instead of reaching the commoning line, which is the drawing's own error. A
 *   screen that trained you to accept the proposal would be worse than no screen. Same rule
 *   Session 6 wrote for paths, same reason.
 * - **It flags a wire across two nets and never fixes it.** `W019` corrected reads `0V` at one end
 *   and `GND` at the other, because it is a 0 V-to-ground bond. Two nets is the *finding*.
 * - **It does not rank the record's own answer to the top.** Where two wires land on one pin — the
 *   `PLG1`/`PLG2` pairs, `CR-ON:14` beside `CR-BP:24` — the nearer run may be the other wire's, and
 *   eleven of this sheet's endpoints are that case. The one that agrees is marked instead, because
 *   a proposal that agreed with the record by construction would be no proposal at all.
 */

import { useMemo, useState } from 'react'
import { Check, Crosshair, RotateCcw } from 'lucide-react'

import type { Conductor, Designator, LocationsDocument, Polyline, WiringDocument } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { endpointLabel } from '@/lib/designators'
import { cn } from '@/lib/utils'
import type { Stamp } from './model'
import type { InkIndex, Landed, Landing } from './wiring'
import { proposalsFor } from './wiring'
import {
  confirmEndpoints,
  confirmed as isConfirmed,
  corrected as isCorrected,
  endpointsOf,
  netsAcross,
  pathStale,
  setEndpoint,
  setWiringNote,
  sourceOf,
  unconfirm,
  wireRecord,
  type End,
  type Endpoints,
} from './wiringModel'

/**
 * How many proposals a slot shows.
 *
 * Measured on this drawing: an end has at most three, and most have one. Four is room to spare —
 * unlike the path panel's six, there is no long tail here, because a walk of the ink from one pin
 * arrives somewhere definite or it arrives nowhere.
 */
const SHOWN = 4

/** What each tag claims, in a sentence, because a ranking is only trustworthy if it says why. */
const WHY: Record<Landed, string> = {
  'one run': 'One conductor, end to end, with no join in it.',
  chained: 'Two or more conductors, joined across a corner or a crossover hop.',
  'past the commoning':
    'The landing was read where the run leaves the block’s own bus rather than where its ' +
    'polyline ends — the block’s commoning is fused into this conductor. Get that wrong and four ' +
    'of the 71 wires are mis-proposed.',
  'printed name': 'The net name printed beside the ink is the one this terminal is on.',
  'corrected name': 'That name is one you read off the paper and corrected on the Review tab.',
}

interface Props {
  entry: Designator
  /** The draft `wiring.json`. Null while it is loading, or if it could not be opened. */
  wiring: WiringDocument | null
  /** The draft `locations.json`, for one comparison only: `path may be stale`. The two documents
   * meet here as arguments and nowhere as coupled stores — see `wiringStore`'s header. */
  locations: LocationsDocument
  /** Terminal id → net id, the reverse pass over the index. */
  nets: Record<string, string>
  /** The ink, indexed once for the whole drawing. Null until `/api/conductors` has arrived, and
   * null again if it could not be read — two different states from `[]`, exactly as in
   * `PathPanel`, and the panel says different things about them. */
  ink: InkIndex | null
  conductors: Conductor[] | null
  /** Which of this wire's slots is armed, if either. Only `Pick from the sheet` sets it. */
  armed: End | null
  onArm: (end: End | null) => void
  stamp: () => Stamp
  onEdit: (change: (document: WiringDocument) => WiringDocument, note?: string) => void
  /** Light a proposal's conductors on the sheet. `null` puts the sheet back. */
  onPreview: (runs: Polyline[] | null) => void
}

export function WiringPanel({
  entry,
  wiring,
  locations,
  nets,
  ink,
  conductors,
  armed,
  onArm,
  stamp,
  onEdit,
  onPreview,
}: Props) {
  if (!wiring) {
    return (
      <div className="space-y-1.5 border-t pt-1.5" data-wiring-panel={entry.id}>
        <p className="text-[11px] text-muted-foreground">
          The wiring file did not load, so this wire&apos;s ends cannot be confirmed here.
          Everything else on this screen still works. Is <code>SWUI_ALLOW_EDITS</code> true, and did
          the server restart after <code>wiring.py</code> arrived?
        </p>
      </div>
    )
  }
  return (
    <Ready
      {...{
        entry, wiring, locations, nets, ink, conductors, armed, onArm, stamp, onEdit, onPreview,
      }}
    />
  )
}

function Ready({
  entry,
  wiring,
  locations,
  nets,
  ink,
  conductors,
  armed,
  onArm,
  stamp,
  onEdit,
  onPreview,
}: Props & { wiring: WiringDocument }) {
  const ends = endpointsOf(wiring, entry)
  const record = wireRecord(wiring, entry.id)
  const confirmed = isConfirmed(wiring, entry.id)
  const corrected = isCorrected(wiring, entry.id)
  const across = netsAcross(ends, nets)
  const stale = pathStale(locations, wiring, entry)

  const proposals = useMemo(() => (ink ? proposalsFor(ink, ends) : { from: [], to: [] }), [
    ink,
    ends,
  ])

  const runsOf = (landing: Landing): Polyline[] =>
    landing.conductors
      .map((id) => conductors?.find((run) => run.id === id)?.points)
      .filter((points): points is Polyline => Array.isArray(points) && points.length > 1)

  const accept = (end: End, terminal: string) => {
    onPreview(null)
    onArm(null)
    onEdit(
      (d) => setEndpoint(d, entry.id, end, terminal, ends, stamp()),
      `put ${entry.id}'s ${end} end on ${terminal}`,
    )
  }

  return (
    <div className="space-y-2 border-t pt-1.5" data-wiring-panel={entry.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium">What it joins</span>
        <Badge
          tone={confirmed ? 'success' : 'warning'}
          title={
            confirmed
              ? 'A person has looked at these two terminals and taken responsibility for them.'
              : 'Nobody has looked at these two terminals. For the 40 wires that land on a ' +
                'multi-point block the far end was allocated rather than read — one screw number ' +
                'after another as the table was typed.'
          }
        >
          {confirmed ? endpointLabel('human', record?.at ?? null) : endpointLabel('index', null)}
        </Badge>
        {corrected && (
          <Badge tone="info" title="This confirmation moved an endpoint. `was` keeps the pair it replaced, forever.">
            corrected
          </Badge>
        )}
      </div>

      {/* The two slots, in the netlist's own order, because `[from, to]` is content. */}
      <ul className="space-y-1.5">
        {(['from', 'to'] as End[]).map((end, index) => (
          <EndSlot
            key={end}
            end={end}
            terminal={ends[index]}
            wireId={entry.id}
            source={sourceOf(wiring, entry.id)}
            at={record?.at ?? null}
            wasHere={(record?.was as Endpoints | undefined)?.[index] ?? null}
            net={index === 0 ? across.from : across.to}
            armed={armed === end}
            proposals={proposals[end]}
            onArm={() => onArm(armed === end ? null : end)}
            onAccept={(terminal) => accept(end, terminal)}
            onHover={(landing) => onPreview(landing ? runsOf(landing) : null)}
            inkMissing={ink === null}
          />
        ))}
      </ul>

      <NetsAcross across={across} />

      {stale && (
        <p
          className="text-[10px] text-[var(--color-warning)]"
          data-wiring-stale={entry.id}
          title="A path is a claim about ink and the ink does not move — but this wire's route was accepted against a different pair of terminals, so it may now reach the wrong place. Check it on the Paths filter."
        >
          <span className="font-medium">path may be stale</span> — its route was accepted against{' '}
          <span className="font-mono">
            {(locations.wires?.[entry.id]?.path?.for ?? []).join(' + ')}
          </span>
          .
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {/* **The button the phase exists for.** 47 of the 71 wires need this and nothing else. */}
        <Button
          variant={confirmed ? 'ghost' : 'default'}
          size="sm"
          className="h-6 px-2 text-[11px]"
          disabled={ends[0] === null || ends[1] === null}
          data-wiring-confirm={entry.id}
          title={
            'Record that you looked at these two terminals and they are right. It writes a ' +
            'record even though nothing changed, because *I looked and it was right* is a ' +
            'decision — and 47 of the 71 wires on this sheet are exactly that.'
          }
          onClick={() =>
            onEdit(
              (d) => confirmEndpoints(d, entry.id, ends, stamp()),
              `confirmed ${entry.id} joins ${ends[0]} and ${ends[1]}`,
            )
          }
        >
          <Check />
          {confirmed ? 'Confirm again' : 'I looked and it was right'}
        </Button>
        {confirmed && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            data-wiring-unconfirm={entry.id}
            title="Take the confirmation back. The record goes to `source: index` with the endpoints `was` was holding, so the file says *nobody has checked this* again rather than saying a wire was deleted."
            onClick={() =>
              onEdit((d) => unconfirm(d, entry.id, ends), `took back ${entry.id}'s confirmation`)
            }
          >
            <RotateCcw />
            Take it back
          </Button>
        )}
      </div>

      <NoteBox
        wireId={entry.id}
        note={record?.note ?? ''}
        enabled={confirmed}
        onSet={(note) =>
          onEdit((d) => setWiringNote(d, entry.id, note), `noted why ${entry.id} joins what it does`)
        }
      />
    </div>
  )
}

/**
 * One end of the wire: what it holds, where that came from, and what the ink says instead.
 *
 * `Pick from the sheet` is the only thing that arms this slot, and while it is armed the next
 * **terminal** click on the sheet fills it. That is the whole answer to *how do the two meanings of
 * clicking a terminal stay apart* on this tab: a click still places the armed point unless a slot
 * is armed, and only a press here can arm one.
 */
function EndSlot({
  end,
  terminal,
  wireId,
  source,
  at,
  wasHere,
  net,
  armed,
  proposals,
  onArm,
  onAccept,
  onHover,
  inkMissing,
}: {
  end: End
  terminal: string | null
  wireId: string
  source: 'index' | 'human'
  at: string | null
  /** What this end held before, from the record's `was`. Absent where nothing was replaced. */
  wasHere: string | null
  net: string | null
  armed: boolean
  proposals: Landing[]
  onArm: () => void
  onAccept: (terminal: string) => void
  onHover: (landing: Landing | null) => void
  inkMissing: boolean
}) {
  const agrees = terminal !== null && proposals.some((one) => one.terminal === terminal)
  return (
    <li
      className={cn('rounded-md border px-2 py-1', armed && 'border-[var(--color-ring)] bg-accent')}
      data-wiring-end={`${wireId}@${end}`}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="w-8 shrink-0 text-[10px] uppercase text-muted-foreground">{end}</span>
        <span className="font-mono text-[11px] text-foreground">{terminal ?? 'nobody has set this end'}</span>
        {net && (
          <span className="font-mono text-[10px] text-muted-foreground" title="The net this terminal is on, from its own record in the netlist.">
            {net}
          </span>
        )}
        <Button
          variant={armed ? 'default' : 'ghost'}
          size="sm"
          className="ml-auto h-5 shrink-0 px-1.5 text-[10px]"
          aria-pressed={armed}
          data-wiring-pick={`${wireId}@${end}`}
          title={
            armed
              ? 'Armed: the next terminal you click on the sheet becomes this end. Escape takes the slot back before it takes the row.'
              : 'Arm this slot, then click the terminal on the sheet. While it is armed a click binds this end instead of placing a point.'
          }
          onClick={onArm}
        >
          <Crosshair />
          {armed ? 'click a terminal' : 'Pick from the sheet'}
        </Button>
      </div>

      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {endpointLabel(source, at)}
        {wasHere && wasHere !== terminal && (
          <>
            {' · was '}
            <span
              className="font-mono"
              title="The terminal this record replaced, kept forever: the `W` table it came from is hand-maintained and a later edit there would destroy the original."
            >
              {wasHere}
            </span>
          </>
        )}
      </p>

      {inkMissing ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          The conductors did not load, so there is nothing to read off the paper for this end.
          Pick the terminal from the sheet instead.
        </p>
      ) : proposals.length === 0 ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          <span className="font-medium">The ink says nothing about this end.</span> Either no run
          reaches it, or the run that should stops short — which is the drawing&apos;s own error on
          at least one wire of this sheet, and the data is right there. Your eyes decide.
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5" aria-label={`What the ink says ${wireId} joins at its ${end} end`}>
          {proposals.slice(0, SHOWN).map((landing) => (
            <ProposalRow
              key={landing.terminal}
              landing={landing}
              agrees={landing.terminal === terminal}
              onHover={onHover}
              onAccept={() => onAccept(landing.terminal)}
            />
          ))}
          {!agrees && terminal !== null && (
            <li className="px-1 text-[9px] text-[var(--color-warning)]">
              the ink does not offer <span className="font-mono">{terminal}</span> at all
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

/** One thing the ink says. The row leads with the terminal, because that is the decision. */
function ProposalRow({
  landing,
  agrees,
  onHover,
  onAccept,
}: {
  landing: Landing
  agrees: boolean
  onHover: (landing: Landing | null) => void
  onAccept: () => void
}) {
  return (
    <li data-wiring-proposal={landing.terminal}>
      <button
        type="button"
        className="w-full rounded px-1 py-0.5 text-left hover:bg-accent"
        onMouseEnter={() => onHover(landing)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(landing)}
        onBlur={() => onHover(null)}
        onClick={onAccept}
        title={`Put this end on ${landing.terminal}.\n${landing.reasons
          .map((reason) => `• ${WHY[reason]}`)
          .join('\n')}`}
      >
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-[11px]">{landing.terminal}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {landing.conductors.join(' + ')}
          </span>
          {landing.specLabel && (
            <span className="truncate text-[10px] text-muted-foreground">{landing.specLabel}</span>
          )}
          <span
            className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground"
            title="How far the ink stops from the pins it was matched against. Conductor rows on this sheet are 16 pt apart."
          >
            {landing.fit.toFixed(1)} pt
          </span>
        </span>
        <span className="mt-px flex flex-wrap gap-1">
          {agrees && (
            <span
              className="rounded bg-[var(--color-success)]/15 px-1 text-[9px]"
              title="This is what the index already says. Confirming it is still a decision — and it is the one 47 of the 71 wires need."
            >
              agrees with the index
            </span>
          )}
          {landing.reasons.map((reason) => (
            <span
              key={reason}
              className={cn(
                'rounded px-1 text-[9px]',
                reason === 'past the commoning'
                  ? 'bg-[var(--color-warning)]/15 text-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {reason}
            </span>
          ))}
          {landing.netLabel && (
            <span className="rounded bg-muted px-1 font-mono text-[9px] text-muted-foreground">
              {landing.netLabel}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

/** The two ends' nets, side by side, with a flag where they differ — **and never a fix.** */
function NetsAcross({
  across,
}: {
  across: { from: string | null; to: string | null; differ: boolean }
}) {
  return (
    <p className="text-[10px] text-muted-foreground" data-wiring-nets>
      Nets: <span className="font-mono text-foreground">{across.from ?? '—'}</span> at one end,{' '}
      <span className="font-mono text-foreground">{across.to ?? '—'}</span> at the other.
      {across.differ ? (
        <span
          className="ml-1 rounded bg-[var(--color-warning)]/20 px-1 font-medium text-foreground"
          data-wiring-mismatch
          title="Two nets, and this is a flag rather than an error. A 0 V-to-ground bond is a real wire and the two nets are the point of it; so is a wire across a breaker. Nothing here picks one — a wire's net is derived from its two ends and is not stored, which is why this is visible at all."
        >
          two nets — look at it
        </span>
      ) : (
        <span className="ml-1">
          A wire&apos;s net is derived from its ends and not stored, so this cannot go stale.
        </span>
      )}
    </p>
  )
}

/**
 * Why this wire joins what it does, in words — and **disabled until there is a decision to ride
 * on.**
 *
 * The same rule the Review tab's note box follows and for the same reason: a note on a record
 * nobody has confirmed would have to invent the confirmation to hang off, which would record that
 * a person checked something they did not. It holds its own text and writes once, on `Enter` or
 * blur (`H4`), and a box left exactly as it was writes nothing (`H19`).
 */
function NoteBox({
  wireId,
  note,
  enabled,
  onSet,
}: {
  wireId: string
  note: string
  enabled: boolean
  onSet: (note: string) => void
}) {
  const [text, setText] = useState(note)
  const commit = () => {
    if (text.trim() === note.trim()) return
    onSet(text)
  }
  return (
    <input
      value={enabled ? text : ''}
      disabled={!enabled}
      data-wiring-note={wireId}
      aria-label={`Why ${wireId} joins what it does`}
      placeholder={
        enabled
          ? 'why, in your words — optional'
          : 'confirm the ends first: a note rides on a decision'
      }
      className="w-full rounded-md border bg-background px-2 py-0.5 text-[11px] disabled:opacity-60"
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          setText(note)
          event.currentTarget.blur()
        }
      }}
    />
  )
}
