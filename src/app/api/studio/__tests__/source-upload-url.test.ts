/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockCreateSignedUploadUrl = jest.fn()
const mockGetPublicUrl = jest.fn()
const mockRemove = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl: (...args: unknown[]) => mockCreateSignedUploadUrl(...args),
        getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
        remove: (...args: unknown[]) => mockRemove(...args),
      }),
    },
  }),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST, DELETE } from '../source/upload-url/route'

function makeRequest(method: string, body: unknown) {
  return new NextRequest('http://localhost:3000/api/studio/source/upload-url', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/studio/source/upload-url', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example/user-1/studio/img.png' },
    })
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'https://cdn.example/upload?token=abc' },
      error: null,
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest('POST', { mimeType: 'image/png' }))
    expect(res.status).toBe(401)
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid mime type', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(makeRequest('POST', { mimeType: 'image/gif' }))
    expect(res.status).toBe(400)
  })

  it('issues a signed upload URL for the authenticated user', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(makeRequest('POST', { mimeType: 'image/png' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.imageId).toEqual(expect.any(String))
    expect(json.storagePath).toBe(`user-1/studio/${json.imageId}.png`)
    expect(json.signedUrl).toBe('https://cdn.example/upload?token=abc')
    expect(json.publicUrl).toBe('https://cdn.example/user-1/studio/img.png')
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(json.storagePath)
  })
})

describe('DELETE /api/studio/source/upload-url', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRemove.mockResolvedValue({ data: null, error: null })
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
  })

  it('rejects a storage path owned by another user', async () => {
    const res = await DELETE(
      makeRequest('DELETE', { storagePath: 'other-user/studio/img-1.png' }),
    )
    expect(res.status).toBe(403)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('removes a path owned by the authenticated user', async () => {
    const res = await DELETE(
      makeRequest('DELETE', { storagePath: 'user-1/studio/img-1.png' }),
    )
    expect(res.status).toBe(200)
    expect(mockRemove).toHaveBeenCalledWith(['user-1/studio/img-1.png'])
  })
})
