/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockLoadStudioImageBytes = jest.fn()
const mockExtract = jest.fn()
const mockValidate = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
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

jest.mock('@/lib/photo-control/gemini-extraction-client', () => ({
  GeminiExtractionClient: jest.fn().mockImplementation(() => ({
    extract: (...args: unknown[]) => mockExtract(...args),
  })),
  UnparseableExtractionResponseError: class UnparseableExtractionResponseError extends Error {
    code = 'UNPARSEABLE_EXTRACTION_RESPONSE'
  },
}))

jest.mock('@/lib/photo-control/schema-validator', () => ({
  MinimalSchemaValidator: jest.fn().mockImplementation(() => ({
    validate: (...args: unknown[]) => mockValidate(...args),
  })),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST } from '../extract/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/studio/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/studio/extract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NANO_BANANA_API_KEY = 'test-key'
    mockLoadStudioImageBytes.mockResolvedValue({
      mimeType: 'image/png',
      base64: Buffer.from('png').toString('base64'),
      byteLength: 3,
    })
    mockExtract.mockResolvedValue({ raw: { scene_setup: {}, canvas: {}, food_components: {} } })
    mockValidate.mockReturnValue({
      strictConformance: true,
      data: { scene_setup: {}, canvas: {}, food_components: {} },
      warnings: [],
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest({ imageId: 'img-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when imageId is missing', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('extracts by imageId', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(makeRequest({ imageId: 'img-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.strictConformance).toBe(true)
    expect(mockLoadStudioImageBytes).toHaveBeenCalledWith('user-1', 'img-1')
    expect(mockExtract).toHaveBeenCalled()
  })
})
