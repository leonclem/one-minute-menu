import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Provide a minimal router implementation so components using next/navigation
// (like UXProgressSteps) can render in tests without requiring the app router.
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}))

import { UXInput } from '@/components/ux/UXInput'
import { UXCard } from '@/components/ux/UXWrapper'
import { UXProgressSteps } from '@/components/ux'

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


