/**
 * A floating panel you can move by its title bar. `talkthrough_01.md` §6.2.
 *
 * The position is the caller's to keep (the talkthrough persists it), so this hook holds only
 * the drag in flight and reports where the panel came to rest. Three rules:
 *
 * - **It never lets the handle leave the window** (or, for an `absolute` panel, its parent). At least `keep` pixels of the title bar stay
 *   on screen, and a stored position is re-clamped on every resize — a panel left at x=1800 on a
 *   large monitor is still reachable on a laptop.
 * - **Double-click the handle to put it back** (`onMove(null)`, the caller's default corner).
 * - **A press on the handle is the handle's.** `pointerdown` stops propagating, so a drag that
 *   happens to start over the sheet can never also pan it.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

export interface Point { x: number; y: number }

/** The area a panel moves in, and where its (0, 0) is on screen. */
interface Area { left: number; top: number; width: number; height: number }

export function clampToArea(p: Point, width: number, area: Pick<Area, 'width' | 'height'>, keep = 48): Point {
  const maxX = Math.max(0, area.width - keep)
  const minX = Math.min(0, keep - width)
  const maxY = Math.max(0, area.height - keep)
  return { x: Math.min(maxX, Math.max(minX, p.x)), y: Math.min(maxY, Math.max(0, p.y)) }
}

export function clampToWindow(p: Point, width: number, keep = 48): Point {
  return clampToArea(p, width, { width: window.innerWidth, height: window.innerHeight }, keep)
}

export interface DraggableOptions {
  /** `'window'` for a `position: fixed` panel (the default); `'parent'` for an `absolute` one,
   * which moves within, and is measured from, its offset parent. */
  within?: 'window' | 'parent'
  /** The style when no position is stored: the panel's default corner. */
  home?: CSSProperties
  keep?: number
}

export function useDraggable<T extends HTMLElement>(
  position: Point | null,
  onMove: (position: Point | null) => void,
  { within = 'window', home = { top: 12, right: 12 }, keep = 48 }: DraggableOptions = {},
) {
  const ref = useRef<T>(null)
  const [live, setLiveState] = useState<Point | null>(null)
  const liveRef = useRef<Point | null>(null)
  const setLive = (at: Point | null) => {
    liveRef.current = at
    setLiveState(at)
  }
  const grab = useRef<{ dx: number; dy: number; id: number; moved: boolean } | null>(null)

  const width = () => ref.current?.getBoundingClientRect().width ?? 0
  const area = useCallback((): Area => {
    const parent = within === 'parent' ? (ref.current?.offsetParent as HTMLElement | null) : null
    if (!parent) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    const rect = parent.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: parent.clientWidth, height: parent.clientHeight }
  }, [within])

  // A stored position that no longer fits — a smaller window, or one that just shrank.
  useEffect(() => {
    const reclamp = () => {
      if (!position) return
      const fitted = clampToArea(position, width(), area(), keep)
      if (fitted.x !== position.x || fitted.y !== position.y) onMove(fitted)
    }
    reclamp()
    window.addEventListener('resize', reclamp)
    return () => window.removeEventListener('resize', reclamp)
  }, [position, onMove, keep, area])

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    event.stopPropagation()
    if (event.button !== 0 || !ref.current) return
    // Buttons on the title bar (mute, close) are buttons, not handles.
    if ((event.target as HTMLElement).closest('button')) return
    const rect = ref.current.getBoundingClientRect()
    const origin = area()
    grab.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, id: event.pointerId, moved: false }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setLive({ x: rect.left - origin.left, y: rect.top - origin.top })
  }, [area])

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!grab.current || grab.current.id !== event.pointerId) return
      grab.current.moved = true
      const { dx, dy } = grab.current
      const origin = area()
      setLive(clampToArea({ x: event.clientX - dx - origin.left, y: event.clientY - dy - origin.top }, width(), origin, keep))
    },
    [keep, area],
  )

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!grab.current || grab.current.id !== event.pointerId) return
      const { moved } = grab.current
      grab.current = null
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      const at = liveRef.current
      setLive(null)
      // A press that never moved is a click (or half a double-click), not a new place to keep.
      if (at && moved) onMove(at)
    },
    [onMove],
  )

  const onDoubleClick = useCallback(() => onMove(null), [onMove])

  const at = live ?? position
  // `right`/`bottom` cleared, or a class that sets them would stretch the panel between the two.
  const style: CSSProperties = at ? { left: at.x, top: at.y, right: 'auto', bottom: 'auto' } : home

  return {
    ref,
    style,
    dragging: live !== null,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onDoubleClick },
  }
}
