/**
 * Pan and zoom over a plane measured in PDF points.
 *
 * The viewport is three numbers — `screen = point × scale + offset` — and that is the whole
 * model. Keeping it as an explicit transform rather than letting the browser scroll a large
 * element is what makes the next features possible: a marker at `components[].location`, a
 * highlighted conductor from `geometry.json`, or "pan to CR-BP" from a citation are all the
 * same one-line conversion, and none of them can be expressed against a scroll position.
 *
 * It is also why this is a hook and not a component. The tile layer, the future overlay layer
 * and whatever draws the highlight all need the same transform, and only one of them owns it.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

export interface Viewport {
  /** Screen pixels from the container's top-left to the sheet's top-left. */
  x: number
  y: number
  /** Screen pixels per PDF point. Zero means "not measured yet" — the container is still
   * `display: none` behind an inactive tab, so there is nothing to fit to. */
  scale: number
}

interface Options {
  /** Sheet size in PDF points. */
  width: number
  height: number
  /** Resolution the tiles were rendered at. */
  dpi: number
}

/** Breathing room around a fitted sheet, in screen pixels. */
const PAD = 12
/** Breathing room around something the viewer has been told to *focus*. Much larger than
 * `PAD`, because a citation lands you somewhere you have not been looking and the surrounding
 * inch of drawing is how you work out where that is. */
const FOCUS_PAD = 90
/** Zoom for a focus target with no size of its own — a component, a terminal. Half of native
 * is where 4 pt lettering becomes readable and about a quarter of the sheet is still visible,
 * which is the balance between "I can read it" and "I can see what it is next to".
 *
 * Exported because it is also the ceiling above which the Locate tab refuses a flight: a flight
 * never zooms in past this, so from anywhere closer it can only zoom out. A caller that wants
 * that rule must read the number from here rather than restate `0.5`. */
export const FOCUS_ZOOM = 0.5
/** Long enough to be followed by eye, short enough not to be waited on. */
const FOCUS_MS = 420
/** Past its own resolution the raster only gets softer, but a little overzoom is how you read
 * a 4 pt terminal label. Now that native zoom means device pixels, this is a genuine upscale
 * rather than the accidental one the CSS-pixel definition used to hide. */
const MAX_OVERZOOM = 2
/** Keep at least this much of the sheet on screen, so it can never be flung out of reach. */
const KEEP_VISIBLE = 64
const WHEEL_SENSITIVITY = 0.0015
const BUTTON_STEP = 1.4
const KEY_PAN = 60

/**
 * Device pixels per CSS pixel, kept current.
 *
 * It is not a constant: dragging the window to a monitor with a different pixel density
 * changes it, and neither a resize nor a re-render necessarily follows. The idiom is to match
 * a media query against the *present* value and re-arm when it stops matching.
 */
export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(`(resolution: ${dpr}dppx)`)
    const onChange = () => setDpr(window.devicePixelRatio || 1)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [dpr])

  return dpr
}

export type Rect = readonly [number, number, number, number]

/**
 * The zoom at which a rectangle of the sheet fills the container, with `FOCUS_PAD` to spare.
 *
 * A component's rectangle is a single point — `components[].location` is all this extraction
 * records — so a degenerate rectangle is the *common* case, not an edge case: it falls back to
 * `FOCUS_ZOOM`. A net's rectangle spans everything it touches, and framing that can mean
 * zooming out, which is correct: "where is net 110" is a question about a region.
 *
 * Pure and exported because this is the arithmetic that decides whether a citation lands
 * somewhere useful, and the animation around it cannot be asserted on in jsdom.
 */
export function focusScale(rect: Rect, container: { width: number; height: number },
                           nativeScale: number): number {
  const [x0, y0, x1, y1] = rect
  const available = {
    width: Math.max(container.width - FOCUS_PAD * 2, 1),
    height: Math.max(container.height - FOCUS_PAD * 2, 1),
  }
  const span = { width: x1 - x0, height: y1 - y0 }
  const toFit =
    span.width > 0 || span.height > 0
      ? Math.min(
          span.width > 0 ? available.width / span.width : Infinity,
          span.height > 0 ? available.height / span.height : Infinity,
        )
      : Infinity
  return Math.min(toFit, nativeScale * FOCUS_ZOOM)
}

