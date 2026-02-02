/**
 * Unit tests for /api/export/jobs endpoints
 * 
 * POST /api/export/jobs:
 * - Valid job creation returns 201
 * - Invalid export_type returns 400
 * - Unauthorized request returns 401
 * - Rate limit exceeded returns 429
 * - Pending job limit exceeded returns 422
 * - Concurrent requests respect rate limits (atomic enforcement)
 * 
 * GET /api/export/jobs/:jobId:
 * - Valid job status query returns 200
 * - Invalid job ID format returns 400
 * - Unauthorized request returns 401
 * - Job not found returns 404
 * - User doesn't own job returns 403
 * 
 * Task 6.4, 19.1, 19.5 - Railway Workers Spec
 */

// Setup Next.js environment polyfills
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder as any
global.TextDecoder = TextDecoder as any

// Mock dependencies BEFORE importing the route
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/database')
jest.mock('@/lib/worker/snapshot')
jest.mock('@/lib/worker/storage-client')

import { POST, GET as GET_LIST } from '@/app/api/export/jobs/route'
import { GET } from '@/app/api/export/jobs/[jobId]/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations, menuOperations } from '@/lib/database'
import { createRenderSnapshot, SnapshotCreationError } from '@/lib/worker/snapshot'
import { StorageClient } from '@/lib/worker/storage-client'
import { NextRequest } from 'next/server'

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>
const mockUserOperations = userOperations as jest.Mocked<typeof userOperations>
const mockMenuOperations = menuOperations as jest.Mocked<typeof menuOperations>
const mockCreateRenderSnapshot = createRenderSnapshot as jest.MockedFunction<typeof createRenderSnapshot>
const mockStorageClient = StorageClient as jest.MockedClass<typeof StorageClient>

// Test constants
const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174001'
const TEST_MENU_ID = '123e4567-e89b-12d3-a456-426614174002'
const TEST_JOB_ID = '123e4567-e89b-12d3-a456-426614174003'

