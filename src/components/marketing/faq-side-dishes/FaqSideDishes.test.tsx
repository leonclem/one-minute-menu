import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FaqSideDishes } from './FaqSideDishes'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  ),
}))

describe('FaqSideDishes', () => {
  it('places the salmon on the left and the cake on the right', () => {
    const { container } = render(
      <section>
        <FaqSideDishes />
      </section>,
    )

    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', '/marketing/salmon-cutout.png')
    expect(images[0]).toHaveAttribute('alt', '')
    expect(images[1]).toHaveAttribute('src', '/marketing/chocolate-cake-cutout.png')
    expect(images[0].className).toContain('w-[min(40vw,11rem)]')
    expect(images[0].className).toContain('lg:top-[58%]')
    expect(images[0].className).toContain('bottom-2')
  })
})
