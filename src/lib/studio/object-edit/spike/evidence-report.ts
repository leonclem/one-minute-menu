import 'server-only'

import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { ObjectEditOperationZ, type ObjectEditOperation } from '../operation-controls'
import {
  SpikeExecutionInputZ,
  SpikeModelClassZ,
  type SpikeExecutionInput,
  type SpikeModelClass,
} from './evidence-store'

const RawGroupZ = z.object({
  id: z.string().uuid(),
  spike_case_id: z.string().uuid(),
  operation: ObjectEditOperationZ,
  requested_model_class: SpikeModelClassZ,
  configured_model_identifier: z.string(),
  source_digest: z.string(),
  annotated_digest: z.string(),
  contract_digest: z.string(),
  created_at: z.string(),
}).passthrough()

const RawCaseZ = z.object({
  id: z.string().uuid(),
  operation: ObjectEditOperationZ,
  requested_model_class: SpikeModelClassZ,
  configured_model_identifier: z.string(),
  source_artifact: z.unknown(),
  annotated_artifact: z.unknown(),
  selection: z.unknown(),
  placement: z.unknown().nullable(),
  scenario_tags: z.array(z.string()),
  created_at: z.string(),
}).passthrough()

const RawExecutionZ = z.object({
  id: z.string().uuid(),
  comparison_group_id: z.string().uuid(),
  variant: z.enum(['A', 'B', 'C']),
  operation: ObjectEditOperationZ,
  requested_model_class: SpikeModelClassZ,
  configured_model_identifier: z.string(),
  provider_reported_model_identity: z.string().nullable(),
  contract_digest: z.string(),
  source_digest: z.string(),
  annotated_digest: z.string(),
  outcome: z.enum(['generated', 'provider_error', 'transport_error', 'validation_error']),
  output_artifact: z.unknown().nullable(),
  failure_artifact: z.unknown().nullable(),
  no_failure_artifact_returned: z.boolean(),
  scores: z.unknown(),
  observations: z.array(z.string()),
  failure_notes: z.array(z.string()),
  created_at: z.string(),
}).passthrough()

export interface SpikeEvidenceReportExecution extends SpikeExecutionInput {
  id: string
  createdAt: string
}

export interface SpikeEvidenceComparisonGroup {
  id: string
  operation: ObjectEditOperation
  requestedModelClass: SpikeModelClass
  configuredModelIdentifier: string
  sourceDigest: string
  annotatedDigest: string
  fixedContractDigest: string
  caseId: string
  scenarioTags: readonly string[]
  executions: readonly SpikeEvidenceReportExecution[]
}

export interface SpikeEvidenceReport {
  operation: ObjectEditOperation
  groupsByModel: Readonly<Record<SpikeModelClass, readonly SpikeEvidenceComparisonGroup[]>>
}

/**
 * Service-role read model for the internal reviewer surface. It returns artifact
 * references/digests and reviewer-relevant records only; it never downloads or
 * serializes image bytes or raw provider responses.
 */
export async function loadSpikeEvidenceReport(operation: ObjectEditOperation): Promise<SpikeEvidenceReport> {
  const parsedOperation = ObjectEditOperationZ.parse(operation)
  const supabase = createAdminSupabaseClient()
  const [{ data: groups, error: groupsError }, { data: cases, error: casesError }, { data: executions, error: executionsError }] =
    await Promise.all([
      supabase
        .from('studio_object_edit_spike_comparison_groups')
        .select('*')
        .eq('operation', parsedOperation)
        .order('created_at', { ascending: true }),
      supabase
        .from('studio_object_edit_spike_cases')
        .select('*')
        .eq('operation', parsedOperation),
      supabase
        .from('studio_object_edit_spike_executions')
        .select('*')
        .eq('operation', parsedOperation)
        .order('created_at', { ascending: true }),
    ])

  if (groupsError || casesError || executionsError) {
    throw new Error(
      `Failed to load object-edit spike evidence: ${groupsError?.message ?? casesError?.message ?? executionsError?.message ?? 'unknown'}`,
    )
  }

  const parsedGroups = (groups ?? []).map((row) => RawGroupZ.parse(row))
  const casesById = new Map((cases ?? []).map((row) => {
    const parsed = RawCaseZ.parse(row)
    return [parsed.id, parsed] as const
  }))
  const executionsByGroup = new Map<string, SpikeEvidenceReportExecution[]>()
  for (const row of executions ?? []) {
    const parsed = RawExecutionZ.parse(row)
    const execution = SpikeExecutionInputZ.parse({
      id: parsed.id,
      comparisonGroupId: parsed.comparison_group_id,
      variant: parsed.variant,
      operation: parsed.operation,
      requestedModelClass: parsed.requested_model_class,
      configuredModelIdentifier: parsed.configured_model_identifier,
      providerReportedModelIdentity: parsed.provider_reported_model_identity,
      contractDigest: parsed.contract_digest,
      sourceDigest: parsed.source_digest,
      annotatedDigest: parsed.annotated_digest,
      outcome: parsed.outcome,
      outputArtifact: parsed.output_artifact,
      failureArtifact: parsed.failure_artifact,
      noFailureArtifactReturned: parsed.no_failure_artifact_returned,
      scores: parsed.scores,
      observations: parsed.observations,
      failureNotes: parsed.failure_notes,
    })
    executionsByGroup.set(parsed.comparison_group_id, [
      ...(executionsByGroup.get(parsed.comparison_group_id) ?? []),
      { ...execution, id: parsed.id, createdAt: parsed.created_at },
    ])
  }

  const groupsByModel: Record<SpikeModelClass, SpikeEvidenceComparisonGroup[]> = { nb2: [], nb_pro: [] }
  for (const group of parsedGroups) {
    const spikeCase = casesById.get(group.spike_case_id)
    if (!spikeCase) {
      throw new Error(`Spike evidence group ${group.id} references a missing case.`)
    }
    groupsByModel[group.requested_model_class].push({
      id: group.id,
      operation: group.operation,
      requestedModelClass: group.requested_model_class,
      configuredModelIdentifier: group.configured_model_identifier,
      sourceDigest: group.source_digest,
      annotatedDigest: group.annotated_digest,
      fixedContractDigest: group.contract_digest,
      caseId: spikeCase.id,
      scenarioTags: spikeCase.scenario_tags,
      executions: executionsByGroup.get(group.id) ?? [],
    })
  }

  return { operation: parsedOperation, groupsByModel }
}
