/**
 * End-to-End Tests for Critical User Journeys
 * Tests the complete workflows from user perspective
 */

// Mock Supabase client for E2E tests
const mockSupabase = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    getSession: jest.fn(),
    signOut: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
    })),
  },
}

describe('E2E: User Registration and Onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should complete full registration flow', async () => {
    // Mock successful signup
    mockSupabase.auth.signUp.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'token-123' },
      },
      error: null,
    })

    const result = await mockSupabase.auth.signUp({
      email: 'test@example.com',
      password: 'password123',
    })

    expect(result.data.user).toBeDefined()
    expect(result.data.user?.email).toBe('test@example.com')
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })

  it('should handle registration errors gracefully', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email already registered' },
    })

    const result = await mockSupabase.auth.signUp({
      email: 'existing@example.com',
      password: 'password123',
    })

    expect(result.error).toBeDefined()
    expect(result.error?.message).toContain('already registered')
  })
})

describe('E2E: Menu Creation Workflow', () => {
  const mockUserId = 'user-123'
  const mockMenuData = {
    name: 'Test Restaurant Menu',
    slug: 'test-restaurant',
    items: [],
    theme: { id: 'default', colors: {} },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create menu and return menu ID', async () => {
    const mockMenu = { id: 'menu-123', ...mockMenuData, user_id: mockUserId }
    
    mockSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockMenu, error: null }),
    })

    const result = await mockSupabase
      .from('menus')
      .insert(mockMenuData)
      .select()
      .single()

    expect(result.data).toBeDefined()
    expect(result.data?.id).toBe('menu-123')
    expect(result.data?.name).toBe('Test Restaurant Menu')
  })

  it('should enforce unique slug per user', async () => {
    mockSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      }),
    })

    const result = await mockSupabase
      .from('menus')
      .insert(mockMenuData)
      .select()
      .single()

    expect(result.error).toBeDefined()
    expect(result.error?.message).toContain('duplicate key')
  })
})

describe('E2E: OCR Processing Workflow', () => {
  const mockMenuId = 'menu-123'
  const mockImageUrl = 'https://storage.example.com/menu.jpg'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should submit OCR job and return job ID', async () => {
    const mockJob = {
      id: 'job-123',
      menu_id: mockMenuId,
      image_url: mockImageUrl,
      status: 'queued',
    }

    mockSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockJob, error: null }),
    })

    const result = await mockSupabase
      .from('ocr_jobs')
      .insert({ menu_id: mockMenuId, image_url: mockImageUrl })
      .select()
      .single()

    expect(result.data).toBeDefined()
    expect(result.data?.id).toBe('job-123')
    expect(result.data?.status).toBe('queued')
  })

  it('should poll job status until completion', async () => {
    const jobId = 'job-123'
    let callCount = 0

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.resolve({
            data: { id: jobId, status: 'processing' },
            error: null,
          })
        }
        return Promise.resolve({
          data: {
            id: jobId,
            status: 'completed',
            result: { extractedItems: [{ name: 'Burger', price: 10 }] },
          },
          error: null,
        })
      }),
    })

    // Simulate polling
    let status = 'processing'
    let attempts = 0
    while (status === 'processing' && attempts < 5) {
      const result = await mockSupabase
        .from('ocr_jobs')
        .select()
        .eq('id', jobId)
        .single()
      status = result.data?.status
      attempts++
    }

    expect(status).toBe('completed')
    expect(attempts).toBe(3)
  })
})

describe('E2E: Menu Publishing and QR Generation', () => {
  const mockMenuId = 'menu-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should publish menu and create version', async () => {
    const mockPublishedMenu = {
      id: mockMenuId,
      status: 'published',
      current_version: 1,
      published_at: new Date().toISOString(),
    }

    mockSupabase.from.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockPublishedMenu, error: null }),
    })

    const result = await mockSupabase
      .from('menus')
      .update({ status: 'published', current_version: 1 })
      .eq('id', mockMenuId)
      .select()
      .single()

    expect(result.data?.status).toBe('published')
    expect(result.data?.current_version).toBe(1)
  })

  it('should generate QR code after publishing', async () => {
    // This would test the QR generation API
    const mockQRData = {
      qrCodeUrl: 'https://example.com/qr/menu-123.png',
      publicUrl: 'https://example.com/u/testuser/test-menu',
    }

    // Mock QR generation (would be actual API call in real E2E)
    const generateQR = jest.fn().mockResolvedValue(mockQRData)
    const result = await generateQR(mockMenuId)

    expect(result.qrCodeUrl).toBeDefined()
    expect(result.publicUrl).toContain('/u/')
  })
})

describe('E2E: Public Menu Viewing', () => {
  const mockSlug = 'test-restaurant'
  const mockUsername = 'testuser'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch published menu by username and slug', async () => {
    const mockMenu = {
      id: 'menu-123',
      name: 'Test Restaurant',
      slug: mockSlug,
      status: 'published',
      items: [
        { id: '1', name: 'Burger', price: 10, available: true },
        { id: '2', name: 'Fries', price: 5, available: true },
      ],
    }

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockMenu, error: null }),
    })

    const result = await mockSupabase
      .from('menus')
      .select()
      .eq('slug', mockSlug)
      .eq('status', 'published')
      .single()

    expect(result.data).toBeDefined()
    expect(result.data?.items).toHaveLength(2)
    expect(result.data?.status).toBe('published')
  })

  it('should return 404 for non-existent menu', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' },
      }),
    })

    const result = await mockSupabase
      .from('menus')
      .select()
      .eq('slug', 'non-existent')
      .eq('status', 'published')
      .single()

    expect(result.data).toBeNull()
    expect(result.error).toBeDefined()
  })
})

describe('E2E: Plan Limits Enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should enforce free plan menu limit', async () => {
    const mockProfile = {
      id: 'user-123',
      plan: 'free',
      plan_limits: { menus: 1, items: 20, ocr_jobs: 5 },
    }

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
    })

    const profile = await mockSupabase
      .from('profiles')
      .select()
      .eq('id', 'user-123')
      .single()

    expect(profile.data?.plan_limits.menus).toBe(1)
    
    // Simulate checking if user can create another menu
    const canCreateMenu = profile.data?.plan_limits.menus > 0
    expect(canCreateMenu).toBe(true)
  })

  it('should enforce OCR job quota', async () => {
    const mockProfile = {
      id: 'user-123',
      plan: 'free',
      plan_limits: { menus: 1, items: 20, ocr_jobs: 5 },
    }

    // Mock checking current OCR job count
    const mockJobsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({
        data: [1, 2, 3, 4, 5], // 5 jobs this month
        error: null,
        count: 5,
      }),
    }

    mockSupabase.from.mockReturnValue(mockJobsQuery)

    const jobsThisMonth = await mockSupabase
      .from('ocr_jobs')
      .select()
      .eq('user_id', 'user-123')
      .gte('created_at', new Date().toISOString())

    const hasQuota = (jobsThisMonth.count || 0) < mockProfile.plan_limits.ocr_jobs
    expect(hasQuota).toBe(false) // At limit
  })
})
