/**
 * Admin — lighting style update + delete.
 *
 * PATCH  /api/admin/studio-styles/lighting/[id]
 * DELETE /api/admin/studio-styles/lighting/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin-api-auth'
import {
  deleteLightingStyle,
  updateLightingStyle,
} from '@/lib/studio/reference-libraries'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const PatchSchema = z.object({
  key: z.string().min(1).max(80).optional(),
  name: z.string().min(1).max(120).optional(),
  shortDescription: z.string().max(300).optional().nullable(),
  promptFragment: z.string().min(1).max(2000).optional(),
  negativeConstraints: z.string().max(1000).optional().nullable(),
  thumbnailPath: z.string().max(120).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  if (!params.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    )
  }

  try {
    const style = await updateLightingStyle(params.id, parsed.data)
    return NextResponse.json({ style })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update style'
    if (
      message.includes('required') ||
      message.includes('kebab-case') ||
      message.includes('No fields')
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    logger.error('Failed to update lighting style', { error })
    return NextResponse.json({ error: 'Failed to update style' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  if (!params.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    await deleteLightingStyle(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to delete lighting style', { error })
    return NextResponse.json({ error: 'Failed to delete style' }, { status: 500 })
  }
}
