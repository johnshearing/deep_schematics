import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getDesignators, getDrawing, getHealth, getQuestions, unlock } from '@/api/client'
import type {
  Designator,
  DesignatorIndex,
  DesignatorKind,
  DrawingSummary,
  Health,
  StarterQuestion,
} from '@/api/types'
import { buildLookup } from '@/lib/designators'

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
  loaded: boolean
  /** Never persisted: a shared demo secret has no business outliving the tab. */
  unlocked: boolean
  unlockError: string | null

  setModel: (model: string) => void
  setActiveTab: (id: string) => void
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
  /** Re-read the designator index, which is what the Locate editor's save changes. Without it
   * the editor would place a point, the file on disk would be right, and the Drawing tab would
   * keep drawing the estimate until the page was reloaded. */
  refreshDesignators: () => Promise<void>
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
      byToken: new Map(),
      selection: null,
      model: 'sonnet',
      activeTabId: '',
      loaded: false,
      unlocked: false,
      unlockError: null,

      setModel: (model) => set({ model }),
      setActiveTab: (activeTabId) => set({ activeTabId }),

      select: (kind, id, origin = 'text', from) =>
        set((state) => ({
          selection: { kind, id, origin, from, nonce: (state.selection?.nonce ?? 0) + 1 },
        })),
      clearSelection: () => set({ selection: null }),

      loadAll: async () => {
        const [health, drawing, questions, designators] = await Promise.allSettled([
          getHealth(),
          getDrawing(),
          getQuestions(),
          getDesignators(),
        ])
        const index = designators.status === 'fulfilled' ? designators.value : null
        set({
          health: health.status === 'fulfilled' ? health.value : null,
          healthError: health.status === 'rejected' ? String(health.reason?.message ?? health.reason) : null,
          drawing: drawing.status === 'fulfilled' ? drawing.value : null,
          questions: questions.status === 'fulfilled' ? questions.value : [],
          // Built once here rather than on every render of every citation in every answer.
          designators: index,
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
      partialize: (state) => ({ model: state.model, activeTabId: state.activeTabId }),
    },
  ),
)
