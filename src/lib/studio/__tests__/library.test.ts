/**
 * @jest-environment node
 */

const mockMaybeSingle = jest.fn()
const mockList = jest.fn()
const mockClearFavourites = jest.fn()
const mockUpdateSingle = jest.fn()
const mockChildCount = jest.fn()
const mockClearChildren = jest.fn()
const mockDelete = jest.fn()
const mockRemove = jest.fn()

type ChainMode = 'get' | 'list' | 'clearFav' | 'update' | 'childCount' | 'clearChildren' | 'delete'

let nextSelectMode: ChainMode = 'get'

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({
    storage: {
      from: () => ({
        remove: (...args: unknown[]) => mockRemove(...args),
      }),
    },
    from: () => ({
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) {
          return {
            eq: () => ({
              eq: () => ({
                is: () => mockChildCount(),
              }),
            }),
          }
        }
        if (nextSelectMode === 'list') {
          return {
            eq: () => ({
              eq: () => ({
                order: () => ({
                  is: () => mockList(),
                }),
              }),
            }),
          }
        }
        return {
          eq: () => ({
            eq: () => ({
              maybeSingle: () => mockMaybeSingle(),
            }),
          }),
        }
      },
      update: (payload: Record<string, unknown>) => {
        if (payload.source_image_id === null) {
          return {
            eq: () => ({
              eq: () => mockClearChildren(),
            }),
          }
        }
        if (payload.is_favourite === false && !('archived_at' in payload)) {
          return {
            eq: () => ({
              eq: () => ({
                eq: () => mockClearFavourites(),
              }),
            }),
          }
        }
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: () => mockUpdateSingle(),
              }),
            }),
          }),
        }
      },
      delete: () => ({
        eq: () => ({
          eq: () => mockDelete(),
        }),
      }),
    }),
  }),
}))

import {
  archiveStudioImage,
  deleteStudioImage,
  listStudioImagesForDish,
  setStudioImageFavourite,
} from '../library'

const baseImage = {
  id: 'img-1',
  user_id: 'u1',
  dish_id: 'dish-1',
  role: 'generated' as const,
  source_image_id: null,
  storage_path: 'u1/studio/img-1.png',
  public_url: 'https://cdn.example/img-1.png',
  mime_type: 'image/png',
  width: null,
  height: null,
  prompt: null,
  model: 'gemini-3.1-flash-image-preview',
  metadata: {},
  is_favourite: false,
  archived_at: null,
  created_at: '2026-07-18T00:00:00Z',
}

describe('studio library', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    nextSelectMode = 'get'
    mockMaybeSingle.mockResolvedValue({ data: baseImage, error: null })
    mockList.mockResolvedValue({ data: [baseImage], error: null })
    mockClearFavourites.mockResolvedValue({ error: null })
    mockUpdateSingle.mockResolvedValue({
      data: { ...baseImage, is_favourite: true },
      error: null,
    })
    mockChildCount.mockResolvedValue({ count: 0, error: null })
    mockClearChildren.mockResolvedValue({ error: null })
    mockDelete.mockResolvedValue({ error: null })
    mockRemove.mockResolvedValue({ error: null })
  })

  it('lists non-archived images for a dish', async () => {
    nextSelectMode = 'list'
    const images = await listStudioImagesForDish('u1', 'dish-1')
    expect(images).toHaveLength(1)
    expect(mockList).toHaveBeenCalled()
  })

  it('sets favourite and clears previous', async () => {
    const updated = await setStudioImageFavourite('u1', 'img-1', true)
    expect(updated.is_favourite).toBe(true)
    expect(mockClearFavourites).toHaveBeenCalled()
  })

  it('archives an image and clears favourite', async () => {
    mockUpdateSingle.mockResolvedValue({
      data: {
        ...baseImage,
        archived_at: '2026-07-18T12:00:00Z',
        is_favourite: false,
      },
      error: null,
    })
    const archived = await archiveStudioImage('u1', 'img-1')
    expect(archived.archived_at).toBeTruthy()
  })

  it('blocks delete when active children exist', async () => {
    mockChildCount.mockResolvedValue({ count: 1, error: null })
    await expect(deleteStudioImage('u1', 'img-1')).rejects.toThrow('Archive or delete')
  })

  it('deletes image and storage object', async () => {
    await expect(deleteStudioImage('u1', 'img-1')).resolves.toBeUndefined()
    expect(mockDelete).toHaveBeenCalled()
    expect(mockRemove).toHaveBeenCalledWith(['u1/studio/img-1.png'])
  })
})
