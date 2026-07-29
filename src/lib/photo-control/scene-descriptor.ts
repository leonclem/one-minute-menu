/**
 * Tier 2 scene descriptor for Studio image edits.
 *
 * This module deliberately knows about resolved style rows, rather than style
 * keys. Style keys are Tier 1 control values and must never become values in
 * the model-facing descriptor.
 */

import type { MinimalSchema, StateDelta } from './minimal-schema'

export type SceneStyleKind = 'lighting' | 'backdrop' | 'surface'

/** The server-side fields needed from either style library row. */
export interface SceneStyleRow {
  descriptor?: unknown | null
  short_description?: string | null
  prompt_fragment?: string | null
  negative_constraints?: string | null
  key?: string
}

/** Resolved style rows. `background` aliases are accepted for route compatibility. */
export interface SceneDescriptorStyles {
  lighting?: SceneStyleRow | null
  lightingStyle?: SceneStyleRow | null
  backdrop?: SceneStyleRow | null
  background?: SceneStyleRow | null
  backgroundStyle?: SceneStyleRow | null
  surface?: SceneStyleRow | null
  surfaceStyle?: SceneStyleRow | null
}

/**
 * Extraction observations are widened by Task 19.4. The index signature keeps
 * this builder compatible with that richer response while the builder itself
 * only copies whitelisted, validated fields.
 */
export interface SceneObservations {
  [field: string]: unknown
  lighting?: unknown
  backdrop?: unknown
  surface?: unknown
  background?: unknown
  current?: Record<string, unknown>
  observed?: Record<string, unknown>
  backdrop_visible?: unknown
  surface_visible?: unknown
}

export interface SceneCamera {
  angle?: string
  framing?: string
  spin?: string
}

export interface SceneComponents {
  garnishes?: string[]
  sides?: string[]
}

export interface SceneStyleSection {
  reference?: string
  quality?: string
  temperature?: string
  shadows?: string
  falloff?: string
  material?: string
  finish?: string
  colour?: string
  mode?: 'replace' | 'establish'
  description?: string
  note?: string
}

export interface SceneDescriptorState {
  camera?: SceneCamera
  lighting?: SceneStyleSection
  backdrop?: SceneStyleSection
  surface?: SceneStyleSection
  components?: SceneComponents
  position?: { x: number; y: number }
}

export interface SceneSubject {
  reference?: string
  dish?: string
  vessel?: string
  components?: SceneComponents
  locked: string[]
}

export interface SceneOutput {
  style: 'photorealistic'
  framing: 'full shot, no cropping'
}

export interface SceneDescriptor {
  task: 'edit'
  subject: SceneSubject
  camera: SceneCamera
  current: SceneDescriptorState
  target: SceneDescriptorState
  output: SceneOutput
}

export interface BuildSceneDescriptorInput {
  original: MinimalSchema
  target: MinimalSchema
  delta: StateDelta
  styles: SceneDescriptorStyles
  observations: SceneObservations | Record<string, unknown>
  labels: readonly string[]
}

const LOCKED_CONSTRAINTS = [
  'dish identity',
  'ingredient and component counts',
  'vessel',
  'framing',
  'colours and textures',
]

const STYLE_ATTRIBUTES: Record<SceneStyleKind, readonly string[]> = {
  lighting: ['quality', 'temperature', 'shadows', 'falloff'],
  backdrop: ['material', 'colour', 'falloff'],
  surface: ['material', 'finish', 'colour'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

function validAttribute(kind: SceneStyleKind, key: string, value: unknown): boolean {
  if (key === 'colour') return validHex(value)
  if (key === 'mode') return value === 'replace' || value === 'establish'
  return nonEmptyString(value)
}

function copyStyleAttributes(
  kind: SceneStyleKind,
  source: unknown,
): SceneStyleSection {
  const result: SceneStyleSection = {}
  if (!isRecord(source)) return result

  for (const key of STYLE_ATTRIBUTES[kind]) {
    const value = source[key]
    if (validAttribute(kind, key, value)) {
      ;(result as Record<string, unknown>)[key] = value
    }
  }

  if (kind === 'backdrop' && validAttribute(kind, 'mode', source.mode)) {
    result.mode = source.mode as 'replace' | 'establish'
  }
  if (validAttribute(kind, 'description', source.description)) {
    result.description = source.description as string
  }
  return result
}

/**
 * Resolve a style row without ever using its database key as descriptor data.
 * A null descriptor has a deliberately narrow compatibility fallback.
 */
function describeStyle(kind: SceneStyleKind, row: SceneStyleRow | null | undefined): SceneStyleSection {
  if (!row) return {}

  if (row.descriptor !== null && row.descriptor !== undefined) {
    return copyStyleAttributes(kind, row.descriptor)
  }

  const fallback: SceneStyleSection = {}
  const fallbackKey = kind === 'lighting' ? 'quality' : 'material'
  if (nonEmptyString(row.short_description)) {
    fallback[fallbackKey] = row.short_description
  }
  if (nonEmptyString(row.prompt_fragment)) {
    fallback.note = row.prompt_fragment
  }
  return fallback
}

function styleRow(
  styles: SceneDescriptorStyles,
  kind: SceneStyleKind,
): SceneStyleRow | null | undefined {
  if (kind === 'lighting') return styles.lighting ?? styles.lightingStyle
  if (kind === 'backdrop') {
    return styles.backdrop ?? styles.background ?? styles.backgroundStyle
  }
  return styles.surface ?? styles.surfaceStyle
}

function observationRecord(observations: SceneObservations | Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(observations)) return {}
  const nested = isRecord(observations.observations) ? observations.observations : undefined
  return nested ? { ...nested, ...observations } : observations
}

function omittedPaths(observations: SceneObservations | Record<string, unknown>): string[] {
  const root = observationRecord(observations)
  const diagnostics = isRecord(root.diagnostics) ? root.diagnostics : undefined
  const candidates = [
    root.omittedFields,
    root.omissions,
    diagnostics?.omittedFields,
    diagnostics?.omissions,
  ]
  const paths: string[] = []
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    for (const entry of candidate) {
      if (nonEmptyString(entry)) {
        paths.push(entry)
      } else if (isRecord(entry) && nonEmptyString(entry.path)) {
        paths.push(entry.path)
      }
    }
  }
  return paths
}

