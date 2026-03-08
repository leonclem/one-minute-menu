import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BatchAIImageGeneration from '@/components/BatchAIImageGeneration'
import { ToastProvider } from '@/components/ui'

jest.mock('@/lib/batch-generation', () => ({
  runBatchGenerationSequential: jest.fn(async (_menuId: string, items: any[]) => {
    // Return "failed" for each item to avoid triggering onItemImageGenerated
    return items.map((it) => ({ itemId: it.id, status: 'failed', error: 'nope' }))
  }),
}))

// Mock fetch to return batch limits
const mockFetch = jest.fn()
global.fetch = mockFetch

function makeItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `item-${i + 1}`, name: `Item ${i + 1}` }))
}

describe('BatchAIImageGeneration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: return free plan batch limits
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/batch-limits') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ maxBatchSize: 5, delayMs: 3000 }),
        })
      }
      // For generate-image calls
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'nope' }),
      })
    })
  })

  it('limits processing to plan-based batch size (free=5) and informs the user', async () => {
    const onClose = jest.fn()
    const onItemImageGenerated = jest.fn()
    const items = makeItems(10)

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

    // Wait for batch limits to be fetched
    await waitFor(() => {
      expect(screen.getByText('Create Photos for 5 of 10 Selected Items')).toBeInTheDocument()
    })

    // The list should only show 5 items
    expect(screen.getByText('Item 5')).toBeInTheDocument()
    expect(screen.queryByText('Item 6')).not.toBeInTheDocument()
  })

  it('uses higher batch limit for paid plans', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/batch-limits') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ maxBatchSize: 15, delayMs: 1000 }),
        })
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'nope' }),
      })
    })

    const items = makeItems(20)

    render(
      <ToastProvider>
        <BatchAIImageGeneration
          menuId="menu-1"
          items={items}
          onClose={jest.fn()}
          onItemImageGenerated={jest.fn()}
        />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Create Photos for 15 of 20 Selected Items')).toBeInTheDocument()
    })
  })

  it('passes delayMs to batch runner', async () => {
    const items = makeItems(3)

    render(
      <ToastProvider>
        <BatchAIImageGeneration
          menuId="menu-1"
          items={items}
          onClose={jest.fn()}
          onItemImageGenerated={jest.fn()}
        />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Create Photos for 3 Selected Items')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Create Photos/i }))

    const { runBatchGenerationSequential } = require('@/lib/batch-generation')
    await waitFor(() => {
      expect(runBatchGenerationSequential).toHaveBeenCalled()
    })
    const opts = (runBatchGenerationSequential as jest.Mock).mock.calls[0][2]
    expect(opts.delayMs).toBe(3000)
  })
})
