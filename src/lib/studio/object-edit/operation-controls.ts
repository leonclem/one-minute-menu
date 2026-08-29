import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export const ObjectEditOperationZ = z.enum(['remove', 'move'])
export const ObjectEditDecisionZ = z.enum(['pending', 'go', 'no_go'])
export const SpatialUsefulnessZ = z.enum(['pending', 'useful', 'not_useful', 'inconclusive'])
export const ObjectEditAudienceZ = z.enum(['internal', 'production'])

export type ObjectEditOperation = z.infer<typeof ObjectEditOperationZ>
export type ObjectEditDecision = z.infer<typeof ObjectEditDecisionZ>
export type SpatialUsefulness = z.infer<typeof SpatialUsefulnessZ>
export type ObjectEditAudience = z.infer<typeof ObjectEditAudienceZ>

export const OperationControlRecordZ = z.object({
  operation: ObjectEditOperationZ,
  decision: ObjectEditDecisionZ,
  decision_at: z.string().datetime().nullable(),
  reviewer_user_id: z.string().uuid().nullable(),
  rationale: z.string().min(1).max(4000).nullable(),
  evidence_set_id: z.string().uuid().nullable(),
  spatial_usefulness: SpatialUsefulnessZ,
  internal_enabled: z.boolean(),
  production_enabled: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).strict()

export type OperationControlRecord = z.infer<typeof OperationControlRecordZ>

export const OperationControlPatchZ = z.object({
  decision: ObjectEditDecisionZ.optional(),
  decisionAt: z.string().datetime().nullable().optional(),
  reviewerUserId: z.string().uuid().nullable().optional(),
  rationale: z.string().trim().min(1).max(4000).nullable().optional(),
  evidenceSetId: z.string().uuid().nullable().optional(),
  spatialUsefulness: SpatialUsefulnessZ.optional(),
  internalEnabled: z.boolean().optional(),
  productionEnabled: z.boolean().optional(),
}).strict()

export type OperationControlPatch = z.infer<typeof OperationControlPatchZ>

export class OperationControlValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OperationControlValidationError'
  }
}

export class OperationControlAuthorizationError extends Error {
  constructor() {
    super('Only an authorised Studio administrator may change object-edit controls.')
    this.name = 'OperationControlAuthorizationError'
  }
}

async function assertAuthorisedReviewer(actorUserId: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', actorUserId)
    .maybeSingle()

  if (error || data?.role !== 'admin') {
    throw new OperationControlAuthorizationError()
  }
}

export async function assertAuthorisedObjectEditReviewer(actorUserId: string): Promise<void> {
  const reviewerUserId = z.string().uuid().parse(actorUserId)
  await assertAuthorisedReviewer(reviewerUserId)
}

/** A missing, malformed, or non-go control must never enable production. */
export function isProductionAvailable(
  control: Pick<OperationControlRecord, 'decision' | 'production_enabled'> | null | undefined,
): boolean {
  return control?.decision === 'go' && control.production_enabled === true
}

/** Internal availability is independently enabled and additionally requires an authorised tester. */
export function isInternalAvailable(
  control: Pick<OperationControlRecord, 'internal_enabled'> | null | undefined,
  isAuthorisedTester: boolean,
): boolean {
  return isAuthorisedTester && control?.internal_enabled === true
}

export function isOperationAvailable(
  control: OperationControlRecord | null | undefined,
  audience: ObjectEditAudience,
  isAuthorisedTester = false,
): boolean {
  return audience === 'production'
    ? isProductionAvailable(control)
    : isInternalAvailable(control, isAuthorisedTester)
}

/** Merge a partial admin mutation without allowing a decision record to be incomplete. */
export function applyOperationControlPatch(
  current: OperationControlRecord,
  patch: OperationControlPatch,
): Omit<OperationControlRecord, 'created_at' | 'updated_at'> {
  const parsedPatch = OperationControlPatchZ.parse(patch)
  const next = {
    operation: current.operation,
    decision: parsedPatch.decision ?? current.decision,
    decision_at: parsedPatch.decisionAt === undefined ? current.decision_at : parsedPatch.decisionAt,
    reviewer_user_id:
      parsedPatch.reviewerUserId === undefined ? current.reviewer_user_id : parsedPatch.reviewerUserId,
    rationale: parsedPatch.rationale === undefined ? current.rationale : parsedPatch.rationale,
    evidence_set_id: parsedPatch.evidenceSetId === undefined ? current.evidence_set_id : parsedPatch.evidenceSetId,
    spatial_usefulness: parsedPatch.spatialUsefulness ?? current.spatial_usefulness,
    internal_enabled: parsedPatch.internalEnabled ?? current.internal_enabled,
    production_enabled: parsedPatch.productionEnabled ?? current.production_enabled,
  }

  if (next.decision === 'pending') {
    if (
      next.decision_at !== null ||
      next.reviewer_user_id !== null ||
      next.rationale !== null ||
      next.evidence_set_id !== null
    ) {
      throw new OperationControlValidationError(
        'Pending controls cannot contain a reviewer decision or evidence link',
      )
    }
    return next
  }

  if (
    !next.decision_at ||
    !next.reviewer_user_id ||
    !next.rationale?.trim() ||
    !next.evidence_set_id
  ) {
    throw new OperationControlValidationError(
      'A go or no-go decision requires date, reviewer, rationale, and evidence set',
    )
  }

  return next
}

function toControlRecord(value: unknown): OperationControlRecord {
  return OperationControlRecordZ.parse(value)
}

export async function getOperationControl(
  operation: ObjectEditOperation,
): Promise<OperationControlRecord | null> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_object_edit_operation_controls')
    .select('*')
    .eq('operation', operation)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load object-edit operation control: ${error.message}`)
  }

  return data ? toControlRecord(data) : null
}

/** Read failures are deliberately converted to unavailable, not permissive access. */
export async function resolveOperationAvailability(input: {
  operation: ObjectEditOperation
  audience: ObjectEditAudience
  isAuthorisedTester?: boolean
}): Promise<boolean> {
  try {
    return isOperationAvailable(
      await getOperationControl(input.operation),
      input.audience,
      input.isAuthorisedTester,
    )
  } catch {
    return false
  }
}

/**
 * Calls the atomic server-side control update plus audit writer. The caller must
 * first establish that actorUserId is an authorised admin/reviewer; this module
 * deliberately accepts no browser-provided authority claim.
 */
export async function updateOperationControl(input: {
  operation: ObjectEditOperation
  actorUserId: string
  patch: OperationControlPatch
}): Promise<OperationControlRecord> {
  const operation = ObjectEditOperationZ.parse(input.operation)
  const actorUserId = z.string().uuid().parse(input.actorUserId)
  await assertAuthorisedReviewer(actorUserId)
  const current = await getOperationControl(operation)

  if (!current) {
    throw new Error(`Object-edit operation control not found for ${operation}`)
  }

  const next = applyOperationControlPatch(current, input.patch)
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.rpc('studio_update_object_edit_operation_control', {
    p_operation: next.operation,
    p_actor_user_id: actorUserId,
    p_decision: next.decision,
    p_decision_at: next.decision_at,
    p_reviewer_user_id: next.reviewer_user_id,
    p_rationale: next.rationale,
    p_evidence_set_id: next.evidence_set_id,
    p_spatial_usefulness: next.spatial_usefulness,
    p_internal_enabled: next.internal_enabled,
    p_production_enabled: next.production_enabled,
  })

  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(`Failed to update object-edit operation control: ${error?.message ?? 'unknown'}`)
  }

  return toControlRecord(data[0])
}
