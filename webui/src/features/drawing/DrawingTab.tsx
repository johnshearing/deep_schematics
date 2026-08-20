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
 * the tiles (`TileSheet`, a canvas), the things you can click (`MarkerLayer`, DOM), and what is
 * currently selected (`SelectionCard`). It owns none of that logic — the selection lives in
 * `appStore` because half of it is raised from the answer on the other tab, and the projection
 * lives in `paint.ts` because the markers and the tiles must not disagree about where a point is.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleDot,
  Crosshair,
  ExternalLink,
  ImageOff,
  Map,
  Maximize2,
  Minus,
  Plus,
  Tag,
} from 'lucide-react'

import { SOURCE_URL } from '@/api/client'
import type { Designator, DesignatorKind } from '@/api/types'
import { Button } from '@/components/ui/button'
import { normalise, suggestedQuestion } from '@/lib/designators'
import { isTextField } from '@/lib/keys'
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

/**
 * The three kinds of dot this sheet can show — the same three groups the Locate tab filters its
 * list by, and deliberately the same words.
 *
 * **Toggles, not one exclusive choice, and that is the one difference from the Locate tab.** Over
 * there the filter picks which rows you are *working through*, so exactly one at a time is what you
 * want. Here you are reading, and the useful questions are comparisons: is that pin on the same
 * conductor row as its relay, is `W048`'s printed name anywhere near the run it belongs to. Both
 * halves of a comparison have to be on screen at once, so each group is its own switch. It is also
 * a superset of the exclusive version — turn two off and you have filtered to the third — and it
 * keeps the thing the single `Components` switch was originally for: turning everything off to look
 * at the drawing itself.
 *
 * Only components start on, so the sheet looks the way it always has until you ask for more. That
 * matters more here than it sounds: this drawing has 47 components and 131 terminals, and most of
 * those terminals have no point of their own, so *Terminals* on its own draws a hollow dot on top
 * of each component's dot. Honest — the tooltip says whose point it really is — but it is a fog,
 * and nobody should meet it without having asked.
 */
type Layer = 'components' | 'terminals' | 'labels'

/** The two kinds whose position on the sheet is where their *name* is printed, never a route. */
const LABELLED: ReadonlySet<DesignatorKind> = new Set<DesignatorKind>(['wire', 'net'])

const LAYERS: {
  id: Layer
  label: string
  Icon: typeof Crosshair
  /** The tooltip. `shown` is how many have somewhere honest to sit; `total` how many the index
   * holds. The gap between the two is the point of saying both. */
  note: (shown: number, total: number) => string
}[] = [
  {
    id: 'components',
    label: 'Components',
    Icon: Crosshair,
    note: (shown, total) =>
      `${shown} of the ${total} components have a location on this sheet. Click one to see what ` +
      `it is.`,
  },
  {
    id: 'terminals',
    label: 'Terminals',
    Icon: CircleDot,
    note: (shown, total) =>
      `${shown} of the ${total} terminals have a point to draw. A hollow dot is its component's ` +
      `own point standing in for a pin nobody has placed, so it sits on the component's dot — ` +
      `zoom in, or place the pin on the Locate tab.`,
  },
  {
    id: 'labels',
    label: 'Wire & net labels',
    Icon: Tag,
    note: (shown, total) =>
      `${shown} of the ${total} wires and nets have had the place their name is printed put on ` +
      `record. That is all a wire or a net can carry here: its route is its two endpoint ` +
      `terminals, and this system never draws a line no conductor joined.`,
  },
]

/**
 * A wire or a net drawn where its **name** is printed, or null if nobody has said where that is.
 *
 * A component or a terminal has a point, so it gets a dot. A net's `point` is the centre of
 * everything it touches and a wire's is the middle of its run; both are useful rectangles to frame
 * and **neither is a place on the sheet**, so a dot there would sit on blank paper and claim to be
 * net 110. They get a marker only once somebody has placed a `label_point` — where the name is
 * actually written — and then it sits on the text.
 */