describe('POST /api/export/jobs', () => {
  let mockSupabase: any
  
  /**
   * Helper to setup Supabase mock with rate limit counts
   */
  function setupSupabaseMock(options: {
    hourlyCount?: number
    pendingCount?: number
    jobCreationSuccess?: boolean
    insertMock?: jest.Mock
  } = {}) {
    const {
      hourlyCount = 0,
      pendingCount = 0,
      jobCreationSuccess = true,
      insertMock
    } = options
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'export_jobs') {
        return {
          select: jest.fn((columns: string, opts?: any) => {
            // For count queries (rate limiting)
            if (opts?.count === 'exact' && opts?.head === true) {
              return {
                eq: jest.fn(() => ({
                  gte: jest.fn(() => ({ count: hourlyCount, error: null })),
                  in: jest.fn(() => ({ count: pendingCount, error: null }))
                }))
              }
            }
            // For estimateWaitTime query (pending jobs with available_at filter)
            return {
              eq: jest.fn(() => ({
                lte: jest.fn(() => ({ count: 0, error: null }))
              }))
            }
          }),
          insert: insertMock || jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: jobCreationSuccess ? {
                  id: TEST_JOB_ID,
                  created_at: new Date().toISOString()
                } : null,
                error: jobCreationSuccess ? null : { message: 'Insert failed' }
              }))
            }))
          }))
        }
      }
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({ count: 0, error: null })),
            in: jest.fn(() => ({ count: 0, error: null }))
          }))
        }))
      }
    })
  }
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn()
    }
    
    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase)
    
    // Default setup with no rate limits
    setupSupabaseMock()
  })
  
  /**
   * Helper to create a mock NextRequest
   */
  function createMockRequest(body: any): NextRequest {
    return {
      json: async () => body,
      headers: new Headers(),
      method: 'POST',
      url: 'http://localhost:3000/api/export/jobs',
      body: JSON.stringify(body)
    } as any as NextRequest
  }
  
  /**
   * Test: Valid job creation returns 201
   */
  describe('valid job creation', () => {
    it('should return 201 with job_id for valid PDF export request', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: TEST_MENU_ID,
        name: 'Test Menu',
        user_id: TEST_USER_ID
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: TEST_USER_ID,
        plan: 'free',
        role: 'user'
      } as any)
      
      mockCreateRenderSnapshot.mockResolvedValue({
        template_id: 'elegant-dark',
        template_version: '1.0',
        menu_data: { items: [] }
      })
      
      setupSupabaseMock({ jobCreationSuccess: true })
      
      // Create request
      const request = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf',
        metadata: {
          format: 'A4',
          orientation: 'portrait'
        }
      })
      
      // Execute
      const response = await POST(request)
      const data = await response.json()
      
      // Assert
      expect(response.status).toBe(201)
      expect(data).toHaveProperty('job_id', TEST_JOB_ID)
      expect(data).toHaveProperty('status', 'pending')
      expect(data).toHaveProperty('created_at')
    })
    
    it('should return 201 with job_id for valid image export request', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: TEST_MENU_ID,
        name: 'Test Menu',
        user_id: TEST_USER_ID
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: TEST_USER_ID,
        plan: 'free',
        role: 'user'
      } as any)
      
      mockCreateRenderSnapshot.mockResolvedValue({
        template_id: 'elegant-dark',
        template_version: '1.0',
        menu_data: { items: [] }
      })
      
      // Create request
      const request = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'image'
      })
      
      // Execute
      const response = await POST(request)
      const data = await response.json()
      
      // Assert
      expect(response.status).toBe(201)
      expect(data).toHaveProperty('job_id', TEST_JOB_ID)
      expect(data).toHaveProperty('status', 'pending')
    })
    
    it('should set priority to 100 for subscriber users', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: TEST_MENU_ID,
        name: 'Test Menu',
        user_id: TEST_USER_ID
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: TEST_USER_ID,
        plan: 'grid_plus',
        role: 'user'
      } as any)
      
      mockCreateRenderSnapshot.mockResolvedValue({
        template_id: 'elegant-dark',
        template_version: '1.0',
        menu_data: { items: [] }
      })
      
      const insertMock = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: TEST_JOB_ID,
              created_at: new Date().toISOString()
            },
            error: null
          }))
        }))
      }))
      
      setupSupabaseMock({ insertMock })
      
      // Create request
      const request = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf'
      })
      
      // Execute
      await POST(request)
      
      // Assert - check that insert was called with priority 100
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 100
        })
      )
    })
    
    it('should set priority to 10 for free users', async () => {
      // Setup mocks
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: TEST_MENU_ID,
        name: 'Test Menu',
        user_id: TEST_USER_ID
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: TEST_USER_ID,
        plan: 'free',
        role: 'user'
      } as any)
      
      mockCreateRenderSnapshot.mockResolvedValue({
        template_id: 'elegant-dark',
        template_version: '1.0',
        menu_data: { items: [] }
      })
      
      const insertMock = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: TEST_JOB_ID,
              created_at: new Date().toISOString()
            },
            error: null
          }))
        }))
      }))
      
      setupSupabaseMock({ insertMock })
      
      // Create request
      const request = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf'
      })
      
      // Execute
      await POST(request)
      
      // Assert - check that insert was called with priority 10
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 10
        })
      )
    })
  })
  
  /**
   * Test: Invalid export_type returns 400
   */
  describe('invalid export_type', () => {
    it('should return 400 for invalid export_type', async () => {
      const request = createMockRequest({
        menu_id: 'menu-123',
        export_type: 'invalid'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'INVALID_EXPORT_TYPE')
      expect(data.error).toContain('Invalid export_type')
    })
    
    it('should return 400 for missing export_type', async () => {
      const request = createMockRequest({
        menu_id: 'menu-123'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_EXPORT_TYPE')
    })
    
    it('should return 400 for null export_type', async () => {
      const request = createMockRequest({
        menu_id: 'menu-123',
        export_type: null
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_EXPORT_TYPE')
    })
  })
  
  /**
   * Test: Invalid menu_id returns 400
   */
  describe('invalid menu_id', () => {
    it('should return 400 for invalid menu_id format', async () => {
      const request = createMockRequest({
        menu_id: 'not-a-uuid',
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'INVALID_MENU_ID')
      expect(data.error).toContain('Invalid menu_id')
    })
    
    it('should return 400 for missing menu_id', async () => {
      const request = createMockRequest({
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_MENU_ID')
    })
  })
  
  /**
   * Test: Unauthorized request returns 401
   */
  describe('unauthorized requests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })
      
      const request = createMockRequest({
        menu_id: '123e4567-e89b-12d3-a456-426614174000',
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'UNAUTHORIZED')
      expect(data.error).toContain('Unauthorized')
    })
    
    it('should return 401 when auth.getUser returns error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      })
      
      const request = createMockRequest({
        menu_id: '123e4567-e89b-12d3-a456-426614174000',
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data).toHaveProperty('code', 'UNAUTHORIZED')
    })
  })
  
  /**
   * Test: Menu not found or forbidden returns 403
   */
  describe('menu access control', () => {
    it('should return 403 when menu does not exist', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue(null)
      
      const request = createMockRequest({
        menu_id: '123e4567-e89b-12d3-a456-426614174000',
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(403)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'MENU_NOT_FOUND')
      expect(data.error).toContain('Menu not found')
    })
    
    it('should return 403 when user does not own the menu', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      
      // getMenu returns null when user doesn't own the menu
      mockMenuOperations.getMenu.mockResolvedValue(null)
      
      const request = createMockRequest({
        menu_id: '123e4567-e89b-12d3-a456-426614174000',
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(403)
      expect(data).toHaveProperty('code', 'MENU_NOT_FOUND')
    })
  })
  
  /**
   * Test: Rate limit exceeded returns 429
   */
  describe('rate limiting', () => {
    it('should return 429 when free user exceeds hourly rate limit', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: TEST_MENU_ID,
        name: 'Test Menu',
        user_id: TEST_USER_ID
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: TEST_USER_ID,
        plan: 'free',
        role: 'user'
      } as any)
      
      // Mock rate limit exceeded (10 jobs in past hour)
      setupSupabaseMock({ hourlyCount: 10 })
      
      const request = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(429)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED')
      expect(data.error).toContain('Rate limit exceeded')
      expect(data.error).toContain('10')
    })
    
    it('should return 429 when subscriber exceeds hourly rate limit', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: TEST_MENU_ID,
        name: 'Test Menu',
        user_id: TEST_USER_ID
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: TEST_USER_ID,
        plan: 'grid_plus',
        role: 'user'
      } as any)
      
      // Mock rate limit exceeded (50 jobs in past hour)
      setupSupabaseMock({ hourlyCount: 50 })
      
      const request = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(429)
      expect(data).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED')
      expect(data.error).toContain('50')
    })
  })
  
  /**
   * Test: Pending job limit exceeded returns 422
   */
  describe('pending job limits', () => {
    it('should return 422 when free user exceeds pending job limit', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: TEST_MENU_ID,
        name: 'Test Menu',
        user_id: TEST_USER_ID
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: TEST_USER_ID,
        plan: 'free',
        role: 'user'
      } as any)
      
      // Mock pending limit exceeded (5 pending jobs)
      setupSupabaseMock({ pendingCount: 5 })
      
      const request = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(422)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'PENDING_LIMIT_EXCEEDED')
      expect(data.error).toContain('Pending job limit exceeded')
      expect(data.error).toContain('5')
    })
    
    it('should return 422 when subscriber exceeds pending job limit', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: TEST_MENU_ID,
        name: 'Test Menu',
        user_id: TEST_USER_ID
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: TEST_USER_ID,
        plan: 'grid_plus',
        role: 'user'
      } as any)
      
      // Mock pending limit exceeded (20 pending jobs)
      setupSupabaseMock({ pendingCount: 20 })
      
      const request = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(422)
      expect(data).toHaveProperty('code', 'PENDING_LIMIT_EXCEEDED')
      expect(data.error).toContain('20')
    })
  })
  
  /**
   * Test: Snapshot creation errors
   */
  describe('snapshot creation errors', () => {
    it('should return 400 when snapshot creation fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: TEST_MENU_ID,
        name: 'Test Menu',
        user_id: TEST_USER_ID
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: TEST_USER_ID,
        plan: 'free',
        role: 'user'
      } as any)
      
      setupSupabaseMock()
      
      // Create error that will pass instanceof check
      const snapshotError = Object.create(SnapshotCreationError.prototype)
      snapshotError.message = 'Menu not found'
      snapshotError.code = 'MENU_NOT_FOUND'
      snapshotError.details = { menu_id: TEST_MENU_ID }
      snapshotError.name = 'SnapshotCreationError'
      
      mockCreateRenderSnapshot.mockRejectedValue(snapshotError)
      
      const request = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf'
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error', 'Menu not found')
      expect(data).toHaveProperty('code', 'MENU_NOT_FOUND')
    })
  })
  
  /**
   * Test: Concurrent requests respect rate limits
   * 
   * This test verifies that the atomic rate limit enforcement prevents
   * concurrent requests from exceeding limits. While we can't truly test
   * database-level atomicity in unit tests, we verify the logic flow.
   */
  describe('concurrent request handling', () => {
    it('should check rate limits before each job creation', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
      
      mockMenuOperations.getMenu.mockResolvedValue({
        id: 'menu-123',
        name: 'Test Menu',
        user_id: 'user-123'
      } as any)
      
      mockUserOperations.getProfile.mockResolvedValue({
        id: 'user-123',
        plan: 'free',
        role: 'user'
      } as any)
      
      mockCreateRenderSnapshot.mockResolvedValue({
        template_id: 'elegant-dark',
        template_version: '1.0',
        menu_data: { items: [] }
      })
      
      let callCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'export_jobs') {
          return {
            select: jest.fn((columns: string, opts?: any) => {
              if (opts?.count === 'exact' && opts?.head === true) {
                return {
                  eq: jest.fn(() => ({
                    gte: jest.fn(() => {
                      callCount++
                      // First call: 9 jobs (under limit)
                      // Second call: 10 jobs (at limit, should reject)
                      return { count: callCount === 1 ? 9 : 10, error: null }
                    }),
                    in: jest.fn(() => ({ count: 0, error: null }))
                  }))
                }
              }
              // For estimateWaitTime
              return {
                eq: jest.fn(() => ({
                  lte: jest.fn(() => ({ count: 0, error: null }))
                }))
              }
            }),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: {
                    id: TEST_JOB_ID,
                    created_at: new Date().toISOString()
                  },
                  error: null
                }))
              }))
            }))
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({ count: 0, error: null })),
              in: jest.fn(() => ({ count: 0, error: null }))
            }))
          }))
        }
      })
      
      // First request should succeed
      const request1 = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf'
      })
      
      const response1 = await POST(request1)
      expect(response1.status).toBe(201)
      
      // Second request should be rejected
      const request2 = createMockRequest({
        menu_id: TEST_MENU_ID,
        export_type: 'pdf'
      })
      
      const response2 = await POST(request2)
      expect(response2.status).toBe(429)
    })
  })
})


