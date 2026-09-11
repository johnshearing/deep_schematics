/**
 * The wiring editor's arithmetic — pure functions over the draft `wiring.json`.
 *
 * The sibling of `model.ts`, over the fourth authored file rather than the second, and separate
 * from it for the same reason the two documents are separate: *where a thing is drawn* and *what
 * it connects to* are two claims a person makes separately, and a module that held both could not
 * tell you which one you had changed.
 *
 * ### The one thing this file exists to make possible
 *
 * > **A wire whose endpoints do not change still gets a record when a person confirms it.**
 *
 * *I looked and it was right* is a decision. 47 of this drawing's 71 wires are that case, and a
 * file that stored only corrections would leave those 47 indistinguishable from the wires nobody
 * had opened. That is the distinction `locations.json` exists for, and invariant 10 is the general
 * form of it — with the same exception `label_corrections.py` argues at length: a **confirmation**
 * is kept, because nothing produces *a person checked this* but a person.
 *
 * ### Where a wire's endpoints actually come from
 *
 * Two places, in precedence order, and the order is the whole of it:
 *
 * 1. **the draft's own record**, if there is one — which after Phase 0 there is, for all 71;
 * 2. **the netlist**, through `entry.terminals`, for a wire nobody has a record for.
 *
 * The second is not "the index's answer" and must not be read as one: `circuit_logic.json` is
 * *generated from* `wiring.json`, so after a correction and a re-run it is the corrected pair.
 * That is why `was` is stamped from **the record's own previous endpoints** rather than from the
 * netlist — see `setEndpoint`.
 *
 * ### It never learns about `locateStore`, and that is `H18`
 *
 * There are three whole-document drafts now, over three authored files, in three stores that do
 * not know about each other. `pathStale` below is the one place two documents meet, and it meets
 * them as **arguments** — a pure function handed both — rather than by one store reaching into
 * the other. Anything that made a wiring decision touch `locations.json` would re-create the
 * single-draft problem inside the code instead of in the file.
 */

import type {
  Designator,
  EntryTerminal,
  LocationsDocument,
  StoredCommoning,
  StoredWire,
  WiringDocument,
} from '@/api/types'
// *Which block is this pin on*, one question and one answer — the shape rule `lib/designators.ts`
// keeps for the three callers that ask it. A value import out of a leaf module the reader's side
// also uses, which is the direction that is safe: nothing there imports back.
import { blockOf } from '@/lib/designators'
// **Type-only**, deliberately. `model.ts` imports `pathStale` from here for one word on a row, so
// a value import in this direction would close a runtime cycle between the two documents' rule
// modules — which is the code-level shape of the coupling `H18` forbids between their stores.
import type { Stamp } from './model'

/** One, and no migration to think about yet. The editor stamps it onto the draft as it loads, the
 * way `model.SCHEMA` is stamped onto `locations.json`. */
export const SCHEMA = 1

/** Which end of a wire. The order is content — `[from, to]` is what the two slots are headed
 * with, and swapping them would relabel both. */
export type End = 'from' | 'to'
export const ENDS: readonly End[] = ['from', 'to']

/** A wire's two endpoints, in `[from, to]` order, with `null` for an end nobody has set. */
export type Endpoints = [string | null, string | null]

export function emptyWiring(drawingNumber: string | null): WiringDocument {
  return { drawing_number: drawingNumber, schema: SCHEMA, wires: {}, commoning: {} }
}

/** The draft's record for this wire, or undefined. */
export function wireRecord(document: WiringDocument, wireId: string): StoredWire | undefined {
  return document.wires?.[wireId]
}

/**
 * This wire's two endpoints as the editor sees them right now.
 *
 * The draft's record beats the netlist for the same reason it does for a point: the netlist has
 * not seen the last click, and it will not until somebody re-runs the generator.
 */
export function endpointsOf(document: WiringDocument, entry: Designator): Endpoints {
  const record = wireRecord(document, entry.id)
  if (record && record.retired === undefined) {
    return [record.from ?? null, record.to ?? null]
  }
  const members = entry.terminals ?? []
  return [members[0]?.id ?? null, members[1]?.id ?? null]
}

