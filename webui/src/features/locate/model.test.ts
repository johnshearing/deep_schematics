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
  addRun,
  clear,
  clearPath,
  convertPath,
  coverage,
  assignTerminal,
  canRenameSite,
  draftPlacement,
  draftPoint,
  editorPlaces,
  emptyDocument,
  endLabelsOf,
  movePathVertex,
  nextSiteId,
  nextUnplaced,
  pathOf,
  pathSettled,
  place,
  renameSite,
  rowState,
  setEndLabel,
  setLabelDir,
  setNoPath,
  setPath,
  siteClaiming,
  tracePath,
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
    //
    // `settled` is the deliberate exception, added with Phase E: a wire **path** is real work, and
    // that count *can* be finished, because *there is nothing on this sheet to trace* is a
    // decision a person can take. K7's shape is a count with no way to reach its total, not a
    // count over something optional.
    expect(coverage([CR_BP, A1, WIRE], fresh())).toEqual({
      placeable: 2,
      confirmed: 0,
      remaining: 2,
      wires: 1,
      nets: 0,
      authored: 0,
      settled: 0,
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

// -- where a wire runs, Phase E -------------------------------------------------------------

/**
 * The route, and **what may never be written into the file.**
 *
 * These are the assertions the whole plan turns on. §3's amendment lets a wire carry a path in
 * exactly two ways — lifted from the PDF's own conductor strokes, or traced by a person along the
 * printed run — and forbids the third forever: a route **synthesised from its endpoints**. So what
 * is tested here is as much what is absent as what is present.
 */
describe('a wire’s path', () => {
  /** A hand trace of `W049`, which is one of the wires with no labelled candidate on the sheet. */
  const tracePathHelper = (corners: [number, number][]) =>
    tracePath(fresh(), 'W049', corners, STAMP)

  /** `C0109`, which is `W052`'s run: both of its pins are within 4 pt of these two ends. */
  const RUN: [number, number][] = [
    [232.6, 563.4],
    [298.2, 563.4],
  ]
  /** `C0092`, the unlabelled vertical piece that makes `W063` an L. */
  const SECOND: [number, number][] = [
    [300.1, 565.2],
    [300.1, 637.9],
  ]

  it('writes the runs it was lifted from and nothing that looks like a point', () => {
    /**
     * **The assertion §10 asks for by name.** A `point` on a wire would be a route synthesised
     * from a bounding box's centre, which is usually blank paper, and the netlist's authority
     * rests on never having invented one.
     */
    const doc = setPath(fresh(), 'W052', [RUN], ['C0109'], STAMP)
    const record = doc.wires!.W052
    expect(record.path).toEqual({
      runs: [RUN],
      geometry: 'extracted',
      attribution: 'human',
      conductors: ['C0109'],
      by: 'js',
      at: STAMP.at,
    })
    expect(record).not.toHaveProperty('point')
    expect(record).not.toHaveProperty('label_point')
    expect(JSON.stringify(doc)).not.toContain('"derived"')
  })

  it('says a **person** attributed it, even when the printed name is what proposed it', () => {
    /**
     * The two axes answer different questions: `geometry` is *where did this line come from* and
     * `attribution` is *who says it is this wire's*. The answer to the second is always the person
     * who clicked. `printed` is reserved for something nothing in this application does — accepting
     * a match with no human in the loop — and writing it here would make the file say a ranking had
     * been trusted, which is the one thing this editor exists not to do.
     */
    const doc = setPath(fresh(), 'W052', [RUN], ['C0109'], STAMP)
    expect(doc.wires!.W052.path!.attribution).toBe('human')
    expect(doc.wires!.W052.path!.geometry).toBe('extracted')
  })

  it('keeps the ink’s own coordinates rather than rounding them like a placed point', () => {
    // A placed point is a person's judgement and a tenth is finer than anything on the drawing. A
    // lifted polyline is a copy of the PDF's vector data, and rounding it would make the highlight
    // disagree with the stroke it is tracing for no gain at all.
    const exact: [number, number][] = [
      [232.62345, 563.4],
      [298.21, 563.4],
    ]
    expect(setPath(fresh(), 'W052', [exact], ['C0109'], STAMP).wires!.W052.path!.runs[0][0]).toEqual(
      [232.62345, 563.4],
    )
  })

  it('adds a second run for a crossover hop, and shows the gap rather than closing it', () => {
    /**
     * `runs` is a **list** because the gap is real: where a horizontal run crosses a vertical
     * trunk the drawing puts a hop arc meaning *no connection*, this sheet has 88 of them, and the
     * extractor splits a conductor at every one. Closing the gap would draw a join nobody drew.
     */
    let doc = setPath(fresh(), 'W063', [RUN], ['C0091'], STAMP)
    doc = addRun(doc, 'W063', SECOND, 'C0092', STAMP)
    const path = pathOf(doc, 'W063')!
    expect(path.runs).toEqual([RUN, SECOND])
    expect(path.conductors).toEqual(['C0091', 'C0092'])
    // Nothing joins them: two polylines, and no segment between the end of one and the start of
    // the next.
    expect(path.runs).toHaveLength(2)
  })

  it('will not add the same run twice', () => {
    let doc = setPath(fresh(), 'W063', [RUN], ['C0091'], STAMP)
    doc = addRun(doc, 'W063', RUN, 'C0091', STAMP)
    expect(pathOf(doc, 'W063')!.runs).toHaveLength(1)
  })

  it('starts a path when there is none, rather than needing one first', () => {
    const doc = addRun(fresh(), 'W063', RUN, 'C0091', STAMP)
    expect(pathOf(doc, 'W063')!.conductors).toEqual(['C0091'])
  })

  it('names no conductor on a hand trace, and that absence is the record', () => {
    // Offered *after* the proximity-ranked unlabelled runs, because 79 unlabelled conductors are
    // real ink and beat a hand trace every time. There was no run to lift, so there is nothing to
    // record — an empty list would say something different.
    const corners: [number, number][] = [
      [100, 100],
      [100, 140],
      [220.04, 140],
    ]
    const doc = tracePathHelper(corners)
    const path = pathOf(doc, 'W049')!
    expect(path.geometry).toBe('human')
    expect(path.attribution).toBe('human')
    expect(path).not.toHaveProperty('conductors')
    // A corner a person clicked **is** rounded, like every other coordinate a person chooses.
    expect(path.runs[0][2]).toEqual([220, 140])
  })

  it('refuses a hand trace of one corner, because one point is not a run', () => {
    expect(tracePathHelper([[100, 100]]).wires).toEqual({})
  })

  it('converts a lifted run to hand-drawn before it may be edited, and drops the conductor ids', () => {
    /**
     * **The price of moving a corner.** `geometry: extracted` is a claim about the polyline —
     * *these corners are the drawing's, not mine* — and dragging a vertex would leave that claim
     * standing over a line a person had altered. The conductor ids go with it: the run is no longer
     * the run it was lifted from.
     */
    const lifted = setPath(fresh(), 'W052', [RUN], ['C0109'], STAMP)
    expect(movePathVertex(lifted, 'W052', 0, 0, [240, 563.4], STAMP)).toBe(lifted)

    const editable = convertPath(lifted, 'W052', STAMP)
    expect(editable.wires!.W052.path!.geometry).toBe('human')
    expect(editable.wires!.W052.path).not.toHaveProperty('conductors')
    const moved = movePathVertex(editable, 'W052', 0, 0, [240.04, 563.44], STAMP)
    expect(moved.wires!.W052.path!.runs[0][0]).toEqual([240, 563.4])
    // The other corner is untouched, and so is the other run.
    expect(moved.wires!.W052.path!.runs[0][1]).toEqual(RUN[1])
  })

  it('converts nothing twice, and nothing that is not there', () => {
    const traced = tracePathHelper([[1, 1], [2, 2]])
    expect(convertPath(traced, 'W049', STAMP)).toBe(traced)
    const empty = fresh()
    expect(convertPath(empty, 'W052', STAMP)).toBe(empty)
  })

  it('leaves the end labels and the printed name alone when the route is cleared', () => {
    // The same rule `clear` follows for a label point: the other keys in the record are answers to
    // different questions, and taking them away as a side effect of *Clear* would silently undo
    // work nobody asked about.
    let doc = setEndLabel(fresh(), 'W052', 'wire', 'CR2:14', { dir: 'ne' })
    doc = place(doc, { id: 'W052', site: null, label: true }, [340, 655], STAMP, 'wire')
    doc = setPath(doc, 'W052', [RUN], ['C0109'], STAMP)
    const cleared = clearPath(doc, 'W052')
    expect(pathOf(cleared, 'W052')).toBeNull()
    expect(endLabelsOf(cleared, 'W052')).toEqual({ 'CR2:14': { dir: 'ne' } })
    expect(cleared.wires!.W052.label_point).toEqual([340, 655])
  })

  it('drops the wire from the file entirely when the route was all it had', () => {
    // What keeps `"wires": {}` empty on an untouched drawing rather than filling it with `{}` for
    // every wire anybody armed and changed their mind about.
    const doc = setPath(fresh(), 'W052', [RUN], ['C0109'], STAMP)
    expect(clearPath(doc, 'W052').wires).toEqual({})
  })

  it('never writes `no_path_on_this_sheet: false`, and deletes it instead', () => {
    /**
     * Invariant 10 in a fourth set of clothes, and the server refuses `false` by name from the
     * other side. A file that cannot tell *nobody has looked at this wire* from *somebody decided
     * there is nothing here* has stopped being a record of who said what.
     */
    const said = setNoPath(fresh(), 'W049', true)
    expect(said.wires!.W049).toEqual({ no_path_on_this_sheet: true })
    expect(JSON.stringify(setNoPath(said, 'W049', false))).not.toContain('no_path_on_this_sheet')
    expect(setNoPath(said, 'W049', false).wires).toEqual({})
  })

  it('will not hold a route and *there is no route here* at the same time', () => {
    // Two contradictory claims, so each retracts the other rather than the file holding both.
    const said = setNoPath(fresh(), 'W052', true)
    const routed = setPath(said, 'W052', [RUN], ['C0109'], STAMP)
    expect(routed.wires!.W052).not.toHaveProperty('no_path_on_this_sheet')
    expect(setNoPath(routed, 'W052', true).wires!.W052).not.toHaveProperty('path')
  })

  it('counts a wire as settled either way, which is what lets the count reach 71', () => {
    /**
     * The `K7` defence, and it is the reason the *no path on this sheet* state was designed in
     * rather than discovered. Some wires run to a connector whose other end is on another drawing:
     * a count of only the traced ones could never reach its own total, and a progress bar that
     * stops short for a reason nobody can act on is worse than no progress bar.
     */
    const wires = [entry('W052', 'wire'), entry('W049', 'wire')]
    expect(coverage(wires, fresh()).settled).toBe(0)
    const doc = setNoPath(setPath(fresh(), 'W052', [RUN], ['C0109'], STAMP), 'W049', true)
    expect(coverage(wires, doc).settled).toBe(2)
    expect(pathSettled(doc, 'W052')).toBe(true)
    expect(pathSettled(doc, 'W049')).toBe(true)
    expect(pathSettled(doc, 'W068')).toBe(false)
  })

  it('says on the row which of the two it is', () => {
    // Phase B promised this: the `computed` state read *"route from its terminals"* until §3's
    // amendment made that sentence false, and it was always going to report the path state once
    // there was one to report.
    const w052 = entry('W052', 'wire', { point: [500, 400] })
    expect(rowState(fresh(), w052)).toBe('computed')
    expect(rowState(setPath(fresh(), 'W052', [RUN], ['C0109'], STAMP), w052)).toBe('traced')
    expect(rowState(setNoPath(fresh(), 'W052', true), w052)).toBe('no-path')
  })

  it('leaves a hand-edited path alone while the same wire’s labels change', () => {
    // Session 5's scaffolding, still guarded: every mutation rewrites the record it found.
    let doc = setPath(fresh(), 'W052', [RUN], ['C0109'], STAMP)
    doc = setEndLabel(doc, 'W052', 'wire', 'CR2:14', { dir: 'ne' })
    expect(pathOf(doc, 'W052')!.conductors).toEqual(['C0109'])
  })
})
