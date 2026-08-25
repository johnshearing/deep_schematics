/**
 * The Locate tab — where a person says where things are, and the machine stops guessing.
 *
 * ### Why this exists at all
 *
 * `components[].location` came out of a vision pass and is approximate everywhere: screened
 * against every wire endpoint, terminal dot and junction in `geometry.json`, its median error on
 * this sheet is 11 pt, with 17 components over 15 pt out. Conductor rows here are **16 pt
 * apart**, so "approximate" means "wrong row", and a dot on the wrong row is not a small error —
 * it names a different circuit.
 *
 * The alternative to this screen was a better guesser, and it was built and rejected. At that
 * accuracy a proposal has to be audited, auditing costs about what placing costs, and it costs
 * *more* whenever the proposal is confidently wrong, because first you have to notice. So:
 * **Claude gets its one chance to guess when the schematic is indexed, and after that a human
 * owns the positions.** Effort goes into making placement fast rather than into guessing well.
 * 131 terminals at three seconds a click is under seven minutes, and a fast editor never lies to
 * you.
 *
 * ### The shape of the screen
 *
 * List on the left, the same tile viewer as the Drawing tab on the right. Pick a row, click the
 * sheet, it saves and moves to the next thing that needs placing. Drag any dot that is visibly in
 * the wrong spot. Everything is written to `locations.json` — the second authored file, beside
 * `author_circuit_logic.py` — and nothing is written to `circuit_logic.json`, which stays fully
 * generated. That is why the banner appears after the first save: the viewer is current
 * immediately, the artifact the model reads is not, and re-running the generator is a human's
 * job at a terminal rather than something a web request should start.
 *
 * ### Two things this deliberately does not do
 *
 * It does not propose coordinates, and it does not synthesise geometry. A straight line drawn
 * between two component points because no conductor joined them would be an invented wire route,
 * and the netlist's authority rests on never having invented one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Crosshair, Lock, Map, Maximize2, Minus, Plus, Save } from 'lucide-react'

import type { Designator, LocationsDocument, Place } from '@/api/types'
import { DesignatorList } from '@/components/DesignatorList'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { planEndLabels } from '@/features/drawing/endLabels'
import { MarkerLayer } from '@/features/drawing/MarkerLayer'
import { cssToPoint } from '@/features/drawing/paint'
import { TileSheet } from '@/features/drawing/TileSheet'
import {
  FOCUS_ZOOM,
  useTileViewport,
  type Rect,
  type Viewport,
} from '@/features/drawing/useTileViewport'
import { isTextField } from '@/lib/keys'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useLocateStore } from '@/stores/locateStore'
import { LOCATE_TAB_ID } from '@/tabIds'
import {
  coverage,
  draftPoint,
  editorPlaces,
  endLabelsOf,
  LABELLABLE,
  nextSiteId,
  nextUnplaced,
  PLACEABLE,
  place as placeInto,
  rowState,
  splitTerminal,
  type Target,
} from './model'
import { TargetPanel } from './TargetPanel'

export { LOCATE_TAB_ID }

/**
 * **`Wires` and `Nets` are two filters, not one.**
 *
 * They were `Wire & net labels`, one button over 97 rows, which was right while the only thing
 * either of them could carry was a printed name. It is not right now that each end of a wire and
 * each terminal of a net has a label of its own: a wire has exactly two ends and its panel is a
 * pair of compasses, while a net has up to nine members and its panel is a list — different work,
 * done in different sittings, and finding one among the other 96 rows was the cost of the merge.
 */
type Filter = 'todo' | 'components' | 'terminals' | 'wires' | 'nets' | 'all'

const FILTERS: { id: Filter; label: string; title: string }[] = [
  { id: 'todo', label: 'To do', title: 'Components and terminals nobody has placed yet' },
  { id: 'components', label: 'Components', title: 'All components' },
  { id: 'terminals', label: 'Terminals', title: 'All terminals' },
  {
    id: 'wires',
    label: 'Wires',
    title:
      'Both ends of every wire already carry a label, on the side that keeps it clear of its own ' +
      'run. Here you can move one, hide it, or say where the wire’s printed name sits.',
  },
  {
    id: 'nets',
    label: 'Nets',
    title:
      'The same, per member terminal: every net already labels each of its pins, and this is ' +
      'where you overrule one.',
  },
  { id: 'all', label: 'All', title: 'Everything in the index' },
]

