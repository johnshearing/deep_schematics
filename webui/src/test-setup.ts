import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL only registers its own auto-cleanup when vitest globals are on, and they are not.
// Without this, `screen` queries hit every previously-rendered App still in the document and
// every assertion fails with "found multiple elements".
afterEach(cleanup)

/** jsdom gaps, not application gaps. Both of these exist in every real browser. */
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {})

if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((handle: number) =>
    clearTimeout(handle)) as typeof cancelAnimationFrame
}
