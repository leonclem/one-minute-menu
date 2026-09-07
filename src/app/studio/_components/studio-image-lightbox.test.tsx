import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioImageLightbox } from './studio-image-lightbox'

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockNextImage({
    fill: _fill,
    sizes: _sizes,
    ...props
  }: Record<string, unknown>) {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />
  },
}))

describe('StudioImageLightbox', () => {
  it('uses the dark Studio theme', () => {
    render(
      <StudioImageLightbox
        open
        imageUrl="https://example.com/cake.png"
        title="Instagram feed"
        subtitle="1080 × 1080"
        onClose={jest.fn()}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Instagram feed preview' })
    expect(dialog.className).toMatch(/studio-shell/)
    expect(screen.getByRole('heading', { name: 'Instagram feed' }).className).not.toMatch(
      /text-ux-text-secondary/,
    )
    expect(dialog.querySelector('.bg-white')).toBeNull()
  })

  it('closes from the Close control', () => {
    const onClose = jest.fn()
    render(
      <StudioImageLightbox
        open
        imageUrl="https://example.com/cake.png"
        title="Cutout"
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
