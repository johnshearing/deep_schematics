/**
 * The wiring editor's state: one draft `wiring.json`, and which end slot the next click fills.
 *
 * ### Its own store over its own document, and that is `H18` rather than an oversight
 *
 * There are now **three** whole-document drafts in this application — `locateStore` over
 * `locations.json`, `reviewStore` over `label_corrections.json`, and this over `wiring.json`. That
 * is deliberate and it is the safer of the two arrangements: three files, three drafts, no
 * overlap, rather than one store over documents written from two screens, which would make `H1`
 * fire between the wiring panel and the placement list as a matter of course.
 *
 * **The three must not learn about each other.** Two of them are edited from the *same screen*
 * now, which is a narrower exposure than a second tab and is the strongest reason yet to keep the
 * wiring editor on the Locate tab — but it is also the closest this rule has come to being tested.
 * The seam is that the panel is handed both documents and calls pure functions; neither store
 * reads the other's state, and `wiringModel.pathStale` takes both as arguments for exactly that
 * reason.
 *
 * ### No undo stack, and the reason is `reviewStore`'s
 *
 * `locateStore` needs one because a drag destroys a coordinate that is then nowhere on screen. An
 * endpoint is not like that: it is **one of 131 named terminals**, the record keeps `was` beside
 * it forever, the panel shows the pair it replaced, and `unconfirm` puts a confirmation back in
 * one press. `Ctrl+Z` on this screen stays the Locate tab's, over `locations.json`, which is what
 * somebody who has just dragged a dot expects. If that turns out to be wrong, the stack is the
 * same eight lines inside `edit` that it already is over there.
 *
 * ### And it *does* carry a stale banner, unlike `reviewStore`
 *
 * The one difference from the review draft that matters. A corrected reading never reaches
 * `circuit_logic.json` and a test compares bytes to prove it. An endpoint **is** the netlist — it
 * is the `CONNECTS_TO` edge the model answers from — so a save here has to say *re-run the
 * generator*, and it names `build_kg.py` too, because that script emits no coordinates and only
 * moves when connectivity does. This is the work that moves connectivity.
 */

import { create } from 'zustand'

import { ApiError, getWiring, putWiring } from '@/api/client'
import { useAppStore } from '@/stores/appStore'
import type { WiringDocument, WiringReport } from '@/api/types'
import * as model from '@/features/locate/wiringModel'
import type { End } from '@/features/locate/wiringModel'

/** The same 900 ms `locateStore` and `reviewStore` use, so a run of confirmations is one write and
 * walking away from the keyboard is safe. One number, three stores, one habit. */
const SAVE_DEBOUNCE_MS = 900

export type WiringSaveState = 'clean' | 'pending' | 'saving' | 'saved' | 'error'

interface WiringState {
  /** Null until the editor has been unlocked and the file loaded. */
  document: WiringDocument | null
  report: WiringReport | null
  loading: boolean
  /** Why the wiring file could not be opened. Null for the ordinary *not unlocked yet* case, the
   * way `locateStore` treats a 401 — the tab shows its password form and that is not a failure. */
  error: string | null

  /**
   * Which end slot the next **terminal** click on the sheet fills, or null.
   *
   * Here rather than in the component because it is a *mode* the sheet has to know about: while a
   * slot is armed a click on a terminal binds an endpoint instead of placing a point, and it is
   * the one state in this application where a click writes into two different authored files
   * depending on what is armed. It is deliberately **not** persisted and dies with the page: it
   * is a gesture, like the path editor's trace.
   */
  armed: { wire: string; end: End } | null

  saveState: WiringSaveState
  saveError: string | null
  /** Set after the first successful write. Unlike a path or a label correction, an endpoint really
   * does leave `circuit_logic.json` behind. */
  stale: string | null

  load: (drawingNumber: string | null) => Promise<void>
  arm: (slot: { wire: string; end: End } | null) => void
  edit: (change: (document: WiringDocument) => WiringDocument) => void
  save: () => Promise<void>
  reset: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useWiringStore = create<WiringState>()((set, get) => ({
  document: null,
  report: null,
  loading: false,
  error: null,
  armed: null,
  saveState: 'clean',
  saveError: null,
  stale: null,

  load: async (drawingNumber) => {
    set({ loading: true, error: null })
    try {
      const body = await getWiring()
      set({
        // The schema is stamped on here, which is the whole of any future migration — the same
        // arrangement `locateStore.load` has, and it is what keeps `GET /api/wiring` answering the
        // file verbatim rather than normalising a field this editor does not know about.
        document: body.document
          ? { ...body.document, schema: model.SCHEMA }
          : model.emptyWiring(drawingNumber),
        report: body.report,
        saveState: 'clean',
        armed: null,
      })
    } catch (error) {
      set({ error: error instanceof ApiError && error.status === 401 ? null : message(error) })
    } finally {
      set({ loading: false })
    }
  },

  arm: (armed) => set({ armed }),

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
      const body = await putWiring(document)
      // Only back to clean if nothing moved while the request was in flight, or a pending edit
      // would sit unsaved with the badge claiming everything was written.
      set((state) => ({
        report: body.report,
        stale: body.stale,
        saveState: state.document === document ? 'saved' : 'pending',
      }))
      if (get().saveState === 'pending') saveTimer = setTimeout(() => void get().save(), 0)
      /**
       * **The index is not refreshed, and the paths are** — and the two halves of that are the
       * two halves of this file.
       *
       * A saved **endpoint** changes nothing a reader can see until the generator runs:
       * `/api/designators` is built from `circuit_logic.json`, so re-reading it would fetch the
       * same bytes and imply the screen and the artifact now agree. The stale banner is the
       * honest answer instead, and that is why this store has one when `reviewStore` does not.
       *
       * A saved **commoning record** is the opposite and it arrived with Phase C. It never
       * reaches the netlist — the generator does not read the section, asserted in bytes — but it
       * is published on `/api/paths`, so a net's highlight gains the block's bus as soon as it is
       * written. Re-reading the paths is what makes the change the user asked for on 2026-09-06
       * visible on the sheet without a reload.
       */
      void useAppStore.getState().refreshPaths()
    } catch (error) {
      set({ saveState: 'error', saveError: message(error) })
    }
  },

  reset: () => {
    clearTimeout(saveTimer)
    set({
      document: null,
      report: null,
      loading: false,
      error: null,
      armed: null,
      saveState: 'clean',
      saveError: null,
      stale: null,
    })
  },
}))

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
