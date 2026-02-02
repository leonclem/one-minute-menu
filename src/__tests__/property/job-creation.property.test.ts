/**
 * Property-Based Tests for Export Job Creation
 * Feature: railway-workers
 * 
 * These tests verify universal properties that should hold across all valid inputs
 * using randomized test data generation.
 */

import fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';

// Feature: railway-workers, Property 1: Job Creation Atomicity
describe('Property 1: Job Creation Atomicity', () => {
  let supabase: ReturnType<typeof createClient> | undefined;

  beforeAll(() => {
    // Initialize Supabase client with service role for testing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Skip tests if environment variables are not set
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Skipping job creation property tests: Supabase credentials not configured');
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

  it('should create exactly one job record with correct fields for any valid export request', async () => {
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
          // Create export job
          const { data: job, error } = await supabase
            .from('export_jobs')
            .insert({
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'pending',
              priority: input.is_subscriber ? 100 : 10,
              retry_count: 0,
              metadata: {}
            })
            .select()
            .single();

          // Verify no error occurred
          expect(error).toBeNull();
          expect(job).toBeDefined();

          // Verify exactly one record exists
          const { data: jobs, error: queryError } = await supabase
            .from('export_jobs')
            .select('*')
            .eq('id', job!.id);

          expect(queryError).toBeNull();
          expect(jobs).toHaveLength(1);

          const createdJob = jobs![0];

          // Verify all required fields are populated
          expect(createdJob.id).toBeTruthy();
          expect(createdJob.user_id).toBe(input.user_id);
          expect(createdJob.menu_id).toBe(input.menu_id);
          expect(createdJob.export_type).toBe(input.export_type);
          expect(createdJob.status).toBe('pending');
          expect(createdJob.retry_count).toBe(0);

          // Verify priority is set correctly based on subscription status
          const expectedPriority = input.is_subscriber ? 100 : 10;
          expect(createdJob.priority).toBe(expectedPriority);

          // Verify timestamps are set
          expect(createdJob.created_at).toBeTruthy();
          expect(createdJob.updated_at).toBeTruthy();
          expect(createdJob.available_at).toBeTruthy();

          // Verify optional fields are null initially
          expect(createdJob.worker_id).toBeNull();
          expect(createdJob.started_at).toBeNull();
          expect(createdJob.completed_at).toBeNull();
          expect(createdJob.error_message).toBeNull();
          expect(createdJob.file_url).toBeNull();
          expect(createdJob.storage_path).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce valid export_type constraint', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_id: fc.uuid(),
          export_type: fc.string().filter(s => s !== 'pdf' && s !== 'image'),
          is_subscriber: fc.boolean()
        }),
        async (input) => {
          // Attempt to create job with invalid export_type
          const { data, error } = await supabase
            .from('export_jobs')
            .insert({
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'pending',
              priority: input.is_subscriber ? 100 : 10,
              retry_count: 0,
              metadata: {}
            })
            .select()
            .single();

          // Verify that invalid export_type is rejected
          expect(error).toBeDefined();
          expect(data).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should enforce valid status constraint', async () => {
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
          status: fc.string().filter(s => !['pending', 'processing', 'completed', 'failed'].includes(s)),
          is_subscriber: fc.boolean()
        }),
        async (input) => {
          // Attempt to create job with invalid status
          const { data, error } = await supabase
            .from('export_jobs')
            .insert({
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: input.status,
              priority: input.is_subscriber ? 100 : 10,
              retry_count: 0,
              metadata: {}
            })
            .select()
            .single();

          // Verify that invalid status is rejected
          expect(error).toBeDefined();
          expect(data).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should set default values correctly when not provided', async () => {
    if (!supabase) {
      console.warn('Skipping test: Supabase not configured');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_id: fc.uuid(),
          export_type: fc.constantFrom('pdf', 'image')
        }),
        async (input) => {
          // Create job with minimal fields (relying on defaults)
          const { data: job, error } = await supabase
            .from('export_jobs')
            .insert({
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type
            })
            .select()
            .single();

          expect(error).toBeNull();
          expect(job).toBeDefined();

          // Verify default values are applied
          expect(job!.status).toBe('pending'); // Default status
          expect(job!.priority).toBe(10); // Default priority
          expect(job!.retry_count).toBe(0); // Default retry_count
          expect(job!.created_at).toBeTruthy();
          expect(job!.updated_at).toBeTruthy();
          expect(job!.available_at).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });
});