function isOmitted(
  observations: SceneObservations | Record<string, unknown>,
  path: string,
): boolean {
  return omittedPaths(observations).some(
    (omitted) => omitted === path || omitted.startsWith(`${path}.`) || path.startsWith(`${omitted}.`),
  )
}

function filterOmittedObservationFields(
  kind: SceneStyleKind,
  section: SceneStyleSection,
  observations: SceneObservations | Record<string, unknown>,
): SceneStyleSection {
  const result = { ...section }
  for (const key of Object.keys(result)) {
    if (isOmitted(observations, `${kind}.${key}`)) {
      delete (result as Record<string, unknown>)[key]
    }
  }
  if (isOmitted(observations, kind)) return {}
  return result
}

function observedValue(
  observations: SceneObservations | Record<string, unknown>,
  kind: SceneStyleKind,
): unknown {
  const root = observationRecord(observations)
  const current = isRecord(root.current) ? root.current : undefined
  const observed = isRecord(root.observed) ? root.observed : undefined
  const aliases: Record<SceneStyleKind, readonly string[]> = {
    lighting: ['lighting', 'lighting_observation', 'current_lighting'],
    backdrop: ['backdrop', 'backdrop_observation', 'current_backdrop', 'background'],
    surface: ['surface', 'surface_observation', 'current_surface'],
  }

  for (const key of aliases[kind]) {
    if (current && current[key] !== undefined) return current[key]
    if (observed && observed[key] !== undefined) return observed[key]
    if (root[key] !== undefined) return root[key]
  }
  return undefined
}

function describeObservation(
  kind: SceneStyleKind,
  value: unknown,
  observations: SceneObservations | Record<string, unknown>,
): SceneStyleSection {
  if (isRecord(value)) return filterOmittedObservationFields(kind, copyStyleAttributes(kind, value), observations)
  if (!nonEmptyString(value) || isOmitted(observations, kind)) return {}

  if (kind === 'lighting') {
    return isOmitted(observations, 'lighting.quality') ? {} : { quality: value }
  }
  return isOmitted(observations, `${kind}.material`) ? {} : { material: value }
}

function observedMode(observations: SceneObservations | Record<string, unknown>): 'replace' | 'establish' | undefined {
  const value = observationRecord(observations).backdrop_visible
  if (value === true) return 'replace'
  if (value === false) return 'establish'
  return undefined
}

function attachReference(section: SceneStyleSection, label: unknown): SceneStyleSection {
  if (nonEmptyString(label)) return { ...section, reference: label }
  return section
}

function cameraValue(schema: MinimalSchema, field: keyof SceneCamera): string | undefined {
  const value = schema.scene_setup[field]
  return nonEmptyString(value) ? value : undefined
}

function addCameraChange(
  current: SceneDescriptorState,
  target: SceneDescriptorState,
  original: MinimalSchema,
  desired: MinimalSchema,
  field: keyof SceneCamera,
  observations: SceneObservations | Record<string, unknown>,
): void {
  const currentValue = cameraValue(original, field)
  const targetValue = cameraValue(desired, field)
  const observationPath = `scene_setup.${field}`
  if (currentValue !== undefined && !isOmitted(observations, observationPath)) {
    current.camera = { ...(current.camera ?? {}), [field]: currentValue }
  }
  if (targetValue !== undefined) {
    target.camera = { ...(target.camera ?? {}), [field]: targetValue }
  }
}

