/**
 * The review screen, end to end against a stubbed server.
 *
 * What is worth testing here is not the layout. It is the things that would each produce a
 * plausible-looking screen that quietly does the wrong thing to an authored file:
 *
 * - a queue that shows the confident readings first, so the work is hidden behind 500 rows nobody
 *   needs to look at;
 * - a **Reset** that writes the machine's reading in as though a person had chosen it, which is the
 *   one thing that would stop the file meaning anything (invariant 10);
 * - *not a label* writing `""` instead of `null`, which the server refuses by name;
 * - a box whose value comes from the document, so the caret leaves after every keystroke (`H4`);
 * - a Review tab existing on a server that never registered the routes to save to;
 * - a ring on the sheet computed by this feature's own arithmetic rather than through the one
 *   projection, which is the only bug that matters on a screen whose job is *read this exact ink*.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReviewTab } from './ReviewTab'
import type { CorrectionsDocument, DrawingSummary, Health, ReviewItem } from '@/api/types'
import { pointToCss } from '@/features/drawing/paint'
import { centreOn, focusScale } from '@/features/drawing/useTileViewport'
import { useAppStore } from '@/stores/appStore'
import { useReviewStore } from '@/stores/reviewStore'
import { enabledTabs } from '@/tabs'
import { REVIEW_TAB_ID } from '@/tabIds'

const TILES = {
  page_size_pt: [1224, 792] as [number, number],
  dpi: 400,
  rows: 1,
  cols: 1,
  count: 1,
  tiles: [
    {
      file: 'tile_r1c1.png',
      row: 1,
      col: 1,
      pdf_rect: [0, 0, 1224, 792] as [number, number, number, number],
      pixels: [6800, 4400] as [number, number],
    },
  ],
}

const DRAWING = {
  drawing_number: 'PS20115MLM4-2',
  title: null, assembly: null, date: null, revision: null, revision_note: null,
  proprietary_notice: null, notes: [], references: [], counts: {}, subsystems: [],
  component_classes: {}, relationship_types: {}, artifacts: [], source: null,
  tiles: TILES,
} satisfies DrawingSummary

const HEALTH = {
  ok: true, version: '0.1.0', prompt_version: 'v1.1', claude: '2.1.226', drawing_dir: '/x',
  drawing_dir_present: true, models: ['sonnet'], default_model: 'sonnet',
  anonymous_models: ['sonnet'], password_required: false,
  editing: { enabled: true, password_required: true, by: 'js' },
  spend: { day: '2026-08-25', spent_usd: 0, ceiling_usd: 10, remaining_usd: 10, exhausted: false },
  in_flight: 0, concurrency_limit: 2, sessions: 0,
} satisfies Health

/**
 * Five readings, and each is a case the screen has to get right.
 *
 * `T0012` is the misread that matters: `LI-A` for `L1-A`, capital I for the digit 1, at confidence
 * 0.4, and a run reads its net name from it. `T0300` is what the extractor was *confident and wrong*
 * about, which is why the `All readings` scope exists at all. `T0200` was not read. `C0030` has a
 * net name bound and `C0008` has none.
 */
const ITEMS: ReviewItem[] = [
  { id: 'T0300', kind: 'label', read: 'P0WER IN', text: 'P0WER IN', confidence: 0.84,
    flagged: false, net_name: false, rect: [700, 500, 760, 512], label_kind: 'note',
    raw_ocr: 'POWER IN' },
  { id: 'T0012', kind: 'label', read: 'LI-A', text: 'LI-A', confidence: 0.4, flagged: true,
    net_name: true, rect: [415.48, 44.73, 425.82, 48.86], label_kind: 'text',
    conductors: ['C0030'] },
  { id: 'T0200', kind: 'label', read: null, text: null, confidence: 0, flagged: true,
    net_name: false, rect: [600, 400, 610, 410], label_kind: 'empty' },
  { id: 'C0030', kind: 'conductor', read: 'LI-A', text: 'LI-A', confidence: null, flagged: false,
    net_name: true, rect: [300, 46, 420, 90],
    // A bend, as 50 of the real 149 have. Its rect is the box its polyline fits in, and the ink
    // only touches two corners of that box.
    points: [[300, 46], [420, 46], [420, 90]] },
  { id: 'C0008', kind: 'conductor', read: null, text: null, confidence: null, flagged: true,
    net_name: true, rect: [468.12, 215.97, 761.5, 232.51], missing: ['net_label', 'spec_label'] },
]

