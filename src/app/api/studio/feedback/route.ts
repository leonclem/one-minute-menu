import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import {
  assertOwnsStudioImage,
  upsertStudioImageFeedback,
} from '@/lib/studio/feedback/feedback-store'
import { validateFeedbackSubmission } from '@/lib/studio/feedback/feedback-validation'

export const runtime = 'nodejs'

/**
 * Create or update the authenticated user's feedback for a Studio image.
 *
 * The order of the gate, validation, ownership check, and write is deliberate:
 * authentication/access errors take precedence over malformed input, followed
 * by validation and then ownership.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid feedback submission', code: 'FEEDBACK_INVALID_BODY' },
        { status: 400 },
      )
    }

    const validation = validateFeedbackSubmission(body)
    if (!validation.ok) {
      return NextResponse.json(
        { error: 'Invalid feedback submission', code: validation.code },
        { status: 400 },
      )
    }

    const ownership = await assertOwnsStudioImage(
      auth.supabase,
      auth.user.id,
      validation.value.studioImageId,
    )
    if (!ownership.owned) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FEEDBACK_NOT_OWNER' },
        { status: 403 },
      )
    }

    const result = await upsertStudioImageFeedback({
      userId: auth.user.id,
      dishId: ownership.dishId,
      value: validation.value,
    })

    return NextResponse.json({
      success: true,
      feedback: result.row,
      isUpdate: result.isUpdate,
    })
  } catch (error) {
    logger.error('❌ [Studio Feedback] POST failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
