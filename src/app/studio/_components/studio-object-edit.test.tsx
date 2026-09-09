import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import '@testing-library/jest-dom'

import {
  StudioObjectEditLauncher,
  StudioObjectEditPanel,
  StudioObjectEditStatus,
  StudioSelectionOverlay,
} from './studio-object-edit'
import { selectionFromStrokes } from '@/lib/studio/object-edit/selection'

const selection = selectionFromStrokes(
  [
    { kind: 'tap', points: [{ x: 0.25, y: 0.5 }] },
    { kind: 'path', points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }] },
  ],
  { width: 1000, height: 1000 },
)

const EMPTY = selectionFromStrokes([], { width: 1000, height: 1000 })

/**
 * Annotation strokes live in the overlay's single geometry SVG. Target markers
 * are separate sibling SVGs, so the geometry SVG must be scoped explicitly.
 */
function annotationStrokePaths(): SVGPathElement[] {
  const overlay = screen.getByTestId('studio-selection-overlay')
  const geometry = overlay.querySelector('svg')
  if (!geometry) throw new Error('Overlay geometry SVG was not rendered.')
  return Array.from(geometry.querySelectorAll('path'))
}

describe('Remove-only object-edit components', () => {
  it('exposes an accessible launcher and 44px-or-larger controls', () => {
    const onOpen = jest.fn()
    render(<StudioObjectEditLauncher onOpen={onOpen} />)

    const launcher = screen.getByRole('button', { name: 'Remove object' })
    expect(launcher).toHaveClass('min-h-11')
    fireEvent.click(launcher)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders raw tap/path guidance and neutral status without internal terminology', () => {
    render(<StudioSelectionOverlay selection={selection} />)
    const overlay = screen.getByTestId('studio-selection-overlay')
    expect(overlay.querySelectorAll('path')).toHaveLength(4)
    expect(overlay.querySelectorAll('circle')).toHaveLength(2)
    expect(overlay).toHaveAttribute('aria-hidden', 'true')

    const markup = overlay.outerHTML.toLowerCase()
    for (const banned of ['mask', 'segmentation', 'lasso', 'pixel selection', 'confidence']) {
      expect(markup).not.toContain(banned)
    }
  })

  it('draws annotation strokes at a visible screen-space width', () => {
    render(<StudioSelectionOverlay selection={selection} />)
    const strokePaths = annotationStrokePaths()

    expect(strokePaths).toHaveLength(2)
    for (const path of strokePaths) {
      // `non-scaling-stroke` resolves stroke-width in screen pixels, so a
      // normalized width such as 0.018 renders as an invisible hairline.
      expect(path).toHaveAttribute('vector-effect', 'non-scaling-stroke')
      expect(Number(path.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders an in-progress drag as a preview path', () => {
    render(
      <StudioSelectionOverlay
        selection={EMPTY}
        previewPoints={[{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.5 }, { x: 0.6, y: 0.55 }]}
      />,
    )

    const previewPaths = annotationStrokePaths()
    expect(previewPaths).toHaveLength(2)
    expect(previewPaths[0].getAttribute('d')).toBe('M 0.2 0.2 L 0.4 0.5 L 0.6 0.55')
    expect(Number(previewPaths[0].getAttribute('stroke-width'))).toBeGreaterThanOrEqual(1)
    expect(screen.queryByTestId('studio-selection-preview-marker')).not.toBeInTheDocument()
  })

  it('renders a target marker for a single pressed point', () => {
    render(<StudioSelectionOverlay selection={EMPTY} previewPoints={[{ x: 0.3, y: 0.7 }]} />)

    const marker = screen.getByTestId('studio-selection-preview-marker')
    expect(marker).toHaveStyle({ left: '30%', top: '70%' })
    // A fixed 44px marker box keeps the crosshair square on any image aspect ratio.
    expect(marker.querySelector('svg')).toHaveAttribute('viewBox', '0 0 44 44')
  })

  it('has no axe violations for the Remove panel', async () => {
    const { container } = render(
      <StudioObjectEditPanel
        selection={selection}
        canGenerate
        creditLabel="1 credit"
        busy={false}
        onUndo={jest.fn()}
        onClear={jest.fn()}
        onGenerate={jest.fn()}
        onCancel={jest.fn()}
        onClose={jest.fn()}
      />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })

  it('keeps Undo, Clear, Remove, Cancel, and Close keyboard-operable', () => {
    const handlers = {
      onUndo: jest.fn(),
      onClear: jest.fn(),
      onGenerate: jest.fn(),
      onCancel: jest.fn(),
      onClose: jest.fn(),
    }
    render(
      <StudioObjectEditPanel
        selection={selection}
        canGenerate
        creditLabel="1 credit"
        busy={false}
        {...handlers}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Selection added')
    expect(screen.getByText(/Remove one object by tapping or drawing over it/)).toBeInTheDocument()
    expect(screen.getByText(/Counts as a generation/)).toBeInTheDocument()
    expect(screen.queryByText(/^Move\b/i)).not.toBeInTheDocument()
    for (const name of ['Undo', 'Clear', 'Remove selected object, 1 credit', 'Cancel', 'Close image editing']) {
      const button = screen.getByRole('button', { name })
      expect(button).toHaveClass('min-h-11')
      fireEvent.keyDown(button, { key: 'Enter' })
      fireEvent.click(button)
    }
    expect(handlers.onUndo).toHaveBeenCalled()
    expect(handlers.onClear).toHaveBeenCalled()
    expect(handlers.onGenerate).toHaveBeenCalled()
    expect(handlers.onCancel).toHaveBeenCalled()
    expect(handlers.onClose).toHaveBeenCalled()
  })

  it('compacts the Remove dock and drops the extra Close control', () => {
    render(
      <StudioObjectEditPanel
        overlay
        selection={selection}
        canGenerate
        creditLabel="1 credit"
        busy={false}
        onUndo={jest.fn()}
        onClear={jest.fn()}
        onGenerate={jest.fn()}
        onCancel={jest.fn()}
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByTestId('studio-object-edit-panel')).toHaveClass('studio-tool-dock')
    expect(screen.queryByText(/Counts as a generation/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close image editing' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Selection added')
  })

  it('shows a GEN 3+ callout and still runs Remove', () => {
    const onGenerate = jest.fn()
    render(
      <StudioObjectEditPanel
        overlay
        selection={selection}
        canGenerate
        creditLabel="1 credit"
        busy={false}
        onUndo={jest.fn()}
        onClear={jest.fn()}
        onGenerate={onGenerate}
        onCancel={jest.fn()}
        onClose={jest.fn()}
        degradationCallout={<div data-testid="studio-degradation-callout">GEN 3 warning</div>}
      />,
    )
    expect(screen.getByTestId('studio-degradation-callout')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected object, 1 credit' }))
    expect(onGenerate).toHaveBeenCalled()
  })

  it('uses the selected model credit label and gives focused-limit guidance without semantic internals', () => {
    const manyMarks = selectionFromStrokes(
      Array.from({ length: 8 }, (_, index) => ({
        kind: 'tap' as const,
        points: [{ x: 0.1 + index * 0.05, y: 0.5 }],
      })),
      { width: 1000, height: 1000 },
    )
    render(<StudioObjectEditStatus selection={manyMarks} />)

    expect(screen.getByRole('status')).toHaveTextContent('8/8 marks')
    expect(screen.getByText(/maximum number of marks/i)).toBeInTheDocument()
    expect(screen.getByText(/keep the annotation focused/i)).toBeInTheDocument()
    expect(screen.queryByText(/mask|segmentation|lasso|confidence|pixel selection/i)).not.toBeInTheDocument()
  })
})
