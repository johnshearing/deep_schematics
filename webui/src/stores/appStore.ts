import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getDrawing, getHealth, getQuestions, unlock } from '@/api/client'
import type { DrawingSummary, Health, StarterQuestion } from '@/api/types'
import { TABS } from '@/tabs'

interface AppState {
  health: Health | null
  healthError: string | null
  drawing: DrawingSummary | null
  questions: StarterQuestion[]
  model: string
  activeTabId: string
  loaded: boolean
  /** Never persisted: a shared demo secret has no business outliving the tab. */
  unlocked: boolean
  unlockError: string | null
  /** The source-drawing overlay. In the store rather than in one component because two
   * separate places open it — the drawing bar and the intro. */
  sourceOpen: boolean

  setModel: (model: string) => void
  setSourceOpen: (open: boolean) => void
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
      activeTabId: TABS[0].id,
      loaded: false,
      unlocked: false,
      unlockError: null,
      sourceOpen: false,

      setModel: (model) => set({ model }),
      setSourceOpen: (sourceOpen) => set({ sourceOpen }),
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
      /**
       * Validate the persisted tab against the registry on hydrate.
       *
       * Without this, renaming or removing a tab wedges every returning visitor on a blank
       * screen — with a value in localStorage that nothing in the app will ever match again,
       * and no way to clear it from the UI.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>
        const known = TABS.some((tab) => tab.id === saved.activeTabId)
        return {
          ...current,
          ...saved,
          activeTabId: known ? saved.activeTabId! : TABS[0].id,
        }
      },
    },
  ),
)
