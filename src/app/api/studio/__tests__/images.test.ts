/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireUserApi = jest.fn()
const mockGetImage = jest.fn()
const mockFavourite = jest.fn()
const mockArchive = jest.fn()
const mockDelete = jest.fn()
const mockGetDish = jest.fn()
const mockListImages = jest.fn()

jest.mock('@/lib/user-api-auth', () => ({
  requireUserApi: () => mockRequireUserApi(),
}))

jest.mock('@/lib/studio/library', () => ({
  getStudioImage: (...args: unknown[]) => mockGetImage(...args),
  setStudioImageFavourite: (...args: unknown[]) => mockFavourite(...args),
  archiveStudioImage: (...args: unknown[]) => mockArchive(...args),
  deleteStudioImage: (...args: unknown[]) => mockDelete(...args),
  listStudioImagesForDish: (...args: unknown[]) => mockListImages(...args),
}))

jest.mock('@/lib/studio/dishes', () => ({
  getStudioDish: (...args: unknown[]) => mockGetDish(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { GET } from '../images/route'
import { PATCH, DELETE } from '../images/[imageId]/route'

describe('studio images API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireUserApi.mockResolvedValue({
      ok: true,
      user: { id: 'u1' },
      supabase: {},
    })
  })

  it('GET lists images for a dish', async () => {
    mockGetDish.mockResolvedValue({ id: 'dish-1' })
    mockListImages.mockResolvedValue([{ id: 'img-1' }])

    const req = new NextRequest('http://localhost/api/studio/images?dishId=dish-1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.images).toHaveLength(1)
  })

  it('PATCH favourites an image', async () => {
    mockGetImage.mockResolvedValue({ id: 'img-1' })
    mockFavourite.mockResolvedValue({ id: 'img-1', is_favourite: true })

    const req = new NextRequest('http://localhost/api/studio/images/img-1', {
      method: 'PATCH',
      body: JSON.stringify({ isFavourite: true }),
    })
    const res = await PATCH(req, { params: { imageId: 'img-1' } })
    expect(res.status).toBe(200)
    expect(mockFavourite).toHaveBeenCalledWith('u1', 'img-1', true)
  })

  it('PATCH archives an image', async () => {
    mockGetImage.mockResolvedValue({ id: 'img-1' })
    mockArchive.mockResolvedValue({ id: 'img-1', archived_at: '2026-07-18T00:00:00Z' })

    const req = new NextRequest('http://localhost/api/studio/images/img-1', {
      method: 'PATCH',
      body: JSON.stringify({ archive: true }),
    })
    const res = await PATCH(req, { params: { imageId: 'img-1' } })
    expect(res.status).toBe(200)
    expect(mockArchive).toHaveBeenCalled()
  })

  it('DELETE removes an image', async () => {
    mockGetImage.mockResolvedValue({ id: 'img-1' })
    mockDelete.mockResolvedValue(undefined)

    const req = new NextRequest('http://localhost/api/studio/images/img-1', {
      method: 'DELETE',
    })
    const res = await DELETE(req, { params: { imageId: 'img-1' } })
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith('u1', 'img-1')
  })
})
