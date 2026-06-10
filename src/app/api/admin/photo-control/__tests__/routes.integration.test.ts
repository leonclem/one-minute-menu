/**
 * @jest-environment node
 */

/**
 * Integration Tests — Photo Control Route Auth and Dispatch (Mocked Gemini)
 *
 * Feature: photo-control, Task 8.4
 *
 * Verifies:
 *  - Unauthenticated requests → 401 before any model call (Requirement 13.1)
 *  - Non-admin requests → 403 before any model call (Requirement 13.2, 13.3)
 *  - Extract route dispatches to GeminiExtractionClient with correct args
 *  - Mutate route dispatches to `gemini-3.1-flash-image-preview` (Req 10.2)
 *  - Source image is passed as inline base64 (no data-URL prefix) (Req 10.7)
 *  - Mutate route returns `{ imageUrl: 'data:image/png;base64,...', model }` (Req 10.4)
 *
 * Validates: Requirements 10.2, 10.4, 10.7, 13.1, 13.2, 13.3
 */

// ── Module mocks (hoisted by Jest before imports) ─────────────────────────────

jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: jest.fn(),
}))

jest.mock('@/lib/photo-control/gemini-extraction-client', () => {
  const mockExtract = jest.fn()
  const GeminiExtractionClient = jest.fn().mockImplementation(() => ({
    extract: mockExtract,
  }))
  // Expose the inner mock so tests can configure it
  ;(GeminiExtractionClient as any).__mockExtract = mockExtract

  class UnparseableExtractionResponseError extends Error {
    readonly code = 'UNPARSEABLE_EXTRACTION_RESPONSE' as const
    constructor(message: string) {
      super(message)
      this.name = 'UnparseableExtractionResponseError'
    }
  }

  return { GeminiExtractionClient, UnparseableExtractionResponseError }
})

