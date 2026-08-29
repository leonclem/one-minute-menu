/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '088_studio_object_edit_persistence.sql',
)

const migration = fs.readFileSync(migrationPath, 'utf8')

describe('object-edit persistence migration', () => {
  it('is additive and creates separate image-bound spatial state with owner-only reads', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS studio_image_spatial_inventories')
    expect(migration).toContain('image_id UUID PRIMARY KEY REFERENCES studio_images(id) ON DELETE CASCADE')
    expect(migration).toContain("CHECK ((inventory ->> 'imageId') = image_id::text)")
    expect(migration).toContain('ALTER TABLE studio_image_spatial_inventories ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('Users can select own Studio spatial inventory')
    expect(migration).not.toMatch(/DROP\s+(TABLE|DATABASE|SCHEMA)|\bTRUNCATE\b/i)
  })

  it('seeds independent pending controls, immutable audit/evidence, and service-only RPCs', () => {
    expect(migration).toContain("('remove', 'pending', 'pending', FALSE, FALSE)")
    expect(migration).toContain("('move', 'pending', 'pending', FALSE, FALSE)")
    expect(migration).toContain('studio_object_edit_operation_control_audit_events')
    expect(migration).toContain('studio_reject_object_edit_immutable_mutation')
    expect(migration).toContain('studio_create_object_edit_spike_evidence_set')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION studio_update_object_edit_operation_control')
    expect(migration).toContain('TO service_role')
  })

  it('installs an all-or-nothing child commit that revalidates ownership and reuses FIFO debit semantics', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION studio_commit_generated_image_v2')
    expect(migration).toContain('AND s.dish_id = p_dish_id')
    expect(migration).toContain("'generation_debit'")
    expect(migration).toContain('studio_apply_credit_delta(')
    expect(migration).toContain('generation_failure_count = 0')
    expect(migration).toContain('source_image_id, storage_path, public_url')
  })
})
