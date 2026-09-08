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

import type { Designator, LocationsDocument, StoredWire, WiringDocument } from '@/api/types'
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
  const moved = original[0] !== next[0] || original[1] !== next[1]

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
 */
export function unconfirm(
  document: WiringDocument,
  wireId: string,
  before: Endpoints,
): WiringDocument {
  const record = wireRecord(document, wireId)
  if (!record || record.retired !== undefined) return document
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

/**
 * **Has this wire been dealt with** — the one predicate the queue and the count share.
 *
 * Confirmed **and** both ends named, or retired. Three things rather than one because they are
 * three different ways for a wire to be finished with, and a queue that counted only the first
 * would let the count reach its own total while a row nobody had finished sat in the list — which
 * is `T-940`'s complaint about the path queue, in a second queue.
 *
 * A **retired** wire is decided about: somebody said it does not exist. Retiring is Phase E's to
 * unlock, and the generator drops a retired wire from the netlist, so this branch is reachable
 * only in the window between the save and the re-run — but leaving it out would have put a
 * tombstoned wire in a queue nobody could empty.
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
