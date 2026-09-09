import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { DEGRADATION_COMPACT_HINT, degradationWarningCopy } from '@/lib/studio/degradation'

import { StudioDegradationCallout } from './studio-degradation-callout'

describe('StudioDegradationCallout', () => {
  it('links GEN 3 copy to the dish shot tree', () => {
    const warning = degradationWarningCopy(3)
    if (!warning) throw new Error('expected GEN 3 copy')
    render(<StudioDegradationCallout dishId="dish-1" warning={warning} />)

    const callout = screen.getByTestId('studio-degradation-callout')
    expect(callout).toHaveAttribute('data-next-gen', '3')
    expect(callout).toHaveTextContent('This next shot will be GEN 3')
    expect(screen.getByRole('link', { name: 'View shot tree' })).toHaveAttribute(
      'href',
      '/studio/dish-1?tab=shots&view=tree',
    )
  })

  it('uses stronger titles at GEN 4 and GEN 5+', () => {
    const four = degradationWarningCopy(4)
    const five = degradationWarningCopy(5)
    if (!four || !five) throw new Error('expected stronger copy')
    const { rerender } = render(<StudioDegradationCallout dishId="d1" warning={four} />)
    expect(screen.getByTestId('studio-degradation-callout')).toHaveTextContent('GEN 4')
    rerender(<StudioDegradationCallout dishId="d1" warning={five} />)
    expect(screen.getByTestId('studio-degradation-callout')).toHaveTextContent('GEN 5')
    expect(screen.getByTestId('studio-degradation-callout')).toHaveTextContent('still generate')
  })

  it('hides the compact banner when dismissed and restores it for a new shot', () => {
    const warning = degradationWarningCopy(3)
    if (!warning) throw new Error('expected GEN 3 copy')
    const { rerender } = render(
      <StudioDegradationCallout
        dishId="dish-1"
        warning={warning}
        compact
        dismissible
        dismissKey="shot-a"
      />,
    )
    expect(screen.getByTestId('studio-degradation-callout')).toHaveClass('studio-callout-warn-compact')
    expect(screen.getByText(DEGRADATION_COMPACT_HINT)).toBeInTheDocument()
    expect(screen.queryByText(warning.body)).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('studio-degradation-callout-dismiss'))
    expect(screen.queryByTestId('studio-degradation-callout')).not.toBeInTheDocument()

    rerender(
      <StudioDegradationCallout
        dishId="dish-1"
        warning={warning}
        compact
        dismissible
        dismissKey="shot-b"
      />,
    )
    expect(screen.getByTestId('studio-degradation-callout')).toBeInTheDocument()
  })

  it('reveals compact GEN copy from an (i) control', () => {
    const warning = degradationWarningCopy(7)
    if (!warning) throw new Error('expected GEN 7 copy')
    render(<StudioDegradationCallout dishId="dish-1" warning={warning} iconTrigger />)

    expect(screen.queryByText(warning.title)).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('studio-degradation-info'))
    expect(screen.getByRole('dialog', { name: warning.title })).toHaveTextContent(
      'Successive generations can degrade quality.',
    )
    expect(screen.getByRole('link', { name: 'View shot tree' })).toBeInTheDocument()
  })
})
