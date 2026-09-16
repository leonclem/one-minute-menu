import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import PrivacyPage from '@/app/privacy/page'
import TermsPage from '@/app/terms/page'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string }) => <img alt={props.alt} />,
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
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}))

jest.mock('@/lib/dashboard-refresh', () => ({
  markDashboardForRefresh: jest.fn(),
}))

jest.mock('@/lib/product-mode', () => ({
  shouldShowLegacyMenuNav: () => false,
  canAccessPhotoStudio: () => true,
}))

jest.mock('@/lib/studio/access/use-studio-beta-access', () => ({
  useStudioBetaAccess: () => ({ known: true, hasAccess: true }),
}))

describe('legal pages share GridMenu footer chrome', () => {
  it('shows blog and social links on the privacy page', () => {
    render(<PrivacyPage />)

    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^blog$/i })).toHaveAttribute('href', '/blog')
    expect(screen.getByRole('link', { name: /gridmenu on tiktok/i })).toBeInTheDocument()
  })

  it('shows blog and social links on the terms page', () => {
    render(<TermsPage />)

    expect(screen.getByRole('heading', { name: /terms of service/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^blog$/i })).toHaveAttribute('href', '/blog')
    expect(screen.getByRole('link', { name: /gridmenu on instagram/i })).toBeInTheDocument()
  })
})
