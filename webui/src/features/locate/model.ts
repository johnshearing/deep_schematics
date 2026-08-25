/**
 * The editor's arithmetic, with no React and no `fetch` in it.
 *
 * Everything here is a pure function over the draft `locations.json` and the server's designator
 * index. That split is on purpose: what the editor *does* to the document is the part that can be
 * quietly wrong — a pin assigned to the wrong site, a point written under the wrong id, an
 * "advance" that skips the work still to do — and none of it can be asserted against through a
 * component tree.
 *
 * **This is not a second copy of `resolve_geometry`.** The server decides where anything *is*;
 * these functions answer a different and smaller question — what does the document the user is
 * editing say right now, before it has been saved and re-resolved. The one precedence rule below
 * (a terminal's own point beats the site that claims its pin) exists because the editor has to
 * show the user the effect of the click they just made, and it is stated once, here.
 */

import type {
  Compass,
  Designator,
  LocationsDocument,
  Place,
  Placement,
  StoredEndLabel,
  StoredSite,
} from '@/api/types'

/**
 * The schema this editor writes, and it is stamped onto the draft as it loads.
 *
 * Schema 2 only added the `labels` key to the wire and net sections, so a schema-1 file has no key
 * that needs converting — the migration *is* the version number, and it happens the next time
 * anything is saved. The server reads both and writes back either, so a browser holding a bundle
 * from before the bump keeps working rather than having every save silently refused.
 */
export const SCHEMA = 2

/**
 * What a row in the list is showing.
 *
 * `computed` is a net or a wire whose ends are known from its terminals and whose **printed name
 * has not been placed**. `labelled` is the same thing once somebody has said where that name is
 * written. Neither is ever `parent` or `seed`: nothing estimates a label.
 *
 * The word the row shows for `computed` used to be *"route from its terminals"*, and it is not
 * that any more — a route is either lifted from the PDF's own conductor strokes or traced by a
 * person, and "computed from the terminals" is the one thing it may never be. See §3 of
 * `_claude_notes/highlighting_wires_and_nets.md`.
 */
export type RowState = Placement | 'computed' | 'labelled' | 'none'

/** Which designator the next click on the sheet places. */
export interface Target {
  id: string
  /** Null for a terminal, which has no sites; a site id for a component. */
  site: string | null
  /** True when what is being placed is a wire's or net's **label**, which is the only thing
   * either of them has to place. Mutually exclusive with `site`. */
  label?: boolean
}

/** Who is signing this point, and when. Passed in rather than read from the clock inside these
 * functions so the tests are not racing a timestamp. */
export interface Stamp {
  by: string | null
  at: string
}

/**
 * The two kinds whose **position** a human places.
 *
 * A wire's route is its two endpoint terminals and a net's is its members, so placing terminals
 * gives all 71 wires their paths for free and there is nothing about a wire's *position* to
 * place. What a wire does have is a name printed somewhere — see `LABELLABLE`.
 */
export const PLACEABLE = new Set(['component', 'terminal'])

/**
 * The two kinds whose **label position** a human places, and nothing else.
 *
 * Kept apart from `PLACEABLE` because the two are not the same obligation. A terminal with no
 * point is missing data and the drawing is incomplete without it. A wire with no label point is
 * merely unpolished: every citation of it still frames the right run. So they are counted
 * separately and the "To do" filter does not include them — a progress number that can never be
 * finished is worse than no number.
 */
export const LABELLABLE = new Set(['wire', 'net'])

export const DEFAULT_SITE = 'main'

export function emptyDocument(
  drawingNumber: string | null,
  pageSize: [number, number] | null,
): LocationsDocument {
  return {
    drawing_number: drawingNumber,
    schema: SCHEMA,
    page_size_pt: pageSize,
    components: {},
    terminals: {},
    wires: {},
    nets: {},
  }
}

/** Which section of the file a wire or net label lives in. Two sections rather than one because
 * a person reads this file, and `"wires"` beside `"nets"` is how they would have written it. */
function labelSection(kind: string): 'wires' | 'nets' {
  return kind === 'net' ? 'nets' : 'wires'
}

/** The stored label for a wire or net, from whichever section holds it. Looked up in both,
 * because the list row knows the id long before it cares which kind it is. */
export function storedLabel(document: LocationsDocument, identifier: string) {
  return document.wires?.[identifier] ?? document.nets?.[identifier]
}

