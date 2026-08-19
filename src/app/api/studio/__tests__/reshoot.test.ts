/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockComposePrompt = jest.fn()
const mockMutate = jest.fn()
const mockPersist = jest.fn()
const mockLoadStudioImageBytes = jest.fn()
const mockGuard = jest.fn()
const mockFinalise = jest.fn()
const mockMapError = jest.fn()
const mockResolveStyles = jest.fn()
const mockRunValidation = jest.fn()
const mockBuildReshootDescriptor = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/photo-control/prompt-composer', () => ({
  composePrompt: (...args: unknown[]) => mockComposePrompt(...args),
}))

jest.mock('@/lib/photo-control/scene-descriptor', () => ({
  buildReshootDescriptor: (...args: unknown[]) => mockBuildReshootDescriptor(...args),
}))

jest.mock('@/lib/photo-control/mutation-engine', () => ({
  getMutationEngine: () => ({
    mutate: (...args: unknown[]) => mockMutate(...args),
  }),
}))

jest.mock('@/lib/studio/image-bytes', () => ({
  loadStudioImageBytes: (...args: unknown[]) => mockLoadStudioImageBytes(...args),
}))

jest.mock('@/lib/studio/generation-request', () => ({
  guardStudioGeneration: (...args: unknown[]) => mockGuard(...args),
  finaliseStudioGeneration: (...args: unknown[]) => mockFinalise(...args),
  mapStudioGenerationError: (...args: unknown[]) => mockMapError(...args),
}))

jest.mock('@/lib/studio/reference-libraries', () => ({
  resolveStylesByKeys: (...args: unknown[]) => mockResolveStyles(...args),
}))

jest.mock('@/lib/studio/output-validation', () => ({
  runStudioOutputValidation: (...args: unknown[]) => mockRunValidation(...args),
  validationToMetadata: (result: unknown) => result,
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { NextResponse } from 'next/server'
import { STUDIO_FLASH_MODEL } from '@/lib/studio/model-config'
import { POST } from '../reshoot/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/studio/reshoot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  dishId: 'dish-1',
  sourceImageId: 'src-1',
  baseState: {
    scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'bright-and-airy', spin: '0' },
    canvas: { background: '', background_style: '', surface_style: '', main_vessel: 'plate' },
    food_components: { main_item: 'burger', garnishes: [], sides: [] },
  },
  improvePlating: true,
}

describe('POST /api/studio/reshoot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NANO_BANANA_API_KEY = 'test-key'
    mockComposePrompt.mockReturnValue({ ok: true, prompt: 'reshoot prompt' })
    mockBuildReshootDescriptor.mockReturnValue({ task: 'reshoot', subject: { locked: [] } })
    mockMutate.mockResolvedValue({ imageBase64: Buffer.from('out').toString('base64') })
    mockRunValidation.mockResolvedValue({
      status: 'pass',
      score: 100,
      summary: 'ok',
      dimensions: [],
    })
    mockLoadStudioImageBytes.mockResolvedValue({
      mimeType: 'image/png',
      base64: Buffer.from('png').toString('base64'),
      byteLength: 3,
    })
    mockResolveStyles.mockResolvedValue({
      lightingStyle: { descriptor: { quality: 'studio' } },
      backgroundStyle: { descriptor: { material: 'grey' } },
      surfaceStyle: { descriptor: { material: 'cloth' } },
    })
    mockFinalise.mockResolvedValue({
      record: { id: 'gen-1', dish_id: 'dish-1', public_url: 'https://cdn.example/gen-1.png' },
      debit: { cost: 1, balanceAfter: 9 },
    })
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
    mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'user-1' } })
    mockGuard.mockResolvedValue(
      NextResponse.json({ code: 'STUDIO_DAILY_LIMIT' }, { status: 429 }),
    )

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
  })

  it('returns 402 when credits are insufficient', async () => {
    mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'user-1' } })
    mockGuard.mockResolvedValue(
      NextResponse.json({ code: 'STUDIO_INSUFFICIENT_CREDITS' }, { status: 402 }),
    )

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(402)
  })

  it('returns 423 when dish is generation-blocked', async () => {
    mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'user-1' } })
    mockGuard.mockResolvedValue(
      NextResponse.json({ code: 'STUDIO_DISH_GENERATION_BLOCKED' }, { status: 423 }),
    )

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(423)
  })

  it('persists reshoot metadata and uses the source as sole reference', async () => {
    mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'user-1' } })
    mockGuard.mockResolvedValue({
      creditCost: 1,
      requestedModel: STUDIO_FLASH_MODEL,
      usedToday: 0,
      dailyLimit: 25,
      dish: { id: 'dish-1' },
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        request_scope: 'studio_foh_mutation',
        styleReferences: [],
        model: STUDIO_FLASH_MODEL,
      }),
    )
    expect(mockFinalise).toHaveBeenCalledWith(
      expect.objectContaining({
        persistInput: expect.objectContaining({
          sourceImageId: 'src-1',
          metadata: expect.objectContaining({
            mode: 'reshoot',
            improvePlating: true,
            reshotFrom: 'src-1',
          }),
        }),
      }),
    )
    expect(mockRunValidation).toHaveBeenCalledWith(
      expect.objectContaining({
        stagedFields: expect.arrayContaining([
          'lighting',
          'background_style',
          'surface_style',
          'angle',
          'framing',
        ]),
      }),
    )
  })
})
