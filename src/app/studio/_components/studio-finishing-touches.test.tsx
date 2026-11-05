import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'

import { stackFromIds } from '@/lib/studio/finishing-touches'
import { StudioFinishingTouchesControl } from './studio-finishing-touches'

const options = stackFromIds(['coriander', 'lime_wedge'])

describe('StudioFinishingTouchesControl', () => {
  it('loads suggestions without selecting them automatically', () => {
    const onRequestStack = jest.fn()
    const onToggle = jest.fn()
    const { rerender } = render(
      <StudioFinishingTouchesControl
        stackLoaded={false}
        selectedIds={[]}
        options={[]}
        onRequestStack={onRequestStack}
        onToggle={onToggle}
      />,
    )

    const loadButton = screen.getByRole('button', { name: 'Add finishing touches' })
    expect(loadButton).toHaveClass('bg-[#f8bc02]')
    fireEvent.click(loadButton)
    expect(onRequestStack).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Does not run until you hit Generate/i)).toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: 'Garnish amount' })).not.toBeInTheDocument()

    rerender(
      <StudioFinishingTouchesControl
        stackLoaded
        selectedIds={[]}
        options={options}
        onRequestStack={onRequestStack}
        onToggle={onToggle}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add Coriander' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Add Lime wedges' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Garnish amount' })).toBeInTheDocument()
  })

  it('toggles each suggested garnish independently', () => {
    const onToggle = jest.fn()
    const { rerender } = render(
      <StudioFinishingTouchesControl
        stackLoaded
        selectedIds={[]}
        options={options}
        onRequestStack={jest.fn()}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Coriander' }))
    expect(onToggle).toHaveBeenCalledWith('coriander')

    rerender(
      <StudioFinishingTouchesControl
        stackLoaded
        selectedIds={['coriander']}
        options={options}
        onRequestStack={jest.fn()}
        onToggle={onToggle}
      />,
    )
    const selected = screen.getByRole('button', { name: 'Remove Coriander' })
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(selected).toHaveTextContent('✓')
    expect(screen.getByRole('button', { name: 'Add Lime wedges' })).toHaveTextContent('+')
  })

  it('disables extra chips once six are selected', () => {
    const cakeOptions = stackFromIds([
      'fresh_berries',
      'powdered_sugar',
      'chocolate_shavings',
      'mint_sprig',
      'lemon_drizzle',
      'honey_drizzle',
      'sliced_bananas',
    ])
    render(
      <StudioFinishingTouchesControl
        stackLoaded
        selectedIds={[
          'fresh_berries',
          'powdered_sugar',
          'chocolate_shavings',
          'mint_sprig',
          'lemon_drizzle',
          'honey_drizzle',
        ]}
        options={cakeOptions}
        onRequestStack={jest.fn()}
        onToggle={jest.fn()}
      />,
    )
    expect(screen.getByText(/Pick up to 6 for Generate/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Fresh berries' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Add Sliced bananas' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 more' }))
    expect(screen.getByRole('button', { name: 'Add Sliced bananas' })).toBeDisabled()
  })

  it('keeps a browse pick visible and still caps the selection at six', () => {
    const onToggle = jest.fn()
    const { rerender } = render(
      <StudioFinishingTouchesControl
        stackLoaded
        audience="cake"
        selectedIds={['sliced_bananas']}
        options={options}
        onRequestStack={jest.fn()}
        onToggle={onToggle}
      />,
    )

    expect(screen.getByRole('button', { name: 'Remove Sliced bananas' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Browse garnishes' }))
    const dialog = screen.getByRole('dialog', { name: 'Garnishes' })
    expect(within(dialog).getByRole('heading', { name: 'Fruit' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Add Coriander' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add Desiccated coconut' }))
    expect(onToggle).toHaveBeenCalledWith('desiccated_coconut')

    rerender(
      <StudioFinishingTouchesControl
        stackLoaded
        audience="cake"
        selectedIds={[
          'fresh_berries',
          'powdered_sugar',
          'chocolate_shavings',
          'mint_sprig',
          'lemon_drizzle',
          'honey_drizzle',
        ]}
        options={stackFromIds([
          'fresh_berries',
          'powdered_sugar',
          'chocolate_shavings',
          'mint_sprig',
          'lemon_drizzle',
          'honey_drizzle',
        ])}
        onRequestStack={jest.fn()}
        onToggle={onToggle}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Browse garnishes' }))
    expect(screen.getByRole('button', { name: 'Add Sliced bananas' })).toBeDisabled()
  })

  it('hides browse until the dish family is known', () => {
    const { rerender } = render(
      <StudioFinishingTouchesControl
        stackLoaded={false}
        audience={null}
        selectedIds={[]}
        options={[]}
        onRequestStack={jest.fn()}
        onToggle={jest.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Browse garnishes' })).not.toBeInTheDocument()

    rerender(
      <StudioFinishingTouchesControl
        stackLoaded
        audience="cake"
        selectedIds={[]}
        options={options}
        onRequestStack={jest.fn()}
        onToggle={jest.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Browse garnishes' })).toBeInTheDocument()
  })

  it('reports the selected amount', () => {
    const onAmountChange = jest.fn()
    render(
      <StudioFinishingTouchesControl
        stackLoaded
        selectedIds={[]}
        options={options}
        amount="medium"
        onRequestStack={jest.fn()}
        onToggle={jest.fn()}
        onAmountChange={onAmountChange}
      />,
    )
    const slider = screen.getByRole('slider', { name: 'Garnish amount' })
    expect(slider).toHaveValue('1')
    expect(slider).toHaveAttribute('aria-valuetext', 'Medium')
    fireEvent.change(slider, { target: { value: '2' } })
    expect(onAmountChange).toHaveBeenCalledWith('high')
  })
})
