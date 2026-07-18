/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireUserApi = jest.fn()
const mockComposePrompt = jest.fn()
const mockMutate = jest.fn()
const mockCountToday = jest.fn()
const mockPersist = jest.fn()
const mockGetLimit = jest.fn()

jest.mock('@/lib/user-api-auth', () => ({
  requireUserApi: () => mockRequireUserApi(),
}))

jest.mock('@/lib/photo-control/prompt-composer', () => ({
  composePrompt: (...args: unknown[]) => mockComposePrompt(...args),
}))

jest.mock('@/lib/photo-control/mutation-engine', () => ({
  getMutationEngine: () => ({
    mutate: (...args: unknown[]) => mockMutate(...args),
  }),
}))

jest.mock('@/lib/studio/persistence', () => ({
  countTodayGeneratedStudioImages: (...args: unknown[]) => mockCountToday(...args),
  getStudioDailyGenerationLimit: () => mockGetLimit(),
  persistStudioImage: (...args: unknown[]) => mockPersist(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

import { POST } from '../mutate/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/studio/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const tinyPng = `data:image/png;base64,${Buffer.from('png').toString('base64')}`

const validBody = {
  sourceImageDataUrl: tinyPng,
  originalState: {
    scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'bright-and-airy' },
    canvas: { background: '', main_vessel: '' },
    food_components: { main_item: 'burger', garnishes: [], sides: [] },
  },
  targetState: {
    scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'low-key' },
    canvas: { background: '', main_vessel: '' },
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
    mockComposePrompt.mockReturnValue({ ok: true, prompt: 'composed prompt' })
    mockMutate.mockResolvedValue({ imageBase64: Buffer.from('out').toString('base64') })
    mockPersist.mockResolvedValue({
      id: 'gen-1',
      public_url: 'https://cdn.example/gen-1.png',
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireUserApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 429 when daily limit reached', async () => {
    mockRequireUserApi.mockResolvedValue({
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

  it('persists and returns public URL on success', async () => {
    mockRequireUserApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.imageId).toBe('gen-1')
    expect(json.imageUrl).toBe('https://cdn.example/gen-1.png')
    expect(mockPersist).toHaveBeenCalled()
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-3.1-flash-image-preview' }),
    )
  })
})
