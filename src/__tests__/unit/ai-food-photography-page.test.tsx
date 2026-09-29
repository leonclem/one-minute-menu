import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AiFoodPhotographyContent from '@/app/(marketing)/ai-food-photography/AiFoodPhotographyContent'
import { getAiFoodPhotographyMetadata } from '@/app/(marketing)/ai-food-photography/metadata'
import { AI_FOOD_PHOTOGRAPHY_H1 } from '@/app/(marketing)/ai-food-photography/copy'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
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

jest.mock('@/components/marketing/hero-compare/HeroCompare', () => ({
  __esModule: true,
  default: () => <div data-testid="hero-compare" />,
}))

jest.mock('@/lib/conversion-tracking', () => ({
  trackConversionEvent: jest.fn(),
}))

jest.mock('@/lib/posthog', () => ({
  captureEvent: jest.fn(),
  ANALYTICS_EVENTS: {
    AI_FOOD_PHOTOGRAPHY_PAGE_VIEW: 'ai_food_photography_page_view',
    LANDING_CTA_CLICKED: 'landing_cta_clicked',
    CTA_CLICKED: 'cta_clicked',
  },
}))

import { captureEvent } from '@/lib/posthog'

describe('AI food photography landing page', () => {
  it('is indexable and canonicalises to itself', () => {
    const metadata = getAiFoodPhotographyMetadata()
    expect(metadata.title).toBe(
      'AI Food Photography | Turn Real Food Photos Into Studio-Quality Images | GridMenu',
    )
    expect(metadata.description).toMatch(/real food photos/i)
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(metadata.alternates?.canonical).toBe('https://www.gridmenu.ai/ai-food-photography')
    expect(metadata.openGraph?.url).toBe('https://www.gridmenu.ai/ai-food-photography')
  })

  it('uses one H1, a studio CTA, before/after examples, and a page-view event', () => {
    render(<AiFoodPhotographyContent />)

    expect(screen.getByRole('heading', { level: 1, name: AI_FOOD_PHOTOGRAPHY_H1 })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: /try gridmenu free/i }).length).toBeGreaterThan(0)
    expect(document.querySelector('a[href="/studio"]')).not.toBeNull()
    expect(screen.getByText('Same dish. New lighting and surface.')).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: /original photo of massaman curry in a bowl/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('What is AI food photography?')).toBeInTheDocument()
    expect(captureEvent).toHaveBeenCalledWith('ai_food_photography_page_view', {
      path: '/ai-food-photography',
    })
  })
})
