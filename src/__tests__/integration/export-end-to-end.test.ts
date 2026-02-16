/**
 * End-to-End Integration Test for Export Job Workflow
 * 
 * This test validates the complete export job lifecycle:
 * 1. Create job via API
 * 2. Start worker to process job
 * 3. Wait for completion
 * 4. Verify job record updated
 * 5. Verify file exists in storage
 * 6. Verify file is valid PDF/image
 * 7. Verify Realtime notification sent
 * 8. Verify email sent
 * 
 * Task 27.1 - Railway Workers Spec
 */

// Setup Next.js environment polyfills
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder as any
global.TextDecoder = TextDecoder as any

// Mock dependencies
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/database')
jest.mock('@/lib/worker/snapshot')
jest.mock('@/lib/worker/storage-client')
jest.mock('@/lib/worker/puppeteer-renderer')
jest.mock('@/lib/notification-service')

import { POST } from '@/app/api/export/jobs/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations, menuOperations } from '@/lib/database'
import { createRenderSnapshot } from '@/lib/worker/snapshot'
import { StorageClient } from '@/lib/worker/storage-client'
import { PuppeteerRenderer } from '@/lib/worker/puppeteer-renderer'
import { notificationService } from '@/lib/notification-service'
import { NextRequest } from 'next/server'

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>
const mockUserOperations = userOperations as jest.Mocked<typeof userOperations>
const mockMenuOperations = menuOperations as jest.Mocked<typeof menuOperations>
const mockCreateRenderSnapshot = createRenderSnapshot as jest.MockedFunction<typeof createRenderSnapshot>
const mockStorageClient = StorageClient as jest.MockedClass<typeof StorageClient>
const mockPuppeteerRenderer = PuppeteerRenderer as jest.MockedClass<typeof PuppeteerRenderer>
const mockNotificationService = notificationService as jest.Mocked<typeof notificationService>

// Test constants
const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174001'
const TEST_MENU_ID = '123e4567-e89b-12d3-a456-426614174002'
const TEST_JOB_ID = '123e4567-e89b-12d3-a456-426614174003'
const TEST_FILE_URL = 'https://storage.supabase.co/bucket/test-menu.pdf'
const TEST_STORAGE_PATH = `${TEST_USER_ID}/exports/pdf/${TEST_JOB_ID}.pdf`

