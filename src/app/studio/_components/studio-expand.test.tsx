import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioExpandLauncher, StudioExpandOverlay, StudioExpandPanel } from './studio-expand'

describe('StudioExpandLauncher', () => {
  it('opens expand mode', () => {
    const onOpen = jest.fn()
    render(<StudioExpandLauncher onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand scene' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('StudioExpandPanel', () => {
  it('applies the selected amount and has no direction chips', () => {
    const onApply = jest.fn()
    const onPresetChange = jest.fn()
    const onLayoutChange = jest.fn()
    render(
      <StudioExpandPanel
        preset="balanced"
        layout="left"
        creditLabel="1 credit"
        onPresetChange={onPresetChange}
        onLayoutChange={onLayoutChange}
        onApply={onApply}
        onCancel={jest.fn()}
      />,
    )
    expect(screen.getByText('Create more room around your dish without changing the food.')).toBeInTheDocument()
    expect(screen.getByText(/Drag a corner or edge to place extra scene/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editorial' }))
    expect(onPresetChange).toHaveBeenCalledWith('editorial')
    expect(screen.queryByRole('button', { name: 'Left' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'All sides' }))
    expect(onLayoutChange).toHaveBeenCalledWith('all')
    fireEvent.click(screen.getByTestId('studio-expand-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('studio-expand-apply')).toHaveTextContent('Expand · 1 credit')
  })

  it('shows a GEN 3+ callout without disabling Apply', () => {
    render(
      <StudioExpandPanel
        preset="a_little"
        creditLabel="1 credit"
        degradationCallout={<div data-testid="studio-degradation-callout">GEN 3 warning</div>}
        onPresetChange={jest.fn()}
        onApply={jest.fn()}
        onCancel={jest.fn()}
      />,
    )
    expect(screen.getByTestId('studio-degradation-callout')).toBeInTheDocument()
    expect(screen.getByTestId('studio-expand-apply')).toBeEnabled()
  })
})

describe('StudioExpandOverlay', () => {
  it('exposes corner and edge handles only', () => {
    render(<StudioExpandOverlay preset="balanced" onChange={jest.fn()} />)
    const handles = screen.getAllByRole('button').map((el) => el.getAttribute('data-expand-handle'))
    expect(handles).toEqual(['nw', 'ne', 'sw', 'se', 'n', 'e', 's', 'w'])
  })

  it('updates layout only after a drag, not on press', () => {
    const onChange = jest.fn()
    const originalCapture = Object.getOwnPropertyDescriptor(Element.prototype, 'setPointerCapture')
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      configurable: true,
      value: jest.fn(),
    })
    render(<StudioExpandOverlay preset="balanced" onChange={onChange} />)
    const overlay = screen.getByTestId('studio-expand-overlay')
    overlay.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        toJSON: () => ({}),
      }) as DOMRect
    try {
      fireEvent.pointerDown(screen.getByLabelText('Resize expand w'), {
        pointerId: 1,
        button: 0,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 50,
      })
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.pointerMove(overlay, {
        pointerId: 1,
        button: 0,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 50,
      })
      expect(onChange).toHaveBeenCalledWith({ preset: 'editorial', layout: 'left' })
      fireEvent.pointerDown(screen.getByLabelText('Resize expand se'), {
        pointerId: 2,
        button: 0,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 100,
      })
      fireEvent.pointerMove(overlay, {
        pointerId: 2,
        button: 0,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 100,
      })
      expect(onChange).toHaveBeenCalledWith({ preset: 'editorial', layout: 'bottom_right' })
    } finally {
      if (originalCapture) Object.defineProperty(Element.prototype, 'setPointerCapture', originalCapture)
      else Reflect.deleteProperty(Element.prototype, 'setPointerCapture')
    }
  })
})
