/**
 * Integration Tests for GeminiExtractionClient — Mocked Gemini API
 *
 * Feature: photo-control, Task 6.3
 *
 * Verifies the full `GeminiExtractionClient.extract()` call path with a mocked
 * `fetchJsonWithRetry` so no real HTTP requests are made. Specifically checks:
 *
 *  1. The image is sent as an `inlineData` part with the correct mimeType and
 *     base64 data. (Requirement 2.1)
 *  2. The extraction system prompt is included in `systemInstruction`. (Req 2.1)
 *  3. The latency-optimized profile is set in `generationConfig` via
 *     `thinkingConfig.thinkingBudget: 0`. (Requirement 2.3)
 *  4. `responseModalities: ['TEXT']` and `responseMimeType: 'application/json'`
 *     are set in `generationConfig`. (Requirement 2.1)
 *  5. The result carries the three top-level keys `scene_setup`, `canvas`, and
 *     `food_components`. (Requirement 2.2)
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 */

// ── Mock fetchJsonWithRetry before importing the module under test ─────────────
// jest.mock() is hoisted by Babel/Jest, so this runs before any import.
// We use the factory form so the mock is a jest.fn() instance.
jest.mock('../../retry', () => {
  return {
    fetchJsonWithRetry: jest.fn(),
    HttpError: class HttpError extends Error {
      status: number
      body?: unknown
      constructor(message: string, status: number, body?: unknown) {
        super(message)
        this.name = 'HttpError'
        this.status = status
        this.body = body
      }
    },
  }
})

import { fetchJsonWithRetry } from '../../retry'
import {
  GeminiExtractionClient,
  EXTRACTION_SYSTEM_PROMPT,
  type ExtractionRequest,
} from '../gemini-extraction-client'

// ── Typed mock reference ──────────────────────────────────────────────────────
const mockFetchJsonWithRetry = fetchJsonWithRetry as jest.MockedFunction<typeof fetchJsonWithRetry>

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimal valid base64 image data (1×1 white PNG, base64-encoded). */
const SAMPLE_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** A well-formed Gemini API response envelope containing a JSON extraction. */
function makeGeminiResponse(extractionJson: Record<string, unknown>) {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(extractionJson) }],
          role: 'model',
        },
        finishReason: 'STOP',
        index: 0,
      },
    ],
  }
}

