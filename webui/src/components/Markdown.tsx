import { createElement, memo } from 'react'
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Citation } from './Citation'

/**
 * The answer is untrusted markdown. Plan §3.4.
 *
 * It is model output, and the model has just read files that a future version of this app
 * will let people upload. So it gets treated the way you would treat a comment box:
 *
 * - **No `rehype-raw`.** LightRAG's WebUI uses it, and it re-enables raw HTML from model
 *   output — which is the whole attack. Without it, `react-markdown` renders `<script>` and
 *   `<img onerror=…>` as literal text.
 * - **Link schemes are allowlisted** to `http`, `https` and in-page anchors, so
 *   `[x](javascript:alert(1))` becomes an inert span rather than a link.
 * - **Images render as alt text only.** No remote fetch means no exfiltration by image URL —
 *   the quiet one, where a model is talked into encoding what it read into a query string.
 *
 * The orientation prompt also tells the model not to emit any of this. That is a request;
 * this is the control.
 *
 * `code` is the one element with a *feature* on it rather than a restriction: a backticked
 * identifier that the server's designator index recognises becomes a button that points the
 * drawing at it. That is an allowlist lookup and nothing else — see `Citation.tsx`. It does not
 * relax anything above: the span still renders as text, and a `<code>` that resolves to nothing
 * is untouched.
 *
 * The blocks a talkthrough speaks carry one more attribute, `data-md`: the markdown offset of the
 * node they came from, which is how a selection in the answer is mapped back to the sentences to
 * speak (`features/talkthrough/selection.ts`). A number the parser computed, never text from the
 * answer, so it adds nothing to what an answer can put on the page.
 */

const SAFE_SCHEMES = ['http:', 'https:', 'mailto:']

function safeHref(href: string | undefined): string | null {
  if (!href) return null
  const trimmed = href.trim()
  if (trimmed.startsWith('#')) return trimmed
  try {
    const url = new URL(trimmed, window.location.origin)
    return SAFE_SCHEMES.includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

const MARKED = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr'] as const

const marked = Object.fromEntries(
  MARKED.map((tag) => [
    tag,
    ({ node, ...props }: ExtraProps & Record<string, unknown>) =>
      createElement(tag, { ...props, 'data-md': node?.position?.start.offset }),
  ]),
) as Components

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => safeHref(url) ?? ''}
        components={{
          ...marked,
          a({ href, children: label, ...rest }) {
            const safe = safeHref(href)
            if (!safe) return <span title="link removed">{label}</span>
            return (
              <a href={safe} target="_blank" rel="noopener noreferrer nofollow" {...rest}>
                {label}
              </a>
            )
          },
          code({ className, children }) {
            // Only *inline* code is a candidate. react-markdown 9 dropped the `inline` prop,
            // so this is the test that is left: a fenced block carries `language-…` when it
            // names one, and mdast keeps the trailing newline of a block when it does not.
            const fenced = /language-/.test(className ?? '') || String(children).includes('\n')
            if (fenced) return <code className={className}>{children}</code>
            return <Citation>{children}</Citation>
          },
          img({ alt }) {
            return (
              <span className="text-xs text-muted-foreground italic">[image: {alt || 'untitled'}]</span>
            )
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
