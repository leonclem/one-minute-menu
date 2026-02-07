import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'

import UXHomePage from '@/app/(marketing)/page'
import SupportPage from '@/app/support/page'

// For JSON-LD we just care that a script tag with the right type exists and is parseable.

// Mock conversion tracking to avoid any network calls when rendering UX pages in tests
jest.mock('@/lib/conversion-tracking', () => ({
  getABVariant: () => 'A',
  trackConversionEvent: () => {},
}))

describe('SEO JSON-LD', () => {
  it('renders JSON-LD script on the marketing page', () => {
    render(<UXHomePage />)

    const script = document.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()

    const text =
      (script as HTMLScriptElement).innerHTML ||
      (script as HTMLScriptElement).textContent ||
      ''
    const parsed = JSON.parse(text)

    expect(parsed['@type']).toBe('WebSite')
    expect(parsed.name).toMatch(/GridMenu/i)
  })

  it('renders FAQPage JSON-LD on the support page', () => {
    render(<SupportPage />)

    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts.length).toBeGreaterThanOrEqual(1)

    const script = scripts[0]
    const text =
      (script as HTMLScriptElement).innerHTML ||
      (script as HTMLScriptElement).textContent ||
      ''
    const parsed = JSON.parse(text)

    expect(parsed['@context']).toBe('https://schema.org')
    expect(parsed['@type']).toBe('FAQPage')
    expect(Array.isArray(parsed.mainEntity)).toBe(true)
    expect(parsed.mainEntity.length).toBeGreaterThan(0)
    expect(parsed.mainEntity[0]['@type']).toBe('Question')
    expect(parsed.mainEntity[0].name).toBeDefined()
    expect(parsed.mainEntity[0].acceptedAnswer['@type']).toBe('Answer')
    expect(parsed.mainEntity[0].acceptedAnswer.text).toBeDefined()
  })
})
