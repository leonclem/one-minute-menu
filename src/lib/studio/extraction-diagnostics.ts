import {
  ANGLE_VALUES,
  FRAMING_VALUES,
  SPIN_VALUES,
} from '@/lib/photo-control/minimal-schema'
import type {
  MinimalValidationResult,
  MinimalValidationWarning,
} from '@/lib/photo-control/schema-validator'

export const EXTRACTION_DIAGNOSTICS_MAX_BYTES = 8192

export type ExtractionOmissionReason =
  | 'absent'
  | 'invalid'
  | 'coerced_for_control_state'

export interface ExtractionOmission {
  path: string
  reason: ExtractionOmissionReason
}

export interface ExtractionDiagnostics {
  version: 1
  strictConformance: boolean
  warnings: Array<Pick<MinimalValidationWarning, 'path' | 'message' | 'severity'>>
  omittedFields: ExtractionOmission[]
  /** Sanitized observations are used by Tier 2; raw model output is never persisted. */
  observations: Record<string, unknown>
}

export interface BuildExtractionDiagnosticsInput {
  raw: unknown
  validated: MinimalValidationResult | { data?: unknown } | unknown
  warnings: readonly MinimalValidationWarning[] | readonly unknown[]
  strictConformance: boolean
}

const SEEDED_LIGHTING_KEYS = ['bright-and-airy', 'low-key', 'studio', 'golden-hour'] as const
const EXPECTED_PATHS = [
  'scene_setup.angle',
  'scene_setup.framing',
  'scene_setup.lighting',
  'scene_setup.spin',
  'canvas.background',
  'canvas.background_style',
  'canvas.surface_style',
  'canvas.main_vessel',
  'food_components.main_item',
  'food_components.garnishes',
  'food_components.sides',
  'backdrop.material',
  'backdrop.colour',
  'surface.material',
  'surface.colour',
  'backdrop_visible',
  'surface_visible',
  'description',
] as const

const CONTROL_STATE_PATHS = new Set<string>([
  'scene_setup.angle',
  'scene_setup.framing',
  'scene_setup.lighting',
  'scene_setup.spin',
  'canvas.background',
  'canvas.background_style',
  'canvas.surface_style',
  'canvas.main_vessel',
  'food_components.main_item',
  'food_components.garnishes',
  'food_components.sides',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getPath(root: unknown, path: string): unknown {
  let value = root
  for (const segment of path.split('.')) {
    if (!isRecord(value) || !(segment in value)) return undefined
    value = value[segment]
  }
  return value
}

function setPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.')
  let current = root
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment]
    if (!isRecord(next)) current[segment] = {}
    current = current[segment] as Record<string, unknown>
  }
  current[segments[segments.length - 1]] = value
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

function validRawValue(path: string, value: unknown): boolean {
  if (path === 'scene_setup.angle') return typeof value === 'string' && ANGLE_VALUES.includes(value as never)
  if (path === 'scene_setup.framing') return typeof value === 'string' && FRAMING_VALUES.includes(value as never)
  if (path === 'scene_setup.spin') return typeof value === 'string' && SPIN_VALUES.includes(value as never)
  if (path === 'scene_setup.lighting') return typeof value === 'string' && SEEDED_LIGHTING_KEYS.includes(value as never)
  if (path.endsWith('.colour')) return validHex(value)
  if (path.endsWith('.garnishes') || path.endsWith('.sides')) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
  }
  if (path === 'backdrop_visible' || path === 'surface_visible') return typeof value === 'boolean'
  return nonEmptyString(value)
}

function validatedData(validated: BuildExtractionDiagnosticsInput['validated']): unknown {
  if (isRecord(validated) && 'data' in validated) return validated.data
  return validated
}

function safeText(value: string, limit = 160): string {
  return value
    .replace(/[A-Za-z0-9+/=_-]{24,}/g, '[redacted]')
    .slice(0, limit)
}

