/**
 * @jest-environment node
 */

const mockSelectEqOrder = jest.fn()
const mockInsertSingle = jest.fn()
const mockUpdateSingle = jest.fn()
const mockDeleteEq = jest.fn()
const mockCountActive = jest.fn()
const mockListArchived = jest.fn()
const mockRemove = jest.fn()
const mockMaybeSingle = jest.fn()

let fromTable = ''

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({
    storage: {
      from: () => ({
        remove: (...args: unknown[]) => mockRemove(...args),
      }),
    },
    from: (table: string) => {
      fromTable = table
      return {
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head && table === 'studio_images') {
            return {
              eq: () => ({
                eq: () => ({
                  is: () => mockCountActive(),
                }),
              }),
            }
          }
          if (table === 'studio_images') {
            return {
              eq: () => ({
                eq: () => ({
                  not: () => mockListArchived(),
                }),
              }),
            }
          }
          return {
            eq: () => ({
              order: () => mockSelectEqOrder(),
              eq: () => ({
                maybeSingle: () => mockMaybeSingle(),
              }),
            }),
          }
        },
        insert: () => ({
          select: () => ({
            single: () => mockInsertSingle(),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: () => mockUpdateSingle(),
              }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => mockDeleteEq(),
          }),
        }),
      }
    },
  }),
}))

import {
  createStudioDish,
  deleteStudioDish,
  listStudioDishes,
  renameStudioDish,
} from '../dishes'

describe('studio dishes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSelectEqOrder.mockResolvedValue({
      data: [{ id: 'd1', user_id: 'u1', name: 'Burger', description: null }],
      error: null,
    })
    mockInsertSingle.mockResolvedValue({
      data: {
        id: 'd2',
        user_id: 'u1',
        name: 'Salad',
        description: null,
        created_at: '2026-07-18T00:00:00Z',
        updated_at: '2026-07-18T00:00:00Z',
      },
      error: null,
    })
    mockUpdateSingle.mockResolvedValue({
      data: {
        id: 'd1',
        user_id: 'u1',
        name: 'Cheeseburger',
        description: null,
        created_at: '2026-07-18T00:00:00Z',
        updated_at: '2026-07-18T01:00:00Z',
      },
      error: null,
    })
    mockCountActive.mockResolvedValue({ count: 0, error: null })
    mockListArchived.mockResolvedValue({ data: [], error: null })
    mockDeleteEq.mockResolvedValue({ error: null })
    mockRemove.mockResolvedValue({ error: null })
  })

  it('lists dishes for a user', async () => {
    const dishes = await listStudioDishes('u1')
    expect(dishes).toHaveLength(1)
    expect(dishes[0].name).toBe('Burger')
  })

  it('rejects empty dish names', async () => {
    await expect(createStudioDish('u1', '   ')).rejects.toThrow('Dish name is required')
  })

  it('creates a dish', async () => {
    const dish = await createStudioDish('u1', 'Salad')
    expect(dish.name).toBe('Salad')
    expect(mockInsertSingle).toHaveBeenCalled()
  })

  it('renames a dish', async () => {
    const dish = await renameStudioDish('u1', 'd1', 'Cheeseburger')
    expect(dish.name).toBe('Cheeseburger')
  })

  it('blocks delete when active images remain', async () => {
    mockCountActive.mockResolvedValue({ count: 2, error: null })
    await expect(deleteStudioDish('u1', 'd1')).rejects.toThrow('Archive or delete')
  })

  it('deletes an empty dish', async () => {
    await expect(deleteStudioDish('u1', 'd1')).resolves.toBeUndefined()
    expect(mockDeleteEq).toHaveBeenCalled()
    void fromTable
  })
})
