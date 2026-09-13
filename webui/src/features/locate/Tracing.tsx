/**
 * **A hand trace in progress** — the count, the length so far, and the four keys.
 *
 * Lifted out of `PathPanel` on 2026-09-12, when a second object type learned to be traced. It is
 * the *panel* for a gesture whose state lives in `LocateTab` (the clicks land on the sheet, and
 * the sheet is the tab's), and it is deliberately **document-agnostic**: it is handed corners and
 * a line of wording, and it does not know whether `Enter` will write a wire's route into
 * `locations.json` or a block's bus into `wiring.json`. `H26` is why that matters — the trace
 * state machine is the second place two whole-document drafts meet, and they meet it as
 * arguments. A shared panel that knew which file it was for would be the first crack in that.
 *
 * Nothing is written until `Enter`, which is what makes `Esc` safe to press.
 */

import { lengthOf } from './paths'

export function Tracing({
  corners,
  chord,
  guide,
}: {
  corners: [number, number][]
  /** A straight line to measure the trace against, where the caller has one — a wire has its two
   * pins, and a block's bus has nothing to compare to. Null prints nothing. */
  chord: number | null
  /** What to follow, in the caller's words: the panel says *click the first corner, <guide>*. The
   * only thing here that knows which object is being traced, and it is a string rather than a
   * flag so no branch in this file can grow a second meaning. */
  guide: string
}) {
  return (
    <div className="space-y-1 border-t pt-1.5" data-tracing>
      <p className="text-[11px] font-medium">Tracing by hand</p>
      <p className="text-[11px] text-muted-foreground">
        {corners.length === 0
          ? `Click the first corner on the sheet, ${guide}.`
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
