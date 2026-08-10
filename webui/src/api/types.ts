/** The wire contract with `server/app`. Kept in one file so a server change has one place
 * to land on this side. */

export interface Health {
  ok: boolean
  version: string
  prompt_version: string
  claude: string
  drawing_dir: string
  drawing_dir_present: boolean
  models: string[]
  default_model: string
  anonymous_models: string[]
  password_required: boolean
  spend: {
    day: string
    spent_usd: number
    ceiling_usd: number
    remaining_usd: number
    exhausted: boolean
  }
  in_flight: number
  concurrency_limit: number
  sessions: number
}

export interface DrawingSummary {
  drawing_number: string | null
  title: string | null
  assembly: string | null
  date: string | null
  revision: string | null
  revision_note: string | null
  proprietary_notice: string | null
  notes: string[]
  references: string[]
  counts: Record<string, number>
  subsystems: { id: string; description: string; members: number }[]
  component_classes: Record<string, number>
  relationship_types: Record<string, number>
  artifacts: { name: string; bytes: number }[]
  /** The sheet the netlist was extracted from. Absent on a server older than this field, and
   * null when no source PDF sits beside the extraction — so both mean "no viewer". */
  source?: { name: string; bytes: number; media_type: string } | null
}

export interface StarterQuestion {
  id: string
  text: string
  note: string
  kind: 'model' | 'deterministic'
}

/** One line of the `/api/ask` NDJSON stream. */
export type ServerEvent =
  | { t: 'start'; turn_id: string; session_id: string; model: string }
  | { t: 'init'; claude_session_id: string | null; model: string | null; tools: string[] }
  | { t: 'tool'; id: string | null; name: string; detail: string }
  | { t: 'tool_result'; id: string | null; ok: boolean }
  | { t: 'text'; d: string }
  | { t: 'status'; s: string }
  | { t: 'heartbeat' }
  | { t: 'denial'; tool: string | null; input: unknown }
  | {
      t: 'done'
      cancelled: boolean
      cost_usd: number
      duration_ms: number
      num_turns: number
      is_error: boolean
      /** Set when the turn ended in an error the model could not report itself. */
      error: string | null
      denials: number
      session_cost_usd?: number
      daily_spend_usd?: number
      daily_ceiling_usd?: number
    }
  | { t: 'error'; code: string; message: string }
