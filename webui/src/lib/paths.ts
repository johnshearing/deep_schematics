/**
 * What to highlight when something is selected — the one answer, for both tabs.
 *
 * The rule was one sentence and it is now three, which is Phase C and Phase D:
 *
 * - **a wire's highlight is its own runs**;
 * - **a net's is the union of its wires', plus the commoning of every block it lands on**;
 * - **a terminal's is the wires that reach it, plus its own block's commoning.**
 *
 * A net stores nothing (`server/app/locations.py`) and a block's bus is authored per block
 * (`server/app/wiring.py`), so if the Drawing tab and the Locate tab each worked this out for
 * themselves they could eventually disagree about what net 120 is — which is exactly the class of
 * drift `paint.ts` exists to prevent for coordinates.
 *
 * ### Why a **wire** does not paint the bus, when a net and a terminal do
 *
 * Plan §9 asks for all three. This ships two, deliberately, and the reason is the finding this
 * session exists to repair. `W063` runs `INFEED1:3 → TB-120:1` along `C0091`, and `C0092` — the
 * 72.7 pt vertical joining `TB-120:1` to `:2` — is the **block's bus and not part of the wire**.
 * `07_drawing_facts.md` called it *"the second piece of `W063`'s L"* for a week. Painting a
 * block's bus underneath a selected wire, in the same colour as the wire's own route, would teach
 * that error to every reader on every wire that lands on a block.
 *
 * A net and a terminal are different questions. *Where is net `0V`* is a question about a place in
 * the circuit, and the vertical the eleven runs land on is part of the honest answer — it is the
 * change the user asked for on 2026-09-06 in those words. *What reaches `TB-0V:6`* is the same
 * kind of question. *Where does `W063` run* is a claim about one piece of ink, and the bus is not
 * it.
 *
 * Pure, and it takes the payload rather than reading a store, so it is testable as arithmetic.
 */

import type {
  BlockCommoning,
  DesignatorKind,
  PathIndex,
  Polyline,
  WirePath,
} from '@/api/types'
import { blockOf } from './designators'

/**
 * A selection's paths, gathered — and enough about them for a card to say what is on the sheet.
 *
 * `wires` and `traced` are the two numbers a reader needs when nothing is drawn: *this net has
 * four wires and none of them has a path yet* is information, and an empty sheet is not.
 */
export interface PathSummary {
  /** Everything to paint, in the order the wires are listed, with any commoning after them. */
  runs: Polyline[]
  /** How many wires this selection covers: 1 for a wire, its membership for a net, the number
   * that reach it for a terminal. */
  wires: number
  /** How many of them somebody has traced. */
  traced: number
  /** The two provenance axes, `mixed` where a net's wires disagree and null where nothing is
   * traced. A net whose runs are half lifted and half hand-drawn is a real state and the card
   * must not claim it is one or the other. */
  geometry: WirePath['geometry'] | 'mixed' | null
  attribution: WirePath['attribution'] | 'mixed' | null
  /** The extracted runs these paths were lifted from, in order and deduplicated. Empty where
   * every path here was traced by hand. */
  conductors: string[]
  /**
   * The blocks whose own bus is painted with this selection, in order.
   *
   * Separate from `conductors` because it is a separate claim: those are runs of ink a person said
   * belong to *a wire*, and these are blocks whose commoning a person authored. Empty for a wire,
   * always — see the header.
   */
  commoning: string[]
  /** Which of this selection's wires reach it, for a terminal. Empty for anything else, and it is
   * the roster a card lists. */
  here: string[]
}

const NOTHING: PathSummary = {
  runs: [],
  wires: 0,
  traced: 0,
  geometry: null,
  attribution: null,
  conductors: [],
  commoning: [],
  here: [],
}

/**
 * What the caller knows that the paths payload does not — both of it out of `/api/designators`.
 *
 * Handed in rather than fetched, so this stays arithmetic over a payload. `/api/paths` publishes a
 * net's *wires* and not its member terminals, and it publishes nothing at all about which wires
 * reach a given pin: that transposition is `wiresByTerminal` in `lib/designators.ts`, and plan
 * §4 q7 is explicit that it must not become a second endpoint.
 */
export interface PathContext {
  /** A selected net's member terminals, so its blocks can be found. Ignored for other kinds. */
  terminals?: readonly string[]
  /** Terminal id → the wires that reach it. Only a terminal selection reads it. */
  wiresByTerminal?: Record<string, string[]>
}

/**
 * The paths for one selection, or **null for a kind that cannot have one**.
 *
 * Null and an empty summary are different answers and both are used: a component has no path in
 * the way a stone has no opinion, and there is nothing to say about it; a wire with no path yet is
 * a wire nobody has traced, and the card says so.
 *
 * **A terminal used to be null too, and the docstring used to say a terminal has no route.** That
 * was true and it was answering the wrong question. A terminal has no route of its own, and it is
 * still the place a reader points at when they want to know *what lands here* — which is a set of
 * routes that do exist. So the third case replaces the reason rather than deleting it: a terminal
 * has no path, and it has the wires that reach it and the bus of the block it is on.
 */
