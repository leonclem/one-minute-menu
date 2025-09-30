import { render, screen, fireEvent, act } from '@testing-library/react'
import OnboardingDemoPage from '@/app/onboarding/demo/page'

describe('OnboardingDemoPage (demo walkthrough)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('advances from select -> processing -> review', async () => {
    render(<OnboardingDemoPage />)

    expect(screen.getByText(/Pick a sample photo/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Sample Photo A/i }))

    // Now in processing step
    expect(screen.getByText(/Running OCR/i)).toBeInTheDocument()

    await act(async () => {
      jest.advanceTimersByTime(1300)
    })

    // After timeout, should show OCR complete and Review button
    expect(screen.getByText(/OCR complete/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Review items/i }))

    expect(screen.getByText(/Adjust availability or prices/i)).toBeInTheDocument()
  })
})


