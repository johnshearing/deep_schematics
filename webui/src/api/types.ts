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
  /** Whether this server was started with a Locate editor, and whether it wants its own
   * password for it. Absent on a server older than the editor, which reads as "no editor". */
  editing?: {
    enabled: boolean
    password_required: boolean
    /** A name to stamp into `locations.json` as `by`, if the server was given one. */
    by: string | null
  }
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

/**
 * What kinds of thing can be selected. A plain union rather than a string because these four
 * are the id spaces `circuit_logic.json` actually has — and because every future consumer of a
 * selection (net highlighting, the net explorer, guided troubleshooting) switches on it.
 */
export type DesignatorKind = 'component' | 'terminal' | 'net' | 'wire'

/**
 * How well a point is known. A marker has to be able to say which of these it is: drawing a
 * guess exactly like a measurement is the failure this vocabulary exists to prevent.
 *
 * Three states, and there is deliberately no fourth. `confirmed` is a person in the Locate
 * editor; `seed` is the indexing pass's own vision estimate, which on this sheet is out by
 * about 11 pt against a 16 pt row pitch; `parent` is a terminal being shown at its component's
 * point because nobody has placed the pin. Nothing derives — see `server/app/locations.py`.
 */
export type Placement = 'confirmed' | 'seed' | 'parent'

/** The eight sides a label may sit on, relative to its dot. */
export type Compass = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

/** One of the places an identifier is drawn on the sheet. */
export interface Place {
  point: [number, number]
  placement: Placement
  /** The site it came from — `coil`, `nc`, `no` — absent for a terminal falling back to its
   * parent, and for a component with no placed sites. */
  site?: string
  /** Which side of the dot to write the id on. Absent means "the viewer's default", which is
   * east; it is only stored where a human moved one off a conductor. */
  label_dir?: Compass
}

/**
 * One terminal a wire or a net is **made of** — the members, not their parents.
 *
 * The distinction is the whole point of the field. A net's `members` are the parent *components*
 * of its terminals, and marking those was the fault: net 120's members include `CR2`, whose coil
 * sits in the right-hand column while `CR2:14` — the contact actually on the net — is 630 pt away
 * on the far left, and `TB-120:1/2/3` collapse into one component so seven members showed as five
 * dots. Each member carries its **own** `placement`, because a net of two confirmed pins and one
 * nobody has placed is three different claims.
 */
export interface EntryTerminal {
  id: string
  /** Null where the resolver found nothing at all: the roster says `nowhere` rather than
   * drawing a dot somewhere plausible. */
  point: [number, number] | null
  placement: Placement | null
  /** The site the point came from, when it came from one. */
  site?: string
}

/** One citable identifier, and where on the sheet it is. */
export interface Designator {
  id: string
  kind: DesignatorKind
  /** One human line: what it is, for a tooltip and for the popover heading. */
  label: string
  /** False when the extraction invented the id (`W047`, `TB-0V:7`, `RECEPT1:3`). The reader is
   * holding the sheet and will not find it there, so the UI has to say so. */
  on_sheet: boolean
  /**
   * The components it is drawn through, whether or not they have a location.
   *
   * On a net or a wire these are the **parents** of its terminals, which is a coarser fact than
   * it looks — read `terminals` for what the thing is actually made of.
   */
  members: string[]
  /** For a wire, `[from, to]`; for a net, every member terminal, in order and undeduped. Absent
   * on components and terminals, which are not made of anything. */
  terminals?: EntryTerminal[]
  /** Centre of `rect`, in PDF points. Null for the handful of ids with no location anywhere —
   * still citable, just not clickable. */
  point: [number, number] | null
  /** Bounding box of everywhere it is drawn, in PDF points. Equal to `point` for a single
   * place. */
  rect: [number, number, number, number] | null
  /**
   * Every distinct place this id is drawn, when there is more than one — a relay whose coil and
   * two contacts are in different circuits has three, each with its own site name and its own
   * provenance. **Absent for the single-place case**, which is 269 of 275 entries on this
   * drawing, so read it through `placesOf()` in `lib/designators.ts` rather than directly.
   */
  places?: Place[]
  /**
   * How well `point` is known, on components and terminals only — the things that get markers
   * and the only two kinds a human places. A net and a wire have no `placement` at all because
   * their geometry is their terminals': placing 131 terminals gives 71 wires their positions for
   * free, and there is nothing on a wire for a person to place. `parent` means this is the
   * *component's* point because the terminal has none of its own; `null` means nowhere at all.
   */
  placement?: Placement | null
  /**
   * Where the **name** is written on the sheet, for wires and nets only.
   *
   * Not geometry, and not the same thing as `point`: `rect` still frames the run from its two
   * endpoint terminals, because a wire's path is its endpoints' and drawing a line between them
   * would be inventing a route. This is where `BLUE 18AWG` is printed, so a citation of `W048`
   * can land on the text rather than on the midpoint of a rectangle. Absent until a person
   * places it, which is optional in a way a terminal's point is not.
   */
  label_point?: [number, number]
  /** Which side of `label_point` to write the id on. Absent means east. */
  label_dir?: Compass
  /** Other names for the same thing, components only. */
  aliases?: string[]
}

