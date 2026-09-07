import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { stackFromIds } from '@/lib/studio/finishing-touches'
import { StudioFinishingTouchesControl } from './studio-finishing-touches'

const options = stackFromIds(['coriander', 'lime_wedge'])

describe('StudioFinishingTouchesControl', () => {
  it('loads suggestions without selecting them automatically', () => {
    const onRequestStack = jest.fn()
    const onToggle = jest.fn()
    const { rerender } = render(
      <StudioFinishingTouchesControl
        stackLoaded={false}
        selectedIds={[]}
        options={[]}
        onRequestStack={onRequestStack}
        onToggle={onToggle}
      />,
    )

    const loadButton = screen.getByRole('button', { name: 'Add finishing touches' })
    expect(loadButton).toHaveClass('bg-[#f8bc02]')
    fireEvent.click(loadButton)
    expect(onRequestStack).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Does not run until you hit Generate/i)).toBeInTheDocument()

    rerender(
      <StudioFinishingTouchesControl
        stackLoaded
        selectedIds={[]}
        options={options}
        onRequestStack={onRequestStack}
        onToggle={onToggle}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add Coriander' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Add Lime wedges' })).toBeInTheDocument()
  })

  it('toggles each suggested garnish independently', () => {
    const onToggle = jest.fn()
    const { rerender } = render(
      <StudioFinishingTouchesControl
        stackLoaded
        selectedIds={[]}
        options={options}
        onRequestStack={jest.fn()}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Coriander' }))
    expect(onToggle).toHaveBeenCalledWith('coriander')

    rerender(
      <StudioFinishingTouchesControl
        stackLoaded
        selectedIds={['coriander']}
        options={options}
        onRequestStack={jest.fn()}
        onToggle={onToggle}
      />,
    )
    const selected = screen.getByRole('button', { name: 'Remove Coriander' })
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(selected).toHaveTextContent('✓')
    expect(screen.getByRole('button', { name: 'Add Lime wedges' })).toHaveTextContent('+')
  })
})
