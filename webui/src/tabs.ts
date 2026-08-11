import type { ComponentType } from 'react'
import { Map, MessageSquareText, type LucideIcon } from 'lucide-react'

import { AskTab } from '@/features/ask/AskTab'
import { DrawingTab, DRAWING_TAB_ID } from '@/features/drawing/DrawingTab'

/**
 * The tab registry — one array, consumed by both the trigger list and the panels.
 *
 * LightRAG hardcodes its tabs in four separate places (a union type, the trigger list, the
 * panel list, and an id map), which is exactly what makes it painful to extend. Since
 * incremental growth is the entire point of this application, adding a tab here should be
 * one new file plus one array entry — and `id` is a plain `string` rather than a union
 * precisely so adding one does not mean widening a type that four other files depend on.
 *
 * This module imports tab components and nothing imports it back. That is a rule, not an
 * accident: `appStore` used to import `TABS`, and the resulting cycle built the registry with
 * `undefined` entries whenever a tab component was the first module evaluated. A tab that
 * needs to know its own id declares the constant itself.
 *
 * The queue, in the order `webui_ideas.md` recommends: net explorer and data tables
 * (deterministic, free, and they displace paid questions), then the tile viewer with
 * bidirectional citation, then guided troubleshooting.
 */
export interface TabContext {
  drawingAvailable: boolean
  /** The sheet has been rendered to tiles. Without them there is nothing to view, so the tab
   * does not exist — a bare extraction degrades to exactly the UI it had before. */
  tilesAvailable: boolean
}

export interface TabDef {
  /** Plain string, deliberately. See above. */
  id: string
  label: string
  icon: LucideIcon
  Component: ComponentType
  order: number
  /** For future canvas/WebGL tabs (the tile viewer) whose state is expensive to rebuild. */
  keepMounted?: boolean
  isEnabled?: (context: TabContext) => boolean
}

export const TABS: TabDef[] = [
  {
    id: 'ask',
    label: 'Ask',
    icon: MessageSquareText,
    Component: AskTab,
    order: 10,
  },
  {
    id: DRAWING_TAB_ID,
    label: 'Drawing',
    icon: Map,
    Component: DrawingTab,
    order: 20,
    // Kept mounted so the pan and zoom survive a trip back to Ask — a reader who has zoomed
    // in on the start/stop chain to check an answer should find it still there. The tab
    // itself defers loading the tiles until it is first opened.
    keepMounted: true,
    // Annotated because `.sort()` below breaks the contextual typing from `TabDef[]`.
    isEnabled: (context: TabContext) => context.tilesAvailable,
  },
].sort((a, b) => a.order - b.order)

export function enabledTabs(context: TabContext): TabDef[] {
  return TABS.filter((tab) => tab.isEnabled?.(context) ?? true)
}
