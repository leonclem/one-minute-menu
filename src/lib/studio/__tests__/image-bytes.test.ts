/**
 * @jest-environment node
 */

const mockGetStudioImage = jest.fn()
const mockDownload = jest.fn()

jest.mock('@/lib/studio/library', () => ({
  getStudioImage: (...args: unknown[]) => mockGetStudioImage(...args),
}))

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({
    storage: {
      from: () => ({
        download: (...args: unknown[]) => mockDownload(...args),
      }),
    },
  }),
}))

import {
  downloadStudioStorageObject,
  loadStudioImageBytes,
  StudioImageLoadError,
} from '../image-bytes'

describe('loadStudioImageBytes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetStudioImage.mockResolvedValue({
      id: 'img-1',
      storage_path: 'user-1/studio/img-1.png',
      mime_type: 'image/png',
    })
    mockDownload.mockResolvedValue({
      data: {
        arrayBuffer: async () => Buffer.from('png-bytes'),
      },
      error: null,
    })
  })

  it('loads bytes for an owned studio image', async () => {
    const result = await loadStudioImageBytes('user-1', 'img-1')
    expect(result.mimeType).toBe('image/png')
    expect(result.byteLength).toBeGreaterThan(0)
    expect(result.base64).toBeTruthy()
  })

  it('throws when image is not found', async () => {
    mockGetStudioImage.mockResolvedValue(null)
    await expect(loadStudioImageBytes('user-1', 'missing')).rejects.toBeInstanceOf(
      StudioImageLoadError,
    )
  })

  it('rejects storage paths outside the user folder', async () => {
    mockGetStudioImage.mockResolvedValue({
      id: 'img-1',
      storage_path: 'other-user/studio/img-1.png',
      mime_type: 'image/png',
    })
    await expect(loadStudioImageBytes('user-1', 'img-1')).rejects.toThrow(
      'does not belong to the authenticated user',
    )
  })

  it('returns the container the bytes actually are, not the mislabeled column', async () => {
    // A generated child can be stored as image/png while holding JPEG bytes,
    // because provider output is uploaded verbatim under a declared type.
    mockDownload.mockResolvedValue({
      data: {
        arrayBuffer: async () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('JFIF')]),
      },
      error: null,
    })

    const result = await loadStudioImageBytes('user-1', 'img-1')
    expect(result.mimeType).toBe('image/jpeg')
  })

  it('keeps the stored type when the container cannot be identified', async () => {
    const result = await loadStudioImageBytes('user-1', 'img-1')
    expect(result.mimeType).toBe('image/png')
  })
})

describe('downloadStudioStorageObject', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDownload.mockResolvedValue({
      data: {
        arrayBuffer: async () => Buffer.from('bytes'),
      },
      error: null,
    })
  })

  it('downloads at the expected path', async () => {
    const result = await downloadStudioStorageObject('user-1/studio/img-1.png', 'user-1')
    expect(result.byteLength).toBe(5)
    expect(mockDownload).toHaveBeenCalledWith('user-1/studio/img-1.png')
  })
})
