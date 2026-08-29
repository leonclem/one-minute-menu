import { z } from 'zod'

/** Human review only: this runner never derives scores, decisions, or averages. */
export const SPIKE_SCORE_RUBRIC = {
  5: 'excellent',
  4: 'good',
  3: 'usable_with_visible_limitations',
  2: 'poor',
  1: 'failed',
} as const

export const SpikeScoreValueZ = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])
export const NullableSpikeScoreZ = SpikeScoreValueZ.nullable()
export const NotApplicableZ = z.literal('not_applicable')
export const NullableScoreOrNotApplicableZ = z.union([NullableSpikeScoreZ, NotApplicableZ])

export type NullableSpikeScore = z.infer<typeof NullableSpikeScoreZ>
export type NullableScoreOrNotApplicable = z.infer<typeof NullableScoreOrNotApplicableZ>

const sharedDimensions = {
  targetIdentification: NullableSpikeScoreZ,
  editLocality: NullableSpikeScoreZ,
  sourceRegionReconstruction: NullableSpikeScoreZ,
  unrelatedChanges: NullableSpikeScoreZ,
  overallUsability: NullableSpikeScoreZ,
}

export const RemoveSpikeReviewScoresZ = z
  .object({
    ...sharedDimensions,
    removalCompleteness: NullableSpikeScoreZ,
    destinationAdherence: NotApplicableZ,
    objectIdentityPreservation: NotApplicableZ,
    scalePreservation: NotApplicableZ,
    orientationPreservation: NotApplicableZ,
  })
  .strict()

export const MoveSpikeReviewScoresZ = z
  .object({
    ...sharedDimensions,
    removalCompleteness: NotApplicableZ,
    destinationAdherence: NullableSpikeScoreZ,
    objectIdentityPreservation: NullableSpikeScoreZ,
    scalePreservation: NullableSpikeScoreZ,
    orientationPreservation: NullableSpikeScoreZ,
  })
  .strict()

export const SpikeReviewZ = z
  .object({
    operation: z.enum(['remove', 'move']),
    scores: z.union([RemoveSpikeReviewScoresZ, MoveSpikeReviewScoresZ]),
    observations: z.array(z.string().trim().min(1).max(2000)).max(100),
    failureNotes: z.array(z.string().trim().min(1).max(2000)).max(100),
  })
  .strict()
  .superRefine((review, context) => {
    const expectedSchema = review.operation === 'remove' ? RemoveSpikeReviewScoresZ : MoveSpikeReviewScoresZ
    if (!expectedSchema.safeParse(review.scores).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scores'],
        message: `Scores do not match the operation-specific ${review.operation} rubric.`,
      })
    }
  })

export type SpikeReview = z.infer<typeof SpikeReviewZ>

export function unscoredReview(operation: 'remove' | 'move'): SpikeReview {
  const common = {
    targetIdentification: null,
    editLocality: null,
    sourceRegionReconstruction: null,
    unrelatedChanges: null,
    overallUsability: null,
  }
  return {
    operation,
    scores:
      operation === 'remove'
        ? {
            ...common,
            removalCompleteness: null,
            destinationAdherence: 'not_applicable',
            objectIdentityPreservation: 'not_applicable',
            scalePreservation: 'not_applicable',
            orientationPreservation: 'not_applicable',
          }
        : {
            ...common,
            removalCompleteness: 'not_applicable',
            destinationAdherence: null,
            objectIdentityPreservation: null,
            scalePreservation: null,
            orientationPreservation: null,
          },
    observations: [],
    failureNotes: [],
  }
}
