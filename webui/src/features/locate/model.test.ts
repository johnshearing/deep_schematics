/**
 * The editor's arithmetic, which is where a wrong dot would come from.
 *
 * These are the failures that are silent in a browser and permanent in a file: a pin assigned to
 * two sites, an "advance" that skips work, a point written under the wrong id, a component left
 * in the document with no sites. Every one of them looks like a working editor at the time.
 */

import { describe, expect, it } from 'vitest'

import type { Designator, LocationsDocument } from '@/api/types'
import {
  clear,
  coverage,
  assignTerminal,
  canRenameSite,
  draftPlacement,
  draftPoint,
  editorPlaces,
  emptyDocument,
  endLabelsOf,
  nextSiteId,
  nextUnplaced,
  place,
  renameSite,
  rowState,
  setEndLabel,
  setLabelDir,
  siteClaiming,
} from './model'

const STAMP = { by: 'js', at: '2026-08-16T12:00:00Z' }

function entry(id: string, kind: Designator['kind'], extra: Partial<Designator> = {}): Designator {
  return {
    id,
    kind,
    label: `${kind} ${id}`,
    on_sheet: true,
    members: [id.split(':')[0]],
    point: null,
    rect: null,
    ...extra,
  }
}

const CR_BP = entry('CR-BP', 'component', { point: [861, 679], placement: 'seed' })
const A1 = entry('CR-BP:A1', 'terminal', { point: [861, 679], placement: 'parent' })
const PIN_11 = entry('CR-BP:11', 'terminal', { point: [861, 679], placement: 'parent' })
const WIRE = entry('W047', 'wire', { point: [500, 400] })

function fresh(): LocationsDocument {
  return emptyDocument('PS20115MLM4-2', [1224, 792])
}

describe('placing', () => {
  it('creates a site on the first click and moves it on the second', () => {
    let doc = place(fresh(), { id: 'CR-BP', site: 'coil' }, [861.04, 679.44], STAMP)
    expect(doc.components['CR-BP'].sites).toEqual([
      { id: 'coil', terminals: [], point: [861, 679.4], source: 'human', by: 'js', at: STAMP.at },
    ])

    doc = place(doc, { id: 'CR-BP', site: 'coil' }, [860, 680], STAMP)
    expect(doc.components['CR-BP'].sites).toHaveLength(1)
    expect(doc.components['CR-BP'].sites[0].point).toEqual([860, 680])
  })

  it('rounds to a tenth of a point, because the sheet has nothing finer on it', () => {
    // Conductor rows are 16 pt apart and the lettering is 4 pt tall, so a tenth is already
    // beyond anything on the drawing — and it keeps a hand-editable file free of
    // 348.30000000000007.
    const doc = place(fresh(), { id: 'CR-BP', site: 'coil' }, [154.4999, 348.30000000000007], STAMP)
    expect(doc.components['CR-BP'].sites[0].point).toEqual([154.5, 348.3])
  })

  it('gives a terminal its own point, which beats the site that claims it', () => {
    let doc = place(fresh(), { id: 'CR-BP', site: 'coil' }, [861, 679], STAMP)
    doc = assignTerminal(doc, 'CR-BP', 'coil', 'A1', true)
    expect(editorPlaces(doc, A1)[0]).toMatchObject({ point: [861, 679], site: 'coil' })

    doc = place(doc, { id: 'CR-BP:A1', site: null }, [870, 668], STAMP)
    expect(editorPlaces(doc, A1)[0]).toMatchObject({ point: [870, 668] })
    expect(editorPlaces(doc, A1)[0].site).toBeUndefined()
  })

  it('leaves a component out of the file entirely once its last site is gone', () => {
    // Otherwise an untouched drawing's locations.json fills up with `{sites: []}` for everything
    // anyone ever clicked, and the file stops being readable by a person.
    let doc = place(fresh(), { id: 'CR-BP', site: 'coil' }, [861, 679], STAMP)
    doc = clear(doc, { id: 'CR-BP', site: 'coil' })
    expect(doc.components).toEqual({})
  })
})

