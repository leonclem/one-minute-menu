import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioOverheadBackdropDialog } from './studio-overhead-backdrop-dialog'

describe('StudioOverheadBackdropDialog', () => {
  it('renders nothing while closed', () => {
    render(<StudioOverheadBackdropDialog open={false} onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('warns that the backdrop will be unselected and lets the user keep it or switch', () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    render(<StudioOverheadBackdropDialog open onConfirm={onConfirm} onCancel={onCancel} />)

    expect(screen.getByRole('dialog', { name: 'Backdrop will be unselected' })).toHaveTextContent(
      /removes the backdrop you selected/,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Keep backdrop' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to overhead' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
