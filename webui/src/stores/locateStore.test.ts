/**
 * The draft, and the undo stack over it.
 *
 * There was no test file for this store until undo arrived, and undo is exactly the reason to
 * write one: everything here is a way to **lose a coordinate a person placed by hand**, which is
 * the one failure this project cannot absorb. A component tree cannot assert against it — the
 * document is the deliverable, not the screen — so these tests read the draft itself.
 *
 * The faults each one prevents:
 *
 * - an undo that restores *nearly* the previous point, so a tenth of a point is silently lost;
 * - an undo that walks back where the user was looking as well as what they changed, which makes
 *   the key unpredictable and therefore unusable;
 * - a gesture that fires the mutation on every frame and fills a 50-deep stack with itself,
 *   pushing the thing you wanted back off the end;
 * - an undo that is not saved, and so is a lie after a reload;
 * - a stack that survives loading a *different* document, which would undo this file's points
 *   into that file's coordinates.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LocationsDocument, StoredSite } from '@/api/types'
import * as model from '@/features/locate/model'
import { useAppStore } from '@/stores/appStore'
import { useLocateStore } from '@/stores/locateStore'

/** Passed in rather than read from the clock, exactly as `model.ts` requires, so nothing here
 * races a timestamp. */
const STAMP = { by: 'js', at: '2026-08-24T09:00:00.000Z' }

const EMPTY: LocationsDocument = {
  drawing_number: 'PS20115MLM4-2',
  schema: 1,
  page_size_pt: [1224, 792],
  components: {},
  terminals: {},
  wires: {},
  nets: {},
}

const EMPTY_REPORT = {
  file: false,
  components: 0,
  sites: 0,
  confirmed_sites: 0,
  terminals: 0,
  confirmed_terminals: 0,
  labels: 0,
  confirmed_labels: 0,
  problems: [] as string[],
}

/** Every PUT the store made, so a test can look at the file it would have written. */
let saved: LocationsDocument[] = []

function json(body: unknown, status = 200) {
  return { ok: status < 400, status, statusText: '', json: async () => body } as unknown as Response
}

