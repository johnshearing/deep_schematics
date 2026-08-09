import { useEffect } from 'react'

import { DrawingPanel } from '@/components/DrawingPanel'
import { Header } from '@/components/Header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { enabledTabs } from '@/tabs'
import { useAppStore } from '@/stores/appStore'

export function App() {
  const { activeTabId, setActiveTab, loadAll, loaded, drawing, healthError } = useAppStore()

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const tabs = enabledTabs({ drawingAvailable: !!drawing })
  // A tab could be disabled by context after hydrate, so fall back rather than render nothing.
  const active = tabs.some((tab) => tab.id === activeTabId) ? activeTabId : tabs[0]?.id

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
                <TabsTrigger key={id} value={id}>
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
