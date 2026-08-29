import { randomUUID } from 'crypto'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { ObjectEditOperationZ, type ObjectEditOperation } from '../operation-controls'

const Sha256Z = z.string().regex(/^[a-f0-9]{64}$/)
const UuidZ = z.string().uuid()

export const SpikeModelClassZ = z.enum(['nb2', 'nb_pro'])
export const SpikeVariantZ = z.enum(['A', 'B', 'C'])
export const SpikeOutcomeZ = z.enum(['generated', 'provider_error', 'transport_error', 'validation_error'])
export const SpikeScoreValueZ = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
export const NotApplicableScoreZ = z.literal('not_applicable')
export const ScoreOrNotApplicableZ = z.union([SpikeScoreValueZ, NotApplicableScoreZ])
export const SpikeDecisionZ = z.enum(['go', 'no_go'])
export const SpikeSpatialUsefulnessZ = z.enum(['useful', 'not_useful', 'inconclusive'])

export type SpikeModelClass = z.infer<typeof SpikeModelClassZ>
export type SpikeVariant = z.infer<typeof SpikeVariantZ>
export type SpikeOutcome = z.infer<typeof SpikeOutcomeZ>
export type SpikeScoreValue = z.infer<typeof SpikeScoreValueZ>

export const SpikeArtifactZ = z.object({
  storagePath: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(100),
  sha256: Sha256Z,
}).strict()

export const SpikeScoresZ = z.object({
  targetIdentification: SpikeScoreValueZ,
  editLocality: SpikeScoreValueZ,
  removalCompleteness: ScoreOrNotApplicableZ,
  destinationAdherence: ScoreOrNotApplicableZ,
  sourceRegionReconstruction: SpikeScoreValueZ,
  objectIdentityPreservation: ScoreOrNotApplicableZ,
  scalePreservation: ScoreOrNotApplicableZ,
  orientationPreservation: ScoreOrNotApplicableZ,
  unrelatedChanges: SpikeScoreValueZ,
  overallUsability: SpikeScoreValueZ,
}).strict()

export const SpikeExecutionInputZ = z.object({
  id: UuidZ.optional(),
  comparisonGroupId: UuidZ,
  variant: SpikeVariantZ,
  operation: ObjectEditOperationZ,
  requestedModelClass: SpikeModelClassZ,
  configuredModelIdentifier: z.string().trim().min(1).max(200),
  providerReportedModelIdentity: z.string().trim().min(1).max(200).nullable(),
  contractDigest: Sha256Z,
  sourceDigest: Sha256Z,
  annotatedDigest: Sha256Z,
  outcome: SpikeOutcomeZ,
  outputArtifact: SpikeArtifactZ.nullable(),
  failureArtifact: SpikeArtifactZ.nullable(),
  noFailureArtifactReturned: z.boolean(),
  scores: SpikeScoresZ,
  observations: z.array(z.string().trim().min(1).max(2000)).max(100),
  failureNotes: z.array(z.string().trim().min(1).max(2000)).max(100),
}).strict().superRefine((value, ctx) => {
  if (value.outcome === 'generated' && !value.outputArtifact) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Generated executions require an output artifact' })
  }
  if (value.failureArtifact && value.noFailureArtifactReturned) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A failure artifact and explicit absence are mutually exclusive' })
  }

  const notApplicable = (key: keyof z.infer<typeof SpikeScoresZ>) =>
    value.scores[key] === 'not_applicable'

  if (value.operation === 'remove') {
    for (const key of [
      'destinationAdherence',
      'objectIdentityPreservation',
      'scalePreservation',
      'orientationPreservation',
    ] as const) {
      if (!notApplicable(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scores', key], message: `Remove ${key} must be not_applicable` })
      }
    }
  } else {
    for (const key of [
      'destinationAdherence',
      'objectIdentityPreservation',
      'scalePreservation',
      'orientationPreservation',
    ] as const) {
      if (notApplicable(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scores', key], message: `Move ${key} requires a 1–5 score` })
      }
    }
    if (!notApplicable('removalCompleteness')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scores', 'removalCompleteness'], message: 'Move removal completeness must be not_applicable' })
    }
  }
})

export type SpikeExecutionInput = z.infer<typeof SpikeExecutionInputZ>

export const SpikeCaseInputZ = z.object({
  id: UuidZ.optional(),
  operation: ObjectEditOperationZ,
  requestedModelClass: SpikeModelClassZ,
  configuredModelIdentifier: z.string().trim().min(1).max(200),
  sourceArtifact: SpikeArtifactZ,
  annotatedArtifact: SpikeArtifactZ,
  selection: z.record(z.unknown()),
  placement: z.record(z.unknown()).nullable(),
  scenarioTags: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
}).strict().superRefine((value, ctx) => {
  if ((value.operation === 'move') !== Boolean(value.placement)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['placement'], message: 'Only Move cases require placement data' })
  }
})

export type SpikeCaseInput = z.infer<typeof SpikeCaseInputZ>