/** **A wire a person put on the drawing**, at an id the indexing pass never allocated. It stays
 * true after the wire reaches the netlist: it is a fact about where the wire came from, not a
 * state it grows out of. */
export function added(document: WiringDocument, wireId: string): boolean {
  return wireRecord(document, wireId)?.added === true
}

/** Why this wire was tombstoned, or null for a wire that still exists. */
export function retiredReason(document: WiringDocument, wireId: string): string | null {
  return wireRecord(document, wireId)?.retired ?? null
}

/** Who says these are the two terminals. `index` for a wire with no record, because a wire nobody
 * has touched is still the indexing pass's guess whether or not it was written down. */
export function sourceOf(document: WiringDocument, wireId: string): 'index' | 'human' {
  const record = wireRecord(document, wireId)
  return record?.source === 'human' ? 'human' : 'index'
}

/** *A person looked at this one* — **including where nothing changed.** This is what the queue
 * counts, and the reason it reads `0 of 71` the first time the screen is opened. */
export function confirmed(document: WiringDocument, wireId: string): boolean {
  const record = wireRecord(document, wireId)
  return record?.retired === undefined && record?.source === 'human'
}

/** A confirmation that **moved** an endpoint. `was` is present on exactly these. */
export function corrected(document: WiringDocument, wireId: string): boolean {
  return confirmed(document, wireId) && Array.isArray(wireRecord(document, wireId)?.was)
}

/** Both ends named. Different from `confirmed`: a person can confirm one end and leave the other
 * for later, and the panel has to be able to show that. */
export function settled(document: WiringDocument, entry: Designator): boolean {
  const [from, to] = endpointsOf(document, entry)
  return from !== null && to !== null
}

/**
 * **Confirm this wire as it stands** — the acceptance criterion of Phase A.
 *
 * Writes `source: human`, a `by` and an `at`, and **no `was`**, because nothing was replaced. That
 * is the whole of *I looked and it was right*, and it is a decision the file could not previously
 * hold: before this, 47 correct wires and 71 unexamined ones were the same bytes.
 *
 * Idempotent by construction — confirming twice restamps the time and changes nothing else.
 */
export function confirmEndpoints(
  document: WiringDocument,
  wireId: string,
  ends: Endpoints,
  stamp: Stamp,
): WiringDocument {
  return writeWire(document, wireId, (record) => ({
    ...record,
    from: ends[0],
    to: ends[1],
    source: 'human',
    ...(stamp.by ? { by: stamp.by } : {}),
    at: stamp.at,
  }))
}

/**
 * Move one end of a wire onto a terminal, and keep what it replaced.
 *
 * **`was` is stamped from the record's own previous endpoints, once, and then never overwritten.**
 * It means *the pair this record replaced* — the machine's answer — so a person who changes their
 * mind twice must not lose the original to their own second thought. That is exactly what `was` on
 * a label correction means, and for the same reason: the hand-maintained source it came from can
 * be edited afterwards and would take the original with it.
 *
 * And **a correction taken back stops being a correction**: set an end back to what `was` holds
 * and the stamp is dropped rather than left standing over a pair it no longer replaces. Invariant
 * 10 in a fourth file — a file that says a person moved something they did not move has stopped
 * being a record of who said what.
 */
export function setEndpoint(
  document: WiringDocument,
  wireId: string,
  end: End,
  terminal: string | null,
  before: Endpoints,
  stamp: Stamp,
): WiringDocument {
  const record = wireRecord(document, wireId)
  const held: Endpoints =
    record && record.retired === undefined ? [record.from ?? null, record.to ?? null] : before
  const next: Endpoints = end === 'from' ? [terminal, held[1]] : [held[0], terminal]
  const original: Endpoints = (record?.was as Endpoints | undefined) ?? held
  // **Never on a wire somebody added.** `was` means *the pair this record replaced*, and an added
  // wire replaced nothing — its first two clicks would otherwise stamp `was: [null, null]`, which
  // would read in the file and on the badge as a correction to an answer nobody ever gave.
  const moved = record?.added !== true && (original[0] !== next[0] || original[1] !== next[1])

  return writeWire(document, wireId, (existing) => {
    const written: StoredWire = {
      ...existing,
      from: next[0],
      to: next[1],
      source: 'human',
      ...(stamp.by ? { by: stamp.by } : {}),
      at: stamp.at,
    }
    if (moved) written.was = original
    else delete written.was
    return written
  })
}