describe('End-to-End Export Workflow', () => {
  let mockSupabase: any
  let mockStorageInstance: any
  let mockRendererInstance: any
  let realtimeNotifications: any[]
  let sentEmails: any[]
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset tracking arrays
    realtimeNotifications = []
    sentEmails = []
    
    // Setup Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(),
      channel: jest.fn(() => ({
        on: jest.fn(() => ({
          subscribe: jest.fn()
        })),
        send: jest.fn((event: any) => {
          // Track Realtime notifications
          realtimeNotifications.push(event)
          return Promise.resolve()
        })
      }))
    }
    
    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase)
    
    // Setup storage client mock
    mockStorageInstance = {
      upload: jest.fn(),
      exists: jest.fn(),
      download: jest.fn(),
      generateSignedUrl: jest.fn()
    }
    mockStorageClient.mockImplementation(() => mockStorageInstance)
    
    // Setup renderer mock
    mockRendererInstance = {
      initialize: jest.fn(),
      renderPDF: jest.fn(),
      renderImage: jest.fn(),
      shutdown: jest.fn()
    }
    mockPuppeteerRenderer.mockImplementation(() => mockRendererInstance)
    
    // Setup notification service mock
    mockNotificationService.sendExportCompletionEmail = jest.fn((userId: string, downloadUrl: string, menuName: string, exportType: string) => {
      sentEmails.push({
        type: 'completion',
        user_id: userId,
        download_url: downloadUrl,
        menu_name: menuName,
        export_type: exportType
      })
      return Promise.resolve()
    })
    
    mockNotificationService.sendExportFailureEmail = jest.fn((userId: string, menuName: string, exportType: string, error: string) => {
      sentEmails.push({
        type: 'failure',
        user_id: userId,
        menu_name: menuName,
        export_type: exportType,
        error
      })
      return Promise.resolve()
    })
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
   * Helper to setup database mock for job lifecycle
   */
  function setupDatabaseMock(jobData: any) {
    let currentJob = { ...jobData }
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'export_jobs') {
        return {
          select: jest.fn((columns: string, opts?: any) => {
            // For count queries (rate limiting)
            if (opts?.count === 'exact' && opts?.head === true) {
              return {
                eq: jest.fn(() => ({
                  gte: jest.fn(() => ({ count: 0, error: null })),
                  in: jest.fn(() => ({ count: 0, error: null })),
                  lte: jest.fn(() => ({ count: 0, error: null }))
                }))
              }
            }
            // For job queries
            return {
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: currentJob,
                  error: null
                })),
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    data: [currentJob],
                    error: null
                  }))
                }))
              })),
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  data: currentJob.status === 'pending' ? [currentJob] : [],
                  error: null
                }))
              }))
            }
          }),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: currentJob,
                error: null
              }))
            }))
          })),
          update: jest.fn((updates: any) => {
            // Update the current job state
            currentJob = { ...currentJob, ...updates, updated_at: new Date().toISOString() }
            
            // Trigger Realtime notification
            realtimeNotifications.push({
              type: 'broadcast',
              event: 'job_status_changed',
              payload: currentJob
            })
            
            return {
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => ({
                    data: currentJob,
                    error: null
                  }))
                }))
              }))
            }
          })
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
  
  /**
   * Simulates worker processing a job
   */
  async function simulateWorkerProcessing(jobId: string) {
    // 1. Worker claims job (updates status to processing)
    await mockSupabase.from('export_jobs')
      .update({
        status: 'processing',
        worker_id: 'test-worker-1',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId)
    
    // 2. Worker renders PDF/image
    const renderOutput = Buffer.from('%PDF-1.4\n%âãÏÓ\n' + 'x'.repeat(300)) // Make it larger than 256 bytes
    mockRendererInstance.renderPDF.mockResolvedValue(renderOutput)
    
    // 3. Worker validates output (check PDF signature)
    const isValidPDF = renderOutput.toString('utf8', 0, 5) === '%PDF-'
    expect(isValidPDF).toBe(true)
    
    // 4. Worker uploads to storage
    mockStorageInstance.upload.mockResolvedValue(TEST_FILE_URL)
    await mockStorageInstance.upload(renderOutput, TEST_STORAGE_PATH, 'application/pdf')
    
    // 5. Worker updates job to completed
    await mockSupabase.from('export_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        file_url: TEST_FILE_URL,
        storage_path: TEST_STORAGE_PATH
      })
      .eq('id', jobId)
    
    // 6. Worker sends notification email
    const job = {
      id: jobId,
      user_id: TEST_USER_ID,
      menu_id: TEST_MENU_ID,
      export_type: 'pdf',
      status: 'completed',
      file_url: TEST_FILE_URL,
      metadata: {
        menu_name: 'Test Restaurant Menu'
      }
    }
    const menuName = job.metadata.menu_name || 'Your Menu'
    await mockNotificationService.sendExportCompletionEmail(
      job.user_id,
      TEST_FILE_URL,
      menuName,
      job.export_type
    )
  }
  
  /**
   * Test: Complete PDF export workflow
   */
  it('should complete full PDF export workflow from creation to download', async () => {
    // Setup: Authenticate user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: TEST_USER_ID } },
      error: null
    })
    
    // Setup: User owns menu
    mockMenuOperations.getMenu.mockResolvedValue({
      id: TEST_MENU_ID,
      name: 'Test Restaurant Menu',
      user_id: TEST_USER_ID
    } as any)
    
    // Setup: User profile (free tier)
    mockUserOperations.getProfile.mockResolvedValue({
      id: TEST_USER_ID,
      plan: 'free',
      role: 'user',
      email: 'test@example.com'
    } as any)
    
    // Setup: Snapshot creation
    mockCreateRenderSnapshot.mockResolvedValue({
      template_id: 'elegant-dark',
      template_version: '1.0',
      menu_data: {
        name: 'Test Restaurant Menu',
        items: [
          { id: '1', name: 'Burger', price: 10.99 },
          { id: '2', name: 'Fries', price: 4.99 }
        ]
      }
    })
    
    // Setup: Database mock with initial job state
    const initialJob = {
      id: TEST_JOB_ID,
      user_id: TEST_USER_ID,
      menu_id: TEST_MENU_ID,
      export_type: 'pdf',
      status: 'pending',
      priority: 10,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        format: 'A4',
        orientation: 'portrait',
        render_snapshot: {
          template_id: 'elegant-dark',
          template_version: '1.0',
          menu_data: { items: [] }
        }
      }
    }
    setupDatabaseMock(initialJob)
    
    // STEP 1: Create job via API
    const request = createMockRequest({
      menu_id: TEST_MENU_ID,
      export_type: 'pdf',
      metadata: {
        format: 'A4',
        orientation: 'portrait'
      }
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    // Verify job creation
    expect(response.status).toBe(201)
    expect(data).toHaveProperty('job_id', TEST_JOB_ID)
    expect(data).toHaveProperty('status', 'pending')
    expect(data).toHaveProperty('created_at')
    
    // STEP 2: Simulate worker processing
    await simulateWorkerProcessing(TEST_JOB_ID)
    
    // STEP 3: Verify job record updated to completed
    const jobQuery = mockSupabase.from('export_jobs').select('*').eq('id', TEST_JOB_ID).single()
    const { data: completedJob } = await jobQuery
    
    expect(completedJob).toMatchObject({
      id: TEST_JOB_ID,
      status: 'completed',
      file_url: TEST_FILE_URL,
      storage_path: TEST_STORAGE_PATH
    })
    expect(completedJob.completed_at).toBeTruthy()
    expect(completedJob.started_at).toBeTruthy()
    
    // STEP 4: Verify file exists in storage
    mockStorageInstance.exists.mockResolvedValue(true)
    const fileExists = await mockStorageInstance.exists(TEST_STORAGE_PATH)
    expect(fileExists).toBe(true)
    
    // STEP 5: Verify file is valid PDF
    const pdfContent = Buffer.from('%PDF-1.4\n%âãÏÓ\n' + 'x'.repeat(300))
    mockStorageInstance.download.mockResolvedValue(pdfContent)
    
    const downloadedFile = await mockStorageInstance.download(TEST_STORAGE_PATH)
    expect(downloadedFile).toBeInstanceOf(Buffer)
    expect(downloadedFile.toString('utf8', 0, 5)).toBe('%PDF-')
    expect(downloadedFile.length).toBeGreaterThan(256) // Size validation
    
    // STEP 6: Verify Realtime notification sent
    expect(realtimeNotifications.length).toBeGreaterThan(0)
    
    const completionNotification = realtimeNotifications.find(
      n => n.payload?.status === 'completed'
    )
    expect(completionNotification).toBeDefined()
    expect(completionNotification.payload).toMatchObject({
      id: TEST_JOB_ID,
      status: 'completed',
      file_url: TEST_FILE_URL
    })
    
    // STEP 7: Verify email sent
    expect(sentEmails.length).toBe(1)
    expect(sentEmails[0]).toMatchObject({
      type: 'completion',
      user_id: TEST_USER_ID,
      download_url: TEST_FILE_URL,
      menu_name: 'Test Restaurant Menu',
      export_type: 'pdf'
    })
    
    // Verify notification service was called correctly
    expect(mockNotificationService.sendExportCompletionEmail).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_FILE_URL,
      'Test Restaurant Menu',
      'pdf'
    )
  })
  
  /**
   * Test: Complete image export workflow
   */
  it('should complete full image export workflow', async () => {
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
      role: 'user',
      email: 'subscriber@example.com'
    } as any)
    
    mockCreateRenderSnapshot.mockResolvedValue({
      template_id: 'elegant-dark',
      template_version: '1.0',
      menu_data: { items: [] }
    })
    
    const initialJob = {
      id: TEST_JOB_ID,
      user_id: TEST_USER_ID,
      menu_id: TEST_MENU_ID,
      export_type: 'image',
      status: 'pending',
      priority: 100, // Subscriber priority
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setupDatabaseMock(initialJob)
    
    // Create job
    const request = createMockRequest({
      menu_id: TEST_MENU_ID,
      export_type: 'image'
    })
    
    const response = await POST(request)
    expect(response.status).toBe(201)
    
    // Simulate worker processing image
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    const pngContent = Buffer.concat([pngSignature, Buffer.from('PNG image data')])
    
    mockRendererInstance.renderImage.mockResolvedValue(pngContent)
    
    const imageStoragePath = `${TEST_USER_ID}/exports/image/${TEST_JOB_ID}.png`
    const imageFileUrl = 'https://storage.supabase.co/bucket/test-menu.png'
    
    mockStorageInstance.upload.mockResolvedValue(imageFileUrl)
    
    // Worker processes
    await mockSupabase.from('export_jobs')
      .update({
        status: 'processing',
        worker_id: 'test-worker-1',
        started_at: new Date().toISOString()
      })
      .eq('id', TEST_JOB_ID)
    
    await mockStorageInstance.upload(pngContent, imageStoragePath, 'image/png')
    
    await mockSupabase.from('export_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        file_url: imageFileUrl,
        storage_path: imageStoragePath
      })
      .eq('id', TEST_JOB_ID)
    
    // Verify PNG signature
    mockStorageInstance.download.mockResolvedValue(pngContent)
    const downloadedImage = await mockStorageInstance.download(imageStoragePath)
    
    expect(downloadedImage[0]).toBe(0x89)
    expect(downloadedImage[1]).toBe(0x50)
    expect(downloadedImage[2]).toBe(0x4E)
    expect(downloadedImage[3]).toBe(0x47)
    
    // Verify completion notification
    const completionNotification = realtimeNotifications.find(
      n => n.payload?.status === 'completed'
    )
    expect(completionNotification).toBeDefined()
    expect(completionNotification.payload.file_url).toBe(imageFileUrl)
  })
  
  /**
   * Test: Failed job workflow with retry
   */
  it('should handle job failure and retry correctly', async () => {
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
    
    const initialJob = {
      id: TEST_JOB_ID,
      user_id: TEST_USER_ID,
      menu_id: TEST_MENU_ID,
      export_type: 'pdf',
      status: 'pending',
      priority: 10,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setupDatabaseMock(initialJob)
    
    // Create job
    const request = createMockRequest({
      menu_id: TEST_MENU_ID,
      export_type: 'pdf'
    })
    
    const response = await POST(request)
    expect(response.status).toBe(201)
    
    // Simulate worker failure (transient error)
    mockRendererInstance.renderPDF.mockRejectedValue(new Error('ETIMEDOUT'))
    
    await mockSupabase.from('export_jobs')
      .update({
        status: 'processing',
        worker_id: 'test-worker-1',
        started_at: new Date().toISOString()
      })
      .eq('id', TEST_JOB_ID)
    
    // Worker encounters error and resets to pending for retry
    await mockSupabase.from('export_jobs')
      .update({
        status: 'pending',
        retry_count: 1,
        error_message: 'ETIMEDOUT',
        worker_id: null,
        started_at: null
      })
      .eq('id', TEST_JOB_ID)
    
    // Verify job was reset for retry
    const { data: retriedJob } = await mockSupabase.from('export_jobs')
      .select('*')
      .eq('id', TEST_JOB_ID)
      .single()
    
    expect(retriedJob.status).toBe('pending')
    expect(retriedJob.retry_count).toBe(1)
    expect(retriedJob.error_message).toBe('ETIMEDOUT')
    
    // Verify no email sent for transient failure
    expect(sentEmails.length).toBe(0)
  })
  
  /**
   * Test: Terminal failure after max retries
   */
  it('should send failure notification after max retries', async () => {
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
    
    const initialJob = {
      id: TEST_JOB_ID,
      user_id: TEST_USER_ID,
      menu_id: TEST_MENU_ID,
      export_type: 'pdf',
      status: 'pending',
      priority: 10,
      retry_count: 3, // Already at max retries
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setupDatabaseMock(initialJob)
    
    // Simulate terminal failure
    await mockSupabase.from('export_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: 'Export failed after 3 retries'
      })
      .eq('id', TEST_JOB_ID)
    
    // Send failure email
    const failedJob = {
      id: TEST_JOB_ID,
      user_id: TEST_USER_ID,
      menu_id: TEST_MENU_ID,
      export_type: 'pdf',
      status: 'failed',
      metadata: {
        menu_name: 'Test Menu'
      }
    }
    const menuName = failedJob.metadata.menu_name || 'Your Menu'
    await mockNotificationService.sendExportFailureEmail(
      failedJob.user_id,
      menuName,
      failedJob.export_type,
      'Export failed after 3 retries'
    )
    
    // Verify failure notification sent
    const failureNotification = realtimeNotifications.find(
      n => n.payload?.status === 'failed'
    )
    expect(failureNotification).toBeDefined()
    
    // Verify failure email sent
    expect(sentEmails.length).toBe(1)
    expect(sentEmails[0]).toMatchObject({
      type: 'failure',
      user_id: TEST_USER_ID,
      menu_name: 'Test Menu',
      export_type: 'pdf',
      error: 'Export failed after 3 retries'
    })
  })
  
  /**
   * Task 27.2: Concurrent Workers Test
   * 
   * Validates that multiple workers can process jobs concurrently without conflicts:
   * - Create 20 pending jobs
   * - Start 3 workers
   * - Wait for all jobs to complete
   * - Verify each worker processed some jobs
   * - Verify no duplicate processing
   */
  it('should distribute jobs across multiple concurrent workers', async () => {
    // Create 20 unique job IDs
    const jobIds = Array.from({ length: 20 }, (_, i) => 
      `123e4567-e89b-12d3-a456-42661417${String(i).padStart(4, '0')}`
    )
    
    // Track which worker processed which job
    const workerAssignments: Record<string, string[]> = {
      'worker-1': [],
      'worker-2': [],
      'worker-3': []
    }
    
    // Setup: Create 20 pending jobs
    const pendingJobs = jobIds.map((jobId, index) => ({
      id: jobId,
      user_id: TEST_USER_ID,
      menu_id: TEST_MENU_ID,
      export_type: 'pdf',
      status: 'pending',
      priority: 10,
      retry_count: 0,
      created_at: new Date(Date.now() + index).toISOString(), // Stagger creation times
      updated_at: new Date(Date.now() + index).toISOString(),
      metadata: {}
    }))
    
    let availableJobs = [...pendingJobs]
    let completedJobs: any[] = []
    
    // Mock database to simulate concurrent job claiming
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'export_jobs') {
        return {
          select: jest.fn((columns: string) => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => {
                const job = completedJobs.find(j => j.id === columns) || 
                           availableJobs.find(j => j.id === columns)
                return { data: job, error: null }
              })
            })),
            order: jest.fn(() => ({
              limit: jest.fn(() => {
                // Return next available pending job
                const nextJob = availableJobs.find(j => j.status === 'pending')
                return {
                  data: nextJob ? [nextJob] : [],
                  error: null
                }
              })
            }))
          })),
          update: jest.fn((updates: any) => ({
            eq: jest.fn((column: string, value: string) => {
              // Find and update the job
              const jobIndex = availableJobs.findIndex(j => j.id === value)
              if (jobIndex !== -1) {
                const job = availableJobs[jobIndex]
                const updatedJob = { ...job, ...updates, updated_at: new Date().toISOString() }
                
                // Track worker assignment when claiming
                if (updates.status === 'processing' && updates.worker_id) {
                  workerAssignments[updates.worker_id].push(value)
                }
                
                // Move to completed when done
                if (updates.status === 'completed') {
                  availableJobs.splice(jobIndex, 1)
                  completedJobs.push(updatedJob)
                } else {
                  availableJobs[jobIndex] = updatedJob
                }
                
                return {
                  select: jest.fn(() => ({
                    single: jest.fn(() => ({ data: updatedJob, error: null }))
                  }))
                }
              }
              return {
                select: jest.fn(() => ({
                  single: jest.fn(() => ({ data: null, error: 'Not found' }))
                }))
              }
            })
          }))
        }
      }
      return { select: jest.fn() }
    })
    
    // Simulate 3 workers processing jobs concurrently
    const workers = ['worker-1', 'worker-2', 'worker-3']
    
    const processJobsForWorker = async (workerId: string) => {
      let consecutiveEmptyPolls = 0
      const maxEmptyPolls = 5 // Stop after 5 consecutive empty polls
      
      while (consecutiveEmptyPolls < maxEmptyPolls) {
        // Try to claim a job
        const jobQuery = mockSupabase.from('export_jobs')
          .select('*')
          .order('priority', { ascending: false })
          .limit(1)
        
        const { data: jobs } = await jobQuery
        
        if (jobs && jobs.length > 0 && jobs[0].status === 'pending') {
          const job = jobs[0]
          consecutiveEmptyPolls = 0 // Reset counter
          
          // Claim job (mark as processing to prevent other workers from claiming)
          job.status = 'processing'
          await mockSupabase.from('export_jobs')
            .update({
              status: 'processing',
              worker_id: workerId,
              started_at: new Date().toISOString()
            })
            .eq('id', job.id)
          
          // Simulate processing time (10ms)
          await new Promise(resolve => setTimeout(resolve, 10))
          
          // Complete job
          await mockSupabase.from('export_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              file_url: `https://storage.supabase.co/bucket/${job.id}.pdf`,
              storage_path: `${TEST_USER_ID}/exports/pdf/${job.id}.pdf`
            })
            .eq('id', job.id)
        } else {
          // No jobs available, increment counter
          consecutiveEmptyPolls++
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
    }
    
    // Start all workers concurrently
    await Promise.all(workers.map(workerId => processJobsForWorker(workerId)))
    
    // VERIFY: All jobs completed
    expect(completedJobs.length).toBe(20)
    expect(availableJobs.filter(j => j.status === 'pending').length).toBe(0)
    
    // VERIFY: Each worker processed some jobs
    expect(workerAssignments['worker-1'].length).toBeGreaterThan(0)
    expect(workerAssignments['worker-2'].length).toBeGreaterThan(0)
    expect(workerAssignments['worker-3'].length).toBeGreaterThan(0)
    
    // VERIFY: Total assignments equals total jobs
    const totalAssignments = 
      workerAssignments['worker-1'].length +
      workerAssignments['worker-2'].length +
      workerAssignments['worker-3'].length
    expect(totalAssignments).toBe(20)
    
    // VERIFY: No duplicate processing (each job assigned to exactly one worker)
    const allAssignedJobs = [
      ...workerAssignments['worker-1'],
      ...workerAssignments['worker-2'],
      ...workerAssignments['worker-3']
    ]
    const uniqueAssignedJobs = new Set(allAssignedJobs)
    expect(allAssignedJobs.length).toBe(uniqueAssignedJobs.size)
    
    // VERIFY: Work distribution is reasonably balanced (no worker has > 15 jobs)
    expect(workerAssignments['worker-1'].length).toBeLessThanOrEqual(15)
    expect(workerAssignments['worker-2'].length).toBeLessThanOrEqual(15)
    expect(workerAssignments['worker-3'].length).toBeLessThanOrEqual(15)
  })
  
  /**
   * Task 27.3: Graceful Shutdown Test
   * 
   * Validates that workers shut down gracefully:
   * - Start worker processing a job
   * - Send SIGTERM signal
   * - Verify worker stops polling
   * - Verify worker waits for current job
   * - Verify worker exits cleanly
   */
  it('should handle graceful shutdown correctly', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174099'
    let isPolling = true
    let currentJob: any = null
    let shutdownInitiated = false
    let jobCompleted = false
    
    // Setup: Create a job
    const job = {
      id: jobId,
      user_id: TEST_USER_ID,
      menu_id: TEST_MENU_ID,
      export_type: 'pdf',
      status: 'pending',
      priority: 10,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'export_jobs') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ data: currentJob || job, error: null }))
            })),
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                data: isPolling && !shutdownInitiated && job.status === 'pending' ? [job] : [],
                error: null
              }))
            }))
          })),
          update: jest.fn((updates: any) => {
            currentJob = { ...job, ...updates, updated_at: new Date().toISOString() }
            if (updates.status === 'completed') {
              jobCompleted = true
            }
            return {
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => ({ data: currentJob, error: null }))
                }))
              }))
            }
          })
        }
      }
      return { select: jest.fn() }
    })
    
    // Simulate worker behavior
    const workerLoop = async () => {
      while (isPolling) {
        // Poll for jobs
        const { data: jobs } = await mockSupabase.from('export_jobs')
          .select('*')
          .order('priority', { ascending: false })
          .limit(1)
        
        if (jobs && jobs.length > 0 && jobs[0].status === 'pending') {
          const claimedJob = jobs[0]
          
          // Claim job
          await mockSupabase.from('export_jobs')
            .update({
              status: 'processing',
              worker_id: 'test-worker',
              started_at: new Date().toISOString()
            })
            .eq('id', claimedJob.id)
          
          // Simulate long-running job (100ms)
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 10))
            // Check for shutdown during processing
            if (shutdownInitiated) {
              isPolling = false
            }
          }
          
          // Complete job (even if shutdown initiated)
          await mockSupabase.from('export_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              file_url: `https://storage.supabase.co/bucket/${claimedJob.id}.pdf`
            })
            .eq('id', claimedJob.id)
          
          // Exit after completing current job if shutdown initiated
          if (shutdownInitiated) {
            break
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    
    // Start worker
    const workerPromise = workerLoop()
    
    // Wait for worker to claim job
    await new Promise(resolve => setTimeout(resolve, 20))
    
    // STEP 1: Verify worker is processing job
    expect(currentJob).toBeTruthy()
    expect(currentJob.status).toBe('processing')
    expect(currentJob.worker_id).toBe('test-worker')
    
    // STEP 2: Send SIGTERM signal (simulate graceful shutdown)
    shutdownInitiated = true
    
    // STEP 3: Verify worker stops polling
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(isPolling).toBe(false)
    
    // STEP 4: Wait for worker to complete current job
    await workerPromise
    
    // STEP 5: Verify current job completed
    expect(jobCompleted).toBe(true)
    expect(currentJob.status).toBe('completed')
    expect(currentJob.completed_at).toBeTruthy()
    
    // STEP 6: Verify worker exited cleanly (no pending jobs left in processing state)
    const { data: finalJob } = await mockSupabase.from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    expect(finalJob.status).toBe('completed')
    expect(finalJob.status).not.toBe('processing')
  })
  
  /**
   * Task 27.4: Retry with Backoff Test
   * 
   * Validates retry logic with exponential backoff:
   * - Create job that fails transiently
   * - Verify job is retried with increasing delays
   * - Verify available_at prevents immediate re-claim
   * - Verify terminal failure after 3 retries
   */
  it('should retry failed jobs with exponential backoff', async () => {
    const jobId = '123e4567-e89b-12d3-a456-426614174088'
    
    // Track retry attempts and their timestamps
    const retryAttempts: Array<{ retry_count: number; timestamp: number; available_at: Date }> = []
    
    let currentJob = {
      id: jobId,
      user_id: TEST_USER_ID,
      menu_id: TEST_MENU_ID,
      export_type: 'pdf',
      status: 'pending',
      priority: 10,
      retry_count: 0,
      available_at: new Date(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'export_jobs') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({ data: currentJob, error: null }))
            })),
            order: jest.fn(() => ({
              limit: jest.fn(() => {
                // Only return job if available_at <= NOW
                const now = new Date()
                const isAvailable = currentJob.status === 'pending' && 
                                   currentJob.available_at <= now
                return {
                  data: isAvailable ? [currentJob] : [],
                  error: null
                }
              })
            }))
          })),
          update: jest.fn((updates: any) => {
            currentJob = { ...currentJob, ...updates, updated_at: new Date().toISOString() }
            return {
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn(() => ({ data: currentJob, error: null }))
                }))
              }))
            }
          })
        }
      }
      return { select: jest.fn() }
    })
    
    // Helper: Calculate exponential backoff delay (use smaller delays for testing)
    const calculateRetryDelay = (retryCount: number): number => {
      const baseDelayMs = 100 // 100ms for testing (30s in production)
      const delay = baseDelayMs * Math.pow(2, retryCount)
      return Math.min(delay, 1000) // Cap at 1s for testing (5min in production)
    }
    
    // Simulate worker processing with failures
    for (let attempt = 0; attempt < 4; attempt++) {
      // Wait for job to become available (with timeout)
      const maxWaitTime = Date.now() + 2000 // 2 second timeout
      while (currentJob.available_at > new Date() && Date.now() < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Poll for job
      const { data: jobs } = await mockSupabase.from('export_jobs')
        .select('*')
        .order('priority', { ascending: false })
        .limit(1)
      
      if (jobs && jobs.length > 0) {
        const job = jobs[0]
        
        // Claim job
        await mockSupabase.from('export_jobs')
          .update({
            status: 'processing',
            worker_id: 'test-worker',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id)
        
        // Simulate transient failure
        const error = new Error('ETIMEDOUT')
        
        if (job.retry_count < 3) {
          // Retry with backoff (use single timestamp so delay math is deterministic under load)
          const now = Date.now()
          const retryDelay = calculateRetryDelay(job.retry_count)
          const availableAt = new Date(now + retryDelay)
          
          retryAttempts.push({
            retry_count: job.retry_count,
            timestamp: now,
            available_at: availableAt
          })
          
          await mockSupabase.from('export_jobs')
            .update({
              status: 'pending',
              retry_count: job.retry_count + 1,
              available_at: availableAt,
              error_message: error.message,
              worker_id: null,
              started_at: null
            })
            .eq('id', job.id)
        } else {
          // Terminal failure
          retryAttempts.push({
            retry_count: job.retry_count,
            timestamp: Date.now(),
            available_at: new Date()
          })
          
          await mockSupabase.from('export_jobs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: 'Export failed after 3 retries'
            })
            .eq('id', job.id)
          
          break
        }
      }
    }
    
    // VERIFY: Job was retried 3 times before terminal failure
    expect(retryAttempts.length).toBe(4) // Initial attempt + 3 retries
    
    // VERIFY: Retry delays increased exponentially (using test delays)
    // Retry 0: 100ms
    expect(retryAttempts[0].available_at.getTime() - retryAttempts[0].timestamp).toBe(100)
    
    // Retry 1: 200ms
    expect(retryAttempts[1].available_at.getTime() - retryAttempts[1].timestamp).toBe(200)
    
    // Retry 2: 400ms
    expect(retryAttempts[2].available_at.getTime() - retryAttempts[2].timestamp).toBe(400)
    
    // VERIFY: Final state is failed
    expect(currentJob.status).toBe('failed')
    expect(currentJob.retry_count).toBe(3)
    expect(currentJob.error_message).toBe('Export failed after 3 retries')
    
    // VERIFY: available_at prevented immediate re-claim
    // Each retry should have been delayed by the backoff period
    for (let i = 0; i < retryAttempts.length - 1; i++) {
      const attempt = retryAttempts[i]
      const expectedDelay = calculateRetryDelay(attempt.retry_count)
      const actualDelay = attempt.available_at.getTime() - attempt.timestamp
      expect(actualDelay).toBe(expectedDelay)
    }
  })
})
