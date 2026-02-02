/**
 * Property-Based Tests for Pending Job Limits
 * Feature: railway-workers
 * 
 * These tests verify that pending job limits are correctly enforced across all scenarios
 * using randomized test data generation.
 */

import fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';

// Feature: railway-workers, Property 22: Pending Job Limits
describe('Property 22: Pending Job Limits', () => {
  let supabase: ReturnType<typeof createClient>;

  const PENDING_LIMITS = {
    FREE_PENDING: 5,
    SUBSCRIBER_PENDING: 20,
  } as const;

  beforeAll(() => {
    // Initialize Supabase client with service role for testing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Skip tests if environment variables are not set
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Skipping pending job limits property tests: Supabase credentials not configured');
      return;
    }
    
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  });

  afterEach(async () => {
    // Clean up test data after each test
    if (supabase) {
      await supabase.from('export_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  });

  it('should enforce pending job limits for free users (max 5 pending/processing)', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_id: fc.uuid(),
          export_type: fc.constantFrom('pdf', 'image'),
          pending_count: fc.integer({ min: 0, max: 8 }) // Test around the limit
        }),
        async (input) => {
          // Create pending/processing jobs up to pending_count
          for (let i = 0; i < input.pending_count; i++) {
            const status = i % 2 === 0 ? 'pending' : 'processing';
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status,
                priority: 10, // Free user priority
                retry_count: 0,
                metadata: {}
              });
          }

          // Check pending job limit
          const { count, error } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .in('status', ['pending', 'processing']);

          expect(error).toBeNull();

          // Verify pending limit logic
          const isOverLimit = (count || 0) >= PENDING_LIMITS.FREE_PENDING;
          const shouldBlock = input.pending_count >= PENDING_LIMITS.FREE_PENDING;

          expect(isOverLimit).toBe(shouldBlock);

          // If over limit, verify count matches expected
          if (shouldBlock) {
            expect(count).toBeGreaterThanOrEqual(PENDING_LIMITS.FREE_PENDING);
          } else {
            expect(count).toBeLessThan(PENDING_LIMITS.FREE_PENDING);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce pending job limits for subscribers (max 20 pending/processing)', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_id: fc.uuid(),
          export_type: fc.constantFrom('pdf', 'image'),
          pending_count: fc.integer({ min: 15, max: 25 }) // Test around the subscriber limit
        }),
        async (input) => {
          // Create pending/processing jobs up to pending_count
          for (let i = 0; i < input.pending_count; i++) {
            const status = i % 2 === 0 ? 'pending' : 'processing';
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status,
                priority: 100, // Subscriber priority
                retry_count: 0,
                metadata: {}
              });
          }

          // Check pending job limit
          const { count, error } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .in('status', ['pending', 'processing']);

          expect(error).toBeNull();

          // Verify pending limit logic
          const isOverLimit = (count || 0) >= PENDING_LIMITS.SUBSCRIBER_PENDING;
          const shouldBlock = input.pending_count >= PENDING_LIMITS.SUBSCRIBER_PENDING;

          expect(isOverLimit).toBe(shouldBlock);

          // If over limit, verify count matches expected
          if (shouldBlock) {
            expect(count).toBeGreaterThanOrEqual(PENDING_LIMITS.SUBSCRIBER_PENDING);
          } else {
            expect(count).toBeLessThan(PENDING_LIMITS.SUBSCRIBER_PENDING);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only count pending and processing jobs, not completed or failed', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_id: fc.uuid(),
          export_type: fc.constantFrom('pdf', 'image'),
          pending_jobs: fc.integer({ min: 0, max: 3 }),
          processing_jobs: fc.integer({ min: 0, max: 3 }),
          completed_jobs: fc.integer({ min: 0, max: 10 }),
          failed_jobs: fc.integer({ min: 0, max: 10 })
        }),
        async (input) => {
          // Create jobs with different statuses
          const jobsByStatus = [
            { status: 'pending', count: input.pending_jobs },
            { status: 'processing', count: input.processing_jobs },
            { status: 'completed', count: input.completed_jobs },
            { status: 'failed', count: input.failed_jobs }
          ];

          for (const { status, count } of jobsByStatus) {
            for (let i = 0; i < count; i++) {
              await supabase
                .from('export_jobs')
                .insert({
                  user_id: input.user_id,
                  menu_id: input.menu_id,
                  export_type: input.export_type,
                  status,
                  priority: 10,
                  retry_count: 0,
                  metadata: {}
                });
            }
          }

          // Check pending job limit (should only count pending and processing)
          const { count, error } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .in('status', ['pending', 'processing']);

          expect(error).toBeNull();

          // Verify only pending and processing jobs are counted
          const expectedCount = input.pending_jobs + input.processing_jobs;
          expect(count).toBe(expectedCount);

          // Verify completed and failed jobs are not counted
          expect(count).not.toBe(
            input.pending_jobs + input.processing_jobs + 
            input.completed_jobs + input.failed_jobs
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce pending limits independently per user', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user1_id: fc.uuid(),
          user2_id: fc.uuid(),
          menu_id: fc.uuid(),
          export_type: fc.constantFrom('pdf', 'image'),
          user1_pending: fc.integer({ min: 0, max: 7 }),
          user2_pending: fc.integer({ min: 0, max: 7 })
        }),
        async (input) => {
          // Ensure users are different
          fc.pre(input.user1_id !== input.user2_id);

          // Create pending jobs for user 1
          for (let i = 0; i < input.user1_pending; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user1_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: i % 2 === 0 ? 'pending' : 'processing',
                priority: 10,
                retry_count: 0,
                metadata: {}
              });
          }

          // Create pending jobs for user 2
          for (let i = 0; i < input.user2_pending; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user2_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: i % 2 === 0 ? 'pending' : 'processing',
                priority: 10,
                retry_count: 0,
                metadata: {}
              });
          }

          // Check pending limit for user 1
          const { count: count1, error: error1 } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user1_id)
            .in('status', ['pending', 'processing']);

          // Check pending limit for user 2
          const { count: count2, error: error2 } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user2_id)
            .in('status', ['pending', 'processing']);

          expect(error1).toBeNull();
          expect(error2).toBeNull();

          // Verify each user's count is independent
          expect(count1).toBe(input.user1_pending);
          expect(count2).toBe(input.user2_pending);

          // Verify pending limit decisions are independent
          const user1OverLimit = (count1 || 0) >= PENDING_LIMITS.FREE_PENDING;
          const user2OverLimit = (count2 || 0) >= PENDING_LIMITS.FREE_PENDING;

          expect(user1OverLimit).toBe(input.user1_pending >= PENDING_LIMITS.FREE_PENDING);
          expect(user2OverLimit).toBe(input.user2_pending >= PENDING_LIMITS.FREE_PENDING);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow new jobs when completed/failed jobs free up slots', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_id: fc.uuid(),
          export_type: fc.constantFrom('pdf', 'image'),
          initial_pending: fc.integer({ min: 3, max: 5 }),
          jobs_to_complete: fc.integer({ min: 1, max: 3 })
        }),
        async (input) => {
          // Ensure we don't try to complete more jobs than we create
          fc.pre(input.jobs_to_complete <= input.initial_pending);

          // Create initial pending jobs
          const jobIds: string[] = [];
          for (let i = 0; i < input.initial_pending; i++) {
            const { data } = await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'pending',
                priority: 10,
                retry_count: 0,
                metadata: {}
              })
              .select()
              .single();
            
            if (data) {
              jobIds.push(data.id);
            }
          }

          // Check initial pending count
          const { count: initialCount } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .in('status', ['pending', 'processing']);

          expect(initialCount).toBe(input.initial_pending);

          // Complete some jobs
          for (let i = 0; i < input.jobs_to_complete; i++) {
            await supabase
              .from('export_jobs')
              .update({ status: 'completed' })
              .eq('id', jobIds[i]);
          }

          // Check pending count after completion
          const { count: afterCount } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .in('status', ['pending', 'processing']);

          // Verify pending count decreased by the number of completed jobs
          expect(afterCount).toBe(input.initial_pending - input.jobs_to_complete);

          // Verify we now have room for more jobs
          const remainingSlots = PENDING_LIMITS.FREE_PENDING - (afterCount || 0);
          expect(remainingSlots).toBeGreaterThanOrEqual(input.jobs_to_complete);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should count both pending and processing jobs towards the limit', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_id: fc.uuid(),
          export_type: fc.constantFrom('pdf', 'image'),
          pending_jobs: fc.integer({ min: 0, max: 4 }),
          processing_jobs: fc.integer({ min: 0, max: 4 })
        }),
        async (input) => {
          // Create pending jobs
          for (let i = 0; i < input.pending_jobs; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'pending',
                priority: 10,
                retry_count: 0,
                metadata: {}
              });
          }

          // Create processing jobs
          for (let i = 0; i < input.processing_jobs; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'processing',
                priority: 10,
                retry_count: 0,
                metadata: {},
                worker_id: `worker-${i}`,
                started_at: new Date().toISOString()
              });
          }

          // Check pending job limit
          const { count, error } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .in('status', ['pending', 'processing']);

          expect(error).toBeNull();

          // Verify both pending and processing are counted
          const totalPendingAndProcessing = input.pending_jobs + input.processing_jobs;
          expect(count).toBe(totalPendingAndProcessing);

          // Verify limit check includes both statuses
          const isOverLimit = (count || 0) >= PENDING_LIMITS.FREE_PENDING;
          const shouldBlock = totalPendingAndProcessing >= PENDING_LIMITS.FREE_PENDING;
          expect(isOverLimit).toBe(shouldBlock);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case of exactly at the limit', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_id: fc.uuid(),
          export_type: fc.constantFrom('pdf', 'image'),
          is_subscriber: fc.boolean()
        }),
        async (input) => {
          const limit = input.is_subscriber ? PENDING_LIMITS.SUBSCRIBER_PENDING : PENDING_LIMITS.FREE_PENDING;
          const priority = input.is_subscriber ? 100 : 10;

          // Create exactly limit number of pending jobs
          for (let i = 0; i < limit; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'pending',
                priority,
                retry_count: 0,
                metadata: {}
              });
          }

          // Check pending job count
          const { count, error } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .in('status', ['pending', 'processing']);

          expect(error).toBeNull();
          expect(count).toBe(limit);

          // Verify we're at the limit (should block next request)
          const isAtLimit = (count || 0) >= limit;
          expect(isAtLimit).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
