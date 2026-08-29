/**
 * @jest-environment node
 *
 * Internal-only invocation for the user-approved Remove/NB2 batch 03. It is
 * skipped unless its exact batch flag is supplied; it is never a customer route.
 */

import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

import sharp from 'sharp'

import { parseStudioObjectEditSpikeManifest, type SpikeScenarioCase } from './manifest'
import { SPIKE_LIVE_CONFIRMATION, runStudioObjectEditSpike, type RunnableSpikeCase } from './runner'

const fixtureDirectory = join(
  process.cwd(),
  '.kiro/specs/studio-object-selection-remove-move/test-images',
)
const manifestPath = join(fixtureDirectory, 'nb2-spike-manifest.v1.json')
const resultPath = join(fixtureDirectory, 'results', 'remove-nb2-batch-03.json')
const approvedCaseIds = [
  'remove-07-pizza-person',
  'remove-08-roast-beef-napkin',
  'remove-09-salmon-milk',
] as const

type ApprovedCaseId = (typeof approvedCaseIds)[number]

const fileNameByCaseId: Record<ApprovedCaseId, string> = {
  'remove-07-pizza-person': '07-pizza-neopolitana.jpg',
  'remove-08-roast-beef-napkin': '08-Roast-beef-dinner-wide-FS.webp',
  'remove-09-salmon-milk': '09-salmon-mash-asparagus.jpg',
}

const canonicalByCaseId: Record<ApprovedCaseId, RunnableSpikeCase['canonical']> = {
  'remove-07-pizza-person': {
    scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'warm indoor lighting', spin: '0' },
    canvas: { background: 'restaurant interior', background_style: '', surface_style: '', main_vessel: 'wooden pizza board' },
    food_components: { main_item: 'Neapolitan pizza', garnishes: ['basil'], sides: [] },
  },
  'remove-08-roast-beef-napkin': {
    scene_setup: { angle: '45-degree', framing: 'wide', lighting: 'natural daylight', spin: '0' },
    canvas: { background: 'dining table', background_style: '', surface_style: '', main_vessel: 'white dinner plate' },
    food_components: { main_item: 'roast beef dinner', garnishes: [], sides: ['roast potatoes', 'vegetables', 'Yorkshire pudding'] },
  },
  'remove-09-salmon-milk': {
    scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'natural daylight', spin: '0' },
    canvas: { background: 'dining table', background_style: '', surface_style: '', main_vessel: 'white dinner plate' },
    food_components: { main_item: 'salmon fillet', garnishes: [], sides: ['mashed potato', 'asparagus'] },
  },
}

function mimeTypeFor(fileName: string): 'image/jpeg' | 'image/webp' {
  return fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
}

function targetLabel(caseId: ApprovedCaseId): string {
  return {
    'remove-07-pizza-person': 'person holding the pizza board at the top of the image',
    'remove-08-roast-beef-napkin': 'blue napkin',
    'remove-09-salmon-milk': 'glass of milk',
  }[caseId]
}

async function runnableCase(scenarioCase: SpikeScenarioCase): Promise<RunnableSpikeCase> {
  const caseId = scenarioCase.id as ApprovedCaseId
  if (!approvedCaseIds.includes(caseId)) throw new Error(`Unapproved fixture case: ${scenarioCase.id}`)

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
          id: `00000000-0000-4000-8000-00000000000${approvedCaseIds.indexOf(caseId) + 7}`,
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

async function selectedRunnableCases(): Promise<readonly RunnableSpikeCase[]> {
  const manifest = parseStudioObjectEditSpikeManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
  const selectedCases = manifest.cases.filter((scenarioCase) =>
    approvedCaseIds.includes(scenarioCase.id as ApprovedCaseId),
  )
  expect(selectedCases).toHaveLength(3)
  return Promise.all(selectedCases.map(runnableCase))
}

const runApprovedBatch = process.env.RUN_APPROVED_NB2_REMOVE_BATCH_03 === 'true' ? it : it.skip

describe('Remove/NB2 batch 03', () => {
  it('constructs exactly the approved three-case A/B/C request set without provider execution', async () => {
    const result = await runStudioObjectEditSpike(await selectedRunnableCases(), {
      mode: 'dry_run',
      maxExecutions: 9,
      filters: { caseIds: [...approvedCaseIds] },
    })

    expect(result.mode).toBe('dry_run')
    expect(result.selectedExecutionCount).toBe(9)
    expect(result.records).toHaveLength(9)
    expect(new Set(result.records.map((record) => record.caseId))).toEqual(new Set(approvedCaseIds))
    expect(result.records.map((record) => record.variant).sort()).toEqual(['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C'])
    expect(result.records.every((record) => record.outcome === undefined)).toBe(true)
  }, 60_000)

  runApprovedBatch('executes only the user-approved three-case Remove/NB2 A/B/C batch', async () => {
    const result = await runStudioObjectEditSpike(await selectedRunnableCases(), {
      mode: 'live',
      confirmLiveExecution: SPIKE_LIVE_CONFIRMATION,
      maxExecutions: 9,
      filters: { caseIds: [...approvedCaseIds] },
    })

    expect(result.mode).toBe('live')
    expect(result.selectedExecutionCount).toBe(9)
    expect(result.records).toHaveLength(9)
    expect(new Set(result.records.map((record) => record.caseId))).toEqual(new Set(approvedCaseIds))
    expect(result.records.map((record) => record.variant).sort()).toEqual(['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C'])

    await mkdir(dirname(resultPath), { recursive: true })
    await writeFile(
      resultPath,
      `${JSON.stringify({
        batch: 'remove-nb2-03',
        approvedCaseIds,
        executedAt: new Date().toISOString(),
        records: result.records,
      }, null, 2)}\n`,
      'utf8',
    )
  }, 600_000)
})
