/**
 * @jest-environment node
 *
 * Property 11: Studio control-flow invariants are unchanged.
 * Observation-first baseline captured before the Studio metadata fixes.
 *
 * **Validates: Requirements 3.5, 3.6, 3.7, 3.13, 3.14, 3.15**
 */

import fc from 'fast-check'
import { NextRequest } from 'next/server'

const mockFetchJsonWithRetry = jest.fn()
const mockProviderGenerate = jest.fn()
const mockRequireStudioApi = jest.fn()
const mockComposePrompt = jest.fn()
const mockRouteMutate = jest.fn()
const mockCountToday = jest.fn()
const mockPersist = jest.fn()
const mockRegisterSource = jest.fn()
const mockGetLimit = jest.fn()
const mockGetStudioDish = jest.fn()
const mockSetCurrentImage = jest.fn()
const mockLoadStudioImageBytes = jest.fn()
const mockAssertCanAfford = jest.fn()
const mockDebit = jest.fn()
const mockGetCreditCost = jest.fn()
const mockAssertDishNotBlocked = jest.fn()
const mockRecordFailure = jest.fn()
const mockRecordSuccess = jest.fn()
const mockIsBillable = jest.fn()
const mockValidationExtract = jest.fn()

jest.mock('@/lib/retry', () => ({
  fetchJsonWithRetry: (...args: unknown[]) => mockFetchJsonWithRetry(...args),
  HttpError: class HttpError extends Error {
    status: number
    body?: unknown
    code?: string

    constructor(message: string, status: number, body?: unknown, code?: string) {
      super(message)
      this.name = 'HttpError'
      this.status = status
      this.body = body
      this.code = code
    }
  },
}))

jest.mock('@/lib/nano-banana', () => {
  const actual = jest.requireActual('@/lib/nano-banana')
  return {
    ...actual,
    getNanoBananaClient: () => ({
      generateImage: (...args: unknown[]) => mockProviderGenerate(...args),
    }),
  }
})

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/photo-control/prompt-composer', () => ({
  composePrompt: (...args: unknown[]) => mockComposePrompt(...args),
}))

jest.mock('@/lib/photo-control/mutation-engine', () => ({
  getMutationEngine: () => ({
    mutate: (...args: unknown[]) => mockRouteMutate(...args),
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
  registerStudioSourceImage: (...args: unknown[]) => mockRegisterSource(...args),
  StudioImageLoadError: class StudioImageLoadError extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.name = 'StudioImageLoadError'
      this.status = status
    }
  },
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
  resolveStyleDirectiveClauses: jest.fn(async () => ({ clauses: [] })),
  mergeDirectiveWithStyleClauses: (directive: string, clauses: string[]) =>
    [...clauses, directive].filter(Boolean).join(' '),
}))

