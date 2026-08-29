import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { ObjectEditOperationZ } from '@/lib/studio/object-edit/operation-controls'
import { loadSpikeEvidenceReport } from '@/lib/studio/object-edit/spike/evidence-report'
import {
  ReviewerDecisionInputZ,
  recordReviewerDecision,
} from '@/lib/studio/object-edit/spike/reviewer-decision'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Admin-only immutable evidence report, grouped by NB2/NB Pro and A/B/C. */
export async function GET(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const operation = ObjectEditOperationZ.safeParse(request.nextUrl.searchParams.get('operation'))
  if (!operation.success) {
    return NextResponse.json({ error: 'A valid operation is required.' }, { status: 400 })
  }

  try {
    return NextResponse.json({ report: await loadSpikeEvidenceReport(operation.data) })
  } catch {
    return NextResponse.json({ error: 'Unable to load spike evidence.' }, { status: 500 })
  }
}

/**
 * Creates an immutable human review and updates only that operation's audited
 * decision state. Browser-supplied reviewer identities, release flags, scores,
 * and score thresholds are intentionally not accepted.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await request.json().catch(() => null)
  const input = ReviewerDecisionInputZ.safeParse(body)
  if (!input.success) {
    return NextResponse.json({ error: 'Invalid reviewer decision.' }, { status: 400 })
  }

  try {
    const result = await recordReviewerDecision(admin.user.id, input.data)
    return NextResponse.json({
      evidenceSetId: result.evidenceSetId,
      reviewedAt: result.reviewedAt,
      control: result.control,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to record reviewer decision.' }, { status: 400 })
  }
}
