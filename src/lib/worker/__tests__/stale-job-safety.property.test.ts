/**
 * Property Test: Stale Job Safety
 * 
 * Property 40: Stale Job Safety
 * 
 * Validates: Stale job reset should reset processing jobs regardless of storage_path
 * - Test that only completed jobs are safe from reset
 * - Test that processing jobs with storage_path set can still be reset
 * - Test that repeated processing overwrites cleanly
 * 
 * Requirements: 6.3, 6.4, 6.6, 8.4
 */

import fc from 'fast-check'
import { createClient } from '@supabase/supabase-js'
import { findStaleJobs, resetStaleJobs } from '../database-client'

describe('Property 40: Stale Job Safety', () => {
  let supabase: ReturnType<typeof createClient> | undefined

  beforeAll(() => {
    // Initialize Supabase client with service role for testing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Skip tests if environment variables are not set
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn(
        'Skipping stale job safety property tests: Supabase credentials not configured'
      )
      return
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey)
  })

  afterEach(async () => {
    // Clean up test data after each test
    if (supabase) {
      // Delete all test jobs (keep only system jobs if any)
      await supabase
        .from('export_jobs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    }
  })

  // Helper to create a test job
  async function createTestJob(overrides: any = {}) {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { data, error } = await supabase
      .from('export_jobs')
      .insert({
        user_id: overrides.user_id || '00000000-0000-0000-0000-000000000001',
        menu_id: overrides.menu_id || '00000000-0000-0000-0000-000000000002',
        export_type: overrides.export_type || 'pdf',
        status: overrides.status || 'pending',
        priority: overrides.priority || 10,
        retry_count: overrides.retry_count || 0,
        worker_id: overrides.worker_id || null,
        started_at: overrides.started_at || null,
        storage_path: overrides.storage_path || null,
        available_at: overrides.available_at || new Date().toISOString(),
        metadata: overrides.metadata || {},
        ...overrides,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Helper to clean up test jobs
  async function cleanupTestJobs(jobIds: string[]) {
    if (!supabase || jobIds.length === 0) return
    await supabase.from('export_jobs').delete().in('id', jobIds)
  }

  // Helper to get job by ID
  async function getJob(jobId: string) {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { data, error } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) throw error
    return data
  }

  describe('Stale job reset behavior', () => {
    it('should reset processing jobs regardless of storage_path', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // Whether storage_path is set
          fc.boolean(), // Whether file_url is set
          async (hasStoragePath, hasFileUrl) => {
            const jobIds: string[] = []

            try {
              // Create a stale processing job (started > 5 minutes ago)
              const staleStartTime = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
              const job = await createTestJob({
                status: 'processing',
                worker_id: 'test-worker-1',
                started_at: staleStartTime.toISOString(),
                storage_path: hasStoragePath
                  ? 'user-123/exports/pdf/test-job.pdf'
                  : null,
                file_url: hasFileUrl ? 'https://storage.example.com/test.pdf' : null,
              })
              jobIds.push(job.id)

              // Find and reset stale jobs
              const staleIds = await findStaleJobs()
              expect(staleIds).toContain(job.id)

              const resetCount = await resetStaleJobs()
              expect(resetCount).toBeGreaterThanOrEqual(1)

              // Verify the job was reset to pending
              const updatedJob = await getJob(job.id)
              expect(updatedJob.status).toBe('pending')
              expect(updatedJob.worker_id).toBeNull()
              expect(updatedJob.started_at).toBeNull()
              expect(updatedJob.available_at).toBeTruthy()

              // Storage path and file_url should remain unchanged
              // (they will be overwritten on successful re-processing)
              expect(updatedJob.storage_path).toBe(
                hasStoragePath ? 'user-123/exports/pdf/test-job.pdf' : null
              )
              expect(updatedJob.file_url).toBe(
                hasFileUrl ? 'https://storage.example.com/test.pdf' : null
              )
            } finally {
              await cleanupTestJobs(jobIds)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should NOT reset completed jobs', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // Whether storage_path is set
          fc.boolean(), // Whether file_url is set
          async (hasStoragePath, hasFileUrl) => {
            const jobIds: string[] = []

            try {
              // Create a completed job with old timestamps
              const oldStartTime = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
              const oldCompletedTime = new Date(Date.now() - 9 * 60 * 1000) // 9 minutes ago
              const job = await createTestJob({
                status: 'completed',
                worker_id: 'test-worker-1',
                started_at: oldStartTime.toISOString(),
                completed_at: oldCompletedTime.toISOString(),
                storage_path: hasStoragePath
                  ? 'user-123/exports/pdf/completed-job.pdf'
                  : null,
                file_url: hasFileUrl
                  ? 'https://storage.example.com/completed.pdf'
                  : null,
              })
              jobIds.push(job.id)

              // Try to find and reset stale jobs
              const staleIds = await findStaleJobs()
              expect(staleIds).not.toContain(job.id)

              await resetStaleJobs()

              // Verify the completed job was NOT modified
              const unchangedJob = await getJob(job.id)
              expect(unchangedJob.status).toBe('completed')
              expect(unchangedJob.worker_id).toBe('test-worker-1')
              expect(unchangedJob.started_at).toBe(oldStartTime.toISOString())
              expect(unchangedJob.completed_at).toBe(oldCompletedTime.toISOString())
              expect(unchangedJob.storage_path).toBe(
                hasStoragePath ? 'user-123/exports/pdf/completed-job.pdf' : null
              )
              expect(unchangedJob.file_url).toBe(
                hasFileUrl ? 'https://storage.example.com/completed.pdf' : null
              )
            } finally {
              await cleanupTestJobs(jobIds)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should NOT reset failed jobs', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        // Create a failed job with old timestamps
        const oldStartTime = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
        const job = await createTestJob({
          status: 'failed',
          worker_id: 'test-worker-1',
          started_at: oldStartTime.toISOString(),
          error_message: 'Rendering failed',
        })
        jobIds.push(job.id)

        // Try to find and reset stale jobs
        const staleIds = await findStaleJobs()
        expect(staleIds).not.toContain(job.id)

        await resetStaleJobs()

        // Verify the failed job was NOT modified
        const unchangedJob = await getJob(job.id)
        expect(unchangedJob.status).toBe('failed')
        expect(unchangedJob.worker_id).toBe('test-worker-1')
        expect(unchangedJob.error_message).toBe('Rendering failed')
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('should allow repeated processing to overwrite cleanly', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of processing attempts
          async (numAttempts) => {
            const jobIds: string[] = []

            try {
              // Create a job
              const job = await createTestJob({
                status: 'pending',
              })
              jobIds.push(job.id)

              // Simulate multiple processing attempts with stale resets
              for (let i = 0; i < numAttempts; i++) {
                // Simulate worker claiming the job
                const staleStartTime = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
                await supabase
                  .from('export_jobs')
                  .update({
                    status: 'processing',
                    worker_id: `worker-${i}`,
                    started_at: staleStartTime.toISOString(),
                    storage_path: `user-123/exports/pdf/attempt-${i}.pdf`,
                  })
                  .eq('id', job.id)

                // Reset stale job
                await resetStaleJobs()

                // Verify job is back to pending
                const resetJob = await getJob(job.id)
                expect(resetJob.status).toBe('pending')
                expect(resetJob.worker_id).toBeNull()
                expect(resetJob.started_at).toBeNull()

                // Storage path from previous attempt should still be there
                // (will be overwritten on next successful completion)
                expect(resetJob.storage_path).toBe(
                  `user-123/exports/pdf/attempt-${i}.pdf`
                )
              }

              // Final attempt succeeds
              await supabase
                .from('export_jobs')
                .update({
                  status: 'processing',
                  worker_id: 'final-worker',
                  started_at: new Date().toISOString(),
                  storage_path: 'user-123/exports/pdf/final.pdf',
                })
                .eq('id', job.id)

              await supabase
                .from('export_jobs')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  file_url: 'https://storage.example.com/final.pdf',
                })
                .eq('id', job.id)

              // Verify final state
              const finalJob = await getJob(job.id)
              expect(finalJob.status).toBe('completed')
              expect(finalJob.worker_id).toBe('final-worker')
              expect(finalJob.storage_path).toBe('user-123/exports/pdf/final.pdf')
              expect(finalJob.file_url).toBe('https://storage.example.com/final.pdf')

              // Completed job should not be reset
              const staleIds = await findStaleJobs()
              expect(staleIds).not.toContain(job.id)
            } finally {
              await cleanupTestJobs(jobIds)
            }
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should reset processing jobs with storage_path but no completed_at', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        // Create a processing job that has storage_path set but is not completed
        // This simulates a worker that set storage_path but crashed before marking complete
        const staleStartTime = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
        const job = await createTestJob({
          status: 'processing',
          worker_id: 'crashed-worker',
          started_at: staleStartTime.toISOString(),
          storage_path: 'user-123/exports/pdf/incomplete.pdf',
          file_url: null, // No file_url yet
          completed_at: null, // Not completed
        })
        jobIds.push(job.id)

        // Find and reset stale jobs
        const staleIds = await findStaleJobs()
        expect(staleIds).toContain(job.id)

        const resetCount = await resetStaleJobs()
        expect(resetCount).toBeGreaterThanOrEqual(1)

        // Verify the job was reset despite having storage_path
        const updatedJob = await getJob(job.id)
        expect(updatedJob.status).toBe('pending')
        expect(updatedJob.worker_id).toBeNull()
        expect(updatedJob.started_at).toBeNull()

        // Storage path remains (will be overwritten on retry)
        expect(updatedJob.storage_path).toBe('user-123/exports/pdf/incomplete.pdf')
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('should set available_at to NOW for immediate retry', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        // Create a stale processing job
        const staleStartTime = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
        const job = await createTestJob({
          status: 'processing',
          worker_id: 'test-worker',
          started_at: staleStartTime.toISOString(),
          available_at: staleStartTime.toISOString(), // Old available_at
        })
        jobIds.push(job.id)

        const beforeReset = Date.now()

        // Reset stale jobs
        await resetStaleJobs()

        const afterReset = Date.now()

        // Verify available_at was set to NOW (immediate retry, no backoff)
        const updatedJob = await getJob(job.id)
        expect(updatedJob.status).toBe('pending')

        const availableAt = new Date(updatedJob.available_at).getTime()
        expect(availableAt).toBeGreaterThanOrEqual(beforeReset - 1000) // Allow 1s tolerance
        expect(availableAt).toBeLessThanOrEqual(afterReset + 1000)
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle jobs with exactly 5 minutes processing time', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        // Create a job that started exactly 5 minutes ago
        const exactlyFiveMinutes = new Date(Date.now() - 5 * 60 * 1000)
        const job = await createTestJob({
          status: 'processing',
          worker_id: 'test-worker',
          started_at: exactlyFiveMinutes.toISOString(),
        })
        jobIds.push(job.id)

        // This job should NOT be considered stale (must be > 5 minutes)
        const staleIds = await findStaleJobs()
        expect(staleIds).not.toContain(job.id)
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('should handle jobs with slightly more than 5 minutes processing time', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        // Create a job that started 5 minutes and 1 second ago
        const slightlyStale = new Date(Date.now() - (5 * 60 * 1000 + 1000))
        const job = await createTestJob({
          status: 'processing',
          worker_id: 'test-worker',
          started_at: slightlyStale.toISOString(),
        })
        jobIds.push(job.id)

        // This job SHOULD be considered stale
        const staleIds = await findStaleJobs()
        expect(staleIds).toContain(job.id)

        await resetStaleJobs()

        const updatedJob = await getJob(job.id)
        expect(updatedJob.status).toBe('pending')
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('should handle multiple stale jobs with different storage_path states', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        const staleStartTime = new Date(Date.now() - 6 * 60 * 1000)

        // Job 1: No storage_path
        const job1 = await createTestJob({
          status: 'processing',
          worker_id: 'worker-1',
          started_at: staleStartTime.toISOString(),
          storage_path: null,
        })
        jobIds.push(job1.id)

        // Job 2: Has storage_path
        const job2 = await createTestJob({
          status: 'processing',
          worker_id: 'worker-2',
          started_at: staleStartTime.toISOString(),
          storage_path: 'user-123/exports/pdf/job2.pdf',
        })
        jobIds.push(job2.id)

        // Job 3: Has storage_path and file_url
        const job3 = await createTestJob({
          status: 'processing',
          worker_id: 'worker-3',
          started_at: staleStartTime.toISOString(),
          storage_path: 'user-123/exports/pdf/job3.pdf',
          file_url: 'https://storage.example.com/job3.pdf',
        })
        jobIds.push(job3.id)

        // All should be reset
        const staleIds = await findStaleJobs()
        expect(staleIds).toContain(job1.id)
        expect(staleIds).toContain(job2.id)
        expect(staleIds).toContain(job3.id)

        const resetCount = await resetStaleJobs()
        expect(resetCount).toBeGreaterThanOrEqual(3)

        // Verify all were reset
        const updatedJob1 = await getJob(job1.id)
        const updatedJob2 = await getJob(job2.id)
        const updatedJob3 = await getJob(job3.id)

        expect(updatedJob1.status).toBe('pending')
        expect(updatedJob2.status).toBe('pending')
        expect(updatedJob3.status).toBe('pending')

        expect(updatedJob1.worker_id).toBeNull()
        expect(updatedJob2.worker_id).toBeNull()
        expect(updatedJob3.worker_id).toBeNull()
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })
  })

  describe('Requirements validation', () => {
    it('validates Requirement 6.3: Detect stale jobs (processing > 5 minutes)', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        // Create a stale job
        const staleStartTime = new Date(Date.now() - 6 * 60 * 1000)
        const job = await createTestJob({
          status: 'processing',
          worker_id: 'test-worker',
          started_at: staleStartTime.toISOString(),
        })
        jobIds.push(job.id)

        // Requirement 6.3: System should detect jobs processing > 5 minutes
        const staleIds = await findStaleJobs()
        expect(staleIds).toContain(job.id)
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('validates Requirement 6.4: Reset to pending status', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        const staleStartTime = new Date(Date.now() - 6 * 60 * 1000)
        const job = await createTestJob({
          status: 'processing',
          worker_id: 'test-worker',
          started_at: staleStartTime.toISOString(),
        })
        jobIds.push(job.id)

        // Requirement 6.4: Reset stale jobs to pending
        await resetStaleJobs()

        const updatedJob = await getJob(job.id)
        expect(updatedJob.status).toBe('pending')
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('validates Requirement 6.6: Clear worker_id to allow re-processing', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        const staleStartTime = new Date(Date.now() - 6 * 60 * 1000)
        const job = await createTestJob({
          status: 'processing',
          worker_id: 'crashed-worker',
          started_at: staleStartTime.toISOString(),
        })
        jobIds.push(job.id)

        // Requirement 6.6: Clear worker_id and started_at
        await resetStaleJobs()

        const updatedJob = await getJob(job.id)
        expect(updatedJob.worker_id).toBeNull()
        expect(updatedJob.started_at).toBeNull()
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('validates Requirement 8.4: Stale job recovery enables retry', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        const staleStartTime = new Date(Date.now() - 6 * 60 * 1000)
        const job = await createTestJob({
          status: 'processing',
          worker_id: 'crashed-worker',
          started_at: staleStartTime.toISOString(),
        })
        jobIds.push(job.id)

        // Requirement 8.4: Stale job recovery should enable retry
        await resetStaleJobs()

        const updatedJob = await getJob(job.id)
        expect(updatedJob.status).toBe('pending')
        expect(updatedJob.available_at).toBeTruthy()

        // Job should be immediately available (no backoff for stale resets)
        const availableAt = new Date(updatedJob.available_at).getTime()
        const now = Date.now()
        expect(availableAt).toBeLessThanOrEqual(now + 1000) // Allow 1s tolerance
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })
  })
})
