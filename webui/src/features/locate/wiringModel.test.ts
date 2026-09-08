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
 */

import { describe, expect, it } from 'vitest'

import type { Designator, LocationsDocument, WiringDocument } from '@/api/types'
import {
  confirmEndpoints,
  confirmed,
  corrected,
  emptyWiring,
  endpointsOf,
  netsAcross,
  pathStale,
  setEndpoint,
  setWiringNote,
  settled,
  sourceOf,
  terminalNets,
  unconfirm,
  wireRecord,
  wiringCoverage,
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
