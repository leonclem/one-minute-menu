import { fail } from 'assert'
import { NanoBananaClient, NanoBananaError, createGenerationError } from '../nano-banana'
import { HttpError } from '../retry'
import type { NanoBananaParams } from '@/types'
// Jest provides `describe`, `it`, and lifecycle hooks as globals

// Mock the retry module
jest.mock('../retry', () => ({
  fetchJsonWithRetry: jest.fn(),
  HttpError: class MockHttpError extends Error {
    status: number
    code?: string
    body?: unknown
    constructor(message: string, status: number, body?: unknown, code?: string) {
      super(message)
      this.name = 'HttpError'
      this.status = status
      this.body = body
      this.code = code
    }
  }
}))

const mockFetchJsonWithRetry = jest.mocked(require('../retry').fetchJsonWithRetry)

describe('NanoBananaClient', () => {
  let client: NanoBananaClient
  const mockApiKey = 'test-api-key'

  beforeEach(() => {
    jest.clearAllMocks()
    // Set environment variable for tests
    process.env.NANO_BANANA_API_KEY = mockApiKey
    process.env.NANO_BANANA_BASE_URL = 'https://api.test.nanobanana.com/v1/generateContent'
    client = new NanoBananaClient()
  })

  afterEach(() => {
    delete process.env.NANO_BANANA_API_KEY
    delete process.env.NANO_BANANA_BASE_URL
  })

  describe('constructor', () => {
    it('should initialize with API key from environment', () => {
      expect(() => new NanoBananaClient()).not.toThrow()
    })

    it('should throw error when API key is missing', () => {
      delete process.env.NANO_BANANA_API_KEY
      expect(() => new NanoBananaClient()).toThrow('Nano Banana API key is required')
    })

    it('should accept API key as parameter', () => {
      const customClient = new NanoBananaClient('custom-key')
      expect(customClient).toBeInstanceOf(NanoBananaClient)
    })
  })

  describe('generateImage', () => {
    const validParams: NanoBananaParams = {
      prompt: 'Delicious grilled salmon with quinoa',
      aspect_ratio: '1:1',
      number_of_images: 1
    }

    it('should generate image successfully', async () => {
      const mockResponse = {
        candidates: [
          { content: { parts: [{ inlineData: { data: 'base64-encoded-image-data' } }] } }
        ],
        metadata: {
          processing_time_ms: 5000,
          model_version: 'gemini-1.0',
          safety_filter_applied: false
        }
      }

      mockFetchJsonWithRetry.mockResolvedValueOnce(mockResponse)

      const result = await client.generateImage(validParams)

      expect(result.images).toEqual(['base64-encoded-image-data'])
      expect(result.metadata.processingTime).toBe(5000)
      expect(result.metadata.modelVersion).toBe('gemini-1.0')
      expect(result.metadata.safetyFilterApplied).toBe(false)

      // URL should include API key query param
      const calledUrl = mockFetchJsonWithRetry.mock.calls[0][0] as string
      expect(calledUrl.startsWith('https://api.test.nanobanana.com/v1/generateContent')).toBe(true)
      expect(calledUrl).toContain(`key=${mockApiKey}`)

      const calledOpts = mockFetchJsonWithRetry.mock.calls[0][1]
      expect(calledOpts).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'User-Agent': 'OneMinuteMenu/1.0'
        })
      })
    })

    it('should handle multiple image variations', async () => {
      const mockResponse = {
        candidates: [
          { content: { parts: [{ inlineData: { data: 'image1' } }] } },
          { content: { parts: [{ inlineData: { data: 'image2' } }] } },
          { content: { parts: [{ inlineData: { data: 'image3' } }] } }
        ],
        metadata: { processing_time_ms: 8000, model_version: 'gemini-1.0' }
      }

      mockFetchJsonWithRetry.mockResolvedValueOnce(mockResponse)

      const result = await client.generateImage({
        ...validParams,
        number_of_images: 3
      })

      expect(result.images).toHaveLength(3)
      expect(result.images).toEqual(['image1', 'image2', 'image3'])
    })

    it('should apply default parameters', async () => {
      const mockResponse = {
        candidates: [{ content: { parts: [{ inlineData: { data: 'image' } }] } }],
        metadata: { processing_time_ms: 5000, model_version: 'gemini-1.0' }
      }

      mockFetchJsonWithRetry.mockResolvedValueOnce(mockResponse)

      await client.generateImage({ prompt: 'test prompt' })

      const body = mockFetchJsonWithRetry.mock.calls[0][1].body as string
      expect(body).toContain('Generate an image of: test prompt')
    })

    it('should throw error when API indicates policy violation (HTTP 403)', async () => {
      const httpError = new HttpError('Forbidden', 403)
      mockFetchJsonWithRetry.mockRejectedValueOnce(httpError)

      await expect(client.generateImage(validParams)).rejects.toThrow(
        new NanoBananaError('Content policy violation or forbidden request', 'CONTENT_POLICY_VIOLATION', 403)
      )
    })

    it('should throw error when no images are returned', async () => {
      const mockResponse = {
        success: true,
        images: [],
        metadata: { processing_time_ms: 5000, model_version: 'gemini-1.0' }
      }

      mockFetchJsonWithRetry.mockResolvedValueOnce(mockResponse)

      await expect(client.generateImage(validParams)).rejects.toThrow(
        new NanoBananaError('No images returned from API', 'NO_IMAGES_RETURNED')
      )
    })
  })

  describe('parameter validation', () => {
    it('should throw error for empty prompt', async () => {
      await expect(client.generateImage({ prompt: '' })).rejects.toThrow(
        new NanoBananaError('Prompt is required', 'INVALID_PARAMS')
      )
    })

    it('should throw error for prompt that is too long', async () => {
      const longPrompt = 'a'.repeat(2001)
      await expect(client.generateImage({ prompt: longPrompt })).rejects.toThrow(
        new NanoBananaError('Prompt is too long (max 2000 characters)', 'PROMPT_TOO_LONG')
      )
    })

    it('should throw error for invalid number of images', async () => {
      await expect(client.generateImage({
        prompt: 'test',
        number_of_images: 5
      })).rejects.toThrow(
        new NanoBananaError('Number of images must be between 1 and 4', 'INVALID_PARAMS')
      )
    })

    it('should throw error for invalid aspect ratio', async () => {
      await expect(client.generateImage({
        prompt: 'test',
        aspect_ratio: '2:3' as any
      })).rejects.toThrow(
        new NanoBananaError('Invalid aspect ratio. Must be one of: 1:1, 16:9, 9:16, 4:3, 3:4', 'INVALID_PARAMS')
      )
    })

    it('should throw error for invalid safety filter level', async () => {
      await expect(client.generateImage({
        prompt: 'test',
        safety_filter_level: 'invalid' as any
      })).rejects.toThrow(
        new NanoBananaError('Invalid safety filter level. Must be one of: block_none, block_some, block_most', 'INVALID_PARAMS')
      )
    })
  })

  describe('HTTP error handling', () => {
    const validParams: NanoBananaParams = {
      prompt: 'test prompt'
    }

    it('should handle 400 Bad Request', async () => {
      const httpError = new HttpError('Bad Request', 400)
      mockFetchJsonWithRetry.mockRejectedValueOnce(httpError)

      await expect(client.generateImage(validParams)).rejects.toThrow(
        new NanoBananaError('Bad Request', 'INVALID_PARAMS', 400)
      )
    })

    it('should handle 401 Unauthorized', async () => {
      const httpError = new HttpError('Unauthorized', 401)
      mockFetchJsonWithRetry.mockRejectedValueOnce(httpError)

      await expect(client.generateImage(validParams)).rejects.toThrow(
        new NanoBananaError('Invalid API key or authentication failed', 'AUTHENTICATION_ERROR', 401)
      )
    })

    it('should handle 403 Forbidden', async () => {
      const httpError = new HttpError('Forbidden', 403)
      mockFetchJsonWithRetry.mockRejectedValueOnce(httpError)

      await expect(client.generateImage(validParams)).rejects.toThrow(
        new NanoBananaError('Content policy violation or forbidden request', 'CONTENT_POLICY_VIOLATION', 403)
      )
    })

    it('should handle 429 Rate Limit with retry-after', async () => {
      const httpError = new HttpError('Rate Limited', 429, { retry_after: '60' })
      mockFetchJsonWithRetry.mockRejectedValueOnce(httpError)

      try {
        await client.generateImage(validParams)
      } catch (error) {
        expect(error).toBeInstanceOf(NanoBananaError)
        const nanoBananaError = error as NanoBananaError
        expect(nanoBananaError.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(nanoBananaError.retryAfter).toBe(60)
        expect(nanoBananaError.suggestions).toContain('Wait a moment and try again')
      }
    })

    it('should handle 500 Server Error', async () => {
      const httpError = new HttpError('Internal Server Error', 500)
      mockFetchJsonWithRetry.mockRejectedValueOnce(httpError)

      await expect(client.generateImage(validParams)).rejects.toThrow(
        new NanoBananaError('Service temporarily unavailable', 'SERVICE_UNAVAILABLE', 500)
      )
    })

    it('should handle unknown HTTP errors', async () => {
      const httpError = new HttpError('Unknown Error', 418)
      mockFetchJsonWithRetry.mockRejectedValueOnce(httpError)

      await expect(client.generateImage(validParams)).rejects.toThrow(
        new NanoBananaError('Unknown Error', 'NETWORK_ERROR', 418)
      )
    })
  })

  describe('checkRateLimit', () => {
    it('should return default values (Gemini has no rate-limit endpoint)', async () => {
      const result = await client.checkRateLimit()
      expect(result.remaining).toBe(100)
      expect(result.limit).toBe(100)
      expect(result.reset_time).toBeGreaterThan(Date.now())
      expect(mockFetchJsonWithRetry).not.toHaveBeenCalled()
    })
  })
})

