import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioFirstRunPanel } from './studio-first-run-panel'

jest.mock('@/lib/studio/analytics/studio-analytics', () => ({
  trackStudioEvent: jest.fn(),
}))

describe('StudioFirstRunPanel', () => {
  it('asks for a dish name before upload when no dish exists', () => {
    const onOpenFilePicker = jest.fn()
    render(<StudioFirstRunPanel onOpenFilePicker={onOpenFilePicker} needsDishName />)

    fireEvent.click(screen.getByRole('button', { name: 'Name your dish' }))
    expect(onOpenFilePicker).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Upload a dish photo' })).not.toBeInTheDocument()
  })

  it('opens the file picker when a dish already exists', () => {
    const onOpenFilePicker = jest.fn()
    render(<StudioFirstRunPanel onOpenFilePicker={onOpenFilePicker} />)

    fireEvent.click(screen.getByRole('button', { name: 'Upload a dish photo' }))
    expect(onOpenFilePicker).toHaveBeenCalledTimes(1)
  })
})