/**
 * The end-label decisions the draft holds for this wire or net, keyed by terminal id.
 *
 * Empty is the normal answer and is not a gap: every end has a label, at the side
 * `features/drawing/endLabels.ts` computes from points that already exist. This is only the
 * exceptions, which is what keeps 269 end labels from being 269 rows of work.
 */
export function endLabelsOf(
  document: LocationsDocument,
  identifier: string,
): Record<string, StoredEndLabel> {
  return storedLabel(document, identifier)?.labels ?? {}
}

/**
 * Record a decision about one end label, or **delete it** — which is what *Reset to default* does.
 *
 * `next` of `null`, or of anything that normalises to nothing, removes the override. That is the
 * one rule in here worth stating twice: storing the side the rule would have computed anyway makes
 * the file stop distinguishing *nobody has looked at this* from *a person decided this*, and that
 * distinction is the whole reason `locations.json` exists. So `hidden: false` is stripped rather
 * than written, and a record left with no `labels` and no `label_point` is dropped entirely rather
 * than left behind as an empty shell.
 *
 * No `by`/`at` stamp, deliberately, and it is the only authored thing here without one: a side is
 * a presentational choice about a point somebody else already signed for, not a claim about where
 * anything *is*. The `by` on the terminal's point is the claim, and it is untouched.
 */
export function setEndLabel(
  document: LocationsDocument,
  identifier: string,
  kind: string,
  terminal: string,
  next: StoredEndLabel | null,
): LocationsDocument {
  const section = labelSection(kind)
  const existing = document[section]?.[identifier]
  const labels = { ...existing?.labels }

  const cleaned: StoredEndLabel = {
    ...(next?.dir ? { dir: next.dir } : {}),
    ...(next?.hidden ? { hidden: true } : {}),
  }
  if (Object.keys(cleaned).length) labels[terminal] = cleaned
  else delete labels[terminal]

  const record = { ...existing }
  if (Object.keys(labels).length) record.labels = labels
  else delete record.labels

  const kept = { ...document[section] }
  if (Object.keys(record).length) kept[identifier] = record
  else delete kept[identifier]
  return { ...document, [section]: kept }
}

// -- reading the draft ---------------------------------------------------------------------

export function sitesOf(document: LocationsDocument, componentId: string): StoredSite[] {
  const sites = document.components?.[componentId]?.sites
  return Array.isArray(sites) ? sites : []
}

/** The site that claims this pin, or null. First claim wins, which is the server's rule too; a
 * pin claimed twice is reported by the server rather than arbitrated here. */
export function siteClaiming(
  document: LocationsDocument,
  componentId: string,
  pin: string,
): StoredSite | null {
  return sitesOf(document, componentId).find((site) => site.terminals?.includes(pin)) ?? null
}

/**
 * What the draft says about one designator, or `null` where it says nothing.
 *
 * Deliberately silent about the server's fallbacks: this answers "has the user placed this
 * yet", and a `parent` point is precisely the absence of an answer.
 */
export function draftPlacement(
  document: LocationsDocument,
  entry: Designator,
): Placement | null {
  if (entry.kind === 'component') {
    const sites = sitesOf(document, entry.id)
    if (!sites.length) return null
    return sites.some((site) => site.source === 'human') ? 'confirmed' : 'seed'
  }
  if (entry.kind === 'terminal') {
    const own = document.terminals?.[entry.id]
    if (own?.point) return own.source === 'human' ? 'confirmed' : 'seed'
    const [componentId, pin] = splitTerminal(entry.id)
    const site = pin ? siteClaiming(document, componentId, pin) : null
    if (site?.point) return site.source === 'human' ? 'confirmed' : 'seed'
  }
  // Deliberately says nothing about a wire or a net. Those have no placement — only a label,
  // which `rowState` reports and which is not the same obligation. Answering `confirmed` here
  // would quietly enrol 97 optional labels into `coverage()` and `nextUnplaced()`.
  return null
}

/** What the row shows: the draft where it has something to say, the server's answer otherwise. */
export function rowState(document: LocationsDocument, entry: Designator): RowState {
  if (LABELLABLE.has(entry.kind)) {
    const placed =
      isPoint(storedLabel(document, entry.id)?.label_point) || Boolean(entry.label_point)
    return placed ? 'labelled' : entry.point ? 'computed' : 'none'
  }
  if (!PLACEABLE.has(entry.kind)) return entry.point ? 'computed' : 'none'
  return draftPlacement(document, entry) ?? entry.placement ?? 'none'
}