function stubServer(document: LocationsDocument | null = null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/locations') && init?.method === 'PUT') {
        saved.push(JSON.parse(String(init.body)).document)
        return json({ saved: true, report: EMPTY_REPORT, stale: 'circuit_logic.json is behind.' })
      }
      if (url.endsWith('/api/locations')) {
        return json({ present: Boolean(document), document, report: EMPTY_REPORT })
      }
      if (url.endsWith('/api/designators')) {
        return json({ drawing_number: 'PS20115MLM4-2', counts: {}, located: 0, entries: [] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

const store = () => useLocateStore.getState()

/** The draft's point for one terminal, or null. What the file would say. */
function terminal(id: string): [number, number] | null {
  return (store().document?.terminals?.[id]?.point as [number, number] | undefined) ?? null
}

function sites(componentId: string): StoredSite[] {
  return store().document?.components?.[componentId]?.sites ?? []
}

/** Arm a row and put a point under it, which is the state every undo test starts from. */
function placeTerminal(id: string, point: [number, number]) {
  store().setTarget({ id, site: null })
  store().place(point, STAMP, 'terminal')
}

beforeEach(() => {
  saved = []
  stubServer()
  useLocateStore.setState({
    document: structuredClone(EMPTY),
    report: null,
    unlocked: true,
    loading: false,
    error: null,
    target: null,
    advance: false,
    saveState: 'clean',
    saveError: null,
    stale: null,
    undoStack: [],
    redoStack: [],
    undoNote: null,
  })
  // The coalescing key is module state and setState cannot reach it, so a run left open by one
  // test would silently merge into the next one's first edit.
  store().endRun()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the undo stack over the draft', () => {
  it('restores the exact coordinate it replaced, to the tenth of a point', () => {
    // The accident that produced this feature: `BYPASS-CB:1` moved from y 663.8 to 663.7 — a
    // 160th of a conductor row, invisible on screen, and gone from the running program.
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    placeTerminal('BYPASS-CB:1', [385.4, 663.7])
    expect(terminal('BYPASS-CB:1')).toEqual([385.4, 663.7])

    store().undo()
    expect(terminal('BYPASS-CB:1')).toEqual([385.4, 663.8])
  })

  it('undoes a rename, a pin assignment and a label side, not only a point', () => {
    store().setTarget({ id: 'CR-BP', site: 'main' })
    store().place([861, 679], STAMP, 'component')
    store().edit(
      (d) => model.renameSite(d, 'CR-BP', 'main', 'Coil'),
      "renamed CR-BP's site main to Coil",
    )
    store().edit((d) => model.assignTerminal(d, 'CR-BP', 'Coil', 'A1', true), 'put pin A1 on')
    store().setLabelDir({ id: 'CR-BP', site: 'Coil' }, 'w')

    expect(sites('CR-BP')[0].label?.dir).toBe('w')
    store().undo()
    expect(sites('CR-BP')[0].label?.dir).toBeUndefined()
    store().undo()
    expect(sites('CR-BP')[0].terminals).toEqual([])
    store().undo()
    expect(sites('CR-BP')[0].id).toBe('main')
  })

  it('says out loud what it undid', () => {
    // A document mutation reverted silently on a 275-row file is indistinguishable from a key
    // that did nothing at all.
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    placeTerminal('BYPASS-CB:1', [385.4, 663.7])
    store().undo()
    expect(store().undoNote).toBe('undid: placed BYPASS-CB:1')
    store().redo()
    expect(store().undoNote).toBe('redid: placed BYPASS-CB:1')
    // And the next mutation clears it, so the badge never describes an action two steps old.
    placeTerminal('BYPASS-CB:1', [385.4, 663.9])
    expect(store().undoNote).toBeNull()
  })

  it('arms the row whose value changed, rather than restoring what was armed before', () => {
    // The distinction is the whole design. Arming the affected row is an *announcement* — it is
    // what makes the list scroll to the dot that just moved. Restoring the previous target would
    // make `Ctrl+Z` walk back navigation as well as content, and then nobody can predict it.
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    store().setTarget({ id: 'CR2:14', site: null })

    store().undo()
    expect(store().target).toEqual({ id: 'BYPASS-CB:1', site: null })
  })

  it('touches nothing but the draft, the armed row and the save state', () => {
    // The pan, the zoom and the list filter are not in this store at all — they live in
    // `useTileViewport` and in `LocateTab`'s own `useState` — and that is *why* undo cannot walk
    // them back. Asserted so that moving one of them in here would fail loudly.
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    const before = store()
    store().undo()
    const after = store()

    expect(Object.keys(after)).not.toContain('percent')
    expect(Object.keys(after)).not.toContain('filter')
    expect(after.advance).toBe(before.advance)
    expect(after.report).toBe(before.report)
    expect(after.unlocked).toBe(before.unlocked)
  })

  it('caps at fifty steps and drops the oldest, and running out is not an error', () => {
    for (let n = 0; n < 60; n += 1) placeTerminal('BYPASS-CB:1', [n, n])
    expect(store().undoStack).toHaveLength(50)

    for (let n = 0; n < 50; n += 1) store().undo()
    // The tenth placement is as far back as fifty steps reach; the first nine are gone.
    expect(terminal('BYPASS-CB:1')).toEqual([9, 9])
    expect(store().undoStack).toHaveLength(0)

    store().undo()
    expect(terminal('BYPASS-CB:1')).toEqual([9, 9])
  })

  it('redoes what it undid, and a new edit drops the redone future', () => {
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    placeTerminal('BYPASS-CB:1', [385.4, 663.7])
    store().undo()
    store().redo()
    expect(terminal('BYPASS-CB:1')).toEqual([385.4, 663.7])

    store().undo()
    placeTerminal('BYPASS-CB:1', [385.4, 700])
    expect(store().redoStack).toHaveLength(0)
    store().redo()
    expect(terminal('BYPASS-CB:1')).toEqual([385.4, 700])
  })

  it('takes a run of coalescing edits back in one step', () => {
    // A drag fires the mutation on every pointer move and a nudge on every keypress. Ten
    // presses must be one `Ctrl+Z`, not ten — and the run must not fill a 50-deep stack with
    // itself and push the thing you actually wanted back off the end.
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    const run = 'nudge:BYPASS-CB:1::point'
    for (let n = 1; n <= 10; n += 1) {
      store().edit(
        (d) => model.setTerminalPoint(d, 'BYPASS-CB:1', [385.4, 663.8 + n * 0.1], STAMP),
        'nudged BYPASS-CB:1',
        run,
      )
    }
    expect(terminal('BYPASS-CB:1')).toEqual([385.4, 664.8])
    expect(store().undoStack).toHaveLength(2)

    store().undo()
    expect(terminal('BYPASS-CB:1')).toEqual([385.4, 663.8])
  })

  it('starts a new step once the run has ended', () => {
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    const drag = 'drag:BYPASS-CB:1::point'
    store().edit((d) => model.setTerminalPoint(d, 'BYPASS-CB:1', [385.4, 670], STAMP), 'a', drag)
    store().endRun()
    store().edit((d) => model.setTerminalPoint(d, 'BYPASS-CB:1', [385.4, 680], STAMP), 'b', drag)

    store().undo()
    expect(terminal('BYPASS-CB:1')).toEqual([385.4, 670])
  })

  it('saves an undo like any other mutation', async () => {
    vi.useFakeTimers()
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    placeTerminal('BYPASS-CB:1', [385.4, 663.7])
    await vi.advanceTimersByTimeAsync(1000)
    expect(saved.at(-1)?.terminals['BYPASS-CB:1'].point).toEqual([385.4, 663.7])

    store().undo()
    expect(store().saveState).toBe('pending')
    await vi.advanceTimersByTimeAsync(1000)
    // An undo that does not persist is a lie the moment the page reloads.
    expect(saved.at(-1)?.terminals['BYPASS-CB:1'].point).toEqual([385.4, 663.8])
    expect(store().saveState).toBe('saved')
  })

  it('is emptied by loading a file, because a stack belongs to one document', async () => {
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    expect(store().undoStack).toHaveLength(1)

    stubServer({ ...structuredClone(EMPTY), terminals: {} })
    await store().load('PS20115MLM4-2', [1224, 792])
    expect(store().undoStack).toHaveLength(0)
    expect(store().undoNote).toBeNull()

    // Nothing to undo into, so the key does nothing rather than reaching into the old file.
    store().undo()
    expect(terminal('BYPASS-CB:1')).toBeNull()
  })

  it('is emptied by a reset', () => {
    placeTerminal('BYPASS-CB:1', [385.4, 663.8])
    store().reset()
    expect(store().undoStack).toHaveLength(0)
    expect(store().redoStack).toHaveLength(0)
  })
})

afterEach(() => {
  useAppStore.setState({ designators: null })
})
