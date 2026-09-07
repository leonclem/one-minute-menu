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
  { id: 'light-bright-clean', label: 'Bright & Clean', assetBasename: 'lighting/lighting-bright-clean', value: 'bright-clean' },
]
const backdropOptions = [
  {
    id: 'bg-grey',
    label: 'Soft Neutral',
    assetBasename: 'backdrops/backdrop-soft-neutral',
    value: 'soft-neutral',
  },
]
const surfaceOptions = [
  {
    id: 'surface-oak',
    label: 'Natural Oak',
    assetBasename: 'surfaces/surface-natural-oak',
    value: 'natural-oak',
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
        lighting: 'bright-clean',
        backdrop: 'soft-neutral',
        surface: 'natural-oak',
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

  it('shows a GEN 3+ callout and still confirms Re-shoot', () => {
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
        degradationCallout={<div data-testid="studio-degradation-callout">GEN 3 warning</div>}
      />,
    )
    expect(screen.getByTestId('studio-degradation-callout')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Re-shoot/i }))
    expect(onConfirm).toHaveBeenCalled()
  })
})
