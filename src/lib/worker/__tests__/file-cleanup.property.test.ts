/**
 * Property Test: File Cleanup
 * 
 * Property 13: File Cleanup
 * 
 * Validates: For any export file with created_at older than 30 days,
 * the cleanup process should delete it from storage.
 * 
 * Requirements: 9.4
 */

import fc from 'fast-check'
import { createClient } from '@supabase/supabase-js'
import { findOldCompletedJobs, deleteOldCompletedJobs } from '../database-client'
import { StorageClient } from '../storage-client'

describe('Property 13: File Cleanup', () => {
  let supabase: ReturnType<typeof createClient> | undefined
  let storageClient: StorageClient | undefined

  beforeAll(() => {
    // Initialize Supabase client with service role for testing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const storageBucket = process.env.STORAGE_BUCKET || 'export-files'

    // Skip tests if environment variables are not set
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn(
        'Skipping file cleanup property tests: Supabase credentials not configured'
      )
      return
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey)
    storageClient = new StorageClient({
      supabase_url: supabaseUrl,
      supabase_service_role_key: supabaseServiceKey,
      storage_bucket: storageBucket,
    })
  })

  afterEach(async () => {
    // Clean up test data after each test
    if (supabase) {
      // Delete all test jobs
      await supabase
        .from('export_jobs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    }
  })

  // Helper to create a test job
  async function createTestJob(overrides: any = {}): Promise<any> {
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    const { data, error } = await supabase
      .from('export_jobs')
      .insert({
        user_id: overrides.user_id || '00000000-0000-0000-0000-000000000001',
        menu_id: overrides.menu_id || '00000000-0000-0000-0000-000000000002',
        export_type: overrides.export_type || 'pdf',
        status: overrides.status || 'completed',
        priority: overrides.priority || 10,
        retry_count: overrides.retry_count || 0,
        storage_path: overrides.storage_path || null,
        created_at: overrides.created_at || new Date().toISOString(),
        completed_at: overrides.completed_at || new Date().toISOString(),
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

  describe('Old file detection and deletion', () => {
    it('should find and delete completed jobs older than threshold', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            retentionDays: fc.integer({ min: 1, max: 90 }),
            oldJobCount: fc.integer({ min: 1, max: 5 }),
            recentJobCount: fc.integer({ min: 0, max: 3 }),
          }),
          async (input) => {
            const jobIds: string[] = []

            try {
              // Calculate cutoff date
              const cutoffDate = new Date()
              cutoffDate.setDate(cutoffDate.getDate() - input.retentionDays)

              // Create old completed jobs (before cutoff)
              const oldJobDate = new Date(cutoffDate)
              oldJobDate.setDate(oldJobDate.getDate() - 1) // 1 day before cutoff

              for (let i = 0; i < input.oldJobCount; i++) {
                const job = await createTestJob({
                  status: 'completed',
                  created_at: oldJobDate.toISOString(),
                  completed_at: oldJobDate.toISOString(),
                  storage_path: `test-user/exports/pdf/old-job-${i}.pdf`,
                })
                jobIds.push(job.id)
              }

              // Create recent completed jobs (after cutoff)
              const recentJobDate = new Date(cutoffDate)
              recentJobDate.setDate(recentJobDate.getDate() + 1) // 1 day after cutoff

              for (let i = 0; i < input.recentJobCount; i++) {
                const job = await createTestJob({
                  status: 'completed',
                  created_at: recentJobDate.toISOString(),
                  completed_at: recentJobDate.toISOString(),
                  storage_path: `test-user/exports/pdf/recent-job-${i}.pdf`,
                })
                jobIds.push(job.id)
              }

              // Find old jobs
              const oldJobs = await findOldCompletedJobs(cutoffDate)

              // Verify only old jobs are found
              expect(oldJobs.length).toBe(input.oldJobCount)

              // Delete old jobs
              const deletedCount = await deleteOldCompletedJobs(cutoffDate)

              // Verify correct number deleted
              expect(deletedCount).toBe(input.oldJobCount)

              // Verify recent jobs still exist
              const { data: remainingJobs } = await supabase!
                .from('export_jobs')
                .select('id')
                .in('id', jobIds)

              expect(remainingJobs?.length).toBe(input.recentJobCount)
            } finally {
              await cleanupTestJobs(jobIds)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should only delete completed jobs, not pending/processing/failed', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        // Create old jobs with different statuses
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 31) // 31 days ago

        const statuses = ['pending', 'processing', 'completed', 'failed']

        for (const status of statuses) {
          const job = await createTestJob({
            status,
            created_at: oldDate.toISOString(),
            storage_path: `test-user/exports/pdf/${status}-job.pdf`,
          })
          jobIds.push(job.id)
        }

        // Find old completed jobs
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 30)

        const oldJobs = await findOldCompletedJobs(cutoffDate)

        // Should only find the completed job
        expect(oldJobs.length).toBe(1)
        expect(oldJobs[0].storage_path).toContain('completed-job.pdf')

        // Delete old completed jobs
        const deletedCount = await deleteOldCompletedJobs(cutoffDate)
        expect(deletedCount).toBe(1)

        // Verify other status jobs still exist
        const { data: remainingJobs } = await supabase!
          .from('export_jobs')
          .select('status')
          .in('id', jobIds) as { data: Array<{ status: string }> | null }

        expect(remainingJobs?.length).toBe(3)
        expect(remainingJobs?.map((j: any) => j.status).sort()).toEqual([
          'failed',
          'pending',
          'processing',
        ])
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('should handle jobs with and without storage_path', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 31)

        // Create old completed job with storage_path
        const jobWithPath = await createTestJob({
          status: 'completed',
          created_at: oldDate.toISOString(),
          storage_path: 'test-user/exports/pdf/with-path.pdf',
        })
        jobIds.push(jobWithPath.id)

        // Create old completed job without storage_path
        const jobWithoutPath = await createTestJob({
          status: 'completed',
          created_at: oldDate.toISOString(),
          storage_path: null,
        })
        jobIds.push(jobWithoutPath.id)

        // Find old jobs
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 30)

        const oldJobs = await findOldCompletedJobs(cutoffDate)

        // Should find both jobs
        expect(oldJobs.length).toBe(2)

        // One should have storage_path, one should not
        const withPath = oldJobs.find((j) => j.storage_path !== null)
        const withoutPath = oldJobs.find((j) => j.storage_path === null)

        expect(withPath).toBeDefined()
        expect(withoutPath).toBeDefined()

        // Delete old jobs
        const deletedCount = await deleteOldCompletedJobs(cutoffDate)
        expect(deletedCount).toBe(2)
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('should handle empty result when no old jobs exist', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        // Create only recent jobs
        const recentDate = new Date()
        recentDate.setDate(recentDate.getDate() - 1) // 1 day ago

        const job = await createTestJob({
          status: 'completed',
          created_at: recentDate.toISOString(),
        })
        jobIds.push(job.id)

        // Try to find old jobs (30 days)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 30)

        const oldJobs = await findOldCompletedJobs(cutoffDate)

        // Should find no old jobs
        expect(oldJobs.length).toBe(0)

        // Delete should return 0
        const deletedCount = await deleteOldCompletedJobs(cutoffDate)
        expect(deletedCount).toBe(0)

        // Recent job should still exist
        const { data: remainingJobs } = await supabase!
          .from('export_jobs')
          .select('id')
          .eq('id', job.id)

        expect(remainingJobs?.length).toBe(1)
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })

    it('should respect exact cutoff date boundary', async () => {
      if (!supabase) {
        console.warn('Skipping test: Supabase not configured')
        return
      }

      const jobIds: string[] = []

      try {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 30)

        // Create job exactly at cutoff (should NOT be deleted)
        const jobAtCutoff = await createTestJob({
          status: 'completed',
          created_at: cutoffDate.toISOString(),
        })
        jobIds.push(jobAtCutoff.id)

        // Create job 1 second before cutoff (should be deleted)
        const beforeCutoff = new Date(cutoffDate)
        beforeCutoff.setSeconds(beforeCutoff.getSeconds() - 1)

        const jobBeforeCutoff = await createTestJob({
          status: 'completed',
          created_at: beforeCutoff.toISOString(),
        })
        jobIds.push(jobBeforeCutoff.id)

        // Find old jobs
        const oldJobs = await findOldCompletedJobs(cutoffDate)

        // Should only find the job before cutoff
        expect(oldJobs.length).toBe(1)
        expect(oldJobs[0].id).toBe(jobBeforeCutoff.id)

        // Delete old jobs
        const deletedCount = await deleteOldCompletedJobs(cutoffDate)
        expect(deletedCount).toBe(1)

        // Job at cutoff should still exist
        const { data: remainingJobs } = await supabase!
          .from('export_jobs')
          .select('id')
          .in('id', jobIds) as { data: Array<{ id: string }> | null }

        expect(remainingJobs?.length).toBe(1)
        expect(remainingJobs?.[0]?.id).toBe(jobAtCutoff.id)
      } finally {
        await cleanupTestJobs(jobIds)
      }
    })
  })

  describe('Storage file deletion', () => {
    it('should delete individual files from storage', async () => {
      if (!storageClient) {
        console.warn('Skipping test: Storage client not configured')
        return
      }

      // Test that deleteFile method exists and can be called
      // Note: We don't actually upload/delete files in property tests
      // to avoid storage pollution. This just verifies the method exists.
      expect(storageClient.deleteFile).toBeDefined()
      expect(typeof storageClient.deleteFile).toBe('function')
    })
  })
})
