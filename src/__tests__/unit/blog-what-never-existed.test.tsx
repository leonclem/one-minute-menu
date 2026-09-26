import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ArticleWhatNeverExisted from '@/app/(marketing)/blog/the-problem-with-ai-imagery/ArticleWhatNeverExisted'
import BlogPageContent from '@/app/(marketing)/blog/BlogPageContent'
import { metadata } from '@/app/(marketing)/blog/the-problem-with-ai-imagery/page'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const TITLE = "The Problem With AI Imagery Isn't AI. It's What Never Existed"

describe('The Problem With AI Imagery blog post', () => {
  it('lists the article on the blog index and broadens the strapline', () => {
    render(<BlogPageContent />)

    expect(
      screen.getByText('Tips, insights, and guides for food imagery, marketing, and branding.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/food & beverage businesses/i)).not.toBeInTheDocument()

    const link = screen.getByRole('link', { name: /the problem with ai imagery isn't ai/i })
    expect(link).toHaveAttribute('href', '/blog/the-problem-with-ai-imagery')
    expect(link.querySelector('img')).toHaveAttribute('src', '/backgrounds/unappetising-ai-menu.png')
  })

  it('renders the article title, category, and key sections', () => {
    render(<ArticleWhatNeverExisted />)

    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument()
    expect(screen.getByText('Photo Studio')).toBeInTheDocument()
    expect(screen.getByText('Part 2: When enhancement becomes invention')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /maybe we.re just less easily impressed by ai/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /preserve, enhance, reconstruct, invent/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /knowing what not to generate/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Part 1' })).toHaveAttribute(
      'href',
      '/blog/remove-the-spoon-not-the-fork',
    )
    expect(
      screen.getByText('Sometimes the smartest use of generative AI is knowing what not to generate.'),
    ).toBeInTheDocument()
  })

  it('shows the supplied photos, captions, and a smaller compare control', () => {
    render(<ArticleWhatNeverExisted />)

    expect(
      screen.getByRole('img', {
        name: 'Left: real banana bread enhanced with AI. Right: an obviously fake banana bread.',
      }),
    ).toHaveAttribute('src', '/backgrounds/the-problem-with-ai-imagery.png')
    expect(
      screen.getByText(
        'Left: real banana bread, enhanced with AI. Right: banana bread that was invented, and looks it.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'A breaded burger that seems to include spaghetti.' }),
    ).toHaveAttribute('src', '/backgrounds/unappetising-ai-menu.png')
    expect(
      screen.getByRole('img', { name: /four stages, from a straight photograph/i }),
    ).toHaveAttribute('src', '/backgrounds/preserve-enhance-reconstruct-invent.png')
    expect(screen.getByRole('slider', { name: /compare your photo of massaman curry/i })).toBeInTheDocument()
    expect(screen.getByText('Drag to compare')).toBeInTheDocument()
    expect(screen.queryByText(/image to come/i)).not.toBeInTheDocument()
  })

  it('does not use em dashes in the article copy', () => {
    render(<ArticleWhatNeverExisted />)

    expect(document.body.textContent).not.toMatch(/—/)
    expect(document.body.textContent).not.toMatch(/–/)
  })

  it('includes Article JSON-LD, sources, and a home link', () => {
    render(<ArticleWhatNeverExisted />)

    const script = document.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    const parsed = JSON.parse(script?.textContent || '')
    expect(parsed['@type']).toBe('Article')
    expect(parsed.headline).toBe(TITLE)
    expect(parsed.url).toBe('https://gridmenu.ai/blog/the-problem-with-ai-imagery')
    expect(parsed.datePublished).toBe('2026-09-23')
    expect(parsed.dateModified).toBe('2026-09-26')
    const reportLinks = screen.getAllByRole('link', { name: /scientific reports/i })
    expect(reportLinks.length).toBeGreaterThan(0)
    for (const link of reportLinks) {
      expect(link).toHaveAttribute(
        'href',
        'https://www.nature.com/articles/s41598-026-66977-1',
      )
    }

    const guardianLinks = screen.getAllByRole('link', { name: /the guardian/i })
    expect(guardianLinks[0]).toHaveAttribute(
      'href',
      'https://www.theguardian.com/technology/2026/sep/06/ai-food-menu-images',
    )
    expect(screen.getByRole('link', { name: /trough of disillusionment/i })).toHaveAttribute(
      'href',
      'https://www.gartner.com/en/newsroom/press-releases/2026-09-16-gartner-forecasts-worldwide-ai-spending-to-grow-49-point-5-percent-in-2026',
    )
    expect(screen.getByRole('link', { name: /^GridMenu$/ })).toHaveAttribute('href', '/')
  })

  it('uses studio-focused metadata without em dashes', () => {
    expect(metadata.title).toBe(`${TITLE} | GridMenu`)
    expect(String(metadata.description)).toMatch(/invent/i)
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(JSON.stringify(metadata)).not.toMatch(/—/)
  })
})
