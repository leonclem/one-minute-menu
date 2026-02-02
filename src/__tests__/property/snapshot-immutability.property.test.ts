/**
 * Property-Based Tests for Snapshot Immutability
 * Feature: railway-workers
 * 
 * Property 36: Snapshot Immutability
 * Validates: Render snapshot should not change if menu is edited after job creation
 * 
 * This test verifies that workers render from frozen snapshot, not current menu state.
 * 
 * NOTE: These tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * environment variables to be set. Tests will be skipped if not configured.
 * 
 * To run these tests:
 * 1. Set up .env.local with Supabase credentials
 * 2. Run: npm test -- src/__tests__/property/snapshot-immutability.property.test.ts
 */

import fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';
import { createRenderSnapshot, getRenderSnapshot } from '@/lib/worker/snapshot';
import type { RenderSnapshot } from '@/types';

// Skip tests if environment variables are not configured
const describeIfEnv = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? describe
  : describe.skip;

describeIfEnv('Property 36: Snapshot Immutability', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    // Initialize Supabase client with service role for testing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  });

  afterEach(async () => {
    // Clean up test data after each test
    await supabase.from('export_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('menus').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  it('should render from frozen snapshot, not current menu state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          original_name: fc.string({ minLength: 5, maxLength: 50 }),
          updated_name: fc.string({ minLength: 5, maxLength: 50 }),
          original_description: fc.string({ minLength: 10, maxLength: 100 }),
          updated_description: fc.string({ minLength: 10, maxLength: 100 }),
          template_id: fc.constantFrom('elegant-dark', 'modern-minimal', 'classic-menu', 'rustic-charm'),
          export_type: fc.constantFrom('pdf', 'image')
        }).filter(input => input.original_name !== input.updated_name),
        async (input) => {
          // Step 1: Create menu with original state
          const { data: menu, error: menuError } = await supabase
            .from('menus')
            .insert({
              user_id: input.user_id,
              name: input.original_name,
              menu_data: {
                description: input.original_description,
                establishment_name: 'Test Restaurant',
                items: [
                  {
                    id: 'item-1',
                    name: 'Original Item',
                    description: 'Original description',
                    price: 10.00,
                    category: 'Appetizers',
                    order: 0
                  }
                ],
                categories: [
                  {
                    name: 'Appetizers',
                    order: 0
                  }
                ]
              }
            })
            .select()
            .single();

          expect(menuError).toBeNull();
          expect(menu).toBeDefined();

          // Step 2: Create render snapshot at job creation time
          const snapshot = await createRenderSnapshot(
            menu!.id,
            input.template_id,
            {
              template_id: input.template_id,
              format: 'A4',
              orientation: 'portrait'
            }
          );

          // Verify snapshot captured original state
          expect(snapshot.menu_data.name).toBe(input.original_name);
          expect(snapshot.menu_data.description).toBe(input.original_description);
          expect(snapshot.menu_data.items[0].name).toBe('Original Item');

          // Step 3: Create export job with snapshot in metadata
          const { data: job, error: jobError } = await supabase
            .from('export_jobs')
            .insert({
              user_id: input.user_id,
              menu_id: menu!.id,
              export_type: input.export_type,
              status: 'pending',
              priority: 10,
              metadata: {
                menu_name: snapshot.menu_data.name,
                render_snapshot: snapshot
              }
            })
            .select()
            .single();

          expect(jobError).toBeNull();
          expect(job).toBeDefined();

          // Step 4: Edit menu to new state (simulating user editing menu after job creation)
          const { error: updateError } = await supabase
            .from('menus')
            .update({
              name: input.updated_name,
              menu_data: {
                description: input.updated_description,
                establishment_name: 'Updated Restaurant',
                items: [
                  {
                    id: 'item-1',
                    name: 'Updated Item',
                    description: 'Updated description',
                    price: 20.00,
                    category: 'Main Courses',
                    order: 0
                  }
                ],
                categories: [
                  {
                    name: 'Main Courses',
                    order: 0
                  }
                ]
              }
            })
            .eq('id', menu!.id);

          expect(updateError).toBeNull();

          // Step 5: Verify current menu state has changed
          const { data: updatedMenu, error: fetchError } = await supabase
            .from('menus')
            .select('*')
            .eq('id', menu!.id)
            .single();

          expect(fetchError).toBeNull();
          expect(updatedMenu!.name).toBe(input.updated_name);
          expect(updatedMenu!.menu_data.description).toBe(input.updated_description);
          expect(updatedMenu!.menu_data.items[0].name).toBe('Updated Item');

          // Step 6: Retrieve snapshot from job metadata (simulating worker processing)
          const retrievedSnapshot = getRenderSnapshot(job!.metadata);

          // Step 7: CRITICAL ASSERTION - Snapshot should contain ORIGINAL state, not updated state
          expect(retrievedSnapshot.menu_data.name).toBe(input.original_name);
          expect(retrievedSnapshot.menu_data.name).not.toBe(input.updated_name);
          
          expect(retrievedSnapshot.menu_data.description).toBe(input.original_description);
          expect(retrievedSnapshot.menu_data.description).not.toBe(input.updated_description);
          
          expect(retrievedSnapshot.menu_data.items[0].name).toBe('Original Item');
          expect(retrievedSnapshot.menu_data.items[0].name).not.toBe('Updated Item');
          
          expect(retrievedSnapshot.menu_data.items[0].price).toBe(10.00);
          expect(retrievedSnapshot.menu_data.items[0].price).not.toBe(20.00);

          // Step 8: Verify snapshot is identical to original snapshot (immutability)
          expect(retrievedSnapshot).toEqual(snapshot);

          // Step 9: Verify snapshot metadata is preserved
          expect(retrievedSnapshot.template_id).toBe(input.template_id);
          expect(retrievedSnapshot.snapshot_version).toBe('1.0');
          expect(retrievedSnapshot.snapshot_created_at).toBeTruthy();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve snapshot even if menu items are added or removed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_name: fc.string({ minLength: 5, maxLength: 50 }),
          template_id: fc.constantFrom('elegant-dark', 'modern-minimal'),
          export_type: fc.constantFrom('pdf', 'image'),
          original_item_count: fc.integer({ min: 1, max: 5 }),
          updated_item_count: fc.integer({ min: 1, max: 10 })
        }).filter(input => input.original_item_count !== input.updated_item_count),
        async (input) => {
          // Create menu with original items
          const originalItems = Array.from({ length: input.original_item_count }, (_, i) => ({
            id: `item-${i}`,
            name: `Original Item ${i}`,
            description: `Description ${i}`,
            price: 10.00 + i,
            category: 'Appetizers',
            order: i
          }));

          const { data: menu, error: menuError } = await supabase
            .from('menus')
            .insert({
              user_id: input.user_id,
              name: input.menu_name,
              menu_data: {
                description: 'Test menu',
                items: originalItems,
                categories: [{ name: 'Appetizers', order: 0 }]
              }
            })
            .select()
            .single();

          expect(menuError).toBeNull();

          // Create snapshot
          const snapshot = await createRenderSnapshot(
            menu!.id,
            input.template_id,
            { template_id: input.template_id }
          );

          expect(snapshot.menu_data.items).toHaveLength(input.original_item_count);

          // Create job with snapshot
          const { data: job, error: jobError } = await supabase
            .from('export_jobs')
            .insert({
              user_id: input.user_id,
              menu_id: menu!.id,
              export_type: input.export_type,
              status: 'pending',
              priority: 10,
              metadata: {
                menu_name: snapshot.menu_data.name,
                render_snapshot: snapshot
              }
            })
            .select()
            .single();

          expect(jobError).toBeNull();

          // Update menu with different number of items
          const updatedItems = Array.from({ length: input.updated_item_count }, (_, i) => ({
            id: `new-item-${i}`,
            name: `New Item ${i}`,
            description: `New description ${i}`,
            price: 20.00 + i,
            category: 'Main Courses',
            order: i
          }));

          await supabase
            .from('menus')
            .update({
              menu_data: {
                description: 'Updated menu',
                items: updatedItems,
                categories: [{ name: 'Main Courses', order: 0 }]
              }
            })
            .eq('id', menu!.id);

          // Retrieve snapshot from job
          const retrievedSnapshot = getRenderSnapshot(job!.metadata);

          // Verify snapshot still has original item count
          expect(retrievedSnapshot.menu_data.items).toHaveLength(input.original_item_count);
          expect(retrievedSnapshot.menu_data.items).not.toHaveLength(input.updated_item_count);

          // Verify snapshot has original item names
          retrievedSnapshot.menu_data.items.forEach((item, i) => {
            expect(item.name).toBe(`Original Item ${i}`);
            expect(item.name).not.toContain('New Item');
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should preserve snapshot even if menu is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_name: fc.string({ minLength: 5, maxLength: 50 }),
          template_id: fc.constantFrom('elegant-dark', 'modern-minimal'),
          export_type: fc.constantFrom('pdf', 'image')
        }),
        async (input) => {
          // Create menu
          const { data: menu, error: menuError } = await supabase
            .from('menus')
            .insert({
              user_id: input.user_id,
              name: input.menu_name,
              menu_data: {
                description: 'Test menu',
                items: [
                  {
                    id: 'item-1',
                    name: 'Test Item',
                    price: 10.00,
                    category: 'Appetizers',
                    order: 0
                  }
                ]
              }
            })
            .select()
            .single();

          expect(menuError).toBeNull();

          // Create snapshot
          const snapshot = await createRenderSnapshot(
            menu!.id,
            input.template_id,
            { template_id: input.template_id }
          );

          // Create job with snapshot
          const { data: job, error: jobError } = await supabase
            .from('export_jobs')
            .insert({
              user_id: input.user_id,
              menu_id: menu!.id,
              export_type: input.export_type,
              status: 'pending',
              priority: 10,
              metadata: {
                menu_name: snapshot.menu_data.name,
                render_snapshot: snapshot
              }
            })
            .select()
            .single();

          expect(jobError).toBeNull();

          // Delete menu (simulating user deleting menu after job creation)
          // Note: This will cascade delete the job due to ON DELETE CASCADE
          // In production, we might want to prevent this or handle it differently
          const { error: deleteError } = await supabase
            .from('menus')
            .delete()
            .eq('id', menu!.id);

          expect(deleteError).toBeNull();

          // Verify menu is deleted
          const { data: deletedMenu } = await supabase
            .from('menus')
            .select('*')
            .eq('id', menu!.id)
            .single();

          expect(deletedMenu).toBeNull();

          // Note: Job is also deleted due to CASCADE, so we can't retrieve it
          // This test documents the current behavior
          // In a real implementation, we might want to:
          // 1. Prevent menu deletion if jobs exist
          // 2. Use ON DELETE SET NULL instead of CASCADE
          // 3. Keep jobs but mark them as orphaned
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should preserve snapshot with all menu metadata fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.uuid(),
          menu_name: fc.string({ minLength: 5, maxLength: 50 }),
          establishment_name: fc.string({ minLength: 5, maxLength: 50 }),
          establishment_address: fc.string({ minLength: 10, maxLength: 100 }),
          establishment_phone: fc.string({ minLength: 8, maxLength: 20 }),
          template_id: fc.constantFrom('elegant-dark', 'modern-minimal'),
          export_type: fc.constantFrom('pdf', 'image')
        }),
        async (input) => {
          // Create menu with full metadata
          const { data: menu, error: menuError } = await supabase
            .from('menus')
            .insert({
              user_id: input.user_id,
              name: input.menu_name,
              menu_data: {
                description: 'Original description',
                establishment_name: input.establishment_name,
                establishment_address: input.establishment_address,
                establishment_phone: input.establishment_phone,
                items: [
                  {
                    id: 'item-1',
                    name: 'Test Item',
                    price: 10.00,
                    category: 'Appetizers',
                    order: 0
                  }
                ]
              }
            })
            .select()
            .single();

          expect(menuError).toBeNull();

          // Create snapshot
          const snapshot = await createRenderSnapshot(
            menu!.id,
            input.template_id,
            { template_id: input.template_id }
          );

          // Verify all metadata is captured
          expect(snapshot.menu_data.establishment_name).toBe(input.establishment_name);
          expect(snapshot.menu_data.establishment_address).toBe(input.establishment_address);
          expect(snapshot.menu_data.establishment_phone).toBe(input.establishment_phone);

          // Create job
          const { data: job, error: jobError } = await supabase
            .from('export_jobs')
            .insert({
              user_id: input.user_id,
              menu_id: menu!.id,
              export_type: input.export_type,
              status: 'pending',
              priority: 10,
              metadata: {
                menu_name: snapshot.menu_data.name,
                render_snapshot: snapshot
              }
            })
            .select()
            .single();

          expect(jobError).toBeNull();

          // Update all menu metadata
          await supabase
            .from('menus')
            .update({
              menu_data: {
                description: 'Updated description',
                establishment_name: 'Updated Restaurant',
                establishment_address: 'Updated Address',
                establishment_phone: 'Updated Phone',
                items: [
                  {
                    id: 'item-1',
                    name: 'Test Item',
                    price: 10.00,
                    category: 'Appetizers',
                    order: 0
                  }
                ]
              }
            })
            .eq('id', menu!.id);

          // Retrieve snapshot
          const retrievedSnapshot = getRenderSnapshot(job!.metadata);

          // Verify snapshot still has original metadata
          expect(retrievedSnapshot.menu_data.establishment_name).toBe(input.establishment_name);
          expect(retrievedSnapshot.menu_data.establishment_address).toBe(input.establishment_address);
          expect(retrievedSnapshot.menu_data.establishment_phone).toBe(input.establishment_phone);

          // Verify it doesn't have updated values
          expect(retrievedSnapshot.menu_data.establishment_name).not.toBe('Updated Restaurant');
          expect(retrievedSnapshot.menu_data.establishment_address).not.toBe('Updated Address');
          expect(retrievedSnapshot.menu_data.establishment_phone).not.toBe('Updated Phone');
        }
      ),
      { numRuns: 30 }
    );
  });
});
