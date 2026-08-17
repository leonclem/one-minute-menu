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

jest.mock('@/components/BillingCurrencySelector', () => ({
  __esModule: true,
  default: () => <div data-testid="billing-currency-selector" />,
}))

jest.mock('@/lib/posthog', () => ({
  captureEvent: jest.fn(),
  ANALYTICS_EVENTS: { CHECKOUT_STARTED: 'checkout_started' },
}))

describe('StudioPricingWaitlist', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows credit packs and explainer for logged-out visitors', () => {
    render(<StudioPricingWaitlist initialUser={null} />)

    expect(screen.getByRole('heading', { name: /studio pricing/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /simple credit packs/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /starter pack/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /menu pack/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /studio pack/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /how credits work/i })).toBeInTheDocument()
    expect(screen.getByText(/new accounts start with 10 free credits/i)).toBeInTheDocument()
    expect(screen.queryByText(/buy more when you are ready to produce a menu/i)).not.toBeInTheDocument()
    expect(screen.getByText(/1 credit = 1 standard AI photo generation/i)).toBeInTheDocument()
    expect(screen.getAllByText('Sign up to buy')).toHaveLength(3)
    expect(screen.queryByRole('link', { name: /open studio/i })).not.toBeInTheDocument()
  })

  it('shows credit balance for logged-in users', () => {
    render(
      <StudioPricingWaitlist initialUser={{ id: 'user-1' }} initialCreditBalance={12} />,
    )

    expect(screen.getByText('Your Studio credits: 12')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /open studio/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /buy menu pack for menu pack/i })).toBeInTheDocument()
  })

  it('shows a numeric credit balance', () => {
    render(
      <StudioPricingWaitlist initialUser={{ id: 'user-1' }} initialCreditBalance={1} />,
    )

    expect(screen.getByText('Your Studio credits: 1')).toBeInTheDocument()
  })

  it('does not use em dashes in the pricing copy', () => {
    render(<StudioPricingWaitlist initialUser={null} />)

    expect(document.body.textContent).not.toMatch(/—/)
  })
})
