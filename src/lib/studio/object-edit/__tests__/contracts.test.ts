import {
  deriveSelectionBoundingRegion,
  deriveSelectionSourcePoint,
  ObjectEditOperationMetadataZ,
  ObjectEditSubmissionZ,
  StudioGenerationErrorZ,
  StudioGenerationSuccessZ,
  type AnnotationStroke,
} from '../contracts'

const dishId = '61b3a294-2a76-4be9-a0f0-0123456789ab'
const sourceImageId = '0135d7b0-61a1-4de1-9de6-0123456789ab'

function selection(strokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x: 0.24, y: 0.68 }] }]) {
  return {
    version: 1 as const,
    strokes,
    boundingRegion: deriveSelectionBoundingRegion(strokes),
  }
}

function moveIntent() {
  const value = selection()
  return {
    version: 1 as const,
    operation: 'move' as const,
    selection: value,
    placement: {
      source: deriveSelectionSourcePoint(value.boundingRegion),
      destination: { x: 0.71, y: 0.7 },
    },
  }
}

describe('object-edit contracts', () => {
  it('accepts a strict Remove submission and preserves accepted coordinates exactly', () => {
    const parsed = ObjectEditSubmissionZ.parse({
      dishId,
      sourceImageId,
      model: 'gemini-3.1-flash-image-preview',
      editIntent: {
        version: 1,
        operation: 'remove',
        selection: selection(),
      },
    })

    expect(parsed.editIntent.operation).toBe('remove')
    expect(parsed.editIntent.selection.strokes[0].points[0].x).toBe(0.24)
    expect(parsed.editIntent.selection.strokes[0].points[0].y).toBe(0.68)
  })

  it('accepts a Move submission only when its source equals the derived selection center', () => {
    const parsed = ObjectEditSubmissionZ.parse({
      dishId,
      sourceImageId,
      editIntent: moveIntent(),
    })

    expect(parsed.editIntent).toMatchObject({ operation: 'move' })
    expect(parsed.editIntent.operation === 'move' && parsed.editIntent.placement.destination).toEqual({
      x: 0.71,
      y: 0.7,
    })

    const invalid = moveIntent()
    invalid.placement.source = { x: 0.1, y: 0.2 }
    expect(
      ObjectEditSubmissionZ.safeParse({ dishId, sourceImageId, editIntent: invalid }).success,
    ).toBe(false)
  })

  it('rejects derived bounding-region mismatches and unknown keys', () => {
    const invalidSelection = selection()
    invalidSelection.boundingRegion.left = 0.1

    expect(
      ObjectEditSubmissionZ.safeParse({
        dishId,
        sourceImageId,
        editIntent: { version: 1, operation: 'remove', selection: invalidSelection },
      }).success,
    ).toBe(false)
    expect(
      ObjectEditSubmissionZ.safeParse({
        dishId,
        sourceImageId,
        ignored: true,
        editIntent: { version: 1, operation: 'remove', selection: selection() },
      }).success,
    ).toBe(false)
  })

  it('rejects malformed stroke shapes, coordinate ranges, and selection capacity overflow', () => {
    const malformedPath = {
      kind: 'path',
      points: [{ x: 0.1, y: 0.1 }],
    }
    const outOfRange = {
      kind: 'tap',
      points: [{ x: 1.001, y: 0.2 }],
    }
    const nineTaps = Array.from({ length: 9 }, (_, index) => ({
      kind: 'tap' as const,
      points: [{ x: index / 10, y: 0.5 }],
    }))

    expect(
      ObjectEditSubmissionZ.safeParse({
        dishId,
        sourceImageId,
        editIntent: { version: 1, operation: 'remove', selection: { ...selection(), strokes: [malformedPath] } },
      }).success,
    ).toBe(false)
    expect(
      ObjectEditSubmissionZ.safeParse({
        dishId,
        sourceImageId,
        editIntent: { version: 1, operation: 'remove', selection: { ...selection(), strokes: [outOfRange] } },
      }).success,
    ).toBe(false)
    expect(
      ObjectEditSubmissionZ.safeParse({
        dishId,
        sourceImageId,
        editIntent: {
          version: 1,
          operation: 'remove',
          selection: {
            version: 1,
            strokes: nineTaps,
            boundingRegion: deriveSelectionBoundingRegion(nineTaps),
          },
        },
      }).success,
    ).toBe(false)
  })

  it('validates versioned operation metadata and operation-specific placement', () => {
    const move = moveIntent()
    const base = {
      version: 1,
      operation: 'move' as const,
      directParentImageId: sourceImageId,
      selectedSourceImageId: sourceImageId,
      selection: move.selection,
      placement: move.placement,
      annotationRendererVersion: 1,
      contractDigest: 'a'.repeat(64),
    }

    expect(ObjectEditOperationMetadataZ.safeParse(base).success).toBe(true)
    expect(
      ObjectEditOperationMetadataZ.safeParse({ ...base, operation: 'remove', placement: base.placement })
        .success,
    ).toBe(false)
  })

  it('projects the established Studio success and error envelopes without internal fields', () => {
    expect(
      StudioGenerationSuccessZ.safeParse({
        imageUrl: 'https://cdn.example/generated.png',
        imageId: sourceImageId,
        dishId,
        model: 'gemini-3.1-flash-image-preview',
        validationStatus: 'pass',
        credits: { cost: 1, balanceAfter: 9 },
      }).success,
    ).toBe(true)
    expect(
      StudioGenerationSuccessZ.safeParse({
        imageUrl: 'https://cdn.example/generated.png',
        imageId: sourceImageId,
        dishId,
        model: 'gemini-3.1-flash-image-preview',
        credits: { cost: 1, balanceAfter: 9 },
        rawProviderResponse: {},
      }).success,
    ).toBe(false)
    expect(
      StudioGenerationErrorZ.safeParse({
        error: 'Generation paused',
        code: 'STUDIO_DISH_GENERATION_BLOCKED',
        failureCount: 5,
      }).success,
    ).toBe(true)
  })
})
