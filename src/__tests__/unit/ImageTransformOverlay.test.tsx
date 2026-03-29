import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { ImageTransformOverlay } from '@/components/ImageTransformOverlay'

function mockOverlayRect(element: HTMLElement, width = 100, height = 100) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  })
}

describe('ImageTransformOverlay', () => {
  it('uses the rendered image frame for cutout interactions', () => {
    const onChange = jest.fn()

    render(
      <ImageTransformOverlay
        itemId="item-1"
        imageMode="cutout"
        currentTransform={{ offsetX: 0, offsetY: 0, scale: 1 }}
        onChange={onChange}
        frame={{ left: 0, top: 0, width: 250, height: 250 }}
      />
    )

    const overlay = screen.getByTitle('Drag to reposition · Scroll to zoom')
    expect(overlay).toHaveStyle({
      left: '0px',
      top: '0px',
      width: '250px',
      height: '250px',
    })
  })

  it.each([
    { imageMode: 'cutout' as const, dragTo: { x: 70, y: 70 }, expected: { offsetX: 20, offsetY: 20 } },
    { imageMode: 'stretch' as const, dragTo: { x: 70, y: 70 }, expected: { offsetX: -20, offsetY: -20 } },
    { imageMode: 'compact-rect' as const, dragTo: { x: 70, y: 70 }, expected: { offsetX: -20, offsetY: -20 } },
    { imageMode: 'compact-circle' as const, dragTo: { x: 70, y: 70 }, expected: { offsetX: -20, offsetY: -20 } },
    { imageMode: 'background' as const, dragTo: { x: 70, y: 70 }, expected: { offsetX: -20, offsetY: -20 } },
  ])('keeps drag direction aligned for $imageMode images', ({ imageMode, dragTo, expected }) => {
    const onChange = jest.fn()

    render(
      <ImageTransformOverlay
        itemId="item-1"
        imageMode={imageMode}
        currentTransform={{ offsetX: 0, offsetY: 0, scale: 1 }}
        onChange={onChange}
      />
    )

    const overlay = screen.getByTitle('Drag to reposition · Scroll to zoom')
    mockOverlayRect(overlay, 100, 100)

    fireEvent.mouseDown(overlay, { clientX: 50, clientY: 50 })
    fireEvent.mouseMove(window, { clientX: dragTo.x, clientY: dragTo.y })

    expect(onChange).toHaveBeenLastCalledWith('item-1', {
      ...expected,
      scale: 1,
    })
  })
})