/** The state of `locations.json` for this drawing: how much a human has placed, and every
 * coordinate the server refused, so the Locate editor can show what still needs doing. */
export interface LocationsReport {
  file: boolean
  components: number
  sites: number
  confirmed_sites: number
  terminals: number
  confirmed_terminals: number
  /** Wire and net label positions. Counted apart from the rest because they are optional. */
  labels: number
  confirmed_labels: number
  problems: string[]
}

export interface DesignatorIndex {
  drawing_number: string | null
  counts: Partial<Record<DesignatorKind, number>>
  /** How many entries have a point. The rest are citable but not clickable. */
  located: number
  locations?: LocationsReport
  entries: Designator[]
}

/**
 * `locations.json` itself — the second authored file, as the editor holds it.
 *
 * The editor loads this document, mutates it and sends the whole thing back, so it is modelled
 * loosely on purpose: unknown keys are carried through untouched rather than normalised away, or
 * a `by`, an `at` or a field a later version adds would be silently deleted on the next save.
 * The server's `app/locations.py` is the one validator; this type is a convenience, not a
 * contract.
 */
export interface LocationsDocument {
  drawing_number: string | null
  schema: number
  page_size_pt: [number, number] | null
  components: Record<string, { sites: StoredSite[] }>
  terminals: Record<string, StoredPoint>
  /** Where each wire's name is written. **Never a route** — see `Designator.label_point`. */
  wires?: Record<string, StoredLabel>
  /** The same, for a net number written beside its conductor. */
  nets?: Record<string, StoredLabel>
  [key: string]: unknown
}

/** What the file records for one point, as opposed to what the API publishes for one. Only two
 * sources exist: a person, or the indexing pass's estimate. */
export interface StoredPoint {
  point: [number, number]
  source: 'human' | 'seed'
  label?: { dir?: Compass }
  by?: string
  at?: string
  [key: string]: unknown
}

/** One place a component is drawn, and the pins drawn there — **assigned explicitly**, never
 * inferred from a pin's function: `CR-BP` has two `common` terminals at different sites. */
export interface StoredSite extends StoredPoint {
  id: string
  terminals: string[]
}

/** All a wire or a net may carry: where its name is written. The key is `label_point` rather
 * than `point` so nobody is tempted to read it as the wire's location. */
export interface StoredLabel {
  label_point: [number, number]
  source: 'human' | 'seed'
  label?: { dir?: Compass }
  by?: string
  at?: string
  [key: string]: unknown
}

export interface LocationsResponse {
  present: boolean
  document: LocationsDocument
  report: LocationsReport
}

export interface SaveLocationsResponse {
  saved: boolean
  report: LocationsReport
  /** The banner: `circuit_logic.json` is behind until someone re-runs the generator. */
  stale: string
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
