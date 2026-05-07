/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { assertUserCanEditMenu, userOperations } from '@/lib/database'
import { quotaOperations } from '@/lib/quota-management'
import { checkRateLimit } from '@/lib/rate-limiting'
import { getItemDailyGenerationLimit } from '@/lib/image-generation-limits'
import { insertQueuedImageJobsConsumeQuotaAndRelease } from '@/lib/image-generation/enqueue-helpers'

jest.mock('@/lib/supabase-server')
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))
jest.mock('@/lib/database', () => ({
  DatabaseError: class DatabaseError extends Error {
    code?: string
    constructor(message: string, code?: string) {
      super(message)
      this.name = 'DatabaseError'
      this.code = code
    }
  },
  assertUserCanEditMenu: jest.fn(),
  userOperations: {
    getProfile: jest.fn(),
  },
}))
jest.mock('@/lib/quota-management', () => ({
  quotaOperations: {
    checkQuota: jest.fn(),
    estimateCost: jest.fn(),
    consumeQuota: jest.fn(),
  },
}))
jest.mock('@/lib/rate-limiting', () => ({
  checkRateLimit: jest.fn(),
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
jest.mock('@/lib/image-generation/enqueue-helpers', () => {
  const actual = jest.requireActual('@/lib/image-generation/enqueue-helpers')
  return {
    ...actual,
    insertQueuedImageJobsConsumeQuotaAndRelease: jest.fn(),
  }
})

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.Mock
const mockAssertUserCanEditMenu = assertUserCanEditMenu as jest.Mock
const mockUserOperations = userOperations as jest.Mocked<typeof userOperations>
const mockQuotaOperations = quotaOperations as jest.Mocked<typeof quotaOperations>
const mockCheckRateLimit = checkRateLimit as jest.Mock
const mockGetItemDailyGenerationLimit = getItemDailyGenerationLimit as jest.Mock
const mockInsertQueued = insertQueuedImageJobsConsumeQuotaAndRelease as jest.MockedFunction<
  typeof insertQueuedImageJobsConsumeQuotaAndRelease
>

const USER_ID = '123e4567-e89b-12d3-a456-426614174000'
const MENU_ID = '223e4567-e89b-12d3-a456-426614174001'
const ITEM_ID = '323e4567-e89b-12d3-a456-426614174002'
const JOB_ID = '423e4567-e89b-12d3-a456-426614174003'

type GenImageSupabaseState = {
  activeJobs?: Array<{ id: string; menu_item_id: string; status: string }>
  todaysCount?: number
}

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/generate-image', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createSupabaseMock(state: GenImageSupabaseState = {}) {
  const menuRow = {
    id: MENU_ID,
    user_id: USER_ID,
    created_at: new Date().toISOString(),
    menu_data: {
      items: [
        {
          id: ITEM_ID,
          name: 'Burger',
          description: 'Beef burger',
          price: 12,
          category: 'Mains',
        },
      ],
    },
    establishment_type: 'Restaurant',
    primary_cuisine: 'American',
  }

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
        }
      }

      if (table === 'menu_items') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: ITEM_ID }, error: null }),
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn().mockResolvedValue({ data: { order_index: 1 }, error: null }),
                })),
              })),
            })),
          })),
        }
      }

      if (table === 'image_generation_jobs') {
        return {
          select: jest.fn((columns: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    gte: jest.fn().mockResolvedValue({
                      count: state.todaysCount ?? 0,
                      error: null,
                    }),
                  })),
                })),
              }
            }
            return {
              eq: jest.fn(() => ({
                in: jest.fn().mockResolvedValue({
                  data: state.activeJobs ?? [],
                  error: null,
                }),
              })),
            }
          }),
        }
      }

      throw new Error(`Unexpected table in generate-image test mock: ${table}`)
    }),
  }
}

describe('POST /api/generate-image', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.AI_IMAGE_GENERATION_DISABLED

    mockCreateServerSupabaseClient.mockReturnValue(createSupabaseMock())
    mockUserOperations.getProfile.mockResolvedValue({ id: USER_ID, plan: 'free', role: 'user' } as any)
    mockAssertUserCanEditMenu.mockResolvedValue(undefined)
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
      resetAt: new Date(),
    })
    mockGetItemDailyGenerationLimit.mockReturnValue(5)
    mockQuotaOperations.checkQuota.mockResolvedValue({
      remaining: 10,
      limit: 10,
      plan: 'free',
      needsUpgrade: false,
    } as any)
    mockQuotaOperations.estimateCost.mockResolvedValue({ estimatedTotal: 1 } as any)

    const createdAt = new Date().toISOString()
    mockInsertQueued.mockResolvedValue({
      insertedJobs: [
        {
          id: JOB_ID,
          created_at: createdAt,
        },
      ],
      quotaAfter: { remaining: 9, limit: 10, plan: 'free', needsUpgrade: false },
    } as any)
  })

  it('returns 503 when AI_IMAGE_GENERATION_DISABLED is true', async () => {
    process.env.AI_IMAGE_GENERATION_DISABLED = 'true'

    const response = await POST(
      createRequest({ menuId: MENU_ID, menuItemId: ITEM_ID })
    )
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.code).toBe('FEATURE_DISABLED')
    expect(mockCreateServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('returns 401 when the user is not authenticated', async () => {
    mockCreateServerSupabaseClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('no session'),
        }),
      },
      from: jest.fn(),
    })

    const response = await POST(
      createRequest({ menuId: MENU_ID, menuItemId: ITEM_ID })
    )

    expect(response.status).toBe(401)
    expect(mockInsertQueued).not.toHaveBeenCalled()
  })

  it('returns 409 when an active job exists for the menu item', async () => {
    mockCreateServerSupabaseClient.mockReturnValue(
      createSupabaseMock({
        activeJobs: [{ id: 'active-1', menu_item_id: ITEM_ID, status: 'queued' }],
      })
    )

    const response = await POST(
      createRequest({ menuId: MENU_ID, menuItemId: ITEM_ID })
    )
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('IMAGE_GENERATION_ALREADY_ACTIVE')
    expect(mockInsertQueued).not.toHaveBeenCalled()
  })

  it('returns 202 with job payload when enqueue succeeds', async () => {
    const response = await POST(
      createRequest({ menuId: MENU_ID, menuItemId: ITEM_ID, numberOfVariations: 1 })
    )
    const data = await response.json()

    expect(response.status).toBe(202)
    expect(data.success).toBe(true)
    expect(data.data.jobId).toBe(JOB_ID)
    expect(data.data.job.status).toBe('queued')
    expect(data.data.job.menuItemId).toBe(ITEM_ID)
    expect(data.data.quota.itemDailyLimit).toBe(5)
    expect(mockInsertQueued).toHaveBeenCalledTimes(1)
  })
})
