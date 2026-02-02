import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BatchAIImageGeneration from '@/components/BatchAIImageGeneration'
import { ToastProvider } from '@/components/ui'

jest.mock('@/lib/batch-generation', () => ({
  runBatchGenerationSequential: jest.fn(async (_menuId: string, items: any[]) => {
    // Return "failed" for each item to avoid triggering onItemImageGenerated
    return items.map((it) => ({ itemId: it.id, status: 'failed', error: 'nope' }))
  }),
}))

function makeItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `item-${i + 1}`, name: `Item ${i + 1}` }))
}

describe('BatchAIImageGeneration', () => {
  it('limits processing to first 20 selected items and informs the user', async () => {
    const onClose = jest.fn()
    const onItemImageGenerated = jest.fn()
    const items = makeItems(25)

    render(
      <ToastProvider>
        <BatchAIImageGeneration
          menuId="menu-1"
          items={items}
          onClose={onClose}
          onItemImageGenerated={onItemImageGenerated}
        />
      </ToastProvider>
    )

    expect(
      screen.getByText('Create Photos for 20 of 25 Selected Items')
    ).toBeInTheDocument()

    // The list should only show 20 items
    expect(screen.getByText('Item 20')).toBeInTheDocument()
    expect(screen.queryByText('Item 21')).not.toBeInTheDocument()

    // Start the batch
    fireEvent.click(screen.getByRole('button', { name: /Create Photos/i }))

    // The mocked runner should receive only 20 items
    const { runBatchGenerationSequential } = require('@/lib/batch-generation')
    await waitFor(() => {
      expect(runBatchGenerationSequential).toHaveBeenCalled()
    })
    const args = (runBatchGenerationSequential as jest.Mock).mock.calls[0]
    expect(args[1]).toHaveLength(20)
  })
})

