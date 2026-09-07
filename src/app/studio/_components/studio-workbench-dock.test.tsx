import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { clampDockPosition, StudioWorkbenchDock } from './studio-workbench-dock'

const BOUNDS = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }
const DOCK = { left: 200, top: 450, width: 400, height: 100, right: 600, bottom: 550 }

function asRect(box: typeof BOUNDS): DOMRect {
  return {
    x: box.left,
    y: box.top,
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    right: box.right,
    bottom: box.bottom,
    toJSON: () => ({}),
  } as DOMRect
}

function stubRects() {
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    const id = this.getAttribute('data-testid')
    if (id === 'studio-workbench-dock') return asRect(DOCK)
    if (id === 'studio-workbench-dock-bounds') return asRect(BOUNDS)
    return asRect({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 })
  }
  const capture = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'] as const
  const originals = capture.map((method) => {
    const original = Object.getOwnPropertyDescriptor(Element.prototype, method)
    Object.defineProperty(Element.prototype, method, { configurable: true, value: jest.fn() })
    return { method, original }
  })
  return () => {
    HTMLElement.prototype.getBoundingClientRect = originalRect
    originals.forEach(({ method, original }) => {
      if (original) Object.defineProperty(Element.prototype, method, original)
      else Reflect.deleteProperty(Element.prototype, method)
    })
  }
}

describe('clampDockPosition', () => {
  it('keeps the dock inside the canvas with a margin', () => {
    expect(
      clampDockPosition({
        left: -40,
        top: 900,
        dockWidth: 400,
        dockHeight: 100,
        boundsWidth: 800,
        boundsHeight: 600,
      }),
    ).toEqual({ left: 12, top: 488 })
  })
})

describe('StudioWorkbenchDock', () => {
  it('drags from the move handle and ignores control clicks', () => {
    const onApply = jest.fn()
    const restore = stubRects()
    render(
      <div className="relative h-[600px] w-[800px]">
        <StudioWorkbenchDock>
          <button type="button" onClick={onApply}>
            Apply reframe
          </button>
        </StudioWorkbenchDock>
      </div>,
    )
    const dock = screen.getByTestId('studio-workbench-dock')
    expect(dock).not.toHaveStyle({ left: '120px' })

    const handle = screen.getByRole('button', { name: 'Move panel' })
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400, clientY: 440, button: 0 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 320, clientY: 240 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 320, clientY: 240 })
    expect(dock).toHaveStyle({ left: '120px', top: '250px' })

    fireEvent.click(screen.getByRole('button', { name: 'Apply reframe' }))
    expect(onApply).toHaveBeenCalledTimes(1)
    restore()
  })

  it('nudges with arrow keys from the move handle', () => {
    const restore = stubRects()
    render(
      <StudioWorkbenchDock>
        <p>Remove</p>
      </StudioWorkbenchDock>,
    )
    const handle = screen.getByRole('button', { name: 'Move panel' })
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(screen.getByTestId('studio-workbench-dock')).toHaveStyle({ left: '200px', top: '434px' })
    restore()
  })
})
