/**
 * The allowlist, and the two ways it can quietly resolve to the wrong thing.
 *
 * A citation that goes nowhere is a disappointment. A citation that flies the reader to the
 * *wrong* component is worse than not having the feature: it looks authoritative, and someone
 * is standing in front of a live panel acting on it. Both rules below exist for that reason,
 * and both are provoked by the real extraction rather than invented here.
 */

import { describe, expect, it } from 'vitest'

import type { Designator, DesignatorIndex } from '@/api/types'
import { buildLookup, normalise, placesOf, resolve, suggestedQuestion } from './designators'

function entry(id: string, extra: Partial<Designator> = {}): Designator {
  return {
    id,
    kind: 'component',
    label: `relay — ${id}`,
    on_sheet: true,
    members: [id],
    point: [10, 20],
    rect: [10, 20, 10, 20],
    ...extra,
  }
}

function index(entries: Designator[]): DesignatorIndex {
  return { drawing_number: 'PS20115MLM4-2', counts: {}, located: entries.length, entries }
}

describe('buildLookup', () => {
  it('matches an id whatever case the answer wrote it in', () => {
    const byToken = buildLookup(index([entry('CR-BP')]))
    expect(resolve(byToken, 'cr-bp')?.id).toBe('CR-BP')
    expect(resolve(byToken, ' CR-BP ')?.id).toBe('CR-BP')
  })

  it('lets an id beat an alias of a different component', () => {
    // Real: `MXCS-M9` is a component in its own right *and* an alias of another. The id has to
    // win, or a citation resolves to something the reader did not name.
    const byToken = buildLookup(
      index([entry('CR-SW', { aliases: ['MXCS-M9'] }), entry('MXCS-M9')]),
    )
    expect(resolve(byToken, 'MXCS-M9')?.id).toBe('MXCS-M9')
  })

  it('drops an alias two components both claim, rather than picking one', () => {
    // Real: "switch relay", "run bypass relay" and "24E-1 terminal" are each claimed twice.
    // Flying to whichever parsed first would be a confident wrong answer; plain text is not.
    const byToken = buildLookup(
      index([
        entry('CR-SW', { aliases: ['switch relay', 'the sw relay'] }),
        entry('CR2', { aliases: ['switch relay'] }),
      ]),
    )
    expect(resolve(byToken, 'switch relay')).toBeNull()
    expect(resolve(byToken, 'the sw relay')?.id).toBe('CR-SW')
  })

  it('keeps an alias a single component repeats', () => {
    const byToken = buildLookup(index([entry('CR-BP', { aliases: ['bypass relay', 'BYPASS relay'] })]))
    expect(resolve(byToken, 'bypass relay')?.id).toBe('CR-BP')
  })

  it('resolves nothing it was not given, whatever it looks like', () => {
    // The point of an allowlist: `W999` has the exact shape of a wire id and is not one.
    const byToken = buildLookup(index([entry('W047', { kind: 'wire' })]))
    expect(resolve(byToken, 'W999')).toBeNull()
    expect(resolve(byToken, 'circuit_logic.json')).toBeNull()
    expect(resolve(byToken, '')).toBeNull()
    expect(resolve(byToken, null)).toBeNull()
  })

  it('reads `net 110` as net 110, and only where the kind agrees', () => {
    // The most natural span a model writes, and until now the one that resolved to nothing: the
    // entry's id is `110` and nets carry no aliases. The kind word has to agree, so a mismatched
    // one cannot land the reader on something they did not name.
    const byToken = buildLookup(
      index([
        entry('110', { kind: 'net' }),
        entry('W048', { kind: 'wire' }),
        entry('CR-BP:A1', { kind: 'terminal' }),
      ]),
    )
    expect(resolve(byToken, 'net 110')?.id).toBe('110')
    expect(resolve(byToken, 'NET 110')?.id).toBe('110')
    expect(resolve(byToken, 'wire W048')?.id).toBe('W048')
    expect(resolve(byToken, 'terminal CR-BP:A1')?.id).toBe('CR-BP:A1')
    // Wrong kind, no destination — `110` is a net, not a wire and not a component.
    expect(resolve(byToken, 'wire 110')).toBeNull()
    expect(resolve(byToken, 'component 110')).toBeNull()
    // And nothing else earns the tolerance: it is one leading kind word, not prose stripping.
    expect(resolve(byToken, 'on net 110')).toBeNull()
    expect(resolve(byToken, 'net 110 and 120')).toBeNull()
    expect(resolve(byToken, 'W048 (blue)')).toBeNull()
  })

  it('lets an exact id beat the kind-word reading of the same span', () => {
    // A component actually named `NET 110` keeps its own span, whatever else is in the index.
    const byToken = buildLookup(index([entry('NET 110'), entry('110', { kind: 'net' })]))
    expect(resolve(byToken, 'net 110')?.id).toBe('NET 110')
  })

  it('survives an index that is missing or the wrong shape', () => {
    expect(buildLookup(null).size).toBe(0)
    expect(buildLookup({ entries: undefined } as unknown as DesignatorIndex).size).toBe(0)
  })
})

describe('normalise', () => {
  it('folds case and collapses internal space, and nothing else', () => {
    expect(normalise('  run   bypass relay ')).toBe('RUN BYPASS RELAY')
    // Not stripped: a citation is an exact token, and `CR-BP:A2` is not `CR-BP`.
    expect(normalise('CR-BP:A2')).toBe('CR-BP:A2')
  })
})

describe('placesOf', () => {
  it('hides the payload optimisation, so one place and three behave the same', () => {
    // `places` is omitted for the 269 of 275 entries drawn in a single spot, because duplicating
    // a coordinate into a second field costs bytes and says nothing. Every caller reading
    // `entry.places` directly would then have to remember that, and one of them would not.
    expect(placesOf(entry('CB1'))).toEqual([{ point: [10, 20], placement: 'seed' }])
    expect(placesOf(entry('CR-BP', { placement: 'confirmed' }))).toEqual([
      { point: [10, 20], placement: 'confirmed' },
    ])

    const relay = entry('CR-BP', {
      // Drawn three times on the real sheet: coil, the 11/12 NC contact, the 21/24 NO contact.
      places: [
        { point: [861, 679], placement: 'confirmed', site: 'coil' },
        { point: [714, 520], placement: 'confirmed', site: 'nc' },
        { point: [592, 223], placement: 'seed', site: 'no' },
      ],
    })
    expect(placesOf(relay).map((p) => p.site)).toEqual(['coil', 'nc', 'no'])
  })

  it('is empty for the six ids that are cited but never drawn', () => {
    // The two off-page machines and the four referenced drawings. Citable, not clickable, and
    // nothing may put a dot at the origin for them.
    expect(placesOf(entry('UPSTREAM-MACHINE', { point: null, rect: null }))).toEqual([])
  })
})

describe('suggestedQuestion', () => {
  it('asks something specific to the kind of thing that was clicked', () => {
    expect(suggestedQuestion(entry('CR-BP'))).toContain('CR-BP')
    expect(suggestedQuestion(entry('110', { kind: 'net' }))).toMatch(/wires and how many terminals/)
  })

  it('opens a component wide rather than asking one thing about it', () => {
    // Asked for 2026-08-19: at a marker the useful question is everything the extraction has,
    // and the narrower version this replaced ("what does it do, and what is connected to it")
    // got a narrower answer. Pinned because it is a product decision, not a wording accident.
    expect(suggestedQuestion(entry('CR-BP'))).toBe('Please tell me all you can about CR-BP')
  })
})
