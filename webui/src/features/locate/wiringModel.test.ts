/**
 * The wiring editor's rules, as arithmetic — and the one it exists for is the first test below.
 *
 * > **A wire whose endpoints do not change still gets a record when a person confirms it.**
 *
 * 47 of this drawing's 71 wires are that case. Before this file the only thing `wiring.json` could
 * record was a *correction*, which would have left those 47 byte-identical to the wires nobody had
 * opened — and telling *nobody has looked at this* from *somebody decided this* is the only thing
 * an authored file is for.
 *
 * The rest of these are the faults each rule prevents, and every one of them is a way for the file
 * to end up claiming something a person did not say:
 *
 * - a `was` overwritten by a second thought, losing the machine's original answer;
 * - a `was` left standing after a correction was taken back, so the file says an endpoint moved
 *   when it is exactly where it started;
 * - a confirmation that cannot be undone without a text editor;
 * - a note recorded on a row nobody decided about, which would invent the decision to hang it on;
 * - a wire across two nets quietly resolved to one of them, which would hide the only interesting
 *   thing about `W019`;
 * - `path may be stale` fired by a swap that moved neither end, or missed when an end really moved.
 *
 * **And since Phase E, the two that would be worst of all**: an id handed out twice, which would
 * reattach somebody's authored route to a different wire in silence; and a wire a person invented
 * quietly relabelled as something the indexing pass guessed.
 */

import { describe, expect, it } from 'vitest'

import type { Designator, LocationsDocument, WiringDocument } from '@/api/types'
import {
  added,
  addWire,
  confirmEndpoints,
  confirmed,
  corrected,
  draftWireEntries,
  emptyWiring,
  endpointsOf,
  netsAcross,
  nextWireId,
  pathStale,
  retireWire,
  retiredReason,
  setEndpoint,
  setWiringNote,
  settled,
  sourceOf,
  terminalNets,
  unconfirm,
  unretire,
  wireRecord,
  wiringCoverage,
  wiringDecided,
  wiringPending,
} from './wiringModel'

const STAMP = { by: 'js', at: '2026-09-08T10:00:00.000Z' }

/** A wire as `/api/designators` publishes one: its two member terminals, in `[from, to]` order. */
function wire(id: string, from: string, to: string): Designator {
  return {
    id,
    kind: 'wire',
    label: id,
    on_sheet: false,
    members: [],
    point: null,
    rect: null,
    terminals: [
      { id: from, point: [0, 0], placement: 'confirmed' },
      { id: to, point: [10, 0], placement: 'confirmed' },
    ],
  }
}

function net(id: string, terminals: string[]): Designator {
  return {
    id,
    kind: 'net',
    label: id,
    on_sheet: true,
    members: [],
    point: null,
    rect: null,
    terminals: terminals.map((t) => ({ id: t, point: [0, 0], placement: 'confirmed' as const })),
  }
}

/** The file as the bootstrap leaves it: one record per wire, every one saying `index`. */
function bootstrapped(ends: Record<string, [string, string]>): WiringDocument {
  return {
    drawing_number: 'PS20115MLM4-2',
    schema: 1,
    wires: Object.fromEntries(
      Object.entries(ends).map(([id, [from, to]]) => [id, { from, to, source: 'index' as const }]),
    ),
    commoning: {},
  }
}

const W063 = wire('W063', 'INFEED1:3', 'TB-120:2')

