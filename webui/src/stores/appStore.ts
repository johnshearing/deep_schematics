import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  getConductors,
  getDesignators,
  getDrawing,
  getHealth,
  getPaths,
  getQuestions,
  unlock,
} from '@/api/client'
import type {
  Conductor,
  Designator,
  DesignatorIndex,
  DesignatorKind,
  DrawingSummary,
  Health,
  PathIndex,
  StarterQuestion,
} from '@/api/types'
import { buildLookup } from '@/lib/designators'

/** Module state, beside the store, so a second activation while the first request is in flight
 * does not fetch 32 KB twice. The same idiom `locateStore`'s save timer uses and for the same
 * reason: it is not a fact about the document, so it has no business in one. */
let conductorsInFlight = false

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * What the reader is currently pointing at.
 *
 * **This lives in the store and never inside the viewer**, and that is the whole design. The
 * Drawing tab pans to it and rings it; an answer's citations raise it; net highlighting, the
 * net explorer, guided troubleshooting and simulation are all supposed to read this same
 * field. Put it in the viewer and every one of them has to reach inside a component.
 */
export interface Selection {
  kind: DesignatorKind
  id: string
  /**
   * Where the reader pointed from.
   *
   * The viewer flies to a selection raised from an answer, and does *not* fly to one raised by
   * a click on the drawing — you do not move the sheet under someone who has just put a finger
   * on it. Recording the origin at the seam keeps that decision out of both call sites; the
   * deterministic tables that come next will raise `'text'` too.
   */
  origin: 'text' | 'drawing'
  /**
   * The thing whose card sent the reader here, so there is a way back to it.
   *
   * A net's card is a roster of its member terminals and every row of it flies to a pin. Once
   * there, the roster is gone — the card now describes the pin — and getting back to it meant
   * asking another question or hunting the net down in an answer. One field records the step, and
   * the card offers it as a link; it is deliberately **one** step and not a stack, because a
   * history of clicks is a different feature and a back button that sometimes goes two places is
   * worse than one that always goes one.
   */
  from?: { kind: DesignatorKind; id: string }
  /** Bumped on every selection, including a repeat of the current one. Clicking the same
   * citation twice has to re-pan — the reader has usually scrolled away in between, and a
   * no-op looks like a broken link. */
  nonce: number
}

interface AppState {
  health: Health | null
  healthError: string | null
  drawing: DrawingSummary | null
  questions: StarterQuestion[]
  /** Null while loading, and after a failure — in which case citations stay plain text and
   * nothing else changes. */
  designators: DesignatorIndex | null
  /**
   * Where each traced wire runs, and which wires each net is made of.
   *
   * Null while loading and after a failure, in which case nothing is highlighted and everything
   * else on both tabs works exactly as it did — the same degradation as `designators`. Here
   * rather than in either tab because **both** read it: the Drawing tab highlights the selection
   * and the Locate tab highlights the armed row, and two fetches of one file would be two answers
   * that could disagree.
   */
  paths: PathIndex | null
  /**
   * The 149 runs of ink — **for the reader, since `/api/conductors` lost its password.**
   *
   * Loaded lazily by the Drawing tab on its first activation rather than in `loadAll`, because it
   * is 32 KB nobody who never opens that tab needs, and it answers exactly one question: *what is
   * this line I am pointing at, and does any wire claim it.* Null while it loads and after a
   * failure, which the card says out loud rather than reading as *no wire claims this run*.
   *
   * The Locate editor keeps its **own** copy in `locateStore`, and that is deliberate rather than
   * duplication left lying about: the two stores do not know about each other (`H18`), the parse
   * behind the route is `lru_cache`d so the second fetch costs a serialisation, and the editor's
   * copy arrives on unlock while this one arrives on first sight of the sheet.
   */
  conductors: Conductor[] | null
  conductorsError: string | null
  /** Every id and unambiguous alias, case-folded. The allowlist a backticked span is matched
   * against; see `lib/designators.ts` for why it is an allowlist. */
  byToken: Map<string, Designator>
  selection: Selection | null
  model: string
  /**
   * Empty means "no preference yet" — `App` resolves it against the enabled tabs and falls
   * back to the first one.
   *
   * This deliberately does **not** import the registry. It used to, for a default and for a
   * hydrate-time validation, and that closed a cycle: `tabs` → a tab component → this store →
   * `tabs`. It survived only while the entry point happened to be `tabs.ts`; importing a tab
   * component first built the registry with `undefined` ids and `undefined` components, which
   * is a blank screen with no error. `App` already had to reconcile the id against the
   * *enabled* tabs anyway, so this is one place doing the job instead of two, and no cycle.
   */
  activeTabId: string
  /**
   * Whether the Drawing tab's list of designators is open.
   *
   * **In the store, and persisted, on purpose.** The Drawing tab is `keepMounted`, so component
   * state would already survive an `F2` round trip — but not a reload, and this is a decision
   * about how much of a 1224 pt sheet somebody wants to see. Reopening a panel you closed, every
   * morning, is exactly the kind of small cost that makes a screen feel like it is not listening.
   *
   * The *filters* over that list are deliberately **not** here: they are a narrowing of a search,
   * they change many times a sitting, and coming back tomorrow to a list that silently shows only
   * wires would read as a broken index rather than as yesterday's filter.
   */
  drawingListOpen: boolean
  loaded: boolean
  /** Never persisted: a shared demo secret has no business outliving the tab. */
  unlocked: boolean
  unlockError: string | null

