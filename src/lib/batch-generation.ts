import type { ImageGenerationParams } from '@/types'

export type BatchGenerationItem = {
  id: string
  name: string
  description?: string
}

export type BatchGenerationResult = {
  /** The id we attempted to generate for (pre-normalization). */
  itemId: string
  /** The id returned by the server after normalization, if it changed. */
  itemIdNormalized?: string
  status: 'success' | 'failed'
  imageUrl?: string
  error?: string
}

export type BatchProgressUpdate = {
  index: number
  total: number
  itemId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error?: string
}

export interface RunBatchOptions {
  styleParams: ImageGenerationParams
  numberOfVariations?: number
  onProgress?: (update: BatchProgressUpdate) => void
  /**
   * Override fetch implementation for testing.
   */
  fetchImpl?: typeof fetch
  /**
   * Max polls when awaiting a background job. Defaults to 15.
   */
  maxPolls?: number
  /**
   * Delay between polls in ms. Defaults to 1500.
   */
  pollDelayMs?: number
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runBatchGenerationSequential(
  menuId: string,
  items: BatchGenerationItem[],
  options: RunBatchOptions
): Promise<BatchGenerationResult[]> {
  const results: BatchGenerationResult[] = []
  const fetchImpl = options.fetchImpl || fetch
  const total = items.length
  const maxPolls = options.maxPolls ?? 15
  const pollDelayMs = options.pollDelayMs ?? 1500

  for (let index = 0; index < items.length; index++) {
    const item = items[index]

    options.onProgress?.({ index, total, itemId: item.id, status: 'queued' })

    try {
      options.onProgress?.({ index, total, itemId: item.id, status: 'processing' })
      const response = await fetchImpl('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId,
          menuItemId: item.id,
          itemName: item.name,
          itemDescription: item.description,
          styleParams: options.styleParams,
          numberOfVariations: options.numberOfVariations ?? 1,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errMsg = result?.error || 'Generation failed'
        options.onProgress?.({ index, total, itemId: item.id, status: 'failed', error: errMsg })
        results.push({ itemId: item.id, status: 'failed', error: errMsg })
        continue
      }

      // Synchronous images path
      if (result?.data?.images?.length) {
        const imgUrl: string | undefined = result.data.images[0]?.originalUrl
        const normalizedId: string | undefined = result?.data?.menuItemId
        if (imgUrl) {
          options.onProgress?.({ index, total, itemId: item.id, status: 'completed' })
          results.push({ itemId: item.id, itemIdNormalized: normalizedId, status: 'success', imageUrl: imgUrl })
          continue
        }
      }

      // Job path - poll for completion
      const jobId: string | undefined = result?.data?.jobId
      if (jobId) {
        let polls = 0
        let success = false
        let imageUrl: string | undefined
        let lastError: string | undefined
        let normalizedId: string | undefined

        while (polls < maxPolls) {
          polls++
          const res = await fetchImpl(`/api/generation-jobs/${jobId}`)
          const json = await res.json().catch(() => ({}))
          if (!res.ok) {
            lastError = json?.error || 'Status check failed'
            break
          }
          const job = json?.data?.job
          if (job?.menuItemId) normalizedId = job.menuItemId
          const images = json?.data?.images || []
          if (job?.status === 'completed' && images.length > 0) {
            imageUrl = images[0]?.originalUrl
            success = !!imageUrl
            break
          }
          if (job?.status === 'failed') {
            lastError = job?.errorMessage || 'Generation failed'
            break
          }
          await sleep(pollDelayMs)
        }

        if (success && imageUrl) {
          options.onProgress?.({ index, total, itemId: item.id, status: 'completed' })
          results.push({ itemId: item.id, itemIdNormalized: normalizedId, status: 'success', imageUrl })
        } else {
          const err = lastError || 'Generation timed out'
          options.onProgress?.({ index, total, itemId: item.id, status: 'failed', error: err })
          results.push({ itemId: item.id, status: 'failed', error: err })
        }

        continue
      }

      // Unknown successful response but without images
      options.onProgress?.({ index, total, itemId: item.id, status: 'failed', error: 'No images returned' })
      results.push({ itemId: item.id, status: 'failed', error: 'No images returned' })
    } catch (e: any) {
      const errMsg = e?.message || 'Network error'
      options.onProgress?.({ index, total, itemId: item.id, status: 'failed', error: errMsg })
      results.push({ itemId: item.id, status: 'failed', error: errMsg })
    }
  }

  return results
}


