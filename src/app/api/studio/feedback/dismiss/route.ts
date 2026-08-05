import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import {
  assertOwnsStudioImage,
  dismissStudioImageFeedbackPrompt,
} from '@/lib/studio/feedback/feedback-store'
import { isFeedbackImageId } from '@/lib/studio/feedback/feedback-validation'

export const runtime = 'nodejs'

/** Permanently suppress the feedback prompt for one owned Studio image. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const body = (await request.json().catch(() => null)) as { studioImageId?: unknown } | null
    if (!isFeedbackImageId(body?.studioImageId)) {
      return NextResponse.json(
        { error: 'Invalid feedback dismissal', code: 'FEEDBACK_IMAGE_ID_REQUIRED' },
        { status: 400 }
      )
    }

    const ownership = await assertOwnsStudioImage(auth.supabase, auth.user.id, body.studioImageId)
    if (!ownership.owned) {
      return NextResponse.json({ error: 'Forbidden', code: 'FEEDBACK_NOT_OWNER' }, { status: 403 })
    }

    await dismissStudioImageFeedbackPrompt({
      userId: auth.user.id,
      studioImageId: body.studioImageId,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('❌ [Studio Feedback] dismissal failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