  setModel: (model: string) => void
  setActiveTab: (id: string) => void
  setDrawingListOpen: (open: boolean) => void
  /** Point at something. Callers that also need the drawing on screen switch tabs themselves:
   * this store must not import the tab registry (see `activeTabId`).
   *
   * `from` is for a selection raised *from another selection's card* — a roster row, a
   * `runs through` chip — and is what puts a way back on the new card. */
  select: (
    kind: DesignatorKind,
    id: string,
    origin?: Selection['origin'],
    from?: Selection['from'],
  ) => void
  clearSelection: () => void
  loadAll: () => Promise<void>
  refreshHealth: () => Promise<void>
  /** Re-read the designator index **and the paths**, which is what the Locate editor's save
   * changes. Without it the editor would place a point, the file on disk would be right, and the
   * Drawing tab would keep drawing the estimate until the page was reloaded. Both come out of
   * `locations.json`, so one save moves both and one refresh has to fetch both. */
  refreshDesignators: () => Promise<void>
  /**
   * Re-read the **paths alone**, which is what a commoning save changes.
   *
   * Its own function rather than a call to `refreshDesignators`, because the two saves are not
   * alike. A placement moves `/api/designators` *and* `/api/paths`, both out of `locations.json`.
   * A commoning record moves neither the index nor the netlist — it is display geometry, and
   * `test_commoning_does_not_reach_the_netlist` compares bytes to say so — but it **is** published
   * on `/api/paths`, so a net's highlight gains the block's bus the moment it is saved rather than
   * on the next reload. Re-reading the index as well would fetch the same bytes and imply
   * something had moved.
   */
  refreshPaths: () => Promise<void>
  /** Fetch the runs of ink, once. Safe to call on every activation: it returns immediately if the
   * payload is already here or a request is in flight. */
  loadConductors: () => Promise<void>
  submitUnlock: (password: string) => Promise<boolean>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      health: null,
      healthError: null,
      drawing: null,
      questions: [],
      designators: null,
      paths: null,
      conductors: null,
      conductorsError: null,
      byToken: new Map(),
      selection: null,
      model: 'sonnet',
      activeTabId: '',
      drawingListOpen: true,
      loaded: false,
      unlocked: false,
      unlockError: null,

      setModel: (model) => set({ model }),
      setActiveTab: (activeTabId) => set({ activeTabId }),
      setDrawingListOpen: (drawingListOpen) => set({ drawingListOpen }),

      select: (kind, id, origin = 'text', from) =>
        set((state) => ({
          selection: { kind, id, origin, from, nonce: (state.selection?.nonce ?? 0) + 1 },
        })),
      clearSelection: () => set({ selection: null }),

      loadAll: async () => {
        const [health, drawing, questions, designators, paths] = await Promise.allSettled([
          getHealth(),
          getDrawing(),
          getQuestions(),
          getDesignators(),
          getPaths(),
        ])
        const index = designators.status === 'fulfilled' ? designators.value : null
        set({
          health: health.status === 'fulfilled' ? health.value : null,
          healthError: health.status === 'rejected' ? String(health.reason?.message ?? health.reason) : null,
          drawing: drawing.status === 'fulfilled' ? drawing.value : null,
          questions: questions.status === 'fulfilled' ? questions.value : [],
          // Built once here rather than on every render of every citation in every answer.
          designators: index,
          paths: paths.status === 'fulfilled' ? paths.value : null,
          byToken: buildLookup(index),
          loaded: true,
        })
        // Only adopt the server's default model on first load, so a visitor's choice sticks.
        if (health.status === 'fulfilled' && !get().model) set({ model: health.value.default_model })
      },

      refreshDesignators: async () => {
        try {
          const index = await getDesignators()
          set({ designators: index, byToken: buildLookup(index) })
        } catch {
          // Keep the index we have. A failed refresh means the overlay is one save behind,
          // which is a great deal better than every citation in every answer going inert.
        }
        try {
          // The same save wrote both: one `PUT /api/locations` can move a point *and* accept a
          // path, so re-reading one and not the other would leave the sheet half a save behind.
          set({ paths: await getPaths() })
        } catch {
          // As above: the highlight is one save behind, and nothing else changes.
        }
      },

      refreshPaths: async () => {
        try {
          set({ paths: await getPaths() })
        } catch {
          // The highlight is one save behind and nothing else changes — the same degradation the
          // designator refresh already accepts, and for the same reason.
        }
      },

      loadConductors: async () => {
        if (get().conductors || conductorsInFlight) return
        conductorsInFlight = true
        try {
          set({ conductors: (await getConductors()).conductors, conductorsError: null })
        } catch (error) {
          // A reader whose ink did not load can still read the sheet, select anything and see
          // every highlight. What they lose is *what is this line* — so the card says that,
          // rather than answering *no wire claims this run*, which would be a false fact.
          set({ conductors: null, conductorsError: message(error) })
        } finally {
          conductorsInFlight = false
        }
      },

      refreshHealth: async () => {
        try {
          set({ health: await getHealth(), healthError: null })
        } catch (error) {
          set({ healthError: error instanceof Error ? error.message : String(error) })
        }
      },

      submitUnlock: async (password) => {
        try {
          await unlock(password)
          set({ unlocked: true, unlockError: null })
          return true
        } catch (error) {
          // Surface the server's text: it distinguishes a wrong password from a rate limit.
          set({ unlockError: error instanceof Error ? error.message : String(error) })
          return false
        }
      },
    }),
    {
      name: 'schematic-webui',
      partialize: (state) => ({
        model: state.model,
        activeTabId: state.activeTabId,
        drawingListOpen: state.drawingListOpen,
      }),
    },
  ),
)