/**
 * Tests for GET /api/export/jobs/:jobId
 */
describe('GET /api/export/jobs/:jobId', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn()
    }
    
    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase)
  })
  
  /**
   * Helper to create a mock NextRequest for GET
   */
  function createMockGetRequest(jobId: string): NextRequest {
    return {
      headers: new Headers(),
      method: 'GET',
      url: `http://localhost:3000/api/export/jobs/${jobId}`
    } as any as NextRequest
  }
  
  /**
   * Test: Valid job status query returns 200
   */
  describe('valid job status query', () => {
    it('should return 200 with job details for pending job', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: TEST_USER_ID,
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'pending',
                priority: 10,
                retry_count: 0,
                created_at: '2024-01-01T00:00:00Z'
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockGetRequest(TEST_JOB_ID)
      const response = await GET(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toEqual({
        job_id: TEST_JOB_ID,
        status: 'pending',
        export_type: 'pdf',
        menu_id: TEST_MENU_ID,
        priority: 10,
        retry_count: 0,
        created_at: '2024-01-01T00:00:00Z'
      })
    })
    
    it('should return 200 with job details for completed job', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: TEST_USER_ID,
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'completed',
                priority: 100,
                retry_count: 0,
                file_url: 'https://storage.supabase.co/bucket/file.pdf',
                created_at: '2024-01-01T00:00:00Z',
                started_at: '2024-01-01T00:00:10Z',
                completed_at: '2024-01-01T00:00:30Z'
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockGetRequest(TEST_JOB_ID)
      const response = await GET(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toEqual({
        job_id: TEST_JOB_ID,
        status: 'completed',
        export_type: 'pdf',
        menu_id: TEST_MENU_ID,
        priority: 100,
        retry_count: 0,
        file_url: 'https://storage.supabase.co/bucket/file.pdf',
        created_at: '2024-01-01T00:00:00Z',
        started_at: '2024-01-01T00:00:10Z',
        completed_at: '2024-01-01T00:00:30Z'
      })
    })
    
    it('should return 200 with job details for failed job', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: TEST_USER_ID,
                menu_id: TEST_MENU_ID,
                export_type: 'image',
                status: 'failed',
                priority: 10,
                retry_count: 3,
                error_message: 'Rendering timeout exceeded',
                created_at: '2024-01-01T00:00:00Z',
                started_at: '2024-01-01T00:00:10Z',
                completed_at: '2024-01-01T00:02:00Z'
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockGetRequest(TEST_JOB_ID)
      const response = await GET(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toEqual({
        job_id: TEST_JOB_ID,
        status: 'failed',
        export_type: 'image',
        menu_id: TEST_MENU_ID,
        priority: 10,
        retry_count: 3,
        error_message: 'Rendering timeout exceeded',
        created_at: '2024-01-01T00:00:00Z',
        started_at: '2024-01-01T00:00:10Z',
        completed_at: '2024-01-01T00:02:00Z'
      })
    })
    
    it('should return 200 with job details for processing job', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: TEST_USER_ID,
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'processing',
                priority: 100,
                retry_count: 0,
                created_at: '2024-01-01T00:00:00Z',
                started_at: '2024-01-01T00:00:10Z'
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockGetRequest(TEST_JOB_ID)
      const response = await GET(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toEqual({
        job_id: TEST_JOB_ID,
        status: 'processing',
        export_type: 'pdf',
        menu_id: TEST_MENU_ID,
        priority: 100,
        retry_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        started_at: '2024-01-01T00:00:10Z'
      })
    })
  })
  
  /**
   * Test: Invalid job ID format returns 400
   */
  describe('invalid job ID format', () => {
    it('should return 400 for non-UUID job ID', async () => {
      const request = createMockGetRequest('not-a-uuid')
      const response = await GET(request, { params: { jobId: 'not-a-uuid' } })
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'INVALID_JOB_ID')
      expect(data.error).toContain('Invalid job ID format')
    })
    
    it('should return 400 for empty job ID', async () => {
      const request = createMockGetRequest('')
      const response = await GET(request, { params: { jobId: '' } })
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_JOB_ID')
    })
    
    it('should return 400 for malformed UUID', async () => {
      const request = createMockGetRequest('123-456-789')
      const response = await GET(request, { params: { jobId: '123-456-789' } })
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_JOB_ID')
    })
  })
  
  /**
   * Test: Unauthorized request returns 401
   */
  describe('unauthorized requests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })
      
      const request = createMockGetRequest(TEST_JOB_ID)
      const response = await GET(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'UNAUTHORIZED')
      expect(data.error).toContain('Unauthorized')
    })
    
    it('should return 401 when auth.getUser returns error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      })
      
      const request = createMockGetRequest(TEST_JOB_ID)
      const response = await GET(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data).toHaveProperty('code', 'UNAUTHORIZED')
    })
  })
  
  /**
   * Test: Job not found returns 404
   */
  describe('job not found', () => {
    it('should return 404 when job does not exist', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: { message: 'Not found' }
            }))
          }))
        }))
      })
      
      const request = createMockGetRequest(TEST_JOB_ID)
      const response = await GET(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'JOB_NOT_FOUND')
      expect(data.error).toContain('Job not found')
    })
    
    it('should return 404 when query returns null', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockGetRequest(TEST_JOB_ID)
      const response = await GET(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(404)
      expect(data).toHaveProperty('code', 'JOB_NOT_FOUND')
    })
  })
  
  /**
   * Test: User doesn't own job returns 403
   */
  describe('job ownership verification', () => {
    it('should return 403 when user does not own the job', async () => {
      const otherUserId = '123e4567-e89b-12d3-a456-426614174999'
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: otherUserId, // Different user
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'completed',
                priority: 10,
                retry_count: 0,
                created_at: '2024-01-01T00:00:00Z'
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockGetRequest(TEST_JOB_ID)
      const response = await GET(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(403)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'FORBIDDEN')
      expect(data.error).toContain('do not have permission')
    })
  })
})


