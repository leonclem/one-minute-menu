import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import HomePageStudioContent from '@/app/(marketing)/HomePageStudioContent'
import { UXFooter } from '@/components/ux/UXFooter'
import { STUDIO_SEO } from '@/lib/studio/public-seo'

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

jest.mock('@/lib/conversion-tracking', () => ({
  trackConversionEvent: jest.fn(),
}))

jest.mock('@/lib/posthog', () => ({
  captureEvent: jest.fn(),
  ANALYTICS_EVENTS: { CTA_CLICKED: 'cta_clicked' },
}))

const mockIsStudioPublicSurface = jest.fn()
const mockGetAuthenticatedHomePath = jest.fn()

jest.mock('@/lib/product-mode', () => ({
  isStudioPublicSurface: () => mockIsStudioPublicSurface(),
  getAuthenticatedHomePath: () => mockGetAuthenticatedHomePath(),
}))

describe('studio-public homepage and footer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsStudioPublicSurface.mockReturnValue(true)
    mockGetAuthenticatedHomePath.mockReturnValue('/studio')
  })

  it('sells Photo Studio with a get-started CTA, not the menu builder', () => {
    render(<HomePageStudioContent initialUser={null} />)

    expect(screen.getByRole('heading', { name: STUDIO_SEO.h1 })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /get started/i }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /start with my menu/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /how access works/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /see pricing/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /how ai food photos work/i })).toBeInTheDocument()
    expect(screen.queryByText(/menu subscription/i)).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/demo/sample"]')).toBeNull()
  })

  it('hides the Blog footer link on the studio-public surface', () => {
    render(<UXFooter />)

    expect(screen.queryByRole('link', { name: /blog/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contact us/i })).toHaveAttribute('href', '/support')
  })

  it('keeps the Blog footer link when studio-public is off', () => {
    mockIsStudioPublicSurface.mockReturnValue(false)
    render(<UXFooter />)

    expect(screen.getByRole('link', { name: /blog/i })).toHaveAttribute('href', '/blog')
  })
})
