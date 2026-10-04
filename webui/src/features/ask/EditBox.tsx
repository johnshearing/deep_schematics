/**
 * Rewriting a question or an answer in place. `talkthrough_02.md` §6.
 *
 * The user presents answers on video, and may rewrite one or replace it with their own. After
 * `Save` the screen shows **only** the edit — no badge, nothing to draw the audience's eye — and the
 * talkthrough speaks it. The model's original is kept off screen (`Message.text`) and, where the
 * editor is available, on disk beside the edit (`edits.ts`). An answer is markdown, so backticked
 * identifiers in an edit are links exactly as in an original answer.
 */

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useChatStore, writtenText, type Message } from '@/stores/chatStore'
import { persistEdits, savesToDisk } from './edits'

export function EditBox({ message, onDone }: { message: Message; onDone: () => void }) {
  const editMessage = useChatStore((s) => s.editMessage)
  const [draft, setDraft] = useState(() => writtenText(message))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const answer = message.role === 'assistant'

  const commit = async (text: string | null) => {
    editMessage(message.id, text)
    setBusy(true)
    try {
      await persistEdits(message.id)
      onDone()
    } catch (err) {
      // The edit is on screen either way; only the copy on disk failed.
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <textarea
        aria-label={answer ? 'Edit the answer' : 'Edit the question'}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        rows={Math.min(30, Math.max(answer ? 6 : 2, draft.split('\n').length + 1))}
        className="w-full resize-y rounded-md border bg-card p-2 font-mono text-xs text-foreground"
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Button size="sm" className="h-6 px-2" disabled={busy} onClick={() => commit(draft)}>
          Save
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
        {message.edited !== undefined && (
          <Button variant="ghost" size="sm" className="h-6 px-2" disabled={busy} onClick={() => commit(null)}>
            Revert to original
          </Button>
        )}
        <span className="ml-auto">
          {answer && 'Markdown: put an identifier in `backticks` to make it a link. '}
          {'<!-- a note --> is kept here and in the saved edit, never shown or said. '}
          {savesToDisk()
            ? 'Saved beside the drawing, with the original.'
            : 'Kept for this conversation only. Unlock the editor (Locate tab) to save edits to disk.'}
        </span>
      </div>
      {error && (
        <p className="text-[11px] text-[var(--color-danger)]">
          Shown, but not saved to disk: {error}{' '}
          <button type="button" className="underline" onClick={onDone}>
            Close
          </button>
        </p>
      )}
    </div>
  )
}
