/**
 * Where a wire's or a net's name sits at each of its ends — computed, never authored, except for
 * the handful of exceptions a person has chosen.
 *
 * ### Why this is a rule and not a queue
 *
 * All 131 terminals on this drawing have a point a human confirmed. So every wire has two known
 * ends and every net's 127 members resolve to real coordinates, and an end label needs **no
 * coordinate of its own** — only a *side* relative to a point that already exists. That is what
 * makes 269 end labels appear for nothing: they are a function of work already done, not 269 more
 * rows to walk. A screen that asked a person to place each of them would rebuild `K7` — the count
 * that can never reach zero — on four times the scale.
 *
 * `locations.json` therefore stores only the exceptions, and *Reset to default* **deletes** the
 * override rather than writing the side the rule would have picked. Storing a default as though a
 * human had chosen it makes the file stop distinguishing *nobody has looked at this* from *a person
 * decided this*, which is the one distinction the file exists for.
 *
 * ### Determinism, and why it is worth the trouble
 *
 * Everything below depends on **nothing but the points and the authored sides.** No render order,
 * no viewport, no layer switch, no which-thing-is-selected. `planEndLabels` is deliberately handed
 * the *whole* index and plans *every* label, and the caller then draws whichever subset it wants —
 * rather than planning only the visible ones, which would move a label sideways when an unrelated
 * switch was pressed. A label that wanders is a label a reader stops trusting to be attached to
 * anything.
 *
 * ### What an end label says
 *
 * A wire's is its **spec** — `BLUE 18AWG` — because every `W###` is an id the extraction invented
 * and a reader holding the sheet cannot find one printed anywhere. A wire with no colour and no
 * gauge (two of 71) gets no end label at all rather than one naming an id that is not on the paper.
 * A net's is **the name the sheet prints** — its id for 24 of the 26, and `PB1`/`PB2` for the two
 * the extraction renamed to `NET-PB1`/`NET-PB2` because the drawing also has a push button called
 * `PB1`. That is `K10`, and the fix belongs here rather than in the netlist: the rename was right,
 * and an end label's whole job is to give a reader something to check against the paper in front of
 * them. A label saying a word that is printed nowhere is worse than no label.
 */

import type { Compass, Designator, EntryTerminal, StoredEndLabel } from '@/api/types'
import { placesOf } from '@/lib/designators'

/**
 * The eight sides in the order a collision walks them.
 *
 * Clockwise from north, because "the next one clockwise" is a rule a reader can see working: two
 * labels on one dot end up adjacent rather than on opposite sides of it, which reads as one cluster
 * belonging to one point instead of two unrelated marks.
 */
