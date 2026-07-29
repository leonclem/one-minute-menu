/** @jest-environment node */

import fc from 'fast-check'
import { POST as postAdminGemini } from '@/app/api/admin/generate-gemini-image/route'
import { POST as postAdminGeneral } from '@/app/api/admin/generate-general-image/route'
import { POST as postAdminPro } from '@/app/api/admin/generate-gemini-3-pro-image/route'
import { requireAdminApi } from '@/lib/admin-api-auth'
import {
  buildApiParams,
  recordedAspectRatioFor,
  type ExecutableImageGenerationJob,
} from '@/lib/image-generation/job-executor'
import {
  buildGeminiRequest,
  getNanoBananaClient,
  NanoBananaClient,
} from '@/lib/nano-banana'
import { MutationEngine } from '@/lib/photo-control/mutation-engine'
import type { NanoBananaParams } from '@/types'

jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: jest.fn(),
}))

// The worker helpers are pure; isolate the unrelated service singleton created by its module graph.
jest.mock('@/lib/image-processing', () => ({
  ImageProcessingService: class ImageProcessingService {},
}))

jest.mock('@/lib/nano-banana', () => {
  const actual = jest.requireActual<typeof import('@/lib/nano-banana')>('@/lib/nano-banana')
  return { ...actual, getNanoBananaClient: jest.fn() }
})

const mockRequireAdminApi = jest.mocked(requireAdminApi)
const mockGetNanoBananaClient = jest.mocked(getNanoBananaClient)
const REQUEST_OPTIONS = {
  apiKey: 'preservation-test-key',
  baseUrl: 'https://api.test.nanobanana.com/v1/generateContent',
}

const FLASH_ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const
const PRO_ASPECT_RATIOS = [...FLASH_ASPECT_RATIOS, '21:9', '2:3', '3:2', '4:5', '5:4'] as const
const IMAGE_SIZES = ['1K', '2K', '4K'] as const

type AdminRoute = (request: { json: () => Promise<unknown> }) => Promise<Response>

function requestBodyFor(params: NanoBananaParams) {
  return buildGeminiRequest(params, REQUEST_OPTIONS).requestBody
}

async function captureAdminParams(route: AdminRoute, body: Record<string, unknown>): Promise<NanoBananaParams> {
  const generateImage = jest.fn().mockResolvedValue({
    images: ['preservation-image'],
    metadata: { processingTime: 1, modelVersion: 'preservation-model' },
  })
  mockRequireAdminApi.mockResolvedValue({ ok: true, supabase: {}, user: { id: 'admin-test' } } as any)
  mockGetNanoBananaClient.mockReturnValue({ generateImage } as any)

  const response = await route({ json: async () => body })
  expect(response.status).toBe(200)
  expect(generateImage).toHaveBeenCalledTimes(1)
  return generateImage.mock.calls[0][0] as NanoBananaParams
}

function references(count: number): NonNullable<NanoBananaParams['reference_images']> {
  return Array.from({ length: count }, (_, index) => ({
    mimeType: 'image/png' as const,
    data: Buffer.from(`reference-${index + 1}`).toString('base64'),
    role: index === 0 ? 'dish' : 'style',
  }))
}

const replayJobWithoutAspectRatio: ExecutableImageGenerationJob = {
  id: 'replay-job',
  user_id: 'user-id',
  menu_id: 'menu-id',
  menu_item_id: 'item-id',
  prompt: 'A square worker replay menu tile',
  negative_prompt: 'people',
  api_params: { model: 'gemini-2.5-flash-image', image_size: '2K' },
  number_of_variations: 2,
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NANO_BANANA_API_KEY = 'preservation-test-key'
})

afterAll(() => {
  delete process.env.NANO_BANANA_API_KEY
})