describe('sites', () => {
  it('names a second and third site without colliding', () => {
    let doc = fresh()
    expect(nextSiteId(doc, 'CR-BP')).toBe('main')
    doc = place(doc, { id: 'CR-BP', site: 'main' }, [861, 679], STAMP)
    expect(nextSiteId(doc, 'CR-BP')).toBe('site-2')
    doc = place(doc, { id: 'CR-BP', site: 'site-2' }, [714, 520], STAMP)
    expect(nextSiteId(doc, 'CR-BP')).toBe('site-3')
  })

  it('publishes one place per site, which is what CR-BP needs', () => {
    // Drawn three times on this sheet: coil, the 11/12 NC contact, the 21/24 NO contact. One
    // point per component cannot say that, and picking one silently puts the marker on a
    // circuit the reader is not looking at.
    let doc = fresh()
    doc = place(doc, { id: 'CR-BP', site: 'coil' }, [861, 679], STAMP)
    doc = place(doc, { id: 'CR-BP', site: 'nc' }, [714, 520], STAMP)
    doc = place(doc, { id: 'CR-BP', site: 'no' }, [592, 223], STAMP)
    expect(editorPlaces(doc, CR_BP).map((p) => p.site)).toEqual(['coil', 'nc', 'no'])
  })

  it('assigns a pin to exactly one site, moving it rather than duplicating it', () => {
    // `CR-BP` has two terminals whose function is `common` — 11 and 21 — in different circuits,
    // so nothing can infer this and a pin claimed twice is a human error the server reports.
    let doc = fresh()
    doc = place(doc, { id: 'CR-BP', site: 'nc' }, [714, 520], STAMP)
    doc = place(doc, { id: 'CR-BP', site: 'no' }, [592, 223], STAMP)
    doc = assignTerminal(doc, 'CR-BP', 'nc', '11', true)
    expect(siteClaiming(doc, 'CR-BP', '11')?.id).toBe('nc')

    doc = assignTerminal(doc, 'CR-BP', 'no', '11', true)
    expect(siteClaiming(doc, 'CR-BP', '11')?.id).toBe('no')
    expect(doc.components['CR-BP'].sites.flatMap((s) => s.terminals)).toEqual(['11'])

    doc = assignTerminal(doc, 'CR-BP', 'no', '11', false)
    expect(siteClaiming(doc, 'CR-BP', '11')).toBeNull()
  })

  it('refuses a rename that would collide, rather than merging two sites', () => {
    let doc = fresh()
    doc = place(doc, { id: 'CR-BP', site: 'coil' }, [861, 679], STAMP)
    doc = place(doc, { id: 'CR-BP', site: 'nc' }, [714, 520], STAMP)
    expect(renameSite(doc, 'CR-BP', 'nc', 'coil')).toBe(doc)
    expect(renameSite(doc, 'CR-BP', 'nc', '  ')).toBe(doc)
    expect(renameSite(doc, 'CR-BP', 'nc', 'no').components['CR-BP'].sites[1].id).toBe('no')

    // The same rule, asked in advance, so the box can say *why* rather than reverting in silence.
    // Its own name is allowed: that is a rename that changes nothing, not a collision.
    expect(canRenameSite(doc, 'CR-BP', 'nc', 'coil')).toBe(false)
    expect(canRenameSite(doc, 'CR-BP', 'nc', '  ')).toBe(false)
    expect(canRenameSite(doc, 'CR-BP', 'nc', 'nc')).toBe(true)
    expect(canRenameSite(doc, 'CR-BP', 'nc', ' no ')).toBe(true)
  })

  it('carries a label side, and takes it off again', () => {
    let doc = place(fresh(), { id: 'CR-BP', site: 'coil' }, [861, 679], STAMP)
    doc = setLabelDir(doc, { id: 'CR-BP', site: 'coil' }, 'nw')
    expect(editorPlaces(doc, CR_BP)[0].label_dir).toBe('nw')
    doc = setLabelDir(doc, { id: 'CR-BP', site: 'coil' }, null)
    expect(editorPlaces(doc, CR_BP)[0].label_dir).toBeUndefined()
  })
})