/**
 * The dots the editor draws, which are the draft's own points where it has them and the
 * server's resolved ones everywhere else.
 *
 * Draft beats server because the server has not seen the last click yet — that is a rule about
 * staleness, not about geometry, and it disappears the moment a save round-trips.
 */
export function editorPlaces(document: LocationsDocument, entry: Designator): Place[] {
  if (LABELLABLE.has(entry.kind)) {
    // One dot for the name, or none at all. **Not** the run's midpoint: a dot at the centroid of
    // a wire would sit on blank paper and claim to be the wire, which is the whole reason
    // `label_point` is a separate field from `point`.
    const stored = storedLabel(document, entry.id)
    if (isPoint(stored?.label_point)) {
      return [
        { point: stored.label_point, placement: 'confirmed', label_dir: stored.label?.dir },
      ]
    }
    return entry.label_point
      ? [{ point: entry.label_point, placement: 'confirmed', label_dir: entry.label_dir }]
      : []
  }
  if (entry.kind === 'component') {
    const sites = sitesOf(document, entry.id).filter((site) => isPoint(site.point))
    if (sites.length) {
      return sites.map((site) => ({
        point: site.point,
        placement: site.source === 'human' ? 'confirmed' : 'seed',
        site: site.id,
        label_dir: site.label?.dir,
      }))
    }
  }
  if (entry.kind === 'terminal') {
    const own = document.terminals?.[entry.id]
    if (isPoint(own?.point)) {
      return [
        {
          point: own.point,
          placement: own.source === 'human' ? 'confirmed' : 'seed',
          label_dir: own.label?.dir,
        },
      ]
    }
    const [componentId, pin] = splitTerminal(entry.id)
    const site = pin ? siteClaiming(document, componentId, pin) : null
    if (site && isPoint(site.point)) {
      return [
        {
          point: site.point,
          placement: site.source === 'human' ? 'confirmed' : 'seed',
          site: site.id,
          label_dir: site.label?.dir,
        },
      ]
    }
  }
  // Nothing in the draft, so whatever the server resolved — including a `parent` point, which
  // is exactly the thing the user is here to replace and therefore has to be visible.
  if (!entry.point) return []
  return entry.places?.length
    ? entry.places
    : [{ point: entry.point, placement: entry.placement ?? 'seed' }]
}

/**
 * The point **this target's own record in the draft** holds, or null.
 *
 * Deliberately not `editorPlaces`, which falls back to the server's resolved answer — a site
 * claiming the pin, or the parent component's point flagged `parent`. A nudge is a correction to
 * something a person put somewhere, and nudging an estimate would silently turn *"we guessed
 * `CR-BP:12` is at the coil"* into *"a human confirmed it is 1 pt from the coil"*, which is the
 * one kind of lie this whole file exists to prevent. So the keyboard moves what the draft owns,
 * and placing something that is not placed yet stays a click.
 */
export function draftPoint(
  document: LocationsDocument,
  target: Target,
): [number, number] | null {
  if (target.label) {
    const stored = storedLabel(document, target.id)
    return isPoint(stored?.label_point) ? stored.label_point : null
  }
  if (target.site === null) {
    const own = document.terminals?.[target.id]
    return isPoint(own?.point) ? own.point : null
  }
  const site = sitesOf(document, target.id).find((entry) => entry.id === target.site)
  return isPoint(site?.point) ? site.point : null
}

/**
 * The header line. Only components and terminals count as work: counting the 97 nets and wires as
 * outstanding would put a number on the screen that can never be finished.
 *
 * **Nothing here counts label points, and that is deliberate.** It used to read
 * *"0 of 97 wire and net labels"*, which is a progress bar over something optional — the shape of
 * `K7`, the *"To do"* filter that can never reach zero. An absent `label_point` is not missing
 * data: every citation of that wire already frames the right run. So the wires and the nets are
 * reported as what they are, a count of things in the index, and the only *authored* number here is
 * how many end labels a person has moved or hidden out of the 269 that draw themselves.
 */
export function coverage(entries: Designator[], document: LocationsDocument) {
  const placeable = entries.filter((entry) => PLACEABLE.has(entry.kind))
  const confirmed = placeable.filter(
    (entry) => draftPlacement(document, entry) === 'confirmed',
  ).length
  const sections = [document.wires ?? {}, document.nets ?? {}]
  return {
    placeable: placeable.length,
    confirmed,
    remaining: placeable.length - confirmed,
    wires: entries.filter((entry) => entry.kind === 'wire').length,
    nets: entries.filter((entry) => entry.kind === 'net').length,
    /** End-label overrides in the draft — decisions, not labels. */
    authored: sections.reduce(
      (total, section) =>
        total +
        Object.values(section).reduce(
          (count, record) => count + Object.keys(record.labels ?? {}).length,
          0,
        ),
      0,
    ),
  }
}