jest.mock('@/lib/photo-control/mutation-engine', () => ({
  getMutationEngine: jest.fn(),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { GeminiExtractionClient } from '@/lib/photo-control/gemini-extraction-client'
import { getMutationEngine } from '@/lib/photo-control/mutation-engine'

// Route handlers under test
import { POST as extractPOST } from '../extract/route'
import { POST as mutatePOST } from '../mutate/route'

// ── Typed mock references ─────────────────────────────────────────────────────

const mockRequireAdminApi = requireAdminApi as jest.MockedFunction<typeof requireAdminApi>
const mockGetMutationEngine = getMutationEngine as jest.MockedFunction<typeof getMutationEngine>
// Access the inner extract mock via the class constructor mock
const mockExtract: jest.MockedFunction<any> = (GeminiExtractionClient as any).__mockExtract

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimal 1×1 PNG in base64 (no data-URL prefix). */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** Valid PNG data URL used as the source image in requests. */
const VALID_IMAGE_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`

/** A valid MinimalSchema for use in mutate requests. */
const VALID_SCHEMA = {
  scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'low-key' },
  canvas: { background: 'dark wood', main_vessel: 'white plate' },
  food_components: { main_item: 'pasta', garnishes: ['basil'], sides: [] },
}

/** A fake admin user returned by a successful requireAdminApi call. */
const ADMIN_USER = { id: 'user-123', email: 'admin@example.com' }

/** Successful admin auth result. */
const AUTH_OK = { ok: true as const, supabase: {}, user: ADMIN_USER }

/** Factory: unauthenticated auth result (401) — creates a fresh response each call. */
function makeAuthUnauth() {
  return {
    ok: false as const,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  }
}

/** Factory: non-admin auth result (403) — creates a fresh response each call. */
function makeAuthForbidden() {
  return {
    ok: false as const,
    response: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a NextRequest with a JSON body. */
function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/photo-control/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Build a NextRequest for the mutate route. */
function makeMutateRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/photo-control/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('Photo Control Routes — Auth and Dispatch Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Ensure the API key is present so auth is the only variable
    process.env.NANO_BANANA_API_KEY = 'test-key'
  })

  afterEach(() => {
    delete process.env.NANO_BANANA_API_KEY
  })

  // ==========================================================================
  // Auth tests — Extract route
  // ==========================================================================

  describe('Extract route — auth gate', () => {
    it('returns 401 for unauthenticated requests (Requirement 13.1)', async () => {
      mockRequireAdminApi.mockResolvedValueOnce(makeAuthUnauth())

      const req = makeRequest({ imageDataUrl: VALID_IMAGE_DATA_URL })
      const res = await extractPOST(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('does NOT call GeminiExtractionClient when unauthenticated (Requirement 13.1)', async () => {
      mockRequireAdminApi.mockResolvedValueOnce(makeAuthUnauth())

      const req = makeRequest({ imageDataUrl: VALID_IMAGE_DATA_URL })
      await extractPOST(req)

      expect(GeminiExtractionClient).not.toHaveBeenCalled()
      expect(mockExtract).not.toHaveBeenCalled()
    })

    it('returns 403 for non-admin requests (Requirement 13.2)', async () => {
      mockRequireAdminApi.mockResolvedValueOnce(makeAuthForbidden())

      const req = makeRequest({ imageDataUrl: VALID_IMAGE_DATA_URL })
      const res = await extractPOST(req)

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toMatch(/forbidden/i)
    })

    it('does NOT call GeminiExtractionClient when non-admin (Requirement 13.2)', async () => {
      mockRequireAdminApi.mockResolvedValueOnce(makeAuthForbidden())

      const req = makeRequest({ imageDataUrl: VALID_IMAGE_DATA_URL })
      await extractPOST(req)

      expect(GeminiExtractionClient).not.toHaveBeenCalled()
      expect(mockExtract).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Auth tests — Mutate route
  // ==========================================================================

  describe('Mutate route — auth gate', () => {
    const validMutateBody = {
      sourceImageDataUrl: VALID_IMAGE_DATA_URL,
      originalState: VALID_SCHEMA,
      targetState: {
        ...VALID_SCHEMA,
        scene_setup: { ...VALID_SCHEMA.scene_setup, angle: 'top-down' },
      },
      directive: 'Change the camera angle to top-down.',
    }

    it('returns 401 for unauthenticated requests (Requirement 13.1)', async () => {
      mockRequireAdminApi.mockResolvedValueOnce(makeAuthUnauth())

      const req = makeMutateRequest(validMutateBody)
      const res = await mutatePOST(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('does NOT call getMutationEngine when unauthenticated (Requirement 13.1)', async () => {
      mockRequireAdminApi.mockResolvedValueOnce(makeAuthUnauth())

      const req = makeMutateRequest(validMutateBody)
      await mutatePOST(req)

      expect(mockGetMutationEngine).not.toHaveBeenCalled()
    })

    it('returns 403 for non-admin requests (Requirement 13.3)', async () => {
      mockRequireAdminApi.mockResolvedValueOnce(makeAuthForbidden())

      const req = makeMutateRequest(validMutateBody)
      const res = await mutatePOST(req)

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toMatch(/forbidden/i)
    })

    it('does NOT call getMutationEngine when non-admin (Requirement 13.3)', async () => {
      mockRequireAdminApi.mockResolvedValueOnce(makeAuthForbidden())

      const req = makeMutateRequest(validMutateBody)
      await mutatePOST(req)

      expect(mockGetMutationEngine).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Extract route — dispatch tests
  // ==========================================================================

  describe('Extract route — dispatch', () => {
    const SAMPLE_RAW_EXTRACTION = {
      scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'low-key' },
      canvas: { background: 'dark wood', main_vessel: 'white plate' },
      food_components: { main_item: 'pasta', garnishes: ['basil'], sides: [] },
    }

    beforeEach(() => {
      mockRequireAdminApi.mockResolvedValue(AUTH_OK)
      mockExtract.mockResolvedValue({ raw: SAMPLE_RAW_EXTRACTION })
    })

    it('calls GeminiExtractionClient.extract with the correct imageBase64 (no data-URL prefix)', async () => {
      const req = makeRequest({ imageDataUrl: VALID_IMAGE_DATA_URL })
      await extractPOST(req)

      expect(mockExtract).toHaveBeenCalledTimes(1)
      const [callArg] = mockExtract.mock.calls[0]
      // The base64 data must NOT include the data-URL prefix
      expect(callArg.imageBase64).toBe(TINY_PNG_BASE64)
      expect(callArg.imageBase64).not.toContain('data:')
      expect(callArg.imageBase64).not.toContain(';base64,')
    })

    it('calls GeminiExtractionClient.extract with the correct mimeType', async () => {
      const req = makeRequest({ imageDataUrl: VALID_IMAGE_DATA_URL })
      await extractPOST(req)

      const [callArg] = mockExtract.mock.calls[0]
      expect(callArg.mimeType).toBe('image/png')
    })

    it('returns { strictConformance, data, warnings } from the validator', async () => {
      const req = makeRequest({ imageDataUrl: VALID_IMAGE_DATA_URL })
      const res = await extractPOST(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('strictConformance')
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('warnings')
      expect(typeof body.strictConformance).toBe('boolean')
      expect(Array.isArray(body.warnings)).toBe(true)
    })

    it('returns strictConformance: true when the extraction has valid enum values', async () => {
      const req = makeRequest({ imageDataUrl: VALID_IMAGE_DATA_URL })
      const res = await extractPOST(req)

      const body = await res.json()
      // SAMPLE_RAW_EXTRACTION has all valid enum values → strictConformance should be true
      expect(body.strictConformance).toBe(true)
    })

    it('returns the coerced data with all three top-level schema keys', async () => {
      const req = makeRequest({ imageDataUrl: VALID_IMAGE_DATA_URL })
      const res = await extractPOST(req)

      const body = await res.json()
      expect(body.data).toHaveProperty('scene_setup')
      expect(body.data).toHaveProperty('canvas')
      expect(body.data).toHaveProperty('food_components')
    })
  })

  // ==========================================================================
  // Mutate route — dispatch tests
  // ==========================================================================

  describe('Mutate route — dispatch', () => {
    const MUTATED_IMAGE_BASE64 = 'bXV0YXRlZEltYWdlQmFzZTY0RGF0YQ==' // "mutatedImageBase64Data"

    const mockMutate = jest.fn()

    const validMutateBody = {
      sourceImageDataUrl: VALID_IMAGE_DATA_URL,
      originalState: VALID_SCHEMA,
      targetState: {
        ...VALID_SCHEMA,
        scene_setup: { ...VALID_SCHEMA.scene_setup, angle: 'top-down' },
      },
      directive: 'Change the camera angle to top-down.',
    }

    beforeEach(() => {
      mockRequireAdminApi.mockResolvedValue(AUTH_OK)
      mockMutate.mockResolvedValue({ imageBase64: MUTATED_IMAGE_BASE64, thoughtSignature: undefined })
      mockGetMutationEngine.mockReturnValue({ mutate: mockMutate } as any)
    })

    it('calls getMutationEngine().mutate with the source image as inline base64 (no data-URL prefix) (Requirement 10.7)', async () => {
      const req = makeMutateRequest(validMutateBody)
      await mutatePOST(req)

      expect(mockMutate).toHaveBeenCalledTimes(1)
      const [callArg] = mockMutate.mock.calls[0]
      // sourceImageBase64 must be raw base64, not a data URL (Requirement 10.7)
      expect(callArg.sourceImageBase64).toBe(TINY_PNG_BASE64)
      expect(callArg.sourceImageBase64).not.toContain('data:')
      expect(callArg.sourceImageBase64).not.toContain(';base64,')
    })

    it('calls getMutationEngine().mutate with the correct mimeType', async () => {
      const req = makeMutateRequest(validMutateBody)
      await mutatePOST(req)

      const [callArg] = mockMutate.mock.calls[0]
      expect(callArg.mimeType).toBe('image/png')
    })

    it('calls getMutationEngine().mutate with a non-empty composed prompt', async () => {
      const req = makeMutateRequest(validMutateBody)
      await mutatePOST(req)

      const [callArg] = mockMutate.mock.calls[0]
      expect(typeof callArg.prompt).toBe('string')
      expect(callArg.prompt.length).toBeGreaterThan(0)
      // The prompt should contain the directive
      expect(callArg.prompt).toContain('Change the camera angle to top-down.')
    })

    it('returns imageUrl as a data:image/png;base64,... data URL (Requirement 10.4)', async () => {
      const req = makeMutateRequest(validMutateBody)
      const res = await mutatePOST(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.imageUrl).toBe(`data:image/png;base64,${MUTATED_IMAGE_BASE64}`)
      expect(body.imageUrl).toMatch(/^data:image\/png;base64,/)
    })

    it('returns model: "gemini-3.1-flash-image-preview" in the response (Requirement 10.2)', async () => {
      const req = makeMutateRequest(validMutateBody)
      const res = await mutatePOST(req)

      const body = await res.json()
      expect(body.model).toBe('gemini-3.1-flash-image-preview')
    })

    it('returns the full expected response shape { imageUrl, model } (Requirements 10.2, 10.4)', async () => {
      const req = makeMutateRequest(validMutateBody)
      const res = await mutatePOST(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('imageUrl')
      expect(body).toHaveProperty('model')
      expect(body.imageUrl).toMatch(/^data:image\/png;base64,/)
      expect(body.model).toBe('gemini-3.1-flash-image-preview')
    })

    it('the MutationEngine internally targets gemini-3.1-flash-image-preview (Requirement 10.2)', async () => {
      // The route delegates to getMutationEngine().mutate(); the engine itself
      // always targets gemini-3.1-flash-image-preview (verified in mutation-engine tests).
      // Here we confirm the route calls getMutationEngine (not a different engine).
      const req = makeMutateRequest(validMutateBody)
      await mutatePOST(req)

      expect(mockGetMutationEngine).toHaveBeenCalledTimes(1)
      expect(mockMutate).toHaveBeenCalledTimes(1)
    })
  })
})
