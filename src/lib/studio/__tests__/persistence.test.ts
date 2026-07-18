/**
 * @jest-environment node
 */

const mockUpload = jest.fn()
const mockGetPublicUrl = jest.fn()
const mockRemove = jest.fn()
const mockInsert = jest.fn()
const mockSingle = jest.fn()
const mockGte = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        remove: mockRemove,
      }),
    },
    from: (table: string) => {
      if (table === 'studio_dishes') {
        return {
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        }
      }
      return {
        insert: (...args: unknown[]) => mockInsert(...args),
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: (...args: unknown[]) => mockGte(...args),
            }),
          }),
        }),
      }
    },
  }),
}))

import {
  countTodayGeneratedStudioImages,
  getStudioDailyGenerationLimit,
  persistStudioImage,
} from '../persistence'

describe('studio persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.STUDIO_DAILY_GENERATION_LIMIT
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          'https://example.supabase.co/storage/v1/object/public/ai-generated-images/u/studio/id.png',
      },
    })
    mockRemove.mockResolvedValue({ error: null })
    mockSingle.mockResolvedValue({
      data: {
        id: 'img-1',
        user_id: 'user-1',
        dish_id: 'dish-1',
        role: 'generated',
        source_image_id: null,
        storage_path: 'user-1/studio/img-1.png',
        public_url:
          'https://example.supabase.co/storage/v1/object/public/ai-generated-images/u/studio/id.png',
        mime_type: 'image/png',
        width: null,
        height: null,
        prompt: 'do the thing',
        model: 'gemini-3.1-flash-image-preview',
        metadata: {},
        is_favourite: false,
        archived_at: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    })
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) })
    mockGte.mockResolvedValue({ count: 3, error: null })
  })

  it('getStudioDailyGenerationLimit defaults to 25', () => {
    expect(getStudioDailyGenerationLimit()).toBe(25)
  })

  it('getStudioDailyGenerationLimit reads env', () => {
    process.env.STUDIO_DAILY_GENERATION_LIMIT = '10'
    expect(getStudioDailyGenerationLimit()).toBe(10)
  })

  it('persistStudioImage uploads and inserts a row', async () => {
    const record = await persistStudioImage({
      userId: 'user-1',
      dishId: 'dish-1',
      role: 'generated',
      imageBase64: Buffer.from('png-bytes').toString('base64'),
      mimeType: 'image/png',
      prompt: 'do the thing',
      model: 'gemini-3.1-flash-image-preview',
    })

    expect(mockUpload).toHaveBeenCalled()
    expect(record.id).toBe('img-1')
    expect(record.role).toBe('generated')
    expect(record.dish_id).toBe('dish-1')
    expect(record.public_url).toContain('ai-generated-images')
  })

  it('persistStudioImage requires dishId', async () => {
    await expect(
      persistStudioImage({
        userId: 'user-1',
        dishId: '',
        role: 'source',
        imageBase64: Buffer.from('png').toString('base64'),
        mimeType: 'image/png',
      }),
    ).rejects.toThrow('dishId is required')
  })

  it('countTodayGeneratedStudioImages returns count', async () => {
    await expect(countTodayGeneratedStudioImages('user-1')).resolves.toBe(3)
    expect(mockGte).toHaveBeenCalled()
  })
})