describe('what a row shows', () => {
  it('falls back to the server until the draft has something to say', () => {
    const doc = fresh()
    expect(draftPlacement(doc, CR_BP)).toBeNull()
    // The estimate and the borrowed parent point, both admitted as such.
    expect(rowState(doc, CR_BP)).toBe('seed')
    expect(rowState(doc, A1)).toBe('parent')
  })

  it('calls a wire computed until its printed name is placed, and never unplaced', () => {
    // A wire's ends are its two endpoint terminals, so there is nothing about its position for a
    // person to place. Its printed name is a different matter, and is optional.
    expect(rowState(fresh(), WIRE)).toBe('computed')

    const doc = place(fresh(), { id: 'W047', site: null, label: true }, [742, 511], STAMP, 'wire')
    expect(rowState(doc, WIRE)).toBe('labelled')
    expect(coverage([CR_BP, A1, WIRE], doc).remaining).toBe(2)
  })

  it('counts no label as outstanding, because none of them is work', () => {
    // The header used to read "0 of 97 wire and net labels", which is a progress bar over
    // something optional — the shape of K7, the filter that can never reach zero. Every wire end
    // and net terminal has a label already, at a side computed from points somebody placed; the
    // only authored number is how many of those a person overruled.
    expect(coverage([CR_BP, A1, WIRE], fresh())).toEqual({
      placeable: 2,
      confirmed: 0,
      remaining: 2,
      wires: 1,
      nets: 0,
      authored: 0,
    })

    const doc = setEndLabel(fresh(), 'W047', 'wire', 'CR-BP:A1', { dir: 'ne' })
    expect(coverage([CR_BP, A1, WIRE], doc).authored).toBe(1)
    // …and a placed printed name is still not counted anywhere.
    const named = place(doc, { id: 'W047', site: null, label: true }, [742, 511], STAMP, 'wire')
    expect(coverage([CR_BP, A1, WIRE], named).authored).toBe(1)
  })

  it('counts a pin as placed once the site holding it is placed', () => {
    let doc = place(fresh(), { id: 'CR-BP', site: 'coil' }, [861, 679], STAMP)
    doc = assignTerminal(doc, 'CR-BP', 'coil', 'A1', true)
    expect(rowState(doc, A1)).toBe('confirmed')
    // …and only that pin. `11` is drawn on a different contact and is still to do.
    expect(rowState(doc, PIN_11)).toBe('parent')
    expect(coverage([CR_BP, A1, PIN_11], doc).remaining).toBe(1)
  })
})