export const SpikeComparisonGroupInputZ = z.object({
  id: UuidZ.optional(),
  spikeCaseId: UuidZ,
  operation: ObjectEditOperationZ,
  requestedModelClass: SpikeModelClassZ,
  configuredModelIdentifier: z.string().trim().min(1).max(200),
  sourceDigest: Sha256Z,
  annotatedDigest: Sha256Z,
  contractDigest: Sha256Z,
}).strict()

export type SpikeComparisonGroupInput = z.infer<typeof SpikeComparisonGroupInputZ>

export const ReviewedEvidenceSetInputZ = z.object({
  id: UuidZ.optional(),
  operation: ObjectEditOperationZ,
  label: z.string().trim().min(1).max(200),
  reviewerUserId: UuidZ,
  decision: SpikeDecisionZ,
  rationale: z.string().trim().min(1).max(4000),
  spatialUsefulness: SpikeSpatialUsefulnessZ,
  reviewedAt: z.string().datetime(),
  executionIds: z.array(UuidZ).min(1).max(500).superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Evidence execution IDs must be unique' })
    }
  }),
}).strict()

export type ReviewedEvidenceSetInput = z.infer<typeof ReviewedEvidenceSetInputZ>

const SpikeReportKeyZ = z.object({
  operation: ObjectEditOperationZ,
  requestedModelClass: SpikeModelClassZ,
})

export function groupSpikeExecutionsByOperationAndModel(
  executions: readonly Pick<SpikeExecutionInput, 'operation' | 'requestedModelClass'>[],
): Map<string, readonly Pick<SpikeExecutionInput, 'operation' | 'requestedModelClass'>[]> {
  const groups = new Map<string, Pick<SpikeExecutionInput, 'operation' | 'requestedModelClass'>[]>()
  for (const execution of executions) {
    const parsed = SpikeReportKeyZ.parse(execution)
    const key = `${parsed.operation}:${parsed.requestedModelClass}`
    groups.set(key, [...(groups.get(key) ?? []), parsed])
  }
  return groups
}

export async function createSpikeCase(input: SpikeCaseInput): Promise<string> {
  const value = SpikeCaseInputZ.parse(input)
  const id = value.id ?? randomUUID()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('studio_object_edit_spike_cases').insert({
    id,
    operation: value.operation,
    requested_model_class: value.requestedModelClass,
    configured_model_identifier: value.configuredModelIdentifier,
    source_artifact: value.sourceArtifact,
    annotated_artifact: value.annotatedArtifact,
    selection: value.selection,
    placement: value.placement,
    scenario_tags: value.scenarioTags,
  })
  if (error) throw new Error(`Failed to create immutable spike case: ${error.message}`)
  return id
}

export async function createSpikeComparisonGroup(input: SpikeComparisonGroupInput): Promise<string> {
  const value = SpikeComparisonGroupInputZ.parse(input)
  const id = value.id ?? randomUUID()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('studio_object_edit_spike_comparison_groups').insert({
    id,
    spike_case_id: value.spikeCaseId,
    operation: value.operation,
    requested_model_class: value.requestedModelClass,
    configured_model_identifier: value.configuredModelIdentifier,
    source_digest: value.sourceDigest,
    annotated_digest: value.annotatedDigest,
    contract_digest: value.contractDigest,
  })
  if (error) throw new Error(`Failed to create immutable spike comparison group: ${error.message}`)
  return id
}

export async function createSpikeExecution(input: SpikeExecutionInput): Promise<string> {
  const value = SpikeExecutionInputZ.parse(input)
  const id = value.id ?? randomUUID()
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('studio_object_edit_spike_executions').insert({
    id,
    comparison_group_id: value.comparisonGroupId,
    variant: value.variant,
    operation: value.operation,
    requested_model_class: value.requestedModelClass,
    configured_model_identifier: value.configuredModelIdentifier,
    provider_reported_model_identity: value.providerReportedModelIdentity,
    provider_identity_reported: value.providerReportedModelIdentity !== null,
    contract_digest: value.contractDigest,
    source_digest: value.sourceDigest,
    annotated_digest: value.annotatedDigest,
    outcome: value.outcome,
    output_artifact: value.outputArtifact,
    failure_artifact: value.failureArtifact,
    no_failure_artifact_returned: value.noFailureArtifactReturned,
    scores: value.scores,
    observations: value.observations,
    failure_notes: value.failureNotes,
  })
  if (error) throw new Error(`Failed to create immutable spike execution: ${error.message}`)
  return id
}

/** Create an immutable evidence set, exact execution links, and human review in one database transaction. */
export async function createReviewedEvidenceSet(input: ReviewedEvidenceSetInput): Promise<string> {
  const value = ReviewedEvidenceSetInputZ.parse(input)
  const id = value.id ?? randomUUID()
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.rpc('studio_create_object_edit_spike_evidence_set', {
    p_evidence_set_id: id,
    p_operation: value.operation,
    p_label: value.label,
    p_reviewer_user_id: value.reviewerUserId,
    p_decision: value.decision,
    p_rationale: value.rationale,
    p_spatial_usefulness: value.spatialUsefulness,
    p_reviewed_at: value.reviewedAt,
    p_execution_ids: value.executionIds,
  })
  if (error || data !== id) {
    throw new Error(`Failed to create immutable reviewed evidence set: ${error?.message ?? 'unknown'}`)
  }
  return id
}
