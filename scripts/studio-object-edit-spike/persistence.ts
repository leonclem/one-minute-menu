import { z } from 'zod'
import {
  SpikeArtifactUploadInputZ,
  sha256Hex,
  uploadSpikeArtifact,
  type SpikeArtifactUploadInput,
} from './artifacts'
import {
  assertComparisonGroupInvariants,
  type PreparedSpikeComparisonGroup,
  type PreparedSpikeRequest,
  type SpikeVariant,
} from './construction'
import type { SpikeScenarioCase } from './manifest'
import type { SpikeRunRecord } from './runner'
import {
  SpikeArtifactZ,
  SpikeCaseInputZ,
  SpikeComparisonGroupInputZ,
  SpikeExecutionInputZ,
  SpikeScoresZ,
  SpikeVariantZ,
  createSpikeCase,
  createSpikeComparisonGroup,
  createSpikeExecution,
  type SpikeCaseInput,
  type SpikeComparisonGroupInput,
  type SpikeExecutionInput,
} from '@/lib/studio/object-edit/spike/evidence-store'

const PERSISTENCE_VALIDATION_GROUP_ID = '00000000-0000-4000-8000-000000000000'
const SPIKE_VARIANTS: readonly SpikeVariant[] = ['A', 'B', 'C']
type SpikeArtifact = z.infer<typeof SpikeArtifactZ>

/**
 * Human input is intentionally separate from runner output: the runner never
 * infers scores, observations, or review notes. A nullable runner review is
 * therefore not a persistence input.
 */
export const HumanSpikeExecutionReviewZ = z
  .object({
    variant: SpikeVariantZ,
    scores: SpikeScoresZ,
    observations: z.array(z.string().trim().min(1).max(2000)).max(100),
    failureNotes: z.array(z.string().trim().min(1).max(2000)).max(100),
    /** A returned provider failure artifact, if one was retained outside the runner. */
    failureArtifact: SpikeArtifactZ.nullable().optional().default(null),
  })
  .strict()

export type HumanSpikeExecutionReview = z.infer<typeof HumanSpikeExecutionReviewZ>

export interface PersistCompletedSpikeComparisonGroupInput {
  scenarioCase: SpikeScenarioCase
  comparisonGroup: PreparedSpikeComparisonGroup
  records: readonly SpikeRunRecord[]
  humanReviews: readonly HumanSpikeExecutionReview[]
}

export interface SpikePersistenceDependencies {
  uploadArtifact: (input: SpikeArtifactUploadInput) => Promise<SpikeArtifact>
  createCase: (input: SpikeCaseInput) => Promise<string>
  createComparisonGroup: (input: SpikeComparisonGroupInput) => Promise<string>
  createExecution: (input: SpikeExecutionInput) => Promise<string>
}

export interface PersistedSpikeComparisonGroup {
  spikeCaseId: string
  comparisonGroupId: string
  executionIds: Readonly<Record<SpikeVariant, string>>
  cleanArtifact: SpikeArtifact
  annotatedArtifact: SpikeArtifact
}

const defaultDependencies: SpikePersistenceDependencies = {
  uploadArtifact: uploadSpikeArtifact,
  createCase: createSpikeCase,
  createComparisonGroup: createSpikeComparisonGroup,
  createExecution: createSpikeExecution,
}

function recordsByVariant<T extends { variant: SpikeVariant }>(values: readonly T[], label: string): Map<SpikeVariant, T> {
  if (values.length !== SPIKE_VARIANTS.length) {
    throw new Error(`${label} must contain exactly one complete A/B/C comparison group.`)
  }

  const byVariant = new Map<SpikeVariant, T>()
  for (const value of values) {
    if (!SPIKE_VARIANTS.includes(value.variant) || byVariant.has(value.variant)) {
      throw new Error(`${label} must contain exactly one complete A/B/C comparison group.`)
    }
    byVariant.set(value.variant, value)
  }
  if (SPIKE_VARIANTS.some((variant) => !byVariant.has(variant))) {
    throw new Error(`${label} must contain exactly one complete A/B/C comparison group.`)
  }
  return byVariant
}

