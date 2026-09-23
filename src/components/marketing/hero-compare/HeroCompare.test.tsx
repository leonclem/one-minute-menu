import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import HeroCompare from './HeroCompare'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

describe('HeroCompare', () => {
  it('compares the original photo with the first variant of the first dish', () => {
    render(<HeroCompare />)

    expect(screen.getByRole('button', { name: 'Massaman Curry', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Slate', pressed: true })).toBeInTheDocument()
    expect(screen.getByText('Your photo')).toBeInTheDocument()
    expect(
      screen.getByRole('slider', { name: /compare your photo of massaman curry with slate/i }),
    ).toHaveAttribute('aria-valuenow', '50')
    expect(document.querySelector('img[src="/marketing/hero-compare/massaman-curry/OG.jpg"]')).not.toBeNull()
    expect(document.querySelector('img[src="/marketing/hero-compare/massaman-curry/slate.jpg"]')).not.toBeNull()
  })

  it('switches dishes and variants, keeping the original on the left', () => {
    render(<HeroCompare />)

    fireEvent.click(screen.getByRole('button', { name: 'Banana Bread' }))

    expect(screen.getByRole('button', { name: 'Banana Bread', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hot', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /banana bread with hot/i })).toBeInTheDocument()
    expect(document.querySelector('img[src="/marketing/hero-compare/banana-bread/OG.png"]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Rotated' }))

    expect(screen.getByRole('button', { name: 'Rotated', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /banana bread with rotated/i })).toBeInTheDocument()
    expect(document.querySelector('img[src="/marketing/hero-compare/banana-bread/OG.png"]')).not.toBeNull()
    expect(document.querySelector('img[src="/marketing/hero-compare/banana-bread/rotated.png"]')).not.toBeNull()
  })

  it('uses readable controls on a light surface, in a slightly smaller frame', () => {
    const { container } = render(<HeroCompare size="compact" tone="onLight" />)

    expect(container.querySelector('.max-w-\\[22rem\\]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Banana Bread' })).toHaveClass('text-gray-700')
    expect(screen.getByText('Fresh')).toHaveClass('text-gray-500')
  })
})
