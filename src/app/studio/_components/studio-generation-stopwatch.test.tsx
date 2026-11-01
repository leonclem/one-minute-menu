import React from 'react'
import { act, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { formatStopwatch, StudioGenerationStopwatch } from './studio-generation-stopwatch'

describe('formatStopwatch', () => {
  it('renders elapsed time as a digital clock', () => {
    expect(formatStopwatch(0)).toBe('00:00')
    expect(formatStopwatch(1500)).toBe('00:01')
    expect(formatStopwatch(65000)).toBe('01:05')
    expect(formatStopwatch(-20)).toBe('00:00')
    expect(formatStopwatch(Number.NaN)).toBe('00:00')
  })
})

describe('StudioGenerationStopwatch', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('stays hidden until an AI generation is running', () => {
    render(<StudioGenerationStopwatch active={false} />)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('counts up from zero and hides again when generation ends', () => {
    const { rerender } = render(<StudioGenerationStopwatch active />)

    expect(screen.getByRole('timer')).toHaveTextContent('00:00')
    expect(screen.getByRole('timer')).toHaveAttribute(
      'aria-label',
      'Generation time 0 minutes 0 seconds'
    )

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(screen.getByRole('timer')).toHaveTextContent('00:02')
    expect(screen.getByRole('timer')).toHaveAttribute(
      'aria-label',
      'Generation time 0 minutes 2 seconds'
    )

    rerender(<StudioGenerationStopwatch active={false} />)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })
})
