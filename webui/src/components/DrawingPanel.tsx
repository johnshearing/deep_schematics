import { useState } from 'react'
import { ChevronDown, FileText, Info } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn, formatBytes } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'

/**
 * Everything on this panel is free, instant and exactly repeatable — it comes straight out of
 * `circuit_logic.json` with no model call at all.
 *
 * That is not a detail. `webui_ideas.md` §4 argues that a good version of this application
 * answers as many questions as possible with ordinary code, and this panel already answers
 * §12 Q21–Q25 and Q64 before anyone spends $0.64 asking.
 */
export function DrawingPanel() {
  const drawing = useAppStore((s) => s.drawing)
  const [open, setOpen] = useState(false)

  if (!drawing) return null
  const counts = drawing.counts

  return (
    <aside className="border-b bg-card/50">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <Info className="size-3.5 text-muted-foreground" />
          {counts.components} components · {counts.terminals} terminals · {counts.nets} nets ·{' '}
          {counts.wires} wires · {counts.cables} cables · {counts.subsystems} subsystems ·{' '}
          {counts.relationships} relationships
        </span>

        {drawing.revision_note && (
          <span className="text-muted-foreground">{drawing.revision_note}</span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* No "Drawing" button here any more. It duplicated the one in the intro, and both
              are now the Drawing tab — one control, always visible, which the intro button
              never was: it lived in the empty state and vanished at the first question. */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            aria-expanded={open}
          >
            Notes, references and artifacts
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {open && (
        <div className="grid gap-4 border-t px-4 py-3 text-xs md:grid-cols-3">
          <section>
            <h3 className="mb-1.5 font-semibold">Drawing notes</h3>
            <ul className="space-y-1 text-muted-foreground">
              {drawing.notes.map((note) => (
                <li key={note} className="leading-snug">
                  • {note}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-1.5 font-semibold">Referenced drawings</h3>
            <div className="flex flex-wrap gap-1">
              {drawing.references.map((reference) => (
                <Badge key={reference} tone="info">
                  {reference}
                </Badge>
              ))}
            </div>
            <h3 className="mt-3 mb-1.5 font-semibold">Subsystems</h3>
            <ul className="space-y-1 text-muted-foreground">
              {drawing.subsystems.map((subsystem) => (
                <li key={subsystem.id} title={subsystem.description}>
                  • <span className="font-mono">{subsystem.id}</span> ({subsystem.members})
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-1.5 font-semibold">What the model can read</h3>
            <ul className="space-y-1 text-muted-foreground">
              {drawing.artifacts.map((artifact) => (
                <li key={artifact.name} className="flex items-center gap-1.5">
                  <FileText className="size-3" />
                  <span className="font-mono">{artifact.name}</span>
                  <span className="opacity-70">{formatBytes(artifact.bytes)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 leading-snug text-muted-foreground/80">
              Read-only, and scoped to this directory. The session has no Bash, no Write and no
              network tools — they do not exist in it.
            </p>
          </section>
        </div>
      )}
    </aside>
  )
}