function assertRecordMatchesRequest(
  record: SpikeRunRecord,
  request: PreparedSpikeRequest,
  scenarioCase: SpikeScenarioCase,
): void {
  if (record.mode !== 'live' || record.outcome === undefined) {
    throw new Error('Only completed live spike records can be persisted.')
  }
  if (record.caseId !== scenarioCase.id || record.variant !== request.variant) {
    throw new Error('Spike records must belong to the supplied scenario case and A/B/C variant.')
  }
  if (
    record.operation !== request.operation ||
    record.requestedModelClass !== request.requestedModelClass ||
    record.configuredModelIdentifier !== request.configuredModelIdentifier ||
    record.operation !== scenarioCase.operation ||
    record.requestedModelClass !== scenarioCase.requestedModelClass ||
    record.configuredModelIdentifier !== scenarioCase.configuredModelIdentifier
  ) {
    throw new Error('Spike record operation or model does not match its comparison group.')
  }
  if (
    record.sourceDigest !== request.sourceDigest ||
    record.annotatedDigest !== request.annotatedDigest ||
    record.fixedContractDigest !== request.fixedContractDigest ||
    record.contractDigest !== request.contractDigest ||
    record.sourceDigest !== scenarioCase.sourceArtifact.sha256
  ) {
    throw new Error('Spike record digests do not match its comparison group.')
  }
  if (record.providerIdentityReported !== (record.providerReportedModelIdentity !== null)) {
    throw new Error('Spike provider identity flag does not match the reported identity.')
  }
}

function parseHumanReviews(
  reviews: readonly HumanSpikeExecutionReview[],
): Map<SpikeVariant, HumanSpikeExecutionReview> {
  const parsed = reviews.map((review) => HumanSpikeExecutionReviewZ.parse(review))
  return recordsByVariant(parsed, 'Human spike reviews')
}

function labelFor(caseId: string, kind: 'clean' | 'annotated'): string {
  return `case-${sha256Hex(Buffer.from(caseId)).slice(0, 32)}-${kind}`
}

function preparedArtifactUpload(
  caseId: string,
  kind: 'clean' | 'annotated',
  image: PreparedSpikeComparisonGroup['preparedImages']['clean'],
): SpikeArtifactUploadInput {
  return SpikeArtifactUploadInputZ.parse({
    mimeType: image.mimeType,
    bytes: Buffer.from(image.data, 'base64'),
    label: labelFor(caseId, kind),
  })
}

function executionInput(
  record: SpikeRunRecord,
  review: HumanSpikeExecutionReview,
  comparisonGroupId: string,
): SpikeExecutionInput {
  const outputArtifact = record.outputArtifact === undefined ? null : SpikeArtifactZ.parse(record.outputArtifact)
  const failureArtifact = review.failureArtifact

  if (record.outcome === 'generated') {
    if (failureArtifact !== null) {
      throw new Error('Generated spike records cannot carry a failure artifact.')
    }
  } else {
    if (outputArtifact !== null) {
      throw new Error('Failed spike records cannot carry a generated output artifact.')
    }
    if (failureArtifact === null && record.noFailureArtifactReturned !== true) {
      throw new Error('Failed spike records require a retained failure artifact or explicit absence.')
    }
    if (review.failureNotes.length === 0) {
      throw new Error('Failed spike records require human-supplied failure notes.')
    }
  }
  if (record.noFailureArtifactReturned === true && failureArtifact !== null) {
    throw new Error('A retained failure artifact conflicts with explicit failure-artifact absence.')
  }

  return SpikeExecutionInputZ.parse({
    comparisonGroupId,
    variant: record.variant,
    operation: record.operation,
    requestedModelClass: record.requestedModelClass,
    configuredModelIdentifier: record.configuredModelIdentifier,
    providerReportedModelIdentity: record.providerReportedModelIdentity,
    contractDigest: record.contractDigest,
    sourceDigest: record.sourceDigest,
    annotatedDigest: record.annotatedDigest,
    outcome: record.outcome,
    outputArtifact,
    failureArtifact,
    noFailureArtifactReturned: failureArtifact === null && record.noFailureArtifactReturned === true,
    scores: review.scores,
    observations: review.observations,
    failureNotes: review.failureNotes,
  })
}

