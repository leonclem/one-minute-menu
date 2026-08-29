/**
 * @jest-environment node
 *
 * Reconstructs the already-executed Remove/NB2 batch from frozen source inputs,
 * verifies all nine request digests, and optionally appends immutable evidence.
 * Enabling persistence never invokes the image provider.
 */

import { readFile } from 'fs/promises'
import { join } from 'path'

import sharp from 'sharp'

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { PhotoControlMimeType } from '@/lib/photo-control/request-validation'
import { parseStudioObjectEditSpikeManifest, type SpikeScenarioCase } from './manifest'
import {
  persistCompletedSpikeComparisonGroup,
  type HumanSpikeExecutionReview,
} from './persistence'
import { constructSpikeComparisonGroup } from './construction'
import type { SpikeRunRecord, RunnableSpikeCase } from './runner'

const fixtureDirectory = join(
  process.cwd(),
  '.kiro/specs/studio-object-selection-remove-move/test-images',
)
const manifestPath = join(fixtureDirectory, 'nb2-spike-manifest.v1.json')
const batchPath = join(fixtureDirectory, 'results', 'remove-nb2-batch-01.json')
const reviewPath = join(fixtureDirectory, 'results', 'remove-nb2-batch-01.review.v1.json')
const persistBatch = process.env.PERSIST_COMPLETED_NB2_REMOVE_BATCH_01 === 'true' ? it : it.skip

const approvedCaseIds = [
  'remove-01-cheeseburger-salad',
  'remove-02-chicken-burger-roll',
  'remove-03-rogan-josh-fork',
] as const

type ApprovedCaseId = (typeof approvedCaseIds)[number]

const fileNameByCaseId: Record<ApprovedCaseId, string> = {
  'remove-01-cheeseburger-salad': '01-cheeseburger-delivery_landscape.jpg',
  'remove-02-chicken-burger-roll': '02-chicken-burger.jpg',
  'remove-03-rogan-josh-fork': '03-Chicken-Rogan-Josh.jpg',
}

const canonicalByCaseId: Record<ApprovedCaseId, MinimalSchema> = {
  'remove-01-cheeseburger-salad': {
    scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'natural daylight', spin: '0' },
    canvas: { background: 'dark restaurant tabletop', background_style: '', surface_style: '', main_vessel: 'white plate' },
    food_components: { main_item: 'cheeseburger', garnishes: ['side salad'], sides: [] },
  },
  'remove-02-chicken-burger-roll': {
    scene_setup: { angle: 'eye-level', framing: 'close-up', lighting: 'natural daylight', spin: '0' },
    canvas: { background: 'restaurant tabletop', background_style: '', surface_style: '', main_vessel: 'plate' },
    food_components: { main_item: 'chicken burger', garnishes: [], sides: ['pickles', 'bread roll'] },
  },
  'remove-03-rogan-josh-fork': {
    scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'warm restaurant lighting', spin: '0' },
    canvas: { background: 'dark tabletop', background_style: '', surface_style: '', main_vessel: 'ceramic bowl' },
    food_components: { main_item: 'chicken rogan josh', garnishes: ['coriander'], sides: ['rice'] },
  },
}

function mimeTypeFor(fileName: string): PhotoControlMimeType {
  return fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
}

function targetLabel(caseId: ApprovedCaseId): string {
  return {
    'remove-01-cheeseburger-salad': 'side salad',
    'remove-02-chicken-burger-roll': 'blurred foreground bread roll',
    'remove-03-rogan-josh-fork': 'front-left fork',
  }[caseId]
}

async function runnableCase(scenarioCase: SpikeScenarioCase): Promise<RunnableSpikeCase> {
  const caseId = scenarioCase.id as ApprovedCaseId
  if (!approvedCaseIds.includes(caseId)) throw new Error(`Unexpected batch case: ${scenarioCase.id}`)

  const fileName = fileNameByCaseId[caseId]
  const sourceBytes = await readFile(join(fixtureDirectory, fileName))
  const metadata = await sharp(sourceBytes).metadata()
  if (!metadata.width || !metadata.height) throw new Error(`Fixture dimensions unavailable: ${fileName}`)
  const target = scenarioCase.selection.strokes[0].points[0]

  return {
    scenarioCase,
    sourceBytes,
    sourceMimeType: mimeTypeFor(fileName),
    canonical: canonicalByCaseId[caseId],
    currentSpatialInventory: {
      version: 1,
      imageId: `fixture-${scenarioCase.sourceArtifact.sha256}`,
      naturalWidth: metadata.width,
      naturalHeight: metadata.height,
      elements: [
        {
          id: `00000000-0000-4000-8000-00000000000${approvedCaseIds.indexOf(caseId) + 1}`,
          label: targetLabel(caseId),
          hint: { kind: 'center', center: target },
          visibility: 'visible',
          evidence: 'Internal spike fixture annotation.',
        },
      ],
      extractedAt: '2026-08-26T00:00:00.000Z',
      extractorVersion: 'fixture-v1',
    },
  }
}

