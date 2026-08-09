import { Check, FileSearch, FolderSearch, Loader2, X } from 'lucide-react'

import type { ToolCall } from '@/stores/chatStore'

const ICONS: Record<string, typeof Check> = {
  Read: FileSearch,
  Grep: FileSearch,
  Glob: FolderSearch,
}

/**
 * The trust feature.
 *
 * Answers take up to two minutes, and this fills the wait — but that is the smaller half of
 * why it exists. The bigger half is that it shows the reader the model actually opened
 * `EXTRACTION_NOTES.md` and grepped `circuit_logic.json`, rather than answering from memory
 * about a schematic it has never seen. For a tool whose whole value proposition is being
 * auditable, that evidence belongs on screen, not in a log.
 */
export function ToolStrip({ tools, live }: { tools: ToolCall[]; live: boolean }) {
  if (tools.length === 0) return null

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {tools.map((tool) => {
        const Icon = ICONS[tool.name] ?? FileSearch
        const running = tool.ok === undefined && live
        const ms = tool.endedAt ? tool.endedAt - tool.startedAt : undefined
        return (
          <span
            key={tool.id}
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/60 px-2 py-1 font-mono text-[11px] leading-4 text-muted-foreground"
            title={`${tool.name} ${tool.detail}`}
          >
            <Icon className="size-3 shrink-0" />
            <span className="font-sans font-medium text-foreground/80">{tool.name}</span>
            <span className="truncate">{tool.detail}</span>
            {running ? (
              <Loader2 className="size-3 shrink-0 animate-spin" />
            ) : tool.ok === false ? (
              <X className="size-3 shrink-0 text-[var(--color-danger)]" />
            ) : tool.ok ? (
              <>
                <Check className="size-3 shrink-0 text-[var(--color-success)]" />
                {ms !== undefined && <span className="opacity-70">{ms} ms</span>}
              </>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}
