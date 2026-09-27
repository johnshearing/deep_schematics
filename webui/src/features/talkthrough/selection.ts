/**
 * The reader's selection in a rendered answer, as two `Mark`s `sliceTalk` understands.
 * `talkthrough_02.md` §5.
 *
 * Each end is found in the nearest element `Markdown.tsx` marked with `data-md`, and measured as
 * characters of that element's text — the same text `buildTalk`'s `from`/`to` count. An end that
 * lies in nothing marked (a code block) is moved to the nearest marked block on the inward side.
 * A selection that only partly overlaps the answer is clipped to it; one entirely outside it is
 * no selection at all, and the whole answer is spoken.
 */

import type { Mark } from './buildTalk'

export interface Span { from: Mark; to: Mark }

function mark(root: HTMLElement, node: Node, offset: number, edge: 'start' | 'end'): Mark | null {
  const element = (node instanceof Element ? node : node.parentElement)?.closest('[data-md]')
  if (element && root.contains(element)) {
    const before = document.createRange()
    before.setStart(element, 0)
    before.setEnd(node, offset)
    return { key: Number(element.getAttribute('data-md')), offset: before.toString().length }
  }
  const point = document.createRange()
  point.setStart(node, offset)
  const marked = [...root.querySelectorAll('[data-md]')]
  // `comparePoint` is -1 for a place before the (collapsed) boundary and 1 for one after it.
  const found =
    edge === 'start'
      ? marked.find((m) => point.comparePoint(m, 0) >= 0)
      : marked.filter((m) => point.comparePoint(m, 0) <= 0).at(-1)
  if (!found) return null
  return { key: Number(found.getAttribute('data-md')), offset: edge === 'start' ? 0 : Infinity }
}

export function readSelection(root: HTMLElement | null): Span | null {
  const selection = root ? window.getSelection?.() : null
  if (!root || !selection || selection.isCollapsed || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!range.intersectsNode(root)) return null
  const all = document.createRange()
  all.selectNodeContents(root)
  const startsBefore = range.compareBoundaryPoints(Range.START_TO_START, all) < 0
  const endsAfter = range.compareBoundaryPoints(Range.END_TO_END, all) > 0
  if (startsBefore && endsAfter) return null // the whole answer, and more: nothing to narrow
  const from = startsBefore
    ? mark(root, all.startContainer, all.startOffset, 'start')
    : mark(root, range.startContainer, range.startOffset, 'start')
  const to = endsAfter
    ? mark(root, all.endContainer, all.endOffset, 'end')
    : mark(root, range.endContainer, range.endOffset, 'end')
  return from && to ? { from, to } : null
}