describe('pre-fix golden snapshots for non-Studio requests', () => {
  it('preserves explicit square imageConfig values for legacy generate-image and batch requests', () => {
    const legacyParams = {
      prompt: 'A menu tile for legacy generate-image.',
      negative_prompt: 'hands',
      aspect_ratio: '1:1',
      number_of_images: 2,
      safety_filter_level: 'block_some' as const,
      person_generation: 'dont_allow' as const,
      context: 'food' as const,
    }

    const batchParams = {
      ...legacyParams,
      prompt: 'A menu tile for legacy batch generation.',
      number_of_images: 1,
    }

    const requestBodies = {
      '/api/generate-image': requestBodyFor(legacyParams),
      '/api/image-generation/batches': requestBodyFor(batchParams),
    }

    for (const requestBody of Object.values(requestBodies)) {
      const imageConfig = (requestBody.generationConfig as { imageConfig: Record<string, unknown> }).imageConfig
      expect(imageConfig.aspectRatio).toBe('1:1')
    }
    expect(requestBodies).toMatchSnapshot()
  })

  /** **Validates: Requirements 3.1** */
  it('replays legacy jobs without a persisted ratio as explicit square requests with matching metadata', () => {
    const apiParams = buildApiParams(replayJobWithoutAspectRatio)
    const requestBody = requestBodyFor(apiParams)
    const imageConfig = (requestBody.generationConfig as { imageConfig: Record<string, unknown> }).imageConfig

    expect(apiParams.aspect_ratio).toBe('1:1')
    expect(imageConfig.aspectRatio).toBe(apiParams.aspect_ratio)
    expect(recordedAspectRatioFor(apiParams)).toBe(apiParams.aspect_ratio)
  })
})

describe('pre-fix golden snapshots for admin sandboxes', () => {
  it('preserves every valid admin route aspect ratio and Pro image-size token', async () => {
    const adminGemini: Record<string, Record<string, unknown>> = {}
    for (const aspectRatio of FLASH_ASPECT_RATIOS) {
      adminGemini[aspectRatio] = requestBodyFor(await captureAdminParams(postAdminGemini, {
        prompt: `Admin Gemini ${aspectRatio}`,
        aspectRatio,
      }))
    }

    const adminGeneral: Record<string, Record<string, unknown>> = {}
    for (const aspectRatio of FLASH_ASPECT_RATIOS) {
      adminGeneral[aspectRatio] = requestBodyFor(await captureAdminParams(postAdminGeneral, {
        prompt: `Admin general ${aspectRatio}`,
        aspectRatio,
      }))
    }

    const adminPro: Record<string, Record<string, unknown>> = {}
    for (const aspectRatio of PRO_ASPECT_RATIOS) {
      for (const imageSize of IMAGE_SIZES) {
        adminPro[`${aspectRatio}-${imageSize}`] = requestBodyFor(await captureAdminParams(postAdminPro, {
          prompt: `Admin Pro ${aspectRatio} ${imageSize}`,
          aspectRatio,
          imageSize,
        }))
      }
    }

    for (const [aspectRatio, requestBody] of Object.entries(adminGemini)) {
      expect((requestBody.generationConfig as any).imageConfig.aspectRatio).toBe(aspectRatio)
    }
    for (const [aspectRatio, requestBody] of Object.entries(adminGeneral)) {
      expect((requestBody.generationConfig as any).imageConfig.aspectRatio).toBe(aspectRatio)
    }
    for (const [key, requestBody] of Object.entries(adminPro)) {
      const [aspectRatio, imageSize] = key.split(/-(?=\dK$)/)
      expect((requestBody.generationConfig as any).imageConfig).toMatchObject({ aspectRatio, imageSize })
    }

    expect({ adminGemini, adminGeneral, adminPro }).toMatchSnapshot()
  })
})

