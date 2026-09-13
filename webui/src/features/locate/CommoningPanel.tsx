/**
 * A terminal block's own commoning — **the vertical that makes a net legible on paper.**
 *
 * ### What this is for
 *
 * Asked for by the user on 2026-09-06, in these words: *"these vertical lines are the block's own
 * commoning, but when we highlight a net the commoning needs to be highlighted too — this will
 * make it easier to see the net."* Net `0V` is eleven wire runs and the 279.6 pt vertical they all
 * land on, and until that vertical is authored the highlight shows eleven lines that stop just
 * short of each other.
 *
 * ### Why it is not a wire, and why the file keeps it apart
 *
 * The user's own answer, the same day: a block's commoning is **the block's own**, not field wire.
 * §3.7's *"0 genuinely missing field wires"* depends on that reading, and modelling these eight
 * conductors as wires would put six connections the sheet does not mean in front of the model. So
 * a record here earns no `W###`, no `CONNECTS_TO` edge and no entity: it is display geometry, it
 * lives in `wiring.json`'s second section, and **saving one leaves `circuit_logic.json`
 * current** — asserted in bytes by `test_commoning_does_not_reach_the_netlist`.
 *
 * ### Why the panel offers polylines rather than a conductor
 *
 * `C0105` is one conductor holding `DISCHARGE1:2`'s wire **and** all 279.6 pt of `TB-0V`'s
 * vertical, because the extractor splits a conductor at a crossover hop and a T-junction is not
 * one. Accepting *"conductor `C0105`"* would claim the wire as part of the bus — which is the same
 * mistake, one layer up, that had `07_drawing_facts.md` calling `C0092` the second half of
 * `W063`'s L for a week. `commoningFor` in `wiring.ts` cuts the stretch out, and that function is
 * the **one** answer to *where is this block's bus*: exporting it beat re-deriving it here.
 *
 * ### And it proposes, exactly like everything else on this screen
 *
 * The shape rule is *two or more of one component's terminals on one run*, and it is already known
 * to be incomplete on this sheet: two of one block's points are 71 pt apart with nothing joining
 * them, and another block's third screw sits 24 pt below the end of the run serving the first two.
 * So there is a button, `derived` is refused by name on a saved record, and a block the ink says
 * nothing about says so rather than being given a line nobody drew.
 *
 * ### And since 2026-09-12, a person can draw one the ink does not offer
 *
 * **That is the point of the second button.** Until then this panel rendered a proposal and
 * nothing else, so where the shape rule found nothing there was no control at all and the copy
 * blamed the reader's eyes for a gap in the screen. A bus the ink cannot propose is exactly the
 * case a human is here for: they can see that two screws are strapped together and a rule cannot.
 * `Trace by hand` is `PathPanel`'s gesture on this object, and `traceCommoning` is the writer —
 * `geometry: 'human'`, because the corners are the person's own.
 */

import { useMemo, useState } from 'react'
import { Check, PencilLine, RotateCcw } from 'lucide-react'

import type { Designator, Polyline, WiringDocument } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { splitTerminal, type Stamp } from './model'
import { Tracing } from './Tracing'
import { commoningFor, type InkIndex } from './wiring'
import { clearCommoning, commoningOf, setCommoning, setCommoningNote } from './wiringModel'

interface Props {
  entry: Designator
  /** The draft `wiring.json`. Null while it loads, or if it could not be opened. */
  wiring: WiringDocument | null
  /** The ink, indexed once for the whole drawing. Null until `/api/conductors` has arrived and
   * null again if it failed — two different states from *the ink joins nothing here*. */
  ink: InkIndex | null
  /** Terminal id → the net it is on, out of the **netlist** — `terminalNets`, the same map the
   * wiring panel reads. Not a draft of an authored file, which is what keeps `H18` intact: this
   * panel writes `wiring.json` and must not be handed a second whole document. */
  nets: Record<string, string>
  /** The corners of a hand trace **of this block's bus**, or null when no trace of this block is
   * running. Owned by the tab, because the clicks that add corners land on the sheet. */
  tracing: [number, number][] | null
  stamp: () => Stamp
  onEdit: (change: (document: WiringDocument) => WiringDocument, note?: string) => void
  /** Light the proposal on the sheet while the pointer is over it. `null` puts the sheet back. */
  onPreview: (runs: Polyline[] | null) => void
  /** Start a hand trace of this block's bus, or abandon the running one. What a finished trace
   * writes is the tab's business and not this panel's — see `H26`. */
  onTrace: (start: boolean) => void
}

