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

import type { Designator } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MarkerLayer } from '@/features/drawing/MarkerLayer'
import { cssToPoint } from '@/features/drawing/paint'
import { TileSheet } from '@/features/drawing/TileSheet'
import { useTileViewport, type Viewport } from '@/features/drawing/useTileViewport'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useLocateStore } from '@/stores/locateStore'
import { LOCATE_TAB_ID } from '@/tabIds'
import {
  coverage,
  editorPlaces,
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
import { WorkList } from './WorkList'

export { LOCATE_TAB_ID }

type Filter = 'todo' | 'components' | 'terminals' | 'computed' | 'all'

const FILTERS: { id: Filter; label: string; title: string }[] = [
  { id: 'todo', label: 'To do', title: 'Components and terminals nobody has placed yet' },
  { id: 'components', label: 'Components', title: 'All components' },
  { id: 'terminals', label: 'Terminals', title: 'All terminals' },
  {
    id: 'computed',
    label: 'Wire & net labels',
    title:
      'Their routes are computed from their terminals and are never placed. What you can place ' +
      'is where each name is written on the sheet.',
  },
  { id: 'all', label: 'All', title: 'Everything in the index' },
]

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
    load,
    setTarget,
    setAdvance,
    edit,
    place,
    setLabelDir,
    clear,
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

  const entries = useMemo(() => designators?.entries ?? [], [designators])

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
      case 'computed':
        return entries.filter((e) => !PLACEABLE.has(e.kind))
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
    return visible
      .filter((entry) => PLACEABLE.has(entry.kind) || LABELLABLE.has(entry.kind))
      .map((entry) => {
        const places = editorPlaces(document, entry)
        return { ...entry, places, point: places[0]?.point ?? null }
      })
      .filter((entry) => entry.point)
  }, [visible, document])

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

  /** Fly to whatever is being placed. Keyed on the id rather than the whole target, so retargeting
   * a second site of the same component does not yank the sheet away from the first. */
  const panTo = useRef(viewer.panTo)
  panTo.current = viewer.panTo
  const focusRef = useRef<[number, number, number, number] | null>(null)
  focusRef.current = marked?.point
    ? [marked.point[0], marked.point[1], marked.point[0], marked.point[1]]
    : (targetEntry?.rect ?? null)
  const measured = armed && viewer.viewport.scale > 0
  useEffect(() => {
    if (measured && focusRef.current) panTo.current(focusRef.current)
  }, [measured, target?.id])

  const stamp = useCallback(
    () => ({ by: health?.editing?.by ?? null, at: new Date().toISOString() }),
    [health?.editing?.by],
  )

  /** Place, then move on. The advance is what makes a run of placements a run rather than 131
   * separate decisions about what to do next. */
  const put = useCallback(
    (point: [number, number]) => {
      if (!document || !target) return
      place(point, stamp(), targetEntry?.kind ?? 'wire')
      // A label is a nicety rather than outstanding work, so placing one does not advance —
      // being thrown to an unrelated terminal after tidying a wire's name is not a run.
      if (!advance || target.label) return
      const after = nextUnplaced(entries, useLocateStore.getState().document ?? document, target.id)
      setTarget(after ? aim(after, useLocateStore.getState().document ?? document) : null)
    },
    [document, target, targetEntry?.kind, place, stamp, advance, entries, setTarget],
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
            title="Components and terminals need a point. Wire and net labels are optional — their routes are already known from their terminals — so they are counted separately and never as work outstanding."
          >
            {`${done.confirmed} of ${done.placeable} placed · ${done.remaining} to do · `}
            {`${done.labelled} of ${done.labellable} wire and net labels`}
          </span>
        )}
        {armed && loaded < total && (
          <span className="text-muted-foreground">
            loading {loaded}/{total}…
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <SaveStatus state={saveState} error={saveError} onSave={() => void save()} />
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
            <WorkList
              entries={visible}
              stateOf={stateOf}
              targetId={target?.id ?? null}
              onPick={(entry) =>
                setTarget(document ? aim(entry, document) : { id: entry.id, site: null })
              }
            />
          </div>

          {document && targetEntry && target && editable(targetEntry) && (
            <div className="border-t px-3 py-2">
              <TargetPanel
                entry={targetEntry}
                document={document}
                target={target}
                pinsOf={pinsOf}
                onTarget={setTarget}
                onEdit={edit}
                onLabelDir={setLabelDir}
                onClear={clear}
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
          aria-label="Schematic sheet. Click to place the selected designator; drag a dot to correct it."
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
              onSelect={(entry) => setTarget(aim(entry, document))}
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
                edit((d) => placeInto(d, to, point, stamp(), entry.kind))
              }}
            />
          )}
        </div>
      </div>

      <p className="border-t px-4 py-1 text-[11px] text-muted-foreground">
        Pick a row, then click the sheet to place it · drag any dot to correct it · filled dots
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

function SaveStatus({
  state,
  error,
  onSave,
}: {
  state: string
  error: string | null
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
