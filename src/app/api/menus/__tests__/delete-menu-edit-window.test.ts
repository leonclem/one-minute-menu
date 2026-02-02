import { DELETE } from '@/app/api/menus/[menuId]/route'
import { DatabaseError, menuOperations } from '@/lib/database'

// Silence expected error logging from the route under test
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  ;(console.error as jest.Mock).mockRestore?.()
})

jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    },
  }),
}))

jest.mock('@/lib/database', () => ({
  // Preserve DatabaseError class shape for instanceof checks in route
  DatabaseError: class DatabaseError extends Error {
    code?: string
    constructor(message: string, code?: string) {
      super(message)
      this.name = 'DatabaseError'
      this.code = code
    }
  },
  menuOperations: {
    deleteMenu: jest.fn(),
    getMenu: jest.fn(),
    updateMenu: jest.fn(),
  },
}))

describe('DELETE /api/menus/[menuId] - edit window expired', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 and EDIT_WINDOW_EXPIRED code when deletion is blocked', async () => {
    ;(menuOperations.deleteMenu as jest.Mock).mockRejectedValue(
      new (DatabaseError as any)(
        'Your edit window has expired. Please purchase a new Creator Pack or subscribe to Grid+ for unlimited edits.',
        'EDIT_WINDOW_EXPIRED'
      )
    )

    const res = await DELETE({} as any, { params: { menuId: 'menu-1' } })
    expect(res.status).toBe(403)

    const json = await (res as any).json()
    expect(json.code).toBe('EDIT_WINDOW_EXPIRED')
    expect(json.error).toContain('edit window has expired')
  })
})

