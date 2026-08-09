import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => safeHref(url) ?? ''}
        components={{
          a({ href, children: label, ...rest }) {
            const safe = safeHref(href)
            if (!safe) return <span title="link removed">{label}</span>
            return (
              <a href={safe} target="_blank" rel="noopener noreferrer nofollow" {...rest}>
                {label}
              </a>
            )
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
