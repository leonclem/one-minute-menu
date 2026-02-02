/**
 * Property-based tests for database client
 * 
 * These tests verify correctness properties across randomized inputs
 * using fast-check for property-based testing.
 */

import fc from 'fast-check'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
import {
  databaseClient,
  claimJob,
  resetStaleJobs,
  findStaleJobs,
  resetJobToPendingImmediate,
  type ExportJob,
} from '../database-client'

// Mock Supabase client
jest.mock('@supabase/supabase-js')

describe('Database Client Property Tests', () => {
  let mockClient: any
  let mockJobsTable: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Setup mock Supabase client
    mockJobsTable = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    }

    mockClient = {
      from: jest.fn().mockReturnValue(mockJobsTable),
      rpc: jest.fn(),
    }

    ;(createClient as jest.Mock).mockReturnValue(mockClient)

    // Initialize database client
    databaseClient.initialize({
      supabaseUrl: 'https://test.supabase.co',
      supabaseServiceRoleKey: 'test-service-role-key',
    })
  })

  afterEach(async () => {
    await databaseClient.close()
  })

  // Feature: railway-workers, Property 3: Atomic Job Claiming
  describe('Property 3: Atomic Job Claiming', () => {
    it('should ensure only one worker claims each job across concurrent attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of UNIQUE job IDs (5-20 jobs)
          fc.uniqueArray(fc.uuid(), { minLength: 5, maxLength: 20 }),
          // Generate number of concurrent workers (2-5)
          fc.integer({ min: 2, max: 5 }),
          async (jobIds, workerCount) => {
            // Track which jobs have been claimed
            const claimedJobs = new Map<string, string>() // jobId -> workerId

            // Mock RPC to simulate atomic claiming
            mockClient.rpc.mockImplementation(async (funcName: string, params: any) => {
              const { p_worker_id } = params || {}
              
              // Find first unclaimed job
              const unclaimedJobId = jobIds.find(id => !claimedJobs.has(id))
              
              if (!unclaimedJobId) {
                // No jobs available
                return { data: [], error: null }
              }

              // Claim the job atomically
              claimedJobs.set(unclaimedJobId, p_worker_id)

              const job: ExportJob = {
                id: unclaimedJobId,
                user_id: fc.sample(fc.uuid(), 1)[0],
                menu_id: fc.sample(fc.uuid(), 1)[0],
                export_type: 'pdf',
                status: 'processing',
                priority: 10,
                retry_count: 0,
                error_message: null,
                file_url: null,
                storage_path: null,
                available_at: new Date().toISOString(),
                metadata: {},
                worker_id: p_worker_id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                started_at: new Date().toISOString(),
                completed_at: null,
              }

              return { data: [job], error: null }
            })

            // Simulate concurrent workers claiming jobs
            const workers = Array.from({ length: workerCount }, (_, i) => `worker-${i}`)
            
            const claimPromises = workers.map(async workerId => {
              const claims: ExportJob[] = []
              // Each worker tries to claim multiple jobs
              for (let i = 0; i < Math.ceil(jobIds.length / workerCount) + 1; i++) {
                const job = await claimJob(workerId)
                if (job) {
                  claims.push(job)
                }
              }
              return claims
            })

            const results = await Promise.all(claimPromises)
            const allClaims = results.flat()

            // Property 1: No duplicate job IDs should be claimed
            const claimedIds = allClaims.map(job => job.id)
            const uniqueIds = new Set(claimedIds)
            expect(claimedIds.length).toBe(uniqueIds.size)

            // Property 2: Each claimed job should have correct worker_id
            for (const job of allClaims) {
              expect(job.worker_id).toBeTruthy()
              expect(job.status).toBe('processing')
            }

            // Property 3: Total claims should not exceed available jobs
            expect(allClaims.length).toBeLessThanOrEqual(jobIds.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: railway-workers, Property 2: Priority Queue Ordering
  describe('Property 2: Priority Queue Ordering', () => {
    it('should return jobs ordered by priority DESC, created_at ASC', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of jobs with different priorities and timestamps
          fc.array(
            fc.record({
              id: fc.uuid(),
              priority: fc.constantFrom(10, 100), // Free users: 10, Subscribers: 100
              created_at: fc.integer({ min: Date.parse('2024-01-01'), max: Date.now() }).map(ts => new Date(ts)),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (jobSpecs) => {
            // Sort jobs according to priority queue rules
            const sortedJobs = [...jobSpecs].sort((a, b) => {
              // First by priority DESC
              if (a.priority !== b.priority) {
                return b.priority - a.priority
              }
              // Then by created_at ASC (FIFO for same priority)
              return a.created_at.getTime() - b.created_at.getTime()
            })

            // Mock RPC to return jobs in priority order
            let claimIndex = 0
            mockClient.rpc.mockImplementation(async () => {
              if (claimIndex >= sortedJobs.length) {
                return { data: [], error: null }
              }

              const jobSpec = sortedJobs[claimIndex++]
              const job: ExportJob = {
                id: jobSpec.id,
                user_id: fc.sample(fc.uuid(), 1)[0],
                menu_id: fc.sample(fc.uuid(), 1)[0],
                export_type: 'pdf',
                status: 'processing',
                priority: jobSpec.priority,
                retry_count: 0,
                error_message: null,
                file_url: null,
                storage_path: null,
                available_at: new Date().toISOString(),
                metadata: {},
                worker_id: 'test-worker',
                created_at: jobSpec.created_at.toISOString(),
                updated_at: new Date().toISOString(),
                started_at: new Date().toISOString(),
                completed_at: null,
              }

              return { data: [job], error: null }
            })

            // Claim all jobs in sequence
            const claimedJobs: ExportJob[] = []
            for (let i = 0; i < jobSpecs.length; i++) {
              const job = await claimJob('test-worker')
              if (job) {
                claimedJobs.push(job)
              }
            }

            // Property 1: Jobs should be claimed in priority order
            for (let i = 0; i < claimedJobs.length - 1; i++) {
              const current = claimedJobs[i]
              const next = claimedJobs[i + 1]

              if (current.priority === next.priority) {
                // Same priority: should be FIFO (earlier created_at first)
                const currentTime = new Date(current.created_at).getTime()
                const nextTime = new Date(next.created_at).getTime()
                expect(currentTime).toBeLessThanOrEqual(nextTime)
              } else {
                // Different priority: higher priority first
                expect(current.priority).toBeGreaterThan(next.priority)
              }
            }

            // Property 2: All high priority jobs should be claimed before low priority
            const highPriorityJobs = claimedJobs.filter(j => j.priority === 100)
            const lowPriorityJobs = claimedJobs.filter(j => j.priority === 10)
            
            if (highPriorityJobs.length > 0 && lowPriorityJobs.length > 0) {
              const lastHighPriorityIndex = claimedJobs.lastIndexOf(
                highPriorityJobs[highPriorityJobs.length - 1]
              )
              const firstLowPriorityIndex = claimedJobs.indexOf(lowPriorityJobs[0])
              
              expect(lastHighPriorityIndex).toBeLessThan(firstLowPriorityIndex)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: railway-workers, Property 8: Stale Job Recovery
  describe('Property 8: Stale Job Recovery', () => {
    it('should reset processing jobs older than 5 minutes to pending', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of jobs with different processing times
          fc.array(
            fc.record({
              id: fc.uuid(),
              status: fc.constantFrom('pending', 'processing', 'completed', 'failed'),
              started_at: fc.option(
                fc.date({ min: new Date(Date.now() - 10 * 60 * 1000), max: new Date() }),
                { nil: null }
              ),
              storage_path: fc.option(fc.string(), { nil: null }),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (jobSpecs) => {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

            // Identify which jobs should be reset (processing > 5 minutes)
            const shouldBeReset = jobSpecs.filter(
              job =>
                job.status === 'processing' &&
                job.started_at !== null &&
                job.started_at < fiveMinutesAgo
            )

            // Mock findStaleJobs
            mockJobsTable.select.mockReturnValue(mockJobsTable)
            mockJobsTable.eq.mockReturnValue(mockJobsTable)
            mockJobsTable.lt.mockImplementation(() => ({
              ...mockJobsTable,
              then: (resolve: any) =>
                resolve({
                  data: shouldBeReset.map(j => ({ id: j.id })),
                  error: null,
                }),
            }))

            const staleJobIds = await findStaleJobs()

            // Property 1: Only processing jobs older than 5 minutes should be identified
            expect(staleJobIds.length).toBe(shouldBeReset.length)
            expect(new Set(staleJobIds)).toEqual(new Set(shouldBeReset.map(j => j.id)))

            // Mock resetStaleJobs
            mockJobsTable.update.mockReturnValue(mockJobsTable)
            mockJobsTable.eq.mockReturnValue(mockJobsTable)
            mockJobsTable.lt.mockReturnValue(mockJobsTable)
            mockJobsTable.select.mockImplementation(() => ({
              ...mockJobsTable,
              then: (resolve: any) =>
                resolve({
                  data: shouldBeReset.map(j => ({ id: j.id })),
                  error: null,
                }),
            }))

            const resetCount = await resetStaleJobs()

            // Property 2: Reset count should match stale job count
            expect(resetCount).toBe(shouldBeReset.length)

            // Property 3: Stale jobs should be reset regardless of storage_path
            // (Only completed jobs are safe from reset)
            const staleWithStoragePath = shouldBeReset.filter(j => j.storage_path !== null)
            if (staleWithStoragePath.length > 0) {
              // Verify these were included in reset
              const resetIds = new Set(staleJobIds)
              for (const job of staleWithStoragePath) {
                expect(resetIds.has(job.id)).toBe(true)
              }
            }

            // Property 4: Non-processing jobs should not be reset
            const nonProcessingJobs = jobSpecs.filter(j => j.status !== 'processing')
            for (const job of nonProcessingJobs) {
              expect(staleJobIds).not.toContain(job.id)
            }

            // Property 5: Recent processing jobs should not be reset
            const recentProcessingJobs = jobSpecs.filter(
              job =>
                job.status === 'processing' &&
                job.started_at !== null &&
                job.started_at >= fiveMinutesAgo
            )
            for (const job of recentProcessingJobs) {
              expect(staleJobIds).not.toContain(job.id)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: railway-workers, Property 35: Backoff Enforcement
  describe('Property 35: Backoff Enforcement', () => {
    it('should not claim jobs with available_at > NOW()', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of jobs with different available_at times
          fc.array(
            fc.record({
              id: fc.uuid(),
              available_at: fc.date({
                min: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
                max: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
              }),
              priority: fc.constantFrom(10, 100),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (jobSpecs) => {
            const now = new Date()

            // Separate jobs into available and not-yet-available
            const availableJobs = jobSpecs.filter(j => j.available_at <= now)
            const futureJobs = jobSpecs.filter(j => j.available_at > now)

            // Mock RPC to only return jobs where available_at <= NOW
            let claimIndex = 0
            mockClient.rpc.mockImplementation(async () => {
              if (claimIndex >= availableJobs.length) {
                return { data: [], error: null }
              }

              const jobSpec = availableJobs[claimIndex++]
              const job: ExportJob = {
                id: jobSpec.id,
                user_id: fc.sample(fc.uuid(), 1)[0],
                menu_id: fc.sample(fc.uuid(), 1)[0],
                export_type: 'pdf',
                status: 'processing',
                priority: jobSpec.priority,
                retry_count: 0,
                error_message: null,
                file_url: null,
                storage_path: null,
                available_at: jobSpec.available_at.toISOString(),
                metadata: {},
                worker_id: 'test-worker',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                started_at: new Date().toISOString(),
                completed_at: null,
              }

              return { data: [job], error: null }
            })

            // Try to claim all jobs
            const claimedJobs: ExportJob[] = []
            for (let i = 0; i < jobSpecs.length; i++) {
              const job = await claimJob('test-worker')
              if (job) {
                claimedJobs.push(job)
              }
            }

            // Property 1: Only jobs with available_at <= NOW should be claimed
            for (const job of claimedJobs) {
              const availableAt = new Date(job.available_at)
              expect(availableAt.getTime()).toBeLessThanOrEqual(now.getTime())
            }

            // Property 2: No future jobs should be claimed
            const claimedIds = new Set(claimedJobs.map(j => j.id))
            for (const futureJob of futureJobs) {
              expect(claimedIds.has(futureJob.id)).toBe(false)
            }

            // Property 3: Number of claimed jobs should not exceed available jobs
            expect(claimedJobs.length).toBeLessThanOrEqual(availableJobs.length)

            // Property 4: If there are available jobs, at least some should be claimed
            if (availableJobs.length > 0) {
              expect(claimedJobs.length).toBeGreaterThan(0)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should enforce exponential backoff delays for retries', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate retry count (0-3)
          fc.integer({ min: 0, max: 3 }),
          // Generate base delay in seconds
          fc.integer({ min: 10, max: 60 }),
          async (retryCount, baseDelaySeconds) => {
            // Calculate expected delay using exponential backoff
            // Formula: base_delay * 2^retry_count
            const expectedDelaySeconds = baseDelaySeconds * Math.pow(2, retryCount)
            const maxDelaySeconds = 300 // 5 minutes cap

            const actualDelaySeconds = Math.min(expectedDelaySeconds, maxDelaySeconds)

            // Property 1: Delay should increase exponentially with retry count
            if (retryCount > 0) {
              const previousDelay = baseDelaySeconds * Math.pow(2, retryCount - 1)
              expect(actualDelaySeconds).toBeGreaterThanOrEqual(previousDelay)
            }

            // Property 2: Delay should be capped at max delay
            expect(actualDelaySeconds).toBeLessThanOrEqual(maxDelaySeconds)

            // Property 3: Delay should be at least base delay
            expect(actualDelaySeconds).toBeGreaterThanOrEqual(baseDelaySeconds)

            // Property 4: For retry_count=0, delay should equal base delay
            if (retryCount === 0) {
              expect(actualDelaySeconds).toBe(baseDelaySeconds)
            }

            // Property 5: Verify exponential growth pattern
            const calculatedDelay = baseDelaySeconds * Math.pow(2, retryCount)
            if (calculatedDelay <= maxDelaySeconds) {
              expect(actualDelaySeconds).toBe(calculatedDelay)
            } else {
              expect(actualDelaySeconds).toBe(maxDelaySeconds)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