/** The viewport that puts the middle of `rect` in the middle of the container, at `scale`. */
export function centreOn(rect: Rect, container: { width: number; height: number },
                         scale: number): Viewport {
  const [x0, y0, x1, y1] = rect
  return {
    scale,
    x: container.width / 2 - ((x0 + x1) / 2) * scale,
    y: container.height / 2 - ((y0 + y1) / 2) * scale,
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useTileViewport({ width, height, dpi }: Options) {
  const ref = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 0 })
  const [isFit, setIsFit] = useState(true)
  /** Container size in CSS pixels — the canvas needs it to size its backing store. */
  const [size, setSize] = useState({ width: 0, height: 0 })

  const dpr = useDevicePixelRatio()

  /**
   * The zoom at which one tile pixel covers one **device** pixel.
   *
   * The `/ dpr` is the correction that made the toolbar percentage mean something. Without it
   * "100%" was one tile pixel per *CSS* pixel, which on a 2× display is already a 2× upscale
   * on the physical panel — so the readout claimed native resolution at the point the image
   * had started to soften, and the 200% cap was a 4× upscale.
   */
  const nativeScale = dpi / 72 / dpr

  // Mirrors of state for the listeners, which are bound once and must not close over a stale
  // render. `fitScale` also sets the zoom-out floor: you cannot shrink the sheet to a speck.
  const fitScale = useRef(0)
  const isFitRef = useRef(true)
  const scaleRef = useRef(0)
  const viewportRef = useRef(viewport)
  isFitRef.current = isFit
  scaleRef.current = viewport.scale
  viewportRef.current = viewport

  /**
   * The in-flight `panTo` animation.
   *
   * Any deliberate gesture wins over it — an animation that keeps flying while the reader is
   * dragging is a fight for the transform, and the reader loses. So every entry point below
   * cancels it first.
   */
  const animation = useRef(0)
  const stopAnimation = useCallback(() => {
    if (animation.current) cancelAnimationFrame(animation.current)
    animation.current = 0
  }, [])
  useEffect(() => stopAnimation, [stopAnimation])

  const clampScale = useCallback(
    (scale: number) => {
      const floor = fitScale.current > 0 ? fitScale.current * 0.5 : 0.01
      return Math.min(Math.max(scale, floor), nativeScale * MAX_OVERZOOM)
    },
    [nativeScale],
  )

  /** Stop the sheet being dragged off the edge of the world. */
  const clampPan = useCallback(
    (next: Viewport): Viewport => {
      const element = ref.current
      if (!element) return next
      const sheetW = width * next.scale
      const sheetH = height * next.scale
      const margin = Math.min(KEEP_VISIBLE, sheetW / 2, sheetH / 2)
      return {
        scale: next.scale,
        x: Math.min(Math.max(next.x, margin - sheetW), element.clientWidth - margin),
        y: Math.min(Math.max(next.y, margin - sheetH), element.clientHeight - margin),
      }
    },
    [width, height],
  )

  const fitTo = useCallback(
    (cw: number, ch: number) => {
      if (cw <= 0 || ch <= 0) return
      const scale = Math.min((cw - PAD * 2) / width, (ch - PAD * 2) / height)
      if (!(scale > 0)) return
      fitScale.current = scale
      setViewport({ scale, x: (cw - width * scale) / 2, y: (ch - height * scale) / 2 })
    },
    [width, height],
  )

  const fit = useCallback(() => {
    const element = ref.current
    if (!element) return
    stopAnimation()
    setIsFit(true)
    fitTo(element.clientWidth, element.clientHeight)
  }, [fitTo, stopAnimation])

  /**
   * Fly to a rectangle of the sheet. The inverse of `zoomAt`, and the whole point of the
   * exercise: "the blue 18AWG wire from `CR-BP:A2`" stops being text you translate and becomes
   * a place you are taken.
   *
   * Animated rather than jumped, and the animation interpolates the *centre in PDF space*
   * rather than the pixel offsets — so the target stays under the middle of the container the
   * whole way, and the sheet appears to move as one thing. A jump does arrive, but it leaves
   * the reader with no idea which direction they came from, which is exactly the disorientation
   * this feature exists to remove. `prefers-reduced-motion` gets the jump.
   */
  const panTo = useCallback(
    (rect: Rect) => {
      const element = ref.current
      const from = viewportRef.current
      if (!element || !(from.scale > 0)) return
      const container = { width: element.clientWidth, height: element.clientHeight }
      const scale = clampScale(focusScale(rect, container, nativeScale))
      const target = clampPan(centreOn(rect, container, scale))

      stopAnimation()
      setIsFit(false)
      if (prefersReducedMotion()) {
        setViewport(target)
        return
      }

      const start = performance.now()
      const centre = {
        from: {
          x: (container.width / 2 - from.x) / from.scale,
          y: (container.height / 2 - from.y) / from.scale,
        },
        to: { x: (rect[0] + rect[2]) / 2, y: (rect[1] + rect[3]) / 2 },
      }
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / FOCUS_MS)
        if (t >= 1) {
          animation.current = 0
          setViewport(target)
          return
        }
        const eased = 1 - (1 - t) ** 3
        // Zoom is geometric, so interpolate it that way: linear scale makes the last third of
        // a big zoom-in crawl.
        const at = from.scale * (scale / from.scale) ** eased
        const cx = centre.from.x + (centre.to.x - centre.from.x) * eased
        const cy = centre.from.y + (centre.to.y - centre.from.y) * eased
        setViewport(
          clampPan({
            scale: at,
            x: container.width / 2 - cx * at,
            y: container.height / 2 - cy * at,
          }),
        )
        animation.current = requestAnimationFrame(step)
      }
      animation.current = requestAnimationFrame(step)
    },
    [clampPan, clampScale, nativeScale, stopAnimation],
  )

  /**
   * Re-fit while the reader has not taken control.
   *
   * Two cases, and the second is the one that is easy to miss: the tab is `display: none`
   * until it is first selected, so the container measures 0×0 and the initial fit is
   * impossible. `ResizeObserver` fires again the moment it becomes visible, which is exactly
   * when the sheet can be sized — hence the `scaleRef` clause, which fits once even if the
   * reader has already zoomed a *previous* sheet.
   */
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      const cw = element.clientWidth
      const ch = element.clientHeight
      setSize({ width: cw, height: ch })
      if (isFitRef.current || scaleRef.current === 0) fitTo(cw, ch)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [fitTo])

  /** Zoom about a point in container coordinates, so what is under the cursor stays there. */
  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      stopAnimation()
      setIsFit(false)
      setViewport((current) => {
        if (current.scale <= 0) return current
        const scale = clampScale(current.scale * factor)
        const ratio = scale / current.scale
        return clampPan({
          scale,
          x: px - (px - current.x) * ratio,
          y: py - (py - current.y) * ratio,
        })
      })
    },
    [clampPan, clampScale, stopAnimation],
  )

  const zoomAtClient = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      zoomAt(clientX - rect.left, clientY - rect.top, factor)
    },
    [zoomAt],
  )

  /** Zoom about the middle of the viewport — what the toolbar buttons mean. */
  const zoomBy = useCallback(
    (factor: number) => {
      const element = ref.current
      if (!element) return
      zoomAt(element.clientWidth / 2, element.clientHeight / 2, factor)
    },
    [zoomAt],
  )

  const panBy = useCallback(
    (dx: number, dy: number) => {
      stopAnimation()
      setIsFit(false)
      setViewport((current) => clampPan({ ...current, x: current.x + dx, y: current.y + dy }))
    },
    [clampPan, stopAnimation],
  )

  // Non-passive, because a wheel over the sheet must zoom rather than scroll the page, and a
  // React `onWheel` is registered passive — `preventDefault()` inside one is ignored.
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      // A trackpad pinch arrives as a wheel event with ctrlKey set; both mean zoom here.
      const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      zoomAtClient(event.clientX, event.clientY, Math.exp(-step * WHEEL_SENSITIVITY))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [zoomAtClient])

  /**
   * One pointer pans, two pinch — which is the whole gesture vocabulary a gloved hand on a
   * tablet has, and `webui_ideas.md` §8 puts the point of use on a shop floor rather than a
   * desk. Pointer events give mouse, touch and pen in one code path.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchSpan = useRef(0)

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      // A hand on the sheet outranks a flight already in progress.
      stopAnimation()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      pinchSpan.current = 0
    },
    [stopAnimation],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = pointers.current
      const previous = active.get(event.pointerId)
      if (!previous) return
      const next = { x: event.clientX, y: event.clientY }
      active.set(event.pointerId, next)

      if (active.size === 1) {
        panBy(next.x - previous.x, next.y - previous.y)
        return
      }
      if (active.size !== 2) return

      const [a, b] = [...active.values()]
      const span = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinchSpan.current > 0 && span > 0) {
        zoomAtClient((a.x + b.x) / 2, (a.y + b.y) / 2, span / pinchSpan.current)
      }
      pinchSpan.current = span
    },
    [panBy, zoomAtClient],
  )

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    // Lifting one finger of a pinch must not be read as a huge pan on the next move.
    pinchSpan.current = 0
  }, [])

  const onDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => zoomAtClient(event.clientX, event.clientY, 2),
    [zoomAtClient],
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const keys: Record<string, () => void> = {
        '+': () => zoomBy(BUTTON_STEP),
        '=': () => zoomBy(BUTTON_STEP),
        '-': () => zoomBy(1 / BUTTON_STEP),
        '0': fit,
        Home: fit,
        ArrowLeft: () => panBy(KEY_PAN, 0),
        ArrowRight: () => panBy(-KEY_PAN, 0),
        ArrowUp: () => panBy(0, KEY_PAN),
        ArrowDown: () => panBy(0, -KEY_PAN),
      }
      const action = keys[event.key]
      if (!action) return
      event.preventDefault()
      action()
    },
    [fit, panBy, zoomBy],
  )

  return {
    /** Attach to the clipping container. Everything is measured against it. */
    containerRef: ref,
    viewport,
    /** Container size in CSS pixels, and the device-pixel ratio to render it at. */
    size,
    dpr,
    /** True while the sheet is auto-fitting to the container, including across a resize. */
    isFit,
    /** Zoom as a percentage of the tiles' own resolution: 100% is one tile pixel per **device**
     * pixel, and the sharpest these rasters go. */
    percent: viewport.scale > 0 ? Math.round((viewport.scale / nativeScale) * 100) : 0,
    fit,
    /** Fly to a rectangle in PDF points. What a citation and a marker both end up calling. */
    panTo,
    zoomIn: () => zoomBy(BUTTON_STEP),
    zoomOut: () => zoomBy(1 / BUTTON_STEP),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick,
      onKeyDown,
    },
  }
}
