/**
 * @jest-environment node
 */

const nextConfig = require('../../../next.config.js')

describe('Google Ads CSP', () => {
  it('allows conversion script and pixel hosts', async () => {
    const headersList = await nextConfig.headers()
    const csp = headersList[0].headers.find(
      (header: { key: string }) => header.key === 'Content-Security-Policy',
    )?.value as string

    expect(csp).toContain("script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.googleadservices.com")
    expect(csp).toContain('https://www.googleadservices.com')
    expect(csp).toMatch(/connect-src[^;]*https:\/\/www\.googleadservices\.com/)
    expect(csp).toMatch(/connect-src[^;]*https:\/\/stats\.g\.doubleclick\.net/)
  })
})
