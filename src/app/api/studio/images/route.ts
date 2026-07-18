/**
 * Photo Studio — list images for a dish
 *
 * GET /api/studio/images?dishId=
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUserApi } from '@/lib/user-api-auth'
import { getStudioDish } from '@/lib/studio/dishes'
import { listStudioImagesForDish } from '@/lib/studio/library'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserApi()
    if (!auth.ok) return auth.response

    const dishId = request.nextUrl.searchParams.get('dishId')
    if (!dishId) {
      return NextResponse.json({ error: 'dishId is required' }, { status: 400 })
    }

    const dish = await getStudioDish(auth.user.id, dishId)
    if (!dish) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
    }

    const images = await listStudioImagesForDish(auth.user.id, dishId)
    return NextResponse.json({ images })
  } catch (error) {
    logger.error('❌ [Studio Images] GET failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
