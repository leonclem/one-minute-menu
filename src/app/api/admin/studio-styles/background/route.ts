/**
 * Admin — background style library list + create.
 *
 * GET  /api/admin/studio-styles/background
 * POST /api/admin/studio-styles/background
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin-api-auth'
import {
  createBackgroundStyle,
  listAllBackgroundStyles,
} from '@/lib/studio/reference-libraries'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  shortDescription: z.string().max(300).optional().nullable(),
  category: z.enum(['surface', 'environment', 'backdrop']),
  promptFragment: z.string().min(1).max(2000),
  negativeConstraints: z.string().max(1000).optional().nullable(),
  thumbnailPath: z.string().max(120).optional().nullable(),
  isPremium: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  try {
    const styles = await listAllBackgroundStyles()
    return NextResponse.json({ styles })
  } catch (error) {
    logger.error('Failed to list background styles', { error })
    return NextResponse.json({ error: 'Failed to list styles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    )
  }

  try {
    const style = await createBackgroundStyle(parsed.data)
    return NextResponse.json({ style }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create style'
    if (message.includes('required') || message.includes('kebab-case')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    logger.error('Failed to create background style', { error })
    return NextResponse.json({ error: 'Failed to create style' }, { status: 500 })
  }
}