/**
 * Tests for GET /api/export/jobs (list jobs with pagination)
 */
describe('GET /api/export/jobs', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn()
    }
    
    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase)
  })
  
  /**
   * Helper to create a mock NextRequest for GET with query params
   */
  function createMockListRequest(queryParams: Record<string, string> = {}): NextRequest {
    const params = new URLSearchParams(queryParams)
    const url = `http://localhost:3000/api/export/jobs${params.toString() ? '?' + params.toString() : ''}`
    
    return {
      headers: new Headers(),
      method: 'GET',
      url
    } as any as NextRequest
  }
  
  /**
   * Test: Valid job list query returns 200
   */
  describe('valid job list query', () => {
    it('should return 200 with jobs list and pagination info', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      const mockJobs = [
        {
          id: TEST_JOB_ID,
          status: 'completed',
          export_type: 'pdf',
          menu_id: TEST_MENU_ID,
          created_at: '2024-01-01T00:00:00Z',
          completed_at: '2024-01-01T00:00:30Z',
          file_url: 'https://storage.supabase.co/file.pdf'
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174004',
          status: 'pending',
          export_type: 'image',
          menu_id: TEST_MENU_ID,
          created_at: '2024-01-01T00:01:00Z',
          completed_at: null,
          file_url: null
        }
      ]
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                data: mockJobs,
                error: null,
                count: 2
              }))
            }))
          }))
        }))
      })
      
      const request = createMockListRequest()
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toHaveProperty('jobs')
      expect(data).toHaveProperty('total', 2)
      expect(data).toHaveProperty('limit', 20)
      expect(data).toHaveProperty('offset', 0)
      expect(data.jobs).toHaveLength(2)
      expect(data.jobs[0]).toEqual({
        job_id: TEST_JOB_ID,
        status: 'completed',
        export_type: 'pdf',
        menu_id: TEST_MENU_ID,
        created_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T00:00:30Z',
        file_url: 'https://storage.supabase.co/file.pdf'
      })
    })
    
    it('should return empty list when user has no jobs', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                data: [],
                error: null,
                count: 0
              }))
            }))
          }))
        }))
      })
      
      const request = createMockListRequest()
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.jobs).toEqual([])
      expect(data.total).toBe(0)
    })
  })
  
  /**
   * Test: Pagination parameters work correctly
   */
  describe('pagination', () => {
    it('should respect custom limit parameter', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      let capturedRange: any
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn((start, end) => {
                capturedRange = { start, end }
                return {
                  data: [],
                  error: null,
                  count: 0
                }
              })
            }))
          }))
        }))
      })
      
      const request = createMockListRequest({ limit: '10' })
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.limit).toBe(10)
      expect(capturedRange).toEqual({ start: 0, end: 9 })
    })
    
    it('should respect custom offset parameter', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      let capturedRange: any
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn((start, end) => {
                capturedRange = { start, end }
                return {
                  data: [],
                  error: null,
                  count: 0
                }
              })
            }))
          }))
        }))
      })
      
      const request = createMockListRequest({ offset: '20' })
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.offset).toBe(20)
      expect(capturedRange).toEqual({ start: 20, end: 39 })
    })
    
    it('should cap limit at 100', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                data: [],
                error: null,
                count: 0
              }))
            }))
          }))
        }))
      })
      
      const request = createMockListRequest({ limit: '500' })
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.limit).toBe(100)
    })
    
    it('should return 400 for invalid limit', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      const request = createMockListRequest({ limit: 'invalid' })
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_LIMIT')
    })
    
    it('should return 400 for negative limit', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      const request = createMockListRequest({ limit: '-5' })
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_LIMIT')
    })
    
    it('should return 400 for invalid offset', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      const request = createMockListRequest({ offset: 'invalid' })
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_OFFSET')
    })
    
    it('should return 400 for negative offset', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      const request = createMockListRequest({ offset: '-10' })
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_OFFSET')
    })
  })
  
  /**
   * Test: Status filtering works correctly
   */
  describe('status filtering', () => {
    it('should filter by status when provided', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      let statusFilterApplied = false
      
      // Create a mock query result that can be awaited
      const mockQueryResult = {
        data: [],
        error: null,
        count: 0
      }
      
      // Create the query chain mock
      const rangeResult = {
        ...mockQueryResult,
        eq: jest.fn((field) => {
          if (field === 'status') {
            statusFilterApplied = true
          }
          return mockQueryResult
        })
      }
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => rangeResult)
            }))
          }))
        }))
      })
      
      const request = createMockListRequest({ status: 'completed' })
      const response = await GET_LIST(request)
      
      expect(response.status).toBe(200)
      expect(statusFilterApplied).toBe(true)
    })
    
    it('should return 400 for invalid status', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      const request = createMockListRequest({ status: 'invalid' })
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('code', 'INVALID_STATUS')
      expect(data.error).toContain('pending, processing, completed, failed')
    })
  })
  
  /**
   * Test: Unauthorized request returns 401
   */
  describe('unauthorized requests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })
      
      const request = createMockListRequest()
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data).toHaveProperty('code', 'UNAUTHORIZED')
    })
  })
  
  /**
   * Test: Database errors are handled
   */
  describe('error handling', () => {
    it('should return 500 when database query fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                data: null,
                error: { message: 'Database error' },
                count: null
              }))
            }))
          }))
        }))
      })
      
      const request = createMockListRequest()
      const response = await GET_LIST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data).toHaveProperty('code', 'QUERY_FAILED')
    })
  })
})


