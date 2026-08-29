import 'server-only'

import { z } from 'zod'
import {
  ObjectEditOperationZ,
  assertAuthorisedObjectEditReviewer,
  updateOperationControl,
  type OperationControlRecord,
} from '../operation-controls'
import {
  SpikeDecisionZ,
  SpikeSpatialUsefulnessZ,
  createReviewedEvidenceSet,
} from './evidence-store'

export const ReviewerDecisionInputZ = z.object({
  operation: ObjectEditOperationZ,
  label: z.string().trim().min(1).max(200),
  decision: SpikeDecisionZ,
  rationale: z.string().trim().min(1).max(4000),
  spatialUsefulness: SpikeSpatialUsefulnessZ,
  executionIds: z.array(z.string().uuid()).min(1).max(500).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Evidence execution IDs must be unique.' })
    }
  }),
}).strict()

export type ReviewerDecisionInput = z.infer<typeof ReviewerDecisionInputZ>

export interface RecordedReviewerDecision {
  evidenceSetId: string
  control: OperationControlRecord
  reviewedAt: string
}

/**
 * Commits a human-entered decision in the safe order: immutable evidence first,
 * then the same operation's audited control update. Scores are intentionally not
 * accepted and cannot influence either write.
 */
export async function recordReviewerDecision(
  actorUserId: string,
  input: ReviewerDecisionInput,
): Promise<RecordedReviewerDecision> {
  const value = ReviewerDecisionInputZ.parse(input)
  const reviewerUserId = z.string().uuid().parse(actorUserId)
  await assertAuthorisedObjectEditReviewer(reviewerUserId)
  const reviewedAt = new Date().toISOString()

  const evidenceSetId = await createReviewedEvidenceSet({
    operation: value.operation,
    label: value.label,
    reviewerUserId,
    decision: value.decision,
    rationale: value.rationale,
    spatialUsefulness: value.spatialUsefulness,
    reviewedAt,
    executionIds: value.executionIds,
  })

  // Do not send enablement fields: this review is evidence only and cannot
  // alter either release switch. The control service preserves the other row.
  const control = await updateOperationControl({
    operation: value.operation,
    actorUserId: reviewerUserId,
    patch: {
      decision: value.decision,
      decisionAt: reviewedAt,
      reviewerUserId,
      rationale: value.rationale,
      evidenceSetId,
      spatialUsefulness: value.spatialUsefulness,
    },
  })

  return { evidenceSetId, control, reviewedAt }
}
