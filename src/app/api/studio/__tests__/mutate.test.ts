/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockComposePrompt = jest.fn()
const mockMutate = jest.fn()
const mockCountToday = jest.fn()
const mockPersist = jest.fn()
const mockGetLimit = jest.fn()
const mockGetStudioDish = jest.fn()
const mockSetCurrentImage = jest.fn()
const mockRunValidation = jest.fn()
const mockLoadStudioImageBytes = jest.fn()
const mockAssertCanAfford = jest.fn()
const mockDebit = jest.fn()
const mockGetCreditCost = jest.fn()
const mockAssertDishNotBlocked = jest.fn()
const mockRecordFailure = jest.fn()
const mockRecordSuccess = jest.fn()
const mockResolveStyles = jest.fn()
const mockIsBillable = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/photo-control/prompt-composer', () => ({
  composePrompt: (...args: unknown[]) => mockComposePrompt(...args),
}))

jest.mock('@/lib/photo-control/mutation-engine', () => ({
  getMutationEngine: () => ({
    mutate: (...args: unknown[]) => mockMutate(...args),
  }),
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

jest.mock('@/lib/studio/resolve-style-directives', () => ({
  resolveStyleDirectiveClauses: (...args: unknown[]) => mockResolveStyles(...args),
  mergeDirectiveWithStyleClauses: (directive: string, clauses: string[]) =>
    [...clauses, directive].filter(Boolean).join(' '),
}))

jest.mock('@/lib/studio/output-validation', () => ({
  runStudioOutputValidation: (...args: unknown[]) => mockRunValidation(...args),
  clientValidationPayload: (result: {
    status: string
    score: number
    summary: string
  }) => ({
    status: result.status,
    score: result.score,
    summary: result.summary,
  }),
  validationToMetadata: (result: unknown) => result,
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

import { NanoBananaError } from '@/lib/nano-banana'
import { StudioCreditsError } from '@/lib/studio/credits'
import { StudioDishBlockedError } from '@/lib/studio/generation-failures'
import { STUDIO_FLASH_MODEL, STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import { POST } from '../mutate/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/studio/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const tinyBase64 = Buffer.from('png').toString('base64')

const validBody = {
  dishId: 'dish-1',
  sourceImageId: 'src-1',
  originalState: {
    scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'bright-and-airy' },
    canvas: { background: '', background_style: '', main_vessel: '' },
    food_components: { main_item: 'burger', garnishes: [], sides: [] },
  },
  targetState: {
    scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'low-key' },
    canvas: { background: '', background_style: '', main_vessel: '' },
    food_components: { main_item: 'burger', garnishes: [], sides: [] },
  },
  directive: 'Change lighting to low-key',
}

describe('POST /api/studio/mutate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NANO_BANANA_API_KEY = 'test-key'
    mockGetLimit.mockReturnValue(25)
    mockCountToday.mockResolvedValue(0)
    mockGetStudioDish.mockResolvedValue({
      id: 'dish-1',
      name: 'Burger',
      generation_failure_count: 0,
      generation_blocked_at: null,
    })
    mockSetCurrentImage.mockResolvedValue({ id: 'dish-1' })
    mockComposePrompt.mockReturnValue({ ok: true, prompt: 'composed prompt' })
    mockMutate.mockResolvedValue({ imageBase64: Buffer.from('out').toString('base64') })
    mockPersist.mockResolvedValue({
      id: 'gen-1',
      dish_id: 'dish-1',
      public_url: 'https://cdn.example/gen-1.png',
    })
    mockRunValidation.mockResolvedValue({
      status: 'pass',
      score: 100,
      summary: 'Output looks consistent with the requested dish state.',
      dimensions: [],
    })
    mockLoadStudioImageBytes.mockResolvedValue({
      mimeType: 'image/png',
      base64: tinyBase64,
      byteLength: 3,
    })
    mockGetCreditCost.mockReturnValue(1)
    mockAssertCanAfford.mockResolvedValue(10)
    mockDebit.mockResolvedValue({ cost: 1, balanceAfter: 9, ledgerId: 'led-1' })
    mockAssertDishNotBlocked.mockImplementation(() => undefined)
    mockRecordSuccess.mockResolvedValue(undefined)
    mockIsBillable.mockReturnValue(true)
    mockResolveStyles.mockResolvedValue({})
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 429 when daily limit reached', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockGetLimit.mockReturnValue(5)
    mockCountToday.mockResolvedValue(5)

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.code).toBe('STUDIO_DAILY_LIMIT')
  })

  it('returns 402 when credits are insufficient', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockAssertCanAfford.mockRejectedValue(
      new StudioCreditsError('Insufficient Studio credits.', 'INSUFFICIENT_CREDITS', 402),
    )

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.code).toBe('STUDIO_INSUFFICIENT_CREDITS')
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('returns 423 when dish is generation-blocked', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockAssertDishNotBlocked.mockImplementation(() => {
      throw new StudioDishBlockedError('paused', 5)
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(423)
    const json = await res.json()
    expect(json.code).toBe('STUDIO_DISH_GENERATION_BLOCKED')
  })

  it('persists, debits credits, and returns public URL on success', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.imageId).toBe('gen-1')
    expect(json.imageUrl).toBe('https://cdn.example/gen-1.png')
    expect(json.credits).toEqual({ cost: 1, balanceAfter: 9 })
    expect(json.validation).toEqual({
      status: 'pass',
      score: 100,
      summary: 'Output looks consistent with the requested dish state.',
    })
    expect(mockPersist).toHaveBeenCalledWith(
      expect.objectContaining({
        dishId: 'dish-1',
        userId: 'user-1',
        metadata: expect.objectContaining({
          validation: expect.objectContaining({ status: 'pass' }),
          cost_credits: 1,
        }),
      }),
    )
    expect(mockDebit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cost: 1,
        studioImageId: 'gen-1',
      }),
    )
    expect(mockRecordSuccess).toHaveBeenCalledWith('user-1', 'dish-1')
    expect(mockLoadStudioImageBytes).toHaveBeenCalledWith('user-1', 'src-1')
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ model: STUDIO_FLASH_MODEL }),
    )
  })

  it('passes resolved style rows to the descriptor without stacking prohibition clauses', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockResolveStyles.mockResolvedValue({
      lightingStyle: {
        descriptor: {
          quality: 'clean studio light',
          temperature: 'neutral',
          shadows: 'soft',
          falloff: 'gradual',
        },
        short_description: 'Studio lighting',
        prompt_fragment: 'Use clean studio light.',
        negative_constraints: 'Do not add props.',
        thumbnail_path: null,
        name: 'Studio',
      },
    })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(200)
    const compositionInput = mockComposePrompt.mock.calls[0][0] as {
      directive: string
      descriptor: Record<string, unknown>
    }
    expect(compositionInput.directive).toBe(validBody.directive)
    expect(compositionInput.descriptor.target).toMatchObject({
      lighting: {
        quality: 'clean studio light',
        temperature: 'neutral',
        shadows: 'soft',
        falloff: 'gradual',
      },
    })
    expect(JSON.stringify(compositionInput.descriptor)).not.toContain('negative_constraints')
    expect(JSON.stringify(compositionInput.descriptor)).not.toContain('Do not add props.')
  })

  it('uses the canonical configured Pro model when explicitly requested', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(makeRequest({ ...validBody, model: STUDIO_PRO_MODEL }))

    expect(res.status).toBe(200)
    expect(mockGetCreditCost).toHaveBeenCalledWith(STUDIO_PRO_MODEL)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ model: STUDIO_PRO_MODEL }),
    )
  })

  it('records billable provider failure without debiting', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockMutate.mockRejectedValue(new NanoBananaError('blocked', 'NO_IMAGE_PRODUCED', 502))
    mockRecordFailure.mockResolvedValue({
      id: 'dish-1',
      generation_failure_count: 1,
      generation_blocked_at: null,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(502)
    expect(mockDebit).not.toHaveBeenCalled()
    expect(mockRecordFailure).toHaveBeenCalledWith('user-1', 'dish-1', 'NO_IMAGE_PRODUCED')
  })

  it('still returns 200 when validation is skipped after extract error', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockRunValidation.mockResolvedValue({
      status: 'skipped',
      score: 0,
      summary: 'Output validation skipped after extract error.',
      dimensions: [],
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.imageId).toBe('gen-1')
    expect(json.validation.status).toBe('skipped')
  })

  it('returns 400 when dishId is missing', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const { dishId: _omit, ...withoutDish } = validBody
    const res = await POST(makeRequest(withoutDish))
    expect(res.status).toBe(400)
  })
})
