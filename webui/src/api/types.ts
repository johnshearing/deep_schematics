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
  /**
   * Which side of this end's dot its **end label** sits on, where a person chose one.
   *
   * Absent is not missing data. Every wire end and every net terminal has an end label, and its
   * side is computed by `features/drawing/endLabels.ts` from points that already exist — away
   * from the wire's other end, away from the net's centroid. The file stores only the exceptions,
   * so absent means *the computed default*, which is the state of nearly all 269 of them.
   */
  label_dir?: Compass
  /** True where a person hid this one end label. Never written as `false`: an override that says
   * nothing is refused by the server, because it would stop the file distinguishing a decision
   * from a default. */
  hidden?: boolean
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
  /**
   * A wire's colour and gauge as printed — `BLUE 18AWG`. Wires only, and absent for the two on
   * this drawing that have neither.
   *
   * This is what an **end label** says, and the reason is `on_sheet`: every `W###` is an id the
   * extraction invented, so a label reading `W052` would name something the reader cannot find
   * anywhere on the paper in front of them. The spec is the thing that *is* written beside the
   * conductor, and it is what a technician checks with their eyes.
   */
  spec?: string
  /**
   * A net's name **as the sheet prints it** — `PB1` for `NET-PB1`. Nets only, and absent for the
   * 24 of 26 whose id is what is printed.
   *
   * The net-side twin of `spec`, and it exists for the same reason: the id we index by is not
   * always a word the reader can find on the paper. `NET-PB1` and `NET-PB2` were renamed during
   * extraction because the sheet also has a *push button* called `PB1`, and the rename was right —
   * two things may not share an id. That is `K10`, and it costs two things: an end label saying a
   * word nobody can find, and — until this field existed — two nets of 26 that Phase E's
   * `candidates()` could never match to a printed conductor, because it compares against the net's
   * name and theirs is not the one on the ink. It compares against **both** forms now.
   */
  printed?: string
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
  /** How many end labels a person has **moved or hidden** — not how many there are, which is one
   * per wire end and per net terminal whether anybody has touched it or not. Absent on a server
   * older than schema 2. */
  end_labels?: number
  /** Wires with a traced route, and wires somebody has looked at and found nothing to trace.
   * Two counts because they are two claims, and the second is what lets the first ever reach 71
   * — six of this drawing's rows are not on this sheet at all. */
  paths?: number
  no_path?: number
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
 * One run of a wire's path: two or more points in PDF points, along the printed conductor.
 *
 * **Never computed.** A route is lifted from the PDF's own vector strokes or traced by a person,
 * and a straight chord between a wire's two endpoints is the one thing it may not be — on this
 * sheet `W052`'s chord is a 600 pt diagonal across four unrelated circuits, while the ink is one
 * horizontal run 78 pt long.
 */
export type Polyline = [number, number][]

/**
 * Where one wire runs, and the two axes that say how we know it.
 *
 * `geometry` is where the line came from — `extracted` is a conductor out of `geometry.json`,
 * which is the PDF's own strokes rather than a reading of them; `human` is a person tracing it
 * corner by corner. `attribution` is who says this run belongs to *this* wire — `printed` is the
 * net name beside it matching, `human` is a person saying so. A lifted conductor is exact
 * geometry with uncertain attribution, and that pair is what a human is confirming.
 *
 * `runs` is a list because a crossover hop is a real gap in the ink — this sheet has 88 of them —
 * and a path spanning one should show the gap rather than close it.
 */
export interface WirePath {
  runs: Polyline[]
  geometry: 'extracted' | 'human'
  attribution: 'printed' | 'human'
  /** The extracted runs it was lifted from. **Absent on a hand trace**, and that absence is the
   * record: there was no conductor to lift. */
  conductors?: string[]
}

/**
 * `GET /api/paths` — the highlight, in two maps.
 *
 * `wires` holds only the wires somebody has traced; a wire with no path is **absent**, not null.
 * `nets` is every net's wires, whether or not any of them is traced, because **a net stores no
 * path of its own**: its highlight is the union of its wires' runs. That is also what lets a net
 * say *none of my four wires has a path yet* instead of drawing nothing and reading as broken.
 */
export interface PathIndex {
  wires: Record<string, WirePath>
  nets: Record<string, string[]>
}

/**
 * One end of a run of ink, and what the extraction bound it to.
 *
 * `symbol` is one of the sheet's 88 `terminal_point` circles — where ink meets a pin — and it is
 * **not** one of the netlist's terminals. Mistaking the two was the hardest-won lesson of the
 * extraction, so the id is published only so that two runs meeting at one dot can be recognised
 * as meeting; it names nothing a person can look up. Absent where the end lands on nothing, or on
 * a device circle, which is a symbol and not a junction.
 */