describe('NanoBananaError', () => {
  it('should generate appropriate suggestions for content policy violations', () => {
    const error = new NanoBananaError(
      'Content violates policy',
      'CONTENT_POLICY_VIOLATION'
    )

    expect(error.suggestions).toContain('Add more details about the dish ingredients')
    expect(error.suggestions).toContain('Specify the plating style (e.g., "on a white plate")')
  })

  it('should generate suggestions for safety filter blocks', () => {
    const error = new NanoBananaError(
      'Safety filter blocked',
      'SAFETY_FILTER_BLOCKED',
      undefined,
      undefined,
      'person_detected'
    )

    expect(error.suggestions).toContain('Set "No people" in generation settings')
    expect(error.suggestions).toContain('Focus description on the food only')
  })

  it('should generate default suggestions for unknown errors', () => {
    const error = new NanoBananaError(
      'Unknown error',
      'UNKNOWN_ERROR'
    )

    expect(error.suggestions).toContain('Please try again with a different description')
  })
})

describe('createGenerationError', () => {
  it('should convert NanoBananaError to GenerationError', () => {
    const nanoBananaError = new NanoBananaError(
      'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      429,
      60
    )

    const generationError = createGenerationError(nanoBananaError)

    expect(generationError.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(generationError.message).toBe('Rate limit exceeded')
    expect(generationError.retryable).toBe(true)
    expect(generationError.suggestions).toEqual(nanoBananaError.suggestions)
  })

  it('should mark non-retryable errors correctly', () => {
    const nanoBananaError = new NanoBananaError(
      'Invalid params',
      'INVALID_PARAMS'
    )

    const generationError = createGenerationError(nanoBananaError)

    expect(generationError.retryable).toBe(false)
  })
})