/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockGetDish = jest.fn()
const mockLoadMatrix = jest.fn()
const mockGetImage = jest.fn()
const mockListForSource = jest.fn()
const mockGetBalance = jest.fn()
const mockResolveHeroDimensions = jest.fn()
const mockBuildTiles = jest.fn()
const mockHasInFlight = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/studio/dishes', () => ({
  getStudioDish: (...args: unknown[]) => mockGetDish(...args),
}))

jest.mock('@/lib/studio/dish-export-matrix', () => ({
  loadDishExportMatrix: (...args: unknown[]) => mockLoadMatrix(...args),
}))

jest.mock('@/lib/studio/library', () => ({
  getStudioImage: (...args: unknown[]) => mockGetImage(...args),
}))

jest.mock('@/lib/studio/export-variants', () => ({
  listExportVariantsForSource: (...args: unknown[]) => mockListForSource(...args),
  resolveHeroDimensions: (...args: unknown[]) => mockResolveHeroDimensions(...args),
  buildExportTiles: (...args: unknown[]) => mockBuildTiles(...args),
  hasInFlightExportTiles: (...args: unknown[]) => mockHasInFlight(...args),
  planExportVariant: jest.fn(),
  resolveExportMethodAvailability: jest.fn(),
  stageExportVariant: jest.fn(),
  completeExportVariant: jest.fn(),
  failExportVariant: jest.fn(),
  StudioExportError: class StudioExportError extends Error {
    code = 'STUDIO_EXPORT'
    status = 400
  },
}))

jest.mock('@/lib/studio/credits', () => ({
  getStudioCreditBalance: (...args: unknown[]) => mockGetBalance(...args),
  assertCanAffordStudioCredits: jest.fn(),
  StudioCreditsError: class StudioCreditsError extends Error {
    status = 402
  },
}))

jest.mock('@/lib/studio/image-bytes', () => ({
  loadStudioImageBytes: jest.fn(),
  StudioImageLoadError: class StudioImageLoadError extends Error {
    status = 404
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { GET } from '../exports/route'

describe('GET /api/studio/exports', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'u1' } })
  })

  it('returns 400 when neither dishId nor sourceImageId is supplied', async () => {
    const req = new NextRequest('http://localhost/api/studio/exports')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns the dish matrix without N-fetching per image', async () => {
    mockGetDish.mockResolvedValue({ id: 'd1' })
    mockLoadMatrix.mockResolvedValue({
      dishId: 'd1',
      shots: [{ imageId: 'og', tiles: [] }],
      pending: false,
      credits: { balance: 9 },
    })

    const req = new NextRequest('http://localhost/api/studio/exports?dishId=d1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.dishId).toBe('d1')
    expect(json.shots).toHaveLength(1)
    expect(mockLoadMatrix).toHaveBeenCalledWith('u1', 'd1')
    expect(mockGetImage).not.toHaveBeenCalled()
  })

  it('returns 404 when the dish does not belong to the user', async () => {
    mockGetDish.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/studio/exports?dishId=missing')
    const res = await GET(req)
    expect(res.status).toBe(404)
    expect(mockLoadMatrix).not.toHaveBeenCalled()
  })
})