export interface ConductorEnd {
  /** Where the extraction thought the run ends. Published rather than inferred from the first or
   * last vertex: they agree for all 149 runs on this sheet, and assuming that would be assuming
   * one drawing. */
  point: [number, number] | null
  symbol?: string
  /** How far the end is from that symbol, in points. Every measured pairing in
   * `07_drawing_facts.md` is within 4 pt at both ends, against conductor rows 16 pt apart — which
   * is why this is the strongest signal `candidates()` has. */
  distance?: number
}

/**
 * One candidate run of ink, reduced to what tracing a wire needs — `GET /api/conductors`.
 *
 * **Behind the editor password, and `GET /api/paths` deliberately is not.** They look like a pair
 * and they are opposites: a path is *authored display geometry* and a reader is exactly who wants
 * it, while this is the raw ink — 149 polylines out of a 608 KB file — and it is no use to
 * somebody who cannot accept one of them into an authored file. Hazard `H20`.
 */
export interface Conductor {
  id: string
  /** The shape, corner by corner. **This is the field the route exists for**: it is what gets
   * accepted into `path.runs`, and a candidate offering only its two ends would let a wire be
   * highlighted along a chord between two corners — the invented route §3 forbids. */
  points: Polyline
  /** One per endpoint, in endpoint order. */
  ends: ConductorEnd[]
  /**
   * What the run reads **now**, with every Phase F correction applied — the string a wire's net id
   * is compared against.
   *
   * Absent where it reads nothing: 79 runs never had a name bound, and a reading somebody called
   * *not a label* is dropped rather than published, because a matcher must not compare against a
   * string a person said was not a name.
   */
  net_label?: string
  /** The extraction's own binding, **only where a person changed it**, so the panel can say
   * *corrected* rather than *printed*. It is also the thing a re-extraction destroys. */
  was?: string
  /** `BLUE 18AWG`, as printed. The strong form of the second signal: a wire's `spec` is the same
   * string. */
  spec_label?: string
  /** The halves, so a run whose colour matches while its gauge does not can be ranked **below** an
   * exact match rather than dropped out of the list. */
  color?: string
  gauge?: string
  /** Length along the polyline, in points. What keeps the 46 strokes under 15 pt — slanted bars of
   * contact symbols the tracer collected — from out-ranking real wiring. */
  length?: number
}

