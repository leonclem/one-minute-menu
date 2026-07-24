/**
 * Studio post-generation validation: env gate, extract + score, metadata helpers.
 *
 * Soft-flag only — never fails a successful generation.
 */

import {
  GeminiExtractionClient,
  type ImageMimeType,
} from '@/lib/photo-control/gemini-extraction-client'
import {
  scoreOutputAgainstExpected,
  toClientValidationSummary,
  type OutputValidationResult,
  type OutputValidationStatus,
} from '@/lib/photo-control/output-validator'
import { MinimalSchemaValidator } from '@/lib/photo-control/schema-validator'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { logger } from '@/lib/logger'

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

function skippedResult(reason: string): OutputValidationResult {
  return {
    status: 'skipped',
    score: 0,
    summary: reason,
    dimensions: [],
  }
}

/**
 * Re-extract a generated image and score it against the expected target schema.
 * On any extract/validation error, returns `skipped` (never throws for soft path).
 */
export async function runStudioOutputValidation(input: {
  imageBase64: string
  mimeType: ImageMimeType
  expected: MinimalSchema
}): Promise<OutputValidationResult> {
  if (!isStudioOutputValidationEnabled()) {
    return skippedResult('Output validation disabled.')
  }

  try {
    const client = new GeminiExtractionClient()
    const { raw } = await client.extract({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
    })
    const { data } = new MinimalSchemaValidator().validate(raw)
    return scoreOutputAgainstExpected(input.expected, data)
  } catch (error) {
    logger.warn('⚠️ [Studio Validation] Re-extract failed; soft-skipping', { error })
    return skippedResult('Output validation skipped after extract error.')
  }
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
