import type { ComponentType } from 'react'
import { Crosshair, Map, MessageSquareText, ScanText, type LucideIcon } from 'lucide-react'

import { AskTab } from '@/features/ask/AskTab'
import { DrawingTab } from '@/features/drawing/DrawingTab'
import { LocateTab } from '@/features/locate/LocateTab'
import { ReviewTab } from '@/features/review/ReviewTab'
import { ASK_TAB_ID, DRAWING_TAB_ID, LOCATE_TAB_ID, REVIEW_TAB_ID } from '@/tabIds'

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
 * `undefined` entries whenever a tab component was the first module evaluated. The ids
 * themselves live in `tabIds.ts`, a leaf module, so that a component can *name* a tab —
 * a citation sends the reader to the Drawing tab — without importing one.
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
  /** `/api/health` says this server was started with `SWUI_ALLOW_EDITS=true`. Published rather
   * than probed: with edits off the routes are never registered, so a Locate tab on a public
   * demo would be a screen that cannot save. */
  editingEnabled: boolean
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
    id: ASK_TAB_ID,
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
  {
    id: LOCATE_TAB_ID,
    label: 'Locate',
    icon: Crosshair,
    Component: LocateTab,
    order: 30,
    // Kept mounted for the same reason as the Drawing tab, plus one of its own: an unsaved draft
    // and a half-finished run of placements must survive a trip to Ask to read something.
    keepMounted: true,
    isEnabled: (context: TabContext) => context.tilesAvailable && context.editingEnabled,
  },
  {
    id: REVIEW_TAB_ID,
    label: 'Review',
    icon: ScanText,
    Component: ReviewTab,
    order: 40,
    // Kept mounted for the third of the three reasons as well as the first two: a half-finished
    // review is a scroll position in a 664-row queue plus an unsaved draft, and losing either on a
    // trip to Ask would make checking one reading against an answer cost the run.
    keepMounted: true,
    // The same rule as Locate, and both halves are load-bearing. `editingEnabled` because this
    // screen writes an authored file and its routes do not exist without it; `tilesAvailable`
    // because the whole point is reading the ink rather than the transcription, and with no sheet
    // to show there is nothing to read against.
    isEnabled: (context: TabContext) => context.tilesAvailable && context.editingEnabled,
  },
].sort((a, b) => a.order - b.order)

export function enabledTabs(context: TabContext): TabDef[] {
  return TABS.filter((tab) => tab.isEnabled?.(context) ?? true)
}
