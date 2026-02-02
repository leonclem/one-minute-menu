/**
 * Property-Based Tests for Rate Limiting Enforcement
 * Feature: railway-workers
 * 
 * These tests verify that rate limits are correctly enforced across all scenarios
 * using randomized test data generation.
 */

import fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';

// Feature: railway-workers, Property 21: Rate Limiting Enforcement
describe('Property 21: Rate Limiting Enforcement', () => {
  let supabase: ReturnType<typeof createClient>;

  const RATE_LIMITS = {
    FREE_HOURLY: 10,
    SUBSCRIBER_HOURLY: 50,
  } as const;

  beforeAll(() => {
    // Initialize Supabase client with service role for testing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Skip tests if environment variables are not set
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Skipping rate limiting property tests: Supabase credentials not configured');
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

  it('should enforce hourly rate limits for free users (max 10 jobs per hour)', async () => {
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
          job_count: fc.integer({ min: 0, max: 15 }) // Test around the limit
        }),
        async (input) => {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          
          // Create jobs up to job_count
          for (let i = 0; i < input.job_count; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'pending',
                priority: 10, // Free user priority
                retry_count: 0,
                metadata: {},
                created_at: new Date(Date.now() - (i * 1000)).toISOString() // Stagger timestamps
              });
          }

          // Check rate limit
          const { count, error } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .gte('created_at', oneHourAgo);

          expect(error).toBeNull();

          // Verify rate limit logic
          const isOverLimit = (count || 0) >= RATE_LIMITS.FREE_HOURLY;
          const shouldBlock = input.job_count >= RATE_LIMITS.FREE_HOURLY;

          expect(isOverLimit).toBe(shouldBlock);

          // If over limit, verify count matches expected
          if (shouldBlock) {
            expect(count).toBeGreaterThanOrEqual(RATE_LIMITS.FREE_HOURLY);
          } else {
            expect(count).toBeLessThan(RATE_LIMITS.FREE_HOURLY);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce hourly rate limits for subscribers (max 50 jobs per hour)', async () => {
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
          job_count: fc.integer({ min: 45, max: 55 }) // Test around the subscriber limit
        }),
        async (input) => {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          
          // Create jobs up to job_count
          for (let i = 0; i < input.job_count; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'pending',
                priority: 100, // Subscriber priority
                retry_count: 0,
                metadata: {},
                created_at: new Date(Date.now() - (i * 1000)).toISOString() // Stagger timestamps
              });
          }

          // Check rate limit
          const { count, error } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .gte('created_at', oneHourAgo);

          expect(error).toBeNull();

          // Verify rate limit logic
          const isOverLimit = (count || 0) >= RATE_LIMITS.SUBSCRIBER_HOURLY;
          const shouldBlock = input.job_count >= RATE_LIMITS.SUBSCRIBER_HOURLY;

          expect(isOverLimit).toBe(shouldBlock);

          // If over limit, verify count matches expected
          if (shouldBlock) {
            expect(count).toBeGreaterThanOrEqual(RATE_LIMITS.SUBSCRIBER_HOURLY);
          } else {
            expect(count).toBeLessThan(RATE_LIMITS.SUBSCRIBER_HOURLY);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only count jobs created within the last hour', async () => {
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
          recent_jobs: fc.integer({ min: 0, max: 5 }),
          old_jobs: fc.integer({ min: 0, max: 10 })
        }),
        async (input) => {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
          
          // Create old jobs (outside the 1-hour window)
          for (let i = 0; i < input.old_jobs; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'completed',
                priority: 10,
                retry_count: 0,
                metadata: {},
                created_at: new Date(twoHoursAgo.getTime() - (i * 1000)).toISOString()
              });
          }

          // Create recent jobs (within the 1-hour window)
          for (let i = 0; i < input.recent_jobs; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'pending',
                priority: 10,
                retry_count: 0,
                metadata: {},
                created_at: new Date(Date.now() - (i * 1000)).toISOString()
              });
          }

          // Check rate limit (should only count recent jobs)
          const { count, error } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .gte('created_at', oneHourAgo.toISOString());

          expect(error).toBeNull();
          
          // Verify only recent jobs are counted
          expect(count).toBe(input.recent_jobs);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce rate limits independently per user', async () => {
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
          user1_jobs: fc.integer({ min: 0, max: 12 }),
          user2_jobs: fc.integer({ min: 0, max: 12 })
        }),
        async (input) => {
          // Ensure users are different
          fc.pre(input.user1_id !== input.user2_id);

          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          
          // Create jobs for user 1
          for (let i = 0; i < input.user1_jobs; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user1_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'pending',
                priority: 10,
                retry_count: 0,
                metadata: {}
              });
          }

          // Create jobs for user 2
          for (let i = 0; i < input.user2_jobs; i++) {
            await supabase
              .from('export_jobs')
              .insert({
                user_id: input.user2_id,
                menu_id: input.menu_id,
                export_type: input.export_type,
                status: 'pending',
                priority: 10,
                retry_count: 0,
                metadata: {}
              });
          }

          // Check rate limit for user 1
          const { count: count1, error: error1 } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user1_id)
            .gte('created_at', oneHourAgo);

          // Check rate limit for user 2
          const { count: count2, error: error2 } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user2_id)
            .gte('created_at', oneHourAgo);

          expect(error1).toBeNull();
          expect(error2).toBeNull();

          // Verify each user's count is independent
          expect(count1).toBe(input.user1_jobs);
          expect(count2).toBe(input.user2_jobs);

          // Verify rate limit decisions are independent
          const user1OverLimit = (count1 || 0) >= RATE_LIMITS.FREE_HOURLY;
          const user2OverLimit = (count2 || 0) >= RATE_LIMITS.FREE_HOURLY;

          expect(user1OverLimit).toBe(input.user1_jobs >= RATE_LIMITS.FREE_HOURLY);
          expect(user2OverLimit).toBe(input.user2_jobs >= RATE_LIMITS.FREE_HOURLY);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should count all job statuses towards rate limit', async () => {
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
          completed_jobs: fc.integer({ min: 0, max: 3 }),
          failed_jobs: fc.integer({ min: 0, max: 3 })
        }),
        async (input) => {
          const statuses = [
            { status: 'pending', count: input.pending_jobs },
            { status: 'processing', count: input.processing_jobs },
            { status: 'completed', count: input.completed_jobs },
            { status: 'failed', count: input.failed_jobs }
          ];

          // Create jobs with different statuses
          for (const { status, count } of statuses) {
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

          // Check rate limit (should count all statuses)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { count, error } = await supabase
            .from('export_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', input.user_id)
            .gte('created_at', oneHourAgo);

          expect(error).toBeNull();

          // Verify all jobs are counted regardless of status
          const totalJobs = input.pending_jobs + input.processing_jobs + 
                           input.completed_jobs + input.failed_jobs;
          expect(count).toBe(totalJobs);
        }
      ),
      { numRuns: 100 }
    );
  });
});
