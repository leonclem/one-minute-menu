import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ExtractionReview from '@/components/ExtractionReview'
import { ToastProvider } from '@/components/ui'

const mockResult = {
  menu: {
    categories: [
      {
        name: 'MAINS',
        confidence: 0.9,
        items: [
          { name: 'Dish A', price: 10, confidence: 0.9 },
          { name: 'Dish B', price: 12, confidence: 0.9 }
        ]
      }
    ]
  },
  currency: 'USD',
  uncertainItems: [],
  superfluousText: []
}

describe('ExtractionReview exclude feature', () => {
  it('greys out excluded item and excludes from onSave payload', async () => {
    const onSave = jest.fn(async () => {})
    const onCancel = jest.fn()

    render(
      <ToastProvider>
        <ExtractionReview
          result={mockResult as any}
          onSave={onSave}
          onCancel={onCancel}
        />
      </ToastProvider>
    )

    // Expand category
    fireEvent.click(screen.getByText('MAINS'))

    // Click "Don't add" for the first item (use getAllByText since there are multiple)
    const dontAddButtons = screen.getAllByText("Don't add")
    fireEvent.click(dontAddButtons[0])

    // Save to Menu
    fireEvent.click(screen.getByText('Save to Menu'))

    // Wait for async onSave to be called
    expect(onSave).toHaveBeenCalled()

    const [categoriesArg] = onSave.mock.calls[0]
    expect(categoriesArg[0].items.length).toBe(1)
    expect(categoriesArg[0].items[0].name).toBe('Dish B')
  })

  it('can re-include an excluded item', async () => {
    const onSave = jest.fn(async () => {})
    const onCancel = jest.fn()

    render(
      <ToastProvider>
        <ExtractionReview
          result={mockResult as any}
          onSave={onSave}
          onCancel={onCancel}
        />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('MAINS'))

    const dontAddButtons = screen.getAllByText("Don't add")
    fireEvent.click(dontAddButtons[0])

    const includeBtn = screen.getByText('Include')
    fireEvent.click(includeBtn)

    fireEvent.click(screen.getByText('Save to Menu'))

    expect(onSave).toHaveBeenCalled()
    const [categoriesArg] = onSave.mock.calls[0]
    expect(categoriesArg[0].items.length).toBe(2)
  })
})


