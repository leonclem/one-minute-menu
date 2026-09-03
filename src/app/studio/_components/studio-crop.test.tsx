import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { cropForPreset } from '@/lib/studio/crop'
import { StudioCropLauncher, StudioCropOverlay, StudioCropPanel, StudioLowResNotice } from './studio-crop'

describe('StudioCropLauncher', () => {
  it('opens crop mode', () => {
    const onOpen = jest.fn()
    render(<StudioCropLauncher onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crop image' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('StudioCropPanel', () => {
  const natural = { width: 1600, height: 1600 }

  it('warns but still allows Apply when the crop would be lower resolution', () => {
    const onApply = jest.fn()
    render(
      <StudioCropPanel
        preset="free"
        natural={natural}
        crop={{ x: 0, y: 0, width: 0.1, height: 0.1 }}
        onPresetChange={jest.fn()}
        onApply={onApply}
        onCancel={jest.fn()}
      />,
    )
    expect(screen.getByTestId('studio-crop-apply')).toBeEnabled()
    expect(
      screen.getByText('This crop is a lower resolution than recommended. Generate may look soft.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('studio-crop-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('warns on a maxed 3:4 window without telling the user to pick another shape', () => {
    const natural = { width: 2000, height: 900 }
    render(
      <StudioCropPanel
        preset="3:4"
        natural={natural}
        crop={cropForPreset('3:4', natural)}
        onPresetChange={jest.fn()}
        onApply={jest.fn()}
        onCancel={jest.fn()}
      />,
    )
    expect(screen.getByTestId('studio-crop-apply')).toBeEnabled()
    expect(
      screen.getByText('This crop is a lower resolution than recommended. Generate may look soft.'),
    ).toBeInTheDocument()
  })

  it('applies a valid crop', () => {
    const onApply = jest.fn()
    render(
      <StudioCropPanel
        preset="1:1"
        natural={natural}
        crop={{ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }}
        onPresetChange={jest.fn()}
        onApply={onApply}
        onCancel={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('studio-crop-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('enables Apply for a full-frame crop on a large stored photo', () => {
    render(
      <StudioCropPanel
        preset="original"
        natural={{ width: 2400, height: 1600 }}
        crop={{ x: 0, y: 0, width: 1, height: 1 }}
        onPresetChange={jest.fn()}
        onApply={jest.fn()}
        onCancel={jest.fn()}
      />,
    )
    expect(screen.getByTestId('studio-crop-apply')).toBeEnabled()
  })
})

describe('StudioLowResNotice', () => {
  it('warns without naming pixels or orientation', () => {
    render(<StudioLowResNotice natural={{ width: 800, height: 1200 }} />)
    expect(screen.getByTestId('studio-low-res-notice')).toHaveTextContent(
      'This photo is a lower resolution than recommended. Generate may look soft. Prefer an original camera photo when you can.',
    )
    expect(screen.getByTestId('studio-low-res-notice')).not.toHaveTextContent(/px/i)
  })

  it('hides when the photo is large enough', () => {
    render(<StudioLowResNotice natural={{ width: 1600, height: 1200 }} />)
    expect(screen.queryByTestId('studio-low-res-notice')).not.toBeInTheDocument()
  })

  it('hides when stored dimensions are unknown', () => {
    render(<StudioLowResNotice natural={null} />)
    expect(screen.queryByTestId('studio-low-res-notice')).not.toBeInTheDocument()
  })
})

describe('StudioCropOverlay', () => {
  const crop = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
  const natural = { width: 2400, height: 1600 }

  it('shows only corner handles when the aspect is locked', () => {
    render(
      <StudioCropOverlay crop={crop} natural={natural} pixelAspect={1} onChange={jest.fn()} />,
    )
    const handles = screen.getAllByRole('button').map((el) => el.getAttribute('data-crop-handle'))
    expect(handles.sort()).toEqual(['ne', 'nw', 'se', 'sw'])
    expect(screen.getByLabelText('Resize crop nw').className).toMatch(/min-h-0/)
  })

  it('shows edge handles only for Free', () => {
    render(
      <StudioCropOverlay crop={crop} natural={natural} pixelAspect={null} onChange={jest.fn()} />,
    )
    const handles = screen.getAllByRole('button').map((el) => el.getAttribute('data-crop-handle'))
    expect(handles).toHaveLength(8)
    expect(handles).toEqual(expect.arrayContaining(['n', 's', 'e', 'w']))
  })
})