const COUNTS = {
  labels: 3, conductors: 2, flagged: 3, blank_labels: 1,
  conductors_without_a_net_name: 1, net_names: 3,
}
const REPORT = { file: false, corrections: 0, rejections: 0, confirmations: 0,
                 problems: [] as string[] }

/** jsdom reports every element as 0×0, and a container with no size has nothing to fit to.
 * 800×600 with 12 pt of padding fits 1224×792 at 776/1224 px/pt. */
const SIZE = { width: 800, height: 600 }

/** Every PUT the screen made, in order, so a test can look at the file it would have written. */
let saved: CorrectionsDocument[] = []

function stubServer(
  options: { items?: ReviewItem[]; document?: CorrectionsDocument | null } = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/editor/unlock')) {
        return json({ unlocked: true, password_required: true })
      }
      if (url.endsWith('/api/review') && init?.method === 'PUT') {
        saved.push(JSON.parse(String(init.body)).document)
        return json({ saved: true, report: { ...REPORT, file: true } })
      }
      if (url.endsWith('/api/review')) {
        const document =
          options.document ?? { drawing_number: 'PS20115MLM4-2', schema: 1, labels: {} }
        return json({
          present: Boolean(options.document),
          // The screen sends this straight back, so what the stub hands over is what a save must
          // contain: an unknown key here would prove the round trip does not normalise it away.
          document,
          report: REPORT,
          counts: COUNTS,
          /**
           * **The corrections folded back onto the readings, the way the server does it.**
           *
           * `resolve_corrections` lays the authored file over the ink on every request, so
           * `item.correction` on a re-read is the decision the last save wrote. The store's
           * `save` calls `refresh` for exactly that reason, and anything that reads `correction`
           * — the `decided` count, and the `Not a label` scope — is a save behind until it lands.
           * A stub that always answered with the pristine readings would hide that.
           */
          items: (options.items ?? ITEMS).map((item) => {
            const stored = last(saved)?.labels?.[item.id]
            return stored ? { ...item, correction: stored } : item
          }),
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

/** The most recent document the screen wrote, for the stub to answer subsequent reads with. */
function last(documents: CorrectionsDocument[]): CorrectionsDocument | undefined {
  return documents[documents.length - 1]
}

/** Every URL the page has fetched, so a test can assert on what was *not* asked for. */
function calls(): string[] {
  return (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(
    ([url]) => url,
  )
}

function json(body: unknown, status = 200) {
  return {
    ok: status < 400, status, statusText: '', json: async () => body,
  } as unknown as Response
}

beforeEach(() => {
  saved = []
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true, writable: true, value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true, get: () => SIZE.width,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true, get: () => SIZE.height,
  })
  useAppStore.setState({ drawing: DRAWING, health: HEALTH, activeTabId: REVIEW_TAB_ID })
  useReviewStore.setState({
    document: null, items: [], counts: null, report: null, unlocked: false, loading: false,
    error: null, currentId: null, saveState: 'clean', saveError: null,
  })
  stubServer()
})

afterEach(() => {
  for (const name of ['clientWidth', 'clientHeight', 'scrollIntoView'] as const) {
    delete (HTMLElement.prototype as never)[name]
  }
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Get past the gate the way a person does. */
async function open(options: Parameters<typeof stubServer>[0] = {}) {
  if (Object.keys(options).length) stubServer(options)
  render(<ReviewTab />)
  fireEvent.change(screen.getByLabelText('Editor password'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
  await screen.findByLabelText('What T0012 says')
}

/** The rows in the queue, in the order they are drawn. */
function rows(): string[] {
  return [...screen.getByRole('list', { name: 'Readings to review' }).children].map(
    (row) => row.getAttribute('data-reading') ?? '',
  )
}

function box(id: string): HTMLInputElement {
  return screen.getByLabelText(`What ${id} says`) as HTMLInputElement
}

/** A scope or filter button, scoped to its labelled group — the `H16` rule applied before these
 * words collide with anything rather than after. */
function control(name: string): HTMLButtonElement {
  return within(screen.getByRole('group', { name: 'What to review' })).getByRole('button', {
    name,
  }) as HTMLButtonElement
}

/** Type a reading and accept it, the way a person does. */
function type(id: string, text: string) {
  fireEvent.focus(box(id))
  fireEvent.change(box(id), { target: { value: text } })
  fireEvent.keyDown(box(id), { key: 'Enter' })
}

/** The debounce, run out. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 950))
  })
}

describe('ReviewTab', () => {
  it('is offered only on a server that can save, and only once the sheet is tiled', () => {
    // Both halves matter. Without the editor the routes do not exist, and without tiles there is no
    // ink to read against — which is the entire point of the screen rather than a nicety.
    const ids = (context: Parameters<typeof enabledTabs>[0]) =>
      enabledTabs(context).map((tab) => tab.id)
    const base = { drawingAvailable: true, tilesAvailable: true, editingEnabled: true }
    expect(ids(base)).toContain(REVIEW_TAB_ID)
    expect(ids({ ...base, editingEnabled: false })).not.toContain(REVIEW_TAB_ID)
    expect(ids({ ...base, tilesAvailable: false })).not.toContain(REVIEW_TAB_ID)
  })

  it('asks for the editor password and fetches nothing until it has one', async () => {
    render(<ReviewTab />)
    expect(screen.getByText('The Review screen is locked')).toBeTruthy()
    expect(calls().some((url) => url.endsWith('/api/review'))).toBe(false)

    fireEvent.change(screen.getByLabelText('Editor password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await screen.findByLabelText('What T0012 says')
    expect(calls().filter((url) => url.endsWith('/api/review'))).toHaveLength(1)
  })

  it('shows the extractor’s own doubts first, worst read at the top', async () => {
    await open()
    // The three it flagged, and `T0012` — 0.4 — ahead of the blank, which needs a decision rather
    // than a correction. `T0300` is confident and so not in this scope at all.
    expect(rows()).toEqual(['T0012', 'T0200', 'C0008'])
    expect(screen.getByText(/0 of 3 decided/)).toBeTruthy()
    expect(screen.getByText(/3 flagged/)).toBeTruthy()
  })

  it('reaches a reading nobody flagged through All readings', async () => {
    await open()
    expect(rows()).not.toContain('T0300')
    fireEvent.click(control('All readings'))
    // `P0WER IN` for `POWER IN` at 0.84: the extractor was confident and wrong, and this scope is
    // the only way to that whole class of mistake.
    expect(rows()).toContain('T0300')
    expect(box('T0300').value).toBe('P0WER IN')
    expect(screen.getByText(/raw/)).toBeTruthy()
  })

  it('narrows to the readings a run’s net name depends on', async () => {
    await open()
    fireEvent.click(control('All readings'))
    fireEvent.click(control('Net names'))
    // The set the path matcher reads: both runs, plus the label one of them takes its name from.
    expect(rows().sort()).toEqual(['C0008', 'C0030', 'T0012'])
    expect(control('Net names').getAttribute('aria-pressed')).toBe('true')
  })

  it('writes the corrected reading and what the machine had, and saves it', async () => {
    await open()
    type('T0012', 'L1-A')
    await settle()
    await waitFor(() => expect(saved).toHaveLength(1), { timeout: 3000 })
    expect(saved[0].labels).toEqual({
      T0012: { text: 'L1-A', was: 'LI-A', by: 'js', at: expect.any(String) },
    })
    expect(saved[0].schema).toBe(1)
  })

  it('writes null for not a label, never an empty string', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'T0200 is not a label' }))
    await settle()
    await waitFor(() => expect(saved).toHaveLength(1), { timeout: 3000 })
    expect(saved[0].labels.T0200.text).toBeNull()
  })

  it('deletes the decision on Reset rather than writing the machine’s reading in', async () => {
    // The assertion in this file worth reporting loudly. A default stored as though a person chose
    // it makes the file stop distinguishing *nobody looked* from *somebody decided*, which is the
    // distinction it exists for.
    await open({
      document: {
        drawing_number: 'PS20115MLM4-2',
        schema: 1,
        labels: { T0012: { text: 'L1-A', was: 'LI-A' } },
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset T0012' }))
    await settle()
    await waitFor(() => expect(saved).toHaveLength(1), { timeout: 3000 })
    expect(saved[0].labels).toEqual({})
  })

  it('offers no tick on an empty box, because the decision there is “not a label”', async () => {
    // An empty box *is* Reset, so there would be nothing for the tick to accept — and a button that
    // silently does nothing reads as broken. For a run that means *no net name is printed on this*.
    await open()
    expect((screen.getByRole('button', { name: 'Confirm T0200' }) as HTMLButtonElement).disabled)
      .toBe(true)
    expect((screen.getByRole('button', { name: 'Confirm T0012' }) as HTMLButtonElement).disabled)
      .toBe(false)
  })

  it('offers no Reset on a reading nobody has decided about', async () => {
    await open()
    expect((screen.getByRole('button', { name: 'Reset T0012' }) as HTMLButtonElement).disabled)
      .toBe(true)
  })

  it('shows the original reading beside a correction', async () => {
    await open({
      document: {
        drawing_number: 'PS20115MLM4-2',
        schema: 1,
        labels: { T0012: { text: 'L1-A', was: 'LI-A' } },
      },
    })
    const row = screen.getByLabelText('What T0012 says').closest('li') as HTMLElement
    expect(box('T0012').value).toBe('L1-A')
    // `geometry.json` is regenerated by a re-extraction and takes the original with it, so this is
    // the only durable record of what the machine actually saw.
    expect(within(row).getByText(/was/)).toBeTruthy()
    expect(within(row).getByText('LI-A')).toBeTruthy()
  })

  it('keeps the caret while a reading is being typed, and writes once', async () => {
    // `H4`: an input whose value comes from a document a pure function may normalise needs local
    // state, or a trimmed value snaps back and the field looks frozen. One write per decision, not
    // per keystroke.
    await open()
    fireEvent.focus(box('T0012'))
    for (const value of ['L', 'L1', 'L1-', 'L1-A']) {
      fireEvent.change(box('T0012'), { target: { value } })
    }
    expect(box('T0012').value).toBe('L1-A')
    // Four keystrokes, then one decision.
    fireEvent.keyDown(box('T0012'), { key: 'Enter' })
    await settle()
    await waitFor(() => expect(saved).toHaveLength(1), { timeout: 3000 })
    expect(saved[0].labels.T0012.text).toBe('L1-A')
  })

  it('records nothing when a box is left exactly as the machine read it', async () => {
    // Blur alone is not a decision. Tabbing through the queue must not sign 278 readings.
    await open()
    fireEvent.focus(box('T0012'))
    fireEvent.blur(box('T0012'))
    await settle()
    expect(saved).toHaveLength(0)
  })

  it('records a confirmation when the reading is accepted as it stands', async () => {
    // Pressing the tick on an unchanged string *is* a decision, and the one thing this project
    // stores that agrees with the machine — nothing produces *a person checked this* but a person.
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm T0012' }))
    await settle()
    await waitFor(() => expect(saved).toHaveLength(1), { timeout: 3000 })
    expect(saved[0].labels.T0012).toMatchObject({ text: 'LI-A', was: 'LI-A' })
  })

  it('rings the ink of the row the caret is in, through the one projection', async () => {
    /**
     * **Reduced motion, so the flight is a jump and the viewport is a number rather than a
     * moment.** `panTo` interpolates over 420 ms of `requestAnimationFrame`, so asserting a
     * position mid-flight is asserting on the machine's load — which it was, for one test run.
     * Stubbing the media query is not weakening the test: it is the same landing place, arrived at
     * without an animation, and `prefers-reduced-motion` is a real code path with real users.
     */
    reduceMotion()
    await open()
    expect(document.querySelector('[data-ink-ring]')).toBeNull()

    fireEvent.focus(box('T0012'))
    const ring = await waitFor(() => {
      const found = document.querySelector('[data-ink-ring="T0012"]') as HTMLElement | null
      expect(found).not.toBeNull()
      return found as HTMLElement
    })

    // Where the sheet settles after framing that bbox — computed with the viewer's **own** exported
    // arithmetic, so a change to the padding or the focus zoom cannot make this assertion vacuous.
    const rect = [415.48, 44.73, 425.82, 48.86] as const
    const scale = focusScale(rect, SIZE, 400 / 72)
    const viewport = centreOn(rect, SIZE, scale)
    // Then where `pointToCss` says its top-left corner is, less the ring's own 2 pt of padding. If
    // this feature ever computed its own `point × scale + offset`, the ring would drift off the tile
    // under it — on a screen whose whole job is *read this exact piece of ink*.
    const corner = pointToCss([rect[0], rect[1]], viewport, 1)
    const pad = 2 * scale + 2
    expect(Math.round(parseFloat(ring.style.left))).toBe(Math.round(corner.left - pad))
    expect(Math.round(parseFloat(ring.style.top))).toBe(Math.round(corner.top - pad))

    // And it follows the caret rather than accumulating.
    fireEvent.focus(box('C0008'))
    await waitFor(() => expect(document.querySelector('[data-ink-ring="T0012"]')).toBeNull())
    expect(document.querySelector('[data-ink-ring="C0008"]')).not.toBeNull()
  })

  it('says when a run reads its net name through a corrected label', async () => {
    // The link that makes one correction worth more than one row: the matcher compares the *run's*
    // name against a wire's net, so a screen that fixed the label and left the run alone would
    // unlock nothing at all.
    await open({
      items: ITEMS.map((item) =>
        item.id === 'C0030' ? { ...item, text: 'L1-A', via: 'T0012' } : item,
      ),
    })
    fireEvent.click(control('All readings'))
    const row = screen.getByLabelText('What C0030 says').closest('li') as HTMLElement
    expect(within(row).getByText(/via/)).toBeTruthy()
    expect(within(row).getByText('T0012')).toBeTruthy()
    // And the box shows what it reads now, so nobody "fixes" it a second time on the run itself.
    expect(box('C0030').value).toBe('L1-A')
  })

  it('says a run has no confidence, and what it is missing', async () => {
    await open()
    const row = screen.getByLabelText('What C0008 says').closest('li') as HTMLElement
    expect(within(row).getByText('run')).toBeTruthy()
    expect(within(row).queryByText(/%$/)).toBeNull()
    expect(within(row).getByText(/missing net_label, spec_label/)).toBeTruthy()
    expect(box('C0008').placeholder).toBe('no net name bound')
  })

  it('names a run’s missing net name as a correction on the run itself', async () => {
    await open()
    type('C0008', '130')
    await settle()
    await waitFor(() => expect(saved).toHaveLength(1), { timeout: 3000 })
    // `was: null` — never bound rather than misread, which is the honest record of it.
    expect(saved[0].labels.C0008).toMatchObject({ text: '130', was: null })
  })

  it('says so when the drawing has no extracted ink at all', async () => {
    stubServer({ items: [] })
    render(<ReviewTab />)
    fireEvent.change(screen.getByLabelText('Editor password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByText(/no extracted ink to review/)).toBeTruthy()
  })

  // -- the small batch, 2026-09-03 ---------------------------------------------------------

  it('recomputes the kind badge from the text you typed, and leaves untouched rows alone', async () => {
    await open()
    const rowOf = (id: string) => within(screen.getByText(id).closest('li') as HTMLElement)
    // The extraction called `LI-A` a `text`, and it still does — nobody has corrected this row.
    expect(
      rowOf('T0012').getByTitle(/What sort of string the extraction thinks/).textContent,
    ).toContain('text')
    // Trailing punctuation is the whole of the difference here, and it is what the badge was
    // reported for three times: after `125,` → `125` it went on saying `text`.
    type('T0012', '125')
    await settle()
    expect(rowOf('T0012').getByTitle(/worked out from the text you typed/).textContent).toContain(
      'net_number',
    )
    // A run has no string to be a kind of, and says what it is instead.
    expect(rowOf('C0008').getByTitle(/A run of ink/).textContent).toContain('run')
  })

  it('lists every not-a-label decision, which is the only way back to one', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'No net name is printed on C0008' }))
    await settle()
    fireEvent.click(control('Not a label'))
    // Over every reading rather than only the flagged ones, and it finds the run whose net name
    // was given up. Thirty-four went that way on 2026-09-01 and took a database query to find.
    expect(rows()).toEqual(['C0008'])
    fireEvent.click(control('Flagged'))
    expect(rows()).toEqual(['T0012', 'T0200', 'C0008'])
  })

  it('tells a run that no net name is printed on it, rather than talking about labels', async () => {
    await open()
    // **The wording that cost 34 net names.** On a run this button is a claim about the paper that
    // the matcher acts on by never offering the run again; on a label it is nearly free.
    const run = screen.getByRole('button', { name: 'No net name is printed on C0008' })
    expect(run.getAttribute('title')).toContain('not a bookmark')
    const label = screen.getByRole('button', { name: 'T0012 is not a label' })
    expect(label.getAttribute('title')).toContain('never names')
  })

  it('writes a note beside a decision, and will not write one without a decision', async () => {
    await open()
    const note = () => screen.getByLabelText('Note about T0012') as HTMLInputElement
    // Nothing decided: disabled, and the placeholder says why rather than leaving somebody typing
    // into a box that swallows it. A note needs a `text` to ride on, and inventing the machine's
    // reading to hang one off would record a confirmation nobody made (invariant 10).
    expect(note().disabled).toBe(true)
    expect(note().placeholder).toContain('decide first')

    type('T0012', 'L1-A')
    await settle()
    expect(note().disabled).toBe(false)

    fireEvent.change(note(), { target: { value: 'box is short of the ink' } })
    fireEvent.blur(note())
    await settle()
    const last = saved[saved.length - 1]
    expect(last.labels.T0012).toMatchObject({
      text: 'L1-A',
      was: 'LI-A',
      note: 'box is short of the ink',
    })
    // And it is findable again without a scope: the row carries a mark.
    expect(screen.getByLabelText('T0012 has a note')).toBeTruthy()
  })

  it('rings a run along its own polyline and a label with its box', async () => {
    /**
     * Small-batch item 5, and it was a wrong ring rather than a wrong reading. `C0002` on the real
     * sheet is a three-segment L inside a 206 × 215 pt rectangle with a dozen unrelated runs
     * crossing it, and for 19 of the 149 the box round the endpoints does not even contain the
     * ink. Drawn through `polylineToDevice`, which is the one projection — a mark that computed
     * its own could disagree with the tile under it.
     */
    reduceMotion()
    await open()
    fireEvent.click(control('All readings'))
    fireEvent.focus(box('C0030'))
    const svg = document.querySelector('[data-ink-shape="C0030"]')
    expect(svg).toBeTruthy()
    // Three vertices, so the corner is drawn rather than cut across.
    const drawn = svg?.querySelector('polyline')?.getAttribute('points') ?? ''
    expect(drawn.trim().split(/\s+/)).toHaveLength(3)

    // A label is a box, and framing it exactly is how a person sees that the *box* is wrong —
    // which is how `T0350` and `T0343` were diagnosed. So no polyline there.
    fireEvent.focus(box('T0012'))
    expect(document.querySelector('[data-ink-shape="T0012"]')).toBeNull()
    expect(document.querySelector('[data-ink-ring="T0012"]')).toBeTruthy()
  })
})

/**
 * Report `prefers-reduced-motion: reduce`, so a flight lands rather than animating.
 *
 * The stub has to answer every query the viewer makes, not just that one: `useDevicePixelRatio`
 * matches `(resolution: 1dppx)` and subscribes to it, and a stub with no `addEventListener` would
 * throw somewhere unrelated to what is being tested.
 */
function reduceMotion() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}
