import fc from 'fast-check'

import { groupSpikeExecutionsByOperationAndModel, SpikeExecutionInputZ } from './evidence-store'

const id = '61b3a294-2a76-4be9-a0f0-0123456789ab'
const digest = 'a'.repeat(64)
const artifact = { storagePath: 'spike/output.png', mimeType: 'image/png', sha256: digest }

function execution(operation: 'remove' | 'move', requestedModelClass: 'nb2' | 'nb_pro', score: number) {
  return {
    comparisonGroupId: id,
    variant: 'A' as const,
    operation,
    requestedModelClass,
    configuredModelIdentifier: requestedModelClass === 'nb_pro' ? 'gemini-3.1-pro-image-preview' : 'gemini-3.1-flash-image-preview',
    providerReportedModelIdentity: null,
    contractDigest: digest,
    sourceDigest: digest,
    annotatedDigest: digest,
    outcome: 'generated' as const,
    outputArtifact: artifact,
    failureArtifact: null,
    noFailureArtifactReturned: false,
    scores: {
      targetIdentification: score,
      editLocality: score,
      removalCompleteness: operation === 'remove' ? score : 'not_applicable' as const,
      destinationAdherence: operation === 'move' ? score : 'not_applicable' as const,
      sourceRegionReconstruction: score,
      objectIdentityPreservation: operation === 'move' ? score : 'not_applicable' as const,
      scalePreservation: operation === 'move' ? score : 'not_applicable' as const,
      orientationPreservation: operation === 'move' ? score : 'not_applicable' as const,
      unrelatedChanges: score,
      overallUsability: score,
    },
    observations: ['Observation'],
    failureNotes: [],
  }
}

describe('spike evidence properties', () => {
  it('Property 18: evidence is operation/model-safe and enforces operation-specific scoring and artifacts', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('remove' as const, 'move' as const),
        fc.constantFrom('nb2' as const, 'nb_pro' as const),
        fc.integer({ min: 1, max: 5 }),
        fc.boolean(),
        (operation, requestedModelClass, score, makeInvalid) => {
          const valid = execution(operation, requestedModelClass, score)
          expect(SpikeExecutionInputZ.safeParse(valid).success).toBe(true)
          const groups = groupSpikeExecutionsByOperationAndModel([valid])
          expect(groups.get(`${operation}:${requestedModelClass}`)).toEqual([{ operation, requestedModelClass }])

          const invalid = JSON.parse(JSON.stringify(valid))
          if (makeInvalid) {
            invalid.scores.destinationAdherence = operation === 'remove' ? score : 'not_applicable'
          } else {
            invalid.outputArtifact = null
          }
          expect(SpikeExecutionInputZ.safeParse(invalid).success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