export const CLOCKWISE: readonly Compass[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

/** Unit vectors, **y down**, as the page is. */
const DIAGONAL = Math.SQRT1_2
const VECTOR: Record<Compass, [number, number]> = {
  n: [0, -1],
  ne: [DIAGONAL, -DIAGONAL],
  e: [1, 0],
  se: [DIAGONAL, DIAGONAL],
  s: [0, 1],
  sw: [-DIAGONAL, DIAGONAL],
  w: [-1, 0],
  nw: [-DIAGONAL, -DIAGONAL],
}

/** The side an unauthored label sits on, and the default when there is nothing to point away
 * from. East, which is also what the marker layer does with a label nobody has placed. */
export const DEFAULT_SIDE: Compass = 'e'

/**
 * The side of `anchor` that faces away from `awayFrom`, snapped to the nearest of the eight — then
 * moved clockwise until it is one nothing else has taken.
 *
 * Away from, not towards: a label on `CR2:14` for a run heading west belongs to the east of the
 * pin, clear of its own conductor. Sitting on the wire it names is the one place it must not be,
 * because the whole job of the highlight is *which of these lines is the one I care about*.
 *
 * `awayFrom` equal to `anchor` — the other end has no point, a net of one member — is not an error:
 * there is no direction to compute, so it starts at east and de-collides from there.
 */
export function defaultSide(
  anchor: readonly [number, number],
  awayFrom: readonly [number, number],
  taken: ReadonlySet<Compass> = EMPTY,
): Compass {
  const dx = anchor[0] - awayFrom[0]
  const dy = anchor[1] - awayFrom[1]

  let start = DEFAULT_SIDE
  if (dx !== 0 || dy !== 0) {
    let best = -Infinity
    // Dot products rather than angles: no wrap-around to get wrong, and an exact tie between two
    // sides is broken by this order, which is what makes the answer repeatable.
    for (const side of CLOCKWISE) {
      const score = VECTOR[side][0] * dx + VECTOR[side][1] * dy
      if (score > best) {
        best = score
        start = side
      }
    }
  }

  const from = CLOCKWISE.indexOf(start)
  for (let step = 0; step < CLOCKWISE.length; step += 1) {
    const side = CLOCKWISE[(from + step) % CLOCKWISE.length]
    if (!taken.has(side)) return side
  }
  // All eight taken, which needs nine labels on one dot. Better to overlap than to drop the text.
  return start
}

const EMPTY: ReadonlySet<Compass> = new Set()

/** One end label, ready to draw. */
export interface PlannedLabel {
  /** Unique per label, so React has a key that survives a re-plan. */
  key: string
  /** The wire or net the label belongs to. */
  owner: string
  kind: 'wire' | 'net'
  /** The end it hangs off, which is also the id its compass control is headed with. */
  terminal: string
  point: [number, number]
  /** What is drawn: a wire's spec, a net's id. */
  text: string
  dir: Compass
  /** True where the side came from `locations.json` rather than from the rule. The panel needs
   * it to know whether *Reset to default* has anything to delete. */
  authored: boolean
}

/** Where the draft says this end's label goes, for the editor — the draft beats the server
 * because the server has not seen the last click. Same rule as `editorPlaces`. */
export type Overrides = (owner: string, terminal: string) => StoredEndLabel | undefined

/**
 * Every end label on the sheet, in one pass over the index.
 *
 * The order is fixed — wires by id, then nets by id, each walking its own membership in the order
 * the netlist gives it — because the order decides who gets a contested side. Anything that varied
 * with the payload's order or the render's would make a label's position a function of something
 * invisible.
 *
 * Reservations start with the **markers' own id labels**: a component's dot and a terminal's dot
 * are already writing a name on one side, and an end label landing on top of it is illegible.
 * Those are reserved whether or not that group is switched on, for the determinism reason above.
 */
export function planEndLabels(
  entries: readonly Designator[],
  overrides?: Overrides,
): PlannedLabel[] {
  const taken = new Map<string, Set<Compass>>()
  const reserve = (point: readonly [number, number], side: Compass) => {
    const key = at(point)
    const sides = taken.get(key)
    if (sides) sides.add(side)
    else taken.set(key, new Set([side]))
  }

  for (const entry of entries) {
    if (entry.kind !== 'component' && entry.kind !== 'terminal') continue
    for (const place of placesOf(entry)) reserve(place.point, place.label_dir ?? DEFAULT_SIDE)
  }

  const owners = [
    ...byId(entries.filter((entry) => entry.kind === 'wire')),
    ...byId(entries.filter((entry) => entry.kind === 'net')),
  ]

  const planned: PlannedLabel[] = []
  for (const entry of owners) {
    const kind = entry.kind as 'wire' | 'net'
    // `printed` is published by `drawing.py` only where it differs from the id — see `printed_net`
    // there for why the rule lives on the server. `K10`.
    const text = kind === 'wire' ? entry.spec : (entry.printed ?? entry.id)
    // A wire with no colour and no gauge has nothing printed to show. Two of 71.
    if (!text) continue
    const members = entry.terminals ?? []
    /** One label per dot per owner: three members of a net sharing one point is one `120`, not
     * three fanned around it saying the same word. */
    const drawn = new Set<string>()

    members.forEach((member, index) => {
      if (!member.point || member.hidden) return
      const key = at(member.point)
      if (drawn.has(key)) return

      const override = overrides?.(entry.id, member.id)
      if (override?.hidden) return
      const authored = override ? override.dir : member.label_dir
      const dir =
        authored ??
        defaultSide(member.point, elsewhere(kind, members, index, member), taken.get(key))

      drawn.add(key)
      reserve(member.point, dir)
      planned.push({
        key: `${entry.id}@${member.id}#${index}`,
        owner: entry.id,
        kind,
        terminal: member.id,
        point: member.point,
        text,
        dir,
        authored: Boolean(authored),
      })
    })
  }
  return planned
}

/**
 * The point a label should face away from: a wire's **other end**, a net's centroid without this
 * member in it.
 *
 * Deliberately not the entry's own `point`, which is the centre of a bounding box and is usually
 * blank paper. It would work as a direction and it is a habit worth not starting — nothing in this
 * application reads that field as a place.
 */
function elsewhere(
  kind: 'wire' | 'net',
  members: readonly EntryTerminal[],
  index: number,
  self: EntryTerminal,
): [number, number] {
  const others = members.filter((member, i) => i !== index && member.point)
  if (!others.length) return self.point as [number, number]
  if (kind === 'wire') return others[0].point as [number, number]
  let x = 0
  let y = 0
  for (const other of others) {
    x += other.point![0]
    y += other.point![1]
  }
  return [x / others.length, y / others.length]
}

const BY_ID = new Intl.Collator(undefined, { numeric: true })

function byId(entries: readonly Designator[]): Designator[] {
  return [...entries].sort((a, b) => BY_ID.compare(a.id, b.id))
}

/** A point as a collision key, at the tenth of a point `locations.json` records — so two members
 * drawn on one dot genuinely collide and two a tenth apart do not. */
function at(point: readonly [number, number]): string {
  return `${Math.round(point[0] * 10)},${Math.round(point[1] * 10)}`
}
