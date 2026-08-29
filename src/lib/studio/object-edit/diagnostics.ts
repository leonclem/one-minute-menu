import { createHash, randomUUID } from 'crypto'

import type { ObjectEditOperation } from './operation-controls'

/** Only these fields may cross the object-edit diagnostic boundary. */
export const OBJECT_EDIT_DIAGNOSTIC_KEYS = [
  'request_id',
  'user_id',
  'dish_id',
  'image_id',
  'operation',
  'model_class',
  'stage',
  'duration_ms',
  'error_code',
  'error_type',
  'provider_code',
  'persistence_stage',
  'soft_failure',
] as const

type DiagnosticKey = (typeof OBJECT_EDIT_DIAGNOSTIC_KEYS)[number]
export type ObjectEditDiagnostic = Partial<
  Record<DiagnosticKey, string | number | boolean>
>

export function createObjectEditRequestId(): string {
  return randomUUID()
}

/**
 * Restrict structured diagnostics to the documented scalar allow-list. This is
 * deliberately not a generic object sanitizer: unknown values are dropped so
 * hostile request fields, bytes, URLs, prompts, coordinates, and provider
 * responses cannot accidentally enter logs.
 */
export function sanitizeObjectEditDiagnostic(
  input: Record<string, unknown>,
): ObjectEditDiagnostic {
  const output: ObjectEditDiagnostic = {}
  for (const key of OBJECT_EDIT_DIAGNOSTIC_KEYS) {
    const value = input[key]
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      output[key] = value
    }
  }
  return output
}

export function classifyObjectEditError(error: unknown): string {
  if (error instanceof Error && error.name.length <= 80) return error.name
  return 'UnknownError'
}

export function digestObjectEditIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

export function objectEditDiagnosticContext(input: {
  requestId: string
  userId?: string
  dishId?: string
  imageId?: string
  operation?: ObjectEditOperation
  modelClass?: string
  stage: string
  durationMs?: number
  error?: unknown
  errorCode?: string
  providerCode?: string
  persistenceStage?: string
  softFailure?: string
}): ObjectEditDiagnostic {
  return sanitizeObjectEditDiagnostic({
    request_id: input.requestId,
    ...(input.userId ? { user_id: input.userId } : {}),
    ...(input.dishId ? { dish_id: input.dishId } : {}),
    ...(input.imageId ? { image_id: input.imageId } : {}),
    ...(input.operation ? { operation: input.operation } : {}),
    ...(input.modelClass ? { model_class: input.modelClass } : {}),
    stage: input.stage,
    ...(input.durationMs !== undefined ? { duration_ms: Math.max(0, Math.round(input.durationMs)) } : {}),
    ...(input.error ? { error_type: classifyObjectEditError(input.error) } : {}),
    ...(input.errorCode ? { error_code: input.errorCode } : {}),
    ...(input.providerCode ? { provider_code: input.providerCode } : {}),
    ...(input.persistenceStage ? { persistence_stage: input.persistenceStage } : {}),
    ...(input.softFailure ? { soft_failure: input.softFailure } : {}),
  })
}
