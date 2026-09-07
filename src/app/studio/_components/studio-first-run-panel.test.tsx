import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioFirstRunPanel } from './studio-first-run-panel'

jest.mock('@/lib/studio/analytics/studio-analytics', () => ({
  trackStudioEvent: jest.fn(),
}))

describe('StudioFirstRunPanel', () => {
  it('starts with + New dish and hides dismiss until a dish exists', () => {
    const onOpenFilePicker = jest.fn()
    render(<StudioFirstRunPanel onOpenFilePicker={onOpenFilePicker} />)

    fireEvent.click(screen.getByRole('button', { name: '+ New dish' }))
    expect(onOpenFilePicker).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText("Don't show this again")).not.toBeInTheDocument()
    expect(screen.getByText(/dish filling most of the frame/i)).toBeInTheDocument()
    expect(screen.getByText(/choose the changes you want to make, and execute/i)).toBeInTheDocument()
    expect(screen.queryByText(/without compromising the dish identity/i)).not.toBeInTheDocument()
    expect(screen.getByText(/obtain them via the pricing page/i)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Photo Studio workflow' }).querySelectorAll('li')).toHaveLength(
      3,
    )
  })

  it('offers Don’t show this again after the user has a dish', () => {
    render(
      <StudioFirstRunPanel onOpenFilePicker={jest.fn()} onDismiss={jest.fn()} canDismiss />,
    )
    expect(screen.getByRole('button', { name: '+ New dish' })).toBeInTheDocument()
    expect(screen.getByLabelText("Don't show this again")).toBeInTheDocument()
  })
})
