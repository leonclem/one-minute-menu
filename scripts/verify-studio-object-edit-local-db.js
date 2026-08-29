#!/usr/bin/env node

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { Client } = require('pg')

const CONTROL_UPDATE_SIGNATURE = 'public.studio_update_object_edit_operation_control(text,uuid,text,timestamptz,uuid,text,uuid,text,boolean,boolean)' 
const EVIDENCE_CREATE_SIGNATURE = 'public.studio_create_object_edit_spike_evidence_set(uuid,text,text,uuid,text,text,text,timestamptz,uuid[])'
const COMMIT_SIGNATURE = 'public.studio_commit_generated_image_v2(uuid,uuid,uuid,uuid,text,text,text,integer,integer,text,text,jsonb,integer)'

function databaseUrl() {
  return (
    process.env.STUDIO_OBJECT_EDIT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  )
}

async function expectFailure(client, label, action) {
  const savepoint = `task17_${crypto.randomUUID().replaceAll('-', '')}`
  await client.query(`SAVEPOINT ${savepoint}`)
  try {
    await action()
    throw new Error(`${label} unexpectedly succeeded`)
  } catch (error) {
    if (error instanceof Error && error.message === `${label} unexpectedly succeeded`) throw error
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    await client.query(`RELEASE SAVEPOINT ${savepoint}`)
  }
}

