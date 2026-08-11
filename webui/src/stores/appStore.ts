import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getDrawing, getHealth, getQuestions, unlock } from '@/api/client'
import type { DrawingSummary, Health, StarterQuestion } from '@/api/types'

interface AppState {
  health: Health | null
  healthError: string | null
  drawing: DrawingSummary | null
  questions: StarterQuestion[]
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
  loadAll: () => Promise<void>
  refreshHealth: () => Promise<void>
  submitUnlock: (password: string) => Promise<boolean>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      health: null,
      healthError: null,
      drawing: null,
      questions: [],
      model: 'sonnet',
      activeTabId: '',
      loaded: false,
      unlocked: false,
      unlockError: null,

      setModel: (model) => set({ model }),
      setActiveTab: (activeTabId) => set({ activeTabId }),

      loadAll: async () => {
        const [health, drawing, questions] = await Promise.allSettled([
          getHealth(),
          getDrawing(),
          getQuestions(),
        ])
        set({
          health: health.status === 'fulfilled' ? health.value : null,
          healthError: health.status === 'rejected' ? String(health.reason?.message ?? health.reason) : null,
          drawing: drawing.status === 'fulfilled' ? drawing.value : null,
          questions: questions.status === 'fulfilled' ? questions.value : [],
          loaded: true,
        })
        // Only adopt the server's default model on first load, so a visitor's choice sticks.
        if (health.status === 'fulfilled' && !get().model) set({ model: health.value.default_model })
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
