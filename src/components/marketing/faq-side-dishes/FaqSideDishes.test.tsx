import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FaqSideDishes } from './FaqSideDishes'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

describe('FaqSideDishes', () => {
  it('places the quesadilla on the left and the cake on the right', () => {
    const { container } = render(
      <section>
        <FaqSideDishes />
      </section>,
    )

    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', '/marketing/quesadilla-cutout.png')
    expect(images[0]).toHaveAttribute('alt', '')
    expect(images[1]).toHaveAttribute('src', '/marketing/chocolate-cake-cutout.png')
  })
})
