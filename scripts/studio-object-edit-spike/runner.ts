import 'server-only'

import { NanoBananaError } from '@/lib/nano-banana'
import { MutationEngine } from '@/lib/photo-control/mutation-engine'
import type { PhotoControlMimeType } from '@/lib/photo-control/request-validation'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { NormalizedGeneratedImage } from '@/lib/studio/generation-executor'
import {
  configuredSpikeArtifactOwnerUserId,
  sha256Hex,
  uploadSpikeArtifact,
  type SpikeArtifactUploadInput,
} from './artifacts'
import {
  constructSpikeComparisonGroup,
  executePreparedSpikeRequest,
  type PreparedSpikeRequest,
} from './construction'
import type { SpikeScenarioCase, SpikeScenarioTag } from './manifest'
import { unscoredReview, type SpikeReview } from './rubric'

export const SPIKE_LIVE_CONFIRMATION = 'EXECUTE_INTERNAL_OBJECT_EDIT_SPIKE'
export const MAX_SPIKE_EXECUTIONS = 24

export type SpikeRunnerMode = 'dry_run' | 'live'
export type NormalizedSpikeOutcome =
  | 'generated'
  | 'provider_error'
  | 'transport_error'
  | 'validation_error'

export interface SpikeRunFilters {
  caseIds?: readonly string[]
  operations?: readonly ('remove' | 'move')[]
  requestedModelClasses?: readonly ('nb2' | 'nb_pro')[]
  variants?: readonly ('A' | 'B' | 'C')[]
  scenarioTags?: readonly SpikeScenarioTag[]
}

export interface RunnableSpikeCase {
  scenarioCase: SpikeScenarioCase
  sourceBytes: Buffer
  sourceMimeType: PhotoControlMimeType
  canonical: MinimalSchema
  currentSpatialInventory: unknown
}

export interface SpikeRunConfiguration {
  /** Defaults to dry_run. Live mode is unavailable without all explicit interlocks. */
  mode?: SpikeRunnerMode
  confirmLiveExecution?: string
  maxExecutions?: number
  filters?: SpikeRunFilters
}

export interface SpikeRunRecord {
  caseId: string
  variant: 'A' | 'B' | 'C'
  operation: 'remove' | 'move'
  requestedModelClass: 'nb2' | 'nb_pro'
  configuredModelIdentifier: string
  providerReportedModelIdentity: string | null
  providerIdentityReported: boolean
  sourceDigest: string
  annotatedDigest: string
  fixedContractDigest: string
  contractDigest: string
  mode: SpikeRunnerMode
  outcome?: NormalizedSpikeOutcome
  outputArtifact?: Awaited<ReturnType<typeof uploadSpikeArtifact>>
  noFailureArtifactReturned?: true
  review: SpikeReview
}

export interface SpikeRunResult {
  mode: SpikeRunnerMode
  selectedExecutionCount: number
  records: readonly SpikeRunRecord[]
}

function includes<T>(values: readonly T[] | undefined, value: T): boolean {
  return values === undefined || values.includes(value)
}

function caseMatchesFilters(scenarioCase: SpikeScenarioCase, filters: SpikeRunFilters | undefined): boolean {
  return (
    includes(filters?.caseIds, scenarioCase.id) &&
    includes(filters?.operations, scenarioCase.operation) &&
    includes(filters?.requestedModelClasses, scenarioCase.requestedModelClass) &&
    (filters?.scenarioTags === undefined ||
      filters.scenarioTags.some((tag) => scenarioCase.scenarioTags.includes(tag)))
  )
}

function selectRequest(
  request: PreparedSpikeRequest,
  scenarioCase: SpikeScenarioCase,
  filters: SpikeRunFilters | undefined,
): boolean {
  return caseMatchesFilters(scenarioCase, filters) && includes(filters?.variants, request.variant)
}

function readMode(configuration: SpikeRunConfiguration): SpikeRunnerMode {
  return configuration.mode ?? 'dry_run'
}

function assertExecutionBound(count: number, configuration: SpikeRunConfiguration): void {
  const maximum = configuration.maxExecutions ?? MAX_SPIKE_EXECUTIONS
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > MAX_SPIKE_EXECUTIONS) {
    throw new Error(`maxExecutions must be an integer from 1 through ${MAX_SPIKE_EXECUTIONS}.`)
  }
  if (count > maximum) {
    throw new Error(`Selected ${count} executions, exceeding the configured maximum of ${maximum}.`)
  }
}

function assertLiveExecutionAllowed(configuration: SpikeRunConfiguration): void {
  if (process.env.STUDIO_OBJECT_EDIT_SPIKE_LIVE_ENABLED !== 'true') {
    throw new Error('Live spike execution requires STUDIO_OBJECT_EDIT_SPIKE_LIVE_ENABLED=true.')
  }
  if (configuration.confirmLiveExecution !== SPIKE_LIVE_CONFIRMATION) {
    throw new Error('Live spike execution requires the explicit internal confirmation value.')
  }
  configuredSpikeArtifactOwnerUserId()
}

