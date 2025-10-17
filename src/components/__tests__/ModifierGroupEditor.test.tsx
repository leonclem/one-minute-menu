import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ModifierGroupEditor from '@/components/ModifierGroupEditor'

describe('ModifierGroupEditor', () => {
  it('renders empty state and adds a group', () => {
    const onChange = jest.fn()
    render(<ModifierGroupEditor groups={[]} onChange={onChange} currency="USD" />)

    expect(screen.getByText('No modifier groups. Add one to begin.')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Add group'))
    expect(onChange).toHaveBeenCalled()
  })

  it('edits group fields and adds option', () => {
    const onChange = jest.fn()
    render(
      <ModifierGroupEditor
        groups={[{ name: 'Sauces', type: 'single', required: false, options: [{ name: 'Ketchup', priceDelta: 0 }] }]}
        onChange={onChange}
        currency="USD"
      />
    )

    const nameInput = screen.getByDisplayValue('Sauces') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Dips' } })
    expect(onChange).toHaveBeenCalled()

    const typeSelect = screen.getByDisplayValue('single') as HTMLSelectElement
    fireEvent.change(typeSelect, { target: { value: 'multi' } })
    expect(onChange).toHaveBeenCalled()

    const requiredCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    fireEvent.click(requiredCheckbox)
    expect(onChange).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Add option'))
    expect(onChange).toHaveBeenCalled()
  })

  it('edits option fields and removes option/group', () => {
    const onChange = jest.fn()
    render(
      <ModifierGroupEditor
        groups={[{ name: '', type: 'single', required: false, options: [{ name: 'Cheese', priceDelta: 1.5 }] }]}
        onChange={onChange}
      />
    )

    const optionName = screen.getByDisplayValue('Cheese') as HTMLInputElement
    fireEvent.change(optionName, { target: { value: 'Extra Cheese' } })
    expect(onChange).toHaveBeenCalled()

    const priceInput = screen.getByDisplayValue('1.5') as HTMLInputElement
    fireEvent.change(priceInput, { target: { value: '2' } })
    expect(onChange).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Remove'))
    expect(onChange).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Remove group'))
    expect(onChange).toHaveBeenCalled()
  })
})


