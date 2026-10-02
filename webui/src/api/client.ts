/**
 * The only place `fetch` appears.
 *
 * Everything is same-origin: in dev, Vite proxies `/api` to the server on 9700; in
 * production FastAPI serves the bundle under `/webui`. So there is no base URL to configure
 * and no CORS in the production path — which is also what lets the CSP say `connect-src
 * 'self'` and mean it.
 */

import type {
  ConductorIndex,
  CorrectionsDocument,
  DesignatorIndex,
  DrawingSummary,
  Health,
  LocationsDocument,
  LocationsResponse,
  PathIndex,
  PronunciationEntry,
  PronunciationLists,
  PronunciationScope,
  ReviewResponse,
  SaveLocationsResponse,
  SaveReviewResponse,
  ServerEvent,
  StarterQuestion,
  SaveWiringResponse,
  WiringDocument,
  WiringResponse,
} from './types'

const API = '/api'

/** The demo password, when one is configured. Held in memory only — a public demo has no
 * business persisting a shared secret in localStorage. */
let demoPassword = ''
export function setDemoPassword(value: string) {
  demoPassword = value
}
export function hasDemoPassword() {
  return demoPassword.length > 0
}

/**
 * Check a password before storing it, so a typo reports itself instead of surfacing later as
 * a 403 on a question. Throws `ApiError` (401) when it is wrong.
 */