export function pathsFor(
  index: PathIndex | null,
  kind: DesignatorKind | null | undefined,
  id: string | null | undefined,
  context: PathContext = {},
): PathSummary | null {
  if (!id) return null
  if (kind === 'terminal') return atTerminal(index, id, context)
  if (kind !== 'wire' && kind !== 'net') return null
  if (!index) return { ...NOTHING, wires: kind === 'wire' ? 1 : 0 }

  const wires = kind === 'wire' ? [id] : (index.nets[id] ?? [])
  const gathered = gather(index, wires)
  // **A wire paints no bus**, and the header is the argument: `C0092` is `TB-120`'s commoning and
  // was mistaken for the second half of `W063`'s route for a week. A net's blocks are the blocks
  // its member terminals sit on.
  const blocks = kind === 'net' ? blocksOf(context.terminals ?? []) : []
  return finish(index, gathered, wires.length, blocks, [])
}

/**
 * **What reaches this pin** — Phase D's first piece, and the feature that makes a missing wire
 * visible by its absence.
 *
 * Clicking a terminal on the **Drawing** tab is a reader's question with no password, no draft and
 * nothing to move; on the Locate tab the same click still places or moves a marker. That is
 * decision 7, and it is what stops `H10`'s collision getting a third occupant: the click already
 * *selected* the terminal, so this changes what the selection **paints** and not what the click
 * **means**.
 *
 * The block's own bus comes with it, because a pin on a terminal block is joined to its
 * neighbours by that bus and a highlight that stopped at the screw would be answering a narrower
 * question than the one asked.
 */
function atTerminal(
  index: PathIndex | null,
  id: string,
  context: PathContext,
): PathSummary {
  const here = context.wiresByTerminal?.[id] ?? []
  if (!index) return { ...NOTHING, wires: here.length, here }
  const gathered = gather(index, here)
  return finish(index, gathered, here.length, blocksOf([id]), here)
}

interface Gathered {
  runs: Polyline[]
  conductors: string[]
  geometry: Set<WirePath['geometry']>
  attribution: Set<WirePath['attribution']>
  traced: number
}

function gather(index: PathIndex, wires: readonly string[]): Gathered {
  const out: Gathered = {
    runs: [],
    conductors: [],
    geometry: new Set(),
    attribution: new Set(),
    traced: 0,
  }
  for (const wire of wires) {
    const path = index.wires[wire]
    if (!path) continue
    out.traced += 1
    out.runs.push(...path.runs)
    out.geometry.add(path.geometry)
    out.attribution.add(path.attribution)
    for (const conductor of path.conductors ?? []) {
      if (!out.conductors.includes(conductor)) out.conductors.push(conductor)
    }
  }
  return out
}

/**
 * Add the blocks' commoning and collapse the two axes.
 *
 * The bus's own `geometry` and `attribution` are folded in with the wires', which is why a net of
 * lifted routes whose block was hand-traced reads `part hand-traced` rather than claiming the
 * whole highlight came off the PDF. That is the same honesty `mixed` was added for.
 *
 * A block with **no authored record is silently absent**, not an error: until the user's run
 * authors them, that is every block on the sheet, and a net that refused to highlight because
 * nobody had confirmed a bus would be worse than one that highlights its eleven runs.
 */
function finish(
  index: PathIndex,
  gathered: Gathered,
  wires: number,
  blocks: readonly string[],
  here: readonly string[],
): PathSummary {
  const commoning: string[] = []
  for (const block of blocks) {
    const bus: BlockCommoning | undefined = index.commoning?.[block]
    if (!bus) continue
    commoning.push(block)
    gathered.runs.push(...bus.runs)
    gathered.geometry.add(bus.geometry)
    gathered.attribution.add(bus.attribution)
    for (const conductor of bus.conductors ?? []) {
      if (!gathered.conductors.includes(conductor)) gathered.conductors.push(conductor)
    }
  }
  return {
    runs: gathered.runs,
    wires,
    traced: gathered.traced,
    geometry: one(gathered.geometry),
    attribution: one(gathered.attribution),
    conductors: gathered.conductors,
    commoning,
    here: [...here],
  }
}

/** The blocks a set of terminals sits on, deduplicated and in order. */
function blocksOf(terminals: readonly string[]): string[] {
  const out: string[] = []
  for (const terminal of terminals) {
    const block = blockOf(terminal)
    if (block && !out.includes(block)) out.push(block)
  }
  return out
}

function one<T>(values: Set<T>): T | 'mixed' | null {
  if (values.size === 0) return null
  if (values.size === 1) return [...values][0]
  return 'mixed'
}
