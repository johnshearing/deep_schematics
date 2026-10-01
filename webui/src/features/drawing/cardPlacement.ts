/**
 * Where the reader has dragged each of the Drawing tab's three cards to. Persisted, so a card
 * stays out of the way from one selection to the next and across a reload — every card is
 * remounted for every selection, pick or path, and a position kept in the card would be forgotten
 * the moment it closed. Null is a card's home corner: `bottom-3 left-3` for the selection and
 * conductor cards, `bottom-3 right-3` for the path card.
 *
 * **One place per card** (`talkthrough_03.md` §16 S3 Q1, the user's choice): the selection and
 * conductor cards share a home corner and take turns in it, and moving one out of the way is not
 * a reason to move the other. Where a card sits never decides which card shows (the corners rule).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Point } from '@/lib/useDraggable'

export type CardName = 'selection' | 'conductor' | 'path'

type CardPlacement = Record<CardName, Point | null> & {
  place: (card: CardName, at: Point | null) => void
}

export const useCardPlacement = create<CardPlacement>()(
  persist(
    (set) => ({
      selection: null,
      conductor: null,
      path: null,
      place: (card, at) => set({ [card]: at } as Partial<Record<CardName, Point | null>>),
    }),
    { name: 'drawing-card-placement' },
  ),
)
