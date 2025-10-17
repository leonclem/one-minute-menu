import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import VariantEditor from '@/components/VariantEditor'

describe('VariantEditor', () => {
  it('renders empty state and adds a variant', () => {
    const onChange = jest.fn()
    render(<VariantEditor variants={[]} onChange={onChange} currency="USD" />)

    expect(screen.getByText('No variants. Add one to begin.')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Add variant'))
    expect(onChange).toHaveBeenCalled()
  })

  it('edits size and price', () => {
    const onChange = jest.fn()
    render(
      <VariantEditor
        variants={[{ size: 'Large', price: 10 }]}
        onChange={onChange}
        currency="USD"
      />
    )

    const sizeInput = screen.getByDisplayValue('Large') as HTMLInputElement
    fireEvent.change(sizeInput, { target: { value: 'Medium' } })
    expect(onChange).toHaveBeenCalled()

    const priceInput = screen.getAllByDisplayValue('10')[0] as HTMLInputElement
    fireEvent.change(priceInput, { target: { value: '12.5' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('adds and removes attributes', () => {
    const onChange = jest.fn()
    render(
      <VariantEditor
        variants={[{ price: 5 }]}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByText('Add attribute'))
    const keyInput = screen.getAllByPlaceholderText('key (e.g., forPax)')[0]
    const valInput = screen.getAllByPlaceholderText('value')[0]

    fireEvent.change(keyInput, { target: { value: 'forPax' } })
    fireEvent.change(valInput, { target: { value: '2' } })
    expect(onChange).toHaveBeenCalled()

    fireEvent.click(screen.getAllByText('Remove')[0])
    expect(onChange).toHaveBeenCalled()
  })

  it('bulk adjusts prices by percentage', () => {
    const onChange = jest.fn()
    render(
      <VariantEditor
        variants={[{ size: 'S', price: 10 }, { size: 'M', price: 20 }]}
        onChange={onChange}
      />
    )

    const allTens = screen.getAllByDisplayValue('10') as HTMLInputElement[]
    const percentInput = allTens[allTens.length - 1]
    fireEvent.change(percentInput, { target: { value: '20' } })
    fireEvent.click(screen.getByText('Apply'))

    expect(onChange).toHaveBeenCalled()
  })
})


