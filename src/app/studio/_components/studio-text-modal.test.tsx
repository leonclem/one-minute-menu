import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioTextModal } from './studio-text-modal'

describe('StudioTextModal', () => {
  it('associates optional helper text with the input', () => {
    render(
      <StudioTextModal
        open
        title="Name your dish"
        label="What is the dish?"
        helperText="Use a clear food name so suggestions match the dish."
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'What is the dish?' })
    expect(input).toHaveAccessibleDescription(
      'Use a clear food name so suggestions match the dish.',
    )
  })

  it('does not render helper text when it is not supplied', () => {
    render(
      <StudioTextModal
        open
        title="Rename dish"
        label="Dish name"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Dish name' })).not.toHaveAttribute(
      'aria-describedby',
    )
  })
})