describe('wire and net labels', () => {
  const NET: Designator = entry('110', 'net', { point: [200, 200] })

  it('stores a label position, and nothing that could be read as a route', () => {
    const doc = place(fresh(), { id: 'W047', site: null, label: true }, [742.04, 511], STAMP, 'wire')
    expect(doc.wires).toEqual({
      W047: { label_point: [742, 511], source: 'human', by: 'js', at: STAMP.at },
    })
    // The key is `label_point`, never `point`: a wire has no point, and naming it one would
    // invite the next reader to treat it as where the wire is.
    expect(doc.wires!.W047).not.toHaveProperty('point')
    expect(doc.components).toEqual({})
    expect(doc.terminals).toEqual({})
  })

  it('puts a net in `nets` and a wire in `wires`, because a person reads this file', () => {
    let doc = place(fresh(), { id: 'W047', site: null, label: true }, [742, 511], STAMP, 'wire')
    doc = place(doc, { id: '110', site: null, label: true }, [180, 300], STAMP, 'net')
    expect(Object.keys(doc.wires!)).toEqual(['W047'])
    expect(Object.keys(doc.nets!)).toEqual(['110'])
    expect(editorPlaces(doc, NET)[0].point).toEqual([180, 300])
  })

  it('draws one dot for the name, and none at all before it is placed', () => {
    // Never the midpoint of the run: a dot at a wire's centroid sits on blank paper and claims
    // to be the wire, which is the whole reason `label_point` is a separate field.
    expect(editorPlaces(fresh(), WIRE)).toEqual([])
    const doc = place(fresh(), { id: 'W047', site: null, label: true }, [742, 511], STAMP, 'wire')
    expect(editorPlaces(doc, WIRE)).toEqual([
      { point: [742, 511], placement: 'confirmed', label_dir: undefined },
    ])
  })

  it('carries a label side, and takes the whole label away again', () => {
    const target = { id: 'W047', site: null, label: true }
    let doc = place(fresh(), target, [742, 511], STAMP, 'wire')
    doc = setLabelDir(doc, target, 'sw')
    expect(editorPlaces(doc, WIRE)[0].label_dir).toBe('sw')
    doc = clear(doc, target)
    expect(doc.wires).toEqual({})
    expect(rowState(doc, WIRE)).toBe('computed')
  })

  describe('end labels', () => {
    it('stores only the exceptions, keyed by the terminal they hang off', () => {
      const doc = setEndLabel(fresh(), 'W047', 'wire', 'CR-BP:A1', { dir: 'ne' })
      expect(doc.wires).toEqual({ W047: { labels: { 'CR-BP:A1': { dir: 'ne' } } } })
      // The wire's *other* end is not in the file, and that is not a gap: it is at the side the
      // rule computes, which is the state of nearly all 269 of them.
      expect(Object.keys(endLabelsOf(doc, 'W047'))).toEqual(['CR-BP:A1'])
    })

    it('deletes the override rather than writing the default back in', () => {
      // The rule this whole file rests on: a default written in as though a human chose it makes
      // the file stop telling you what anybody actually decided.
      let doc = setEndLabel(fresh(), 'W047', 'wire', 'CR-BP:A1', { dir: 'ne' })
      doc = setEndLabel(doc, 'W047', 'wire', 'CR-BP:A1', null)
      expect(doc.wires).toEqual({})

      // And `hidden: false` is the same mistake wearing a different hat, so it is stripped.
      doc = setEndLabel(fresh(), 'W047', 'wire', 'CR-BP:A1', { hidden: false })
      expect(doc.wires).toEqual({})
    })

    it('keeps the printed name and the end labels apart in the same record', () => {
      let doc = place(fresh(), { id: 'W047', site: null, label: true }, [742, 511], STAMP, 'wire')
      doc = setEndLabel(doc, 'W047', 'wire', 'CR-BP:A1', { hidden: true })
      expect(doc.wires!.W047).toMatchObject({
        label_point: [742, 511],
        labels: { 'CR-BP:A1': { hidden: true } },
      })

      // *Remove the label point* takes the point and leaves the decisions: they answer a
      // different question, and taking them away as a side effect would silently undo work.
      doc = clear(doc, { id: 'W047', site: null, label: true })
      expect(doc.wires).toEqual({ W047: { labels: { 'CR-BP:A1': { hidden: true } } } })
    })

    /**
     * **Session 5's scaffolding, guarded.** Until the path editor exists (Session 6) the only way
     * to author a `path` is to hand-edit the file with the server stopped, and the very next thing
     * a person does after pasting one is open the editor and work on that same wire. Every
     * mutation here spreads the record it found, so an unknown key survives — but "it happens to
     * work" and "a test says so" are different states for something whose failure would silently
     * delete a run somebody traced by hand.
     */
    it('leaves a hand-edited path alone while the same wire’s labels change', () => {
      const path = {
        runs: [
          [
            [379.8, 663.7],
            [301.8, 663.7],
          ],
        ] as [number, number][][],
        geometry: 'extracted' as const,
        attribution: 'human' as const,
        conductors: ['C0080'],
      }
      const start = { ...fresh(), wires: { W047: { path } } }

      let doc = setEndLabel(start, 'W047', 'wire', 'CR-BP:A1', { dir: 'ne' })
      expect(doc.wires!.W047.path).toBe(path)

      doc = place(doc, { id: 'W047', site: null, label: true }, [742, 511], STAMP, 'wire')
      expect(doc.wires!.W047.path).toBe(path)

      // Even *Remove the label point*, which deletes by name for exactly this reason.
      doc = clear(doc, { id: 'W047', site: null, label: true })
      expect(doc.wires).toEqual({ W047: { path, labels: { 'CR-BP:A1': { dir: 'ne' } } } })
    })

    it('puts a net’s in `nets`, because a person reads this file', () => {
      const doc = setEndLabel(fresh(), '110', 'net', 'CR-BP:A1', { dir: 's' })
      expect(doc.nets).toEqual({ 110: { labels: { 'CR-BP:A1': { dir: 's' } } } })
      expect(doc.wires).toEqual({})
    })
  })

  it('leaves a wire out of the coverage a run has to finish', () => {
    // Placing a label must not advance the run or move the "to do" number: it is a nicety on
    // work that is already complete, and the two obligations are not the same.
    const doc = place(fresh(), { id: 'W047', site: null, label: true }, [742, 511], STAMP, 'wire')
    expect(nextUnplaced([CR_BP, A1, WIRE], doc, null)?.id).toBe('CR-BP')
    expect(coverage([CR_BP, A1, WIRE], doc).remaining).toBe(2)
  })
})

