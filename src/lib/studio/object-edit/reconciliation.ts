import { MinimalSchemaZ, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { StudioImageRecord } from '@/lib/studio/types'
import {
  buildCandidateCanonicalState,
  findConfidentCanonicalMapping,
  type CanonicalMapping,
  type CanonicalSourceState,
} from './canonical-state'
import type { StructuredEditIntent } from './contracts'
import {
  buildSpatialInventory,
  matchSpatialElement,
  SpatialInventoryV1Z,
  type SpatialElementV1,
  type SpatialInventoryV1,
} from './spatial-inventory'
import type { StudioOutputEvidence } from '@/lib/studio/output-validation'

export interface ReconciliationImage {
  id: string
  width: number | null
  height: number | null
}

export interface CurrentImageEvidence {
  canonical?: MinimalSchema | null
  spatialInventory?: SpatialInventoryV1 | null
}

export interface ReconciliationInput {
  directParent: CanonicalSourceState | MinimalSchema
  intent: StructuredEditIntent
  sourceImage: Pick<StudioImageRecord, 'id'>
  childImage: ReconciliationImage
  parentSpatialInventory?: SpatialInventoryV1 | null
  /** Reuse the already validated source match used for Remove instruction enrichment. */
  matchedParentElement?: SpatialElementV1 | null
  currentEvidence?: CurrentImageEvidence | null
}

export interface ReconciliationResult {
  canonical: MinimalSchema
  spatialInventory: SpatialInventoryV1 | null
  matchedParentElement: SpatialElementV1 | null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isCurrentInventory(
  inventory: SpatialInventoryV1 | null | undefined,
  imageId: string,
): inventory is SpatialInventoryV1 {
  return Boolean(
    inventory &&
      inventory.imageId === imageId &&
      SpatialInventoryV1Z.safeParse(inventory).success,
  )
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function sameComponentReference(left: SpatialElementV1, right: SpatialElementV1): boolean {
  if (!left.componentRef || !right.componentRef) return false
  return (
    left.componentRef.section === right.componentRef.section &&
    left.componentRef.field === right.componentRef.field &&
    normalize(left.componentRef.value ?? '') === normalize(right.componentRef.value ?? '')
  )
}

function matchingCandidates(
  candidates: readonly SpatialElementV1[],
  current: SpatialElementV1,
): SpatialElementV1[] {
  const byReference = candidates.filter((candidate) => sameComponentReference(candidate, current))
  if (byReference.length > 0) return byReference
  return candidates.filter((candidate) => normalize(candidate.label) === normalize(current.label))
}

function translateElement(
  element: SpatialElementV1,
  delta: { x: number; y: number },
): SpatialElementV1 {
  const clamp = (value: number) => Math.max(0, Math.min(1, value))
  const evidence = [element.evidence, 'Approximate object-edit Move translation.']
    .filter(Boolean)
    .join(' ')
    .slice(0, 400)

  if (element.hint.kind === 'center') {
    return {
      ...element,
      hint: {
        kind: 'center',
        center: {
          x: clamp(element.hint.center.x + delta.x),
          y: clamp(element.hint.center.y + delta.y),
        },
      },
      ...(evidence ? { evidence } : {}),
    }
  }

  return {
    ...element,
    hint: {
      kind: 'region',
      region: {
        left: clamp(element.hint.region.left + delta.x),
        top: clamp(element.hint.region.top + delta.y),
        right: clamp(element.hint.region.right + delta.x),
        bottom: clamp(element.hint.region.bottom + delta.y),
      },
    },
    ...(evidence ? { evidence } : {}),
  }
}

function initialiseChildInventory(
  parent: SpatialInventoryV1 | null | undefined,
  sourceImageId: string,
  childImage: ReconciliationImage,
): SpatialInventoryV1 | null {
  if (
    !isCurrentInventory(parent, sourceImageId) ||
    !Number.isInteger(childImage.width) ||
    !Number.isInteger(childImage.height) ||
    childImage.width === null ||
    childImage.height === null ||
    childImage.width <= 0 ||
    childImage.height <= 0
  ) {
    return null
  }

  const candidate: SpatialInventoryV1 = {
    ...clone(parent),
    imageId: childImage.id,
    naturalWidth: childImage.width,
    naturalHeight: childImage.height,
    extractedAt: new Date().toISOString(),
  }
  return SpatialInventoryV1Z.safeParse(candidate).success ? candidate : null
}

function applyOperationSpatialDelta(
  inventory: SpatialInventoryV1 | null,
  intent: StructuredEditIntent,
  matchedElement: SpatialElementV1 | null,
): SpatialInventoryV1 | null {
  if (!inventory || !matchedElement) return inventory

  const elements = inventory.elements.map((element) => {
    if (element.id !== matchedElement.id) return element
    if (intent.operation === 'remove') return { ...element, visibility: 'removed' as const }
    return translateElement(element, {
      x: intent.placement.destination.x - intent.placement.source.x,
      y: intent.placement.destination.y - intent.placement.source.y,
    })
  })
  const result = { ...inventory, elements }
  return SpatialInventoryV1Z.safeParse(result).success ? result : inventory
}

function protectedMapping(
  directParent: CanonicalSourceState | MinimalSchema,
  intent: StructuredEditIntent,
  matched: SpatialElementV1 | null,
): CanonicalMapping | null {
  if (intent.operation !== 'remove') return null
  const schema = 'schema' in directParent ? directParent.schema : directParent
  return findConfidentCanonicalMapping(schema, matched)
}

/**
 * Replaces only explicit, independently valid current-image fields. The narrow
 * Remove delta stays authoritative, while every other valid field may be
 * reconciled from the generated image evidence.
 */
function reconcileCanonical(
  candidate: MinimalSchema,
  current: MinimalSchema | null | undefined,
  protectedField: CanonicalMapping | null,
): MinimalSchema {
  const parsed = MinimalSchemaZ.safeParse(current)
  if (!parsed.success) return candidate
  const evidence = parsed.data
  const next = clone(candidate)

  next.scene_setup = clone(evidence.scene_setup)
  next.canvas.background = evidence.canvas.background
  next.canvas.background_style = evidence.canvas.background_style
  next.canvas.surface_style = evidence.canvas.surface_style
  next.food_components.main_item = evidence.food_components.main_item

  if (!(protectedField?.kind === 'scalar' && protectedField.section === 'canvas')) {
    next.canvas.main_vessel = evidence.canvas.main_vessel
  }
  if (!(protectedField?.kind === 'scalar' && protectedField.section === 'food_components')) {
    next.food_components.main_item = evidence.food_components.main_item
  }
  if (!(protectedField?.kind === 'array' && protectedField.field === 'garnishes')) {
    next.food_components.garnishes = clone(evidence.food_components.garnishes)
  }
  if (!(protectedField?.kind === 'array' && protectedField.field === 'sides')) {
    next.food_components.sides = clone(evidence.food_components.sides)
  }

  return next
}

/**
 * Merges only unambiguous current-image spatial observations. Ambiguous,
 * missing, stale, or invalid evidence leaves the inherited candidate intact.
 */
function reconcileSpatial(
  candidate: SpatialInventoryV1 | null,
  current: SpatialInventoryV1 | null | undefined,
  controlledElementId: string | null,
): SpatialInventoryV1 | null {
  if (!candidate || !isCurrentInventory(current, candidate.imageId)) return candidate

  const next = clone(candidate)
  for (const observed of current.elements) {
    const matches = matchingCandidates(next.elements, observed)
    if (matches.length === 1) {
      const existing = matches[0]
      if (existing.id === controlledElementId) continue
      const index = next.elements.findIndex((element) => element.id === existing.id)
      next.elements[index] = { ...clone(observed), id: existing.id }
    } else if (matches.length === 0) {
      // buildSpatialInventory already assigned this evidence element an app UUID.
      next.elements.push(clone(observed))
    }
  }

  const parsed = SpatialInventoryV1Z.safeParse(next)
  return parsed.success ? parsed.data : candidate
}

/**
 * Converts the optional raw spatial observation in reusable extraction evidence
 * into a generated-image-bound inventory. Invalid or absent evidence is soft.
 */
export function buildCurrentSpatialEvidence(
  evidence: StudioOutputEvidence | null | undefined,
  childImage: ReconciliationImage,
): SpatialInventoryV1 | null {
  if (!evidence?.spatialObservation) return null
  try {
    return buildSpatialInventory(childImage, evidence.spatialObservation)
  } catch {
    return null
  }
}

/**
 * Builds a child state from the direct parent, applies one narrow operation
 * delta, and only then incorporates compatible current-image evidence. Image
 * guidance and accepted selection never depend on this optional result.
 */
export function reconcileObjectEditChildState(input: ReconciliationInput): ReconciliationResult {
  const matchedParentElement =
    input.matchedParentElement === undefined
      ? (() => {
          const parentMatch = matchSpatialElement({
            inventory: input.parentSpatialInventory,
            imageId: input.sourceImage.id,
            selection: input.intent.selection.boundingRegion,
          })
          return parentMatch.matched ? parentMatch.element : null
        })()
      : input.matchedParentElement
  const mapping = protectedMapping(input.directParent, input.intent, matchedParentElement)
  const candidate = buildCandidateCanonicalState({
    directParent: input.directParent,
    intent: input.intent,
    matchedElement: matchedParentElement,
  })

  let spatialInventory = initialiseChildInventory(
    input.parentSpatialInventory,
    input.sourceImage.id,
    input.childImage,
  )
  spatialInventory = applyOperationSpatialDelta(spatialInventory, input.intent, matchedParentElement)

  try {
    return {
      canonical: reconcileCanonical(candidate, input.currentEvidence?.canonical, mapping),
      spatialInventory: reconcileSpatial(
        spatialInventory,
        input.currentEvidence?.spatialInventory,
        matchedParentElement?.id ?? null,
      ),
      matchedParentElement,
    }
  } catch {
    // Reconciliation is intentionally optional; a valid direct-parent candidate
    // remains sufficient for atomic child persistence.
    return { canonical: candidate, spatialInventory, matchedParentElement }
  }
}
