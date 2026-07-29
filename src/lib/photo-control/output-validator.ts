/**
 * Photo Control — post-generation output validation (pure scorer).
 *
 * Compares an extracted MinimalSchema from a generated image against the
 * expected target schema (what we asked for). No I/O — unit-testable.
 *
 * Chunk 5 / Phase 4: soft quality signal only; callers never hard-fail generation.
 */

import type { MinimalSchema } from './minimal-schema'

export type OutputValidationStatus = 'pass' | 'warn' | 'fail' | 'skipped'

export type DimensionStatus = 'pass' | 'warn' | 'fail' | 'not_evaluated'

export type OutputValidationStagedField =
  | 'lighting'
  | 'background_style'
  | 'surface_style'
  | 'angle'
  | 'spin'

export interface RequestedStyleDescriptor {
  material?: string
  colour?: string
}

export interface RequestedStyleDescriptors {
  background_style?: RequestedStyleDescriptor | null
  surface_style?: RequestedStyleDescriptor | null
}

export interface ValidationDimension {
  id: string
  status: DimensionStatus
  note?: string
}

export interface OutputValidationResult {
  status: OutputValidationStatus
  /** 0–100 average over evaluated dimensions; 0 when none evaluated / skipped. */
  score: number
  summary: string
  dimensions: ValidationDimension[]
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isRequested(
  stagedFields: readonly OutputValidationStagedField[] | undefined,
  field: OutputValidationStagedField,
): boolean {
  return stagedFields === undefined || stagedFields.includes(field)
}

function notEvaluated(id: string, note?: string): ValidationDimension {
  return { id, status: 'not_evaluated', ...(note ? { note } : {}) }
}

/** True when either string contains the other (after normalize), or they match. */
export function looselyMatches(expected: string, actual: string): boolean {
  const a = normalize(expected)
  const b = normalize(actual)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

function scoreDimension(status: DimensionStatus): number | null {
  if (status === 'not_evaluated') return null
  if (status === 'pass') return 100
  if (status === 'warn') return 50
  return 0
}

function aggregateStatus(dimensions: ValidationDimension[]): OutputValidationStatus {
  const evaluated = dimensions.filter((d) => d.status !== 'not_evaluated')
  if (evaluated.length === 0) return 'skipped'
  if (evaluated.some((d) => d.status === 'fail')) return 'fail'
  if (evaluated.some((d) => d.status === 'warn')) return 'warn'
  return 'pass'
}

function aggregateScore(dimensions: ValidationDimension[]): number {
  const scores = dimensions
    .map((d) => scoreDimension(d.status))
    .filter((n): n is number => n !== null)
  if (scores.length === 0) return 0
  return Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
}

function buildSummary(
  status: OutputValidationStatus,
  dimensions: ValidationDimension[],
  unassessedIds: readonly string[] = [],
): string {
  if (status === 'skipped') {
    return 'Validation skipped — no comparable schema fields.'
  }
  const problems = dimensions.filter((d) => d.status === 'fail' || d.status === 'warn')
  const bits = [
    ...problems.map((d) => d.note ?? d.id),
    ...unassessedIds.map((id) => `Unassessed dimension: ${id}`),
  ]
  if (bits.length === 0) {
    return 'Output looks consistent with the requested dish state.'
  }
  const prefix = status === 'fail' ? 'Possible identity issues' : 'Minor consistency warnings'
  return `${prefix}: ${bits.join('; ')}`
}

function compareDishIdentity(expected: MinimalSchema, actual: MinimalSchema): ValidationDimension {
  const expectedItem = expected.food_components.main_item
  const actualItem = actual.food_components.main_item
  if (!normalize(expectedItem)) {
    return { id: 'dish_identity', status: 'not_evaluated', note: 'No expected main item' }
  }
  if (!normalize(actualItem)) {
    return {
      id: 'dish_identity',
      status: 'fail',
      note: 'Output extract missing main item',
    }
  }
  if (looselyMatches(expectedItem, actualItem)) {
    return { id: 'dish_identity', status: 'pass' }
  }
  return {
    id: 'dish_identity',
    status: 'fail',
    note: `Main item mismatch (expected "${expectedItem}", got "${actualItem}")`,
  }
}

function compareItemCounts(expected: MinimalSchema, actual: MinimalSchema): ValidationDimension {
  const eg = expected.food_components.garnishes.length
  const es = expected.food_components.sides.length
  const ag = actual.food_components.garnishes.length
  const as = actual.food_components.sides.length
  const garnishDelta = Math.abs(eg - ag)
  const sideDelta = Math.abs(es - as)
  const totalDelta = garnishDelta + sideDelta

  if (totalDelta === 0) {
    return { id: 'item_count', status: 'pass' }
  }
  if (totalDelta === 1) {
    return {
      id: 'item_count',
      status: 'warn',
      note: `Garnish/side count off by 1 (expected ${eg}+${es}, got ${ag}+${as})`,
    }
  }
  return {
    id: 'item_count',
    status: 'fail',
    note: `Garnish/side count mismatch (expected ${eg}+${es}, got ${ag}+${as})`,
  }
}

function compareVessel(expected: MinimalSchema, actual: MinimalSchema): ValidationDimension {
  const expectedVessel = expected.canvas.main_vessel
  const actualVessel = actual.canvas.main_vessel
  if (!normalize(expectedVessel)) {
    return { id: 'vessel', status: 'not_evaluated', note: 'No expected vessel' }
  }
  if (!normalize(actualVessel)) {
    return {
      id: 'vessel',
      status: 'warn',
      note: 'Output extract missing vessel description',
    }
  }
  if (looselyMatches(expectedVessel, actualVessel)) {
    return { id: 'vessel', status: 'pass' }
  }
  // Vessel wording varies a lot across extracts — soft warn, not hard fail.
  return {
    id: 'vessel',
    status: 'warn',
    note: `Vessel may have changed (expected "${expectedVessel}", got "${actualVessel}")`,
  }
}

function compareUnexpectedAdditions(
  expected: MinimalSchema,
  actual: MinimalSchema,
): ValidationDimension {
  const expectedTotal =
    expected.food_components.garnishes.length + expected.food_components.sides.length
  const actualTotal =
    actual.food_components.garnishes.length + actual.food_components.sides.length
  const extras = actualTotal - expectedTotal
  if (extras <= 0) {
    return { id: 'unexpected_additions', status: 'pass' }
  }
  if (extras === 1) {
    return {
      id: 'unexpected_additions',
      status: 'warn',
      note: 'Output may include one extra garnish/side',
    }
  }
  return {
    id: 'unexpected_additions',
    status: 'fail',
    note: `Output may include ${extras} unexpected garnish/side items`,
  }
}

function compareLighting(
  expected: MinimalSchema,
  actual: MinimalSchema,
  stagedFields?: readonly OutputValidationStagedField[],
): ValidationDimension {
  if (!isRequested(stagedFields, 'lighting')) {
    return notEvaluated('lighting', 'Lighting was not staged for this output')
  }

  const expectedKey = normalize(expected.scene_setup.lighting)
  const actualKey = normalize(actual.scene_setup.lighting)
  if (!expectedKey) {
    return notEvaluated('lighting')
  }
  // Lighting keys are resolved from the database and extraction now returns
  // the same full seeded key set; do not restrict comparison to legacy enums.
  if (!actualKey) {
    return notEvaluated('lighting', 'No lighting in output extract')
  }
  if (expectedKey === actualKey) {
    return { id: 'lighting', status: 'pass' }
  }
  return {
    id: 'lighting',
    status: 'warn',
    note: `Lighting mismatch (expected "${expected.scene_setup.lighting}", got "${actual.scene_setup.lighting}")`,
  }
}

function compareExactRequested(
  id: 'angle' | 'spin',
  expectedValue: string,
  actualValue: string,
  stagedFields: readonly OutputValidationStagedField[] | undefined,
): ValidationDimension {
  if (!isRequested(stagedFields, id)) {
    return notEvaluated(id, `${id} was not staged for this output`)
  }
  if (!normalize(expectedValue) || !normalize(actualValue)) {
    return notEvaluated(id)
  }
  if (expectedValue === actualValue) {
    return { id, status: 'pass' }
  }
  return {
    id,
    status: 'fail',
    note: `${id} mismatch (expected "${expectedValue}", got "${actualValue}")`,
  }
}

function styleAttributes(
  descriptor: RequestedStyleDescriptor | null | undefined,
): string[] {
  if (!descriptor) return []
  return [descriptor.material, descriptor.colour].filter(
    (value): value is string => typeof value === 'string' && normalize(value).length > 0,
  )
}

function compareStyle(
  id: 'background_style' | 'surface_style',
  expectedKey: string,
  actualDescription: string,
  descriptor: RequestedStyleDescriptor | null | undefined,
  stagedFields: readonly OutputValidationStagedField[] | undefined,
): ValidationDimension {
  if (!isRequested(stagedFields, id)) {
    return notEvaluated(id, `${id} was not staged for this output`)
  }
  if (!normalize(expectedKey)) return notEvaluated(id)
  if (!normalize(actualDescription)) {
    return notEvaluated(id, `No ${id} description in output extract`)
  }

  const attributes = styleAttributes(descriptor)
  const matches = attributes.length > 0
    ? attributes.some((attribute) => looselyMatches(attribute, actualDescription))
    : looselyMatches(expectedKey, actualDescription)
  if (matches) return { id, status: 'pass' }

  return {
    id,
    status: 'warn',
    note: `${id} description differs from requested style "${expectedKey}"`,
  }
}

function compareFraming(expected: MinimalSchema, actual: MinimalSchema): ValidationDimension {
  const expectedFraming = expected.scene_setup.framing
  const actualFraming = actual.scene_setup.framing
  if (!expectedFraming || !actualFraming) {
    return { id: 'framing', status: 'not_evaluated' }
  }
  if (expectedFraming === actualFraming) {
    return { id: 'framing', status: 'pass' }
  }
  return {
    id: 'framing',
    status: 'warn',
    note: `Framing mismatch (expected "${expectedFraming}", got "${actualFraming}")`,
  }
}

/**
 * Score an extracted output schema against the expected (usually target) schema.
 *
 * `stagedFields` is optional for compatibility with legacy callers. Studio
 * callers provide it so an unassessed requested change cannot be mistaken for a
 * successful validation of the unchanged identity dimensions.
 */
export function scoreOutputAgainstExpected(
  expected: MinimalSchema,
  actual: MinimalSchema,
  stagedFields?: readonly OutputValidationStagedField[],
  requestedStyleDescriptors?: RequestedStyleDescriptors,
): OutputValidationResult {
  const dimensions: ValidationDimension[] = [
    compareDishIdentity(expected, actual),
    compareItemCounts(expected, actual),
    compareVessel(expected, actual),
    compareUnexpectedAdditions(expected, actual),
    compareLighting(expected, actual, stagedFields),
    compareFraming(expected, actual),
    compareExactRequested('angle', expected.scene_setup.angle, actual.scene_setup.angle, stagedFields),
    compareExactRequested('spin', expected.scene_setup.spin, actual.scene_setup.spin, stagedFields),
    compareStyle(
      'background_style',
      expected.canvas.background_style,
      actual.canvas.background,
      requestedStyleDescriptors?.background_style,
      stagedFields,
    ),
    compareStyle(
      'surface_style',
      expected.canvas.surface_style,
      actual.canvas.surface_style,
      requestedStyleDescriptors?.surface_style,
      stagedFields,
    ),
  ]

  const aggregate = aggregateStatus(dimensions)
  const unassessedIds = stagedFields
    ? stagedFields.filter((field, index, fields) => {
        const dimension = dimensions.find((candidate) => candidate.id === field)
        return dimension?.status === 'not_evaluated' && fields.indexOf(field) === index
      })
    : []
  // Preserve `skipped` as the all-not-evaluated result. Otherwise, an
  // unassessed staged dimension downgrades a result with evaluated identity
  // dimensions, while an evaluated failure retains precedence.
  const status: OutputValidationStatus =
    aggregate === 'skipped' || aggregate === 'fail'
      ? aggregate
      : unassessedIds.length > 0
        ? 'warn'
        : aggregate
  const score = aggregateScore(dimensions)
  return {
    status,
    score,
    summary: buildSummary(status, dimensions, unassessedIds),
    dimensions,
  }
}

/** Compact client-safe payload (no full schema dumps). */
export function toClientValidationSummary(
  result: OutputValidationResult,
): Pick<OutputValidationResult, 'status' | 'score' | 'summary'> {
  return {
    status: result.status,
    score: result.score,
    summary: result.summary,
  }
}
