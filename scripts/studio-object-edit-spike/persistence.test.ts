/**
 * @jest-environment node
 */

import { createHash } from 'crypto'

import sharp from 'sharp'

import { deriveSelectionBoundingRegion, type AnnotationStroke } from '@/lib/studio/object-edit/contracts'
import { STUDIO_FLASH_MODEL } from '@/lib/studio/model-config'
import { sha256Hex, type SpikeArtifactUploadInput } from './artifacts'
import { constructSpikeComparisonGroup } from './construction'
import type { SpikeScenarioCase } from './manifest'
import {
  persistCompletedSpikeComparisonGroup,
  type HumanSpikeExecutionReview,
  type SpikePersistenceDependencies,
} from './persistence'
import { unscoredReview } from './rubric'
import type { SpikeRunRecord } from './runner'

const outputArtifact = {
  storagePath: 'internal/spike/generated.png',
  mimeType: 'image/png',
  sha256: 'f'.repeat(64),
}

async function fixture() {
  const sourceBytes = await sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 25, g: 75, b: 125 } },
  })
    .png()
    .toBuffer()
  const strokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x: 0.5, y: 0.5 }] }]
  const scenarioCase: SpikeScenarioCase = {
    id: 'persist-case-abc',
    operation: 'remove',
    requestedModelClass: 'nb2',
    configuredModelIdentifier: STUDIO_FLASH_MODEL,
    sourceArtifact: {
      storagePath: 'internal/spike/source.png',
      mimeType: 'image/png',
      sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    },
    selection: { version: 1, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) },
    scenarioTags: ['isolated_foreground'],
  }
  const comparisonGroup = await constructSpikeComparisonGroup({
    scenarioCase,
    sourceBytes,
    sourceMimeType: 'image/png',
    canonical: {
      scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'soft daylight', spin: '0' },
      canvas: { background: 'neutral', background_style: '', surface_style: '', main_vessel: 'plate' },
      food_components: { main_item: 'pasta', garnishes: ['basil'], sides: ['bread'] },
    },
    currentSpatialInventory: { version: 1, imageId: 'source', elements: [] },
  })
  const records: SpikeRunRecord[] = comparisonGroup.requests.map((request) => ({
    caseId: scenarioCase.id,
    variant: request.variant,
    operation: request.operation,
    requestedModelClass: request.requestedModelClass,
    configuredModelIdentifier: request.configuredModelIdentifier,
    providerReportedModelIdentity: 'gemini-3.1-flash-image',
    providerIdentityReported: true,
    sourceDigest: request.sourceDigest,
    annotatedDigest: request.annotatedDigest,
    fixedContractDigest: request.fixedContractDigest,
    contractDigest: request.contractDigest,
    mode: 'live',
    outcome: 'generated',
    outputArtifact,
    review: unscoredReview('remove'),
  }))
  const humanReviews: HumanSpikeExecutionReview[] = comparisonGroup.requests.map((request) => ({
    variant: request.variant,
    scores: {
      targetIdentification: 5,
      editLocality: 4,
      removalCompleteness: 4,
      destinationAdherence: 'not_applicable',
      sourceRegionReconstruction: 4,
      objectIdentityPreservation: 'not_applicable',
      scalePreservation: 'not_applicable',
      orientationPreservation: 'not_applicable',
      unrelatedChanges: 4,
      overallUsability: 4,
    },
    observations: [`Human review for ${request.variant}.`],
    failureNotes: [],
  }))
  return { scenarioCase, comparisonGroup, records, humanReviews }
}

function dependencies(): {
  services: SpikePersistenceDependencies
  uploads: SpikeArtifactUploadInput[]
  cases: unknown[]
  groups: unknown[]
  executions: unknown[]
} {
  const uploads: SpikeArtifactUploadInput[] = []
  const cases: unknown[] = []
  const groups: unknown[] = []
  const executions: unknown[] = []
  return {
    services: {
      uploadArtifact: async (input) => {
        uploads.push(input)
        return {
          storagePath: `internal/spike/${input.label}.png`,
          mimeType: input.mimeType,
          sha256: sha256Hex(input.bytes),
        }
      },
      createCase: async (input) => {
        cases.push(input)
        return '10000000-0000-4000-8000-000000000001'
      },
      createComparisonGroup: async (input) => {
        groups.push(input)
        return '10000000-0000-4000-8000-000000000002'
      },
      createExecution: async (input) => {
        executions.push(input)
        return `10000000-0000-4000-8000-00000000000${executions.length}`
      },
    },
    uploads,
    cases,
    groups,
    executions,
  }
}

