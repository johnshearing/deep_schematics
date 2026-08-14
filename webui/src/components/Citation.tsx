/**
 * A backticked identifier in an answer, turned into somewhere you can go.
 *
 * This is the half of bidirectional citation that lives in the text. `prompts.py` already
 * requires every claim to cite identifiers in backticks — `` `CR-BP` ``, `` `W048` ``,
 * `` `TB-110:3` `` — so the hook was already there; all that was missing was knowing which of
 * those spans are real.
 *
 * **Strictly an allowlist lookup, never a pattern.** The text is model output. Matching
 * `/^W\d{3}$/` against it would let an answer mint clickable targets that resolve to whatever
 * the viewer does with an unknown id, and "the model said it, so it must be a wire" is not a
 * property this application is willing to have. A span is clickable only if the server put it
 * in the designator index; everything else renders exactly as it did before — which is also
 * why `circuit_logic.json`, `nets[]` and every other backticked filename stay plain.
 *
 * Not clickable, deliberately, in three cases: no index (an older server, or a failed fetch),
 * no Drawing tab (an extraction that was never rendered to tiles), and an id with no location
 * anywhere on the sheet — the two off-page machines and the four referenced drawings. All
 * three degrade to the plain `<code>` this shipped with.
 */

import { memo, type ReactNode } from 'react'

import { resolve } from '@/lib/designators'
import { useAppStore } from '@/stores/appStore'
import { DRAWING_TAB_ID } from '@/tabIds'

/** `react-markdown` hands inline code its children as text, but the type allows anything. */
function textOf(children: ReactNode): string | null {
  if (typeof children === 'string') return children
  if (Array.isArray(children) && children.every((c) => typeof c === 'string')) {
    return children.join('')
  }
  return null
}

export const Citation = memo(function Citation({ children }: { children: ReactNode }) {
  const byToken = useAppStore((s) => s.byToken)
  const hasViewer = useAppStore((s) => !!s.drawing?.tiles?.count)
  const select = useAppStore((s) => s.select)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  const entry = resolve(byToken, textOf(children))
  if (!entry || !entry.point || !hasViewer) return <code>{children}</code>

  return (
    <button
      type="button"
      className="cite"
      title={
        `${entry.label}\nShow it on the drawing.` +
        (entry.on_sheet ? '' : '\nThis id was assigned during extraction — it is not printed on the sheet.')
      }
      onClick={() => {
        select(entry.kind, entry.id)
        // The store must not import the tab registry, so the tab switch is the caller's job.
        setActiveTab(DRAWING_TAB_ID)
      }}
    >
      <code>{children}</code>
    </button>
  )
})
