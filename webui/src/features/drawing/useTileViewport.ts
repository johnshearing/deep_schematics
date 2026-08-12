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
  isFitRef.current = isFit
  scaleRef.current = viewport.scale

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
    setIsFit(true)
    fitTo(element.clientWidth, element.clientHeight)
  }, [fitTo])

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
    [clampPan, clampScale],
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
      setIsFit(false)
      setViewport((current) => clampPan({ ...current, x: current.x + dx, y: current.y + dy }))
    },
    [clampPan],
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

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    pinchSpan.current = 0
  }, [])

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
