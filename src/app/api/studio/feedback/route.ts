import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import {
  assertOwnsStudioImage,
  isStudioImageFeedbackPromptCompleted,
  upsertStudioImageFeedback,
} from '@/lib/studio/feedback/feedback-store'
import {
  isFeedbackImageId,
  validateFeedbackSubmission,
} from '@/lib/studio/feedback/feedback-validation'

export const runtime = 'nodejs'

/**
 * Return whether an owned image's feedback prompt has already been handled.
 * Responses are deliberately uncached so dismissals persist across sessions.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const studioImageId = request.nextUrl.searchParams.get('studioImageId')
    if (!isFeedbackImageId(studioImageId)) {
      return NextResponse.json(
        { error: 'Invalid feedback image', code: 'FEEDBACK_IMAGE_ID_REQUIRED' },
        { status: 400 }
      )
    }

    const ownership = await assertOwnsStudioImage(auth.supabase, auth.user.id, studioImageId)
    if (!ownership.owned) {
      return NextResponse.json({ error: 'Forbidden', code: 'FEEDBACK_NOT_OWNER' }, { status: 403 })
    }

    const completed = await isStudioImageFeedbackPromptCompleted({
      userId: auth.user.id,
      studioImageId,
    })
    return NextResponse.json({ completed }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    logger.error('❌ [Studio Feedback] status failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Create or update the authenticated user's feedback for a Studio image.
 * The server snapshots the source image and requested modifications from the
 * owned persisted image, rather than accepting that context from the browser.
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
        { status: 400 }
      )
    }

    const validation = validateFeedbackSubmission(body)
    if (!validation.ok) {
      return NextResponse.json(
        { error: 'Invalid feedback submission', code: validation.code },
        { status: 400 }
      )
    }

    const ownership = await assertOwnsStudioImage(
      auth.supabase,
      auth.user.id,
      validation.value.studioImageId
    )
    if (!ownership.owned) {
      return NextResponse.json({ error: 'Forbidden', code: 'FEEDBACK_NOT_OWNER' }, { status: 403 })
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
