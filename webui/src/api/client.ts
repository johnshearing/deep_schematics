/**
 * The only place `fetch` appears.
 *
 * Everything is same-origin: in dev, Vite proxies `/api` to the server on 9700; in
 * production FastAPI serves the bundle under `/webui`. So there is no base URL to configure
 * and no CORS in the production path — which is also what lets the CSP say `connect-src
 * 'self'` and mean it.
 */

import type {
  CorrectionsDocument,
  DesignatorIndex,
  DrawingSummary,
  Health,
  LocationsDocument,
  LocationsResponse,
  ReviewResponse,
  SaveLocationsResponse,
  SaveReviewResponse,
  ServerEvent,
  StarterQuestion,
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
