/**
 * Where the reader has dragged the selection card to. Persisted, so it stays out of the way from
 * one selection to the next and across a reload — the card is remounted for every selection, and
 * a position kept in the card would be forgotten the moment it closed. Null is its home corner,
 * `bottom-3 left-3`.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Point } from '@/lib/useDraggable'

interface CardPlacement {
  selection: Point | null
  setSelection: (at: Point | null) => void
}

export const useCardPlacement = create<CardPlacement>()(
  persist((set) => ({ selection: null, setSelection: (selection) => set({ selection }) }), {
    name: 'drawing-card-placement',
  }),
)