function safeWarning(warning: unknown): Pick<MinimalValidationWarning, 'path' | 'message' | 'severity'> | null {
  if (!isRecord(warning) || typeof warning.path !== 'string' || typeof warning.message !== 'string') {
    return null
  }
  const severity = warning.severity
  return {
    path: safeText(warning.path, 80),
    message: safeText(warning.message, 160),
    severity: severity === 'high' || severity === 'medium' ? severity : 'low',
  }
}

function safeObservedValue(value: unknown): unknown {
  if (typeof value === 'string') return safeText(value, 120)
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').slice(0, 12).map((item) => safeText(item, 80))
  return value
}

function buildObservedFields(raw: unknown): Record<string, unknown> {
  const observations: Record<string, unknown> = {}
  for (const path of EXPECTED_PATHS) {
    const value = getPath(raw, path)
    if (value !== undefined && validRawValue(path, value)) {
      setPath(observations, path, safeObservedValue(value))
    }
  }
  return observations
}

function classifyOmission(
  path: string,
  rawValue: unknown,
  validated: unknown,
): ExtractionOmissionReason | null {
  if (rawValue === undefined) {
    if (CONTROL_STATE_PATHS.has(path) && getPath(validated, path) !== undefined) {
      return 'coerced_for_control_state'
    }
    return 'absent'
  }
  if (validRawValue(path, rawValue)) return null
  if (CONTROL_STATE_PATHS.has(path) && getPath(validated, path) !== undefined) {
    return 'coerced_for_control_state'
  }
  return 'invalid'
}

export function sanitizeExtractionDiagnostics(value: unknown): ExtractionDiagnostics | null {
  if (!isRecord(value)) return null
  const omittedFields = Array.isArray(value.omittedFields)
    ? value.omittedFields.filter((entry): entry is ExtractionOmission => {
        if (!isRecord(entry) || typeof entry.path !== 'string') return false
        return EXPECTED_PATHS.includes(entry.path as (typeof EXPECTED_PATHS)[number]) &&
          (entry.reason === 'absent' || entry.reason === 'invalid' || entry.reason === 'coerced_for_control_state')
      })
    : []
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.map(safeWarning).filter((warning): warning is NonNullable<ReturnType<typeof safeWarning>> => warning !== null).slice(0, 16)
    : []
  const sanitized: ExtractionDiagnostics = {
    version: 1,
    strictConformance: value.strictConformance === true,
    warnings,
    omittedFields,
    observations: buildObservedFields(value.observations),
  }
  return boundDiagnostics(sanitized)
}

function boundDiagnostics(value: ExtractionDiagnostics): ExtractionDiagnostics {
  if (JSON.stringify(value).length <= EXTRACTION_DIAGNOSTICS_MAX_BYTES) return value
  return {
    ...value,
    warnings: value.warnings.slice(0, 8),
    observations: {},
  }
}

export function buildExtractionDiagnostics({
  raw,
  validated,
  warnings,
  strictConformance,
}: BuildExtractionDiagnosticsInput): ExtractionDiagnostics {
  const data = validatedData(validated)
  const omittedFields: ExtractionOmission[] = []
  for (const path of EXPECTED_PATHS) {
    const reason = classifyOmission(path, getPath(raw, path), data)
    if (reason) omittedFields.push({ path, reason })
  }

  const safeWarnings = warnings
    .map(safeWarning)
    .filter((warning): warning is NonNullable<ReturnType<typeof safeWarning>> => warning !== null)
    .slice(0, 16)

  return boundDiagnostics({
    version: 1,
    strictConformance: Boolean(strictConformance),
    warnings: safeWarnings,
    omittedFields,
    observations: buildObservedFields(raw),
  })
}

export function extractionDiagnosticsWithinBound(value: ExtractionDiagnostics): boolean {
  return JSON.stringify(value).length <= EXTRACTION_DIAGNOSTICS_MAX_BYTES
}