/**
 * Take a confirmation back — the *Reset* the Review tab has, in the fourth file.
 *
 * The record goes back to `source: index` with **the endpoints `was` was holding**, and the `was`,
 * the `by` and the `at` go with it. It does not delete the record: the bootstrap wrote one for all
 * 71 and a missing record would read in `git diff` as somebody having removed a wire, which is a
 * different and much louder claim than *nobody has checked this yet*.
 *
 * It exists because the alternative is a text editor. A person who confirms the row above the one
 * they meant needs one press to undo it, on a screen whose whole purpose is that a decision is a
 * person's.
 *
 * **Refused on a wire somebody added**, and that is Phase E's one interaction with this function.
 * `index` means *the indexing pass's own answer*, and the indexing pass never gave one for a wire
 * a person invented — writing it here would put a guess in the file that nothing ever guessed.
 * The way out of an added wire is `retireWire`, which says what actually happened.
 */
export function unconfirm(
  document: WiringDocument,
  wireId: string,
  before: Endpoints,
): WiringDocument {
  const record = wireRecord(document, wireId)
  if (!record || record.retired !== undefined || record.added === true) return document
  const original: Endpoints = (record.was as Endpoints | undefined) ?? [
    record.from ?? before[0],
    record.to ?? before[1],
  ]
  return writeWire(document, wireId, (existing) => {
    const written: StoredWire = { ...existing, from: original[0], to: original[1], source: 'index' }
    delete written.was
    delete written.by
    delete written.at
    delete written.note
    return written
  })
}

/** A note about the **connection**. The note about the printed callout stays in the `W` table, and
 * this is refused on a record nobody has decided about: a note riding on nothing would record a
 * confirmation nobody made — the same rule `setNote` follows on the Review tab. */
export function setWiringNote(
  document: WiringDocument,
  wireId: string,
  note: string,
): WiringDocument {
  if (!confirmed(document, wireId)) return document
  return writeWire(document, wireId, (existing) => {
    const written = { ...existing }
    if (note.trim()) written.note = note.trim()
    else delete written.note
    return written
  })
}

// -- Phase E: a wire a person adds, and a wire a person takes away ----------------------------
//
// Everything above edits the 71 wires the indexing pass found. These four say that the set of
// wires is itself a thing a person may be wrong about — which §3.7 measured as **0 genuinely
// missing field wires** on this drawing, so all of it is insurance for drawing number two.
//
// The one rule underneath all four: **an id is allocated once and never reused.** A retired
// record is a tombstone rather than a deletion, `nextWireId` counts past it, and the reason is
// the 58 authored paths — every one keys on a `W###`, and recycling an id would silently
// reattach somebody's route to a different wire with nothing on screen looking any different.

/**
 * **The next id nothing has ever used** — one past the highest the netlist or the draft knows.
 *
 * Both sources, and it must be both. The netlist has the 71 the `W` table produced; the draft has
 * those plus every id a person has allocated since, **including the retired ones**, which is what
 * makes an id permanent rather than merely unused. A wire added and then withdrawn does not hand
 * its number back.
 *
 * `W###` with three digits, which is what every id in this project is, and it widens rather than
 * wraps past 999 — a four-digit id is ugly and a duplicate is a bug.
 */
export function nextWireId(known: readonly string[], document: WiringDocument): string {
  let highest = 0
  for (const id of [...known, ...Object.keys(document.wires ?? {})]) {
    const digits = /^W(\d+)$/.exec(id)
    if (digits) highest = Math.max(highest, Number(digits[1]))
  }
  const next = highest + 1
  return `W${String(next).padStart(3, '0')}`
}

/**
 * **Add a wire** — a record at a free id with both ends empty, and nothing else.
 *
 * `source: 'human'` from the first instant, because there is no other honest value: `index` means
 * *the indexing pass's own answer* and the indexing pass never saw this wire. That does **not**
 * make it decided — `wiringDecided` also wants both ends named, so a new wire sits at the top of
 * the queue with two empty slots until somebody picks them, which is exactly where it belongs.
 *
 * `added: true` is the marker the generator needs. Without it an id past the end of the `W` table
 * is indistinguishable from a typo, which is why every one of them was refused until now — and
 * the typo is still refused, by name, one word away in the same file.
 *
 * Refuses to overwrite an existing record, retired ones included. Allocating an id somebody has
 * already spent is the one mistake this whole section exists to make impossible, and a caller
 * that has miscounted should get nothing rather than somebody else's wire.
 */