function addStyleChange(
  current: SceneDescriptorState,
  target: SceneDescriptorState,
  kind: SceneStyleKind,
  row: SceneStyleRow | null | undefined,
  observations: SceneObservations | Record<string, unknown>,
  referenceLabel: unknown,
): void {
  const currentSection = describeObservation(
    kind,
    observedValue(observations, kind),
    observations,
  )
  if (Object.keys(currentSection).length > 0) {
    current[kind] = currentSection
  }

  const targetSection = describeStyle(kind, row)
  if (kind === 'backdrop') {
    const mode = observedMode(observations)
    if (mode !== undefined) targetSection.mode = mode
  }
  target[kind] = attachReference(targetSection, referenceLabel)
}

function addComponentChange(
  current: SceneDescriptorState,
  target: SceneDescriptorState,
  original: MinimalSchema,
  desired: MinimalSchema,
  field: keyof SceneComponents,
): void {
  const originalValues = original.food_components[field]
  const targetValues = desired.food_components[field]
  const currentComponents = current.components ?? {}
  const targetComponents = target.components ?? {}
  if (Array.isArray(originalValues)) {
    current.components = { ...currentComponents, [field]: originalValues.filter(nonEmptyString) }
  }
  if (Array.isArray(targetValues)) {
    target.components = { ...targetComponents, [field]: targetValues.filter(nonEmptyString) }
  }
}

function addPositionChange(
  current: SceneDescriptorState,
  target: SceneDescriptorState,
  delta: StateDelta,
): void {
  if (!delta.position) return
  current.position = { x: delta.position.from.x, y: delta.position.from.y }
  target.position = { x: delta.position.to.x, y: delta.position.to.y }
}

function subjectFrom(
  original: MinimalSchema,
  labels: readonly string[],
  observations: SceneObservations | Record<string, unknown>,
): SceneSubject {
  const subject: SceneSubject = { locked: [...LOCKED_CONSTRAINTS] }
  if (nonEmptyString(labels[0])) subject.reference = labels[0]
  if (
    nonEmptyString(original.food_components.main_item) &&
    !isOmitted(observations, 'food_components.main_item')
  ) {
    subject.dish = original.food_components.main_item
  }
  if (
    nonEmptyString(original.canvas.main_vessel) &&
    !isOmitted(observations, 'canvas.main_vessel')
  ) {
    subject.vessel = original.canvas.main_vessel
  }

  const components: SceneComponents = {}
  if (
    Array.isArray(original.food_components.garnishes) &&
    !isOmitted(observations, 'food_components.garnishes')
  ) {
    components.garnishes = original.food_components.garnishes.filter(nonEmptyString)
  }
  if (
    Array.isArray(original.food_components.sides) &&
    !isOmitted(observations, 'food_components.sides')
  ) {
    components.sides = original.food_components.sides.filter(nonEmptyString)
  }
  if (components.garnishes || components.sides) subject.components = components
  return subject
}

/**
 * Build a semantic Tier 2 descriptor from Tier 1 state, resolved style rows,
 * extraction observations, and the ordered labels of actually attached refs.
 */
export function buildSceneDescriptor({
  original,
  target: desired,
  delta,
  styles,
  observations,
  labels,
}: BuildSceneDescriptorInput): SceneDescriptor {
  const current: SceneDescriptorState = {}
  const target: SceneDescriptorState = {}
  let styleReferenceOffset = 1
  const stagedStyles: SceneStyleKind[] = []

  for (const change of delta.scalarChanges) {
    if (change.path === 'scene_setup.angle') {
      addCameraChange(current, target, original, desired, 'angle', observations)
    }
    if (change.path === 'scene_setup.framing') {
      addCameraChange(current, target, original, desired, 'framing', observations)
    }
    if (change.path === 'scene_setup.spin') {
      addCameraChange(current, target, original, desired, 'spin', observations)
    }
    if (change.path === 'scene_setup.lighting') stagedStyles.push('lighting')
    if (change.path === 'canvas.background_style') stagedStyles.push('backdrop')
    if (change.path === 'canvas.surface_style') stagedStyles.push('surface')
  }

  for (const kind of stagedStyles) {
    addStyleChange(
      current,
      target,
      kind,
      styleRow(styles, kind),
      observations,
      labels[styleReferenceOffset],
    )
    styleReferenceOffset += 1
  }

  if (delta.arrays.garnishes.added.length > 0 || delta.arrays.garnishes.removed.length > 0) {
    addComponentChange(current, target, original, desired, 'garnishes')
  }
  if (delta.arrays.sides.added.length > 0 || delta.arrays.sides.removed.length > 0) {
    addComponentChange(current, target, original, desired, 'sides')
  }
  addPositionChange(current, target, delta)

  return {
    task: 'edit',
    subject: subjectFrom(original, labels, observations),
    camera: {},
    current,
    target,
    output: { style: 'photorealistic', framing: 'full shot, no cropping' },
  }
}
