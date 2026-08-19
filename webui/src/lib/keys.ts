/**
 * Keystroke predicates shared by the tabs that listen on `window`.
 *
 * Both the Locate editor and the Drawing tab bind Escape globally rather than to the sheet,
 * because the thing you want to escape from is usually something you armed or clicked somewhere
 * that is not the sheet, and the sheet does not have focus then. A `window` listener sees every
 * keystroke in the application, including the ones being typed into a box, so the one rule they
 * both need is "is this keystroke somebody's else's".
 */

/** Whether a keystroke belongs to something being typed into, and so is not a tab's to take.
 * The pin chips are checkboxes: they hold focus, but nothing is being composed in them, so
 * Escape over one means the same as Escape over the sheet. */
export function isTextField(node: EventTarget | null): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false
  if (node.isContentEditable || node.tagName === 'TEXTAREA') return true
  return node.tagName === 'INPUT' && (node as HTMLInputElement).type !== 'checkbox'
}
