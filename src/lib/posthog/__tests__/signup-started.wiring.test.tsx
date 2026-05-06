/**
 * Integration test: signup_started wiring
 * Asserts that AuthOTPForm fires captureEvent with 'signup_started' on first focus of the email field.
 * Implements: 5.1
 *
 * Test cases:
 * 1. Mounting the form does NOT fire the event
 * 2. Focusing/typing into the first field fires the event exactly once
 * 3. Blurring and refocusing within the same mount does NOT re-fire
 * 4. Unmounting and remounting the form allows the next focus to fire once again
 */

jest.mock('@/lib/posthog', () => ({
  captureEvent: jest.fn(),
  ANALYTICS_EVENTS: {
    HOMEPAGE_VIEWED: 'homepage_viewed',
    CTA_CLICKED: 'cta_clicked',
    PRICING_VIEWED: 'pricing_viewed',
    SIGNUP_STARTED: 'signup_started',
    SIGNUP_COMPLETED: 'signup_completed',
    LOGIN_COMPLETED: 'login_completed',
    MENU_CREATION_STARTED: 'menu_creation_started',
    MENU_IMAGE_UPLOADED: 'menu_image_uploaded',
    MENU_EXTRACTION_STARTED: 'menu_extraction_started',
    MENU_EXTRACTION_COMPLETED: 'menu_extraction_completed',
    MENU_EXTRACTION_FAILED: 'menu_extraction_failed',
    MENU_ITEM_EDITED: 'menu_item_edited',
    TEMPLATE_SELECTED: 'template_selected',
    FOOD_PHOTO_GENERATION_STARTED: 'food_photo_generation_started',
    FOOD_PHOTO_GENERATED: 'food_photo_generated',
    FOOD_PHOTO_GENERATION_FAILED: 'food_photo_generation_failed',
    PDF_EXPORT_STARTED: 'pdf_export_started',
    PDF_EXPORTED: 'pdf_exported',
    PDF_EXPORT_FAILED: 'pdf_export_failed',
    CHECKOUT_STARTED: 'checkout_started',
    SUBSCRIPTION_STARTED: 'subscription_started',
    ADMIN_ANALYTICS_DISABLED: 'admin_analytics_disabled',
    ADMIN_ANALYTICS_ENABLED: 'admin_analytics_enabled',
  },
}))

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}))

// Mock conversion tracking
jest.mock('@/lib/conversion-tracking', () => ({
  trackConversionEvent: jest.fn(),
}))

// Mock utils
jest.mock('@/lib/utils', () => ({
  isValidEmail: jest.fn((email: string) => email.includes('@')),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// Mock UX components
jest.mock('@/components/ux', () => ({
  UXButton: ({ children, type, onClick, loading }: any) => (
    <button type={type} onClick={onClick} disabled={loading}>
      {children}
    </button>
  ),
  UXInput: ({ label, type, value, onChange, onFocus, placeholder, error, disabled, autoComplete }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        data-testid="email-input"
      />
      {error && <p role="alert">{error}</p>}
    </div>
  ),
}))

import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { AuthOTPForm } from '@/components/auth/AuthOTPForm'
import { captureEvent } from '@/lib/posthog'

const mockCaptureEvent = captureEvent as jest.MockedFunction<typeof captureEvent>

describe('signup_started wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com', pathname: '/register', origin: 'https://example.com' },
      writable: true,
    })
  })

  it('does NOT fire signup_started on mount (no interaction)', () => {
    render(
      <AuthOTPForm
        type="signup"
        title="Sign up"
        subtitle="Enter your email"
        buttonText="Send magic link"
      />
    )

    const signupStartedCalls = mockCaptureEvent.mock.calls.filter(
      (call) => call[0] === 'signup_started'
    )
    expect(signupStartedCalls).toHaveLength(0)
  })

  it('fires signup_started exactly once when the email field is focused', () => {
    const { getByTestId } = render(
      <AuthOTPForm
        type="signup"
        title="Sign up"
        subtitle="Enter your email"
        buttonText="Send magic link"
      />
    )

    const emailInput = getByTestId('email-input')
    fireEvent.focus(emailInput)

    const signupStartedCalls = mockCaptureEvent.mock.calls.filter(
      (call) => call[0] === 'signup_started'
    )
    expect(signupStartedCalls).toHaveLength(1)
    expect(mockCaptureEvent).toHaveBeenCalledWith('signup_started')
  })

  it('does NOT re-fire signup_started on blur and refocus within the same mount', () => {
    const { getByTestId } = render(
      <AuthOTPForm
        type="signup"
        title="Sign up"
        subtitle="Enter your email"
        buttonText="Send magic link"
      />
    )

    const emailInput = getByTestId('email-input')

    // First focus — fires once
    fireEvent.focus(emailInput)
    // Blur
    fireEvent.blur(emailInput)
    // Refocus — should NOT fire again
    fireEvent.focus(emailInput)
    // Blur again
    fireEvent.blur(emailInput)
    // Refocus again — should NOT fire again
    fireEvent.focus(emailInput)

    const signupStartedCalls = mockCaptureEvent.mock.calls.filter(
      (call) => call[0] === 'signup_started'
    )
    expect(signupStartedCalls).toHaveLength(1)
  })

  it('allows signup_started to fire again after unmount and remount', () => {
    const { getByTestId, unmount } = render(
      <AuthOTPForm
        type="signup"
        title="Sign up"
        subtitle="Enter your email"
        buttonText="Send magic link"
      />
    )

    // First mount: focus fires once
    fireEvent.focus(getByTestId('email-input'))
    expect(
      mockCaptureEvent.mock.calls.filter((call) => call[0] === 'signup_started')
    ).toHaveLength(1)

    // Unmount
    unmount()
    mockCaptureEvent.mockClear()

    // Remount: focus should fire again
    const { getByTestId: getByTestId2 } = render(
      <AuthOTPForm
        type="signup"
        title="Sign up"
        subtitle="Enter your email"
        buttonText="Send magic link"
      />
    )
    fireEvent.focus(getByTestId2('email-input'))

    const signupStartedCalls = mockCaptureEvent.mock.calls.filter(
      (call) => call[0] === 'signup_started'
    )
    expect(signupStartedCalls).toHaveLength(1)
  })

  it('does NOT fire signup_started for signin type forms', () => {
    const { getByTestId } = render(
      <AuthOTPForm
        type="signin"
        title="Sign in"
        subtitle="Enter your email"
        buttonText="Send magic link"
      />
    )

    const emailInput = getByTestId('email-input')
    fireEvent.focus(emailInput)

    const signupStartedCalls = mockCaptureEvent.mock.calls.filter(
      (call) => call[0] === 'signup_started'
    )
    expect(signupStartedCalls).toHaveLength(0)
  })
})
