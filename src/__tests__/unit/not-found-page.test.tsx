import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import NotFound from '@/app/not-found'
import StudioNotFound from '@/app/studio/not-found'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

describe('not-found pages', () => {
  it('gives unmatched pages a link home', () => {
    render(<NotFound />)

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })

  it('gives a missing studio photo a way home and back into Studio', () => {
    render(<StudioNotFound />)

    expect(screen.getByRole('heading', { name: "This photo isn't available" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Open Studio' })).toHaveAttribute('href', '/studio')
  })
})