export function addWire(document: WiringDocument, wireId: string, stamp: Stamp): WiringDocument {
  if (document.wires?.[wireId]) return document
  return writeWire(document, wireId, () => ({
    from: null,
    to: null,
    source: 'human',
    added: true,
    ...(stamp.by ? { by: stamp.by } : {}),
    at: stamp.at,
  }))
}

/**
 * **Retire this wire** — a tombstone with a reason, in place of the two ends.
 *
 * The endpoints go, and that is the format's decision rather than an oversight: saying where a
 * wire went while saying it does not exist is two claims at once, and both validators refuse a
 * record that makes them. `unretire` puts the wire back from the netlist, where the netlist still
 * has it.
 *
 * A reason in words is required, and it is required because a wire is not usually retired for
 * being *absent* — it is retired for being a duplicate, or for being one run somebody read as
 * two. Six months later *"read twice; `W014` is this run"* is the whole of what a reader needs
 * and there is nowhere else for it to live.
 *
 * `added` survives, so a wire somebody added and then withdrew still says so. The count of ids a
 * person has allocated is a count of ids spent, and this does not hand one back.
 */
export function retireWire(
  document: WiringDocument,
  wireId: string,
  reason: string,
  stamp: Stamp,
): WiringDocument {
  if (!reason.trim()) return document
  return writeWire(document, wireId, (existing) => {
    const written: StoredWire = {
      ...(existing.added ? { added: true as const } : {}),
      retired: reason.trim(),
      ...(stamp.by ? { by: stamp.by } : {}),
      at: stamp.at,
    }
    return written
  })
}

/**
 * **Take a retirement back**, and the wire comes back **unconfirmed**.
 *
 * `source: 'index'` and both ends from wherever they can be got — which is the netlist for a wire
 * the generator has not dropped yet, and nowhere at all for one it has. That is the honest
 * outcome rather than a shortcoming: a tombstone holds a reason and no endpoints, so there is
 * nothing in the file to put back, and a wire whose retirement you have just reversed is exactly
 * a wire to look at again. The panel says which of the two happened.
 *
 * An **added** wire keeps `added` and comes back with `source: 'human'`: `index` would claim the
 * indexing pass found a wire a person invented, which is the one thing `source` exists to stop.
 */
export function unretire(
  document: WiringDocument,
  wireId: string,
  fromNetlist: Endpoints,
): WiringDocument {
  const record = wireRecord(document, wireId)
  if (!record || record.retired === undefined) return document
  const wasAdded = record.added === true
  return writeWire(document, wireId, (existing) => ({
    ...(existing.added ? { added: true as const } : {}),
    from: fromNetlist[0],
    to: fromNetlist[1],
    source: wasAdded ? 'human' : 'index',
  }))
}

/**
 * **The wires that exist only in the draft**, as rows the editor's list can show.
 *
 * A wire a person adds is in `wiring.json` the moment it is saved and in `circuit_logic.json`
 * only after somebody re-runs the generator, so between the two it has no `/api/designators`
 * entry — and without one it would be a record with no row, no panel and no way to give it its
 * two ends. Rather than teach the list about a second kind of thing, this makes the draft's
 * additions look like what they are about to be.
 *
 * **Deliberately in this module and not in `lib/designators.ts`.** That one is the reader's, and
 * the Drawing tab must not paint a wire the netlist does not have: a reader with no password sees
 * the artifact, and the artifact is the promise. Here the entries are the *editor's* view of its
 * own unsaved half, which is what every draft in this project already is.
 *
 * `on_sheet: false`, like every other `W###` — the id is one we invented and is printed nowhere.
 * `point` and `rect` are read off the **ends it has**, exactly the way the server frames a wire:
 * a wire's geometry is its terminals' and nothing else, so a wire with no ends yet is framed
 * nowhere and says so on its row.
 */
