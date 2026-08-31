/**
 * Photo Studio — finishing-touch recommendation (text only, no credits).
 *
 * POST /api/studio/finishing-touches/recommend
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { recommendFinishingTouches } from '@/lib/studio/finishing-touches/recommend'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 30

const RecommendBodyZ = z.object({
  dishName: z.string().max(200).optional(),
  mainItem: z.string().max(200).optional(),
  garnishes: z.array(z.string().max(80)).max(20).optional(),
  sides: z.array(z.string().max(80)).max(20).optional(),
  description: z.string().max(8000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const json: unknown = await request.json().catch(() => null)
    const parsed = RecommendBodyZ.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid recommend payload' }, { status: 400 })
    }

    const stack = await recommendFinishingTouches(parsed.data)
    return NextResponse.json({
      stackIds: stack.map((item) => item.id),
      stack: stack.map((item) => ({ id: item.id, name: item.name })),
    })
  } catch (error) {
    logger.error('❌ [Finishing Touches] Recommend failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