async function main() {
  const client = new Client({ connectionString: databaseUrl() })
  await client.connect()

  const checks = []
  const record = (name) => checks.push(name)

  try {
    const requiredObjects = await client.query(`
      SELECT
        to_regclass('public.studio_object_edit_operation_controls') AS controls,
        to_regclass('public.studio_object_edit_operation_control_audit_events') AS audits,
        to_regclass('public.studio_object_edit_spike_evidence_sets') AS evidence_sets,
        to_regprocedure('${COMMIT_SIGNATURE}') AS commit_rpc
    `)
    const objects = requiredObjects.rows[0]
    assert.ok(objects.controls && objects.audits && objects.evidence_sets && objects.commit_rpc)
    record('required object-edit tables and atomic commit RPC exist')

    const rls = await client.query(`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      WHERE c.oid IN (
        'public.studio_object_edit_operation_controls'::regclass,
        'public.studio_object_edit_operation_control_audit_events'::regclass,
        'public.studio_object_edit_spike_evidence_sets'::regclass
      )
      ORDER BY c.relname
    `)
    assert.equal(rls.rows.length, 3)
    assert.ok(rls.rows.every((row) => row.relrowsecurity === true))
    record('control, audit, and evidence tables have RLS enabled')

    const privileges = await client.query(`
      SELECT
        has_function_privilege('service_role', '${CONTROL_UPDATE_SIGNATURE}'::regprocedure, 'EXECUTE') AS service_can_update,
        has_function_privilege('anon', '${CONTROL_UPDATE_SIGNATURE}'::regprocedure, 'EXECUTE') AS anon_can_update,
        has_function_privilege('authenticated', '${CONTROL_UPDATE_SIGNATURE}'::regprocedure, 'EXECUTE') AS authenticated_can_update,
        has_function_privilege('service_role', '${EVIDENCE_CREATE_SIGNATURE}'::regprocedure, 'EXECUTE') AS service_can_create_evidence,
        has_function_privilege('anon', '${EVIDENCE_CREATE_SIGNATURE}'::regprocedure, 'EXECUTE') AS anon_can_create_evidence,
        has_function_privilege('authenticated', '${EVIDENCE_CREATE_SIGNATURE}'::regprocedure, 'EXECUTE') AS authenticated_can_create_evidence
    `)
    const privilege = privileges.rows[0]
    assert.equal(privilege.service_can_update, true)
    assert.equal(privilege.anon_can_update, false)
    assert.equal(privilege.authenticated_can_update, false)
    assert.equal(privilege.service_can_create_evidence, true)
    assert.equal(privilege.anon_can_create_evidence, false)
    assert.equal(privilege.authenticated_can_create_evidence, false)
    record('review/control RPCs are service-role-only')

    const initialControls = await client.query(`
      SELECT operation, decision, internal_enabled, production_enabled
      FROM public.studio_object_edit_operation_controls
      WHERE operation IN ('remove', 'move')
      ORDER BY operation
    `)
    assert.deepEqual(initialControls.rows, [
      { operation: 'move', decision: 'pending', internal_enabled: false, production_enabled: false },
      { operation: 'remove', decision: 'pending', internal_enabled: false, production_enabled: false },
    ])
    const initialAuditCount = Number(
      (await client.query('SELECT COUNT(*)::int AS count FROM public.studio_object_edit_operation_control_audit_events')).rows[0].count,
    )
    record('both operations start fail-closed and independently seeded')

    await client.query('BEGIN')
    try {
      const evidenceId = crypto.randomUUID()
      const actorId = crypto.randomUUID()
      const reviewerId = crypto.randomUUID()
      await client.query(
        `INSERT INTO public.studio_object_edit_spike_evidence_sets (id, operation, label) VALUES ($1, 'remove', 'Task 17 local verification')`,
        [evidenceId],
      )

      const updateSql = `
        SELECT * FROM public.studio_update_object_edit_operation_control(
          $1::text, $2::uuid, $3::text, $4::timestamptz, $5::uuid, $6::text,
          $7::uuid, $8::text, $9::boolean, $10::boolean
        )
      `
      await client.query(updateSql, [
        'remove', actorId, 'go', '2026-08-28T00:00:00Z', reviewerId,
        'Task 17 local Remove verification', evidenceId, 'inconclusive', true, true,
      ])

      const afterGo = await client.query(`
        SELECT operation, decision, internal_enabled, production_enabled
        FROM public.studio_object_edit_operation_controls
        WHERE operation IN ('remove', 'move')
        ORDER BY operation
      `)
      assert.deepEqual(afterGo.rows, [
        { operation: 'move', decision: 'pending', internal_enabled: false, production_enabled: false },
        { operation: 'remove', decision: 'go', internal_enabled: true, production_enabled: true },
      ])
      record('Remove can be enabled independently while Move remains unavailable')

      await client.query(updateSql, [
        'remove', actorId, 'go', '2026-08-28T00:00:00Z', reviewerId,
        'Task 17 local Remove rollback verification', evidenceId, 'inconclusive', false, false,
      ])
      const afterRollbackControl = (
        await client.query(`SELECT decision, internal_enabled, production_enabled FROM public.studio_object_edit_operation_controls WHERE operation = 'remove'`)
      ).rows[0]
      assert.deepEqual(afterRollbackControl, { decision: 'go', internal_enabled: false, production_enabled: false })
      const moveAfterRollback = (
        await client.query(`SELECT decision, internal_enabled, production_enabled FROM public.studio_object_edit_operation_controls WHERE operation = 'move'`)
      ).rows[0]
      assert.deepEqual(moveAfterRollback, { decision: 'pending', internal_enabled: false, production_enabled: false })
      record('rollback disables only the affected Remove controls and leaves Move unchanged')

      const auditCount = Number(
        (await client.query('SELECT COUNT(*)::int AS count FROM public.studio_object_edit_operation_control_audit_events')).rows[0].count,
      )
      assert.equal(auditCount, initialAuditCount + 2)
      record('each control update appends an audit event')

      const auditId = (
        await client.query(`SELECT id FROM public.studio_object_edit_operation_control_audit_events ORDER BY created_at DESC, id DESC LIMIT 1`)
      ).rows[0].id
      await expectFailure(client, 'immutable audit update', () =>
        client.query('UPDATE public.studio_object_edit_operation_control_audit_events SET event_type = $1 WHERE id = $2', ['control_updated', auditId]),
      )
      record('audit events are append-only')

      await expectFailure(client, 'missing operation control', () =>
        client.query(updateSql, [
          'missing', actorId, 'go', '2026-08-28T00:00:00Z', reviewerId,
          'invalid operation check', evidenceId, 'inconclusive', true, true,
        ]),
      )
      await expectFailure(client, 'malformed pending decision', () =>
        client.query(updateSql, [
          'remove', actorId, 'pending', null, null, null, evidenceId, 'pending', false, false,
        ]),
      )
      record('missing and malformed control updates fail closed')

      const fixture = (
        await client.query(`
          SELECT d.id AS dish_id, d.user_id, d.current_image_id, i.id AS source_image_id
          FROM public.studio_dishes d
          JOIN public.studio_images i ON i.dish_id = d.id AND i.user_id = d.user_id
          JOIN public.studio_credit_balances b ON b.user_id = d.user_id AND b.balance > 0
          WHERE i.role = 'source' AND i.archived_at IS NULL
          ORDER BY d.updated_at DESC, i.created_at DESC
          LIMIT 1
        `)
      ).rows[0]
      assert.ok(fixture, 'local fixture with a credited owned source image is required')

      const childId = crypto.randomUUID()
      const beforeDish = { current_image_id: fixture.current_image_id }
      await expectFailure(client, 'atomic commit insufficient-credit rollback', () =>
        client.query(
          `SELECT * FROM public.studio_commit_generated_image_v2(
            $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text, $7::text,
            $8::integer, $9::integer, $10::text, $11::text, $12::jsonb, $13::integer
          )`,
          [
            fixture.user_id, fixture.dish_id, fixture.source_image_id, childId,
            `studio/task17/${childId}.png`, 'http://localhost/task17.png', 'image/png',
            1, 1, 'Task 17 rollback fixture', 'gemini-test',
            JSON.stringify({ editorStateVersion: 1, editorState: { schema: {}, position: { x: 0, y: 0 } } }),
            999999,
          ],
        ),
      )
      const childCount = Number((await client.query('SELECT COUNT(*)::int AS count FROM public.studio_images WHERE id = $1', [childId])).rows[0].count)
      assert.equal(childCount, 0)
      const afterDish = (await client.query('SELECT current_image_id FROM public.studio_dishes WHERE id = $1', [fixture.dish_id])).rows[0]
      assert.deepEqual(afterDish, beforeDish)
      record('atomic child RPC rollback leaves no generated child or dish-state partial')
    } finally {
      await client.query('ROLLBACK')
    }

    const finalControls = await client.query(`
      SELECT operation, decision, internal_enabled, production_enabled
      FROM public.studio_object_edit_operation_controls
      WHERE operation IN ('remove', 'move')
      ORDER BY operation
    `)
    assert.deepEqual(finalControls.rows, initialControls.rows)
    const finalAuditCount = Number(
      (await client.query('SELECT COUNT(*)::int AS count FROM public.studio_object_edit_operation_control_audit_events')).rows[0].count,
    )
    assert.equal(finalAuditCount, initialAuditCount)
    record('verification transaction rolled back all fixture and audit changes')

    console.log(JSON.stringify({ status: 'passed', checks, database: databaseUrl().replace(/:\/\/.*@/, '://***@') }, null, 2))
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