/**
 * The zoom past which a flight is refused, as a percentage of native resolution — and refused
 * whole: neither the magnification nor the position moves.
 *
 * `FOCUS_ZOOM` is where a flight *lands*, so above it every flight is a zoom **out**. And past
 * it you are almost always at a magnification you chose on purpose, in order to work on one dot:
 * the marker is on screen, the pointer is next to it, and being *taken* to it is being taken away
 * from what you were doing — the sheet moves, the scale changes, and the gain is a centring you
 * did not need. Below the ceiling nothing changes at all, because that is the case the flight was
 * built for: the sheet fitted at 11%, the dot a speck somewhere off to one side.
 *
 * It is a *ceiling on the flight*, not a mode: the fly-to arithmetic, the framing rules and every
 * call site are untouched, and zooming back out to 50% or less makes them all work as before.
 */
const FLY_CEILING_PERCENT = Math.round(FOCUS_ZOOM * 100)

/**
 * Which way each arrow moves the armed point, in PDF points — y down, as the page is.
 *
 * **`Shift` is required and bare arrows still pan the sheet** (`useTileViewport`'s `onKeyDown`
 * declines the modified ones so the two cannot both fire). A key that silently means two things
 * depending on whether something is armed would be worse than a modifier: the moment you are
 * working on a dot is exactly the moment you also want to pan.
 */
const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/**
 * The step, **in points rather than pixels**, so a nudge is the same correction at 11% as at
 * 400%.
 *
 * A whole point against 16 pt conductor rows is a comfortable correction — a sixteenth of a row.
 * A tenth is exactly the precision `locations.json` records, so `Shift`+`Alt` is the finest thing
 * the file can say and there is no point offering anything smaller.
 */
const NUDGE_PT = 1
const FINE_NUDGE_PT = 0.1