function normalizeProviderFailure(error: unknown): NormalizedSpikeOutcome {
  if (error instanceof NanoBananaError) return 'provider_error'
  if (error instanceof Error && error.name === 'ObjectEditImagePreparationError') return 'validation_error'
  return 'transport_error'
}

function failureReview(operation: 'remove' | 'move', outcome: NormalizedSpikeOutcome): SpikeReview {
  const review = unscoredReview(operation)
  const note =
    outcome === 'provider_error'
      ? 'Provider execution failed without a returned failure artifact.'
      : outcome === 'validation_error'
        ? 'Input validation failed before provider execution.'
        : 'Transport or runtime execution failed without a returned failure artifact.'
  return { ...review, failureNotes: [note] }
}

function buildRecord(request: PreparedSpikeRequest, mode: SpikeRunnerMode): SpikeRunRecord {
  return {
    caseId: '',
    variant: request.variant,
    operation: request.operation,
    requestedModelClass: request.requestedModelClass,
    configuredModelIdentifier: request.configuredModelIdentifier,
    providerReportedModelIdentity: null,
    providerIdentityReported: false,
    sourceDigest: request.sourceDigest,
    annotatedDigest: request.annotatedDigest,
    fixedContractDigest: request.fixedContractDigest,
    contractDigest: request.contractDigest,
    mode,
    review: unscoredReview(request.operation),
  }
}

function validationFailureRecord(
  scenarioCase: SpikeScenarioCase,
  variant: 'A' | 'B' | 'C',
  mode: SpikeRunnerMode,
): SpikeRunRecord {
  return {
    caseId: scenarioCase.id,
    variant,
    operation: scenarioCase.operation,
    requestedModelClass: scenarioCase.requestedModelClass,
    configuredModelIdentifier: scenarioCase.configuredModelIdentifier,
    providerReportedModelIdentity: null,
    providerIdentityReported: false,
    sourceDigest: 'unavailable',
    annotatedDigest: 'unavailable',
    fixedContractDigest: 'unavailable',
    contractDigest: 'unavailable',
    mode,
    outcome: 'validation_error',
    noFailureArtifactReturned: true,
    review: failureReview(scenarioCase.operation, 'validation_error'),
  }
}

function outputArtifactUpload(
  result: NormalizedGeneratedImage,
  request: PreparedSpikeRequest,
  caseId: string,
): SpikeArtifactUploadInput {
  return {
    mimeType: 'image/png',
    bytes: Buffer.from(result.imageBase64, 'base64'),
    label: `case-${sha256Hex(Buffer.from(caseId)).slice(0, 32)}-${request.variant.toLowerCase()}`,
  }
}

/**
 * Internal-only service entry point. It has no route exports, accepts no customer
 * identifiers, and deliberately emits no source bytes, prompt text, coordinates,
 * URLs, or raw provider errors.
 */
export async function runStudioObjectEditSpike(
  runnableCases: readonly RunnableSpikeCase[],
  configuration: SpikeRunConfiguration = {},
): Promise<SpikeRunResult> {
  const mode = readMode(configuration)
  if (mode === 'live') assertLiveExecutionAllowed(configuration)

  const selected: Array<{ caseId: string; request: PreparedSpikeRequest }> = []
  const validationFailures: SpikeRunRecord[] = []
  for (const runnableCase of runnableCases) {
    if (!caseMatchesFilters(runnableCase.scenarioCase, configuration.filters)) continue
    try {
      const group = await constructSpikeComparisonGroup(runnableCase)
      for (const request of group.requests) {
        if (selectRequest(request, runnableCase.scenarioCase, configuration.filters)) {
          selected.push({ caseId: runnableCase.scenarioCase.id, request })
        }
      }
    } catch {
      if (mode === 'live') throw new Error('Selected spike case could not be prepared for live execution.')
      for (const variant of ['A', 'B', 'C'] as const) {
        if (includes(configuration.filters?.variants, variant)) {
          validationFailures.push(validationFailureRecord(runnableCase.scenarioCase, variant, mode))
        }
      }
    }
  }

  const selectedExecutionCount = selected.length + validationFailures.length
  assertExecutionBound(selectedExecutionCount, configuration)
  if (mode === 'dry_run') {
    return {
      mode,
      selectedExecutionCount,
      records: [
        ...selected.map(({ caseId, request }) => ({ ...buildRecord(request, mode), caseId })),
        ...validationFailures,
      ],
    }
  }

  const engine = new MutationEngine()
  const records: SpikeRunRecord[] = []
  for (const { caseId, request } of selected) {
    const record = { ...buildRecord(request, mode), caseId }
    try {
      const result = await executePreparedSpikeRequest(engine, request)
      const outputArtifact = await uploadSpikeArtifact(outputArtifactUpload(result, request, caseId))
      records.push({
        ...record,
        outcome: 'generated',
        outputArtifact,
        providerReportedModelIdentity: result.providerModelIdentity,
        providerIdentityReported: result.providerModelIdentity !== null,
      })
    } catch (error) {
      records.push({
        ...record,
        review: failureReview(record.operation, normalizeProviderFailure(error)),
        outcome: normalizeProviderFailure(error),
        noFailureArtifactReturned: true,
      })
    }
  }

  return { mode, selectedExecutionCount, records }
}