describe('confirming a wire', () => {
  it('records a decision even though nothing moved — the phase acceptance criterion', () => {
    // The 47 wires the ink already agrees with. Nothing about the endpoints changes, and the file
    // now says a person took responsibility for them.
    const before = bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] })
    const after = confirmEndpoints(before, 'W063', endpointsOf(before, W063), STAMP)

    expect(confirmed(before, 'W063')).toBe(false)
    expect(confirmed(after, 'W063')).toBe(true)
    expect(wireRecord(after, 'W063')).toEqual({
      from: 'INFEED1:3',
      to: 'TB-120:2',
      source: 'human',
      by: 'js',
      at: STAMP.at,
    })
  })

  it('writes no `was` when nothing was replaced', () => {
    // `was` means *the pair this record replaced*. Writing one where the endpoints are exactly the
    // index's would say a person moved something they did not move.
    const after = confirmEndpoints(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    expect(wireRecord(after, 'W063')).not.toHaveProperty('was')
    expect(corrected(after, 'W063')).toBe(false)
  })

  it('moves the count, which is what makes the queue finishable', () => {
    const entries = [W063, wire('W068', 'DISCHARGE1:3', 'TB-120:2')]
    const before = bootstrapped({
      W063: ['INFEED1:3', 'TB-120:2'],
      W068: ['DISCHARGE1:3', 'TB-120:2'],
    })
    expect(wiringCoverage(entries, before)).toEqual({ wires: 2, confirmed: 0, corrected: 0 })

    const after = confirmEndpoints(before, 'W063', ['INFEED1:3', 'TB-120:2'], STAMP)
    expect(wiringCoverage(entries, after)).toEqual({ wires: 2, confirmed: 1, corrected: 0 })
    // The filter and the count share one predicate, so they cannot come to disagree — the rule
    // `pathSettled` follows for the other queue on this screen.
    expect(wiringPending(after, W063)).toBe(false)
    expect(wiringPending(after, entries[1])).toBe(true)
  })

  it('leaves a half-set wire in the queue, however confirmed it says it is', () => {
    // *Confirmed* and *finished* are two questions, and the queue asks the second. A wire with an
    // end nobody has set is something somebody started — `Add a wire` in Phase E creates exactly
    // that — and a count that had already claimed it would reach its own total with a row still
    // in the list. That is `T-940`'s complaint about the path queue, and this queue does not
    // repeat it.
    const doc = setEndpoint(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      'to',
      null,
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    expect(confirmed(doc, 'W063')).toBe(true)
    expect(wiringPending(doc, W063)).toBe(true)
    expect(wiringCoverage([W063], doc).confirmed).toBe(0)
  })

  it('counts a retired wire as decided, so a tombstone does not sit in the queue forever', () => {
    // Retiring is Phase E's to unlock and the generator drops a retired wire from the netlist, so
    // this is only reachable between the save and the re-run — but leaving it out would have put a
    // wire somebody deliberately removed in a list nobody could empty.
    const doc: WiringDocument = {
      ...emptyWiring(null),
      wires: { W063: { retired: 'duplicated W068' } },
    }
    expect(wiringPending(doc, W063)).toBe(false)
  })

  it('reads 0 confirmed on a freshly bootstrapped file, which is the honest number', () => {
    const doc = bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] })
    expect(sourceOf(doc, 'W063')).toBe('index')
    expect(wiringCoverage([W063], doc).confirmed).toBe(0)
  })
})

describe('correcting an endpoint', () => {
  it('keeps the pair it replaced', () => {
    const after = setEndpoint(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      'to',
      'TB-120:1',
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    expect(wireRecord(after, 'W063')?.to).toBe('TB-120:1')
    expect(wireRecord(after, 'W063')?.was).toEqual(['INFEED1:3', 'TB-120:2'])
    expect(corrected(after, 'W063')).toBe(true)
  })

  it('does not let a second thought overwrite the machine’s original answer', () => {
    // `was` is *what this record replaced*, not *what it held a moment ago*. A person who tries
    // `:1` and then `:3` must still be able to see that the index said `:2` — the `W` table it
    // came from is hand-maintained and a later edit there would destroy the original.
    let doc = bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] })
    doc = setEndpoint(doc, 'W063', 'to', 'TB-120:1', ['INFEED1:3', 'TB-120:2'], STAMP)
    doc = setEndpoint(doc, 'W063', 'to', 'TB-120:3', ['INFEED1:3', 'TB-120:2'], STAMP)
    expect(wireRecord(doc, 'W063')?.to).toBe('TB-120:3')
    expect(wireRecord(doc, 'W063')?.was).toEqual(['INFEED1:3', 'TB-120:2'])
  })

  it('stops being a correction when it is put back', () => {
    // Invariant 10 in a fourth file. A `was` left standing over the pair it no longer replaces
    // would have the file claiming a move that did not happen — and the confirmation is **kept**,
    // because looking is still a decision.
    let doc = bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] })
    doc = setEndpoint(doc, 'W063', 'to', 'TB-120:1', ['INFEED1:3', 'TB-120:2'], STAMP)
    doc = setEndpoint(doc, 'W063', 'to', 'TB-120:2', ['INFEED1:3', 'TB-120:2'], STAMP)
    expect(wireRecord(doc, 'W063')).not.toHaveProperty('was')
    expect(confirmed(doc, 'W063')).toBe(true)
    expect(corrected(doc, 'W063')).toBe(false)
  })

  it('leaves the other end exactly where it was', () => {
    const doc = setEndpoint(
      bootstrapped({ W019: ['PS1:-2', 'TB-0V:2'] }),
      'W019',
      'to',
      'TB-GND-B:2',
      ['PS1:-2', 'TB-0V:2'],
      STAMP,
    )
    expect(endpointsOf(doc, wire('W019', 'PS1:-2', 'TB-0V:2'))).toEqual(['PS1:-2', 'TB-GND-B:2'])
  })

  it('can set an end to null, which is a wire somebody started', () => {
    const doc = setEndpoint(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      'to',
      null,
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    expect(confirmed(doc, 'W063')).toBe(true)
    expect(settled(doc, W063)).toBe(false)
  })
})

