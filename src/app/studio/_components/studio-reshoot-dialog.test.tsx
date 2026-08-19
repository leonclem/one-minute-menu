import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { StudioReshootDialog } from './studio-reshoot-dialog'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'

const baseSchema: MinimalSchema = {
  scene_setup: {
    angle: '45-degree',
    framing: 'close-up',
    lighting: 'studio',
    spin: '0',
  },
  canvas: {
    background: '',
    background_style: '',
    surface_style: '',
    main_vessel: 'plate',
  },
  food_components: {
    main_item: 'burger',
    garnishes: [],
    sides: [],
  },
}

const lightingOptions = [
  { id: 'light-studio', label: 'Studio', assetBasename: 'lighting/lighting-studio', value: 'studio' },
]
const backdropOptions = [
  {
    id: 'bg-grey',
    label: 'Grey',
    assetBasename: 'backgrounds/bg-grey',
    value: 'studio-grey-white',
  },
]
const surfaceOptions = [
  {
    id: 'surface-cloth',
    label: 'Cloth',
    assetBasename: 'surfaces/surface-cloth',
    value: 'white-tablecloth',
  },
]

describe('StudioReshootDialog', () => {
  it('confirms with improve plating and resolved style defaults', () => {
    const onConfirm = jest.fn()
    render(
      <StudioReshootDialog
        open
        onClose={jest.fn()}
        onConfirm={onConfirm}
        baseSchema={baseSchema}
        extractionDiagnostics={null}
        lightingOptions={lightingOptions}
        backdropOptions={backdropOptions}
        surfaceOptions={surfaceOptions}
        creditLabel="1 credit"
      />,
    )

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Re-shoot/i }))

    expect(onConfirm).toHaveBeenCalledWith({
      improvePlating: true,
      styles: {
        lighting: 'studio',
        backdrop: 'studio-grey-white',
        surface: 'white-tablecloth',
      },
    })
  })

  it('mentions backdrop unavailability when the crop hid the backdrop', () => {
    render(
      <StudioReshootDialog
        open
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        baseSchema={baseSchema}
        extractionDiagnostics={null}
        lightingOptions={lightingOptions}
        backdropOptions={backdropOptions}
        surfaceOptions={surfaceOptions}
        creditLabel="1 credit"
        backdropUnavailable
      />,
    )

    expect(screen.getByText(/only way to add a backdrop/i)).toBeInTheDocument()
  })
})
