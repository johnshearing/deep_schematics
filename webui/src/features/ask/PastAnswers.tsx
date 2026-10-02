/**
 * Keeping and reopening what was said. `talkthrough_03.md` §7.
 *
 * `Past answers` lists this drawing's turns from the server's archives, newest first, with the
 * user's saved rewrites; `Open` puts one back into the transcript as a finished pair, so `Edit`,
 * saving and `Talk me through it` all work on it. **Editor only**: on a public demo the archives
 * hold visitors' questions, and the routes exist only behind `SWUI_ALLOW_EDITS`.
 *
 * `Write your own` is the user's request of 2026-10-01: an empty answer to write, without asking
 * the model anything first, to try the talkthrough's notation or to make a video of a question
 * and answer composed by hand. Whatever is in the composer becomes its question. It is saved, and
 * listed here, like any edit, marked `composed` where a model's name would be.
 */

import { useState } from 'react'
import { History, PenLine } from 'lucide-react'

import { getTurn, getTurns, type PastTurn } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chatStore'
import { savesToDisk } from './edits'

export function AskTools() {
  const busy = useChatStore((s) => s.busy)
  const compose = useChatStore((s) => s.compose)
  const composerText = useChatStore((s) => s.composerText)
  const editor = savesToDisk()

  return (
    <div className="flex flex-wrap items-start gap-2 px-3 pt-2 text-[11px] text-muted-foreground">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2"
        disabled={busy}
        title="Write a question and answer yourself, without asking the model. What is in the box below becomes the question."
        onClick={() => compose(composerText)}
      >
        <PenLine className="size-3" />
        Write your own
      </Button>
      {editor && <PastAnswers />}
    </div>
  )
}

function PastAnswers() {
  const open = useChatStore((s) => s.open)
  const messages = useChatStore((s) => s.messages)
  const busy = useChatStore((s) => s.busy)
  const [turns, setTurns] = useState<PastTurn[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      setTurns(await getTurns())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const reopen = async (turnId: string) => {
    setError(null)
    try {
      const turn = await getTurn(turnId)
      open({
        turnId,
        question: turn.edit?.question.original ?? turn.question ?? '',
        questionEdited: turn.edit?.question.edited,
        answer: turn.edit?.answer.original ?? turn.answer,
        answerEdited: turn.edit?.answer.edited,
        model: turn.model,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <details
      className="min-w-0 flex-1"
      onToggle={(event) => {
        if ((event.target as HTMLDetailsElement).open) void load()
      }}
    >
      <summary className="flex h-6 cursor-pointer list-none items-center gap-1 px-2">
        <History className="size-3" />
        Past answers
      </summary>
      {error && <p className="px-2 text-[var(--color-danger)]">{error}</p>}
      {turns && turns.length === 0 && <p className="px-2">Nothing kept yet.</p>}
      {turns && turns.length > 0 && (
        <ul aria-label="Past answers" className="mt-1 max-h-60 space-y-1 overflow-y-auto pr-1">
          {turns.map((turn) => {
            const here = messages.some((m) => m.turnId === turn.turn_id)
            return (
              <li key={turn.turn_id} className="flex items-start gap-2 rounded border bg-card px-2 py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">{turn.question ?? <em>(question not recorded)</em>}</p>
                  <p className="truncate">{turn.preview}</p>
                  <p>
                    {turn.saved.slice(0, 16).replace('T', ' ')} · {turn.model ?? '?'}
                    {turn.edited && ' · edited'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  disabled={busy || here}
                  title={here ? 'Already in this conversation' : 'Put this question and answer into the conversation'}
                  onClick={() => void reopen(turn.turn_id)}
                >
                  Open
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </details>
  )
}
