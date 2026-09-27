/**
 * Saving the user's rewrite of a question or an answer. `talkthrough_02.md` §6.
 *
 * An edit always takes effect in the browser at once: the screen shows it and the talkthrough
 * speaks it. It is **also** written to disk, beside the drawing and with the model's original,
 * whenever the server has its editor routes and the editor is unlocked (or needs no password).
 * Otherwise it lasts as long as the conversation, and the edit box says so — inside the box,
 * never on the rendered answer, which may be on camera.
 */

import { hasEditorPassword, putEditedAnswer } from '@/api/client'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'

/** Whether an edit made now would reach the disk. */
export function savesToDisk(): boolean {
  const editing = useAppStore.getState().health?.editing
  return !!editing?.enabled && (!editing.password_required || hasEditorPassword())
}

/**
 * Write the record for the turn that `messageId` belongs to — the answer itself, or the answer
 * that follows a question. Resolves to whether it reached the disk; throws on a refused save.
 */
export async function persistEdits(messageId: string): Promise<boolean> {
  if (!savesToDisk()) return false
  const messages = useChatStore.getState().messages
  const at = messages.findIndex((m) => m.id === messageId)
  if (at < 0) return false
  const answerAt = messages[at].role === 'assistant' ? at : messages.findIndex((m, k) => k > at && m.role === 'assistant')
  const answer = messages[answerAt]
  if (!answer?.turnId) return false
  let questionAt = answerAt - 1
  while (questionAt >= 0 && messages[questionAt].role !== 'user') questionAt--
  const question = messages[questionAt]
  await putEditedAnswer(answer.turnId, {
    question: question?.text ?? '',
    question_edited: question?.edited ?? null,
    answer: answer.text,
    answer_edited: answer.edited ?? null,
    model: answer.model ?? null,
  })
  return true
}
