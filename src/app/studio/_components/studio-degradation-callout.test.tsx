import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { degradationWarningCopy } from '@/lib/studio/degradation'

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
})
