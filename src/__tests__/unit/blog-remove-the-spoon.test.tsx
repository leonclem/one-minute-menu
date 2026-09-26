import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ArticleRemoveTheSpoon from '@/app/(marketing)/blog/remove-the-spoon-not-the-fork/ArticleRemoveTheSpoon'
import BlogPageContent from '@/app/(marketing)/blog/BlogPageContent'
import { metadata } from '@/app/(marketing)/blog/remove-the-spoon-not-the-fork/page'

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

describe('Remove the Spoon, Not the Fork blog post', () => {
  it('lists the article on the blog index', () => {
    render(<BlogPageContent />)

    const link = screen.getByRole('link', { name: /remove the spoon, not the fork/i })
    expect(link).toHaveAttribute('href', '/blog/remove-the-spoon-not-the-fork')
  })

  it('renders the article title, category, and key sections', () => {
    render(<ArticleRemoveTheSpoon />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Remove the Spoon, Not the Fork' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Photo Studio')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /the prompt becomes another job/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /the best prompt can be no prompt at all/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /prompt fatigue/i })).toHaveAttribute(
      'href',
      'https://cloud.google.com/blog/products/ai-machine-learning/announcing-vertex-ai-prompt-optimizer',
    )
    expect(screen.getByText('Control the image, not the prompt.')).toBeInTheDocument()
    expect(screen.queryByText(/not better prompting\. less prompting\./i)).not.toBeInTheDocument()
    expect(screen.queryByText(/part of his job/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /share on tiktok/i })).toHaveAttribute(
      'href',
      'https://www.tiktok.com/share?url=https%3A%2F%2Fgridmenu.ai%2Fblog%2Fremove-the-spoon-not-the-fork',
    )
  })

  it('does not use em dashes in the article copy', () => {
    render(<ArticleRemoveTheSpoon />)

    expect(document.body.textContent).not.toMatch(/—/)
    expect(document.body.textContent).not.toMatch(/–/)
  })

  it('includes Article JSON-LD, sources, and a home link', () => {
    render(<ArticleRemoveTheSpoon />)

    const script = document.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    const parsed = JSON.parse(script?.textContent || '')
    expect(parsed['@type']).toBe('Article')
    expect(parsed.headline).toBe('Remove the Spoon, Not the Fork')
    expect(parsed.url).toBe('https://gridmenu.ai/blog/remove-the-spoon-not-the-fork')

    expect(
      screen.getByRole('link', { name: /r\/foodphotography: AI taking a huge cut out of my business/i }),
    ).toHaveAttribute(
      'href',
      'https://www.reddit.com/r/foodphotography/comments/1w99uwi/ai_taking_a_huge_cut_out_of_my_business/',
    )
    expect(
      screen.getByRole('link', { name: /announcing vertex ai prompt optimizer/i }),
    ).toHaveAttribute(
      'href',
      'https://cloud.google.com/blog/products/ai-machine-learning/announcing-vertex-ai-prompt-optimizer',
    )
    expect(screen.getByRole('link', { name: /^GridMenu$/ })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: '↗' })).not.toBeInTheDocument()
  })

  it('uses studio-focused metadata without em dashes', () => {
    expect(metadata.title).toBe('Remove the Spoon, Not the Fork | GridMenu')
    expect(String(metadata.description)).toMatch(/controls/i)
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(JSON.stringify(metadata)).not.toMatch(/—/)
  })
})