describe('taking a confirmation back', () => {
  it('goes to `index` with the endpoints `was` was holding', () => {
    let doc = bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] })
    doc = setEndpoint(doc, 'W063', 'to', 'TB-120:1', ['INFEED1:3', 'TB-120:2'], STAMP)
    doc = unconfirm(doc, 'W063', ['INFEED1:3', 'TB-120:2'])

    expect(wireRecord(doc, 'W063')).toEqual({
      from: 'INFEED1:3',
      to: 'TB-120:2',
      source: 'index',
    })
    expect(confirmed(doc, 'W063')).toBe(false)
  })

  it('leaves the record in place rather than deleting it', () => {
    // The bootstrap wrote a record for all 71, and a vanished one would read in `git diff` as
    // somebody having removed a wire — a different and much louder claim than *nobody has checked
    // this yet*.
    let doc = confirmEndpoints(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    doc = unconfirm(doc, 'W063', ['INFEED1:3', 'TB-120:2'])
    expect(Object.keys(doc.wires ?? {})).toEqual(['W063'])
  })
})

describe('the note', () => {
  it('will not ride on a record nobody has decided about', () => {
    // A note needs a decision under it, and inventing the decision to hang it on would record
    // that a person checked something they did not. The same rule the Review tab's box follows.
    const doc = bootstrapped({ W019: ['PS1:-2', 'TB-0V:2'] })
    expect(setWiringNote(doc, 'W019', 'a 0V-to-ground bond')).toBe(doc)
  })

  it('is written beside a confirmation and deleted when it is emptied', () => {
    let doc = confirmEndpoints(
      bootstrapped({ W019: ['PS1:-2', 'TB-0V:2'] }),
      'W019',
      ['PS1:-2', 'TB-GND-B:2'],
      STAMP,
    )
    doc = setWiringNote(doc, 'W019', '  a 0V-to-ground bond  ')
    expect(wireRecord(doc, 'W019')?.note).toBe('a 0V-to-ground bond')
    doc = setWiringNote(doc, 'W019', '   ')
    expect(wireRecord(doc, 'W019')).not.toHaveProperty('note')
  })
})

