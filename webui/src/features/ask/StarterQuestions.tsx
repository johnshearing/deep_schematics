import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'

/**
 * Chips **fill the composer; they do not send.**
 *
 * Nobody should trigger a $0.64 call by mis-clicking. It costs one extra keystroke and
 * removes an entire class of complaint.
 */
export function StarterQuestions() {
  const questions = useAppStore((s) => s.questions)
  const setComposerText = useChatStore((s) => s.setComposerText)
  const busy = useChatStore((s) => s.busy)

  if (questions.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Try one of these — clicking fills the box, it does not send.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {questions.map((question) => (
          <button
            key={question.id}
            disabled={busy}
            onClick={() => setComposerText(question.text)}
            className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-[var(--color-ring)] disabled:opacity-50"
          >
            <span className="block text-sm leading-snug">{question.text}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">{question.note}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
