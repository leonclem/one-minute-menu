/**
 * Unit test: identify wiring
 *
 * Verifies that useAnalyticsIdentify correctly wires Supabase auth events to
 * PostHog's identifyUser / resetAnalytics helpers.
 *
 * - SIGNED_IN: fetches profile and calls identifyUser with exactly the 6-key
 *   allow-list (role, plan, subscription_status, is_admin, is_approved,
 *   created_at). account_id must NOT be present.
 * - SIGNED_OUT: calls resetAnalytics().
 *
 * Implements: 6.1, 6.5
 */

import { renderHook } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUnsubscribe = jest.fn()
let capturedAuthCallback: ((event: string, session: unknown) => Promise<void>) | null = null

// Mock profile row returned by the direct Supabase browser-client query.
// The hook now queries supabase.from('profiles').select(...).eq(...).single()
// directly instead of going through userOperations.getProfile (which pulls in
// supabase-server.ts / next/headers — incompatible with client components).
let mockProfileRow: Record<string, unknown> | null = null
let mockProfileError: Error | null = null

const mockSingle = jest.fn(() => {
  if (mockProfileError) return Promise.resolve({ data: null, error: mockProfileError })
  return Promise.resolve({ data: mockProfileRow, error: null })
})
const mockEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  supabase: {
    auth: {
      onAuthStateChange: jest.fn((cb: (event: string, session: unknown) => Promise<void>) => {
        capturedAuthCallback = cb
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
      }),
    },
    from: mockFrom,
  },
}))

const mockIdentifyUser = jest.fn()
const mockResetAnalytics = jest.fn()
const mockCaptureEvent = jest.fn()
jest.mock('../helper', () => ({
  __esModule: true,
  identifyUser: mockIdentifyUser,
  resetAnalytics: mockResetAnalytics,
  captureEvent: mockCaptureEvent,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER_ID = 'user-uuid-1234'

// Raw profile row as returned by the Supabase browser client query
const MOCK_PROFILE_ROW = {
  role: 'user',
  plan: 'grid_plus',
  subscription_status: null,
  is_approved: true,
  created_at: '2024-01-15T10:00:00.000Z',
}

const MOCK_ADMIN_PROFILE_ROW = {
  ...MOCK_PROFILE_ROW,
  role: 'admin',
}

const MOCK_SESSION = {
  user: { id: MOCK_USER_ID },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAnalyticsIdentify — identify wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedAuthCallback = null
    mockProfileRow = null
    mockProfileError = null
    // Re-wire the mock chain after clearAllMocks
    mockSingle.mockImplementation(() => {
      if (mockProfileError) return Promise.resolve({ data: null, error: mockProfileError })
      return Promise.resolve({ data: mockProfileRow, error: null })
    })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('calls identifyUser with the 6-key allow-list on SIGNED_IN', async () => {
    mockProfileRow = MOCK_PROFILE_ROW

    const { useAnalyticsIdentify } = await import('../useAnalyticsIdentify')
    renderHook(() => useAnalyticsIdentify())

    expect(capturedAuthCallback).not.toBeNull()
    await capturedAuthCallback!('SIGNED_IN', MOCK_SESSION)

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockIdentifyUser).toHaveBeenCalledTimes(1)

    const [calledId, calledProps] = mockIdentifyUser.mock.calls[0]
    expect(calledId).toBe(MOCK_USER_ID)

    // Exactly the 6 allow-list keys must be present (account_id must NOT be present)
    const allowedKeys = [
      'role',
      'plan',
      'subscription_status',
      'is_admin',
      'is_approved',
      'created_at',
    ]
    for (const key of allowedKeys) {
      expect(calledProps).toHaveProperty(key)
    }
    expect(calledProps).not.toHaveProperty('account_id')
    expect(calledProps).not.toHaveProperty('email')

    // Verify specific values
    expect(calledProps.role).toBe('user')
    expect(calledProps.plan).toBe('grid_plus')
    expect(calledProps.is_admin).toBe(false)
    expect(calledProps.is_approved).toBe(true)
    expect(calledProps.created_at).toBe('2024-01-15T10:00:00.000Z')
  })

  it('sets is_admin=true when profile.role is "admin"', async () => {
    mockProfileRow = MOCK_ADMIN_PROFILE_ROW

    const { useAnalyticsIdentify } = await import('../useAnalyticsIdentify')
    renderHook(() => useAnalyticsIdentify())

    await capturedAuthCallback!('SIGNED_IN', MOCK_SESSION)

    const [, calledProps] = mockIdentifyUser.mock.calls[0]
    expect(calledProps.is_admin).toBe(true)
    expect(calledProps.role).toBe('admin')
  })

  it('does not call identifyUser when profile row is null', async () => {
    mockProfileRow = null

    const { useAnalyticsIdentify } = await import('../useAnalyticsIdentify')
    renderHook(() => useAnalyticsIdentify())

    await capturedAuthCallback!('SIGNED_IN', MOCK_SESSION)

    expect(mockIdentifyUser).not.toHaveBeenCalled()
  })

  it('swallows profile-fetch errors without throwing', async () => {
    mockProfileError = new Error('DB error')

    const { useAnalyticsIdentify } = await import('../useAnalyticsIdentify')
    renderHook(() => useAnalyticsIdentify())

    // Must not throw
    await expect(capturedAuthCallback!('SIGNED_IN', MOCK_SESSION)).resolves.toBeUndefined()
    expect(mockIdentifyUser).not.toHaveBeenCalled()
  })

  it('calls resetAnalytics on SIGNED_OUT', async () => {
    const { useAnalyticsIdentify } = await import('../useAnalyticsIdentify')
    renderHook(() => useAnalyticsIdentify())

    await capturedAuthCallback!('SIGNED_OUT', null)

    expect(mockResetAnalytics).toHaveBeenCalledTimes(1)
    expect(mockIdentifyUser).not.toHaveBeenCalled()
  })

  it('does not call identifyUser or resetAnalytics for other auth events', async () => {
    const { useAnalyticsIdentify } = await import('../useAnalyticsIdentify')
    renderHook(() => useAnalyticsIdentify())

    await capturedAuthCallback!('TOKEN_REFRESHED', MOCK_SESSION)
    await capturedAuthCallback!('USER_UPDATED', MOCK_SESSION)

    expect(mockIdentifyUser).not.toHaveBeenCalled()
    expect(mockResetAnalytics).not.toHaveBeenCalled()
  })

  it('unsubscribes from auth state changes on unmount', async () => {
    const { useAnalyticsIdentify } = await import('../useAnalyticsIdentify')
    const { unmount } = renderHook(() => useAnalyticsIdentify())

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
