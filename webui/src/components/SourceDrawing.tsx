/**
 * Show the sheet the answers are about.
 *
 * `webui_ideas.md` §2 asks for a tile viewer — the 16 tiles placed absolutely under one CSS
 * transform, with clickable component overlays and citations that highlight. This is not that.
 * It is the browser's own PDF viewer pointed at the 148 KB vector original, which gives
 * sharper zoom than 400 DPI rasters for no rendering code at all. When the tile viewer arrives
 * it becomes a tab; this stays useful as "show me the real drawing, unannotated".
 *
 * The overlay is deliberately full-screen: a D-size schematic in a sidebar is unreadable.
 */

import { useEffect } from 'react'
import { ExternalLink, FileText, X } from 'lucide-react'

import { SOURCE_URL } from '@/api/client'
import { Button } from '@/components/ui/button'
import { cn, formatBytes } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'

interface ButtonProps {
  label?: string
  className?: string
  variant?: 'outline' | 'ghost'
}

/** Renders nothing when the server reports no source PDF, so a bare extraction degrades to
 * exactly the UI it had before. */
export function SourceDrawingButton({
  label = 'Show the drawing',
  className,
  variant = 'outline',
}: ButtonProps) {
  const source = useAppStore((s) => s.drawing?.source)
  const setSourceOpen = useAppStore((s) => s.setSourceOpen)

  if (!source) return null

  return (
    <Button
      variant={variant}
      size="sm"
      className={className}
      onClick={() => setSourceOpen(true)}
      title={`${source.name} · ${formatBytes(source.bytes)} · opens in this tab`}
    >
      <FileText />
      {label}
    </Button>
  )
}

export function SourceDrawingViewer() {
  const open = useAppStore((s) => s.sourceOpen)
  const source = useAppStore((s) => s.drawing?.source)
  const setSourceOpen = useAppStore((s) => s.setSourceOpen)

  // Escape closes it. Bound on the document because focus is usually inside the PDF frame,
  // where no React handler of ours will ever see a key.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSourceOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setSourceOpen])

  if (!open || !source) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Source drawing"
      className="fixed inset-0 z-50 flex flex-col gap-2 bg-background/95 p-3 backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <FileText className="size-4 text-muted-foreground" />
          {source.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(source.bytes)} · the sheet this netlist was extracted from
        </span>
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'ml-auto flex items-center gap-1.5 text-xs text-muted-foreground',
            'hover:text-foreground',
          )}
        >
          <ExternalLink className="size-3.5" />
          Open in a new tab
        </a>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close the drawing"
          onClick={() => setSourceOpen(false)}
        >
          <X />
        </Button>
      </div>

      <iframe
        title="Source drawing"
        src={SOURCE_URL}
        className="min-h-0 w-full flex-1 rounded-lg border bg-card"
      />

      <p className="text-[11px] text-muted-foreground">
        Zoom and pan with the viewer's own controls. If the frame stays blank, your browser is
        refusing to render a PDF inline — use <span className="font-medium">Open in a new tab</span>.
        Escape closes this.
      </p>
    </div>
  )
}
