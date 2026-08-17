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

  it('includes /demo/sample when studio-public flags are off', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.some((url) => url.endsWith('/demo/sample'))).toBe(true)
    expect(urls.some((url) => url.includes('/studio'))).toBe(false)
  })

  it('omits parked menu URLs and /studio when studio-public flags are on', async () => {
    enableStudioPublic()
    const { default: sitemap } = await import('@/app/sitemap')
    const urls = sitemap().map((entry) => entry.url)
    expect(urls.some((url) => url.endsWith('/'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/pricing'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/register'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/support'))).toBe(true)
    expect(urls.some((url) => url.includes('/demo/sample'))).toBe(false)
    expect(urls.some((url) => url.includes('/blog'))).toBe(false)
    expect(urls.some((url) => url.includes('/studio'))).toBe(false)
  })

  it('returns studio homepage metadata when studio-public flags are on', async () => {
    enableStudioPublic()
    const { getHomePageMetadata } = await import('@/app/(marketing)/home-metadata')
    const metadata = getHomePageMetadata()
    expect(metadata.title).toBe('AI Food Photo Studio | GridMenu')
    expect(String(metadata.description)).toMatch(/10 free credits/i)
  })

  it('noindexes parked pages only when studio-public flags are on', async () => {
    const { parkedPageRobots, withParkedRobots } = await import('@/lib/studio/public-seo')
    expect(parkedPageRobots()).toBeUndefined()
    expect(withParkedRobots({ title: 'Blog' }).robots).toBeUndefined()

    enableStudioPublic()
    jest.resetModules()
    const studioSeo = await import('@/lib/studio/public-seo')
    expect(studioSeo.parkedPageRobots()).toEqual({ index: false, follow: false })
    expect(studioSeo.withParkedRobots({ title: 'Blog' }).robots).toEqual({
      index: false,
      follow: false,
    })
  })
})
