import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL only registers its own auto-cleanup when vitest globals are on, and they are not.
// Without this, `screen` queries hit every previously-rendered App still in the document and
// every assertion fails with "found multiple elements".
afterEach(cleanup)

/** jsdom gaps, not application gaps. Both of these exist in every real browser. */
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {})

/**
 * jsdom has no layout engine and so no `ResizeObserver`. The tile viewer measures its
 * container through one, so without a stand-in it would never size the sheet and every test
 * of it would assert against an empty box. Firing once on `observe` matches the real
 * contract, which delivers an initial observation.
 */
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver)
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

/**
 * jsdom implements no 2D context — `getContext('2d')` reports "not implemented" to the virtual
 * console and hands back null. The tile viewer already guards against a null context, so this
 * is not covering a crash; it is keeping a real jsdom gap from filling the test output with
 * errors that mean nothing. The drawing arithmetic is tested directly in `paint.test.ts`,
 * against a recording context, rather than through the DOM.
 */
HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement['getContext']

if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((handle: number) =>
    clearTimeout(handle)) as typeof cancelAnimationFrame
}
