/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { assertUserCanEditMenu, DatabaseError, userOperations } from '@/lib/database'
import { quotaOperations } from '@/lib/quota-management'
import { checkRateLimit, getBatchLimits } from '@/lib/rate-limiting'
import { getItemDailyGenerationLimit } from '@/lib/image-generation-limits'

jest.mock('@/lib/supabase-server')
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))
jest.mock('@/lib/database', () => {
  class DatabaseError extends Error {
    constructor(message: string, public code?: string) {
      super(message)
      this.name = 'DatabaseError'
    }
  }

  return {
    DatabaseError,
    assertUserCanEditMenu: jest.fn(),
    userOperations: {
      getProfile: jest.fn(),
    },
  }
})
jest.mock('@/lib/quota-management', () => ({
  quotaOperations: {
    checkQuota: jest.fn(),
    estimateCost: jest.fn(),
    consumeQuota: jest.fn(),
  },
}))
jest.mock('@/lib/rate-limiting', () => ({
  checkRateLimit: jest.fn(),
  getBatchLimits: jest.fn(),
}))
jest.mock('@/lib/image-generation-limits', () => ({
  getItemDailyGenerationLimit: jest.fn(),
}))
jest.mock('@/lib/prompt-construction', () => ({
  getPromptConstructionService: jest.fn(() => ({
    buildPrompt: jest.fn(() => ({
      prompt: 'A studio photo of a menu item',
      negativePrompt: 'blurry',
    })),
    buildPromptV2: jest.fn(() => ({
      prompt: 'A studio photo of a menu item',
      negativePrompt: 'blurry',
    })),
  })),
}))

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.Mock
const mockAssertUserCanEditMenu = assertUserCanEditMenu as jest.Mock
const mockUserOperations = userOperations as jest.Mocked<typeof userOperations>
const mockQuotaOperations = quotaOperations as jest.Mocked<typeof quotaOperations>
const mockCheckRateLimit = checkRateLimit as jest.Mock
const mockGetBatchLimits = getBatchLimits as jest.Mock
const mockGetItemDailyGenerationLimit = getItemDailyGenerationLimit as jest.Mock

const USER_ID = '123e4567-e89b-42d3-a456-426614174001'
const MENU_ID = '123e4567-e89b-42d3-a456-426614174002'
const ITEM_ID = '123e4567-e89b-42d3-a456-426614174003'
const SECOND_ITEM_ID = '123e4567-e89b-42d3-a456-426614174004'

type SupabaseState = {
  activeJobs?: any[]
  todaysJobs?: Array<{ menu_item_id: string }>
  insertedJobs?: any[]
  menuItemsError?: any
  insertJobsError?: any
}

