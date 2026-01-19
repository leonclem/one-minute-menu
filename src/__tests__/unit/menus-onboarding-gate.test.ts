import { POST } from '@/app/api/menus/route'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations, menuOperations } from '@/lib/database'
import { requireOnboardingCompleteApi } from '@/lib/onboarding-api-auth'

// Mock next/server
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
    })),
    redirect: jest.fn((url) => ({
      status: 302,
      url: url.toString(),
    })),
  },
  NextRequest: jest.fn().mockImplementation((url, init) => ({
    url,
    method: init?.method || 'GET',
    json: async () => init?.body ? JSON.parse(init.body) : {},
  })),
}))

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// Mock database operations
jest.mock('@/lib/database', () => ({
  userOperations: {
    getProfile: jest.fn(),
  },
  menuOperations: {
    generateUniqueSlug: jest.fn(),
    createMenu: jest.fn(),
  },
  DatabaseError: class extends Error {
    constructor(message: string, public code?: string) {
      super(message)
    }
  }
}))

// Mock supabase-server
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
}))

// Mock onboarding gate helpers
jest.mock('@/lib/onboarding-api-auth', () => ({
  requireOnboardingCompleteApi: jest.fn(),
}))

describe('Menus API Onboarding Gate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default mock implementation for requireOnboardingCompleteApi
    ;(requireOnboardingCompleteApi as jest.Mock).mockImplementation(async (req) => {
      return { ok: true, user: { id: 'user-123' }, profile: { id: 'user-123', onboardingCompleted: true } }
    })
  })

  const makePostRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/menus', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  it('should allow menu creation when onboarding is complete', async () => {
    const body = { name: 'Test Menu' }
    const req = makePostRequest(body)
    
    ;(menuOperations.generateUniqueSlug as jest.Mock).mockResolvedValue('test-menu')
    ;(menuOperations.createMenu as jest.Mock).mockResolvedValue({ id: 'menu-123', name: 'Test Menu' })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
    expect(menuOperations.createMenu).toHaveBeenCalled()
  })

  it('should block menu creation and return 403 when onboarding is incomplete', async () => {
    const body = { name: 'Test Menu' }
    const req = makePostRequest(body)
    
    // Simulate gate failure
    ;(requireOnboardingCompleteApi as jest.Mock).mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Onboarding required', code: 'ONBOARDING_REQUIRED' },
        { status: 403 }
      )
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.code).toBe('ONBOARDING_REQUIRED')
    expect(menuOperations.createMenu).not.toHaveBeenCalled()
  })
})
