import { GET } from '@/app/auth/callback/route'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { userOperations } from '@/lib/database'
import { sendAdminNewUserAlert } from '@/lib/notifications'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { ensureStarterStudioCredits } from '@/lib/studio/credits'
import { claimGuestStudioWork } from '@/lib/studio/guest/claim-guest-work'

import { getFeatureFlag, clearFeatureFlagCache } from '@/lib/feature-flags'

// Mock next/server
jest.mock('next/server', () => ({
  NextResponse: {
    redirect: jest.fn((url: URL) => ({
      status: 302,
      url: url.toString(),
      headers: {
        get: jest.fn(),
        set: jest.fn(),
      },
      cookies: {
        set: jest.fn(),
      },
    })),
  },
}))

// Mock feature flags
jest.mock('@/lib/feature-flags', () => ({
  getFeatureFlag: jest.fn(),
  clearFeatureFlagCache: jest.fn(),
}))

// Mock @supabase/ssr
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))

// Mock database operations
jest.mock('@/lib/database', () => ({
  userOperations: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  },
}))

// Mock notifications
jest.mock('@/lib/notifications', () => ({
  sendAdminNewUserAlert: jest.fn(),
}))

// Mock supabase-server
jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

jest.mock('@/lib/studio/credits', () => ({
  ensureStarterStudioCredits: jest.fn().mockResolvedValue({
    balanceAfter: 10,
    granted: true,
    ledgerId: 'led-1',
  }),
}))

jest.mock('@/lib/studio/guest/claim-guest-work', () => ({
  claimGuestStudioWork: jest.fn().mockResolvedValue({
    claimed: false,
    guestUserId: null,
  }),
}))

