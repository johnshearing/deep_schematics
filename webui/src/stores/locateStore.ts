/**
 * The Locate editor's state: one draft `locations.json`, and what is being placed into it.
 *
 * Separate from `appStore` on purpose. `appStore` holds what everyone reads — the drawing, the
 * designator index, the selection — and every tab depends on it. This holds a document only one
 * tab can even load, behind a password most sessions will never have, and nothing else in the
 * application should have to know it exists.
 *
 * **The draft is the whole file.** Every mutation returns a new document and the save sends all
 * of it, so there is no patch protocol to get wrong and no half-applied state to recover from.
 * `locations.json` is a text file a human can also open; it stays one.
 *
 * **Saving is debounced, not manual.** Placing 131 terminals is a run of clicks, and a Save
 * button turned that run into a run plus a habit of pressing Save — which is exactly the sort of
 * thing that is remembered right up until the moment it is not. So a change schedules a write,
 * the status line says where the write got to, and the button is there for anyone who wants to
 * force it. The server's write is atomic, so a save landing mid-run costs nothing.
 */

import { create } from 'zustand'

import { ApiError, editorUnlock, getLocations, hasEditorPassword, putLocations } from '@/api/client'
import type { Compass, LocationsDocument, LocationsReport } from '@/api/types'
import * as model from '@/features/locate/model'
import type { Stamp, Target } from '@/features/locate/model'
import { useAppStore } from '@/stores/appStore'

/** Long enough that a run of placements is one write, short enough that walking away from the
 * keyboard for a moment is safe. */
const SAVE_DEBOUNCE_MS = 900

export type SaveState = 'clean' | 'pending' | 'saving' | 'saved' | 'error'

interface LocateState {
  /** Null until the editor has been unlocked and the file loaded. */
  document: LocationsDocument | null
  report: LocationsReport | null
  unlocked: boolean
  loading: boolean
  /** Why the editor will not open — a wrong password, or a server that was not started with
   * `SWUI_ALLOW_EDITS=true` and so has no route to answer. */
  error: string | null

  /** What the next click on the sheet places. */
  target: Target | null
  /**
   * Move to the next unplaced row after each placement.
   *
   * **Off by default**, and deliberately: the advance is what turns a long run of placements into
   * one gesture, but it is also the only control here that moves the target without being asked,
   * and a person who has not met it yet reads that as the editor losing their place. So it is
   * opt-in — tick it when you sit down to walk the list, and the sheet stays where you put it
   * until you do.
   */
  advance: boolean

  saveState: SaveState
  saveError: string | null
  /** Set after the first successful write: `circuit_logic.json` is behind until the generator
   * is re-run, and the editor says so rather than running Python from a web request. */
  stale: string | null

  unlock: (password: string) => Promise<boolean>
  load: (drawingNumber: string | null, pageSize: [number, number] | null) => Promise<void>
  setTarget: (target: Target | null) => void
  setAdvance: (advance: boolean) => void
  /** Apply a mutation from `model.ts`. The one write path, so scheduling the save and marking
   * the draft dirty cannot be forgotten at a call site. */
  edit: (change: (document: LocationsDocument) => LocationsDocument) => void
  /** `kind` only picks which section of the file a wire-or-net label lands in. */
  place: (point: [number, number], stamp: Stamp, kind?: string) => void
  setLabelDir: (target: Target, dir: Compass | null) => void
  clear: (target: Target) => void
  save: () => Promise<void>
  reset: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useLocateStore = create<LocateState>()((set, get) => ({
  document: null,
  report: null,
  unlocked: false,
  loading: false,
  error: null,
  target: null,
  advance: false,
  saveState: 'clean',
  saveError: null,
  stale: null,

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

  load: async (drawingNumber, pageSize) => {
    set({ loading: true, error: null })
    try {
      const body = await getLocations()
      set({
        // An extraction nobody has placed anything on gets an empty document rather than a
        // failure: a fresh drawing and a half-placed one differ in content, not in kind.
        document: body.document ?? model.emptyDocument(drawingNumber, pageSize),
        report: body.report,
        unlocked: true,
        saveState: 'clean',
      })
    } catch (error) {
      // A 401 here is the ordinary "not unlocked yet" state, not a failure worth shouting
      // about — the tab shows its password form and this is how it gets there.
      set({ error: error instanceof ApiError && error.status === 401 ? null : message(error) })
    } finally {
      set({ loading: false })
    }
  },

  setTarget: (target) => set({ target }),
  setAdvance: (advance) => set({ advance }),

  edit: (change) => {
    const current = get().document
    if (!current) return
    set({ document: change(current), saveState: 'pending', saveError: null })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void get().save(), SAVE_DEBOUNCE_MS)
  },

  place: (point, stamp, kind = 'wire') => {
    const target = get().target
    if (!target) return
    get().edit((document) => model.place(document, target, point, stamp, kind))
  },

  setLabelDir: (target, dir) => get().edit((d) => model.setLabelDir(d, target, dir)),
  clear: (target) => get().edit((d) => model.clear(d, target)),

  save: async () => {
    clearTimeout(saveTimer)
    const document = get().document
    if (!document || get().saveState === 'clean') return
    set({ saveState: 'saving', saveError: null })
    try {
      const body = await putLocations(document)
      // Only back to clean if nothing changed while the request was in flight; otherwise the
      // pending edit would sit unsaved with the status line claiming everything was written.
      set((state) => ({
        report: body.report,
        stale: body.stale,
        saveState: state.document === document ? 'saved' : 'pending',
      }))
      if (get().saveState === 'pending') saveTimer = setTimeout(() => void get().save(), 0)
      // The file on disk is now right and `/api/designators` is one save behind, so the Drawing
      // tab would go on drawing the estimate. Reaching across to `appStore` rather than making
      // every reader poll: this is the only thing in the application that changes geometry.
      void useAppStore.getState().refreshDesignators()
    } catch (error) {
      set({ saveState: 'error', saveError: message(error) })
    }
  },

  reset: () => {
    clearTimeout(saveTimer)
    set({
      document: null,
      report: null,
      unlocked: hasEditorPassword(),
      loading: false,
      error: null,
      target: null,
      saveState: 'clean',
      saveError: null,
      stale: null,
    })
  },
}))

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