/**
 * The next thing to place, in list order, wrapping once.
 *
 * Wrapping matters more than it looks: a run of placements that stops dead at the end of the
 * list makes the user go back and hunt for the ones they skipped, which is exactly the auditing
 * work this editor exists to avoid.
 */
export function nextUnplaced(
  entries: Designator[],
  document: LocationsDocument,
  afterId: string | null,
): Designator | null {
  const todo = entries.filter(
    (entry) => PLACEABLE.has(entry.kind) && draftPlacement(document, entry) !== 'confirmed',
  )
  if (!todo.length) return null
  const start = afterId ? entries.findIndex((entry) => entry.id === afterId) : -1
  return todo.find((entry) => entries.indexOf(entry) > start) ?? todo[0]
}

// -- writing the draft ---------------------------------------------------------------------

/**
 * Put a point somewhere. The one entry point the click, the drag and the keyboard all use, so
 * there is one place where "what does placing mean" is decided.
 */
export function place(
  document: LocationsDocument,
  target: Target,
  point: [number, number],
  stamp: Stamp,
  /** Only consulted for a label, and only to pick which section of the file it lands in. */
  kind = 'wire',
): LocationsDocument {
  if (target.label) return setLabelPoint(document, target.id, kind, point, stamp)
  return target.site === null
    ? setTerminalPoint(document, target.id, point, stamp)
    : setSitePoint(document, target.id, target.site, point, stamp)
}

/** Where a wire's or net's name is written. Never where the wire goes — see `LABELLABLE`. */
export function setLabelPoint(
  document: LocationsDocument,
  identifier: string,
  kind: string,
  point: [number, number],
  stamp: Stamp,
): LocationsDocument {
  const section = labelSection(kind)
  const existing = storedLabel(document, identifier)
  const { point: label_point, ...signature } = signed(point, stamp)
  return {
    ...document,
    [section]: { ...document[section], [identifier]: { ...existing, label_point, ...signature } },
  }
}

export function setSitePoint(
  document: LocationsDocument,
  componentId: string,
  siteId: string,
  point: [number, number],
  stamp: Stamp,
): LocationsDocument {
  const existing = sitesOf(document, componentId)
  const found = existing.some((site) => site.id === siteId)
  const sites = found
    ? existing.map((site) => (site.id === siteId ? { ...site, ...signed(point, stamp) } : site))
    : [...existing, { id: siteId, terminals: [], ...signed(point, stamp) }]
  return withComponent(document, componentId, sites)
}

export function setTerminalPoint(
  document: LocationsDocument,
  terminalId: string,
  point: [number, number],
  stamp: Stamp,
): LocationsDocument {
  const existing = document.terminals?.[terminalId]
  return {
    ...document,
    terminals: {
      ...document.terminals,
      [terminalId]: { ...existing, ...signed(point, stamp) },
    },
  }
}

/**
 * A name for a component's next site that is not one of its current ones.
 *
 * The site is **not** written into the document here. A site with no point would be refused by
 * the server's per-field validation and reported as a problem, so "add a site" is a state of the
 * editor — the next click on the sheet creates it — rather than a state of the file. The file
 * only ever holds sites that are somewhere.
 */