export function draftWireEntries(
  document: WiringDocument,
  known: readonly Designator[],
): Designator[] {
  const have = new Set(known.map((entry) => entry.id))
  // The pins, as the index resolved them — **placement carried, never asserted**. A terminal
  // drawn on its parent component's dot says `parent`, and a row of this list claiming
  // `confirmed` for it would be the one thing invariant 3 forbids.
  const at: Record<string, EntryTerminal> = {}
  for (const entry of known) {
    if (entry.kind === 'terminal' && entry.point) {
      at[entry.id] = { id: entry.id, point: entry.point, placement: entry.placement ?? null }
    }
  }

  const out: Designator[] = []
  for (const [id, record] of Object.entries(document.wires ?? {})) {
    if (have.has(id) || record.added !== true) continue
    const ends = (
      record.retired === undefined ? [record.from ?? null, record.to ?? null] : []
    ).filter((end): end is string => end !== null)
    const points = ends.flatMap((end) => (at[end]?.point ? [at[end].point as [number, number]] : []))
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)

    out.push({
      id,
      kind: 'wire',
      label:
        record.retired === undefined
          ? 'a wire you added — it reaches the netlist when the generator next runs'
          : `a wire you added and retired: ${record.retired}`,
      on_sheet: false,
      members: [...new Set(ends.map(blockOf))],
      terminals: ends.map((end) => at[end] ?? { id: end, point: null, placement: null }),
      point: points.length
        ? [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
        : null,
      rect: points.length
        ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
        : null,
    })
  }
  return out
}

/**
 * **Has this wire been dealt with** — the one predicate the queue and the count share.
 *
 * Confirmed **and** both ends named, or retired. Three things rather than one because they are
 * three different ways for a wire to be finished with, and a queue that counted only the first
 * would let the count reach its own total while a row nobody had finished sat in the list — which
 * is `T-940`'s complaint about the path queue, in a second queue.
 *
 * A **retired** wire is decided about: somebody said it does not exist. The generator drops one
 * from the netlist, so for a wire the `W` table has this branch only matters in the window
 * between the save and the re-run — but leaving it out would put a tombstoned wire in a queue
 * nobody could empty, and for a wire somebody *added* and then withdrew the row is the draft's
 * own and never goes anywhere else.
 */
export function wiringDecided(document: WiringDocument, entry: Designator): boolean {
  const record = wireRecord(document, entry.id)
  if (record?.retired !== undefined) return true
  return confirmed(document, entry.id) && settled(document, entry)
}

/**
 * **`n of 71 wires confirmed`** — the queue's header, and the one number on this screen that
 * counts *decisions* rather than data.
 *
 * It reaches its own total because every wire has a state a person can put it in, which is `K7`
 * avoided the way the `Paths` count avoided it. And it starts at **0**, which is decision 4 asking
 * for the honest figure: every record the bootstrap wrote says `index`.
 */
export function wiringCoverage(entries: readonly Designator[], document: WiringDocument) {
  const wires = entries.filter((entry) => entry.kind === 'wire')
  return {
    wires: wires.length,
    confirmed: wires.filter((entry) => wiringDecided(document, entry)).length,
    corrected: wires.filter((entry) => corrected(document, entry.id)).length,
  }
}

/** Whether this wire is still in the queue — `wiringDecided`, negated, and nothing else, so the
 * filter and the count cannot come to disagree. The same rule `pathSettled` follows. */
export function wiringPending(document: WiringDocument, entry: Designator): boolean {
  return entry.kind === 'wire' && !wiringDecided(document, entry)
}

/**
 * Terminal id → the net it is on, built from the index the client already has.
 *
 * `/api/designators` publishes a net's member `terminals` and not the other direction, so this is
 * the reverse pass — one loop over 26 nets, in a leaf module, which is where `pathsFor`'s sibling
 * reverse index belongs too. **No server change**, and it is the same argument §4 q7 makes about
 * *a terminal's wires*: a reverse index over a payload already on the page is not a new endpoint.
 */
export function terminalNets(entries: readonly Designator[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const entry of entries) {
    if (entry.kind !== 'net') continue
    for (const member of entry.terminals ?? []) {
      if (!(member.id in out)) out[member.id] = entry.id
    }
  }
  return out
}