export function LocateTab() {
  const drawing = useAppStore((s) => s.drawing)
  const health = useAppStore((s) => s.health)
  const designators = useAppStore((s) => s.designators)
  const activeTabId = useAppStore((s) => s.activeTabId)

  const {
    document,
    report,
    unlocked,
    loading,
    error,
    target,
    advance,
    saveState,
    saveError,
    stale,
    undoNote,
    load,
    setTarget,
    setAdvance,
    edit,
    endRun,
    place,
    setLabelDir,
    clear,
    undo,
    redo,
    save,
  } = useLocateStore()

  const tiles = drawing?.tiles ?? null
  const [width, height] = tiles?.page_size_pt ?? [1, 1]
  const viewer = useTileViewport({ width, height, dpi: tiles?.dpi ?? 400 })
  const [filter, setFilter] = useState<Filter>('todo')
  const [settled, setSettled] = useState<Record<string, boolean>>({})
  const onTileSettled = useCallback(
    (file: string, ok: boolean) => setSettled((current) => ({ ...current, [file]: ok })),
    [],
  )

  const needsPassword = health?.editing?.password_required ?? false
  const ready = Boolean(document)

  /** Load once, and only once the door is open. A server with no editor password opens on the
   * first visit; one with a password waits for it. */
  useEffect(() => {
    if (ready || loading) return
    if (needsPassword && !unlocked) return
    void load(drawing?.drawing_number ?? null, tiles?.page_size_pt ?? null)
  }, [ready, loading, needsPassword, unlocked, load, drawing?.drawing_number, tiles?.page_size_pt])

  /**
   * The index, **in alphabetical order by id**, and this is the order everything on the left uses.
   *
   * The server publishes the index grouped by kind, which is the order the extraction happened to
   * walk — 47 components, then 131 terminals, then the wires and nets. That is no order at all to
   * a person looking for one row among 275: `CR-BP` and its six pins sat a hundred rows apart. By
   * id they arrive together, because a terminal's id *is* its component's id plus its pin.
   *
   * Sorted here, once, rather than in the list component, so that it and `nextUnplaced` cannot
   * disagree: "the next one" has to mean the next one **down the list you are reading**, or the
   * advance looks like it is jumping at random.
   */
  const entries = useMemo(
    () => [...(designators?.entries ?? [])].sort((a, b) => BY_ID.compare(a.id, b.id)),
    [designators],
  )

  const stateOf = useCallback(
    (entry: Designator) => (document ? rowState(document, entry) : (entry.placement ?? 'none')),
    [document],
  )

  const visible = useMemo(() => {
    if (!document) return []
    switch (filter) {
      case 'todo':
        return entries.filter((e) => PLACEABLE.has(e.kind) && stateOf(e) !== 'confirmed')
      case 'components':
        return entries.filter((e) => e.kind === 'component')
      case 'terminals':
        return entries.filter((e) => e.kind === 'terminal')
      case 'wires':
        return entries.filter((e) => e.kind === 'wire')
      case 'nets':
        return entries.filter((e) => e.kind === 'net')
      default:
        return entries
    }
  }, [entries, filter, document, stateOf])

  const done = document ? coverage(entries, document) : null
  const targetEntry = useMemo(
    () => (target ? (entries.find((e) => e.id === target.id) ?? null) : null),
    [entries, target],
  )

  const pinsOf = useCallback(
    (componentId: string) =>
      entries
        .filter((e) => e.kind === 'terminal' && e.members[0] === componentId)
        .map((e) => splitTerminal(e.id)[1])
        .filter((pin): pin is string => Boolean(pin)),
    [entries],
  )

  /** The dots. The draft's own points where it has them, the server's resolved ones elsewhere —
   * see `editorPlaces`. Only the placeable kinds get one: a net's centroid is not a place. */
  const overlay = useMemo(() => {
    if (!document) return []
    const rows = [...visible]
    /**
     * An armed wire or net brings **its member terminals' dots with it**, whichever filter is on.
     *
     * Without them the `Wires` filter is a sheet with two pieces of floating text on it: the end
     * labels sit at the pins, and nobody has placed a `label_point`, so there is nothing else in
     * the list with a dot. A label with no dot beside it is a label you cannot check the side of,
     * which is the one thing this panel is for.
     */
    if (targetEntry && LABELLABLE.has(targetEntry.kind)) {
      const shown = new Set(rows.map((row) => row.id))
      for (const member of targetEntry.terminals ?? []) {
        const pin = entries.find((entry) => entry.id === member.id)
        if (pin && !shown.has(pin.id)) {
          shown.add(pin.id)
          rows.push(pin)
        }
      }
    }
    return rows
      .filter((entry) => PLACEABLE.has(entry.kind) || LABELLABLE.has(entry.kind))
      .map((entry) => {
        const places = editorPlaces(document, entry)
        return { ...entry, places, point: places[0]?.point ?? null }
      })
      .filter((entry) => entry.point)
  }, [visible, document, targetEntry, entries])

  /**
   * The armed wire's or net's end labels, planned against the **draft** so a compass click lands
   * before the save does.
   *
   * Only the armed one's, and only when one is armed: this screen is where a person works on a
   * single row, and drawing all 269 while they choose a side for one of them would bury it. The
   * plan is still made over the whole index, because which of two labels on one dot gets the side
   * it wants must not depend on what happens to be armed — see `endLabels.ts`.
   */
  const endLabels = useMemo(() => {
    if (!document || !targetEntry || !LABELLABLE.has(targetEntry.kind)) return []
    return planEndLabels(entries, (owner, terminal) => endLabelsOf(document, owner)[terminal])
      .filter((label) => label.owner === targetEntry.id)
  }, [document, entries, targetEntry])

  const marked = useMemo(() => {
    if (!document || !targetEntry) return null
    const places = editorPlaces(document, targetEntry)
    return places.length ? { ...targetEntry, places, point: places[0].point } : null
  }, [document, targetEntry])

  // Nothing is fetched until the tab has been opened once *and* the door is open — the same
  // rule as the Drawing tab, for the same 2.2 MB of rasters, plus not spending them on someone
  // who is looking at a password box.
  const [armed, setArmed] = useState(false)
  const locked = needsPassword && !unlocked
  useEffect(() => {
    if (activeTabId === LOCATE_TAB_ID && !locked) setArmed(true)
  }, [activeTabId, locked])

  /**
   * **A flight is asked for, never inferred from the target having changed.**
   *
   * It used to be an effect keyed on `target?.id`, and every fault that produced came from the
   * same place: the id is not enough to say where to go, and "changed" is not the same question
   * as "the user wants to be taken there". Arming `CR-BP`'s NO contact took the sheet to its
   * coil, because the id names three dots and the effect picked the first; arming the same site
   * twice did nothing at all, because the id had not changed (that was K1/H3); and dragging a dot
   * belonging to some *other* row flew the sheet away mid-drag, because the target changed as a
   * side effect of the gesture.
   *
   * So every call site says what it wants framed, and `flyTo(null)` — the drag, the rename, a
   * site with no point yet — says "leave the sheet where it is". The nonce is what makes asking
   * for the same rectangle twice fly twice: `entry.rect` is the same array on both picks, and
   * without it React would bail out of the state change and the second ask would be silent.
   *
   * **And one thing the call sites do not decide: a flight is refused above `FLY_CEILING_PERCENT`.**
   * Asking is still the only way to be flown anywhere; the ceiling only says that from closer in
   * than a flight would take you, the answer is no. It lives here rather than in each caller
   * because the reason is a property of the *viewport* — how magnified the sheet already is — and
   * not of which row was picked.
   */
  const panTo = useRef(viewer.panTo)
  panTo.current = viewer.panTo
  /** The whole sheet, which is what a component drawn in more than one place is framed against. */
  const sheetRect = useMemo<Rect>(() => [0, 0, width, height], [width, height])
  const [focus, setFocus] = useState<{ rect: Rect; nonce: number } | null>(null)
  const flights = useRef(0)
  const flyTo = useCallback((rect: Rect | null) => {
    if (!rect) return
    flights.current += 1
    setFocus({ rect, nonce: flights.current })
  }, [])
  // The flight is an effect rather than a call, because the sheet behind an unopened tab has no
  // size yet: a row picked before the container is measured is remembered and flown to the
  // moment it can be.
  const measured = armed && viewer.viewport.scale > 0
  /** Held in a ref for the same reason `panTo` is: the zoom that decides whether to fly is the
   * one at the moment of the flight, and a re-render at a new zoom is not a request to fly. An
   * unmeasured sheet reads 0, which is below the ceiling — the first flight of a session is
   * exactly the one worth making. */
  const percent = useRef(viewer.percent)
  percent.current = viewer.percent
  useEffect(() => {
    if (!measured || !focus) return
    // Already closer in than the flight would take us: leave the sheet alone, both of it — the
    // magnification and the position. See `FLY_CEILING_PERCENT`.
    if (percent.current > FLY_CEILING_PERCENT) return
    panTo.current(focus.rect)
  }, [measured, focus])

  /** Arm a row from the list, and take the sheet to it — see `framing` for what "to it" means
   * when the row is drawn in three places. */
  const pick = useCallback(
    (entry: Designator) => {
      if (!document) {
        setTarget({ id: entry.id, site: null })
        return
      }
      setTarget(aim(entry, document))
      flyTo(framing(document, entry, sheetRect))
    },
    [document, flyTo, sheetRect, setTarget],
  )

  /**
   * **Escape puts the screen back the way it started.** Nothing armed, no red dot, the hand back
   * on the sheet.
   *
   * Being armed is a *mode*, and it is the one mode in this application where the next click
   * writes into an authored file. Until this existed the only way out of it was into another one
   * — picking a different row — so a person who had finished placing and just wanted to look at
   * the drawing had a crosshair and a live target for the rest of the session. The Drawing tab
   * had the way out already as the ✕ on its selection card, and now has this key too, on the same
   * reasoning: what a button does, Escape should do.
   *
   * On `window` rather than on the sheet, because the thing you want to escape from is usually
   * something you armed *in the list*, and the sheet does not have focus then. Guarded by the
   * active tab so a keypress meant for the Drawing tab does not silently disarm this one.
   *
   * A text field gets the first Escape for itself and only loses focus: half a typed site name
   * is work, and Escape is the key people press to abandon it. The second Escape, now that focus
   * has left the field, clears the target.
   */
  useEffect(() => {
    if (activeTabId !== LOCATE_TAB_ID) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (isTextField(event.target)) {
        event.target.blur()
        return
      }
      if (!useLocateStore.getState().target) return
      event.preventDefault()
      setTarget(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTabId, setTarget])

  const stamp = useCallback(
    () => ({ by: health?.editing?.by ?? null, at: new Date().toISOString() }),
    [health?.editing?.by],
  )

  /**
   * Move the armed point a little, exactly — the cure for the accidental small drag.
   *
   * The answer to *"a dot moved a tenth of a point and I cannot put it back"* is two things, and
   * this is the second: `Ctrl+Z` covers the accident, and this makes a small move something you
   * can do **on purpose** without a mouse. A minimum-drag threshold was the obvious third idea
   * and was rejected, because on this sheet it cannot tell a twitch from a deliberate 0.1 pt
   * correction — both are real, and refusing an intention is worse than allowing an accident you
   * can undo.
   *
   * It goes through the same `placeInto` a drag does, so it inherits the rounding, the `human`
   * source, the `by`/`at` stamp, the autosave and the undo entry with nothing new to validate.
   * The anchor is `draftPoint`, not `editorPlaces`: only a point the draft already owns moves —
   * see that function for why nudging an estimate would be a lie rather than a correction.
   *
   * The whole run is one undo step. Ten presses and one `Ctrl+Z` puts the dot back where it
   * started, not one tenth of the way back.
   */
  const nudge = useCallback(
    (by: [number, number]) => {
      if (!document || !target || !targetEntry) return
      const from = draftPoint(document, target)
      if (!from) return
      const to: [number, number] = [from[0] + by[0], from[1] + by[1]]
      edit(
        (d) => placeInto(d, target, to, stamp(), targetEntry.kind),
        `nudged ${target.site ? `${target.id} (${target.site})` : target.id}`,
        `nudge:${target.id}:${target.site ?? ''}:${target.label ? 'label' : 'point'}`,
      )
    },
    [document, target, targetEntry, edit, stamp],
  )

  /**
   * The keyboard: `Ctrl+Z`, `Ctrl+Shift+Z`, and `Shift`(+`Alt`)+arrows.
   *
   * **This is the third `window` key listener in the application** — beside this tab's `Escape`
   * and the Drawing tab's — and hazard `H10` applies to it in full: both tabs are `keepMounted`,
   * so the `activeTabId` guard at the top is the only thing stopping a keystroke meant for the
   * reader's side from mutating an authored file. Written down here before the listener existed
   * rather than after it bit.
   *
   * `isTextField` first, always: a `Ctrl+Z` with the caret in the site-name box must undo
   * *typing*, and must never un-place a dot on the other side of the screen.
   *
   * Held in a ref for the same reason `panTo` is — the handler closes over the draft and the
   * armed target, both of which change constantly, and re-binding a `window` listener on every
   * keystroke of a placement run is a cost with no benefit.
   */
  const keys = useRef({ nudge, undo, redo })
  keys.current = { nudge, undo, redo }
  useEffect(() => {
    if (activeTabId !== LOCATE_TAB_ID) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTextField(event.target)) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) keys.current.redo()
        else keys.current.undo()
        return
      }

      // Bare arrows are the viewport's, and stay the viewport's.
      if (!event.shiftKey || event.ctrlKey || event.metaKey) return
      const direction = NUDGE[event.key]
      if (!direction) return
      event.preventDefault()
      const step = event.altKey ? FINE_NUDGE_PT : NUDGE_PT
      keys.current.nudge([direction[0] * step, direction[1] * step])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTabId])

  /** Place, then move on. The advance is what makes a run of placements a run rather than 131
   * separate decisions about what to do next. */
  const put = useCallback(
    (point: [number, number]) => {
      if (!document || !target) return
      place(point, stamp(), targetEntry?.kind ?? 'wire')
      // A label is a nicety rather than outstanding work, so placing one does not advance —
      // being thrown to an unrelated terminal after tidying a wire's name is not a run.
      if (!advance || target.label) return
      const placed = useLocateStore.getState().document ?? document
      const after = nextUnplaced(entries, placed, target.id)
      setTarget(after ? aim(after, placed) : null)
      // The run takes the sheet with it, or the next click would be aimed at something that is
      // not on screen.
      if (after) flyTo(framing(placed, after, sheetRect))
    },
    [
      document, target, targetEntry?.kind, place, stamp, advance, entries, setTarget, flyTo,
      sheetRect,
    ],
  )

  /**
   * The viewport as it was when the press began, so a pan is never mistaken for a placement.
   *
   * **A placement is a click that did not move the sheet.** That is the definition, and it is
   * better than measuring how far the pointer travelled: the sheet is the only thing panning
   * moves, panning is the only thing that moves it, and there is no tolerance to pick. It also
   * covers the cases a distance threshold would miss — a click that lands while a flight to the
   * previous target is still animating, or during an auto-fit — where the coordinate under the
   * cursor is not the coordinate the user was aiming at.
   */
  const pressedAt = useRef<Viewport | null>(null)
  const current = useRef(viewer.viewport)
  current.current = viewer.viewport

  if (!tiles) return null

  /**
   * The password box and the loading line are an **overlay**, not an early return.
   *
   * `useTileViewport` attaches its `ResizeObserver` in an effect that runs once, so a container
   * rendered later than the hook is a container that is never measured — the sheet would sit at
   * `scale: 0` with no error anywhere, and every coordinate this editor computed would be zero.
   * The file loads asynchronously and always after mount, so returning early while it does would
   * hit that every single time. The layout goes up first and the gate covers it.
   */
  const blocked = locked ? 'locked' : document ? null : 'loading'

  const total = tiles.tiles.length
  const loaded = Object.keys(settled).length

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <Crosshair className="size-3.5 text-muted-foreground" />
          Locate
        </span>
        {done && (
          <span
            className="text-muted-foreground tabular-nums"
            title={
              'Components and terminals need a point, and that is the only work here. Every wire ' +
              'end and every net terminal already has a label — the side is computed from points ' +
              'you have already placed — so the last number is how many of those you have moved ' +
              'or hidden by hand, not how many are missing. There is nothing to finish.'
            }
          >
            {`${done.confirmed} of ${done.placeable} placed · ${done.remaining} to do · `}
            {`${done.wires} wires · ${done.nets} nets · `}
            {`${done.authored} end label${done.authored === 1 ? '' : 's'} moved by hand`}
          </span>
        )}
        {armed && loaded < total && (
          <span className="text-muted-foreground">
            loading {loaded}/{total}…
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <SaveStatus
            state={saveState}
            error={saveError}
            note={undoNote}
            onSave={() => void save()}
          />
          <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={viewer.zoomOut}>
            <Minus />
          </Button>
          <span className="w-12 text-center tabular-nums text-muted-foreground">
            {viewer.percent}%
          </span>
          <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={viewer.zoomIn}>
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={viewer.fit}
            className={cn('h-8', viewer.isFit && 'text-foreground')}
          >
            <Maximize2 />
            Fit
          </Button>
        </div>
      </div>

      {stale && (
        <p className="flex items-start gap-2 border-b border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-4 py-1.5 text-[11px]">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-[var(--color-warning)]" />
          <span>
            {stale} The sheet below is already current — this only affects the file the model
            reads.
          </span>
        </p>
      )}

      {report?.problems.map((problem) => (
        <p
          key={problem}
          className="border-b border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-1 text-[11px]"
        >
          {problem}
        </p>
      ))}

      <div className="flex min-h-0 flex-1">
        <div className="flex w-80 shrink-0 flex-col border-r">
          <div className="flex flex-wrap gap-1 border-b px-2 py-1.5">
            {FILTERS.map(({ id, label, title }) => (
              <Button
                key={id}
                variant={filter === id ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[11px]"
                aria-pressed={filter === id}
                title={title}
                onClick={() => setFilter(id)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <DesignatorList
              entries={visible}
              stateOf={stateOf}
              targetId={target?.id ?? null}
              onPick={pick}
            />
          </div>

          {document && targetEntry && target && editable(targetEntry) && (
            /**
             * Lifted off the list, not merely appended to it.
             *
             * The list and this panel are different things — one is 275 rows you scan past, the
             * other is the one row that is *armed*, and the next click on the sheet writes into an
             * authored file because of it. Sharing a hairline border with the row above made the
             * panel read as more list, and a person could not see where the scrolling ended and
             * the controls began. So: the accent colour on a 2 px edge, a filled ground, and a
             * shadow cast upward over the list, which is the one cue that says *in front of*
             * rather than *after*.
             */
            <div className="border-t-2 border-[var(--color-ring)] bg-muted px-3 py-2 shadow-[0_-6px_14px_-6px_rgb(0_0_0/0.3)]">
              <TargetPanel
                entry={targetEntry}
                document={document}
                target={target}
                pinsOf={pinsOf}
                endLabels={endLabels}
                /* `fly` is set by the site buttons and by nothing else. Retargeting also happens
                   after a rename and when a new site is started, and neither is a request to be
                   taken anywhere — one has not moved and the other has nowhere to go yet. */
                onTarget={(next, fly) => {
                  setTarget(next)
                  if (fly) flyTo(framing(document, targetEntry, sheetRect, next.site))
                }}
                onEdit={edit}
                onLabelDir={setLabelDir}
                onClear={clear}
                onClose={() => setTarget(null)}
              />
            </div>
          )}

          <label className="flex items-center gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={advance}
              onChange={(event) => setAdvance(event.target.checked)}
            />
            Move to the next unplaced after each click
          </label>
        </div>

        <div
          ref={viewer.containerRef}
          tabIndex={0}
          role="application"
          aria-label="Schematic sheet. Click to place the selected designator; drag a dot to correct it; press Escape to select nothing and go back to panning."
          className={cn(
            'relative min-h-0 flex-1 touch-none overflow-hidden bg-muted select-none',
            target ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing',
            'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none',
          )}
          {...viewer.handlers}
          onPointerDown={(event) => {
            pressedAt.current = current.current
            viewer.handlers.onPointerDown(event)
          }}
          onClick={(event) => {
            const from = pressedAt.current
            pressedAt.current = null
            if (!target || !from) return
            const now = current.current
            if (from.x !== now.x || from.y !== now.y || from.scale !== now.scale) return
            const box = event.currentTarget.getBoundingClientRect()
            put(
              cssToPoint(
                { left: event.clientX - box.left, top: event.clientY - box.top },
                viewer.viewport,
              ),
            )
          }}
        >
          {armed && viewer.viewport.scale > 0 && (
            <TileSheet
              tiles={tiles.tiles}
              width={width}
              height={height}
              viewport={viewer.viewport}
              size={viewer.size}
              dpr={viewer.dpr}
              onTileSettled={onTileSettled}
            />
          )}

          {armed && document && (
            <MarkerLayer
              markers={overlay}
              viewport={viewer.viewport}
              dpr={viewer.dpr}
              selected={marked}
              relatedIds={EMPTY_SET}
              showLabels={viewer.percent >= 30}
              endLabels={endLabels}
              /* The dot that was clicked, not the row's first one. Somebody clicking `CR-BP`'s
                 NO contact is almost always about to move *that* dot, and arming the coil and
                 flying to it instead left them to drag the sheet back to where they had been
                 looking. So the click names the site, and the sheet closes in on the dot under
                 the pointer rather than going anywhere. */
              onSelect={(entry, place) => {
                setTarget(
                  entry.kind === 'component' && place.site
                    ? { id: entry.id, site: place.site }
                    : aim(entry, document),
                )
                flyTo(at(place.point))
              }}
              /* Drag moves whatever the dot's row names: a component's dot is its site, a
                 terminal's is that pin's own point. Never both — a gesture that silently moved
                 five other pins because they share a site would be the worst kind of surprise in
                 a file nobody re-checks. */
              onDragPoint={(entry, dragPlace, point) => {
                const to: Target = LABELLABLE.has(entry.kind)
                  ? { id: entry.id, site: null, label: true }
                  : entry.kind === 'component'
                    ? { id: entry.id, site: dragPlace.site ?? nextSiteId(document, entry.id) }
                    : { id: entry.id, site: null }
                setTarget(to)
                /* One undo step per gesture, not per frame. This fires on every pointer move, so
                   without the coalescing key a single drag across the sheet would push fifty
                   snapshots and push the thing you actually wanted back off the end of the
                   stack. `onDragEnd` closes the run when the pointer lets go. */
                edit(
                  (d) => placeInto(d, to, point, stamp(), entry.kind),
                  `moved ${to.label ? `${to.id}'s label point` : to.site ? `${to.id} (${to.site})` : to.id}`,
                  `drag:${to.id}:${to.site ?? ''}:${to.label ? 'label' : 'point'}`,
                )
              }}
              onDragEnd={endRun}
            />
          )}
        </div>
      </div>

      <p className="border-t px-4 py-1 text-[11px] text-muted-foreground">
        Pick a row, then click the sheet to place it · drag any dot to correct it ·{' '}
        <Key>Shift</Key>+arrows nudge the armed point by {NUDGE_PT} pt and{' '}
        <Key>Shift</Key>+<Key>Alt</Key>+arrows by {FINE_NUDGE_PT} pt, at any zoom — bare arrows
        still pan · <Key>Ctrl</Key>+<Key>Z</Key> undoes the last change and{' '}
        <Key>Ctrl</Key>+<Key>Shift</Key>+<Key>Z</Key> puts it back ·{' '}
        <Key>Esc</Key> selects nothing and gives the hand back · past {FLY_CEILING_PERCENT}% zoom,
        picking a row leaves the sheet exactly where it is · filled dots
        were placed by hand, hollow ones are the indexing pass&apos;s estimate. Saved to{' '}
        <span className="font-mono">locations.json</span>, which is authored and belongs in git
        beside <span className="font-mono">author_circuit_logic.py</span>.
      </p>

      {blocked && (
        <div className="absolute inset-0 z-20 bg-background">
          {blocked === 'locked' ? (
            <PasswordGate />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              {error ?? (loading ? 'Opening the locations file…' : 'The editor is not available.')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const EMPTY_SET: Set<string> = new Set()

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border px-1 py-px font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  )
}

/** `numeric` so that a pin `3` comes before a pin `21` rather than after it: these ids end in
 * numbers a person reads as numbers, and `W9` after `W047` is the kind of small wrongness that
 * makes someone stop trusting the list. */
const BY_ID = new Intl.Collator(undefined, { numeric: true })

/** Everything in the index is *something* a person can put somewhere: components and terminals a
 * point, wires and nets a label. Nothing in the list is inert. */
function editable(entry: Designator): boolean {
  return PLACEABLE.has(entry.kind) || LABELLABLE.has(entry.kind)
}

/** What a click on this row will place: a wire's or net's label, a terminal's own point, or a
 * component's site — the one already being edited if the user picked it, otherwise its first,
 * otherwise a new one. */
function aim(entry: Designator, document: Parameters<typeof nextSiteId>[0]): Target {
  if (LABELLABLE.has(entry.kind)) return { id: entry.id, site: null, label: true }
  if (entry.kind !== 'component') return { id: entry.id, site: null }
  const existing = document.components?.[entry.id]?.sites?.[0]?.id
  return { id: entry.id, site: existing ?? nextSiteId(document, entry.id) }
}

/** A point as a rectangle of no size, which is what `panTo` frames a single dot with. */
function at(point: Place['point']): Rect {
  return [point[0], point[1], point[0], point[1]]
}

/**
 * What the sheet should show for this row — and the answer is different for a component that is
 * drawn in more than one place.
 *
 * - **A named site** is framed on its own dot. That is a site button on the panel, and it is the
 *   only way to say "take me to *that* one". A site with no point yet gets `null`: there is
 *   nothing to fly to, and jumping somewhere arbitrary the moment "Another site" is pressed
 *   would throw away the view the user was about to place into.
 * - **Several places and no site named** frames the **whole sheet**. `CR-BP` is a relay whose
 *   coil, NC contact and NO contact are in three different circuits, and flying to one of them
 *   tells the reader nothing about the other two — it looks exactly like a component drawn once.
 *   Seeing all three dots at once is the fact worth having, and it is a fact about the sheet
 *   rather than about any one dot, so the sheet is the frame.
 * - **One place** is framed on it, and **none at all** falls back to the server's rectangle,
 *   which for an unplaced row is the indexing pass's estimate — a rough place to start looking,
 *   and the reason the fly happens at all.
 */
function framing(
  document: LocationsDocument,
  entry: Designator,
  sheet: Rect,
  site?: string | null,
): Rect | null {
  const places = editorPlaces(document, entry)
  if (site) {
    const named = places.find((place) => place.site === site)
    return named ? at(named.point) : null
  }
  if (places.length > 1) return sheet
  if (places.length === 1) return at(places[0].point)
  return entry.rect ?? null
}

function SaveStatus({
  state,
  error,
  note,
  onSave,
}: {
  state: string
  error: string | null
  /** What the last undo or redo did. A document mutation reverted silently on a 275-row file is
   * indistinguishable from a key that did nothing, so the badge says it in words. */
  note: string | null
  onSave: () => void
}) {
  const text =
    state === 'saving'
      ? 'saving…'
      : state === 'pending'
        ? 'unsaved'
        : state === 'saved'
          ? 'saved'
          : state === 'error'
            ? 'not saved'
            : ''
  return (
    <span className="flex items-center gap-1.5">
      {note && (
        <span className="max-w-64 truncate text-[11px] text-foreground" title={note}>
          {note}
        </span>
      )}
      {error && (
        <span className="max-w-64 truncate text-[11px] text-[var(--color-danger)]" title={error}>
          {error}
        </span>
      )}
      <Badge tone={state === 'error' ? 'danger' : state === 'pending' ? 'warning' : 'default'}>
        {text || 'no changes'}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        disabled={state === 'clean' || state === 'saving'}
        onClick={onSave}
      >
        <Save />
        Save
      </Button>
    </span>
  )
}

/** The second password, and the reason it is not the demo one: permission to spend tokens and
 * permission to change where the drawing says things are are different permissions. */
function PasswordGate() {
  const { unlock, error, loading } = useLocateStore()
  const [value, setValue] = useState('')

  return (
    <div className="mx-auto mt-16 w-80 space-y-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Lock className="size-4" />
        The Locate editor is locked
      </p>
      <p className="text-xs text-muted-foreground">
        This screen writes coordinates into the drawing&apos;s authored geometry file. It has its
        own password, separate from the demo password, because spending tokens and editing the
        drawing are not the same permission.
      </p>
      <div className="flex gap-1.5">
        <input
          autoFocus
          type="password"
          value={value}
          disabled={loading}
          aria-label="Editor password"
          placeholder="editor password"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value) void unlock(value)
          }}
          className="flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        />
        <Button size="sm" disabled={!value || loading} onClick={() => void unlock(value)}>
          {loading ? '…' : 'Unlock'}
        </Button>
      </div>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Map className="size-3.5" />
        The Drawing tab is unaffected and stays read-only.
      </p>
    </div>
  )
}
