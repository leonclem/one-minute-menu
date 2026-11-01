import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { degradationWarningCopy } from '@/lib/studio/degradation'

import { StudioDegradationCallout, useDegradationDismiss } from './studio-degradation-callout'

function DismissHarness({ shotId, nextGen }: { shotId: string; nextGen: number }) {
  const warning = degradationWarningCopy(nextGen)
  const { dismissed, dismiss } = useDegradationDismiss(shotId, nextGen)
  if (!warning || dismissed) return null
  return <StudioDegradationCallout dishId="dish-1" warning={warning} announce onDismiss={dismiss} />
}

describe('StudioDegradationCallout', () => {
  it('links the quiet GEN 3 line to an earlier photo', () => {
    const warning = degradationWarningCopy(3)
    if (!warning) throw new Error('expected GEN 3 copy')
    render(<StudioDegradationCallout dishId="dish-1" warning={warning} announce onDismiss={jest.fn()} />)

    const callout = screen.getByRole('status')
    expect(callout).toHaveAttribute('data-next-gen', '3')
    expect(callout).toHaveAttribute('data-tone', 'muted')
    expect(callout).toHaveTextContent('Edited twice. Another edit can soften fine detail.')
    expect(callout).not.toHaveClass('studio-callout-warn')
    expect(screen.getByRole('link', { name: 'Use an earlier photo' })).toHaveAttribute(
      'href',
      '/studio/dish-1?tab=shots&view=tree',
    )
  })

  it('warms the line at GEN 4 and turns it gold at GEN 5+', () => {
    const four = degradationWarningCopy(4)
    const five = degradationWarningCopy(5)
    if (!four || !five) throw new Error('expected stronger copy')
    const { rerender } = render(
      <StudioDegradationCallout dishId="d1" warning={four} onDismiss={jest.fn()} />,
    )
    expect(screen.getByTestId('studio-degradation-callout')).toHaveAttribute('data-tone', 'warm')
    expect(screen.getByTestId('studio-degradation-callout')).toHaveTextContent(
      'Edited 3 times. Another edit often looks softer.',
    )
    rerender(<StudioDegradationCallout dishId="d1" warning={five} onDismiss={jest.fn()} />)
    expect(screen.getByTestId('studio-degradation-callout')).toHaveAttribute('data-tone', 'gold')
    expect(screen.getByTestId('studio-degradation-callout')).toHaveTextContent(
      'Edited 4 times. Another edit is likely to look softer.',
    )
  })

  it('uses dark text on the light re-shoot surface', () => {
    const warning = degradationWarningCopy(3)
    if (!warning) throw new Error('expected GEN 3 copy')
    render(
      <StudioDegradationCallout
        dishId="dish-1"
        warning={warning}
        surface="light"
        onDismiss={jest.fn()}
      />,
    )
    expect(screen.getByTestId('studio-degradation-callout')).toHaveClass('text-gray-600')
    expect(screen.getByRole('link', { name: 'Use an earlier photo' })).toHaveClass('text-gray-900')
  })

  it('hides the note when dismissed and restores it for a new shot', () => {
    const { rerender } = render(<DismissHarness shotId="shot-a" nextGen={3} />)
    fireEvent.click(screen.getByTestId('studio-degradation-callout-dismiss'))
    expect(screen.queryByTestId('studio-degradation-callout')).not.toBeInTheDocument()

    rerender(<DismissHarness shotId="shot-b" nextGen={3} />)
    expect(screen.getByTestId('studio-degradation-callout')).toHaveTextContent('Edited twice')
  })

  it('restores the note when the next generation changes on the same shot', () => {
    const { rerender } = render(<DismissHarness shotId="shot-a" nextGen={3} />)
    fireEvent.click(screen.getByTestId('studio-degradation-callout-dismiss'))
    rerender(<DismissHarness shotId="shot-a" nextGen={4} />)
    expect(screen.getByTestId('studio-degradation-callout')).toHaveTextContent('Edited 3 times')
  })
})
