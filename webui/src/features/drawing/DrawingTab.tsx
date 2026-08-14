/**
 * The Drawing tab — the sheet, in the same page as the questions.
 *
 * Two things this replaces, and the reasons are worth keeping.
 *
 * *Not a full-screen overlay.* The previous viewer covered the window, so seeing the drawing
 * meant losing the answer that sent you there and closing it again to get back. A tab keeps
 * both alive; a split pane will keep both visible, and it is the same components either way.
 *
 * *Not a new browser tab.* Same-origin tabs can in fact talk to each other, so that was never
 * the obstacle — the obstacle is that a new tab renders the PDF with the browser's own
 * viewer, which is opaque. No DOM, no coordinates, nothing to draw on. Every high-value idea
 * in `webui_ideas.md` §2 — click a citation and pan to it, highlight a net, mark the 47
 * components — needs us to own the rendering surface, and this is us owning it. The raw PDF
 * is still one click away for the two jobs it is better at: printing, and a second monitor.
 *
 * *And now the surface is used for it.* This file composes three layers over one transform:
 * the tiles (`TileSheet`, a canvas), the components (`MarkerLayer`, DOM), and what is currently
 * selected (`SelectionCard`). It owns none of that logic — the selection lives in `appStore`
 * because half of it is raised from the answer on the other tab, and the projection lives in
 * `paint.ts` because the markers and the tiles must not disagree about where a point is.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, ExternalLink, ImageOff, Map, Maximize2, Minus, Plus } from 'lucide-react'

import { SOURCE_URL } from '@/api/client'
import type { Designator } from '@/api/types'
import { Button } from '@/components/ui/button'
import { normalise, suggestedQuestion } from '@/lib/designators'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import { ASK_TAB_ID, DRAWING_TAB_ID } from '@/tabIds'
import { MarkerLayer } from './MarkerLayer'
import { SelectionCard } from './SelectionCard'
import { TileSheet } from './TileSheet'
import { useTileViewport } from './useTileViewport'

/** Re-exported for the tests and callers that already reach for it here. It is *declared* in
 * `tabIds.ts`, a leaf module, so that `Citation` can send a reader to this tab without
 * importing it — see that file's header for the cycle this avoids. */
export { DRAWING_TAB_ID }

