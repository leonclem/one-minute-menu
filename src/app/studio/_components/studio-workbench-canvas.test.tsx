import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioWorkbenchCanvas } from './studio-workbench-canvas'
import { EMPTY_SELECTION, type SelectionState } from '@/lib/studio/object-edit/selection'

const VIEWPORT_WIDTH = 500
const VIEWPORT_HEIGHT = 400
const NATURAL_SIZE = { width: 1000, height: 800 }

// fitScale = min((500 - 24) / 1000, (400 - 24) / 800) = 0.47
const BOUNDS = { left: 15, top: 12, width: 470, height: 376 }

function stubLayout() {
  const cleanups: Array<() => void> = []

  const define = (key: 'clientWidth' | 'clientHeight', value: number) => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, value })
    cleanups.push(() => {
      if (original) Object.defineProperty(HTMLElement.prototype, key, original)
      else Reflect.deleteProperty(HTMLElement.prototype, key)
    })
  }

  define('clientWidth', VIEWPORT_WIDTH)
  define('clientHeight', VIEWPORT_HEIGHT)

  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: VIEWPORT_WIDTH,
      bottom: VIEWPORT_HEIGHT,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      toJSON: () => ({}),
    } as DOMRect
  }
  cleanups.push(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect
  })

  // jsdom does not implement pointer capture.
  for (const method of ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const) {
    const original = Object.getOwnPropertyDescriptor(Element.prototype, method)
    Object.defineProperty(Element.prototype, method, {
      configurable: true,
      value: jest.fn(),
    })
    cleanups.push(() => {
      if (original) Object.defineProperty(Element.prototype, method, original)
      else Reflect.deleteProperty(Element.prototype, method)
    })
  }

  return () => cleanups.forEach((cleanup) => cleanup())
}

function loadImage() {
  const image = screen.getByRole('img', { name: 'Current studio image' })
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: NATURAL_SIZE.width })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: NATURAL_SIZE.height })
  fireEvent.load(image)
}

function renderSelectionCanvas() {
  const onSelectionChange = jest.fn()
  const onSelectionRejected = jest.fn()

  const view = render(
    <StudioWorkbenchCanvas
      src="https://example.com/dish.png"
      alt="Current studio image"
      expandLabel="Expand Variant 1 preview"
      onExpand={jest.fn()}
      selectionMode
      selection={EMPTY_SELECTION}
      naturalSize={NATURAL_SIZE}
      onSelectionChange={onSelectionChange}
      onSelectionRejected={onSelectionRejected}
    />,
  )

  loadImage()

  // The overlay only mounts once the image box is measurable, so the layout
  // stubs are asserted here rather than being silently ignored by the gestures.
  const imageBox = view.container.querySelector<HTMLElement>('div.absolute[style*="width"]')
  expect(imageBox?.style.width).toBe(`${BOUNDS.width}px`)
  expect(imageBox?.style.height).toBe(`${BOUNDS.height}px`)
  expect(imageBox?.style.left).toBe(`${BOUNDS.left}px`)
  expect(imageBox?.style.top).toBe(`${BOUNDS.top}px`)

  return { ...view, onSelectionChange, onSelectionRejected }
}

/** The interaction surface is the only element carrying the crosshair cursor. */
function interactionSurface(container: HTMLElement): HTMLElement {
  const surface = container.querySelector<HTMLElement>('.cursor-crosshair')
  if (!surface) throw new Error('Selection interaction surface was not rendered.')
  return surface
}

