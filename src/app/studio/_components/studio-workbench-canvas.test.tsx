import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioWorkbenchCanvas } from './studio-workbench-canvas'

describe('StudioWorkbenchCanvas', () => {
  it('keeps expand on a toolbar control so the canvas can pan', () => {
    const onExpand = jest.fn()
    render(
      <StudioWorkbenchCanvas
        src="https://example.com/dish.png"
        alt="Current studio image"
        expandLabel="Expand Variant 1 preview"
        onExpand={onExpand}
      />,
    )

    expect(screen.getByRole('img', { name: 'Current studio image' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand Variant 1 preview' }))
    expect(onExpand).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Zoom 100%')).toHaveTextContent('100%')
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument()
  })
})
