import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

function isMissingTableError(err: any): boolean {
  return err?.code === 'PGRST205' || (typeof err?.message === 'string' && err.message.includes('schema cache'))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const id = params.id
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await admin.supabase
    .from('admin_prompt_presets')
    .delete()
    .eq('id', id)

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
    logger.error('Failed to delete admin prompt preset', error)
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}