jest.mock('@/lib/photo-control/gemini-extraction-client', () => ({
  GeminiExtractionClient: jest.fn().mockImplementation(() => ({
    extract: (...args: unknown[]) => mockValidationExtract(...args),
  })),
  UnparseableExtractionResponseError: class UnparseableExtractionResponseError extends Error {
    code = 'UNPARSEABLE_EXTRACTION_RESPONSE'
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { NanoBananaClient, NanoBananaError } from '@/lib/nano-banana'
import { HttpError } from '@/lib/retry'
import {
  MAX_IMAGE_BYTES,
  validateImageFileForUpload,
} from '@/lib/photo-control/image-uploader'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { scoreOutputAgainstExpected } from '@/lib/photo-control/output-validator'
import { validationToMetadata } from '@/lib/studio/output-validation'
import { POST as mutate } from '@/app/api/studio/mutate/route'
import { POST as source } from '@/app/api/studio/source/route'
import { POST as extract } from '@/app/api/studio/extract/route'

const tinyBase64 = Buffer.from('png').toString('base64')

function createSchema(): MinimalSchema {
  return {
    scene_setup: {
      angle: '45-degree',
      framing: 'close-up',
      lighting: 'low-key',
      spin: '0',
    },
    canvas: {
      background: 'white table',
      background_style: '',
      surface_style: '',
      main_vessel: 'ceramic plate',
    },
    food_components: { main_item: 'burger', garnishes: ['lettuce'], sides: ['fries'] },
  }
}

function createMutationBody(): Record<string, unknown> {
  const originalState = createSchema()
  originalState.scene_setup.lighting = 'bright-and-airy'

  return {
    dishId: 'dish-1',
    sourceImageId: 'source-1',
    originalState,
    targetState: createSchema(),
    directive: 'Change lighting to low-key',
  }
}

function request(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function configureSuccessfulRoutes(): void {
  mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'user-1' }, supabase: {} })
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
  mockRouteMutate.mockResolvedValue({ imageBase64: Buffer.from('output').toString('base64') })
  mockPersist.mockResolvedValue({
    id: 'generated-1',
    dish_id: 'dish-1',
    public_url: 'https://cdn.example/generated-1.png',
  })
  mockRegisterSource.mockResolvedValue({
    id: 'source-1',
    dish_id: 'dish-1',
    public_url: 'https://cdn.example/source-1.png',
  })
  mockLoadStudioImageBytes.mockResolvedValue({
    mimeType: 'image/png',
    base64: tinyBase64,
    byteLength: 3,
  })
  mockValidationExtract.mockResolvedValue({ raw: createSchema() })
  mockGetCreditCost.mockReturnValue(1)
  mockAssertCanAfford.mockResolvedValue(10)
  mockDebit.mockResolvedValue({ cost: 1, balanceAfter: 9, ledgerId: 'ledger-1' })
  mockAssertDishNotBlocked.mockImplementation(() => undefined)
  mockRecordFailure.mockResolvedValue({
    id: 'dish-1',
    generation_failure_count: 1,
    generation_blocked_at: null,
  })
  mockRecordSuccess.mockResolvedValue(undefined)
  mockIsBillable.mockReturnValue(true)
}

async function observeClientFailure(response: unknown): Promise<NanoBananaError> {
  const client = new NanoBananaClient('test-api-key')
  mockFetchJsonWithRetry.mockResolvedValueOnce(response)

  try {
    await client.generateImage({ prompt: 'preservation observation', aspect_ratio: '1:1' })
  } catch (error) {
    expect(error).toBeInstanceOf(NanoBananaError)
    return error as NanoBananaError
  }
  throw new Error('Expected provider observation to throw')
}

async function observeHttpFailure(status: number): Promise<NanoBananaError> {
  const client = new NanoBananaClient('test-api-key')
  mockFetchJsonWithRetry.mockRejectedValueOnce(new HttpError(`HTTP ${status}`, status))

  try {
    await client.generateImage({ prompt: 'preservation observation', aspect_ratio: '1:1' })
  } catch (error) {
    expect(error).toBeInstanceOf(NanoBananaError)
    return error as NanoBananaError
  }
  throw new Error('Expected HTTP observation to throw')
}

describe('Property 11: Studio control-flow preservation', () => {
  const originalValidationEnv = process.env.STUDIO_OUTPUT_VALIDATION_ENABLED

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NANO_BANANA_API_KEY = 'test-key'
    delete process.env.STUDIO_OUTPUT_VALIDATION_ENABLED
    configureSuccessfulRoutes()
  })

  afterAll(() => {
    if (originalValidationEnv === undefined) {
      delete process.env.STUDIO_OUTPUT_VALIDATION_ENABLED
    } else {
      process.env.STUDIO_OUTPUT_VALIDATION_ENABLED = originalValidationEnv
    }
  })

  /** **Validates: Requirements 3.5** */
  it.each([
    ['NO_IMAGE', 'CONTENT_POLICY_VIOLATION', 403],
    ['SAFETY', 'SAFETY_FILTER_BLOCKED', 403],
    ['MAX_TOKENS', 'GENERATION_FAILED', 400],
  ])(
    'preserves %s finish reason as NanoBananaError %s and HTTP %i',
    async (finishReason, expectedCode, expectedStatus) => {
      const error = await observeClientFailure({ candidates: [{ finishReason }] })
      expect(error.code).toBe(expectedCode)

      mockRouteMutate.mockRejectedValueOnce(error)
      const response = await mutate(request('/api/studio/mutate', createMutationBody()))
      expect(response.status).toBe(expectedStatus)
      expect((await response.json()).code).toBe(expectedCode)
    },
  )

  /** **Validates: Requirements 3.5** */
  it('preserves the empty-images guard as NO_IMAGE_PRODUCED and HTTP 502', async () => {
    const { MutationEngine: ActualMutationEngine } = jest.requireActual(
      '@/lib/photo-control/mutation-engine',
    ) as typeof import('@/lib/photo-control/mutation-engine')
    mockProviderGenerate.mockResolvedValueOnce({ images: [], metadata: {} })

    let emptyImageError: NanoBananaError | undefined
    try {
      await new ActualMutationEngine().mutate({
        sourceImageBase64: tinyBase64,
        mimeType: 'image/png',
        prompt: 'preservation observation',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(NanoBananaError)
      emptyImageError = error as NanoBananaError
    }

    expect(emptyImageError).toMatchObject({ code: 'NO_IMAGE_PRODUCED', status: 502 })
    mockRouteMutate.mockRejectedValueOnce(emptyImageError)
    const response = await mutate(request('/api/studio/mutate', createMutationBody()))
    expect(response.status).toBe(502)
    expect((await response.json()).code).toBe('NO_IMAGE_PRODUCED')
  })

  /** **Validates: Requirements 3.5** */
  it.each([
    [400, 'INVALID_PARAMS', 400],
    [401, 'AUTHENTICATION_ERROR', 401],
    [403, 'CONTENT_POLICY_VIOLATION', 403],
    [429, 'RATE_LIMIT_EXCEEDED', 429],
    [500, 'SERVICE_UNAVAILABLE', 503],
    [502, 'SERVICE_UNAVAILABLE', 503],
    [503, 'SERVICE_UNAVAILABLE', 503],
    [504, 'SERVICE_UNAVAILABLE', 503],
  ])(
    'preserves upstream HTTP %i as NanoBananaError %s and Studio HTTP %i',
    async (upstreamStatus, expectedCode, expectedStatus) => {
      const error = await observeHttpFailure(upstreamStatus)
      expect(error.code).toBe(expectedCode)

      mockRouteMutate.mockRejectedValueOnce(error)
      const response = await mutate(request('/api/studio/mutate', createMutationBody()))
      expect(response.status).toBe(expectedStatus)
      expect((await response.json()).code).toBe(expectedCode)
    },
  )

  /** **Validates: Requirements 3.6** */
  it('debits credits only after a successful persistence, preserves daily limits and the dish breaker', async () => {
    const success = await mutate(request('/api/studio/mutate', createMutationBody()))
    expect(success.status).toBe(200)
    expect(mockDebit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', cost: 1, studioImageId: 'generated-1' }),
    )

    jest.clearAllMocks()
    configureSuccessfulRoutes()
    mockGetLimit.mockReturnValueOnce(5)
    mockCountToday.mockResolvedValueOnce(5)
    const dailyLimit = await mutate(request('/api/studio/mutate', createMutationBody()))
    expect(dailyLimit.status).toBe(429)
    expect(await dailyLimit.json()).toMatchObject({ code: 'STUDIO_DAILY_LIMIT' })
    expect(mockDebit).not.toHaveBeenCalled()

    jest.clearAllMocks()
    configureSuccessfulRoutes()
    mockAssertDishNotBlocked.mockImplementationOnce(() => {
      const { StudioDishBlockedError } = jest.requireMock('@/lib/studio/generation-failures')
      throw new StudioDishBlockedError('paused', 5)
    })
    const blocked = await mutate(request('/api/studio/mutate', createMutationBody()))
    expect(blocked.status).toBe(423)
    expect(await blocked.json()).toMatchObject({ code: 'STUDIO_DISH_GENERATION_BLOCKED' })
    expect(mockDebit).not.toHaveBeenCalled()
  })

  /** **Validates: Requirements 3.6** */
  it('records a billable provider failure without debiting credits', async () => {
    mockRouteMutate.mockRejectedValueOnce(
      new NanoBananaError('provider completed without an image', 'NO_IMAGE_PRODUCED', 502),
    )
    mockRecordFailure.mockResolvedValueOnce({
      id: 'dish-1',
      generation_failure_count: 1,
      generation_blocked_at: null,
    })

    const response = await mutate(request('/api/studio/mutate', createMutationBody()))
    expect(response.status).toBe(502)
    expect(mockRecordFailure).toHaveBeenCalledWith('user-1', 'dish-1', 'NO_IMAGE_PRODUCED')
    expect(mockDebit).not.toHaveBeenCalled()
  })

  /** **Validates: Requirements 3.7** */
  it('normalizes every combination of missing legacy spin and style fields without throwing', async () => {
    const fieldCombinations = [
      { spin: false, background_style: false, surface_style: false },
      { spin: true, background_style: false, surface_style: false },
      { spin: false, background_style: true, surface_style: false },
      { spin: false, background_style: false, surface_style: true },
      { spin: true, background_style: true, surface_style: false },
      { spin: true, background_style: false, surface_style: true },
      { spin: false, background_style: true, surface_style: true },
      { spin: true, background_style: true, surface_style: true },
    ] as const

    const everyCombination = fc.uniqueArray(fc.constantFrom(...fieldCombinations), {
      minLength: fieldCombinations.length,
      maxLength: fieldCombinations.length,
      selector: (fields) => `${fields.spin}:${fields.background_style}:${fields.surface_style}`,
    })

    await fc.assert(
      fc.asyncProperty(everyCombination, async (combinations) => {
        for (const missing of combinations) {
          jest.clearAllMocks()
          configureSuccessfulRoutes()
          const body = createMutationBody() as {
            originalState: MinimalSchema
            targetState: MinimalSchema
          } & Record<string, unknown>

          for (const state of [body.originalState, body.targetState]) {
            if (missing.spin) delete state.scene_setup.spin
            if (missing.background_style) delete state.canvas.background_style
            if (missing.surface_style) delete state.canvas.surface_style
          }

          const response = await mutate(request('/api/studio/mutate', body))
          expect(response.status).toBe(200)
          const compositionInput = mockComposePrompt.mock.calls[0][0] as {
            originalState: MinimalSchema
            targetState: MinimalSchema
          }
          for (const state of [compositionInput.originalState, compositionInput.targetState]) {
            expect(state.scene_setup.spin).toBe('0')
            expect(state.canvas.background_style).toBe('')
            expect(state.canvas.surface_style).toBe('')
          }
        }
      }),
      { numRuns: 20 },
    )
  })

  /** **Validates: Requirements 3.13** */
  it('skips validation when disabled and keeps validation failures soft for saving and downloading', async () => {
    process.env.STUDIO_OUTPUT_VALIDATION_ENABLED = 'false'
    const disabled = await mutate(request('/api/studio/mutate', createMutationBody()))
    expect(disabled.status).toBe(200)
    expect((await disabled.json())).toMatchObject({
      imageId: 'generated-1',
      imageUrl: 'https://cdn.example/generated-1.png',
      validation: { status: 'skipped' },
    })
    expect(mockValidationExtract).not.toHaveBeenCalled()
    expect(mockPersist).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          validation: expect.objectContaining({ status: 'skipped' }),
        }),
      }),
    )

    jest.clearAllMocks()
    delete process.env.STUDIO_OUTPUT_VALIDATION_ENABLED
    configureSuccessfulRoutes()
    mockValidationExtract.mockRejectedValueOnce(new Error('validation extract failed'))
    const softFailure = await mutate(request('/api/studio/mutate', createMutationBody()))
    expect(softFailure.status).toBe(200)
    expect((await softFailure.json())).toMatchObject({
      imageId: 'generated-1',
      imageUrl: 'https://cdn.example/generated-1.png',
      validation: { status: 'skipped' },
    })
    expect(mockPersist).toHaveBeenCalled()
    expect(mockDebit).toHaveBeenCalled()
  })

  /** **Validates: Requirements 3.14** */
  it('keeps identity dimensions deterministic and persists the same validation metadata', async () => {
    const expected = createSchema()
    const actual = createSchema()
    const first = scoreOutputAgainstExpected(expected, actual)
    const second = scoreOutputAgainstExpected(expected, actual)
    const identityDimensionIds = [
      'dish_identity',
      'item_count',
      'vessel',
      'unexpected_additions',
    ]

    for (const id of identityDimensionIds) {
      expect(first.dimensions.find((dimension) => dimension.id === id)).toEqual(
        second.dimensions.find((dimension) => dimension.id === id),
      )
    }

    const response = await mutate(request('/api/studio/mutate', createMutationBody()))
    expect(response.status).toBe(200)
    expect(mockPersist).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          validation: validationToMetadata(first),
        }),
      }),
    )
  })

  /** **Validates: Requirements 3.15** */
  it('keeps a direct-upload imageId usable through source, extract, and mutation and enforces 9 MiB', async () => {
    const imageId = 'direct-upload-image-1'
    mockRegisterSource.mockResolvedValueOnce({
      id: imageId,
      dish_id: 'dish-1',
      public_url: `https://cdn.example/${imageId}.png`,
    })

    const sourceResponse = await source(
      request('/api/studio/source', { imageId, dishId: 'dish-1', mimeType: 'image/png' }),
    )
    expect(sourceResponse.status).toBe(200)
    expect((await sourceResponse.json()).imageId).toBe(imageId)

    const extractResponse = await extract(request('/api/studio/extract', { imageId }))
    expect(extractResponse.status).toBe(200)
    expect(mockLoadStudioImageBytes).toHaveBeenCalledWith('user-1', imageId)

    const mutationBody = createMutationBody()
    mutationBody.sourceImageId = imageId
    const mutateResponse = await mutate(request('/api/studio/mutate', mutationBody))
    expect(mutateResponse.status).toBe(200)
    expect(mockLoadStudioImageBytes).toHaveBeenLastCalledWith('user-1', imageId)

    expect(validateImageFileForUpload({ type: 'image/png', size: MAX_IMAGE_BYTES })).toEqual({
      ok: true,
      mimeType: 'image/png',
      bytes: MAX_IMAGE_BYTES,
    })
    expect(
      validateImageFileForUpload({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('9 MB') })
  })
})