/**
 * The two ends' nets, and whether they differ — **a flag, never a fix.**
 *
 * Decision 5 stopped storing a wire's net precisely so this could be visible: net membership comes
 * from each terminal's own field, and a wire's copy was a third statement of the same fact — the
 * one that goes stale silently when an endpoint moves.
 *
 * A wire across two nets is sometimes **the finding** and sometimes correct. `W019` corrected runs
 * `PS1:-2 → TB-GND-B:2` and reads `0V` at one end and `GND` at the other, because it is a
 * 0 V-to-ground **bond**; so is a wire across a breaker or a disconnect. A screen that quietly
 * picked one end's net would hide the only interesting thing about the wire, so this returns the
 * pair and says nothing about which is right.
 */
export function netsAcross(
  ends: Endpoints,
  nets: Record<string, string>,
): { from: string | null; to: string | null; differ: boolean } {
  const from = ends[0] ? (nets[ends[0]] ?? null) : null
  const to = ends[1] ? (nets[ends[1]] ?? null) : null
  return { from, to, differ: from !== null && to !== null && from !== to }
}

/**
 * **`path may be stale`** — one comparison, and it is the whole of plan §4 q9.
 *
 * A path is a claim about **ink**, and the ink does not move. So correcting a wire's endpoint does
 * not invalidate its route — *unless the correction moves the end that route reaches.* Every path
 * authored since 2026-09-07 carries `for`: the wire's two terminals as they were when the route
 * was accepted. Comparing that against the endpoints today is how the screen can say *look at this
 * one again* rather than asking a person to remember which wires they corrected, and it keeps
 * working for every future correction instead of for one batch.
 *
 * Unordered, deliberately: a route is not directed, so a wire whose `from` and `to` were swapped
 * has not moved either of its ends and its path is fine.
 *
 * `for` absent means **not stale** rather than unknown. Zero of the 58 existing paths lack it —
 * the bootstrap back-filled them all — so an absent stamp today is a hand edit, and inventing
 * doubt about a hand-authored route is worse than saying nothing about it.
 */
export function pathStale(
  locations: LocationsDocument,
  wiring: WiringDocument,
  entry: Designator,
): boolean {
  if (entry.kind !== 'wire') return false
  // Read straight out of the `wires` section rather than through `model.storedLabel`, to keep the
  // import above type-only. A path only ever lives on a wire — a net carrying one is refused by
  // name on the server — so the two-section lookup would have nothing to add here.
  const accepted = locations.wires?.[entry.id]?.path?.for
  if (!Array.isArray(accepted) || accepted.length !== 2) return false
  const now = endpointsOf(wiring, entry)
  if (now[0] === null || now[1] === null) return false
  return [...accepted].sort().join(' ') !== [...now].sort().join(' ')
}

// -- the commoning section, and it is the other kind of claim ---------------------------------
//
// Everything above is *what connects to what* and every save of it makes `circuit_logic.json`
// stale. Everything below is **display geometry**: a block's own bus is not field wire, it earns
// no `CONNECTS_TO` edge, the generator does not read the section at all, and
// `test_commoning_does_not_reach_the_netlist` compares bytes to prove it. Two claims in one file,
// and the file can tell you which one you changed because they are two sections.

/** What this block's bus record says, or undefined for a block nobody has commoned. */
export function commoningOf(
  document: WiringDocument,
  block: string,
): StoredCommoning | undefined {
  return document.commoning?.[block]
}

/** Blocks somebody has authored a bus for. The queue counts against the ink's proposals, which is
 * why this is a list rather than a number: the two are different sets and the panel says so. */
export function commonedBlocks(document: WiringDocument): string[] {
  return Object.keys(document.commoning ?? {})
}

/**
 * **Accept the ink's proposal for a block's bus** — the only way a commoning record is written.
 *
 * `geometry: 'extracted'` because the polylines are stretches of the PDF's own conductor strokes,
 * and `attribution: 'human'` because a **person** said these are the block's own commoning rather
 * than field wire. Never `printed`: nothing on this sheet writes *commoning* beside a line, and
 * `printed` is reserved for accepting a match with nobody looking. Never `derived`, which the
 * server refuses by name — the shape rule *found* this bus and finding it is not deciding it.
 *
 * `page` is written only where the caller has one, which on a single-sheet drawing is never. It is
 * the one page number in this file and it exists so the first two-page circuit is not a schema
 * change.
 */
