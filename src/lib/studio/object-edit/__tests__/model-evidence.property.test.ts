import fc from 'fast-check'

import { resolveRequestedStudioModel } from '@/lib/studio/generation-request'
import { STUDIO_FLASH_MODEL, STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import { SpikeExecutionInputZ } from '../spike/evidence-store'

type BrowserModelValue = string | number | boolean | null | { value: string }
const browserModelArbitrary = fc.oneof(
  fc.string({ maxLength: 240 }),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.string({ maxLength: 50 }).map((value) => ({ value })),
  fc.constant(STUDIO_PRO_MODEL),
)
const identityArbitrary = fc.option(fc.string({ minLength: 1, maxLength: 100 }).filter((value) => value.trim().length > 0), { nil: null })

function evidenceWithIdentity(providerReportedModelIdentity: string | null) {
  return {
    comparisonGroupId: '61b3a294-2a76-4be9-a0f0-0123456789ab',
    variant: 'A' as const,
    operation: 'remove' as const,
    requestedModelClass: 'nb2' as const,
    configuredModelIdentifier: STUDIO_FLASH_MODEL,
    providerReportedModelIdentity,
    contractDigest: 'a'.repeat(64),
    sourceDigest: 'b'.repeat(64),
    annotatedDigest: 'c'.repeat(64),
    outcome: 'generated' as const,
    outputArtifact: { storagePath: 'spike/output.png', mimeType: 'image/png', sha256: 'd'.repeat(64) },
    failureArtifact: null,
    noFailureArtifactReturned: false,
    scores: {
      targetIdentification: 4,
      editLocality: 4,
      removalCompleteness: 4,
      destinationAdherence: 'not_applicable' as const,
      sourceRegionReconstruction: 4,
      objectIdentityPreservation: 'not_applicable' as const,
      scalePreservation: 'not_applicable' as const,
      orientationPreservation: 'not_applicable' as const,
      unrelatedChanges: 4,
      overallUsability: 4,
    },
    observations: ['Observed result.'],
    failureNotes: [],
  }
}

describe('object-edit model and evidence properties', () => {
  it('Property 16: only the exact NB Pro identifier resolves Pro, and evidence retains configured/reported identity independently', () => {
    fc.assert(
      fc.property(browserModelArbitrary, identityArbitrary, (browserModel: BrowserModelValue, providerReportedModelIdentity) => {
        const resolved = resolveRequestedStudioModel(browserModel)
        expect(resolved).toBe(browserModel === STUDIO_PRO_MODEL ? STUDIO_PRO_MODEL : STUDIO_FLASH_MODEL)

        const parsed = SpikeExecutionInputZ.parse(evidenceWithIdentity(providerReportedModelIdentity))
        expect(parsed.configuredModelIdentifier).toBe(STUDIO_FLASH_MODEL)
        expect(parsed.providerReportedModelIdentity).toBe(
          providerReportedModelIdentity === null ? null : providerReportedModelIdentity.trim(),
        )
        expect(parsed.providerReportedModelIdentity === null).toBe(providerReportedModelIdentity === null)
      }),
      { numRuns: 100 },
    )
  })
})