/**
 * Internal-only persistence adapter for one complete, already-run A/B/C group.
 * It performs every record and human-review check before it uploads artifacts or
 * creates immutable database rows. The evidence store intentionally exposes
 * individual append-only writes, so callers must surface any later write error
 * rather than attempting to mutate or delete prior immutable evidence.
 */
export async function persistCompletedSpikeComparisonGroup(
  input: PersistCompletedSpikeComparisonGroupInput,
  dependencies: Partial<SpikePersistenceDependencies> = {},
): Promise<PersistedSpikeComparisonGroup> {
  const services = { ...defaultDependencies, ...dependencies }
  assertComparisonGroupInvariants(input.comparisonGroup.requests)

  const requests = recordsByVariant(input.comparisonGroup.requests, 'Prepared spike requests')
  const records = recordsByVariant(input.records, 'Spike records')
  const humanReviews = parseHumanReviews(input.humanReviews)

  for (const variant of SPIKE_VARIANTS) {
    assertRecordMatchesRequest(records.get(variant)!, requests.get(variant)!, input.scenarioCase)
  }

  const firstRequest = requests.get('A')!
  // Validate every supplied output/failure artifact and complete human score before
  // any artifact or immutable database write is attempted.
  const validatedExecutions = SPIKE_VARIANTS.map((variant) =>
    executionInput(records.get(variant)!, humanReviews.get(variant)!, PERSISTENCE_VALIDATION_GROUP_ID),
  )
  const cleanUpload = preparedArtifactUpload(input.scenarioCase.id, 'clean', input.comparisonGroup.preparedImages.clean)
  const annotatedUpload = preparedArtifactUpload(
    input.scenarioCase.id,
    'annotated',
    input.comparisonGroup.preparedImages.annotated,
  )
  if (sha256Hex(annotatedUpload.bytes) !== firstRequest.annotatedDigest) {
    throw new Error('Prepared annotated artifact does not match the A/B/C annotation digest.')
  }

  // Artifact storage precedes immutable database persistence; both upload results
  // are parsed and the uploaded annotation remains bound to the exercised A/B/C input.
  const cleanArtifact = SpikeArtifactZ.parse(await services.uploadArtifact(cleanUpload))
  const annotatedArtifact = SpikeArtifactZ.parse(await services.uploadArtifact(annotatedUpload))
  if (annotatedArtifact.sha256 !== firstRequest.annotatedDigest) {
    throw new Error('Uploaded annotated artifact does not match the A/B/C annotation digest.')
  }

  const caseInput = SpikeCaseInputZ.parse({
    operation: input.scenarioCase.operation,
    requestedModelClass: input.scenarioCase.requestedModelClass,
    configuredModelIdentifier: input.scenarioCase.configuredModelIdentifier,
    sourceArtifact: cleanArtifact,
    annotatedArtifact,
    selection: input.scenarioCase.selection,
    placement: input.scenarioCase.placement ?? null,
    scenarioTags: input.scenarioCase.scenarioTags,
  })
  const groupInput = SpikeComparisonGroupInputZ.parse({
    spikeCaseId: PERSISTENCE_VALIDATION_GROUP_ID,
    operation: firstRequest.operation,
    requestedModelClass: firstRequest.requestedModelClass,
    configuredModelIdentifier: firstRequest.configuredModelIdentifier,
    sourceDigest: firstRequest.sourceDigest,
    annotatedDigest: firstRequest.annotatedDigest,
    contractDigest: firstRequest.fixedContractDigest,
  })
  const spikeCaseId = await services.createCase(caseInput)
  const comparisonGroupId = await services.createComparisonGroup({ ...groupInput, spikeCaseId })
  const executionIds = {} as Record<SpikeVariant, string>
  for (const execution of validatedExecutions) {
    executionIds[execution.variant] = await services.createExecution({ ...execution, comparisonGroupId })
  }

  return { spikeCaseId, comparisonGroupId, executionIds, cleanArtifact, annotatedArtifact }
}
