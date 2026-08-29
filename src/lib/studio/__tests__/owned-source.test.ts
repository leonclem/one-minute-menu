/** @jest-environment node */

const mockFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({ from: mockFrom }),
}))

import {
  loadOwnedDishSource,
  OwnedStudioSourceNotFoundError,
} from '../owned-source'

function query(result: unknown) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.is.mockReturnValue(builder)
  return builder
}

describe('loadOwnedDishSource', () => {
  beforeEach(() => jest.clearAllMocks())

  it('proves the owned, non-archived dish/source relationship without storage access', async () => {
    const dishQuery = query({ data: { id: 'dish-1', user_id: 'user-1' }, error: null })
    const imageQuery = query({
      data: { id: 'image-1', user_id: 'user-1', dish_id: 'dish-1', archived_at: null },
      error: null,
    })
    mockFrom.mockImplementation((table: string) =>
      table === 'studio_dishes' ? dishQuery : imageQuery,
    )

    const result = await loadOwnedDishSource({
      userId: 'user-1',
      dishId: 'dish-1',
      sourceImageId: 'image-1',
    })

    expect(result.dish.id).toBe('dish-1')
    expect(result.image.id).toBe('image-1')
    expect(imageQuery.eq).toHaveBeenCalledWith('dish_id', 'dish-1')
    expect(imageQuery.is).toHaveBeenCalledWith('archived_at', null)
  })

  it.each([
    ['missing dish', { data: null, error: null }, { data: {}, error: null }],
    ['cross-dish source', { data: { id: 'dish-1' }, error: null }, { data: null, error: null }],
    ['cross-user source', { data: { id: 'dish-1' }, error: null }, { data: null, error: null }],
    ['archived source', { data: { id: 'dish-1' }, error: null }, { data: null, error: null }],
  ])('rejects a %s with the same non-leaking error', async (_caseName, dishResult, imageResult) => {
    mockFrom.mockImplementation((table: string) =>
      table === 'studio_dishes' ? query(dishResult) : query(imageResult),
    )

    await expect(
      loadOwnedDishSource({ userId: 'user-1', dishId: 'dish-1', sourceImageId: 'image-1' }),
    ).rejects.toBeInstanceOf(OwnedStudioSourceNotFoundError)
  })
})
