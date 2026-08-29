/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockLoadStudioImageBytes = jest.fn()
const mockExtract = jest.fn()
const mockValidate = jest.fn()
const mockUpdateStudioImageMetadata = jest.fn()
const mockGetStudioImage = jest.fn()
const mockBuildSpatialInventory = jest.fn()
const mockPersistSpatialInventory = jest.fn()

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

jest.mock('@/lib/studio/library', () => ({
  getStudioImage: (...args: unknown[]) => mockGetStudioImage(...args),
  updateStudioImageMetadata: (...args: unknown[]) => mockUpdateStudioImageMetadata(...args),
}))

jest.mock('@/lib/studio/object-edit/spatial-inventory', () => ({
  buildSpatialInventory: (...args: unknown[]) => mockBuildSpatialInventory(...args),
  persistSpatialInventory: (...args: unknown[]) => mockPersistSpatialInventory(...args),
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

const canonicalData = { scene_setup: {}, canvas: {}, food_components: {} }
const inventory = {
  version: 1,
  imageId: '11111111-1111-4111-8111-111111111111',
  naturalWidth: 100,
  naturalHeight: 100,
  elements: [],
  extractedAt: '2026-01-01T00:00:00.000Z',
  extractorVersion: 'test',
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
    mockExtract.mockResolvedValue({ raw: canonicalData })
    mockValidate.mockReturnValue({
      strictConformance: true,
      data: canonicalData,
      warnings: [],
    })
    mockUpdateStudioImageMetadata.mockResolvedValue({})
    mockGetStudioImage.mockResolvedValue({ dish_id: 'dish-1', width: 100, height: 100 })
    mockBuildSpatialInventory.mockReturnValue(null)
    mockPersistSpatialInventory.mockResolvedValue(undefined)
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

  it('extracts by imageId without altering the canonical response shape', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(makeRequest({ imageId: 'img-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.strictConformance).toBe(true)
    expect(json.data).toEqual(canonicalData)
    expect(json.diagnostics.strictConformance).toBe(true)
    expect(Array.isArray(json.diagnostics.omittedFields)).toBe(true)
    expect(json.spatialInventory).toBeUndefined()
    expect(mockLoadStudioImageBytes).toHaveBeenCalledWith('user-1', 'img-1')
    expect(mockUpdateStudioImageMetadata).toHaveBeenCalledWith(
      'user-1',
      'img-1',
      expect.objectContaining({ extractionDiagnostics: expect.any(Object) }),
    )
    expect(mockExtract).toHaveBeenCalled()
  })

  it('returns optional spatial inventory separately after its own persistence succeeds', async () => {
    mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'user-1' }, supabase: {} })
    mockExtract.mockResolvedValue({ raw: { ...canonicalData, spatial_inventory: { elements: [] } } })
    mockBuildSpatialInventory.mockReturnValue(inventory)

    const res = await POST(makeRequest({ imageId: 'img-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual(canonicalData)
    expect(json.spatialInventory).toEqual(inventory)
    expect(mockPersistSpatialInventory).toHaveBeenCalledWith({
      userId: 'user-1', dishId: 'dish-1', inventory,
    })
  })

  it('preserves canonical success and hides spatial data when spatial persistence fails', async () => {
    mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'user-1' }, supabase: {} })
    mockExtract.mockResolvedValue({ raw: { ...canonicalData, spatial_inventory: { elements: [] } } })
    mockBuildSpatialInventory.mockReturnValue(inventory)
    mockPersistSpatialInventory.mockRejectedValue(new Error('inventory database unavailable'))

    const res = await POST(makeRequest({ imageId: 'img-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toEqual(canonicalData)
    expect(json.spatialInventory).toBeUndefined()
    expect(mockUpdateStudioImageMetadata).toHaveBeenCalledWith(
      'user-1',
      'img-1',
      expect.objectContaining({
        spatialInventoryDiagnostics: { version: 1, status: 'persistence_failed' },
      }),
    )
  })

  it('does not fail extraction when diagnostics metadata persistence fails', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockUpdateStudioImageMetadata.mockRejectedValueOnce(new Error('metadata unavailable'))

    const res = await POST(makeRequest({ imageId: 'img-1' }))
    expect(res.status).toBe(200)
  })
})
