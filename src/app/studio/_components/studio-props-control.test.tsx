import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioPropsControl } from './studio-props-control'

describe('StudioPropsControl', () => {
  it('shows ranked suggestions and keeps the full catalogue behind show more', () => {
    const onToggle = jest.fn()
    render(
      <StudioPropsControl
        selectedIds={['whole-lemon']}
        rankedIds={['chopsticks', 'soy-sauce-dish', 'whole-lemon']}
        onToggle={onToggle}
      />,
    )

    expect(screen.getByRole('button', { name: 'Add Chopsticks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Whole lemon' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Fine grater' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(screen.getByRole('dialog', { name: 'Props' })).toHaveClass('bg-[#0f1c1f]')
    fireEvent.click(screen.getByRole('button', { name: 'Add Fine grater' }))
    expect(onToggle).toHaveBeenCalledWith('fine-grater')
    expect(screen.getByRole('heading', { name: 'Cutlery & tools' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ingredients' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Greenery' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Trailing vine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Dried grasses' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Potted basil' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Leafy stems' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Cow parsley' })).toBeInTheDocument()
    const list = screen.getByTestId('studio-props-browse-list')
    expect(list).toHaveClass('overflow-y-auto', 'overscroll-contain', 'min-h-0')
    const overlay = screen.getByRole('dialog', { name: 'Props' }).parentElement
    expect(overlay?.parentElement).toBe(document.body)
    expect(overlay).toHaveClass('backdrop-blur-md', 'bg-black/40')
    expect(overlay).not.toHaveClass('studio-shell')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('hides savoury props when the dish is a cake and lists baking props', () => {
    render(
      <StudioPropsControl
        selectedIds={[]}
        rankedIds={['salt-shaker', 'olive-oil-cruet', 'flour-bag']}
        audience="cake"
        onToggle={jest.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Add Salt mill' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Bag of flour' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(screen.queryByRole('button', { name: 'Add Olive oil cruet' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Chocolate squares' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Cocoa tin' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Baking' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Trailing vine' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Potted basil' })).not.toBeInTheDocument()
  })
})
