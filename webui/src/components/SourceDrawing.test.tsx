/**
 * The button and the frame are coupled by one store flag and one URL, and both failure modes
 * are quiet: a button that opens an empty overlay, or an overlay that never opens. Neither
 * throws, so only a test catches them.
 *
 * The absent case matters just as much — `source` is `null` for an extraction with no PDF
 * beside it, and older servers do not send the field at all. Both must mean "no button",
 * not "a button that 404s".
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { SourceDrawingButton, SourceDrawingViewer } from './SourceDrawing'
import type { DrawingSummary } from '@/api/types'
import { useAppStore } from '@/stores/appStore'

const DRAWING = {
  drawing_number: 'PS20115MLM4-2',
  title: 'MOD-LINX POWER SUPPLY ASSY',
  assembly: null, date: null, revision: null, revision_note: null, proprietary_notice: null,
  notes: [], references: [], counts: {}, subsystems: [], component_classes: {},
  relationship_types: {}, artifacts: [],
  source: { name: 'PS20115MLM4-2.pdf', bytes: 151164, media_type: 'application/pdf' },
} satisfies DrawingSummary

function setDrawing(source: DrawingSummary['source']) {
  useAppStore.setState({ drawing: { ...DRAWING, source }, sourceOpen: false })
}

beforeEach(() => setDrawing(DRAWING.source))
afterEach(() => useAppStore.setState({ sourceOpen: false }))

describe('SourceDrawing', () => {
  it('opens the sheet the netlist came from', () => {
    render(
      <>
        <SourceDrawingButton />
        <SourceDrawingViewer />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: /show the drawing/i }))

    const frame = screen.getByTitle('Source drawing') as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBe('/api/source')
    // The escape hatch for a browser that will not render a PDF inline.
    expect(screen.getByRole('link', { name: /new tab/i }).getAttribute('href')).toBe('/api/source')
  })

  it('closes on Escape, which is the only key the PDF frame lets us have', () => {
    // Open before mounting: the listener is bound by the effect that runs on open, and there
    // is nothing to press Escape at until it is.
    useAppStore.setState({ sourceOpen: true })
    render(<SourceDrawingViewer />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(useAppStore.getState().sourceOpen).toBe(false)
  })

  it('offers nothing when no PDF sits beside the extraction', () => {
    setDrawing(null)
    const { container } = render(<SourceDrawingButton />)
    expect(container.firstChild).toBeNull()
  })

  it('offers nothing when the server is too old to report a source', () => {
    setDrawing(undefined)
    const { container } = render(<SourceDrawingButton />)
    expect(container.firstChild).toBeNull()
  })
})