describe('pre-fix golden snapshots for Pro and person-generation behavior', () => {
  it('preserves a Pro Studio request without thinkingLevel and with all fourteen references', () => {
    const params: NanoBananaParams = {
      prompt: 'Preserve the plated dish while applying the selected Studio edit.',
      model: 'gemini-3-pro-image',
      aspect_ratio: '4:3',
      image_size: '4K',
      number_of_images: 1,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      thinking_level: 'high',
      reference_images: references(14),
      reference_mode: 'composite',
    }
    const requestBody = requestBodyFor(params)
    const generationConfig = requestBody.generationConfig as { thinkingLevel?: string }
    const parts = (requestBody.contents as Array<{ parts: unknown[] }>)[0].parts

    expect(generationConfig).not.toHaveProperty('thinkingLevel')
    expect(parts).toHaveLength(15)
    const client = new NanoBananaClient('preservation-test-key')
    expect(() => (client as any).validateParams(params)).not.toThrow()
    expect(() => (client as any).validateParams({ ...params, reference_images: references(15) })).toThrow(
      'Too many reference images (max 14 for gemini-3-pro-image)'
    )
    expect(requestBody).toMatchSnapshot()
  })

  it('preserves the exact no-people instruction', () => {
    const requestBody = requestBodyFor({
      prompt: 'A plated menu dish.',
      person_generation: 'dont_allow',
      safety_filter_level: 'block_none',
    })
    const prompt = ((requestBody.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts[0].text)

    expect(prompt).toContain('\nNo people in the image.')
    expect(requestBody).toMatchSnapshot()
  })
})

/**
 * Pre-change record only — deliberately not a snapshot to reproduce after Group B:
 * a lighting-only customer Studio request currently sends the source in slot 1,
 * the lighting swatch in slot 2, and the opportunistic steering-angle table in slot 3.
 */
describe('customer Studio source invariants', () => {
  it('keeps the source in slot 1 without downscaling it', async () => {
    const sourceImageBase64 = Buffer.from('customer-studio-source-image').toString('base64')
    const lightingSwatchBase64 = Buffer.from('lighting-only-swatch').toString('base64')
    const generateImage = jest.fn().mockResolvedValue({
      images: ['mutated-image'],
      metadata: { processingTime: 1, modelVersion: 'gemini-3.1-flash-image-preview' },
    })
    mockGetNanoBananaClient.mockReturnValue({ generateImage } as any)

    await new MutationEngine().mutate({
      sourceImageBase64,
      mimeType: 'image/jpeg',
      prompt: 'Apply only studio lighting while preserving the dish.',
      styleReferences: [{
        data: lightingSwatchBase64,
        mimeType: 'image/png',
        role: 'style',
      }],
    })

    const params = generateImage.mock.calls[0][0] as NanoBananaParams
    const source = params.reference_images?.[0]
    expect(source).toEqual(expect.objectContaining({
      data: sourceImageBase64,
      mimeType: 'image/jpeg',
      role: 'dish',
    }))
  })
})

describe('Property 10: non-Studio and Pro request preservation', () => {
  /** **Validates: Requirements 3.1, 3.3, 3.4, 3.12** */
  it('preserves the unfixed request-body contract across configured request inputs', () => {
    const requestInputs = fc.record({
      model: fc.option(fc.constantFrom(
        'gemini-2.5-flash-image',
        'gemini-3.1-flash-image-preview',
        'gemini-3.1-flash-image',
        'gemini-3-pro-image',
        'gemini-3-pro-image-preview',
        'legacy-image-model'
      ), { nil: undefined }),
      aspectRatio: fc.option(fc.constantFrom(...PRO_ASPECT_RATIOS), { nil: undefined }),
      imageSize: fc.option(fc.constantFrom(...IMAGE_SIZES), { nil: undefined }),
      referenceCount: fc.integer({ min: 0, max: 14 }),
      personGeneration: fc.constantFrom<'allow' | 'dont_allow'>('allow', 'dont_allow'),
      safetyFilterLevel: fc.constantFrom<'block_none' | 'block_some' | 'block_most'>(
        'block_none', 'block_some', 'block_most'
      ),
      thinkingLevel: fc.option(fc.constantFrom<'high' | 'dynamic' | 'standard'>(
        'high', 'dynamic', 'standard'
      ), { nil: undefined }),
    })

    fc.assert(
      fc.property(requestInputs, (input) => {
        const params: NanoBananaParams = {
          prompt: 'Preservation property request.',
          model: input.model,
          aspect_ratio: input.aspectRatio,
          image_size: input.imageSize,
          reference_images: references(input.referenceCount),
          person_generation: input.personGeneration,
          safety_filter_level: input.safetyFilterLevel,
          thinking_level: input.thinkingLevel,
        }
        const requestBody = requestBodyFor(params)
        const generationConfig = requestBody.generationConfig as {
          imageConfig: { aspectRatio: string; imageSize: string }
          thinkingLevel?: string
        }
        const parts = (requestBody.contents as Array<{ parts: Array<{ text?: string; inlineData?: unknown }> }>)[0].parts
        const prompt = parts[0].text || ''
        const effectiveModel = input.model || 'gemini-3.1-flash-image-preview'

        expect(generationConfig.imageConfig).toEqual({
          aspectRatio: input.aspectRatio || '1:1',
          imageSize: input.imageSize || '1k',
        })
        expect(parts.filter(part => part.inlineData).length).toBe(input.referenceCount)
        expect(prompt.includes('No people in the image.')).toBe(input.personGeneration === 'dont_allow')
        expect(prompt).toContain(`Content safety: ${input.safetyFilterLevel}`)
        expect(generationConfig.thinkingLevel).toBe(
          input.thinkingLevel && !effectiveModel.includes('pro') && !effectiveModel.includes('flash')
            ? input.thinkingLevel.toUpperCase()
            : undefined
        )
      }),
      { numRuns: 50 }
    )
  })
})