export async function unlock(password: string): Promise<void> {
  const response = await fetch(`${API}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  setDemoPassword(password)
}

/**
 * The editor password, when one is configured. A *second* secret, held the same way and for a
 * stronger reason: permission to spend tokens and permission to change where the drawing says
 * things are are different permissions, so this is never the demo password and never persisted.
 * Closing the tab is the logout.
 */
let editorPassword = ''
export function hasEditorPassword() {
  return editorPassword.length > 0
}

/** Check the editor password before storing it. Throws `ApiError` (401) when it is wrong, and
 * 404 when the server was not started with `SWUI_ALLOW_EDITS=true` — the routes do not exist. */
export async function editorUnlock(password: string): Promise<void> {
  const response = await fetch(`${API}/editor/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  editorPassword = password
}

/** One turn's question and answer, as the model had them and as the user rewrote them. */
export interface EditedAnswer {
  question: string
  question_edited: string | null
  answer: string
  answer_edited: string | null
  model: string | null
}

/** A past turn in the Ask tab's *Past answers* list (`talkthrough_03.md` §7). */
export interface PastTurn {
  turn_id: string
  saved: string
  model: string | null
  prompt_version: string | null
  /** Null for a turn asked before questions were recorded (2026-10-01). */
  question: string | null
  preview: string
  edited: boolean
}

/** One past turn whole, with the user's saved rewrite if there is one. */
export interface PastTurnDetail {
  turn_id: string
  model: string | null
  question: string | null
  answer: string
  edit: { question: { original: string; edited: string | null }; answer: { original: string; edited: string | null } } | null
}

/** This drawing's past turns, newest first. Editor routes only, and the editor password. */
export async function getTurns(): Promise<PastTurn[]> {
  const response = await fetch(`${API}/turns`, { headers: { Accept: 'application/json', ...editorHeader() } })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return ((await response.json()) as { turns: PastTurn[] }).turns
}

export async function getTurn(turnId: string): Promise<PastTurnDetail> {
  const response = await fetch(`${API}/turns/${encodeURIComponent(turnId)}`, {
    headers: { Accept: 'application/json', ...editorHeader() },
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return (await response.json()) as PastTurnDetail
}

/** Keep the user's rewrite beside the original (`talkthrough_02.md` §6). Both edits null deletes
 * the record. Needs the editor routes (`SWUI_ALLOW_EDITS=true`) and, if set, its password. */
export async function putEditedAnswer(turnId: string, body: EditedAnswer): Promise<void> {
  const response = await fetch(`${API}/edited-answers/${encodeURIComponent(turnId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...editorHeader() },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
}

export async function getLocations(): Promise<LocationsResponse> {
  const response = await fetch(`${API}/locations`, {
    headers: { Accept: 'application/json', ...editorHeader() },
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return (await response.json()) as LocationsResponse
}

/**
 * Replace `locations.json` wholesale.
 *
 * Whole-file rather than a patch because the editor holds the document it loaded: there is no
 * merge to get wrong, and a text file a human can also open stays the source of truth. The
 * server writes it atomically and answers with the problems the *next* read will report.
 */
export async function putLocations(
  document: LocationsDocument,
): Promise<SaveLocationsResponse> {
  const response = await fetch(`${API}/locations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...editorHeader() },
    body: JSON.stringify({ document }),
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return (await response.json()) as SaveLocationsResponse
}

/**
 * Every reading on the sheet, the extractor's own doubts about them, and the corrections so far.
 *
 * Behind the editor password with the rest of the write surface, and not only because of the `PUT`:
 * this is the one route that opens `geometry.json`, and a reader's copy has no business downloading
 * 664 OCR readings it cannot act on. Throws 404 when the server was started without
 * `SWUI_ALLOW_EDITS=true` — the route does not exist.
 */
export async function getReview(): Promise<ReviewResponse> {
  const response = await fetch(`${API}/review`, {
    headers: { Accept: 'application/json', ...editorHeader() },
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return (await response.json()) as ReviewResponse
}

/**
 * Replace `label_corrections.json` wholesale — the same shape of write as `putLocations`, and for
 * the same reasons.
 *
 * One deliberate difference in what comes back: **no `stale` banner.** A saved point makes
 * `circuit_logic.json` stale because the generator folds positions into it; a corrected *reading*
 * changes nothing the generator writes, and a server test asserts the netlist is byte-identical
 * with and without this file.
 */
export async function putReview(document: CorrectionsDocument): Promise<SaveReviewResponse> {
  const response = await fetch(`${API}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...editorHeader() },
    body: JSON.stringify({ document }),
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return (await response.json()) as SaveReviewResponse
}

/**
 * The 149 runs of ink, reduced to what tracing a wire needs — **and to naming a line on the
 * sheet.**
 *
 * **Free since 2026-09-09.** It was behind the editor password from the day it was built, on the
 * argument that 149 candidate polylines are no use to somebody who cannot accept one into an
 * authored file. Phase D added the reader that argument had not met: a technician points at a
 * line and asks *what is this, and does any wire claim it*, which needs exactly these polylines
 * and no password. `H20` was rewritten round it, and the line it draws now is **geometry is free
 * and connectivity is not** — `getWiring` below is still gated, and for a stronger reason.
 *
 * No editor header, deliberately: the route does not consult one, and sending it would imply
 * this call means something different on a machine that has a password set.
 */
export async function getConductors(): Promise<ConductorIndex> {
  return getJson<ConductorIndex>('/conductors')
}

/**
 * Which two terminals each wire joins — the fourth authored file.
 *
 * Behind the editor password with the rest of the write surface, and behind it for a stronger
 * reason than either of the others: this is *what connects to what*, which is the claim the model
 * answers from. Throws 404 when the server was started without `SWUI_ALLOW_EDITS=true` — the
 * route does not exist.
 */
export async function getWiring(): Promise<WiringResponse> {
  const response = await fetch(`${API}/wiring`, {
    headers: { Accept: 'application/json', ...editorHeader() },
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return (await response.json()) as WiringResponse
}

/**
 * Replace `wiring.json` wholesale — the same shape of write as `putLocations`.
 *
 * One deliberate difference in what comes back, and it is the opposite of `putReview`'s: **this
 * save really does make `circuit_logic.json` stale.** A path and a label correction are display
 * geometry and a reading of the ink; an endpoint is the netlist. The banner names both the
 * generator and `build_kg.py`, because this is the work that moves connectivity rather than
 * coordinates.
 */
export async function putWiring(document: WiringDocument): Promise<SaveWiringResponse> {
  const response = await fetch(`${API}/wiring`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...editorHeader() },
    body: JSON.stringify({ document }),
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return (await response.json()) as SaveWiringResponse
}

function editorHeader(): Record<string, string> {
  return editorPassword ? { 'X-Editor-Password': editorPassword } : {}
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return (await response.json()) as T
}

async function detail(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return typeof body?.detail === 'string' ? body.detail : response.statusText
  } catch {
    return response.statusText || `HTTP ${response.status}`
  }
}

/** The source PDF, opened in a new browser tab rather than fetched — but the URL still
 * belongs in the one file that knows the API shape. Same for the tiles, which arrive as
 * `<img src>` and never touch `fetch` either. */
export const SOURCE_URL = `${API}/source`
export const tileUrl = (file: string) => `${API}/tiles/${encodeURIComponent(file)}`

export const getHealth = () => getJson<Health>('/health')
export const getDrawing = () => getJson<DrawingSummary>('/drawing')
export const getDesignators = () => getJson<DesignatorIndex>('/designators')
/** How the user wants things said aloud (`talkthrough_03.md` §5). Open to read. */
export const getPronunciations = () => getJson<PronunciationLists>('/pronunciations')

/** Replace one pronunciation list whole. Needs the editor routes and, if set, its password. */
export async function putPronunciations(scope: PronunciationScope, entries: PronunciationEntry[]) {
  const response = await fetch(`${API}/pronunciations/${scope}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...editorHeader() },
    body: JSON.stringify({ entries }),
  })
  if (!response.ok) throw new ApiError(response.status, await detail(response))
  return (await response.json()) as { entries: PronunciationEntry[] }
}
/**
 * Where each traced wire runs, and which wires each net is made of.
 *
 * Free, like the drawing itself: a path comes out of `locations.json` rather than out of
 * `geometry.json`, and *which of these lines is the one I care about* is a reader's question
 * before it is an editor's. Its own call rather than a field on the designator index because it
 * changes when a different file is saved, and because a client that cannot load it loses the
 * highlight while every citation stays clickable.
 */
export const getPaths = () => getJson<PathIndex>('/paths')
export const getQuestions = () =>
  getJson<{ questions: StarterQuestion[] }>('/questions').then((r) => r.questions)

export interface AskArgs {
  question: string
  model: string
  sessionId: string | null
  signal: AbortSignal
  onEvent: (event: ServerEvent) => void
}

/**
 * POST a question and drive the NDJSON response.
 *
 * NDJSON over POST rather than SSE: `EventSource` is GET-only, and its automatic reconnect
 * would silently re-issue a paid question. Rather than a WebSocket, because v1 gains nothing
 * from connection lifecycle management.
 */
export async function ask({ question, model, sessionId, signal, onEvent }: AskArgs) {
  const response = await fetch(`${API}/ask`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(demoPassword ? { 'X-Demo-Password': demoPassword } : {}),
    },
    body: JSON.stringify({ question, model, session_id: sessionId }),
  })

  if (!response.ok) throw new ApiError(response.status, await detail(response))
  if (!response.body) throw new ApiError(500, 'The server sent no body.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // A chunk can split a line anywhere; keep the tail until its newline arrives.
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) emit(line, onEvent)
        newline = buffer.indexOf('\n')
      }
    }
    if (buffer.trim()) emit(buffer.trim(), onEvent)
  } finally {
    reader.releaseLock()
  }
}

function emit(line: string, onEvent: (event: ServerEvent) => void) {
  try {
    onEvent(JSON.parse(line) as ServerEvent)
  } catch {
    // A malformed line is not worth killing a two-minute answer over.
    console.warn('unparseable stream line', line.slice(0, 200))
  }
}

/**
 * Stop a running turn.
 *
 * Called *as well as* aborting the fetch, not instead of it. A `StreamingResponse` generator
 * only notices a dead socket when it next tries to yield, and a thinking model can be silent
 * for 30 s — so relying on disconnect detection alone would leave a paid request running.
 */
export async function cancelTurn(turnId: string) {
  try {
    await fetch(`${API}/turns/${encodeURIComponent(turnId)}/cancel`, { method: 'POST' })
  } catch {
    // The abort below is the backstop; a failed cancel is not worth surfacing.
  }
}
