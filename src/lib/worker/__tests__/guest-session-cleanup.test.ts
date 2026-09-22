/**
 * @jest-environment node
 */

const mockFrom = jest.fn()
const mockRpc = jest.fn()
const mockRemove = jest.fn()
const mockDeleteUser = jest.fn()

jest.mock('@/lib/supabase-worker', () => ({
  createWorkerSupabaseClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: () => ({
        remove: (...args: unknown[]) => mockRemove(...args),
      }),
    },
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
      },
    },
  }),
}))

import { GuestSessionCleanup } from '../guest-session-cleanup'

describe('GuestSessionCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRpc.mockResolvedValue({ data: [{ user_id: 'guest-1' }], error: null })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [{ storage_path: 'guest-1/studio/img.png' }],
            error: null,
          }),
      }),
    })
    mockRemove.mockResolvedValue({ error: null })
    mockDeleteUser.mockResolvedValue({ error: null })
  })

  it('deletes expired guest storage then the auth user', async () => {
    const cleanup = new GuestSessionCleanup({
      runImmediately: false,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    })
    const result = await cleanup.runCleanup()
    expect(mockRpc).toHaveBeenCalledWith('studio_list_expired_guest_user_ids', {
      p_idle_hours: 48,
      p_magic_link_grace_days: 7,
    })
    expect(mockRemove).toHaveBeenCalledWith(['guest-1/studio/img.png'])
    expect(mockDeleteUser).toHaveBeenCalledWith('guest-1')
    expect(result).toEqual({ deleted: 1, failed: 0 })
  })
})
