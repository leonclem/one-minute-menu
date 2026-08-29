/**
 * Studio post-generation validation: env gate, reusable extraction evidence,
 * score projection, and metadata helpers. Extraction remains a soft path.
 */

import { createHash } from 'crypto'
import {
  GeminiExtractionClient,
  type ImageMimeType,
} from '@/lib/photo-control/gemini-extraction-client'
import {
  scoreOutputAgainstExpected,
  toClientValidationSummary,
  type OutputValidationResult,
  type OutputValidationStagedField,
  type OutputValidationStatus,
  type RequestedStyleDescriptors,
} from '@/lib/photo-control/output-validator'
import { MinimalSchemaValidator } from '@/lib/photo-control/schema-validator'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { logger } from '@/lib/logger'

const STUDIO_OUTPUT_EVIDENCE_VERSION = 1 as const

/** Default on when unset — private-beta quality signal. */
export function isStudioOutputValidationEnabled(): boolean {
  const raw = process.env.STUDIO_OUTPUT_VALIDATION_ENABLED
  if (raw === undefined || raw === '') return true
  const normalized = raw.trim().toLowerCase()
  return normalized !== 'false' && normalized !== '0' && normalized !== 'off'
}

export interface StudioValidationClientSummary {
  status: OutputValidationStatus
  score: number
  summary: string
}

export interface StudioOutputEvidence {
  /** Deterministic identity for one extractor result over one generated image. */
  extractionId: string
  imageDigest: string
  versions: {
    evidence: typeof STUDIO_OUTPUT_EVIDENCE_VERSION
    canonical: 1
    spatial: 1
  }
  /** Validated current-image canonical observations. */
  canonical: MinimalSchema
  /** Raw optional provider spatial observation; it is bound to a child image later. */
  spatialObservation?: unknown
}

export interface ExtractStudioOutputEvidenceInput {
  imageBase64: string
  mimeType: ImageMimeType
}

export interface StudioOutputEvidenceDependencies {
  extract?: (input: ExtractStudioOutputEvidenceInput) => Promise<{ raw: unknown }>
}