describe('where the endpoints come from', () => {
  it('prefers the draft over the netlist, because the netlist has not seen the last click', () => {
    const doc = setEndpoint(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      'to',
      'TB-120:1',
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    // `W063`'s published `terminals` still say `:2` — `circuit_logic.json` does not move until
    // somebody re-runs the generator, which is the whole reason the save banner exists.
    expect(endpointsOf(doc, W063)).toEqual(['INFEED1:3', 'TB-120:1'])
  })

  it('falls back to the netlist for a wire with no record at all', () => {
    expect(endpointsOf(emptyWiring('PS20115MLM4-2'), W063)).toEqual(['INFEED1:3', 'TB-120:2'])
    expect(sourceOf(emptyWiring(null), 'W063')).toBe('index')
  })

  it('reports a retired wire as joining nothing', () => {
    const doc: WiringDocument = {
      ...emptyWiring(null),
      wires: { W063: { retired: 'duplicated W068' } },
    }
    expect(endpointsOf(doc, W063)).toEqual(['INFEED1:3', 'TB-120:2'])
    expect(confirmed(doc, 'W063')).toBe(false)
  })
})

describe('the two ends’ nets', () => {
  const NETS = terminalNets([
    net('0V', ['PS1:-2', 'TB-0V:2']),
    net('GND', ['TB-GND-B:2', 'PS1:GND']),
  ])

  it('is a reverse pass over the index and needs no endpoint', () => {
    expect(NETS['PS1:-2']).toBe('0V')
    expect(NETS['TB-GND-B:2']).toBe('GND')
  })

  it('flags W019’s two nets and does not pick one', () => {
    // Corrected, `W019` is a 0 V-to-ground **bond**: `0V` at one end and `GND` at the other, and
    // that is the finding rather than an error. A screen that quietly chose one would hide the
    // only interesting thing about the wire — which is exactly what storing a wire's net did.
    const across = netsAcross(['PS1:-2', 'TB-GND-B:2'], NETS)
    expect(across).toEqual({ from: '0V', to: 'GND', differ: true })
  })

  it('says nothing about an end nobody has set', () => {
    expect(netsAcross(['PS1:-2', null], NETS)).toEqual({ from: '0V', to: null, differ: false })
    expect(netsAcross([null, null], NETS).differ).toBe(false)
  })
})

describe('`path may be stale`', () => {
  function withPath(forPair: string[] | undefined): LocationsDocument {
    return {
      drawing_number: 'PS20115MLM4-2',
      schema: 2,
      page_size_pt: [1224, 792],
      components: {},
      terminals: {},
      wires: {
        W063: {
          path: {
            runs: [
              [
                [562.9, 563.4],
                [301.9, 563.4],
              ],
            ],
            geometry: 'extracted',
            attribution: 'human',
            ...(forPair ? { for: forPair } : {}),
          },
        },
      },
    }
  }

  it('fires when the correction moved the end the route reaches', () => {
    const wiring = setEndpoint(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      'to',
      'TB-120:1',
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    expect(pathStale(withPath(['INFEED1:3', 'TB-120:2']), wiring, W063)).toBe(true)
  })

  it('stays quiet when nothing moved', () => {
    const wiring = confirmEndpoints(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    expect(pathStale(withPath(['INFEED1:3', 'TB-120:2']), wiring, W063)).toBe(false)
  })

  it('is unordered, because a route is not directed', () => {
    // A wire whose `from` and `to` were swapped has not moved either of its ends, and its route
    // still reaches both. Comparing the pairs in order would have flagged 71 wires the day
    // somebody normalised the netlist's endpoint order.
    const wiring = bootstrapped({ W063: ['TB-120:2', 'INFEED1:3'] })
    expect(pathStale(withPath(['INFEED1:3', 'TB-120:2']), wiring, W063)).toBe(false)
  })

  it('says nothing about a path with no stamp, rather than inventing doubt', () => {
    // All 58 existing paths were back-filled, so an absent `for` today is a hand edit — and
    // casting doubt on a route a person authored by hand is worse than saying nothing.
    const wiring = setEndpoint(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      'to',
      'TB-120:1',
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    expect(pathStale(withPath(undefined), wiring, W063)).toBe(false)
  })

  it('says nothing about a wire with no path, or about a net', () => {
    const wiring = bootstrapped({ W063: ['INFEED1:3', 'TB-120:1'] })
    const bare = { ...withPath(['INFEED1:3', 'TB-120:2']), wires: {} }
    expect(pathStale(bare, wiring, W063)).toBe(false)
    expect(pathStale(withPath(['a', 'b']), wiring, net('0V', []))).toBe(false)
  })

  it('says nothing while an end is unset, because half a pair is not a disagreement', () => {
    const wiring = setEndpoint(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      'to',
      null,
      ['INFEED1:3', 'TB-120:2'],
      STAMP,
    )
    expect(pathStale(withPath(['INFEED1:3', 'TB-120:2']), wiring, W063)).toBe(false)
  })
})

// -- Phase E: a wire a person adds, and a wire a person takes away ----------------------------

describe('adding a wire', () => {
  it('takes the next id nothing has ever used, and counts past a tombstone', () => {
    // The point of the whole section. 58 authored paths key on `W###`, so an id handed back would
    // silently reattach one of them to a different wire — and nothing on screen would differ.
    const netlist = [wire('W070', 'A:1', 'B:1'), wire('W071', 'A:2', 'B:2')]
    const empty = emptyWiring('PS20115MLM4-2')

    expect(nextWireId(netlist.map((w) => w.id), empty)).toBe('W072')

    const one = addWire(empty, 'W072', STAMP)
    expect(nextWireId(netlist.map((w) => w.id), one)).toBe('W073')

    const gone = retireWire(one, 'W072', 'added by mistake', STAMP)
    expect(nextWireId(netlist.map((w) => w.id), gone)).toBe('W073')
  })

  it('starts with two empty ends, `added`, and a person’s name on it', () => {
    const after = addWire(emptyWiring('PS20115MLM4-2'), 'W072', STAMP)
    expect(wireRecord(after, 'W072')).toEqual({
      from: null,
      to: null,
      source: 'human',
      added: true,
      by: 'js',
      at: STAMP.at,
    })
    // `human` from the first instant, because `index` would say the indexing pass answered for a
    // wire it never saw. That does not make it *decided*: both ends are still nobody's.
    expect(confirmed(after, 'W072')).toBe(true)
    expect(added(after, 'W072')).toBe(true)
    expect(wiringDecided(after, wire('W072', '', ''))).toBe(false)
  })

  it('never overwrites a record that already exists, tombstones included', () => {
    const gone = retireWire(addWire(emptyWiring(null), 'W072', STAMP), 'W072', 'oops', STAMP)
    expect(addWire(gone, 'W072', STAMP)).toBe(gone)
  })

  it('stamps no `was` on its first two clicks, because it replaced nothing', () => {
    // Without the guard the first endpoint would write `was: [null, null]`, and the panel would
    // show a `corrected` badge over an answer nobody ever gave.
    const one = setEndpoint(
      addWire(emptyWiring(null), 'W072', STAMP),
      'W072',
      'from',
      'PS1:-1',
      [null, null],
      STAMP,
    )
    const both = setEndpoint(one, 'W072', 'to', 'TB-0V:1', [null, null], STAMP)
    expect(wireRecord(both, 'W072')?.was).toBeUndefined()
    expect(corrected(both, 'W072')).toBe(false)
    expect(wiringDecided(both, wire('W072', 'PS1:-1', 'TB-0V:1'))).toBe(true)
  })

  it('refuses to be unconfirmed, because `index` never said anything about it', () => {
    const one = addWire(emptyWiring(null), 'W072', STAMP)
    expect(unconfirm(one, 'W072', [null, null])).toBe(one)
  })
})

describe('retiring a wire', () => {
  it('writes a tombstone with the reason and no ends at all', () => {
    const before = bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] })
    const after = retireWire(before, 'W063', 'read twice; W014 is this run', STAMP)

    expect(wireRecord(after, 'W063')).toEqual({
      retired: 'read twice; W014 is this run',
      by: 'js',
      at: STAMP.at,
    })
    expect(retiredReason(after, 'W063')).toBe('read twice; W014 is this run')
    expect(confirmed(after, 'W063')).toBe(false)
  })

  it('will not do anything without a reason in words', () => {
    // A wire is rarely retired for being absent — it is retired for being a duplicate, and six
    // months later the reason is the whole of what a reader needs.
    const before = bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] })
    expect(retireWire(before, 'W063', '   ', STAMP)).toBe(before)
  })

  it('takes a wire out of the queue, so a tombstone is not something to work through', () => {
    const after = retireWire(
      bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }),
      'W063',
      'duplicate',
      STAMP,
    )
    expect(wiringPending(after, W063)).toBe(false)
  })

  it('comes back unconfirmed, with the netlist’s pair where there still is one', () => {
    const after = unretire(
      retireWire(bootstrapped({ W063: ['INFEED1:3', 'TB-120:2'] }), 'W063', 'duplicate', STAMP),
      'W063',
      ['INFEED1:3', 'TB-120:2'],
    )
    expect(wireRecord(after, 'W063')).toEqual({
      from: 'INFEED1:3',
      to: 'TB-120:2',
      source: 'index',
    })
    expect(wiringPending(after, W063)).toBe(true)
  })

  it('keeps `added` on the way out and on the way back, and stays a person’s wire', () => {
    const gone = retireWire(addWire(emptyWiring(null), 'W072', STAMP), 'W072', 'oops', STAMP)
    expect(wireRecord(gone, 'W072')?.added).toBe(true)

    const back = unretire(gone, 'W072', [null, null])
    expect(wireRecord(back, 'W072')).toEqual({ added: true, from: null, to: null, source: 'human' })
  })
})