type CompletedBatch = {
  batch: 'remove-nb2-01'
  approvedCaseIds: readonly ApprovedCaseId[]
  records: readonly SpikeRunRecord[]
}

type ReviewedCase = {
  caseId: ApprovedCaseId
  reviews: readonly HumanSpikeExecutionReview[]
}

type ReviewFile = {
  version: 1
  batch: 'remove-nb2-01'
  cases: readonly ReviewedCase[]
}

async function loadFrozenBatch(): Promise<{
  runnableCases: readonly RunnableSpikeCase[]
  batch: CompletedBatch
  reviewsByCaseId: ReadonlyMap<ApprovedCaseId, readonly HumanSpikeExecutionReview[]>
}> {
  const manifest = parseStudioObjectEditSpikeManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
  const scenarioCases = manifest.cases.filter((scenarioCase) =>
    approvedCaseIds.includes(scenarioCase.id as ApprovedCaseId),
  )
  expect(scenarioCases).toHaveLength(approvedCaseIds.length)

  const batch = JSON.parse(await readFile(batchPath, 'utf8')) as CompletedBatch
  expect(batch.batch).toBe('remove-nb2-01')
  expect(batch.approvedCaseIds).toEqual(approvedCaseIds)
  expect(batch.records).toHaveLength(9)

  const reviewFile = JSON.parse(await readFile(reviewPath, 'utf8')) as ReviewFile
  expect(reviewFile.version).toBe(1)
  expect(reviewFile.batch).toBe(batch.batch)
  expect(reviewFile.cases.map(({ caseId }) => caseId)).toEqual(approvedCaseIds)

  return {
    runnableCases: await Promise.all(scenarioCases.map(runnableCase)),
    batch,
    reviewsByCaseId: new Map(reviewFile.cases.map(({ caseId, reviews }) => [caseId, reviews])),
  }
}

describe('Remove/NB2 batch 01 immutable evidence', () => {
  it('reconstructs all frozen source/annotation/contract digests before any persistence', async () => {
    const { runnableCases, batch } = await loadFrozenBatch()

    for (const runnable of runnableCases) {
      const comparisonGroup = await constructSpikeComparisonGroup(runnable)
      const records = batch.records.filter((record) => record.caseId === runnable.scenarioCase.id)
      expect(records).toHaveLength(3)
      for (const request of comparisonGroup.requests) {
        const record = records.find((candidate) => candidate.variant === request.variant)
        expect(record).toBeDefined()
        expect(record).toMatchObject({
          mode: 'live',
          outcome: 'generated',
          sourceDigest: request.sourceDigest,
          annotatedDigest: request.annotatedDigest,
          fixedContractDigest: request.fixedContractDigest,
          contractDigest: request.contractDigest,
        })
      }
    }
  }, 60_000)

  persistBatch('uploads inputs and appends the three reviewed A/B/C groups without provider execution', async () => {
    const { runnableCases, batch, reviewsByCaseId } = await loadFrozenBatch()
    const persisted: Array<{ caseId: string; comparisonGroupId: string; executionIds: unknown }> = []

    for (const runnable of runnableCases) {
      const caseId = runnable.scenarioCase.id as ApprovedCaseId
      const result = await persistCompletedSpikeComparisonGroup({
        scenarioCase: runnable.scenarioCase,
        comparisonGroup: await constructSpikeComparisonGroup(runnable),
        records: batch.records.filter((record) => record.caseId === caseId),
        humanReviews: reviewsByCaseId.get(caseId) ?? [],
      })
      persisted.push({
        caseId,
        comparisonGroupId: result.comparisonGroupId,
        executionIds: result.executionIds,
      })
    }

    expect(persisted).toHaveLength(3)
    console.info(`Persisted immutable Remove/NB2 batch 01 evidence: ${JSON.stringify(persisted)}`)
  }, 120_000)
})
