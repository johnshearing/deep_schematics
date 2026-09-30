/**
 * *Say it as…*: the palette's way to fix how an item is spoken. `talkthrough_03.md` §5.4.
 *
 * Shown under the spoken text, for the item being said. It saves to the user's pronunciation
 * lists — this drawing's by default, or every drawing's — and the talk says the new form from
 * then on. **Nothing is written without a press of Save**, and every notice stays inside the
 * palette, never on the answer, which may be on camera.
 */

import { useState } from 'react'

import { hasEditorPassword, putPronunciations } from '@/api/client'
import type { PronunciationScope } from '@/api/types'
import { Button } from '@/components/ui/button'
import { resolve } from '@/lib/designators'
import { useAppStore } from '@/stores/appStore'
import type { Segment } from './buildTalk'
import { useTalkStore } from './talkStore'

/** Add or replace the entry for `match` in one list, save the list whole, and re-say the talk. */
export async function savePronunciation(scope: PronunciationScope, match: string, say: string) {
  const app = useAppStore.getState()
  const entries = [
    ...app.pronunciationLists[scope].filter((e) => e.match !== match),
    { match, say, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') },
  ]
  const saved = await putPronunciations(scope, entries)
  const lists = useAppStore.getState().pronunciationLists
  useAppStore.getState().setPronunciationLists({ ...lists, [scope]: saved.entries })
  useTalkStore.getState().refresh()
}

export function SayItAs({ segment }: { segment: Segment }) {
  const editing = useAppStore((s) => s.health?.editing)
  const byToken = useAppStore((s) => s.byToken)
  const drawingList = useAppStore((s) => s.pronunciationLists.drawing)
  const [open, setOpen] = useState(false)
  const [say, setSay] = useState('')
  const [note, setNote] = useState<string | null>(null)

  const entry = segment.link ? resolve(byToken, segment.link) : null
  if (!editing?.enabled || !entry || segment.spoken === undefined) return null
  const locked = !!editing.password_required && !hasEditorPassword()

  if (!open) {
    return (
      <div className="space-y-1 text-[11px]">
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => {
            setSay(segment.spoken ?? '')
            setNote(null)
            setOpen(true)
          }}
        >
          Say it as…
        </Button>
        {note && <p className="text-muted-foreground">{note}</p>}
      </div>
    )
  }

  const save = async (scope: PronunciationScope) => {
    try {
      await savePronunciation(scope, entry.id, say.trim())
      const shadow = scope === 'global' && drawingList.find((e) => e.match === entry.id)
      setNote(
        shadow
          ? `Saved for every drawing, but this drawing's own list says “${shadow.say}”, which wins here.`
          : `Saved. ${entry.id} is said this way from now on.`,
      )
      setOpen(false)
    } catch (error) {
      setNote(`Not saved: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <div className="space-y-1 text-[11px]" data-testid="say-it-as">
      <label className="flex items-center gap-1">
        <span className="shrink-0">{entry.id} says</span>
        <input
          aria-label={`Say ${entry.id} as`}
          className="min-w-0 flex-1 rounded border bg-background px-1 py-0.5"
          value={say}
          onChange={(event) => setSay(event.target.value)}
        />
      </label>
      {locked ? (
        <p className="text-muted-foreground">Unlock the editor (Locate tab) to save.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" className="h-6 px-2 text-[11px]" onClick={() => void save('drawing')}>
            Save for this drawing
          </Button>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" onClick={() => void save('global')}>
            Save for every drawing
          </Button>
        </div>
      )}
      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <p className="text-muted-foreground">Leave it empty to show {entry.id} and say nothing.</p>
      {note && <p className="text-muted-foreground">{note}</p>}
    </div>
  )
}
