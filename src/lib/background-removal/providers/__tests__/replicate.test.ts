/**
 * Unit tests for ReplicateBackgroundRemovalProvider
 *
 * Tests cover:
 * - Constructor validation (API token required)
 * - removeBackground() success path (URL extraction, buffer fetch)
 * - removeBackground() error mapping (auth, rate limit, timeout, invalid input, server errors)
 * - isAvailable() checks
 */

import { ReplicateBackgroundRemovalProvider } from '../replicate'
import type { BackgroundRemovalError } from '../../types'

// ---------------------------------------------------------------------------
// Mock the Replicate SDK
// ---------------------------------------------------------------------------

const mockRun = jest.fn()
const mockModelsGet = jest.fn()

jest.mock('replicate', () => {
  return jest.fn().mockImplementation(() => ({
    run: mockRun,
    models: { get: mockModelsGet },
  }))
})

// Mock global fetch for image buffer fetching
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createProvider(token = 'test-token'): ReplicateBackgroundRemovalProvider {
  return new ReplicateBackgroundRemovalProvider(token)
}

function mockFetchSuccess(data = Buffer.from('fake-png-data')): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    arrayBuffer: () => Promise.resolve(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReplicateBackgroundRemovalProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('throws when no API token is provided', () => {
      const original = process.env.REPLICATE_API_TOKEN
      delete process.env.REPLICATE_API_TOKEN
      expect(() => new ReplicateBackgroundRemovalProvider('')).toThrow('REPLICATE_API_TOKEN is required')
      process.env.REPLICATE_API_TOKEN = original
    })

    it('accepts an explicit token', () => {
      expect(() => createProvider('my-token')).not.toThrow()
    })

    it('has name "replicate"', () => {
      expect(createProvider().name).toBe('replicate')
    })
  })

  describe('removeBackground', () => {
    it('returns a BackgroundRemovalResult on success (string URL output)', async () => {
      const provider = createProvider()
      mockRun.mockResolvedValueOnce('https://replicate.delivery/result.png')
      mockFetchSuccess()

      const result = await provider.removeBackground('https://example.com/food.jpg')

      expect(result.imageBuffer).toBeInstanceOf(Buffer)
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
      expect(result.modelVersion).toBe('851-labs/background-remover')
    })

    it('handles array output from Replicate', async () => {
      const provider = createProvider()
      mockRun.mockResolvedValueOnce(['https://replicate.delivery/result.png'])
      mockFetchSuccess()

      const result = await provider.removeBackground('https://example.com/food.jpg')
      expect(result.imageBuffer).toBeInstanceOf(Buffer)
    })

    it('throws invalid_input when imageUrl is empty', async () => {
      const provider = createProvider()
      try {
        await provider.removeBackground('')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('invalid_input')
        expect(error.code).toBe('INVALID_INPUT')
      }
    })

    it('throws processing_failed when output format is unexpected', async () => {
      const provider = createProvider()
      mockRun.mockResolvedValueOnce(null)

      try {
        await provider.removeBackground('https://example.com/food.jpg')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('processing_failed')
      }
    })

    it('throws processing_failed when image fetch fails', async () => {
      const provider = createProvider()
      mockRun.mockResolvedValueOnce('https://replicate.delivery/result.png')
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })

      try {
        await provider.removeBackground('https://example.com/food.jpg')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('processing_failed')
        expect(error.code).toBe('FETCH_FAILED')
      }
    })

    it('maps 401 errors to provider_unavailable', async () => {
      const provider = createProvider()
      const apiError = new Error('Unauthorized')
      ;(apiError as any).status = 401
      mockRun.mockRejectedValueOnce(apiError)

      try {
        await provider.removeBackground('https://example.com/food.jpg')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('provider_unavailable')
        expect(error.code).toBe('AUTH_ERROR')
      }
    })

    it('maps 403 errors to provider_unavailable', async () => {
      const provider = createProvider()
      const apiError = new Error('Forbidden')
      ;(apiError as any).status = 403
      mockRun.mockRejectedValueOnce(apiError)

      try {
        await provider.removeBackground('https://example.com/food.jpg')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('provider_unavailable')
      }
    })

    it('maps 422 errors to invalid_input', async () => {
      const provider = createProvider()
      const apiError = new Error('Unprocessable Entity')
      ;(apiError as any).status = 422
      mockRun.mockRejectedValueOnce(apiError)

      try {
        await provider.removeBackground('https://example.com/food.jpg')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('invalid_input')
      }
    })

    it('maps 429 errors to rate_limited', async () => {
      const provider = createProvider()
      const apiError = new Error('Too Many Requests')
      ;(apiError as any).status = 429
      mockRun.mockRejectedValueOnce(apiError)

      try {
        await provider.removeBackground('https://example.com/food.jpg')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('rate_limited')
        expect(error.code).toBe('RATE_LIMITED')
      }
    })

    it('maps 500+ errors to provider_unavailable', async () => {
      const provider = createProvider()
      const apiError = new Error('Internal Server Error')
      ;(apiError as any).status = 503
      mockRun.mockRejectedValueOnce(apiError)

      try {
        await provider.removeBackground('https://example.com/food.jpg')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('provider_unavailable')
        expect(error.code).toBe('SERVER_ERROR')
      }
    })

    it('maps timeout errors to timeout category', async () => {
      const provider = createProvider()
      mockRun.mockRejectedValueOnce(new Error('Request timed out'))

      try {
        await provider.removeBackground('https://example.com/food.jpg')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('timeout')
        expect(error.code).toBe('TIMEOUT')
      }
    })

    it('maps unknown errors to unknown category', async () => {
      const provider = createProvider()
      mockRun.mockRejectedValueOnce(new Error('Something unexpected'))

      try {
        await provider.removeBackground('https://example.com/food.jpg')
        fail('Expected an error to be thrown')
      } catch (err) {
        const error = err as BackgroundRemovalError
        expect(error.category).toBe('unknown')
      }
    })
  })

  describe('isAvailable', () => {
    it('returns false when REPLICATE_API_TOKEN is not set', async () => {
      const original = process.env.REPLICATE_API_TOKEN
      delete process.env.REPLICATE_API_TOKEN
      const provider = createProvider('explicit-token')

      const available = await provider.isAvailable()
      expect(available).toBe(false)

      process.env.REPLICATE_API_TOKEN = original
    })

    it('returns true when API token is set and model is accessible', async () => {
      process.env.REPLICATE_API_TOKEN = 'test-token'
      const provider = createProvider()
      mockModelsGet.mockResolvedValueOnce({ name: 'background-remover' })

      const available = await provider.isAvailable()
      expect(available).toBe(true)

      delete process.env.REPLICATE_API_TOKEN
    })

    it('returns false when API call fails', async () => {
      process.env.REPLICATE_API_TOKEN = 'test-token'
      const provider = createProvider()
      mockModelsGet.mockRejectedValueOnce(new Error('Unauthorized'))

      const available = await provider.isAvailable()
      expect(available).toBe(false)

      delete process.env.REPLICATE_API_TOKEN
    })
  })
})
