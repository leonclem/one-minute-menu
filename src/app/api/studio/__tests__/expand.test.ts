/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockLoadOwnedDishSource = jest.fn()
const mockLoadStudioImageBytes = jest.fn()
const mockPadExpandCanvas = jest.fn()
const mockMutate = jest.fn()
const mockCountToday = jest.fn()
const mockPersist = jest.fn()
const mockGetLimit = jest.fn()
const mockGetStudioDish = jest.fn()
const mockSetCurrentImage = jest.fn()
const mockAssertCanAfford = jest.fn()
const mockDebit = jest.fn()
const mockGetCreditCost = jest.fn()
const mockAssertDishNotBlocked = jest.fn()
const mockRecordFailure = jest.fn()
const mockRecordSuccess = jest.fn()
const mockIsBillable = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/studio/owned-source', () => ({
  loadOwnedDishSource: (...args: unknown[]) => mockLoadOwnedDishSource(...args),
  OwnedStudioSourceNotFoundError: class OwnedStudioSourceNotFoundError extends Error {
    status = 404
    constructor() {
      super('Studio source image not found')
      this.name = 'OwnedStudioSourceNotFoundError'
    }
  },
}))

jest.mock('@/lib/studio/image-bytes', () => ({
  loadStudioImageBytes: (...args: unknown[]) => mockLoadStudioImageBytes(...args),
  StudioImageLoadError: class StudioImageLoadError extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.name = 'StudioImageLoadError'
      this.status = status
    }
  },
}))

jest.mock('@/lib/studio/expand/canvas', () => ({
  padExpandCanvas: (...args: unknown[]) => mockPadExpandCanvas(...args),
  StudioExpandCanvasError: class StudioExpandCanvasError extends Error {
    code: string
    status: number
    constructor(message: string, code: string, status = 400) {
      super(message)
      this.name = 'StudioExpandCanvasError'
      this.code = code
      this.status = status
    }
  },
}))

jest.mock('@/lib/photo-control/mutation-engine', () => ({
  getMutationEngine: () => ({
    mutate: (...args: unknown[]) => mockMutate(...args),
  }),
}))

jest.mock('@/lib/studio/dishes', () => ({
  getStudioDish: (...args: unknown[]) => mockGetStudioDish(...args),
  setStudioDishCurrentImage: (...args: unknown[]) => mockSetCurrentImage(...args),
}))

jest.mock('@/lib/studio/persistence', () => ({
  countTodayGeneratedStudioImages: (...args: unknown[]) => mockCountToday(...args),
  getStudioDailyGenerationLimit: () => mockGetLimit(),
  persistStudioImage: (...args: unknown[]) => mockPersist(...args),
}))

jest.mock('@/lib/studio/credits', () => {
  class StudioCreditsError extends Error {
    code: string
    status: number
    constructor(message: string, code: string, status = 402) {
      super(message)
      this.name = 'StudioCreditsError'
      this.code = code
      this.status = status
    }
  }
  return {
    assertCanAffordStudioCredits: (...args: unknown[]) => mockAssertCanAfford(...args),
    debitForStudioGeneration: (...args: unknown[]) => mockDebit(...args),
    getCreditCostForModel: (...args: unknown[]) => mockGetCreditCost(...args),
    StudioCreditsError,
  }
})

jest.mock('@/lib/studio/generation-failures', () => {
  class StudioDishBlockedError extends Error {
    code = 'STUDIO_DISH_GENERATION_BLOCKED'
    status = 423
    failureCount: number
    constructor(message: string, failureCount: number) {
      super(message)
      this.name = 'StudioDishBlockedError'
      this.failureCount = failureCount
    }
  }
  return {
    assertDishNotBlocked: (...args: unknown[]) => mockAssertDishNotBlocked(...args),
    isBillableProviderFailure: (...args: unknown[]) => mockIsBillable(...args),
    recordBillableGenerationFailure: (...args: unknown[]) => mockRecordFailure(...args),
    recordGenerationSuccess: (...args: unknown[]) => mockRecordSuccess(...args),
    StudioDishBlockedError,
  }
})

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { StudioCreditsError } from '@/lib/studio/credits'
import { StudioDishBlockedError } from '@/lib/studio/generation-failures'
import { OwnedStudioSourceNotFoundError } from '@/lib/studio/owned-source'
import { STUDIO_FLASH_MODEL } from '@/lib/studio/model-config'
import { POST } from '../expand/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/studio/expand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const parentImage = {
  id: 'parent-1',
  user_id: 'user-1',
  dish_id: 'dish-1',
  role: 'source' as const,
  metadata: {
    editorState: { schema: { food_components: { main_item: 'soup' } } },
    extractionDiagnostics: { version: 1 },
    objectEdit: { shouldNotCopy: true },
  },
}

