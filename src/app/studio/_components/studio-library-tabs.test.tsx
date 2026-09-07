import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioLibraryTabs } from './studio-library-tabs'

describe('StudioLibraryTabs', () => {
  it('uses underline tabs with list counts', () => {
    const onTab = jest.fn()
    render(
      <StudioLibraryTabs
        tab="exports"
        view="grid"
        shotCount={4}
        exportCount={2}
        onTab={onTab}
        onView={jest.fn()}
      />,
    )

    const shots = screen.getByRole('tab', { name: 'Shots 4' })
    const exportsTab = screen.getByRole('tab', { name: 'Exports 2' })
    expect(shots).toHaveAttribute('aria-selected', 'false')
    expect(exportsTab).toHaveAttribute('aria-selected', 'true')
    expect(shots.className).toMatch(/studio-tab/)
    expect(screen.queryByRole('button', { name: 'Grid' })).not.toBeInTheDocument()

    fireEvent.click(shots)
    expect(onTab).toHaveBeenCalledWith('shots')
  })
})
