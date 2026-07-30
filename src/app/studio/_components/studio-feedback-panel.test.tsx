import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioFeedbackPanel } from './studio-feedback-panel'

describe('StudioFeedbackPanel initial values', () => {
  it('preserves user edits when equivalent reason tags are freshly allocated', () => {
    const { rerender } = render(
      <StudioFeedbackPanel studioImageId="image-1" initialReasonTags={[]} />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Rate 4 of 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'The style missed the mark' }))
    fireEvent.change(screen.getByLabelText(/tell us more/i), {
      target: { value: 'Keep the plating.' },
    })

    rerender(<StudioFeedbackPanel studioImageId="image-1" initialReasonTags={[]} />)

    expect(screen.getByRole('radio', { name: 'Rate 4 of 5' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('button', { name: 'The style missed the mark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText(/tell us more/i)).toHaveValue('Keep the plating.')
  })

  it('resets feedback when initial tag contents change', () => {
    const { rerender } = render(
      <StudioFeedbackPanel studioImageId="image-1" initialReasonTags={[]} />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Rate 4 of 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'The style missed the mark' }))

    rerender(
      <StudioFeedbackPanel
        studioImageId="image-1"
        initialRating={2}
        initialReasonTags={['useful_result']}
        initialComment="Updated initial comment"
      />,
    )

    expect(screen.getByRole('radio', { name: 'Rate 2 of 5' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('button', { name: 'This result is useful' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'The style missed the mark' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByLabelText(/tell us more/i)).toHaveValue('Updated initial comment')
  })
})
