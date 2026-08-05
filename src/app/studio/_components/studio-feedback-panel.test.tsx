import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioFeedbackPanel } from './studio-feedback-panel'

const IMAGE_ID = '123e4567-e89b-42d3-a456-426614174002'

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ completed: false }),
  }) as jest.Mock
})

describe('StudioFeedbackPanel initial values', () => {
  it('preserves user edits when equivalent reason tags are freshly allocated', async () => {
    const { rerender } = render(
      <StudioFeedbackPanel studioImageId={IMAGE_ID} initialReasonTags={[]} />
    )

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('radio', { name: 'Rate 4 of 5' }))
    fireEvent.click(
      screen.getByRole('button', { name: "The output didn't match what I asked for" })
    )
    fireEvent.change(screen.getByLabelText(/tell us more/i), {
      target: { value: 'Keep the plating.' },
    })

    rerender(<StudioFeedbackPanel studioImageId={IMAGE_ID} initialReasonTags={[]} />)

    expect(screen.getByRole('radio', { name: 'Rate 4 of 5' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(
      screen.getByRole('button', { name: "The output didn't match what I asked for" })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/tell us more/i)).toHaveValue('Keep the plating.')
  })

  it('resets feedback when initial tag contents change', async () => {
    const { rerender } = render(
      <StudioFeedbackPanel studioImageId={IMAGE_ID} initialReasonTags={[]} />
    )

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('radio', { name: 'Rate 4 of 5' }))
    fireEvent.click(
      screen.getByRole('button', { name: "The output didn't match what I asked for" })
    )

    rerender(
      <StudioFeedbackPanel
        studioImageId={IMAGE_ID}
        initialRating={2}
        initialReasonTags={['useful_result']}
        initialComment="Updated initial comment"
      />
    )

    await screen.findByRole('dialog')
    expect(screen.getByRole('radio', { name: 'Rate 2 of 5' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('button', { name: 'This result is useful' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByRole('button', { name: "The output didn't match what I asked for" })
    ).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText(/tell us more/i)).toHaveValue('Updated initial comment')
  })

  it('presents the new fake-result reason in the modal', async () => {
    render(<StudioFeedbackPanel studioImageId={IMAGE_ID} />)

    await screen.findByRole('dialog')
    expect(screen.getByRole('button', { name: 'It looks obviously fake' })).toBeVisible()
  })
})
