import { useEffect } from 'react'

import { DrawingPanel } from '@/components/DrawingPanel'
import { Header } from '@/components/Header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { enabledTabs } from '@/tabs'
import { ASK_TAB_ID, DRAWING_TAB_ID } from '@/tabIds'
import { useAppStore } from '@/stores/appStore'

export function App() {
  const { activeTabId, setActiveTab, loadAll, loaded, drawing, health, healthError } =
    useAppStore()

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const tabs = enabledTabs({
    drawingAvailable: !!drawing,
    tilesAvailable: !!drawing?.tiles?.count,
    editingEnabled: !!health?.editing?.enabled,
  })
  /**
   * The one place a tab id is reconciled with the registry.
   *
   * It covers three cases that all look identical from here: nothing chosen yet, a tab
   * renamed or removed since the visitor's last session, and a tab that exists but is
   * disabled by context — the Drawing tab on an extraction with no tiles. All three fall back
   * to the first enabled tab rather than rendering nothing.
   */
  const active = tabs.some((tab) => tab.id === activeTabId) ? activeTabId : tabs[0]?.id

  /**
   * **F2 shuttles between Ask and Drawing**, in one keystroke, from anywhere in the application.
   *
   * Reading an answer and checking it on the sheet is one job done in two places, and until now
   * the only ways across were a citation (which also moves the sheet) and *Ask about this* (which
   * also rewrites the composer). Both are round trips with a side effect; neither is a way to
   * simply *look*. The rule is deliberately not "cycle the tabs": there are three of them, and the
   * pair that gets crossed a hundred times in a session is this one. From the Locate editor F2
   * goes to the drawing, which is the reading half of that job too.
   *
   * **Why `F2`.** It has to work while the caret is in the composer — that is where a reader sits
   * on the Ask tab — which rules out bare letters. It must not be a combination the browser has
   * already claimed: `Ctrl`/`Alt` plus a digit switches *browser* tabs, `Alt+D` is the address
   * bar, `Ctrl+Shift+D` is bookmarks. The function keys are almost all taken too (`F1` help,
   * `F3` find, `F5` reload, `F6` toolbar, `F11` full screen, `F12` dev tools) — `F2` is not, in
   * any of the three engines, and a textarea does nothing with it either.
   *
   * Bound here rather than in a tab, because a tab that is not mounted cannot listen for the key
   * that would show it, and `keepMounted` is a performance decision that must not become the
   * reason a shortcut works. Skipped entirely when the sheet was never tiled: there is no Drawing
   * tab then, and a key that silently does nothing is worse than no key.
   */
  const hasDrawingTab = tabs.some((tab) => tab.id === DRAWING_TAB_ID)
  useEffect(() => {
    if (!hasDrawingTab) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F2' || event.defaultPrevented) return
      // Bare F2 only. `Ctrl+F2` and friends belong to the browser and to screen readers.
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      event.preventDefault()
      setActiveTab(active === DRAWING_TAB_ID ? ASK_TAB_ID : DRAWING_TAB_ID)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, hasDrawingTab, setActiveTab])

  return (
    <div className="flex h-full flex-col">
      <Header />
      <DrawingPanel />

      {healthError && (
        <div className="border-b border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2 text-xs">
          Cannot reach the server: {healthError}. Is it running on port 9700?
        </div>
      )}

      <Tabs value={active} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        {/* One tab in v1, so the strip is noise. It appears the moment there are two. */}
        {tabs.length > 1 && (
          <div className="border-b px-4 py-1.5">
            <TabsList>
              {tabs.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  // The only place the shortcut is visible before you need it. A hover on either
                  // of the two tabs it crosses says so; the Locate tab makes no such promise.
                  title={
                    hasDrawingTab && (id === ASK_TAB_ID || id === DRAWING_TAB_ID)
                      ? 'F2 switches between Ask and Drawing'
                      : undefined
                  }
                >
                  <Icon className="size-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        )}

        {tabs.map(({ id, Component, keepMounted }) => (
          <TabsContent key={id} value={id} forceMount={keepMounted ? true : undefined}>
            <Component />
          </TabsContent>
        ))}
      </Tabs>

      {!loaded && (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">Loading drawing…</div>
      )}
    </div>
  )
}
