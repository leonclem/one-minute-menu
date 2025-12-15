import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreatePresetSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  mode: z.enum(['style_match', 'composite']),
  scenarioId: z.string().max(200).optional().nullable(),
  helperValues: z.record(z.any()).optional().nullable(),
  prompt: z.string().min(1).max(5000),
})

function isMissingTableError(err: any): boolean {
  return err?.code === 'PGRST205' || (typeof err?.message === 'string' && err.message.includes('schema cache'))
}

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const { data, error } = await admin.supabase
    .from('admin_prompt_presets')
    .select('id,name,description,mode,scenario_id,helper_values,prompt,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    if (isMissingTableError(error)) {
      // Migration not applied on this Supabase instance yet.
      logger.warn('Admin prompt presets table missing (migration not applied)', error)
      return NextResponse.json(
        {
          error: 'Prompt presets are not configured on this database (missing table admin_prompt_presets). Apply migration 024_admin_prompt_presets.sql.',
          code: 'MISSING_TABLE',
        },
        { status: 503 },
      )
    }
    logger.error('Failed to fetch admin prompt presets', error)
    return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 })
  }

  return NextResponse.json({
    presets: (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      mode: row.mode,
      scenarioId: row.scenario_id,
      helperValues: row.helper_values || {},
      prompt: row.prompt,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await request.json().catch(() => null)
  const parsed = CreatePresetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    )
  }

  const { name, description, mode, scenarioId, helperValues, prompt } = parsed.data

  const { data, error } = await admin.supabase
    .from('admin_prompt_presets')
    .insert({
      name,
      description: description ?? null,
      mode,
      scenario_id: scenarioId ?? null,
      helper_values: helperValues ?? {},
      prompt,
      created_by: admin.user.id,
    })
    .select('id')
    .single()

  if (error) {
    if (isMissingTableError(error)) {
      logger.warn('Admin prompt presets table missing (migration not applied)', error)
      return NextResponse.json(
        {
          error: 'Prompt presets are not configured on this database (missing table admin_prompt_presets). Apply migration 024_admin_prompt_presets.sql.',
          code: 'MISSING_TABLE',
        },
        { status: 503 },
      )
    }
    logger.error('Failed to create admin prompt preset', error)
    return NextResponse.json({ error: 'Failed to create preset' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}


