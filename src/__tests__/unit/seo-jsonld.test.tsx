import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import HomePage from '@/app/page'
import UXHomePage from '@/app/ux/page'

// For JSON-LD we just care that a script tag with the right type exists and is parseable.

// Mock conversion tracking to avoid any network calls when rendering UX pages in tests
jest.mock('@/lib/conversion-tracking', () => ({
  getABVariant: () => 'A',
  trackConversionEvent: () => {},
}))

describe('SEO JSON-LD', () => {
  it('renders JSON-LD script on the root marketing page', () => {
    render(<HomePage />)

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

  it('renders JSON-LD script on the UX landing page', () => {
    render(<UXHomePage />)

    const script = document.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()

    const text =
      (script as HTMLScriptElement).innerHTML ||
      (script as HTMLScriptElement).textContent ||
      ''
    const parsed = JSON.parse(text)

    expect(parsed['@type']).toBe('WebSite')
    expect(parsed.url).toContain('/ux')
  })
})


