import {
  groupSpikeExecutionsByOperationAndModel,
  SpikeExecutionInputZ,
} from './evidence-store'

const id = '61b3a294-2a76-4be9-a0f0-0123456789ab'
const digest = 'a'.repeat(64)
const artifact = { storagePath: 'spike/input.png', mimeType: 'image/png', sha256: digest }

function execution(operation: 'remove' | 'move') {
  return {
    comparisonGroupId: id,
    variant: 'A' as const,
    operation,
    requestedModelClass: 'nb2' as const,
    configuredModelIdentifier: 'gemini-3.1-flash-image-preview',
    providerReportedModelIdentity: null,
    contractDigest: digest,
    sourceDigest: digest,
    annotatedDigest: digest,
    outcome: 'generated' as const,
    outputArtifact: artifact,
    failureArtifact: null,
    noFailureArtifactReturned: false,
    scores: {
      targetIdentification: 4,
      editLocality: 4,
      removalCompleteness: operation === 'remove' ? 4 : 'not_applicable',
      destinationAdherence: operation === 'move' ? 4 : 'not_applicable',
      sourceRegionReconstruction: 4,
      objectIdentityPreservation: operation === 'move' ? 4 : 'not_applicable',
      scalePreservation: operation === 'move' ? 4 : 'not_applicable',
      orientationPreservation: operation === 'move' ? 4 : 'not_applicable',
      unrelatedChanges: 4,
      overallUsability: 4,
    },
    observations: ['Target was identifiable.'],
    failureNotes: [],
  }
}

describe('object-edit spike evidence schemas', () => {
  it('requires one operation/model and explicit not-applicable Remove dimensions', () => {
    expect(SpikeExecutionInputZ.safeParse(execution('remove')).success).toBe(true)

    const invalid = execution('remove')
    invalid.scores.destinationAdherence = 3
    expect(SpikeExecutionInputZ.safeParse(invalid).success).toBe(false)
  })

  it('requires Move destination/identity/scale/orientation scores', () => {
    expect(SpikeExecutionInputZ.safeParse(execution('move')).success).toBe(true)

    const invalid = execution('move')
    invalid.scores.objectIdentityPreservation = 'not_applicable'
    expect(SpikeExecutionInputZ.safeParse(invalid).success).toBe(false)
  })

  it('requires an output artifact for generated results and never permits contradictory failure artifacts', () => {
    const missingOutput = execution('move')
    missingOutput.outputArtifact = null
    expect(SpikeExecutionInputZ.safeParse(missingOutput).success).toBe(false)

    const contradictory = execution('move')
    contradictory.failureArtifact = artifact
    contradictory.noFailureArtifactReturned = true
    expect(SpikeExecutionInputZ.safeParse(contradictory).success).toBe(false)
  })

  it('reports evidence separately by operation and selected model', () => {
    const groups = groupSpikeExecutionsByOperationAndModel([
      execution('remove'),
      { ...execution('move'), requestedModelClass: 'nb_pro' as const },
    ])

    expect(groups.get('remove:nb2')).toHaveLength(1)
    expect(groups.get('move:nb_pro')).toHaveLength(1)
    expect(groups.get('remove:nb_pro')).toBeUndefined()
  })
})
