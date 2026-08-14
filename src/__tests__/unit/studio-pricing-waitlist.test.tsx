import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import StudioPricingWaitlist from '@/app/(marketing)/pricing/StudioPricingWaitlist'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
}))

jest.mock('@/lib/product-mode', () => ({
  getAuthenticatedHomePath: () => '/studio',
}))

describe('StudioPricingWaitlist', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows waitlist signup copy and CTA for logged-out visitors', () => {
    render(<StudioPricingWaitlist initialUser={null} />)

    expect(
      screen.getByText(/join the waitlist and we will invite testers in small groups/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/sign up to join the waitlist\. most applications are reviewed within 24 hours\./i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /join the waitlist/i })).toHaveAttribute(
      'href',
      '/register',
    )
    expect(screen.queryByRole('link', { name: /open studio/i })).not.toBeInTheDocument()
  })

  it('shows credit balance and support guidance for logged-in users', () => {
    render(
      <StudioPricingWaitlist initialUser={{ id: 'user-1' }} initialCreditBalance={12} />,
    )

    expect(
      screen.getByText(/photo studio is invite-only\. credits are admin-granted/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/join the waitlist and we will invite testers in small groups/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/sign up to join the waitlist/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/open studio to see whether your account is approved/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/approved accounts still need a studio invite/i),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /your studio credits/i })).toBeInTheDocument()
    expect(screen.getByText('12 Studio credits')).toBeInTheDocument()
    expect(screen.getByText(/need more credits\? contact/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open studio/i })).toHaveAttribute('href', '/studio')
    expect(screen.queryByRole('link', { name: /join the waitlist/i })).not.toBeInTheDocument()
  })

  it('uses singular credit label when balance is 1', () => {
    render(
      <StudioPricingWaitlist initialUser={{ id: 'user-1' }} initialCreditBalance={1} />,
    )

    expect(screen.getByText('1 Studio credit')).toBeInTheDocument()
  })

  it('does not use em dashes in the access copy', () => {
    render(<StudioPricingWaitlist initialUser={null} />)

    expect(document.body.textContent).not.toMatch(/—/)
  })
})