function createRequest(body: Record<string, any>): NextRequest {
  return new NextRequest('http://localhost/api/image-generation/batches', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createSupabaseMock(state: SupabaseState = {}) {
  const menuRow = {
    id: MENU_ID,
    user_id: USER_ID,
    created_at: new Date().toISOString(),
    menu_data: {
      items: [
        { id: ITEM_ID, name: 'Burger', description: 'Beef burger', price: 12, category: 'Mains' },
        { id: SECOND_ITEM_ID, name: 'Fries', description: 'Crispy fries', price: 6, category: 'Sides' },
      ],
    },
    establishment_type: 'Restaurant',
    primary_cuisine: 'American',
  }

  const insertedJobs = state.insertedJobs ?? [
    {
      id: 'job-1',
      batch_id: 'batch-1',
      menu_id: MENU_ID,
      menu_item_id: ITEM_ID,
      status: 'queued',
      created_at: new Date().toISOString(),
    },
  ]

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      if (table === 'menus') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({ data: menuRow, error: null }),
              })),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            })),
          })),
        }
      }

      if (table === 'menu_items') {
        return {
          select: jest.fn(() => ({
            in: jest.fn().mockResolvedValue({
              data: [{ id: ITEM_ID }, { id: SECOND_ITEM_ID }],
              error: state.menuItemsError ?? null,
            }),
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn().mockResolvedValue({ data: { order_index: 1 }, error: null }),
                })),
              })),
            })),
          })),
          insert: jest.fn().mockResolvedValue({ error: null }),
        }
      }

      if (table === 'image_generation_jobs') {
        return {
          select: jest.fn(() => ({
            in: jest.fn((field: string) => {
              if (field === 'menu_item_id') {
                return {
                  in: jest.fn().mockResolvedValue({
                    data: state.activeJobs ?? [],
                    error: null,
                  }),
                  gte: jest.fn().mockResolvedValue({
                    data: state.todaysJobs ?? [],
                    error: null,
                  }),
                }
              }
              return {
                gte: jest.fn().mockResolvedValue({
                  data: state.todaysJobs ?? [],
                  error: null,
                }),
              }
            }),
            eq: jest.fn(() => ({
              in: jest.fn(() => ({
                gte: jest.fn().mockResolvedValue({
                  data: state.todaysJobs ?? [],
                  error: null,
                }),
              })),
            })),
          })),
          insert: jest.fn(() => ({
            select: jest.fn().mockResolvedValue({
              data: insertedJobs,
              error: state.insertJobsError ?? null,
            }),
          })),
          update: jest.fn(() => ({
            in: jest.fn().mockResolvedValue({ error: null }),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('POST /api/image-generation/batches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.AI_IMAGE_GENERATION_DISABLED

    mockCreateServerSupabaseClient.mockReturnValue(createSupabaseMock())
    mockUserOperations.getProfile.mockResolvedValue({ id: USER_ID, plan: 'free', role: 'user' } as any)
    mockAssertUserCanEditMenu.mockResolvedValue(undefined)
    mockGetBatchLimits.mockReturnValue({ maxBatchSize: 5 })
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
      resetAt: new Date(),
    })
    mockGetItemDailyGenerationLimit.mockReturnValue(2)
    mockQuotaOperations.checkQuota.mockResolvedValue({
      remaining: 10,
      limit: 10,
      plan: 'free',
      needsUpgrade: false,
    } as any)
    mockQuotaOperations.estimateCost.mockResolvedValue({ estimatedTotal: 1 } as any)
    mockQuotaOperations.consumeQuota.mockResolvedValue({ remaining: 9, limit: 10 } as any)
  })

  it('returns 429 when monthly quota is insufficient', async () => {
    mockQuotaOperations.checkQuota.mockResolvedValue({
      remaining: 0,
      limit: 10,
      plan: 'free',
      needsUpgrade: true,
    } as any)

    const response = await POST(createRequest({ menuId: MENU_ID, itemIds: [ITEM_ID] }))
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.code).toBe('QUOTA_EXCEEDED')
  })

  it('returns 409 when selected items already have active image jobs', async () => {
    mockCreateServerSupabaseClient.mockReturnValue(createSupabaseMock({
      activeJobs: [{ id: 'active-job', menu_item_id: ITEM_ID, status: 'queued' }],
    }))

    const response = await POST(createRequest({ menuId: MENU_ID, itemIds: [ITEM_ID] }))
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('IMAGE_GENERATION_ALREADY_ACTIVE')
    expect(mockQuotaOperations.consumeQuota).not.toHaveBeenCalled()
  })

  it('returns 422 when the request exceeds the plan batch cap', async () => {
    mockGetBatchLimits.mockReturnValue({ maxBatchSize: 1 })

    const response = await POST(createRequest({ menuId: MENU_ID, itemIds: [ITEM_ID, SECOND_ITEM_ID] }))
    const data = await response.json()

    expect(response.status).toBe(422)
    expect(data.code).toBe('BATCH_LIMIT_EXCEEDED')
    expect(mockAssertUserCanEditMenu).not.toHaveBeenCalled()
  })

  it('returns 403 when the menu edit window is locked', async () => {
    mockAssertUserCanEditMenu.mockRejectedValue(new DatabaseError('Edit window expired', 'EDIT_WINDOW_EXPIRED'))

    const response = await POST(createRequest({ menuId: MENU_ID, itemIds: [ITEM_ID] }))
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('EDIT_WINDOW_EXPIRED')
    expect(mockQuotaOperations.consumeQuota).not.toHaveBeenCalled()
  })

  it('returns 429 when a selected item has reached its daily limit', async () => {
    mockCreateServerSupabaseClient.mockReturnValue(createSupabaseMock({
      todaysJobs: [{ menu_item_id: ITEM_ID }, { menu_item_id: ITEM_ID }],
    }))

    const response = await POST(createRequest({ menuId: MENU_ID, itemIds: [ITEM_ID] }))
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.code).toBe('ITEM_DAILY_LIMIT')
    expect(data.itemId).toBe(ITEM_ID)
    expect(mockQuotaOperations.consumeQuota).not.toHaveBeenCalled()
  })

  it('queues jobs and consumes quota for accepted batches', async () => {
    const response = await POST(createRequest({ menuId: MENU_ID, itemIds: [ITEM_ID] }))
    const data = await response.json()

    expect(response.status).toBe(202)
    expect(data.success).toBe(true)
    expect(data.data.jobs).toHaveLength(1)
    expect(mockQuotaOperations.consumeQuota).toHaveBeenCalledWith(USER_ID, 1)
  })
})
