import { render, screen, fireEvent, act } from '@testing-library/react'
import OnboardingDemoPage from '@/app/onboarding/demo/page'

describe('OnboardingDemoPage (demo walkthrough)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('advances from select -> review -> publish', async () => {
    render(<OnboardingDemoPage />)

    // Step 0: Select photo
    expect(screen.getByText(/Pick a sample photo/i)).toBeInTheDocument()
    expect(screen.getByText(/Choose a sample image to continue/i)).toBeInTheDocument()

    // Click Sample Photo A
    fireEvent.click(screen.getByRole('button', { name: /Sample Photo A/i }))

    // Step 1: Review items (demo shows extracted items immediately)
    expect(screen.getByText(/Extracted items \(demo\):/i)).toBeInTheDocument()
    expect(screen.getByText(/Chicken Rice/i)).toBeInTheDocument()
    
    // Click Publish button
    const publishButton = screen.getByRole('button', { name: /Publish/i })
    fireEvent.click(publishButton)

    // Step 2: Should show QR code
    expect(screen.getByText(/Published!/i)).toBeInTheDocument()
  })
})


