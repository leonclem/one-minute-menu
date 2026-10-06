import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ArticleAiNativeSoftware from '@/app/(marketing)/blog/ai-native-software-shouldnt-look-like-a-chatbot/ArticleAiNativeSoftware'
import BlogPageContent from '@/app/(marketing)/blog/BlogPageContent'
import { metadata } from '@/app/(marketing)/blog/ai-native-software-shouldnt-look-like-a-chatbot/page'

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

const TITLE = "AI-Native Software Shouldn't Look Like a Chatbot"

describe('AI-native software blog post', () => {
  it('lists the article first on the blog index', () => {
    render(<BlogPageContent />)

    const link = screen.getByRole('link', { name: /ai-native software shouldn't look like a chatbot/i })
    expect(link).toHaveAttribute('href', '/blog/ai-native-software-shouldnt-look-like-a-chatbot')
    expect(link.querySelector('img')).toHaveAttribute(
      'src',
      '/backgrounds/ai-native-software-shouldnt-look-like-a-chatbot.jpg',
    )
  })

  it('renders the article title, category, and key sections', () => {
    render(<ArticleAiNativeSoftware />)

    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument()
    expect(screen.getByText('Photo Studio')).toBeInTheDocument()
    expect(screen.getByText('6 October 2026')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /when prompts repeat, the interface should probably change/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /use chat where you would actually chat/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /ask ai.*organisational shortcut/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /electricity disappeared into appliances/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /prompt fatigue/i })).toHaveAttribute(
      'href',
      '/blog/remove-the-spoon-not-the-fork',
    )
    expect(screen.queryByText(/image production notes/i)).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /baked salmon/i })).toHaveAttribute(
      'src',
      '/backgrounds/ai-native-software-shouldnt-look-like-a-chatbot.jpg',
    )
    expect(screen.getByRole('img', { name: /visible controls/i })).toHaveAttribute(
      'src',
      '/backgrounds/prompt-is-an-implementation-detail.png',
    )
    expect(screen.getByRole('img', { name: /ask ai chat/i })).toHaveAttribute(
      'src',
      '/backgrounds/bolted-on-ai-versus-built-in-workflow.png',
    )
  })

  it('does not use em dashes in the article copy', () => {
    render(<ArticleAiNativeSoftware />)

    expect(document.body.textContent).not.toMatch(/—/)
    expect(document.body.textContent).not.toMatch(/–/)
  })

  it('includes Article JSON-LD, sources, and a home link', () => {
    render(<ArticleAiNativeSoftware />)

    const script = document.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    const parsed = JSON.parse(script?.textContent || '')
    expect(parsed['@type']).toBe('Article')
    expect(parsed.headline).toBe(TITLE)
    expect(parsed.author).toMatchObject({
      '@type': 'Person',
      name: 'Leon Clements',
      email: 'leon@gridmenu.ai',
    })
    expect(parsed.publisher.name).toBe('GridMenu')
    expect(screen.getAllByText('Leon Clements').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('link', { name: 'Leon Clements' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/leonclements101/',
    )
    expect(screen.queryByRole('link', { name: 'LinkedIn' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'leon@gridmenu.ai' })).toHaveAttribute(
      'href',
      'mailto:leon@gridmenu.ai',
    )
    expect(parsed.datePublished).toBe('2026-10-06')
    expect(parsed.url).toBe(
      'https://gridmenu.ai/blog/ai-native-software-shouldnt-look-like-a-chatbot',
    )

    expect(
      screen.getByRole('link', { name: /nielsen norman group: ai chat is not \(always\) the answer/i }),
    ).toHaveAttribute('href', 'https://www.nngroup.com/articles/ai-chat-not-the-answer/')
    expect(screen.getAllByRole('link', { name: /^GridMenu$/ }).length).toBeGreaterThan(0)
  })

  it('uses indexable metadata without em dashes', () => {
    expect(metadata.title).toBe(`${TITLE} | GridMenu`)
    expect(String(metadata.description).length).toBeGreaterThanOrEqual(140)
    expect(String(metadata.description).length).toBeLessThanOrEqual(170)
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(JSON.stringify(metadata)).not.toMatch(/—/)
  })
})
