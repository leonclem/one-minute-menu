import { runBatchGenerationSequential, type BatchGenerationItem } from '@/lib/batch-generation'

function makeItems(n: number): BatchGenerationItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `item-${i + 1}`, name: `Item ${i + 1}` }))
}

describe('runBatchGenerationSequential', () => {
  test('handles synchronous success response and applies image', async () => {
    const items = makeItems(1)
    const calls: any[] = []

    const mockFetch = async (url: string, init?: any) => {
      calls.push({ url, init })
      if (url === '/api/generate-image') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { menuItemId: items[0].id, images: [{ originalUrl: 'https://img/1.jpg' }] } }),
        } as any
      }
      throw new Error('unexpected url')
    }

    const results = await runBatchGenerationSequential('menu-1', items, {
      styleParams: { aspectRatio: '1:1' },
      fetchImpl: mockFetch as any,
      onProgress: () => {},
    })

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('success')
    expect(results[0].imageUrl).toBe('https://img/1.jpg')
    expect(calls[0].url).toBe('/api/generate-image')
  })

  test('handles job success with normalized id and polling', async () => {
    const items = [{ id: 'short-id', name: 'Short' }]
    const calls: any[] = []
    let polls = 0

    const mockFetch = async (url: string, init?: any) => {
      calls.push({ url, init })
      if (url === '/api/generate-image') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { jobId: 'job-123' } }),
        } as any
      }
      if (url === '/api/generation-jobs/job-123') {
        polls++
        if (polls < 2) {
          return {
            ok: true,
            json: async () => ({ success: true, data: { job: { status: 'processing' } } }),
          } as any
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: { job: { status: 'completed', menuItemId: 'uuid-abc' }, images: [{ originalUrl: 'https://img/ok.jpg' }] } }),
        } as any
      }
      throw new Error('unexpected url')
    }

    const results = await runBatchGenerationSequential('menu-1', items, {
      styleParams: { aspectRatio: '1:1' },
      fetchImpl: mockFetch as any,
      maxPolls: 3,
      pollDelayMs: 1,
    })

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('success')
    expect(results[0].itemId).toBe('short-id')
    expect(results[0].itemIdNormalized).toBe('uuid-abc')
    expect(results[0].imageUrl).toBe('https://img/ok.jpg')
  })

  test('handles failure response', async () => {
    const items = makeItems(1)
    const mockFetch = async (url: string) => {
      if (url === '/api/generate-image') {
        return {
          ok: false,
          json: async () => ({ error: 'boom' }),
        } as any
      }
      throw new Error('unexpected url')
    }

    const results = await runBatchGenerationSequential('menu-1', items, {
      styleParams: { aspectRatio: '1:1' },
      fetchImpl: mockFetch as any,
    })

    expect(results[0].status).toBe('failed')
    expect(results[0].error).toBe('boom')
  })
})



