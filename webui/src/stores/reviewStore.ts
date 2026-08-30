/**
 * The Review screen's state: one draft `label_corrections.json`, and the readings it is about.
 *
 * A second store beside `locateStore` rather than a section of it, and the reason is the same one
 * that put the corrections in their own file: **two screens writing one document through a
 * last-write-wins save is how a placement run and a review run would silently discard each other.**
 * `H1` is a known hazard with one editor; two editors over one draft would make it a certainty. So
 * there are two drafts, two `PUT`s, two files, and no overlap between them.
 *
 * Everything else is deliberately the same shape as `locateStore`, because the shape is what has
 * been walked and reported on:
 *
 * - **the draft is the whole file**, so there is no patch protocol to get wrong;
 * - **saving is debounced**, because correcting 278 readings is a run of keystrokes and a Save
 *   button turns a run into a habit that is remembered right up until it is not;
 * - **one write path** — `edit` — so scheduling the save cannot be forgotten at a call site.
 *
 * Two things it does **not** have, both on purpose.
 *
 * **No undo stack.** `Ctrl+Z` here is the *text box's*, which is what a person typing a string
 * expects, and every correction on this screen is one field of one row that the row itself still
 * shows: getting it back means reading the `was` beside it and typing it again. The Locate tab
 * needed a stack because a drag destroys a coordinate that is then nowhere on screen. If this turns
 * out to be wrong, the stack is the same eight lines inside `edit` that it is over there — the
 * pattern is proven and copying it later costs nothing.
 *
 * **No `stale` banner.** A correction changes nothing `author_circuit_logic.py` writes, and a server
 * test asserts the netlist is byte-identical with and without this file. Corrections are like paths
 * and end labels: authored, and free of regeneration.
 */

import { create } from 'zustand'

import { ApiError, editorUnlock, getReview, hasEditorPassword, putReview } from '@/api/client'
import type { CorrectionsDocument, ReviewCounts, ReviewItem, ReviewReport } from '@/api/types'
import * as model from '@/features/review/model'

/** The same 900 ms the Locate tab uses. A run of corrections is one write, and walking away from
 * the keyboard mid-row is safe. */
const SAVE_DEBOUNCE_MS = 900

export type SaveState = 'clean' | 'pending' | 'saving' | 'saved' | 'error'

interface ReviewState {
  /** Null until the screen has been unlocked and the file loaded. */
  document: CorrectionsDocument | null
  /** Every reading on the sheet, as the server resolved it — the corrections already applied. Not
   * derived from the draft: the draft says what a person decided, and this says what the ink is,
   * and only the server has read `geometry.json`. */
  items: ReviewItem[]
  counts: ReviewCounts | null
  report: ReviewReport | null
  unlocked: boolean
  loading: boolean
  /** Why the screen will not open — a wrong password, or a server started without
   * `SWUI_ALLOW_EDITS=true`, which has no route to answer. */
  error: string | null

  /** The reading being worked on: the sheet frames and rings its ink. Set by focusing a row's box,
   * so looking at a row and looking at its ink are one act rather than two. */
  currentId: string | null

  saveState: SaveState
  saveError: string | null

  unlock: (password: string) => Promise<boolean>
  load: (drawingNumber: string | null) => Promise<void>
  /** Re-read the ink and the corrections from the server. What a save does behind itself, so the
   * `text` on every row is the server's answer rather than this client's guess at it. */
  refresh: () => Promise<void>
  setCurrent: (id: string | null) => void
  /** The one write path. */
  edit: (change: (document: CorrectionsDocument) => CorrectionsDocument) => void
  save: () => Promise<void>
  reset: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useReviewStore = create<ReviewState>()((set, get) => ({
  document: null,
  items: [],
  counts: null,
  report: null,
  unlocked: false,
  loading: false,
  error: null,
  currentId: null,
  saveState: 'clean',
  saveError: null,

  unlock: async (password) => {
    set({ loading: true, error: null })
    try {
      await editorUnlock(password)
      set({ unlocked: true })
      return true
    } catch (error) {
      set({ error: message(error) })
      return false
    } finally {
      set({ loading: false })
    }
  },

  load: async (drawingNumber) => {
    set({ loading: true, error: null })
    try {
      const body = await getReview()
      set({
        // A drawing nobody has corrected anything on gets an empty document rather than a failure:
        // a fresh sheet and a half-reviewed one differ in content, not in kind.
        document: body.document
          ? { ...body.document, schema: model.SCHEMA }
          : model.emptyDocument(drawingNumber),
        items: body.items,
        counts: body.counts,
        report: body.report,
        unlocked: true,
        saveState: 'clean',
      })
    } catch (error) {
      // A 401 is the ordinary "not unlocked yet" state and the screen's password form is how it
      // gets there — not a failure worth shouting about.
      set({ error: error instanceof ApiError && error.status === 401 ? null : message(error) })
    } finally {
      set({ loading: false })
    }
  },

  refresh: async () => {
    try {
      const body = await getReview()
      set({ items: body.items, counts: body.counts, report: body.report })
    } catch {
      // Keep what we have. A failed refresh means one row's badge is a moment behind, which is a
      // great deal better than an emptied queue in the middle of a run.
    }
  },

  setCurrent: (currentId) => set({ currentId }),

  edit: (change) => {
    const current = get().document
    if (!current) return
    set({ document: change(current), saveState: 'pending', saveError: null })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void get().save(), SAVE_DEBOUNCE_MS)
  },

  save: async () => {
    clearTimeout(saveTimer)
    const document = get().document
    if (!document || get().saveState === 'clean') return
    set({ saveState: 'saving', saveError: null })
    try {
      const body = await putReview(document)
      // Only back to clean if nothing changed in flight, or a pending keystroke would sit unsaved
      // under a badge claiming everything was written.
      set((state) => ({
        report: body.report,
        saveState: state.document === document ? 'saved' : 'pending',
      }))
      if (get().saveState === 'pending') saveTimer = setTimeout(() => void get().save(), 0)
      // The rows' `text` and badges come from the server's resolution, so they are one save behind
      // until this returns. Cheap: it is the same cached `geometry.json` parse either way.
      void get().refresh()
    } catch (error) {
      set({ saveState: 'error', saveError: message(error) })
    }
  },

  reset: () => {
    clearTimeout(saveTimer)
    set({
      document: null,
      items: [],
      counts: null,
      report: null,
      unlocked: hasEditorPassword(),
      loading: false,
      error: null,
      currentId: null,
      saveState: 'clean',
      saveError: null,
    })
  },
}))

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
