/**
 * Tab ids, and nothing else.
 *
 * They used to be declared by the tab components themselves, which was right while only a tab
 * ever needed to name a tab. Bidirectional citation broke that: a clickable citation inside an
 * answer has to send the reader to the Drawing tab, and the Drawing tab has to send them back
 * to Ask with a question prefilled — so `Markdown` → `Citation` → `DrawingTab` → `AskTab` →
 * `MessageView` → `Markdown` closes a cycle, and this project has already been bitten once by
 * exactly that (see the header of `tabs.ts` and the `activeTabId` comment in `appStore`).
 *
 * A leaf module with no imports of its own cannot participate in a cycle. Anything that needs
 * to name a tab imports this; the registry in `tabs.ts` still owns what a tab *is*.
 */

export const ASK_TAB_ID = 'ask'
export const DRAWING_TAB_ID = 'drawing'
