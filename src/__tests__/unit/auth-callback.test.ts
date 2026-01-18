import { GET } from '@/app/auth/callback/route'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { userOperations } from '@/lib/database'
import { sendAdminNewUserAlert } from '@/lib/notifications'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock next/server
jest.mock('next/server', () => ({
  NextResponse: {
    redirect: jest.fn((url: URL) => ({
      status: 302,
      url: url.toString(),
      cookies: {
        set: jest.fn(),
      },
    })),
  },
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

describe('Auth Callback Route', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      auth: {
        exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123', email: 'test@example.com' } } }),
      },
    }
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue({ mock: 'admin-supabase' })
  })

  const makeRequest = (url: string) => {
    return {
      url,
      cookies: {
        get: jest.fn(),
      },
    } as unknown as NextRequest
  }

  it('should redirect to next param after successful exchange', async () => {
    const req = makeRequest('http://localhost:3000/auth/callback?code=test-code&next=/dashboard')
    const res = await GET(req) as any
    
    expect(res.url).toBe('http://localhost:3000/dashboard')
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('test-code')
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
    
    expect(sendAdminNewUserAlert).toHaveBeenCalledWith(mockProfile)
    expect(userOperations.updateProfile).toHaveBeenCalledWith(
      'user-123', 
      { adminNotified: true }, 
      { mock: 'admin-supabase' }
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
    expect(userOperations.updateProfile).not.toHaveBeenCalled()
  })
})