/** A representative extraction result with all three required top-level keys. */
const SAMPLE_EXTRACTION = {
  scene_setup: {
    angle: '45-degree',
    framing: 'close-up',
    lighting: 'bright-and-airy',
  },
  canvas: {
    background: 'rustic wooden table',
    main_vessel: 'white ceramic plate',
  },
  food_components: {
    main_item: 'grilled salmon fillet',
    garnishes: ['lemon wedge', 'dill sprig'],
    sides: ['roasted potatoes'],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Captures the request body that was passed to `fetchJsonWithRetry` on the
 * most recent call. Parses the `body` string from the `RequestInit` argument.
 */
function capturedRequestBody(): Record<string, unknown> {
  const calls = mockFetchJsonWithRetry.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  const [, init] = calls[calls.length - 1] as [unknown, RequestInit, ...unknown[]]
  expect(typeof init?.body).toBe('string')
  return JSON.parse(init!.body as string) as Record<string, unknown>
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GeminiExtractionClient — integration (mocked Gemini)', () => {
  let client: GeminiExtractionClient

  beforeEach(() => {
    jest.clearAllMocks()
    // Provide a fake API key so the constructor does not throw.
    client = new GeminiExtractionClient('test-api-key')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ── Requirement 2.1: image sent as inlineData ─────────────────────────────

  describe('Requirement 2.1 — image is sent as an inlineData part', () => {
    it('sends the image base64 data in an inlineData part', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      const req: ExtractionRequest = {
        imageBase64: SAMPLE_IMAGE_BASE64,
        mimeType: 'image/jpeg',
      }
      await client.extract(req)

      const body = capturedRequestBody()
      const contents = body.contents as any[]
      expect(Array.isArray(contents)).toBe(true)
      expect(contents.length).toBeGreaterThan(0)

      const userTurn = contents.find((c: any) => c.role === 'user')
      expect(userTurn).toBeDefined()

      const inlineDataPart = (userTurn.parts as any[]).find(
        (p: any) => p.inlineData !== undefined,
      )
      expect(inlineDataPart).toBeDefined()
      expect(inlineDataPart.inlineData.data).toBe(SAMPLE_IMAGE_BASE64)
    })

    it('sends the correct mimeType in the inlineData part', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      const req: ExtractionRequest = {
        imageBase64: SAMPLE_IMAGE_BASE64,
        mimeType: 'image/png',
      }
      await client.extract(req)

      const body = capturedRequestBody()
      const contents = body.contents as any[]
      const userTurn = contents.find((c: any) => c.role === 'user')
      const inlineDataPart = (userTurn.parts as any[]).find(
        (p: any) => p.inlineData !== undefined,
      )
      expect(inlineDataPart.inlineData.mimeType).toBe('image/png')
    })

    it('sends the extraction system prompt in systemInstruction', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      await client.extract({ imageBase64: SAMPLE_IMAGE_BASE64, mimeType: 'image/jpeg' })

      const body = capturedRequestBody()
      const systemInstruction = body.systemInstruction as any
      expect(systemInstruction).toBeDefined()

      const parts = systemInstruction.parts as any[]
      expect(Array.isArray(parts)).toBe(true)
      expect(parts.length).toBeGreaterThan(0)

      const systemText = parts.find((p: any) => typeof p.text === 'string')
      expect(systemText).toBeDefined()
      expect(systemText.text).toBe(EXTRACTION_SYSTEM_PROMPT)
    })
  })

  // ── Requirement 2.3: latency-optimized profile ────────────────────────────

  describe('Requirement 2.3 — latency-optimized profile is set', () => {
    it('sets thinkingConfig.thinkingBudget to 0 in generationConfig', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      await client.extract({ imageBase64: SAMPLE_IMAGE_BASE64, mimeType: 'image/jpeg' })

      const body = capturedRequestBody()
      const generationConfig = body.generationConfig as any
      expect(generationConfig).toBeDefined()
      expect(generationConfig.thinkingConfig).toBeDefined()
      expect(generationConfig.thinkingConfig.thinkingBudget).toBe(0)
    })

    it('sets responseModalities to ["TEXT"] in generationConfig', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      await client.extract({ imageBase64: SAMPLE_IMAGE_BASE64, mimeType: 'image/jpeg' })

      const body = capturedRequestBody()
      const generationConfig = body.generationConfig as any
      expect(generationConfig.responseModalities).toEqual(['TEXT'])
    })

    it('sets responseMimeType to "application/json" in generationConfig', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      await client.extract({ imageBase64: SAMPLE_IMAGE_BASE64, mimeType: 'image/jpeg' })

      const body = capturedRequestBody()
      const generationConfig = body.generationConfig as any
      expect(generationConfig.responseMimeType).toBe('application/json')
    })
  })

  // ── Requirement 2.2: result carries the three top-level keys ─────────────

  describe('Requirement 2.2 — result carries scene_setup, canvas, food_components', () => {
    it('returns a raw object with all three required top-level keys', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      const result = await client.extract({
        imageBase64: SAMPLE_IMAGE_BASE64,
        mimeType: 'image/jpeg',
      })

      expect(result.raw).toBeDefined()
      expect(result.raw).toHaveProperty('scene_setup')
      expect(result.raw).toHaveProperty('canvas')
      expect(result.raw).toHaveProperty('food_components')
    })

    it('preserves the scene_setup values from the model response', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      const result = await client.extract({
        imageBase64: SAMPLE_IMAGE_BASE64,
        mimeType: 'image/jpeg',
      })

      expect((result.raw as any).scene_setup).toEqual(SAMPLE_EXTRACTION.scene_setup)
    })

    it('preserves the canvas values from the model response', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      const result = await client.extract({
        imageBase64: SAMPLE_IMAGE_BASE64,
        mimeType: 'image/jpeg',
      })

      expect((result.raw as any).canvas).toEqual(SAMPLE_EXTRACTION.canvas)
    })

    it('preserves the food_components values from the model response', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      const result = await client.extract({
        imageBase64: SAMPLE_IMAGE_BASE64,
        mimeType: 'image/jpeg',
      })

      expect((result.raw as any).food_components).toEqual(
        SAMPLE_EXTRACTION.food_components,
      )
    })

    it('handles a model response with empty garnishes and sides arrays', async () => {
      const minimalExtraction = {
        scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'low-key' },
        canvas: { background: 'slate', main_vessel: 'bowl' },
        food_components: { main_item: 'ramen', garnishes: [], sides: [] },
      }
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(minimalExtraction),
      )

      const result = await client.extract({
        imageBase64: SAMPLE_IMAGE_BASE64,
        mimeType: 'image/webp',
      })

      expect((result.raw as any).food_components.garnishes).toEqual([])
      expect((result.raw as any).food_components.sides).toEqual([])
    })
  })

  // ── Request URL includes the API key ──────────────────────────────────────

  describe('Request URL', () => {
    it('appends the API key as a query parameter', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce(
        makeGeminiResponse(SAMPLE_EXTRACTION),
      )

      await client.extract({ imageBase64: SAMPLE_IMAGE_BASE64, mimeType: 'image/jpeg' })

      const calls = mockFetchJsonWithRetry.mock.calls
      const [url] = calls[0] as [string, ...unknown[]]
      expect(typeof url).toBe('string')
      expect(url).toContain('key=test-api-key')
      expect(url).toContain('gemini-3.1-flash-image-preview')
      expect(url).toContain('generateContent')
    })
  })

  // ── Error propagation ─────────────────────────────────────────────────────

  describe('Error propagation', () => {
    it('propagates HttpError from fetchJsonWithRetry', async () => {
      const { HttpError } = jest.requireMock('../../retry') as {
        HttpError: new (msg: string, status: number) => Error & { status: number }
      }
      const httpError = new HttpError('Service unavailable', 503)
      mockFetchJsonWithRetry.mockRejectedValueOnce(httpError)

      await expect(
        client.extract({ imageBase64: SAMPLE_IMAGE_BASE64, mimeType: 'image/jpeg' }),
      ).rejects.toThrow('Service unavailable')
    })

    it('throws UnparseableExtractionResponseError when the model returns non-JSON text', async () => {
      mockFetchJsonWithRetry.mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [{ text: 'I cannot process this image.' }],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
      })

      const { UnparseableExtractionResponseError } = await import(
        '../gemini-extraction-client'
      )

      await expect(
        client.extract({ imageBase64: SAMPLE_IMAGE_BASE64, mimeType: 'image/jpeg' }),
      ).rejects.toBeInstanceOf(UnparseableExtractionResponseError)
    })
  })
})