export interface ConductorIndex {
  counts: { conductors: number; named: number }
  conductors: Conductor[]
  problems: string[]
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

/**
 * All a wire or a net may carry, and it is two different things.
 *
 * `label_point` is where its **name is written on the run** — the key is not `point` so nobody is
 * tempted to read it as the wire's location. `labels` is the side of each **end**'s label, keyed by
 * terminal id, and holds only the sides a person chose or hid: everything absent is at the side the
 * viewer computes, which is why 269 end labels cost nothing to keep. Both are optional and neither
 * implies the other — a record with only `labels` is a complete thing to say.
 */
export interface StoredLabel {
  label_point?: [number, number]
  /** Only meaningful beside a `label_point`, which is the only thing in this record a person
   * *places*. */
  source?: 'human' | 'seed'
  label?: { dir?: Compass }
  /** Terminal id → what a person decided about that end. */
  labels?: Record<string, StoredEndLabel>
  /** Where this wire runs — **wires only**. A net carrying one is refused by name, because its
   * highlight is the union of its wires' paths and a path stored here would never be drawn. */
  path?: WirePath & { by?: string; at?: string }
  /** *There is nothing on this sheet to trace* — a decision, and only ever `true`. Never written
   * as `false`, for the same reason `hidden: false` is refused. */
  no_path_on_this_sheet?: true
  by?: string
  at?: string
  [key: string]: unknown
}

/** One end label a person took a decision about. At least one of the two is present: an entry
 * with neither is refused by the server, so **Reset to default deletes rather than writes**. */
export interface StoredEndLabel {
  dir?: Compass
  hidden?: boolean
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

/**
 * One piece of ink whose reading might be wrong — a row of the Review tab.
 *
 * Two id spaces, one shape, because the question is the same one twice: *what does the ink say
 * here, and how sure are we?*
 *
 * - a **label** (`T0012`) is a string the OCR pass lifted off the sheet. Its reading is its text,
 *   and it has a confidence.
 * - a **conductor** (`C0008`) is a run of ink, and what the extractor tried to read *for* it is the
 *   net name printed beside it. That is a **binding** rather than a read, so it has no confidence,
 *   and for 79 of this drawing's 149 runs there is none at all — a blank, not a mistake.
 *
 * `geometry.json` is 608 KB and about 150,000 tokens. It never reaches this browser: `server/app/
 * ink.py` narrows it to named fields and `_reading` in `main.py` narrows it again to these, and a
 * server test pins the key set so a careless spread cannot widen it.
 */
export interface ReviewItem {
  id: string
  kind: 'label' | 'conductor'
  /** What the extraction settled on. Null where nothing was ever read or bound. */
  read: string | null
  /** What it says **now**, after any correction. Null means *not a label* where a person said so,
   * and *never read* where nothing was bound. */
  text: string | null
  /** 0–1 for a label. Null for a conductor — see above. */
  confidence: number | null
  /** True where the extractor put this on its own review queue: 278 of the 664 here. */
  flagged: boolean
  /** True where correcting this changes what some run's net name reads as: every conductor, and
   * the 70 labels a run's net name is lifted from. This is the set that unlocks the path matcher,
   * and so what the `Net labels` filter shows. */
  net_name: boolean
  /** What to frame on the sheet, in PDF points: a label's bbox, or the box a run's whole polyline
   * fits in. The same coordinate space as every marker and every tile — no registration step. */
  rect: [number, number, number, number] | null
  /**
   * A run only: its **polyline**, so the ring on the sheet follows the ink instead of the
   * rectangle the ink fits inside.
   *
   * 50 of this sheet's 149 runs bend, up to five segments, and the box round the two ends of a
   * three-segment L is a rectangle over a quarter of the drawing with a dozen unrelated
   * conductors crossing it — `C0002` exactly. Worse, for 19 of the 149 the box round the
   * endpoints does not even *contain* the run: `C0057` goes out to x = 798 while its ends span
   * x 429.8–598.9. Absent on a label, which is a box and has no shape of its own.
   */
  points?: Polyline
  /** The extractor's guess at what sort of string a label is — `net_number`, `wire_spec`,
   * `terminal_number`, `designator`, `voltage`, `text`, `note`, `empty`. A hint, never a filter. */
  label_kind?: string
  /** The raw OCR, **only where it differs** from what the extraction settled on: `POWER` against
   * the `P0WER` it chose. Absent means they agree, which is 485 of 515. */
  raw_ocr?: string
  /** A conductor's gaps, as the extractor names them: `net_label`, `spec_label`,
   * `unbound_endpoints:[0]`. */
  missing?: string[]
  /** The runs that read their net name from this label. One edit, several runs fixed. */
  conductors?: string[]
  /**
   * A run only: the **label** its reading now comes from, because somebody corrected that label.
   *
   * This is the link that makes one correction worth more than one row. The path matcher compares a
   * *run's* printed net name against a wire's net id, so correcting `T0012` from `LI-A` to `L1-A`
   * and leaving `C0030` still reading `LI-A` would fix a row on a screen and unlock nothing. Absent
   * when the run reads its own bound name, or a correction made on the run itself — which is the
   * more specific claim and wins.
   */
  via?: string
  /** Absent means **nobody has looked at this** — which the screen draws differently from a
   * correction that happens to agree with the machine. */
  correction?: StoredCorrection
}

/**
 * One reading a person has taken responsibility for.
 *
 * `text` is required and may be `null`, which is the *not a label* claim — seven of this sheet's 34
 * printed net names are partial reads of things that were never names, and no string says that.
 * An empty string is refused by name, because it would read as *"I looked and there is no text
 * here"*, which is a claim about the ink rather than about the item.
 *
 * `was` is what the reading replaced, kept forever: `geometry.json` is regenerated by a
 * re-extraction and would take the original with it.
 */
export interface StoredCorrection {
  text: string | null
  was?: string | null
  note?: string
  by?: string
  at?: string
  [key: string]: unknown
}

/**
 * `label_corrections.json` itself — the third authored file, as the review screen holds it.
 *
 * Not part of `locations.json`, and the three reasons are all in `server/app/label_corrections.py`:
 * a different id space, a different screen (so folding it in would widen the last-write-wins window
 * across two workflows), and a different claim — *what the ink says* against *where the thing is
 * drawn*.
 *
 * Modelled loosely for the same reason `LocationsDocument` is: the screen sends the whole document
 * back, so an unknown key must survive the round trip rather than be normalised away.
 */
export interface CorrectionsDocument {
  drawing_number: string | null
  schema: number
  labels: Record<string, StoredCorrection>
  [key: string]: unknown
}

/** How much of the ink there is, and how much of it the extractor doubted. */
export interface ReviewCounts {
  labels: number
  conductors: number
  flagged: number
  blank_labels: number
  conductors_without_a_net_name: number
  net_names: number
}

/** What `label_corrections.json` currently says, and everything either file refused. The ink's own
 * problems are folded in: from the screen's side they are the same news. */
export interface ReviewReport {
  file: boolean
  corrections: number
  /** `text: null` — *not a label*. */
  rejections: number
  /** A reading somebody checked and left alone. Kept, deliberately: nothing produces *a person
   * looked at this* but a person. */
  confirmations: number
  problems: string[]
}

export interface ReviewResponse {
  present: boolean
  document: CorrectionsDocument
  report: ReviewReport
  counts: ReviewCounts
  items: ReviewItem[]
}

export interface SaveReviewResponse {
  saved: boolean
  report: ReviewReport
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
