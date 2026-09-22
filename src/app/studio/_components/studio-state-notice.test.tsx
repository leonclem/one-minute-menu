import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioStateNotice } from './studio-state-notice'

describe('StudioStateNotice', () => {
  it('uses Studio dark-theme styling for the legitimate no-credit state', () => {
    render(<StudioStateNotice kind="no_credit" />)

    const notice = screen.getByTestId('studio-state-notice')
    expect(notice).toHaveClass(
      'border-[#f8bc02]/35',
      'bg-[rgba(248,188,2,0.13)]',
    )
    expect(screen.getByRole('heading')).toHaveClass('text-[#f8bc02]')
    expect(screen.getByRole('link', { name: 'See pricing' })).toHaveAttribute(
      'href',
      '/pricing',
    )
  })
})
