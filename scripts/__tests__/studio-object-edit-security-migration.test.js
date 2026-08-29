const fs = require('fs')
const path = require('path')

const migrationPath = path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '089_studio_object_edit_task16_security.sql',
)

describe('Task 16 object-edit database security migration', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8').toLowerCase()

  it('keeps evidence and control tables behind row-level security', () => {
    for (const table of [
      'studio_object_edit_spike_evidence_sets',
      'studio_object_edit_spike_evidence_set_executions',
      'studio_object_edit_spike_reviews',
      'studio_object_edit_operation_controls',
      'studio_object_edit_operation_control_audit_events',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('allows the service role but not client roles to call privileged review RPCs', () => {
    expect(migration).toContain('revoke execute on function public.studio_update_object_edit_operation_control')
    expect(migration).toContain('revoke execute on function public.studio_create_object_edit_spike_evidence_set')
    expect(migration).toContain('from public, anon, authenticated')
    expect(migration).toContain('to service_role')
  })
})