export function nextSiteId(document: LocationsDocument, componentId: string): string {
  const taken = new Set(sitesOf(document, componentId).map((site) => site.id))
  if (!taken.has(DEFAULT_SITE)) return DEFAULT_SITE
  for (let n = 2; ; n += 1) {
    const candidate = `site-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export function removeSite(
  document: LocationsDocument,
  componentId: string,
  siteId: string,
): LocationsDocument {
  return withComponent(
    document,
    componentId,
    sitesOf(document, componentId).filter((site) => site.id !== siteId),
  )
}

/**
 * Whether this name can be committed: something after trimming, and not one of the component's
 * *other* sites.
 *
 * Exported so the input box can say *why* a name was refused instead of silently reverting. The
 * rule lives here, once, and `renameSite` asks the same question — a panel that decided for itself
 * what was acceptable would eventually disagree with the function that does the renaming.
 */
export function canRenameSite(
  document: LocationsDocument,
  componentId: string,
  siteId: string,
  next: string,
): boolean {
  const trimmed = next.trim()
  if (!trimmed) return false
  if (trimmed === siteId) return true
  return !sitesOf(document, componentId).some((site) => site.id === trimmed)
}

export function renameSite(
  document: LocationsDocument,
  componentId: string,
  siteId: string,
  next: string,
): LocationsDocument {
  const trimmed = next.trim()
  const sites = sitesOf(document, componentId)
  if (!trimmed || sites.some((site) => site.id === trimmed)) return document
  return withComponent(
    document,
    componentId,
    sites.map((site) => (site.id === siteId ? { ...site, id: trimmed } : site)),
  )
}

/**
 * Assign a pin to a site, or take it off one.
 *
 * **Explicit, never inferred from the pin's function.** `CR-BP` has two terminals whose function
 * is `common` — `11` and `21` — drawn in different circuits, so no heuristic over `function` can
 * tell them apart, and a system that guessed would put half a relay in the wrong place with no
 * way for anyone to notice. A pin is removed from any other site first: two sites both claiming
 * it is a human error the server reports, and it is cheaper never to create.
 */
export function assignTerminal(
  document: LocationsDocument,
  componentId: string,
  siteId: string,
  pin: string,
  on: boolean,
): LocationsDocument {
  return withComponent(
    document,
    componentId,
    sitesOf(document, componentId).map((site) => {
      const without = (site.terminals ?? []).filter((name) => name !== pin)
      if (site.id !== siteId) return { ...site, terminals: without }
      return { ...site, terminals: on ? [...without, pin] : without }
    }),
  )
}

export function setLabelDir(
  document: LocationsDocument,
  target: Target,
  dir: Compass | null,
): LocationsDocument {
  const label = dir ? { dir } : undefined
  if (target.label) {
    const section: 'wires' | 'nets' = document.nets?.[target.id] ? 'nets' : 'wires'
    const existing = storedLabel(document, target.id)
    if (!existing) return document
    return {
      ...document,
      [section]: { ...document[section], [target.id]: { ...existing, label } },
    }
  }
  if (target.site === null) {
    const existing = document.terminals?.[target.id]
    if (!existing) return document
    return {
      ...document,
      terminals: { ...document.terminals, [target.id]: { ...existing, label } },
    }
  }
  return withComponent(
    document,
    target.id,
    sitesOf(document, target.id).map((site) =>
      site.id === target.site ? { ...site, label } : site,
    ),
  )
}

/** Take a placement back. Emptying the last site removes the component from the file entirely,
 * so an untouched drawing's `locations.json` stays empty rather than filling with `{sites: []}`
 * for everything anyone ever clicked on. */
export function clear(document: LocationsDocument, target: Target): LocationsDocument {
  if (target.label) {
    const section: 'wires' | 'nets' = document.nets?.[target.id] ? 'nets' : 'wires'
    const kept = { ...document[section] }
    // Only the printed name's position goes. The end-label decisions in the same record are
    // answers to a different question — which way each end's label faces — and taking them away
    // as a side effect of *Remove the label point* would silently undo work nobody asked about.
    const rest = { ...kept[target.id] }
    for (const key of ['label_point', 'source', 'by', 'at', 'label'] as const) delete rest[key]
    if (Object.keys(rest).length) kept[target.id] = rest
    else delete kept[target.id]
    return { ...document, [section]: kept }
  }
  if (target.site === null) {
    const terminals = { ...document.terminals }
    delete terminals[target.id]
    return { ...document, terminals }
  }
  return removeSite(document, target.id, target.site)
}

function withComponent(
  document: LocationsDocument,
  componentId: string,
  sites: StoredSite[],
): LocationsDocument {
  const components = { ...document.components }
  if (sites.length) components[componentId] = { ...components[componentId], sites }
  else delete components[componentId]
  return { ...document, components }
}

function signed(point: [number, number], stamp: Stamp) {
  return {
    // Rounded to a tenth of a point. The sheet's conductor rows are 16 pt apart and its
    // lettering is 4 pt tall, so the tenth is already finer than anything on the drawing —
    // and it keeps a hand-editable file from filling up with 348.30000000000007.
    point: [round(point[0]), round(point[1])] as [number, number],
    source: 'human' as const,
    ...(stamp.by ? { by: stamp.by } : {}),
    at: stamp.at,
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

export function splitTerminal(terminalId: string): [string, string | null] {
  const colon = terminalId.indexOf(':')
  return colon < 0
    ? [terminalId, null]
    : [terminalId.slice(0, colon), terminalId.slice(colon + 1)]
}

function isPoint(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  )
}