describe('persistCompletedSpikeComparisonGroup', () => {
  it('uploads the prepared clean/annotated pair and persists one immutable A/B/C group with human reviews', async () => {
    const input = await fixture()
    const { services, uploads, cases, groups, executions } = dependencies()

    const result = await persistCompletedSpikeComparisonGroup(input, services)

    expect(uploads).toHaveLength(2)
    expect(uploads.map((upload) => upload.label)).toEqual([
      expect.stringMatching(/-clean$/),
      expect.stringMatching(/-annotated$/),
    ])
    expect(cases).toHaveLength(1)
    expect(groups).toHaveLength(1)
    expect(executions).toHaveLength(3)
    expect((groups[0] as { contractDigest: string }).contractDigest).toBe(
      input.comparisonGroup.requests[0].fixedContractDigest,
    )
    expect((executions as Array<{ contractDigest: string }>).map(({ contractDigest }) => contractDigest)).toEqual(
      input.comparisonGroup.requests.map((request) => request.contractDigest),
    )
    expect(result.executionIds).toEqual({
      A: '10000000-0000-4000-8000-000000000001',
      B: '10000000-0000-4000-8000-000000000002',
      C: '10000000-0000-4000-8000-000000000003',
    })
  })

  it('rejects partial A/B/C records before uploading or creating immutable evidence', async () => {
    const input = await fixture()
    const { services, uploads, cases } = dependencies()

    await expect(
      persistCompletedSpikeComparisonGroup({ ...input, records: input.records.slice(0, 2) }, services),
    ).rejects.toThrow('complete A/B/C')

    expect(uploads).toHaveLength(0)
    expect(cases).toHaveLength(0)
  })

  it('rejects null human scores and record digest mismatches before uploading', async () => {
    const input = await fixture()
    const first = dependencies()
    const nullScores = input.humanReviews.map((review, index) =>
      index === 0
        ? { ...review, scores: { ...review.scores, targetIdentification: null } }
        : review,
    )

    await expect(
      persistCompletedSpikeComparisonGroup({ ...input, humanReviews: nullScores as never }, first.services),
    ).rejects.toThrow()
    expect(first.uploads).toHaveLength(0)

    const second = dependencies()
    const mismatchedRecords = input.records.map((record, index) =>
      index === 0 ? { ...record, contractDigest: 'a'.repeat(64) } : record,
    )
    await expect(
      persistCompletedSpikeComparisonGroup({ ...input, records: mismatchedRecords }, second.services),
    ).rejects.toThrow('digests do not match')
    expect(second.uploads).toHaveLength(0)
  })

  it('rejects invalid generated and failure artifacts before uploading', async () => {
    const input = await fixture()
    const generated = dependencies()
    const invalidGeneratedRecords = input.records.map((record, index) =>
      index === 0 ? { ...record, outputArtifact: { ...outputArtifact, sha256: 'not-a-digest' } } : record,
    )

    await expect(
      persistCompletedSpikeComparisonGroup({ ...input, records: invalidGeneratedRecords }, generated.services),
    ).rejects.toThrow()
    expect(generated.uploads).toHaveLength(0)

    const failure = dependencies()
    const failureRecords = input.records.map((record, index) =>
      index === 0
        ? {
            ...record,
            outcome: 'provider_error' as const,
            outputArtifact: undefined,
            providerReportedModelIdentity: null,
            providerIdentityReported: false,
            noFailureArtifactReturned: true as const,
          }
        : record,
    )
    const contradictoryFailureArtifacts = input.humanReviews.map((review, index) =>
      index === 0
        ? { ...review, failureArtifact: outputArtifact, failureNotes: ['The provider returned a failure artifact.'] }
        : review,
    )

    await expect(
      persistCompletedSpikeComparisonGroup(
        { ...input, records: failureRecords, humanReviews: contradictoryFailureArtifacts },
        failure.services,
      ),
    ).rejects.toThrow('conflicts with explicit failure-artifact absence')
    expect(failure.uploads).toHaveLength(0)
  })
})
