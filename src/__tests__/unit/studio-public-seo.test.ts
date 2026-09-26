/**
 * @jest-environment node
 */

describe('studio-public sitemap and SEO helpers', () => {
  const ENV_KEYS = [
    'NEXT_PUBLIC_PRODUCT_MODE',
    'NEXT_PUBLIC_ENABLE_PHOTO_STUDIO',
    'NEXT_PUBLIC_ENABLE_LEGACY_MENUS',
  ] as const

  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key]
      delete process.env[key]
    }
    jest.resetModules()
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalEnv[key]
      }
    }
  })

  function enableStudioPublic() {
    process.env.NEXT_PUBLIC_PRODUCT_MODE = 'photo-studio'
    process.env.NEXT_PUBLIC_ENABLE_LEGACY_MENUS = 'false'
    process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
  }

  it('includes /demo/sample and the blog when studio-public flags are off', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.some((url) => url.endsWith('/demo/sample'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/blog'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/blog/the-problem-with-ai-imagery'))).toBe(true)
    expect(urls.some((url) => url.includes('/studio'))).toBe(false)
  })

  it('omits parked menu URLs and /studio, and keeps the blog, when studio-public flags are on', async () => {
    enableStudioPublic()
    const { default: sitemap } = await import('@/app/sitemap')
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.some((url) => url.endsWith('/'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/pricing'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/register'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/support'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/blog'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/blog/the-problem-with-ai-imagery'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/blog/remove-the-spoon-not-the-fork'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/blog/restaurants-cannot-control-inflation'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/blog/digital-vs-paper-menus'))).toBe(true)
    expect(urls.some((url) => url.includes('/demo/sample'))).toBe(false)
    expect(urls.some((url) => url.includes('/studio'))).toBe(false)
  })

  it('returns studio homepage metadata even when studio-public flags are off', async () => {
    const { getHomePageMetadata } = await import('@/app/(marketing)/home-metadata')
    const metadata = getHomePageMetadata()
    expect(metadata.title).toBe('AI Food Photo Studio | GridMenu')
    expect(String(metadata.description)).toMatch(/10 free credits/i)
    expect(String(metadata.description)).not.toMatch(/restaurant menu/i)
  })

  it('returns studio homepage metadata when studio-public flags are on', async () => {
    enableStudioPublic()
    const { getHomePageMetadata } = await import('@/app/(marketing)/home-metadata')
    const metadata = getHomePageMetadata()
    expect(metadata.title).toBe('AI Food Photo Studio | GridMenu')
    expect(String(metadata.description)).toMatch(/10 free credits/i)
  })

  it('noindexes parked pages only when studio-public flags are on', async () => {
    const { parkedPageRobots, withParkedRobots, withIndexableRobots } = await import(
      '@/lib/studio/public-seo'
    )
    expect(parkedPageRobots()).toBeUndefined()
    expect(withParkedRobots({ title: 'Rate limits' }).robots).toBeUndefined()
    expect(withIndexableRobots({ title: 'Blog' }).robots).toEqual({
      index: true,
      follow: true,
    })

    enableStudioPublic()
    jest.resetModules()
    const studioSeo = await import('@/lib/studio/public-seo')
    expect(studioSeo.parkedPageRobots()).toEqual({ index: false, follow: false })
    expect(studioSeo.withParkedRobots({ title: 'Rate limits' }).robots).toEqual({
      index: false,
      follow: false,
    })
    expect(studioSeo.withIndexableRobots({ title: 'Blog' }).robots).toEqual({
      index: true,
      follow: true,
    })
  })

  it('omits legacy menu-subscription copy from public Studio FAQs', async () => {
    const { STUDIO_PUBLIC_FAQS } = await import('@/lib/studio/public-faqs')
    expect(STUDIO_PUBLIC_FAQS.some((faq) => /menu subscription/i.test(faq.question))).toBe(
      false,
    )
    expect(STUDIO_PUBLIC_FAQS.some((faq) => /legacy menu/i.test(faq.answer))).toBe(false)
  })

  it('uses studio credit-pack pricing metadata', async () => {
    const { STUDIO_PRICING_SEO } = await import('@/lib/studio/public-seo')
    expect(STUDIO_PRICING_SEO.title).toBe('Photo credits | GridMenu')
    expect(STUDIO_PRICING_SEO.h1).toBe('Photo Studio credits')
    expect(STUDIO_PRICING_SEO.description).toMatch(/10 free credits/i)
    expect(STUDIO_PRICING_SEO.description).not.toMatch(/subscription/i)
  })
})