export function CommoningPanel({
  entry,
  wiring,
  ink,
  nets,
  tracing,
  stamp,
  onEdit,
  onPreview,
  onTrace,
}: Props) {
  const proposal = useMemo(
    () => (ink ? commoningFor(ink, entry.id) : { runs: [], conductors: [] }),
    [ink, entry.id],
  )
  const record = wiring ? commoningOf(wiring, entry.id) : undefined

  /**
   * **Whether this component is the kind of thing that can have a bus at all** — and the test is a
   * statement about shapes, not a prefix.
   *
   * *Two or more of this component's terminals on one net*, which is the same sentence the ink's
   * own rule makes about one *run*: a bus is what makes a net legible on paper, so points that are
   * not on one net have nothing to common. Nothing here knows what a terminal-block designator
   * looks like and nothing should — that rule is the user's, and this gate is where it would have
   * been easiest to break.
   *
   * It replaced *"the ink proposed something"*, which hid the panel on exactly the blocks that
   * needed authoring most. Measured on this drawing it opens the panel on 12 components rather
   * than all 47, and on 6 of them the ink proposes nothing at all.
   */
  const commonable = useMemo(() => {
    const perNet = new Map<string, number>()
    for (const [terminal, net] of Object.entries(nets)) {
      if (splitTerminal(terminal)[0] !== entry.id) continue
      perNet.set(net, (perNet.get(net) ?? 0) + 1)
    }
    return [...perNet.values()].some((count) => count >= 2)
  }, [nets, entry.id])

  // Nothing to author and nothing to say: not every component can have a bus, and a panel on all
  // 47 of them would be noise on the 35 with no two points on one net. A record already written
  // keeps its panel whatever the netlist says now — it is somebody's decision, and it must stay
  // reachable to be taken back.
  if (!wiring || (!record && !commonable)) return null

  /**
   * **A trace in progress takes the whole panel**, exactly as it does on a wire's path.
   *
   * Everything else here is a claim about this block, and while a line is being drawn none of it
   * is true yet: the proposal must not be one click away from being accepted by a person aiming at
   * the sheet, and `Take it back` has nothing to take back. The keys and the corner count are the
   * only things worth saying until `Enter`.
   */
  if (tracing)
    return (
      <div className="space-y-1.5 border-t pt-1.5" data-commoning-panel={entry.id}>
        <p className="text-[11px] font-medium">This block&apos;s commoning</p>
        <Tracing
          corners={tracing}
          chord={null}
          guide="down the points this block straps together"
        />
      </div>
    )

  const painted = record?.runs ?? proposal.runs
  const total = painted.reduce((sum, run) => sum + lengthOf(run), 0)
  /** A record whose polyline the **person** drew, which is a third thing this badge can say. */
  const drawn = record?.geometry === 'human'

  return (
    <div className="space-y-1.5 border-t pt-1.5" data-commoning-panel={entry.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium">This block&apos;s commoning</span>
        <Badge
          tone={record ? 'success' : 'warning'}
          title={
            record
              ? drawn
                ? 'A person drew this line corner by corner: the polyline is theirs rather than ' +
                  'the drawing’s, which is what `geometry: human` records. Any conductors named ' +
                  'beside it are ink the line happens to follow — the weaker claim, riding along.'
                : 'A person said these lengths of ink are the block’s own bus rather than field wire.'
              : 'The ink joins two or more of this block’s points along one run. Nobody has said ' +
                'that is the block’s own commoning yet, and until somebody does a net’s highlight ' +
                'stops at the screws.'
          }
        >
          {record
            ? `${drawn ? 'you drew it' : 'you'}, on ${(record.at ?? '').slice(0, 10) || 'a day nobody stamped'}`
            : 'the ink proposes'}
        </Badge>
        {record?.page !== undefined && (
          <Badge tone="info" title="Which sheet these polylines are on. A designator names the same terminal on any page; a polyline does not.">
            page {record.page}
          </Badge>
        )}
      </div>

      {ink === null ? (
        <p className="text-[10px] text-muted-foreground">
          The conductors did not load, so there is nothing to read off the paper for this block.
        </p>
      ) : painted.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium">The ink joins none of this block&apos;s points to each
          other.</span>{' '}
          Either nothing straps them together, or the line that does is not in the extracted
          geometry. If you can see one on the sheet, draw it — the polyline is then yours rather
          than the drawing&apos;s, and the record says so.
        </p>
      ) : (
        <button
          type="button"
          data-commoning-runs={entry.id}
          className="w-full rounded px-1 py-0.5 text-left hover:bg-accent"
          onMouseEnter={() => onPreview(painted)}
          onMouseLeave={() => onPreview(null)}
          onFocus={() => onPreview(painted)}
          onBlur={() => onPreview(null)}
          onClick={() => onPreview(painted)}
          title={
            'The stretch of each conductor that runs along this block’s points — not the whole ' +
            'conductor. `C0105` is 279.6 pt of TB-0V’s vertical fused with DISCHARGE1:2’s wire, ' +
            'and accepting the whole of it would claim that wire as part of the bus.'
          }
        >
          <span className="flex items-baseline gap-1.5">
            <span className="text-[11px]">
              {painted.length} {painted.length === 1 ? 'run' : 'runs'}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {(record?.conductors ?? proposal.conductors).join(' + ') || 'hand-traced'}
            </span>
            <span
              className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground"
              title="Total length of the stretches, in points."
            >
              {total.toFixed(1)} pt
            </span>
          </span>
        </button>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {proposal.runs.length > 0 && (
          <Button
            variant={record ? 'ghost' : 'default'}
            size="sm"
            className="h-6 px-2 text-[11px]"
            data-commoning-accept={entry.id}
            title={
              'Record that these lengths of ink are this block’s own commoning. It is display ' +
              'geometry: no wire, no edge, no entity, and `circuit_logic.json` stays current — ' +
              'the only save on this screen that does not move the netlist.'
            }
            onClick={() => {
              onPreview(null)
              onEdit(
                (d) => setCommoning(d, entry.id, proposal, stamp()),
                `said ${entry.id}'s commoning is ${proposal.conductors.join(' + ')}`,
              )
            }}
          >
            <Check />
            {record ? 'Take the ink again' : `This is ${entry.id}'s commoning`}
          </Button>
        )}
        <Button
          variant={proposal.runs.length > 0 ? 'outline' : 'default'}
          size="sm"
          className="h-6 px-2 text-[11px]"
          data-commoning-trace={entry.id}
          title={
            'Draw this block’s bus corner by corner. Click each corner, Enter to finish, ' +
            'Backspace to take one back, Esc to abandon. The line is then yours rather than the ' +
            'drawing’s — which is the honest record where the extracted ink stops short of a ' +
            'point, or was never there to begin with.'
          }
          onClick={() => {
            onPreview(null)
            onTrace(true)
          }}
        >
          <PencilLine />
          Trace by hand
        </Button>
        {record && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            data-commoning-clear={entry.id}
            title={
              'Delete the record. Unlike taking a wire’s confirmation back, this really does ' +
              'remove it: nothing bootstrapped a bus, so a missing record and *nobody has ' +
              'authored this* are the same state.'
            }
            onClick={() => {
              onPreview(null)
              onEdit((d) => clearCommoning(d, entry.id), `took back ${entry.id}'s commoning`)
            }}
          >
            <RotateCcw />
            Take it back
          </Button>
        )}
      </div>

      <NoteBox
        block={entry.id}
        note={record?.note ?? ''}
        enabled={Boolean(record)}
        onSet={(note) =>
          onEdit(
            (d) => setCommoningNote(d, entry.id, note),
            `noted why ${entry.id}'s commoning is what it is`,
          )
        }
      />
    </div>
  )
}

function lengthOf(run: Polyline): number {
  let total = 0
  for (let i = 1; i < run.length; i += 1) {
    total += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1])
  }
  return total
}

/** The same box the wiring panel and the Review tab have, gated the same way and for the same
 * reason: a note has to ride on a decision, and inventing the decision to hang it off would record
 * that a person checked something they did not. `H4` for the local text, `H19` for the baseline. */
function NoteBox({
  block,
  note,
  enabled,
  onSet,
}: {
  block: string
  note: string
  enabled: boolean
  onSet: (note: string) => void
}) {
  const [text, setText] = useState(note)
  return (
    <input
      value={enabled ? text : ''}
      disabled={!enabled}
      data-commoning-note={block}
      aria-label={`Why ${block}'s commoning is what it is`}
      placeholder={
        enabled ? 'why, in your words — optional' : 'accept the bus first: a note rides on a decision'
      }
      className={cn('w-full rounded-md border bg-background px-2 py-0.5 text-[11px]', 'disabled:opacity-60')}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (text.trim() !== note.trim()) onSet(text)
      }}
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