const validBody = {
  dishId: 'dish-1',
  sourceImageId: 'parent-1',
  preset: 'balanced' as const,
}

describe('POST /api/studio/expand', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NANO_BANANA_API_KEY = 'test-key'
    mockGetLimit.mockReturnValue(25)
    mockCountToday.mockResolvedValue(0)
    mockGetStudioDish.mockResolvedValue({
      id: 'dish-1',
      name: 'Soup',
      generation_failure_count: 0,
      generation_blocked_at: null,
    })
    mockSetCurrentImage.mockResolvedValue({ id: 'dish-1' })
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockLoadOwnedDishSource.mockResolvedValue({
      dish: { id: 'dish-1', generation_blocked_at: null },
      image: parentImage,
    })
    mockLoadStudioImageBytes.mockResolvedValue({
      mimeType: 'image/png',
      base64: Buffer.from('png').toString('base64'),
      byteLength: 3,
    })
    mockPadExpandCanvas.mockResolvedValue({
      buffer: Buffer.from('padded'),
      width: 1512,
      height: 2016,
      padding: { top: 288, right: 216, bottom: 288, left: 216 },
    })
    mockMutate.mockResolvedValue({
      imageBase64: Buffer.from('gemini').toString('base64'),
      mimeType: 'image/png',
    })
    mockPersist.mockResolvedValue({
      id: 'expand-1',
      dish_id: 'dish-1',
      public_url: 'https://cdn.example/expand-1.png',
      metadata: { mode: 'expand' },
    })
    mockGetCreditCost.mockReturnValue(1)
    mockAssertCanAfford.mockResolvedValue(10)
    mockDebit.mockResolvedValue({ cost: 1, balanceAfter: 9, ledgerId: 'led-1' })
    mockAssertDishNotBlocked.mockImplementation(() => undefined)
    mockRecordSuccess.mockResolvedValue(undefined)
    mockIsBillable.mockReturnValue(true)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
    expect(mockPersist).not.toHaveBeenCalled()
    expect(mockDebit).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller does not own the image', async () => {
    mockLoadOwnedDishSource.mockRejectedValue(new OwnedStudioSourceNotFoundError())
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(404)
    expect(mockPersist).not.toHaveBeenCalled()
  })

  it('returns 400 for an unknown preset', async () => {
    const res = await POST(makeRequest({ ...validBody, preset: 'huge' }))
    expect(res.status).toBe(400)
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('returns 429 when daily limit reached', async () => {
    mockGetLimit.mockReturnValue(5)
    mockCountToday.mockResolvedValue(5)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe('STUDIO_DAILY_LIMIT')
  })

  it('returns 402 when credits are insufficient', async () => {
    mockAssertCanAfford.mockRejectedValue(
      new StudioCreditsError('Insufficient Studio credits.', 'INSUFFICIENT_CREDITS', 402),
    )
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(402)
    expect((await res.json()).code).toBe('STUDIO_INSUFFICIENT_CREDITS')
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('returns 423 when dish is generation-blocked', async () => {
    mockAssertDishNotBlocked.mockImplementation(() => {
      throw new StudioDishBlockedError('paused', 5)
    })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(423)
    expect((await res.json()).code).toBe('STUDIO_DISH_GENERATION_BLOCKED')
  })

  it('pads, sends nearest Flash aspect, persists Gemini bytes, and debits', async () => {
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.imageId).toBe('expand-1')
    expect(json.credits).toEqual({ cost: 1, balanceAfter: 9 })
    expect(mockPadExpandCanvas).toHaveBeenCalledWith(expect.any(Buffer), 0.2)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: 'image/png',
        model: STUDIO_FLASH_MODEL,
        aspectRatio: '3:4',
        request_scope: 'studio_foh_mutation',
        sourceImageBase64: Buffer.from('padded').toString('base64'),
      }),
    )
    expect(mockPersist).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        dishId: 'dish-1',
        role: 'generated',
        sourceImageId: 'parent-1',
        imageBase64: Buffer.from('gemini').toString('base64'),
        metadata: expect.objectContaining({
          mode: 'expand',
          expand: { preset: 'balanced', padRatio: 0.2 },
          editorState: parentImage.metadata.editorState,
          extractionDiagnostics: parentImage.metadata.extractionDiagnostics,
          cost_credits: 1,
        }),
      }),
    )
    const persistedMeta = mockPersist.mock.calls[0][0].metadata as Record<string, unknown>
    expect(persistedMeta).not.toHaveProperty('objectEdit')
    expect(mockDebit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', cost: 1, studioImageId: 'expand-1' }),
    )
  })
})
