/**
 * The only place `fetch` appears.
 *
 * Everything is same-origin: in dev, Vite proxies `/api` to the server on 9700; in
 * production FastAPI serves the bundle under `/webui`. So there is no base URL to configure
 * and no CORS in the production path — which is also what lets the CSP say `connect-src
 * 'self'` and mean it.
 */

import type {
  DesignatorIndex,
  DrawingSummary,
  Health,
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
