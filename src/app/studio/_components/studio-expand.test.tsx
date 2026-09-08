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
  it('applies the selected preset with a credit label', () => {
    const onApply = jest.fn()
    const onPresetChange = jest.fn()
    render(
      <StudioExpandPanel
        preset="balanced"
        creditLabel="1 credit"
        onPresetChange={onPresetChange}
        onApply={onApply}
        onCancel={jest.fn()}
      />,
    )
    expect(screen.getByText('Create more room around your dish without changing the food.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editorial' }))
    expect(onPresetChange).toHaveBeenCalledWith('editorial')
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
  it('exposes only corner handles', () => {
    render(<StudioExpandOverlay preset="balanced" onChange={jest.fn()} />)
    const handles = screen.getAllByRole('button').map((el) => el.getAttribute('data-expand-handle'))
    expect(handles).toEqual(['nw', 'ne', 'sw', 'se'])
  })
})
