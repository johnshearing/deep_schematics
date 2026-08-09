import type { ComponentType } from 'react'
import { MessageSquareText, type LucideIcon } from 'lucide-react'

import { AskTab } from '@/features/ask/AskTab'

/**
 * The tab registry — one array, consumed by both the trigger list and the panels.
 *
 * LightRAG hardcodes its tabs in four separate places (a union type, the trigger list, the
 * panel list, and an id map), which is exactly what makes it painful to extend. Since
 * incremental growth is the entire point of this application, adding a tab here should be
 * one new file plus one array entry — and `id` is a plain `string` rather than a union
 * precisely so adding one does not mean widening a type that four other files depend on.
 *
 * The queue, in the order `webui_ideas.md` recommends: net explorer and data tables
 * (deterministic, free, and they displace paid questions), then the tile viewer with
 * bidirectional citation, then guided troubleshooting.
 */
export interface TabContext {
  drawingAvailable: boolean
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
].sort((a, b) => a.order - b.order)

export function enabledTabs(context: TabContext): TabDef[] {
  return TABS.filter((tab) => tab.isEnabled?.(context) ?? true)
}