describe('StudioWorkbenchCanvas', () => {
  it('keeps expand on a toolbar control so the canvas can pan', () => {
    const onExpand = jest.fn()
    render(
      <StudioWorkbenchCanvas
        src="https://example.com/dish.png"
        alt="Current studio image"
        expandLabel="Expand Variant 1 preview"
        onExpand={onExpand}
      />,
    )

    expect(screen.getByRole('img', { name: 'Current studio image' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand Variant 1 preview' }))
    expect(onExpand).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Zoom 100%')).toHaveTextContent('100%')
    expect(screen.getByRole('button', { name: 'Zoom in' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Zoom out' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Current studio image' }).closest('.studio-checkerboard')).toBeTruthy()
  })

  it('keeps the fitted frame while a new shot src loads', () => {
    const restoreLayout = stubLayout()
    try {
      const { rerender, container } = render(
        <StudioWorkbenchCanvas
          src="https://example.com/shot-a.png"
          alt="Current studio image"
          expandLabel="Expand preview"
          onExpand={jest.fn()}
        />,
      )
      loadImage()
      const frame = () => container.querySelector<HTMLElement>('div.absolute[style*="width"]')
      expect(frame()?.style.width).toBe(`${BOUNDS.width}px`)

      rerender(
        <StudioWorkbenchCanvas
          src="https://example.com/shot-b.png"
          alt="Current studio image"
          expandLabel="Expand preview"
          onExpand={jest.fn()}
        />,
      )
      expect(frame()?.style.width).toBe(`${BOUNDS.width}px`)
      expect(screen.getByRole('img', { name: 'Current studio image' })).toHaveAttribute(
        'src',
        'https://example.com/shot-b.png',
      )

      const nextSize = { width: 1600, height: 900 }
      const nextImage = screen.getByRole('img', { name: 'Current studio image' })
      Object.defineProperty(nextImage, 'naturalWidth', { configurable: true, value: nextSize.width })
      Object.defineProperty(nextImage, 'naturalHeight', { configurable: true, value: nextSize.height })
      fireEvent.load(nextImage)
      // 1600×900 into a 500×400 viewport with 12px padding fits at 476×267.75.
      expect(frame()?.style.width).toBe('476px')
      expect(frame()?.style.height).toBe('267.75px')
    } finally {
      restoreLayout()
    }
  })
})

describe('StudioWorkbenchCanvas selection gestures', () => {
  let restoreLayout: () => void

  beforeEach(() => {
    restoreLayout = stubLayout()
  })

  afterEach(() => {
    restoreLayout()
  })

  it('shows a live preview path while a drag is in progress', () => {
    const { container } = renderSelectionCanvas()
    const surface = interactionSurface(container)

    fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 })
    expect(screen.getByTestId('studio-selection-preview-marker')).toBeInTheDocument()

    fireEvent.pointerMove(surface, { pointerId: 1, pointerType: 'mouse', clientX: 200, clientY: 180 })
    fireEvent.pointerMove(surface, { pointerId: 1, pointerType: 'mouse', clientX: 300, clientY: 250 })

    const overlay = screen.getByTestId('studio-selection-overlay')
    const geometry = overlay.querySelector('svg')
    const previewPaths = Array.from(geometry?.querySelectorAll('path') ?? [])
    expect(previewPaths).toHaveLength(2)
    expect(previewPaths[0].getAttribute('d')).toMatch(/^M .+ L .+ L .+$/)
  })

  it('adds a completed drag as one path stroke and drops the preview', () => {
    const { container, onSelectionChange, onSelectionRejected } = renderSelectionCanvas()
    const surface = interactionSurface(container)

    fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(surface, { pointerId: 1, pointerType: 'mouse', clientX: 200, clientY: 180 })
    fireEvent.pointerUp(surface, { pointerId: 1, pointerType: 'mouse', clientX: 300, clientY: 250 })

    expect(onSelectionRejected).not.toHaveBeenCalled()
    expect(onSelectionChange).toHaveBeenCalledTimes(1)

    const selection = onSelectionChange.mock.calls[0][0] as SelectionState
    expect(selection.strokes).toHaveLength(1)
    expect(selection.strokes[0].kind).toBe('path')
    expect(selection.strokes[0].points).toHaveLength(3)
    expect(selection.strokes[0].points[0]).toEqual({
      x: (100 - BOUNDS.left) / BOUNDS.width,
      y: (100 - BOUNDS.top) / BOUNDS.height,
    })
    expect(selection.strokes[0].points[2]).toEqual({
      x: (300 - BOUNDS.left) / BOUNDS.width,
      y: (250 - BOUNDS.top) / BOUNDS.height,
    })
    expect(screen.queryByTestId('studio-selection-preview-marker')).not.toBeInTheDocument()
  })

  it('classifies a small jittered press as one tap stroke', () => {
    const { container, onSelectionChange, onSelectionRejected } = renderSelectionCanvas()
    const surface = interactionSurface(container)

    fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(surface, { pointerId: 1, pointerType: 'mouse', clientX: 102, clientY: 101 })
    fireEvent.pointerUp(surface, { pointerId: 1, pointerType: 'mouse', clientX: 103, clientY: 102 })

    expect(onSelectionRejected).not.toHaveBeenCalled()
    const selection = onSelectionChange.mock.calls[0][0] as SelectionState
    expect(selection.strokes).toHaveLength(1)
    expect(selection.strokes[0].kind).toBe('tap')
  })

  it('accepts a fresh touch gesture after a cancelled touch', () => {
    const { container, onSelectionChange } = renderSelectionCanvas()
    const surface = interactionSurface(container)

    fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 })
    fireEvent.pointerCancel(surface, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 })
    expect(onSelectionChange).not.toHaveBeenCalled()

    fireEvent.pointerDown(surface, { pointerId: 2, pointerType: 'touch', clientX: 150, clientY: 150 })
    fireEvent.pointerMove(surface, { pointerId: 2, pointerType: 'touch', clientX: 260, clientY: 240 })
    fireEvent.pointerUp(surface, { pointerId: 2, pointerType: 'touch', clientX: 260, clientY: 240 })

    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    const selection = onSelectionChange.mock.calls[0][0] as SelectionState
    expect(selection.strokes[0].kind).toBe('path')
  })

  it('does not start object-edit selection when crop mode is open', () => {
    const onSelectionChange = jest.fn()
    const onCropRectChange = jest.fn()
    const view = render(
      <StudioWorkbenchCanvas
        src="https://example.com/dish.png"
        alt="Current studio image"
        expandLabel="Expand Variant 1 preview"
        onExpand={jest.fn()}
        selectionMode
        cropMode
        selection={EMPTY_SELECTION}
        naturalSize={NATURAL_SIZE}
        cropRect={{ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }}
        onSelectionChange={onSelectionChange}
        onCropRectChange={onCropRectChange}
      />,
    )
    loadImage()

    expect(screen.getByTestId('studio-crop-overlay')).toBeInTheDocument()
    expect(view.container.querySelector('.cursor-crosshair')).not.toBeInTheDocument()

    const surface = view.container.querySelector<HTMLElement>('[tabindex="0"]')
    if (!surface) throw new Error('Missing canvas surface')
    fireEvent.pointerDown(surface, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerUp(surface, { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100 })
    expect(onSelectionChange).not.toHaveBeenCalled()
  })
})