describe('the wires that exist only in the draft', () => {
  const NETLIST = [wire('W070', 'A:1', 'B:1')]

  it('gives an added wire a row, so it is not a record with nowhere to be', () => {
    const one = addWire(emptyWiring('PS20115MLM4-2'), 'W071', STAMP)
    const rows = draftWireEntries(one, NETLIST)

    expect(rows.map((r) => r.id)).toEqual(['W071'])
    expect(rows[0].kind).toBe('wire')
    expect(rows[0].on_sheet).toBe(false)
    expect(rows[0].point).toBeNull()
  })

  it('frames itself on the ends it has, the way the server frames any wire', () => {
    // So the row does not read `nowhere` next to seventy that read `computed`, and so selecting
    // it takes the sheet somewhere. A wire's geometry is its terminals' and nothing else — the
    // placement is **carried** from the pin rather than asserted, because a terminal drawn on its
    // parent's dot is a coordinate nobody chose.
    const pin: Designator = {
      id: 'PS1:-1',
      kind: 'terminal',
      label: 'PS1:-1',
      on_sheet: true,
      members: [],
      point: [10, 20],
      rect: null,
      placement: 'parent',
    }
    const one = setEndpoint(
      addWire(emptyWiring(null), 'W071', STAMP),
      'W071',
      'from',
      'PS1:-1',
      [null, null],
      STAMP,
    )
    const [row] = draftWireEntries(one, [...NETLIST, pin])
    expect(row.point).toEqual([10, 20])
    expect(row.rect).toEqual([10, 20, 10, 20])
    expect(row.terminals?.[0].placement).toBe('parent')
  })

  it('carries the ends it has, so the panel and the count read the same wire', () => {
    const one = setEndpoint(
      addWire(emptyWiring(null), 'W071', STAMP),
      'W071',
      'from',
      'PS1:-1',
      [null, null],
      STAMP,
    )
    const [row] = draftWireEntries(one, NETLIST)
    expect(row.terminals?.map((t) => t.id)).toEqual(['PS1:-1'])
    expect(row.members).toEqual(['PS1'])
    expect(endpointsOf(one, row)).toEqual(['PS1:-1', null])
  })

  it('says nothing about a wire the netlist already has, however it got there', () => {
    // After the generator runs, `W070` is published like any other wire and the draft must stop
    // inventing a second row for it — two rows with one id is the one thing a list cannot survive.
    const both = addWire(emptyWiring(null), 'W070', STAMP)
    expect(draftWireEntries(both, NETLIST)).toEqual([])
  })

  it('says nothing about a record that does not claim to be added', () => {
    // Which is what keeps a typo out of the list: an unknown id with no marker is refused by the
    // server and by the generator, and it must not get a row here either.
    const typo = bootstrapped({ W999: ['A:1', 'B:1'] })
    expect(draftWireEntries(typo, NETLIST)).toEqual([])
  })

  it('still lists one that was added and then retired, with the reason on the row', () => {
    const gone = retireWire(addWire(emptyWiring(null), 'W071', STAMP), 'W071', 'oops', STAMP)
    const [row] = draftWireEntries(gone, NETLIST)
    expect(row.label).toContain('oops')
    expect(row.terminals).toEqual([])
    // Decided about — somebody said it does not exist — so it does not sit in a queue nobody can
    // empty. Its id is still spent, which is what `nextWireId` reads.
    expect(wiringPending(gone, row)).toBe(false)
  })

  it('adds to the total the queue counts up to', () => {
    const one = addWire(emptyWiring(null), 'W071', STAMP)
    const listed = [...NETLIST, ...draftWireEntries(one, NETLIST)]
    expect(wiringCoverage(NETLIST, one).wires).toBe(1)
    expect(wiringCoverage(listed, one).wires).toBe(2)
    expect(wiringCoverage(listed, one).confirmed).toBe(0)
  })
})
