import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UXHeader } from '../UXHeader'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt} />
  },
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
  }: {
    href: string
    children: React.ReactNode
    onClick?: () => void
    prefetch?: boolean
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}))

jest.mock('@/lib/dashboard-refresh', () => ({
  markDashboardForRefresh: jest.fn(),
}))

const mockShouldShowLegacyMenuNav = jest.fn()

jest.mock('@/lib/product-mode', () => ({
  shouldShowLegacyMenuNav: () => mockShouldShowLegacyMenuNav(),
}))

describe('UXHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockShouldShowLegacyMenuNav.mockReturnValue(true)
  })

  it('shows Dashboard for signed-in users when legacy menu nav is enabled', () => {
    render(<UXHeader userEmail="user@example.com" />)

    expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Settings' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Support' }).length).toBeGreaterThan(0)
  })

  it('hides Dashboard when legacy menu nav is disabled, keeping Settings/Support/Admin', () => {
    mockShouldShowLegacyMenuNav.mockReturnValue(false)

    render(<UXHeader userEmail="admin@example.com" isAdmin />)

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Admin' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Settings' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Support' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Sign out' }).length).toBeGreaterThan(0)
  })

  it('does not show Dashboard for signed-out users regardless of flag', () => {
    mockShouldShowLegacyMenuNav.mockReturnValue(true)

    render(<UXHeader />)

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Sign In' }).length).toBeGreaterThan(0)
  })
})
