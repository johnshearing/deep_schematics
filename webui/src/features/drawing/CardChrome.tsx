/**
 * What every floating card on the Drawing tab has in common: **a grip to move it by, and a button
 * that copies what it says.** Asked for on 2026-09-28 for the selection card and then for the
 * other two (`talkthrough_03.md` §6), so it lives here once rather than three times.
 *
 * A card calls `useCardDrag(name)` for its ref, style and handle, spreads `CardGrip` along its top
 * and puts `CopyCard` beside its ✕. Its position is its own (`cardPlacement.ts`), within the sheet
 * and never off it; double-click the grip for its home corner.
 */

import { useCallback, useRef, useState } from 'react'
import { Check, Copy, GripHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useDraggable } from '@/lib/useDraggable'
import type { Point } from '@/lib/useDraggable'
import { cn } from '@/lib/utils'
import { useCardPlacement, type CardName } from './cardPlacement'

/** The drag for one card, remembered under its own name. */
export function useCardDrag(card: CardName) {
  const placed = useCardPlacement((s) => s[card])
  const placeCard = useCardPlacement((s) => s.place)
  // Stable, because the hook re-clamps in an effect that depends on it.
  const place = useCallback((at: Point | null) => placeCard(card, at), [placeCard, card])
  return useDraggable<HTMLDivElement>(placed, place, { within: 'parent', home: {} })
}

/** The strip along a card's top. The card's own padding-top is `pt-0`, so this sits flush. */
export function CardGrip({
  handleProps,
  dragging,
  testId,
}: {
  handleProps: ReturnType<typeof useCardDrag>['handleProps']
  dragging: boolean
  testId: string
}) {
  return (
    <div
      {...handleProps}
      data-testid={testId}
      title="Drag to move · double-click to put it back"
      className={cn(
        '-mx-3 mb-1.5 flex touch-none justify-center rounded-t-lg py-0.5 text-muted-foreground select-none',
        'hover:bg-accent/50',
        dragging ? 'cursor-grabbing' : 'cursor-move',
      )}
    >
      <GripHorizontal className="size-3.5" />
    </div>
  )
}

/** Copy what the card says, as plain text laid out as it reads — `innerText`, where a browser has
 * one, keeps the line breaks that `textContent` loses. */
export function CopyCard({ card }: { card: React.RefObject<HTMLDivElement | null> }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copy = async () => {
    const element = card.current
    if (!element) return
    const text = (element.innerText ?? element.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Button variant="ghost" size="icon" aria-label="Copy the card's text" title="Copy this card's text" onClick={copy}>
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}
