/**
 * Photo Studio dishes — list + create
 *
 * GET  /api/studio/dishes
 * POST /api/studio/dishes  { name, description? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUserApi } from '@/lib/user-api-auth'
import {
  createStudioDish,
  ensureDefaultStudioDish,
  listStudioDishesWithThumbnails,
} from '@/lib/studio/dishes'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireUserApi()
    if (!auth.ok) return auth.response

    let dishes = await listStudioDishesWithThumbnails(auth.user.id)
    if (dishes.length === 0) {
      await ensureDefaultStudioDish(auth.user.id)
      dishes = await listStudioDishesWithThumbnails(auth.user.id)
    }

    return NextResponse.json({ dishes })
  } catch (error) {
    logger.error('❌ [Studio Dishes] GET failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserApi()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as { name?: unknown; description?: unknown }
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const description =
      typeof body.description === 'string' ? body.description : null

    try {
      const dish = await createStudioDish(auth.user.id, body.name, description)
      return NextResponse.json({ dish }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create dish'
      if (message.includes('required')) {
        return NextResponse.json({ error: message }, { status: 400 })
      }
      throw err
    }
  } catch (error) {
    logger.error('❌ [Studio Dishes] POST failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
