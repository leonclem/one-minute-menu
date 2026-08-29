/**
 * @jest-environment node
 *
 * Internal-only invocation for the user-approved Move/NB2 batch 02. It is
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
const resultPath = join(fixtureDirectory, 'results', 'move-nb2-batch-02.json')
const approvedCaseIds = [
  'move-04-fish-tacos-limes',
  'move-05-hainanese-utensils',
  'move-06-beef-mash-sprouts',
] as const

type ApprovedCaseId = (typeof approvedCaseIds)[number]

const fileNameByCaseId: Record<ApprovedCaseId, string> = {
  'move-04-fish-tacos-limes': '04-fish-tacos.jpg',
  'move-05-hainanese-utensils': '05-Hainanese_Chicken_Rice.jpg',
  'move-06-beef-mash-sprouts': '06-mashed-potatoes-with-beef-and-mushroom-gravy.webp',
}

const sourceMimeTypeByCaseId: Record<ApprovedCaseId, 'image/jpeg' | 'image/webp'> = {
  'move-04-fish-tacos-limes': 'image/jpeg',
  'move-05-hainanese-utensils': 'image/jpeg',
  'move-06-beef-mash-sprouts': 'image/webp',
}

const canonicalByCaseId: Record<ApprovedCaseId, RunnableSpikeCase['canonical']> = {
  'move-04-fish-tacos-limes': {
    scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'natural daylight', spin: '0' },
    canvas: { background: 'light tabletop', background_style: '', surface_style: '', main_vessel: 'white plate with blue rim' },
    food_components: { main_item: 'fish tacos', garnishes: ['cabbage and crema', 'lime wedges'], sides: [] },
  },
  'move-05-hainanese-utensils': {
    scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'indoor daylight', spin: '0' },
    canvas: { background: 'wooden restaurant table', background_style: '', surface_style: '', main_vessel: 'white oval plate' },
    food_components: { main_item: 'Hainanese chicken rice', garnishes: ['coriander', 'cucumber'], sides: ['eggplant'] },
  },
  'move-06-beef-mash-sprouts': {
    scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'indoor ambient light', spin: '0' },
    canvas: { background: 'marble tabletop', background_style: '', surface_style: '', main_vessel: 'white dinner plate' },
    food_components: { main_item: 'beef with mushroom gravy and mashed potato', garnishes: ['parsley'], sides: ['Brussels sprouts'] },
  },
}

function targetLabel(caseId: ApprovedCaseId): string {
  return {
    'move-04-fish-tacos-limes': 'lime wedges at the lower-left of the plate',
    'move-05-hainanese-utensils': 'fork and spoon at the right side of the plate',
    'move-06-beef-mash-sprouts': 'Brussels sprouts at the right side of the plate',
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
    sourceMimeType: sourceMimeTypeByCaseId[caseId],
    canonical: canonicalByCaseId[caseId],
    currentSpatialInventory: {
      version: 1,
      imageId: `fixture-${scenarioCase.sourceArtifact.sha256}`,
      naturalWidth: metadata.width,
      naturalHeight: metadata.height,
      elements: [
        {
          id: `00000000-0000-4000-8000-00000000000${approvedCaseIds.indexOf(caseId) + 4}`,
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

const runApprovedBatch = process.env.RUN_APPROVED_NB2_MOVE_BATCH_02 === 'true' ? it : it.skip

describe('Move/NB2 batch 02', () => {
  it('constructs exactly the approved three-case A/B/C request set without provider execution', async () => {
    const result = await runStudioObjectEditSpike(await selectedRunnableCases(), {
      mode: 'dry_run',
      maxExecutions: 9,
      filters: { caseIds: [...approvedCaseIds], operations: ['move'], requestedModelClasses: ['nb2'] },
    })

    expect(result.mode).toBe('dry_run')
    expect(result.selectedExecutionCount).toBe(9)
    expect(result.records).toHaveLength(9)
    expect(new Set(result.records.map((record) => record.caseId))).toEqual(new Set(approvedCaseIds))
    expect(result.records.map((record) => record.variant).sort()).toEqual(['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C'])
    expect(result.records.every((record) => record.operation === 'move')).toBe(true)
    expect(result.records.every((record) => record.outcome === undefined)).toBe(true)
  }, 60_000)

  runApprovedBatch('executes only the user-approved three-case Move/NB2 A/B/C batch', async () => {
    const result = await runStudioObjectEditSpike(await selectedRunnableCases(), {
      mode: 'live',
      confirmLiveExecution: SPIKE_LIVE_CONFIRMATION,
      maxExecutions: 9,
      filters: { caseIds: [...approvedCaseIds], operations: ['move'], requestedModelClasses: ['nb2'] },
    })

    expect(result.mode).toBe('live')
    expect(result.selectedExecutionCount).toBe(9)
    expect(result.records).toHaveLength(9)
    expect(new Set(result.records.map((record) => record.caseId))).toEqual(new Set(approvedCaseIds))
    expect(result.records.map((record) => record.variant).sort()).toEqual(['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C'])
    expect(result.records.every((record) => record.operation === 'move')).toBe(true)

    await mkdir(dirname(resultPath), { recursive: true })
    await writeFile(
      resultPath,
      `${JSON.stringify({
        batch: 'move-nb2-02',
        approvedCaseIds,
        executedAt: new Date().toISOString(),
        records: result.records,
      }, null, 2)}\n`,
      'utf8',
    )
  }, 600_000)
})