function atLabelPoint(entry: Designator): Designator | null {
  if (!entry.label_point) return null
  return {
    ...entry,
    point: entry.label_point,
    places: [{ point: entry.label_point, placement: 'confirmed', label_dir: entry.label_dir }],
  }
}

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

  /** One switch per group, and the initial state is exactly the view this tab has always had. */
  const [shown, setShown] = useState<Record<Layer, boolean>>({
    components: true,
    terminals: false,
    labels: false,
  })

  /** Every group, whether or not it is switched on: the toolbar needs the counts of the hidden
   * ones to offer them, and `located` below has to keep answering for components regardless. */
  const layers = useMemo<Record<Layer, { markers: Designator[]; total: number }>>(() => {
    const entries = designators?.entries ?? []
    const counts = designators?.counts ?? {}
    const components = entries.filter((e) => e.kind === 'component' && e.point)
    const terminals = entries.filter((e) => e.kind === 'terminal' && e.point)
    const labels = entries
      .filter((e) => LABELLED.has(e.kind))
      .map(atLabelPoint)
      .filter((e): e is Designator => e !== null)
    return {
      components: { markers: components, total: counts.component ?? components.length },
      terminals: { markers: terminals, total: counts.terminal ?? terminals.length },
      labels: {
        markers: labels,
        total: (counts.wire ?? 0) + (counts.net ?? 0) || labels.length,
      },
    }
  }, [designators])

  /**
   * Which component ids the selection card may offer as links, and it is **not** the same question
   * as which dots are drawn. A net's card lists every component it runs through; those buttons are
   * live for the ones the sheet knows a place for and dead for the off-page machines. Switching the
   * Components layer off is about what you want to look at, and must not silently kill those links.
   */
  const located = useMemo(
    () => new Set(layers.components.markers.map((m) => m.id)),
    [layers.components.markers],
  )

  const entry = selection ? (byToken.get(normalise(selection.id)) ?? null) : null
  const relatedIds = useMemo(() => new Set(entry?.members ?? []), [entry])
  /** A marker for the selection itself — at its own point, under its own name, and only where
   * there is a real place to put one. See `atLabelPoint` for the wire and net case. */
  const selectedMarker = useMemo<Designator | null>(() => {
    if (!entry) return null
    if (entry.kind === 'component' || entry.kind === 'terminal') return entry.point ? entry : null
    return atLabelPoint(entry)
  }, [entry])

  /**
   * The dots, group by group.
   *
   * A group that is switched **off** still contributes anything the selection runs through: hiding
   * the thing an answer just pointed at is the one case where the overlay has to be visible, and it
   * is why this is a filter per group rather than one `markers` list gated on a boolean.
   */
  const markers = useMemo(
    () =>
      LAYERS.flatMap(({ id }) =>
        shown[id]
          ? layers[id].markers
          : layers[id].markers.filter((m) => relatedIds.has(m.id)),
      ),
    [layers, relatedIds, shown],
  )

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

  /**
   * **Escape is the ✕ on the selection card.** Nothing selected, no ring, no card.
   *
   * The same rule as the Locate tab's Escape (see `LocateTab.tsx`), and for the same reason: a
   * selection is a *mode* — it rings a dot, keeps that dot visible through the Components toggle,
   * and holds a card over the bottom-left corner of the sheet — and a mode needs a way out that
   * is not a small target in a corner. Reaching for the ✕ costs a pointer trip away from the
   * thing being read.
   *
   * On `window` rather than on the sheet, because the selection usually arrived from a citation
   * on the *other* tab, and nothing here has focus after that. Guarded by the active tab so a
   * keypress meant for the Locate editor cannot clear this one, and by the same text-field rule,
   * so an Escape pressed in a box (the unlock field, the composer) is that box's first.
   */
  useEffect(() => {
    if (activeTabId !== DRAWING_TAB_ID) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (isTextField(event.target)) {
        event.target.blur()
        return
      }
      // Nothing selected is not this tab's Escape to swallow: a dialog elsewhere may want it.
      if (!useAppStore.getState().selection) return
      event.preventDefault()
      clearSelection()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTabId, clearSelection])

  const ask = useCallback(() => {
    if (!entry) return
    setComposerText(suggestedQuestion(entry))
    setActiveTab(ASK_TAB_ID)
  }, [entry, setActiveTab, setComposerText])

  /**
   * **The marker's own kind, not `'component'`.** It was hard-coded while components were the only
   * things with dots, and the moment terminals and labels got them that constant became a lie: a
   * click on `CR-BP:A1` would have raised `{kind: 'component', id: 'CR-BP:A1'}`, and every consumer
   * of a selection switches on `kind`. The lookup that feeds the card is by id and would have
   * papered over it here, which is exactly what makes it worth naming.
   */
  const onMarker = useCallback(
    (marker: Designator) => select(marker.kind, marker.id, 'drawing'),
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
          {/* A group with nothing to draw offers no switch — a pressed `Wire & net labels` that
              changed nothing on the sheet would read as broken rather than as empty. The Locate
              tab is where those labels come from, so the honest answer is that there are none
              yet, and the toolbar says it by having no button. */}
          {LAYERS.map(({ id, label, Icon, note }) =>
            layers[id].markers.length === 0 ? null : (
              <Button
                key={id}
                /* **Filled when the group is on**, which is how the Locate tab has drawn its own
                   filter buttons since it was written. It was `aria-pressed` plus a slightly
                   brighter word before, and with three ghost buttons side by side that is not a
                   state you can read: "which filters are in effect" became a question you
                   answered by studying the sheet — the very thing the switches change. Any
                   combination is legal here, so the answer has to be legible on all three at
                   once, not inferred from the odd one out. */
                variant={shown[id] ? 'default' : 'ghost'}
                size="sm"
                aria-pressed={shown[id]}
                onClick={() => setShown((on) => ({ ...on, [id]: !on[id] }))}
                title={note(layers[id].markers.length, layers[id].total)}
                className="h-8"
              >
                <Icon />
                {label}
              </Button>
            ),
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

            `selected` is the whole entry rather than a component id. The tab used to compute
            `entry.kind === 'component' ? entry.id : null` and let the parent component's marker
            stand in for a selected terminal, so clicking a citation of `CR-ON:A2` ringed a dot
            labelled `CR-ON` sitting on A1. A terminal is not its component; it gets its own
            marker, at whatever point the index resolved for it, saying so. */}
        {armed && (
          <MarkerLayer
            markers={markers}
            viewport={viewer.viewport}
            dpr={viewer.dpr}
            selected={selectedMarker}
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
        arrow keys nudge · <Key>Esc</Key> clears the selection · <Key>F2</Key> switches between
        this tab and Ask.{' '}
        {layers.components.markers.length > 0 && (
          <>
            <span className="font-medium text-foreground">Components</span>,{' '}
            <span className="font-medium text-foreground">Terminals</span> and{' '}
            <span className="font-medium text-foreground">Wire &amp; net labels</span> above are
            three independent switches — the same three groups the Locate tab filters by. Click any
            dot for what it is, or click any{' '}
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
