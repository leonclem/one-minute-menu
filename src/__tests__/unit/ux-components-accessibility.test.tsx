import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Provide a minimal router implementation so components using next/navigation
// (like UXProgressSteps) can render in tests without requiring the app router.
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/ux/menus/demo-menu/upload',
}))

import { UXInput } from '@/components/ux/UXInput'
import { UXCard } from '@/components/ux/UXWrapper'
import { UXProgressSteps, UXHeader, UXFooter, UXErrorFeedback } from '@/components/ux'

const mockShowToast = jest.fn()
jest.mock('@/components/ui', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

describe('UXInput accessibility', () => {
  it('links error message to input via aria attributes', () => {
    render(
      <UXInput
        label="Email address"
        type="email"
        value="invalid"
        onChange={() => {}}
        error="Please enter a valid email"
      />,
    )

    const input = screen.getByLabelText('Email address')
    const error = screen.getByRole('alert')

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', error.id)
  })

  it('links helper text to input when no error is present', () => {
    render(
      <UXInput
        label="Menu name"
        value=""
        onChange={() => {}}
        helperText="Enter a name your staff will recognise"
      />,
    )

    const input = screen.getByLabelText('Menu name')
    const helper = screen.getByText(/Enter a name your staff will recognise/i)

    expect(input).toHaveAttribute('aria-describedby', helper.id)
  })
})

describe('UXCard accessibility', () => {
  it('renders as a focusable button-like region when clickable', () => {
    const handleClick = jest.fn()

    render(
      <UXCard clickable onClick={handleClick}>
        Clickable content
      </UXCard>,
    )

    const card = screen.getByText('Clickable content').closest('div')
    expect(card).toHaveAttribute('role', 'button')
    expect(card).toHaveAttribute('tabindex', '0')

    if (!card) throw new Error('Card not found')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(handleClick).toHaveBeenCalled()
  })
})

describe('UXProgressSteps accessibility', () => {
  it('marks the current step with aria-current="step"', () => {
    render(<UXProgressSteps currentStep="extract" menuId="demo-menu" />)

    const currentStepButton = screen.getByLabelText(/Extract \(current step\)/i)
    expect(currentStepButton).toHaveAttribute('aria-current', 'step')
  })
})

describe('UXHeader accessibility', () => {
  it('renders primary navigation with expected links for anonymous users', () => {
    render(<UXHeader />)

    const nav = screen.getByRole('navigation', { name: /primary navigation/i })
    expect(nav).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /pricing/i })).toHaveAttribute('href', '/ux/pricing')
    expect(screen.getByRole('link', { name: /support/i })).toHaveAttribute('href', '/support')
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/auth/signin')
  })
})

describe('UXFooter accessibility', () => {
  it('renders footer links with correct destinations', () => {
    render(<UXFooter />)

    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: /contact us/i })).toHaveAttribute('href', '/support')
  })
})

describe('UXErrorFeedback behaviour', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    // @ts-ignore
    global.fetch = undefined
  })

  it('sends feedback and tracks ux_feedback event', async () => {
    const mockTrackConversionEvent = jest.fn()
    jest.doMock('@/lib/conversion-tracking', () => ({
      trackConversionEvent: (...args: any[]) => mockTrackConversionEvent(...args),
    }))

    render(<UXErrorFeedback context="demo" menuId="menu-123" />)

    const textarea = screen.getByPlaceholderText(/what were you trying to do/i)
    fireEvent.change(textarea, { target: { value: 'Something went wrong during demo' } })

    const submit = screen.getByRole('button', { name: /send feedback/i })
    fireEvent.click(submit)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/logs',
        expect.objectContaining({
          method: 'POST',
        }),
      )
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
        }),
      )
    })

    expect(mockTrackConversionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ux_feedback',
        metadata: expect.objectContaining({
          context: 'demo',
          hasMenuId: true,
        }),
      }),
    )
  })
})

