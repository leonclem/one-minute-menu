import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import SetMenuEditor from '@/components/SetMenuEditor'

describe('SetMenuEditor', () => {
  it('adds a course and options and updates values', () => {
    const handleChange = vi.fn()
    render(<SetMenuEditor value={undefined} onChange={handleChange} currency="USD" />)

    // Add a course
    fireEvent.click(screen.getByText('Add course'))
    expect(handleChange).toHaveBeenCalled()

    // Course input should be present
    const courseNameInput = screen.getByPlaceholderText('Course name (e.g., Starter)') as HTMLInputElement
    fireEvent.change(courseNameInput, { target: { value: 'Main' } })

    // Add option
    fireEvent.click(screen.getByText('Add option'))

    const optionInputs = screen.getAllByPlaceholderText('e.g., Premium ice cream') as HTMLInputElement[]
    expect(optionInputs.length).toBeGreaterThan(0)
    fireEvent.change(optionInputs[0], { target: { value: 'Steak' } })

    const deltaInputs = screen.getAllByDisplayValue('') as HTMLInputElement[]
    const deltaInput = deltaInputs.find(i => i.getAttribute('type') === 'number') || deltaInputs[0]
    fireEvent.change(deltaInput, { target: { value: '5' } })

    // Remove option
    fireEvent.click(screen.getByText('Remove'))

    // Remove course
    fireEvent.click(screen.getByText('Remove course'))
  })
})