describe('the advance', () => {
  const LIST = [CR_BP, A1, PIN_11, WIRE]

  it('walks forward through what is left, skipping nets and wires', () => {
    const doc = fresh()
    expect(nextUnplaced(LIST, doc, null)?.id).toBe('CR-BP')
    expect(nextUnplaced(LIST, doc, 'CR-BP')?.id).toBe('CR-BP:A1')
    expect(nextUnplaced(LIST, doc, 'CR-BP:A1')?.id).toBe('CR-BP:11')
  })

  it('wraps rather than stopping, so nothing skipped is left to be hunted for', () => {
    const doc = place(fresh(), { id: 'CR-BP', site: 'coil' }, [861, 679], STAMP)
    // Past the end of the list, and CR-BP is done, so the first thing still outstanding.
    expect(nextUnplaced(LIST, doc, 'W047')?.id).toBe('CR-BP:A1')
  })

  it('stops when there is nothing left', () => {
    let doc = place(fresh(), { id: 'CR-BP', site: 'coil' }, [861, 679], STAMP)
    doc = place(doc, { id: 'CR-BP:A1', site: null }, [870, 668], STAMP)
    doc = place(doc, { id: 'CR-BP:11', site: null }, [714, 520], STAMP)
    expect(nextUnplaced(LIST, doc, null)).toBeNull()
  })
})

describe('draftPoint', () => {
  it('answers only for a point the draft itself holds', () => {
    // The rule the keyboard nudge rests on. `editorPlaces` would happily hand back `CR-BP`'s
    // own point for its unplaced pin `A1`, flagged `parent` — and nudging that would turn "we
    // guessed A1 is at the coil" into "a human confirmed A1 is 1 pt from the coil", which is a
    // lie of exactly the kind this file exists to prevent. So a nudge moves what a person put
    // somewhere, and placing something for the first time stays a click.
    const doc = place(fresh(), { id: 'CR-BP', site: 'coil' }, [861, 679], STAMP)

    expect(draftPoint(doc, { id: 'CR-BP', site: 'coil' })).toEqual([861, 679])
    // The site exists but this is not it.
    expect(draftPoint(doc, { id: 'CR-BP', site: 'no' })).toBeNull()
    // Resolvable on screen — it is drawn on the coil — and still not the draft's own point.
    expect(editorPlaces(doc, A1)).toHaveLength(1)
    expect(draftPoint(doc, { id: 'CR-BP:A1', site: null })).toBeNull()
  })

  it('answers for a terminal and for a wire label, and rounds as the file does', () => {
    let doc = place(fresh(), { id: 'CR-BP:A1', site: null }, [860.55, 668.44], STAMP)
    expect(draftPoint(doc, { id: 'CR-BP:A1', site: null })).toEqual([860.6, 668.4])

    doc = place(doc, { id: 'W047', site: null, label: true }, [500.1, 400.2], STAMP, 'wire')
    expect(draftPoint(doc, { id: 'W047', site: null, label: true })).toEqual([500.1, 400.2])
    expect(draftPoint(doc, { id: 'W048', site: null, label: true })).toBeNull()
  })
})
