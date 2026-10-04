/**
 * Hidden notes in an edit: `<!-- like this -->`. The user, 2026-10-03: comments that are *"not
 * visible when rendered for the human user"* but are kept for the steering work that reads the
 * edits (`talkthrough_03.md` §8), as a reason for a change or a fact the model got wrong.
 *
 * Removed from the **string**, before it is rendered, spoken or copied — never from the AST — so
 * the renderer and the talkthrough's parser see the same text and their offsets still agree. The
 * edit box and the saved record keep the raw text, notes and all. A note on lines of its own goes
 * with its line break, so it never splits a paragraph in two. An unclosed `<!--` is left alone and
 * stays visible, which is how a writer notices it.
 */
export const withoutNotes = (markdown: string) =>
  markdown.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*(?:\r?\n|$)/gm, '').replace(/<!--[\s\S]*?-->/g, '')