/**
 * Tests for POST /api/export/jobs/:jobId/download-url
 * Task 19.3, 19.5 - Railway Workers Spec
 */
describe('POST /api/export/jobs/:jobId/download-url', () => {
  let mockSupabase: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set required environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.EXPORT_STORAGE_BUCKET = 'export-files'
    
    // Setup default Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(),
      storage: {
        from: jest.fn(() => ({
          createSignedUrl: jest.fn()
        }))
      }
    }
    
    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase)
  })
  
  /**
   * Helper to create a mock NextRequest for POST
   */
  function createMockPostRequest(jobId: string): NextRequest {
    return {
      headers: new Headers(),
      method: 'POST',
      url: `http://localhost:3000/api/export/jobs/${jobId}/download-url`,
      json: async () => ({})
    } as any as NextRequest
  }
  
  /**
   * Test: Valid URL regeneration for completed job
   */
  describe('valid URL regeneration', () => {
    it('should return 200 with new signed URL for completed job', async () => {
      // Import the route handler
      const { POST: POST_DOWNLOAD_URL } = require('@/app/api/export/jobs/[jobId]/download-url/route')
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: TEST_USER_ID,
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'completed',
                storage_path: `${TEST_USER_ID}/exports/pdf/${TEST_JOB_ID}.pdf`,
                file_url: 'https://storage.supabase.co/old-url',
                created_at: '2024-01-01T00:00:00Z',
                completed_at: '2024-01-01T00:00:30Z'
              },
              error: null
            }))
          }))
        }))
      })
      
      // Mock StorageClient instance
      const newSignedUrl = 'https://storage.supabase.co/new-signed-url'
      const mockGenerateSignedUrl = jest.fn().mockResolvedValue(newSignedUrl)
      
      mockStorageClient.mockImplementation(() => ({
        generateSignedUrl: mockGenerateSignedUrl,
        upload: jest.fn(),
        deleteOldFiles: jest.fn(),
        isCircuitBreakerOpen: jest.fn(),
        getCircuitBreakerState: jest.fn()
      } as any))
      
      const request = createMockPostRequest(TEST_JOB_ID)
      const response = await POST_DOWNLOAD_URL(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toHaveProperty('file_url', newSignedUrl)
      expect(data).toHaveProperty('expires_at')
      
      // Verify generateSignedUrl was called with correct parameters
      expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
        `${TEST_USER_ID}/exports/pdf/${TEST_JOB_ID}.pdf`,
        604800 // 7 days in seconds
      )
      
      // Verify expires_at is approximately 7 days from now
      const expiresAt = new Date(data.expires_at)
      const expectedExpiry = new Date(Date.now() + 604800 * 1000)
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime())
      expect(timeDiff).toBeLessThan(5000) // Within 5 seconds
    })
  })
  
  /**
   * Test: Invalid job ID format returns 400
   */
  describe('invalid job ID', () => {
    it('should return 400 for invalid job ID format', async () => {
      const { POST: POST_DOWNLOAD_URL } = require('@/app/api/export/jobs/[jobId]/download-url/route')
      
      const request = createMockPostRequest('not-a-uuid')
      const response = await POST_DOWNLOAD_URL(request, { params: { jobId: 'not-a-uuid' } })
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'INVALID_JOB_ID')
      expect(data.error).toContain('Invalid job ID format')
    })
  })
  
  /**
   * Test: Unauthorized request returns 401
   */
  describe('unauthorized requests', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { POST: POST_DOWNLOAD_URL } = require('@/app/api/export/jobs/[jobId]/download-url/route')
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })
      
      const request = createMockPostRequest(TEST_JOB_ID)
      const response = await POST_DOWNLOAD_URL(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'UNAUTHORIZED')
    })
  })
  
  /**
   * Test: Job not found returns 404
   */
  describe('job not found', () => {
    it('should return 404 when job does not exist', async () => {
      const { POST: POST_DOWNLOAD_URL } = require('@/app/api/export/jobs/[jobId]/download-url/route')
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: { message: 'Not found' }
            }))
          }))
        }))
      })
      
      const request = createMockPostRequest(TEST_JOB_ID)
      const response = await POST_DOWNLOAD_URL(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(404)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'JOB_NOT_FOUND')
    })
  })
  
  /**
   * Test: User doesn't own job returns 403
   */
  describe('job ownership', () => {
    it('should return 403 when user does not own the job', async () => {
      const { POST: POST_DOWNLOAD_URL } = require('@/app/api/export/jobs/[jobId]/download-url/route')
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: 'different-user-id',
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'completed',
                storage_path: 'path/to/file.pdf'
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockPostRequest(TEST_JOB_ID)
      const response = await POST_DOWNLOAD_URL(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(403)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'FORBIDDEN')
    })
  })
  
  /**
   * Test: Non-completed job returns 409
   */
  describe('job status validation', () => {
    it('should return 409 for pending job', async () => {
      const { POST: POST_DOWNLOAD_URL } = require('@/app/api/export/jobs/[jobId]/download-url/route')
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: TEST_USER_ID,
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'pending',
                storage_path: null
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockPostRequest(TEST_JOB_ID)
      const response = await POST_DOWNLOAD_URL(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(409)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'JOB_NOT_COMPLETED')
      expect(data.error).toContain('pending')
    })
    
    it('should return 409 for processing job', async () => {
      const { POST: POST_DOWNLOAD_URL } = require('@/app/api/export/jobs/[jobId]/download-url/route')
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: TEST_USER_ID,
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'processing',
                storage_path: null
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockPostRequest(TEST_JOB_ID)
      const response = await POST_DOWNLOAD_URL(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(409)
      expect(data).toHaveProperty('code', 'JOB_NOT_COMPLETED')
      expect(data.error).toContain('processing')
    })
    
    it('should return 409 for failed job', async () => {
      const { POST: POST_DOWNLOAD_URL } = require('@/app/api/export/jobs/[jobId]/download-url/route')
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: TEST_USER_ID,
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'failed',
                storage_path: null,
                error_message: 'Rendering failed'
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockPostRequest(TEST_JOB_ID)
      const response = await POST_DOWNLOAD_URL(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(409)
      expect(data).toHaveProperty('code', 'JOB_NOT_COMPLETED')
      expect(data.error).toContain('failed')
    })
  })
  
  /**
   * Test: Missing storage path returns 500
   */
  describe('storage path validation', () => {
    it('should return 500 when storage_path is missing for completed job', async () => {
      const { POST: POST_DOWNLOAD_URL } = require('@/app/api/export/jobs/[jobId]/download-url/route')
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: TEST_JOB_ID,
                user_id: TEST_USER_ID,
                menu_id: TEST_MENU_ID,
                export_type: 'pdf',
                status: 'completed',
                storage_path: null, // Missing storage path
                file_url: 'https://storage.supabase.co/old-url'
              },
              error: null
            }))
          }))
        }))
      })
      
      const request = createMockPostRequest(TEST_JOB_ID)
      const response = await POST_DOWNLOAD_URL(request, { params: { jobId: TEST_JOB_ID } })
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'STORAGE_PATH_MISSING')
    })
  })
})