describe('Auth Callback Route', () => {
  let mockSupabase: any
  let mockAdminSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default feature flag state
    ;(getFeatureFlag as jest.Mock).mockResolvedValue(true)
    
    mockSupabase = {
      auth: {
        exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
        getUser: jest.fn().mockResolvedValue({ 
          data: { 
            user: { 
              id: 'user-123', 
              email: 'test@example.com',
              created_at: new Date().toISOString()
            } 
          } 
        }),
      },
    }
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
    
    mockAdminSupabase = {
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockAdminSupabase)
  })

  const makeRequest = (url: string, cookieHeader?: string) => {
    return {
      url,
      cookies: {
        get: jest.fn(),
      },
      headers: {
        get: jest.fn((name: string) => (name === 'cookie' ? cookieHeader ?? null : null)),
      },
    } as unknown as NextRequest
  }

  it('should redirect to next param after successful exchange', async () => {
    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code&next=/dashboard')
    const res = await GET(req) as any
    
    expect(res.url).toBe('http://localhost:3000/dashboard')
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('test-code')
    expect(createAdminSupabaseClient).toHaveBeenCalled()
    expect(ensureStarterStudioCredits).toHaveBeenCalledWith('user-123', mockAdminSupabase)
  })

  it('defaults next to onboarding when studio is off', async () => {
    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code')
    const res = await GET(req) as any

    expect(res.url).toBe('http://localhost:3000/onboarding')
  })

  it('defaults next to /studio when photo studio is enabled', async () => {
    const previous = process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO
    process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
    try {
      const req = makeRequest('http://localhost:3000/auth/callback?code=test-code')
      const res = await GET(req) as any
      expect(res.url).toBe('http://localhost:3000/studio')
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO
      } else {
        process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = previous
      }
    }
  })

  it('should trigger admin alert for new unapproved users', async () => {
    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code')
    
    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      isApproved: false,
      adminNotified: false,
      role: 'user',
    }
    
    ;(userOperations.getProfile as jest.Mock).mockResolvedValue(mockProfile)
    ;(sendAdminNewUserAlert as jest.Mock).mockResolvedValue(true)
    
    await GET(req)
    
    expect(claimGuestStudioWork).not.toHaveBeenCalled()
    expect(sendAdminNewUserAlert).toHaveBeenCalledWith(mockProfile)
    expect(userOperations.updateProfile).toHaveBeenCalledWith(
      'user-123', 
      { adminNotified: true }, 
      mockAdminSupabase
    )
  })

  it('claims guest studio work and still notifies the admin', async () => {
    const req = makeRequest(
      'http://localhost:3000/auth/callback?code=test-code&next=/studio&claim=claim-token',
    )

    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      isApproved: false,
      adminNotified: false,
      role: 'user',
      lastLoginAt: new Date('2026-01-01T00:00:00.000Z'),
    }

    ;(userOperations.getProfile as jest.Mock).mockResolvedValue(mockProfile)
    ;(sendAdminNewUserAlert as jest.Mock).mockResolvedValue(true)
    ;(claimGuestStudioWork as jest.Mock).mockResolvedValue({
      claimed: true,
      guestUserId: 'guest-1',
    })

    const res = await GET(req) as any

    expect(claimGuestStudioWork).toHaveBeenCalledWith({
      claimToken: 'claim-token',
      verifiedUserId: 'user-123',
    })
    expect(sendAdminNewUserAlert).toHaveBeenCalledWith(mockProfile)
    expect(userOperations.updateProfile).toHaveBeenCalledWith(
      'user-123',
      { adminNotified: true },
      mockAdminSupabase,
    )
    expect(res.headers.set).toHaveBeenCalledWith(
      'location',
      'http://localhost:3000/studio?guest_claimed=1',
    )
  })

  it('should auto-approve user if admin approval is not required', async () => {
    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code')
    
    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      isApproved: false,
      adminNotified: false,
      role: 'user',
    }
    
    ;(userOperations.getProfile as jest.Mock).mockResolvedValue(mockProfile)
    ;(getFeatureFlag as jest.Mock).mockResolvedValue(false) // Approval NOT required
    
    await GET(req)
    
    expect(userOperations.updateProfile).toHaveBeenCalledWith(
      'user-123', 
      { isApproved: true }, 
      mockAdminSupabase
    )
  })

  it('should not trigger alert if user is already approved', async () => {
    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code')
    
    const mockProfile = {
      id: 'user-123',
      isApproved: true,
      adminNotified: false,
      role: 'user',
    }
    
    ;(userOperations.getProfile as jest.Mock).mockResolvedValue(mockProfile)
    
    await GET(req)
    
    expect(sendAdminNewUserAlert).not.toHaveBeenCalled()
  })

  it('should not trigger alert if admin was already notified', async () => {
    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code')
    
    const mockProfile = {
      id: 'user-123',
      isApproved: false,
      adminNotified: true,
      role: 'user',
    }
    
    ;(userOperations.getProfile as jest.Mock).mockResolvedValue(mockProfile)
    
    await GET(req)
    
    expect(sendAdminNewUserAlert).not.toHaveBeenCalled()
  })

  it('should not mark as notified if email fails to send', async () => {
    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code')
    
    const mockProfile = {
      id: 'user-123',
      isApproved: false,
      adminNotified: false,
      role: 'user',
    }
    
    ;(userOperations.getProfile as jest.Mock).mockResolvedValue(mockProfile)
    ;(sendAdminNewUserAlert as jest.Mock).mockResolvedValue(false)
    
    await GET(req)
    
    expect(sendAdminNewUserAlert).toHaveBeenCalled()
    expect(userOperations.updateProfile).not.toHaveBeenCalledWith(
      'user-123',
      { adminNotified: true },
      expect.anything()
    )
  })

  it('sets new_signup on first verified login even when Auth created_at is old', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        },
      },
    })
    ;(userOperations.getProfile as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      isApproved: true,
      adminNotified: true,
      role: 'user',
      lastLoginAt: undefined,
    })

    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code&next=/studio')
    const res = await GET(req) as any

    expect(res.headers.set).toHaveBeenCalledWith(
      'location',
      'http://localhost:3000/studio?new_signup=true',
    )
  })

  it('does not set new_signup for a returning user', async () => {
    ;(userOperations.getProfile as jest.Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      isApproved: true,
      adminNotified: true,
      role: 'user',
      lastLoginAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code&next=/studio')
    const res = await GET(req) as any

    expect(res.headers.set).not.toHaveBeenCalled()
  })
})
