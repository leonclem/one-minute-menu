import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/image to render a plain <img> so we can assert on src/alt
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...rest} />
  ),
}))

// Mock next/link to render a plain <a>
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    onClick?: () => void
    [key: string]: unknown
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

// Mock supabase auth — default: no session (unauthenticated)
const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null })
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}))

// Mock conversion tracking so we can assert on calls
const mockTrackConversionEvent = jest.fn()
jest.mock('@/lib/conversion-tracking', () => ({
  trackConversionEvent: (...args: unknown[]) => mockTrackConversionEvent(...args),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import HomePageContent from '@/app/(marketing)/HomePageContent'
import { metadata } from '@/app/(marketing)/page'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render the homepage in unauthenticated state (default). */
function renderPage(initialUser: unknown = null) {
  return render(<HomePageContent initialUser={initialUser} />)
}

/** Parse all JSON-LD script tags from the document and return them as objects. */
function getJsonLdScripts(): Record<string, unknown>[] {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  return Array.from(scripts).map((s) => {
    const text = (s as HTMLScriptElement).innerHTML || (s as HTMLScriptElement).textContent || ''
    return JSON.parse(text) as Record<string, unknown>
  })
}

// ---------------------------------------------------------------------------
// 7.1 — Metadata
// ---------------------------------------------------------------------------

describe('7.1 Homepage metadata export', () => {
  it('title contains "Restaurant Menu Maker" and "GridMenu"', () => {
    const title = typeof metadata.title === 'string' ? metadata.title : ''
    expect(title).toMatch(/Restaurant Menu Maker/i)
    expect(title).toMatch(/GridMenu/i)
  })

  it('description mentions creating a restaurant menu online', () => {
    const desc = typeof metadata.description === 'string' ? metadata.description : ''
    expect(desc).toMatch(/restaurant menu/i)
    expect(desc).toMatch(/online|minutes/i)
  })

  it('description mentions dishes/prices, style, and digital/PDF output', () => {
    const desc = typeof metadata.description === 'string' ? metadata.description : ''
    expect(desc).toMatch(/dishes|prices/i)
    expect(desc).toMatch(/style/i)
    expect(desc).toMatch(/digital|pdf/i)
  })

  it('OG title matches page title', () => {
    const pageTitle = typeof metadata.title === 'string' ? metadata.title : ''
    const ogTitle =
      typeof metadata.openGraph?.title === 'string' ? metadata.openGraph.title : ''
    expect(ogTitle).toBe(pageTitle)
  })

  it('OG description matches page description', () => {
    const pageDesc = typeof metadata.description === 'string' ? metadata.description : ''
    const ogDesc =
      typeof metadata.openGraph?.description === 'string' ? metadata.openGraph.description : ''
    expect(ogDesc).toBe(pageDesc)
  })

  it('OG url is set to a canonical URL (not a relative path)', () => {
    const url = metadata.openGraph?.url
    expect(typeof url).toBe('string')
    // Must be an absolute URL or the env var placeholder
    expect(url as string).toMatch(/^https?:\/\/|gridmenu\.ai/)
  })

  it('Twitter card is summary_large_image', () => {
    expect(metadata.twitter?.card).toBe('summary_large_image')
  })

  it('Twitter images include the social OG image', () => {
    const images = metadata.twitter?.images
    const imageList = Array.isArray(images) ? images : [images]
    const hasOgImage = imageList.some((img) =>
      typeof img === 'string'
        ? img.includes('social-1200x630')
        : (img as { url?: string })?.url?.includes('social-1200x630'),
    )
    expect(hasOgImage).toBe(true)
  })

  it('does not include a keywords field', () => {
    // Next.js Metadata type does not expose keywords as a top-level field in the same way,
    // but we verify the metadata object has no "keywords" key
    expect((metadata as Record<string, unknown>).keywords).toBeUndefined()
  })

  it('does not reference QR in title or description', () => {
    const title = typeof metadata.title === 'string' ? metadata.title : ''
    const desc = typeof metadata.description === 'string' ? metadata.description : ''
    expect(title).not.toMatch(/qr/i)
    expect(desc).not.toMatch(/qr/i)
  })
})

// ---------------------------------------------------------------------------
// 7.2 — Hero content and JSON-LD
// ---------------------------------------------------------------------------

describe('7.2 Hero content and JSON-LD', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  it('H1 communicates fast restaurant menu creation', () => {
    renderPage()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toBeInTheDocument()
    // Should mention restaurant menu and speed (minutes / fast / quick)
    expect(h1.textContent).toMatch(/restaurant menu/i)
    expect(h1.textContent).toMatch(/minutes|fast|quick/i)
  })

  it('primary CTA label is "Start with my menu"', () => {
    renderPage()
    const primaryCtaButtons = screen.getAllByText(/start with my menu/i)
    expect(primaryCtaButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('secondary CTA label is "Try a demo menu"', () => {
    renderPage()
    expect(screen.getByText(/try a demo menu/i)).toBeInTheDocument()
  })

  it('does not contain "QR code" or "QR menu" text', () => {
    renderPage()
    expect(screen.queryByText(/qr code/i)).toBeNull()
    expect(screen.queryByText(/qr menu/i)).toBeNull()
  })

  it('does not contain "Transform My Menu" text', () => {
    renderPage()
    expect(screen.queryByText(/transform my menu/i)).toBeNull()
  })

  it('WebSite JSON-LD has correct @type, @context, name, and url', () => {
    renderPage()
    const schemas = getJsonLdScripts()
    const website = schemas.find((s) => s['@type'] === 'WebSite')
    expect(website).toBeDefined()
    expect(website!['@context']).toBe('https://schema.org')
    expect(website!['name']).toMatch(/GridMenu/i)
    expect(typeof website!['url']).toBe('string')
  })

  it('WebSite JSON-LD description does not contain QR phrases', () => {
    renderPage()
    const schemas = getJsonLdScripts()
    const website = schemas.find((s) => s['@type'] === 'WebSite')
    expect(website).toBeDefined()
    const desc = String(website!['description'] ?? '')
    expect(desc).not.toMatch(/qr/i)
  })

  it('FAQPage JSON-LD has correct @type and @context', () => {
    renderPage()
    const schemas = getJsonLdScripts()
    const faqPage = schemas.find((s) => s['@type'] === 'FAQPage')
    expect(faqPage).toBeDefined()
    expect(faqPage!['@context']).toBe('https://schema.org')
  })

  it('FAQPage JSON-LD mainEntity is an array of Questions with AcceptedAnswers', () => {
    renderPage()
    const schemas = getJsonLdScripts()
    const faqPage = schemas.find((s) => s['@type'] === 'FAQPage')
    expect(faqPage).toBeDefined()
    const mainEntity = faqPage!['mainEntity'] as Array<Record<string, unknown>>
    expect(Array.isArray(mainEntity)).toBe(true)
    expect(mainEntity.length).toBeGreaterThanOrEqual(5)
    mainEntity.forEach((item) => {
      expect(item['@type']).toBe('Question')
      expect(typeof item['name']).toBe('string')
      const answer = item['acceptedAnswer'] as Record<string, unknown>
      expect(answer['@type']).toBe('Answer')
      expect(typeof answer['text']).toBe('string')
    })
  })
})

// ---------------------------------------------------------------------------
// 7.3 — Content sections
// ---------------------------------------------------------------------------

describe('7.3 Content sections', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  it('"How GridMenu works" H2 is present', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 2, name: /how gridmenu works/i }),
    ).toBeInTheDocument()
  })

  it('"Choose a menu style that fits your brand" H2 is present', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 2, name: /choose a menu style that fits your brand/i }),
    ).toBeInTheDocument()
  })

  it('"Why food and beverage businesses use GridMenu" H2 is present', () => {
    renderPage()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /why food and beverage businesses use gridmenu/i,
      }),
    ).toBeInTheDocument()
  })

  it('"Start from scratch" H2 is present', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 2, name: /start from scratch/i }),
    ).toBeInTheDocument()
  })

  it('"Common questions" FAQ H2 is present', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 2, name: /common questions/i }),
    ).toBeInTheDocument()
  })

  it('"Ready to create your restaurant menu?" final CTA H2 is present', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 2, name: /ready to create your restaurant menu/i }),
    ).toBeInTheDocument()
  })

  it('removed sections are absent: "See the menus GridMenu can create"', () => {
    renderPage()
    expect(screen.queryByText(/see the menus gridmenu can create/i)).toBeNull()
  })

  it('removed sections are absent: "Built for digital sharing and PDF export"', () => {
    renderPage()
    expect(screen.queryByText(/built for digital sharing and pdf export/i)).toBeNull()
  })

  it('gallery section has exactly 3 real menu images', () => {
    renderPage()
    // The gallery section uses these three specific image sources
    const allImages = document.querySelectorAll('img')
    const gallerySrcs = [
      '/marketing/fonde-de-la-noche.png',
      '/marketing/fill-6col-a3-midnight.png',
      '/marketing/magic-circle-4col-a4.png',
    ]
    gallerySrcs.forEach((src) => {
      const matches = Array.from(allImages).filter((img) => img.getAttribute('src') === src)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
    // Fonde de la Noche appears in the gallery
    expect(screen.getByAltText(/fonde de la noche/i)).toBeInTheDocument()
  })

  it('benefits section has at least 4 benefit cards (H3 headings)', () => {
    renderPage()
    const h3s = screen.getAllByRole('heading', { level: 3 })
    // Benefits section uses H3 for each card heading
    expect(h3s.length).toBeGreaterThanOrEqual(4)
  })

  it('FAQ section has at least 5 items', () => {
    renderPage()
    // Each FAQ item is a <details> element with a <summary>
    const details = document.querySelectorAll('details')
    expect(details.length).toBeGreaterThanOrEqual(5)
  })

  it('FAQ section contains a link to /support', () => {
    renderPage()
    const supportLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/support')
    expect(supportLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('final CTA has "See pricing" link to /pricing', () => {
    renderPage()
    const pricingLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/pricing')
    expect(pricingLinks.length).toBeGreaterThanOrEqual(1)
    const pricingLink = pricingLinks[0]
    expect(pricingLink.textContent).toMatch(/see pricing/i)
  })
})

// ---------------------------------------------------------------------------
// 7.4 — Conversion tracking
// ---------------------------------------------------------------------------

describe('7.4 Conversion tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  it('fires landing_view on mount without ctaVariant metadata', async () => {
    await act(async () => {
      renderPage()
    })

    await waitFor(() => {
      expect(mockTrackConversionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'landing_view',
          metadata: expect.objectContaining({ path: '/' }),
        }),
      )
    })

    // Ensure ctaVariant is NOT present in the landing_view payload
    const landingViewCall = mockTrackConversionEvent.mock.calls.find(
      (call) => call[0]?.event === 'landing_view',
    )
    expect(landingViewCall).toBeDefined()
    expect(landingViewCall![0].metadata?.ctaVariant).toBeUndefined()
  })

  it('fires cta_click_primary with path and destination on primary CTA click (unauthenticated)', async () => {
    await act(async () => {
      renderPage()
    })

    // Click the first "Start with my menu" link (hero section)
    const primaryLinks = screen.getAllByText(/start with my menu/i)
    await act(async () => {
      fireEvent.click(primaryLinks[0])
    })

    expect(mockTrackConversionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cta_click_primary',
        metadata: expect.objectContaining({
          path: '/',
          destination: '/register', // unauthenticated → /register
        }),
      }),
    )
  })

  it('fires registration_start for unauthenticated primary CTA click', async () => {
    await act(async () => {
      renderPage(null) // explicitly unauthenticated
    })

    const primaryLinks = screen.getAllByText(/start with my menu/i)
    await act(async () => {
      fireEvent.click(primaryLinks[0])
    })

    expect(mockTrackConversionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'registration_start',
        metadata: expect.objectContaining({ path: '/' }),
      }),
    )
  })

  it('does NOT fire registration_start for authenticated primary CTA click', async () => {
    const fakeUser = { id: 'user-123', email: 'test@example.com' }
    mockGetSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
      error: null,
    })

    await act(async () => {
      renderPage(fakeUser)
    })

    // Wait for auth check to settle
    await waitFor(() => {
      // The primary CTA href should point to /dashboard for authenticated users
      const primaryLinks = screen
        .getAllByRole('link')
        .filter((l) => l.textContent?.match(/start with my menu/i))
      expect(primaryLinks[0].getAttribute('href')).toBe('/dashboard')
    })

    mockTrackConversionEvent.mockClear()

    const primaryLinks = screen.getAllByText(/start with my menu/i)
    await act(async () => {
      fireEvent.click(primaryLinks[0])
    })

    const registrationStartCalls = mockTrackConversionEvent.mock.calls.filter(
      (call) => call[0]?.event === 'registration_start',
    )
    expect(registrationStartCalls).toHaveLength(0)
  })

  it('fires cta_click_secondary with path, destination, and source on secondary CTA click', async () => {
    await act(async () => {
      renderPage()
    })

    const secondaryLink = screen.getByText(/try a demo menu/i)
    await act(async () => {
      fireEvent.click(secondaryLink)
    })

    expect(mockTrackConversionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cta_click_secondary',
        metadata: expect.objectContaining({
          path: '/',
          destination: '/demo/sample',
          source: expect.any(String),
        }),
      }),
    )
  })

  it('cta_click_primary payload does not include ctaVariant', async () => {
    await act(async () => {
      renderPage()
    })

    const primaryLinks = screen.getAllByText(/start with my menu/i)
    await act(async () => {
      fireEvent.click(primaryLinks[0])
    })

    const primaryClickCall = mockTrackConversionEvent.mock.calls.find(
      (call) => call[0]?.event === 'cta_click_primary',
    )
    expect(primaryClickCall).toBeDefined()
    expect(primaryClickCall![0].metadata?.ctaVariant).toBeUndefined()
  })
})
