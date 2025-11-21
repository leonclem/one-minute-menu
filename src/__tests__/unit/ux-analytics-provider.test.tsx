import React from 'react'
import { render } from '@testing-library/react'

const mockInitWebVitalsTracking = jest.fn()

jest.mock('@/lib/conversion-tracking', () => {
  const actual = jest.requireActual('@/lib/conversion-tracking')
  return {
    ...actual,
    initWebVitalsTracking: (...args: any[]) => mockInitWebVitalsTracking(...args),
  }
})

import { UXAnalyticsProvider } from '@/components/ux'

describe('UXAnalyticsProvider', () => {
  it('initialises web vitals tracking once on mount', () => {
    render(
      <UXAnalyticsProvider>
        <div>child</div>
      </UXAnalyticsProvider>,
    )

    expect(mockInitWebVitalsTracking).toHaveBeenCalledTimes(1)
  })
})