function skippedResult(reason: string): OutputValidationResult {
  return {
    status: 'skipped',
    score: 0,
    summary: reason,
    dimensions: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function spatialObservationFromRaw(raw: unknown): unknown | undefined {
  if (!isRecord(raw)) return undefined
  if (raw.spatialInventory !== undefined) return { spatialInventory: raw.spatialInventory }
  if (raw.spatial_inventory !== undefined) return { spatial_inventory: raw.spatial_inventory }
  return undefined
}

/** Digest includes MIME so reusable evidence cannot cross encoded image contracts. */
export function studioOutputImageDigest(input: ExtractStudioOutputEvidenceInput): string {
  return createHash('sha256')
    .update(input.mimeType)
    .update('\0')
    .update(Buffer.from(input.imageBase64, 'base64'))
    .digest('hex')
}

function extractionIdentity(imageDigest: string, canonical: MinimalSchema, spatialObservation?: unknown): string {
  return createHash('sha256')
    .update(`studio-output-evidence-v${STUDIO_OUTPUT_EVIDENCE_VERSION}`)
    .update(imageDigest)
    .update(JSON.stringify(canonical))
    .update(JSON.stringify(spatialObservation ?? null))
    .digest('hex')
}

/**
 * Re-extracts a generated image once and retains validated canonical evidence
 * plus optional raw spatial observations for later reconciliation. Returning
 * null intentionally keeps extraction failures non-blocking.
 */
export async function extractStudioOutputEvidence(
  input: ExtractStudioOutputEvidenceInput,
  dependencies: StudioOutputEvidenceDependencies = {},
): Promise<StudioOutputEvidence | null> {
  if (!isStudioOutputValidationEnabled()) return null

  try {
    const extraction = dependencies.extract
      ? await dependencies.extract(input)
      : await new GeminiExtractionClient().extract(input)
    const { data } = new MinimalSchemaValidator().validate(extraction.raw)
    const spatialObservation = spatialObservationFromRaw(extraction.raw)
    const imageDigest = studioOutputImageDigest(input)
    return {
      extractionId: extractionIdentity(imageDigest, data, spatialObservation),
      imageDigest,
      versions: { evidence: STUDIO_OUTPUT_EVIDENCE_VERSION, canonical: 1, spatial: 1 },
      canonical: data,
      ...(spatialObservation === undefined ? {} : { spatialObservation }),
    }
  } catch (error) {
    logger.warn('⚠️ [Studio Validation] Re-extract failed; soft-skipping', { error })
    return null
  }
}

export function isCompatibleStudioOutputEvidence(
  evidence: StudioOutputEvidence | null | undefined,
  input: ExtractStudioOutputEvidenceInput,
): evidence is StudioOutputEvidence {
  return Boolean(
    evidence &&
      evidence.imageDigest === studioOutputImageDigest(input) &&
      evidence.versions.evidence === STUDIO_OUTPUT_EVIDENCE_VERSION &&
      evidence.versions.canonical === 1 &&
      evidence.versions.spatial === 1,
  )
}

/** Uses a compatible post-generation result instead of making a second provider extraction. */
export async function reuseOrExtractStudioOutputEvidence(
  input: ExtractStudioOutputEvidenceInput,
  existing?: StudioOutputEvidence | null,
  dependencies: StudioOutputEvidenceDependencies = {},
): Promise<StudioOutputEvidence | null> {
  if (isCompatibleStudioOutputEvidence(existing, input)) return existing
  return extractStudioOutputEvidence(input, dependencies)
}

export function scoreStudioOutputEvidence(input: {
  evidence: StudioOutputEvidence | null
  expected: MinimalSchema
  stagedFields?: readonly OutputValidationStagedField[]
  requestedStyleDescriptors?: RequestedStyleDescriptors
}): OutputValidationResult {
  if (!input.evidence) return skippedResult('Output validation skipped after extract error.')
  return scoreOutputAgainstExpected(
    input.expected,
    input.evidence.canonical,
    input.stagedFields,
    input.requestedStyleDescriptors,
  )
}

/**
 * Compatibility wrapper for current mutation routes. Its response and skipped
 * semantics remain unchanged while future object edits can reuse the evidence.
 */
export async function runStudioOutputValidation(input: {
  imageBase64: string
  mimeType: ImageMimeType
  expected: MinimalSchema
  stagedFields?: readonly OutputValidationStagedField[]
  requestedStyleDescriptors?: RequestedStyleDescriptors
}): Promise<OutputValidationResult> {
  if (!isStudioOutputValidationEnabled()) {
    return skippedResult('Output validation disabled.')
  }

  const evidence = await extractStudioOutputEvidence(input)
  return scoreStudioOutputEvidence({
    evidence,
    expected: input.expected,
    stagedFields: input.stagedFields,
    requestedStyleDescriptors: input.requestedStyleDescriptors,
  })
}

export function validationToMetadata(
  result: OutputValidationResult,
): Record<string, unknown> {
  return {
    status: result.status,
    score: result.score,
    summary: result.summary,
    dimensions: result.dimensions,
  }
}

export function readValidationFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): StudioValidationClientSummary | null {
  if (!metadata) return null
  const raw = metadata.validation
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const status = record.status
  if (
    status !== 'pass' &&
    status !== 'warn' &&
    status !== 'fail' &&
    status !== 'skipped'
  ) {
    return null
  }
  return {
    status,
    score: typeof record.score === 'number' ? record.score : 0,
    summary: typeof record.summary === 'string' ? record.summary : '',
  }
}

export function clientValidationPayload(
  result: OutputValidationResult,
): StudioValidationClientSummary {
  return toClientValidationSummary(result)
}
