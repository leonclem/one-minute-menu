/**
 * Photo Control — post-generation output validation (pure scorer).
 *
 * Compares an extracted MinimalSchema from a generated image against the
 * expected target schema (what we asked for). No I/O — unit-testable.
 *
 * Chunk 5 / Phase 4: soft quality signal only; callers never hard-fail generation.
 */

import { LIGHTING_VALUES, type MinimalSchema } from './minimal-schema'

export type OutputValidationStatus = 'pass' | 'warn' | 'fail' | 'skipped'

export type DimensionStatus = 'pass' | 'warn' | 'fail' | 'not_evaluated'

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

function buildSummary(status: OutputValidationStatus, dimensions: ValidationDimension[]): string {
  if (status === 'skipped') {
    return 'Validation skipped — no comparable schema fields.'
  }
  const problems = dimensions.filter((d) => d.status === 'fail' || d.status === 'warn')
  if (problems.length === 0) {
    return 'Output looks consistent with the requested dish state.'
  }
  const bits = problems.map((d) => d.note ?? d.id)
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

function compareLighting(expected: MinimalSchema, actual: MinimalSchema): ValidationDimension {
  const expectedKey = normalize(expected.scene_setup.lighting)
  const actualKey = normalize(actual.scene_setup.lighting)
  if (!expectedKey) {
    return { id: 'lighting', status: 'not_evaluated' }
  }

  const legacyKeys = new Set(LIGHTING_VALUES.map((v) => v as string))
  // Custom DB style keys are not returned by extraction — skip.
  if (!legacyKeys.has(expectedKey)) {
    return {
      id: 'lighting',
      status: 'not_evaluated',
      note: 'Custom lighting style key not comparable via extract',
    }
  }
  if (!actualKey) {
    return { id: 'lighting', status: 'not_evaluated', note: 'No lighting in output extract' }
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
 */
export function scoreOutputAgainstExpected(
  expected: MinimalSchema,
  actual: MinimalSchema,
): OutputValidationResult {
  const dimensions: ValidationDimension[] = [
    compareDishIdentity(expected, actual),
    compareItemCounts(expected, actual),
    compareVessel(expected, actual),
    compareUnexpectedAdditions(expected, actual),
    compareLighting(expected, actual),
    compareFraming(expected, actual),
  ]

  const status = aggregateStatus(dimensions)
  const score = aggregateScore(dimensions)
  return {
    status,
    score,
    summary: buildSummary(status, dimensions),
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
