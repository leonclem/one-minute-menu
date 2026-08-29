import {
  buildObjectEditInstruction,
  type ObjectEditSpatialEnrichmentInput,
} from '../instruction'
import {
  deriveSelectionBoundingRegion,
  deriveSelectionSourcePoint,
  type AnnotationStroke,
  type StructuredEditIntent,
} from '../contracts'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'

const canonical: MinimalSchema = {
  scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'soft daylight', spin: '0' },
  canvas: { background: 'neutral', background_style: '', surface_style: '', main_vessel: 'plate' },
  food_components: { main_item: 'pasta', garnishes: ['basil'], sides: ['bread'] },
}

function selection(strokes: AnnotationStroke[]) {
  return { version: 1 as const, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) }
}

function removeIntent(): StructuredEditIntent {
  return {
    version: 1,
    operation: 'remove',
    selection: selection([{ kind: 'tap', points: [{ x: 0.24, y: 0.68 }] }]),
  }
}

function moveIntent(): StructuredEditIntent {
  const selected = selection([{ kind: 'tap', points: [{ x: 0.24, y: 0.68 }] }])
  return {
    version: 1,
    operation: 'move',
    selection: selected,
    placement: {
      source: deriveSelectionSourcePoint(selected.boundingRegion),
      destination: { x: 0.71, y: 0.7 },
    },
  }
}

describe('buildObjectEditInstruction', () => {
  it('builds exact Image A/B roles and Remove behavior around the complete raw selection', () => {
    const result = buildObjectEditInstruction({ intent: removeIntent(), canonical })

    expect(result.instruction).toContain('Image A is the current clean source image to edit.')
    expect(result.instruction).toContain('Image B is guidance only and must not appear in the output.')
    expect(result.instruction).toContain('The marks in Image B identify the selected object guidance.')
    expect(result.instruction).toContain('Remove only the one object indicated by the raw annotation in Image B.')
    expect(result.instruction).toContain('Reconstruct the revealed region naturally.')
    expect(result.instruction).toContain(
      'Preserve all unselected image content, including unrelated objects, camera angle, lighting, surface, backdrop, and composition.',
    )
    expect(result.contract).toMatchObject({ operation: 'remove', selection: removeIntent().selection })
    expect(result.contract).not.toHaveProperty('placement')
    expect(result.contract).not.toHaveProperty('spatial')
  })

  it('preserves Move coordinates exactly and states all move-specific constraints', () => {
    const intent = moveIntent()
    const result = buildObjectEditInstruction({
      intent,
      canonical,
      renderDigest: 'a'.repeat(64),
    })

    expect(result.contract.placement).toEqual(intent.placement)
    expect(result.instruction).toContain('Relocate only the one object indicated by the raw annotation in Image B to the supplied destination.')
    expect(result.instruction).toContain("Reconstruct the object's original region naturally.")
    expect(result.instruction).toContain("Preserve the selected object's visual identity, scale, and orientation.")
    expect(result.instruction).toContain('The placement guidance is approximate and is not a pixel-exact transform.')
    expect(result.instruction).toContain('"destination":{"x":0.71,"y":0.7}')
    expect(result.contract.metadata).toMatchObject({ placementGuideAccuracy: 'approximate', renderDigest: 'a'.repeat(64) })
  })

  it('includes only current, unambiguous, non-conflicting spatial enrichment without semantic claims', () => {
    const spatial: ObjectEditSpatialEnrichmentInput = {
      inventory: { version: 1, imageId: 'current-image', elements: [{ label: 'spatial-only-label' }] },
      isCurrent: true,
      isUnambiguous: true,
    }
    const included = buildObjectEditInstruction({ intent: removeIntent(), canonical, spatial })
    const stale = buildObjectEditInstruction({
      intent: removeIntent(),
      canonical,
      spatial: { ...spatial, isCurrent: false },
    })

    expect(included.contract.spatial).toEqual(spatial.inventory)
    expect(included.instruction).toContain('"spatial"')
    expect(stale.contract).not.toHaveProperty('spatial')
    expect(stale.instruction).not.toContain('spatial-only-label')
    expect(stale.instruction).not.toContain('The selected object is')
  })

  it('rejects invalid intent, canonical state, and renderer digest before producing an instruction', () => {
    expect(() =>
      buildObjectEditInstruction({
        intent: { ...removeIntent(), selection: { ...removeIntent().selection, strokes: [] } } as StructuredEditIntent,
        canonical,
      }),
    ).toThrow('invalid object-edit intent')
    expect(() => buildObjectEditInstruction({ intent: removeIntent(), canonical, renderDigest: 'bad' })).toThrow(
      'Renderer digest',
    )
  })
})