export function DrawingTab() {
  const drawing = useAppStore((s) => s.drawing)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const designators = useAppStore((s) => s.designators)
  const byToken = useAppStore((s) => s.byToken)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setComposerText = useChatStore((s) => s.setComposerText)
  const tiles = drawing?.tiles ?? null

  const [width, height] = tiles?.page_size_pt ?? [1, 1]
  const viewer = useTileViewport({ width, height, dpi: tiles?.dpi ?? 400 })

  const [showMarkers, setShowMarkers] = useState(true)
  const markers = useMemo(
    () => (designators?.entries ?? []).filter((e) => e.kind === 'component' && e.point),
    [designators],
  )
  const located = useMemo(() => new Set(markers.map((m) => m.id)), [markers])

  const entry = selection ? (byToken.get(normalise(selection.id)) ?? null) : null
  const selectedId = entry?.kind === 'component' ? entry.id : null
  const relatedIds = useMemo(() => new Set(entry?.members ?? []), [entry])

  /**
   * Nothing is fetched until the tab has been opened once.
   *
   * The tab is `keepMounted`, so this component exists from the first paint — which is what
   * preserves the pan and zoom across a switch back to Ask, and would also mean 2.2 MB of
   * rasters landing on someone who never opens it. Arming on first activation gets both: no
   * cost until asked, and no reload afterwards.
   */
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (activeTabId === DRAWING_TAB_ID) setArmed(true)
  }, [activeTabId])

  const [settled, setSettled] = useState<Record<string, boolean>>({})
  const onTileSettled = useCallback(
    (file: string, ok: boolean) => setSettled((current) => ({ ...current, [file]: ok })),
    [],
  )

  /**
   * Fly to whatever the answer just pointed at.
   *
   * Keyed on the selection's nonce, so clicking the same citation twice pans again — by then
   * the reader has usually dragged the sheet somewhere else, and a silent no-op reads as a
   * broken link. Also re-runs when `ready` flips: a citation clicked from the Ask tab arrives
   * before this tab has ever been measured, and the flight has to wait for a container with a
   * size. `panTo` is held in a ref because its identity changes with the container, which is
   * not a reason to pan.
   */
  const panTo = useRef(viewer.panTo)
  panTo.current = viewer.panTo
  const focus: [number, number, number, number] | null =
    entry?.rect ?? (entry?.point ? [...entry.point, ...entry.point] : null)
  const focusRef = useRef(focus)
  focusRef.current = focus
  const ready = armed && viewer.viewport.scale > 0

  useEffect(() => {
    const target = focusRef.current
    if (!ready || !target || selection?.origin === 'drawing') return
    panTo.current(target)
    // The nonce is what makes a repeat of the same citation count as a new instruction.
  }, [ready, selection?.nonce, selection?.origin])

  const ask = useCallback(() => {
    if (!entry) return
    setComposerText(suggestedQuestion(entry))
    setActiveTab(ASK_TAB_ID)
  }, [entry, setActiveTab, setComposerText])

  const onMarker = useCallback(
    (marker: Designator) => select('component', marker.id, 'drawing'),
    [select],
  )

  if (!tiles) return null

  const total = tiles.tiles.length
  const done = Object.keys(settled).length
  const broken = Object.values(settled).filter((ok) => !ok).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <Map className="size-3.5 text-muted-foreground" />
          {drawing?.drawing_number ?? 'Drawing'}
        </span>
        <span className="text-muted-foreground">
          {total} tiles · {tiles.dpi ?? '?'} DPI · {Math.round(width)}×{Math.round(height)} pt
        </span>

        {armed && done < total && (
          <span className="text-muted-foreground">
            loading {done}/{total}…
          </span>
        )}
        {broken > 0 && (
          <span className="flex items-center gap-1 text-[var(--color-danger)]">
            <ImageOff className="size-3.5" />
            {broken} tile{broken === 1 ? '' : 's'} failed to load
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {markers.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={showMarkers}
              onClick={() => setShowMarkers((on) => !on)}
              title={`${markers.length} of the ${designators?.counts.component ?? markers.length} components have a location on this sheet. Click one to see what it is.`}
              className={cn('h-8', showMarkers && 'text-foreground')}
            >
              <Crosshair />
              Components
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={viewer.zoomOut}>
            <Minus />
          </Button>
          <span
            className="w-12 text-center tabular-nums text-muted-foreground"
            title={
              `Percentage of the tiles' own resolution. 100% is one tile pixel per device ` +
              `pixel — the sharpest these rasters go. This display is ${viewer.dpr}×, so a ` +
              `device pixel is ${viewer.dpr === 1 ? 'a' : `1/${viewer.dpr}`} CSS pixel.`
            }
          >
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
          {drawing?.source && (
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              title={`${drawing.source.name} — the vector original, for printing or a second monitor`}
              className="flex items-center gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              Source PDF
            </a>
          )}
        </div>
      </div>

      <div
        ref={viewer.containerRef}
        tabIndex={0}
        role="application"
        aria-label="Schematic sheet. Drag to pan, scroll to zoom."
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden bg-muted select-none',
          'cursor-grab active:cursor-grabbing',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none',
        )}
        {...viewer.handlers}
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

        {/* Above the canvas, which is `pointer-events-none` precisely so this can be clicked.
            Selected and related markers show through the toggle: hiding the thing an answer
            just pointed at would be the one case where the overlay has to be visible. */}
        {armed && (
          <MarkerLayer
            markers={showMarkers ? markers : markers.filter((m) => relatedIds.has(m.id))}
            viewport={viewer.viewport}
            dpr={viewer.dpr}
            selectedId={selectedId}
            relatedIds={relatedIds}
            // Ids are legible from about a third of native zoom; below that they are a fog.
            showLabels={viewer.percent >= 30}
            onSelect={onMarker}
          />
        )}

        {entry && (
          <SelectionCard
            entry={entry}
            canSelect={(id) => located.has(id)}
            onSelectMember={(id) => select('component', id)}
            onAsk={ask}
            onClose={clearSelection}
          />
        )}
      </div>

      <p className="border-t px-4 py-1 text-[11px] text-muted-foreground">
        Drag to pan · scroll to zoom · double-click to zoom in · <Key>0</Key> fits the sheet ·
        arrow keys nudge.{' '}
        {markers.length > 0 && (
          <>
            Click a marker for what that component is, or click any{' '}
            <span className="font-medium text-foreground">identifier in an answer</span> to fly
            here and land on it.{' '}
          </>
        )}
        Redrawn at your display's full resolution on every frame, from the
        same {tiles.dpi ?? 400} DPI rasters the vision pass read — so what you see here is what
        the extraction saw. Past 100% it is enlarging them; the{' '}
        {drawing?.source ? 'Source PDF' : 'vector original'} is vector and does not run out.
      </p>
    </div>
  )
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border px-1 py-px font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  )
}