export function setCommoning(
  document: WiringDocument,
  block: string,
  bus: { runs: [number, number][][]; conductors: string[]; page?: number },
  stamp: Stamp,
): WiringDocument {
  if (bus.runs.length === 0) return document
  const record: StoredCommoning = {
    ...(document.commoning?.[block] ?? {}),
    runs: bus.runs.map((run) => run.map(([x, y]) => [round(x), round(y)] as [number, number])),
    geometry: 'extracted',
    attribution: 'human',
    ...(bus.conductors.length ? { conductors: [...bus.conductors] } : {}),
    ...(bus.page !== undefined ? { page: bus.page } : {}),
    ...(stamp.by ? { by: stamp.by } : {}),
    at: stamp.at,
  }
  return { ...document, commoning: { ...(document.commoning ?? {}), [block]: record } }
}

/**
 * Take a block's bus back off the file — and here the record really is **deleted**.
 *
 * The opposite of `unconfirm` one section up, and the difference is who wrote the record. Every
 * one of the 71 wire records was written by `bootstrap_wiring.py`, so a vanished one reads in
 * `git diff` as a wire somebody removed; `unconfirm` therefore writes `index` rather than leaving
 * a hole. Nothing bootstraps a bus. A commoning record exists **only** because a person accepted
 * one, so *nobody has authored this* and *no record* are the same state, and keeping an empty one
 * would invent a third.
 */
export function clearCommoning(document: WiringDocument, block: string): WiringDocument {
  if (!document.commoning?.[block]) return document
  const commoning = { ...document.commoning }
  delete commoning[block]
  return { ...document, commoning }
}

/** A note about **this block's bus**, and refused where there is no record to ride on — the same
 * rule `setWiringNote` and the Review tab's note box follow, and the same reason. */
export function setCommoningNote(
  document: WiringDocument,
  block: string,
  note: string,
): WiringDocument {
  const record = document.commoning?.[block]
  if (!record) return document
  const written: StoredCommoning = { ...record }
  if (note.trim()) written.note = note.trim()
  else delete written.note
  return { ...document, commoning: { ...document.commoning, [block]: written } }
}

/**
 * **`n of m blocks commoned`** — and unlike the wiring queue, `m` is what the *ink* proposes.
 *
 * A wire's total is 71 because the netlist has 71 wires and every one of them has a state a person
 * can put it in. A block's bus has no such total: nothing in the netlist says which components
 * have one, and `TB-130`'s two points are 71 pt apart with no conductor joining them, so the ink
 * cannot propose one and this screen cannot author one. The honest denominator is therefore
 * *blocks the ink offers, plus blocks somebody has already authored* — a set that can be finished,
 * which is `K7` avoided the way the `Paths` count avoided it.
 *
 * It goes to `0 of 0` rather than misreporting when the conductors have not loaded, and the panel
 * says which of the two that is.
 */
export function commoningCoverage(
  document: WiringDocument,
  proposed: readonly string[],
): { blocks: number; commoned: number } {
  const all = new Set([...proposed, ...commonedBlocks(document)])
  return {
    blocks: all.size,
    commoned: [...all].filter((block) => document.commoning?.[block]).length,
  }
}

/** A tenth of a point, which is the precision every authored coordinate in this project records.
 * A stretch cut out of a polyline lands on an arbitrary float, and a file a person reads should
 * not carry fifteen digits of it. */
function round(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * The one writer for the `wires` section, so *what a record may become* is decided once.
 *
 * Unlike `model.ts`'s `writeWire`, an empty record is **kept** rather than dropped, because this
 * file's records were not written by a person in the first place: `bootstrap_wiring.py` wrote 71
 * of them and a vanished record would read in `git diff` as a wire somebody deleted. `unconfirm`
 * is the way back to *nobody has checked this*, and it goes there by writing `index` rather than
 * by leaving a hole.
 */
function writeWire(
  document: WiringDocument,
  wireId: string,
  change: (record: StoredWire) => StoredWire,
): WiringDocument {
  const wires = { ...(document.wires ?? {}) }
  wires[wireId] = change({ ...wires[wireId] })
  return { ...document, wires }
}
