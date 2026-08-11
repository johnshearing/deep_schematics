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
   * null when no source PDF sits beside the extraction — so both mean "no PDF link". */
  source?: { name: string; bytes: number; media_type: string } | null
  /** The rendered raster of that sheet. Null until the extraction has been tiled; absent on
   * an older server. Both mean "no Drawing tab". */
  tiles?: TileManifest | null
}

/** One tile of the rendered sheet. */
export interface Tile {
  file: string
  row: number | null
  col: number | null
  /**
   * `[x0, y0, x1, y1]` **in PDF points**, top-left origin.
   *
   * This is the project's one coordinate system: `components[].location{x,y}` (populated for
   * all 47) and every bbox and conductor polyline in `geometry.json` are in the same space.
   * So placing a marker on the drawing is the same arithmetic as placing a tile, with no
   * registration step in between.
   */
  pdf_rect: [number, number, number, number]
  /** Rendered size in pixels, or null if the manifest omitted it. */
  pixels: [number, number] | null
}

export interface TileManifest {
  /** `[width, height]` of the whole sheet, in points. */
  page_size_pt: [number, number]
  dpi: number | null
  rows: number | null
  cols: number | null
  count: number
  tiles: Tile[]
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
