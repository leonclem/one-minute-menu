/**
 * @jest-environment node
 *
 * Internal-only invocation for the user-approved Remove/NB2 batch 02. It is
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
const resultPath = join(fixtureDirectory, 'results', 'remove-nb2-batch-02.json')
const approvedCaseIds = [
  'remove-04-fish-tacos-beer',
  'remove-05-hainanese-utensils',
  'remove-06-beef-mash-second-dish',
] as const

type ApprovedCaseId = (typeof approvedCaseIds)[number]

const fileNameByCaseId: Record<ApprovedCaseId, string> = {
  'remove-04-fish-tacos-beer': '04-fish-tacos.jpg',
  'remove-05-hainanese-utensils': '05-Hainanese_Chicken_Rice.jpg',
  'remove-06-beef-mash-second-dish': '06-mashed-potatoes-with-beef-and-mushroom-gravy.webp',
}

const canonicalByCaseId: Record<ApprovedCaseId, RunnableSpikeCase['canonical']> = {
  'remove-04-fish-tacos-beer': {
    scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'natural daylight', spin: '0' },
    canvas: { background: 'light tabletop', background_style: '', surface_style: '', main_vessel: 'white plate with blue rim' },
    food_components: { main_item: 'fish tacos', garnishes: ['cabbage', 'crema'], sides: ['lime wedges'] },
  },
  'remove-05-hainanese-utensils': {
    scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'indoor daylight', spin: '0' },
    canvas: { background: 'wooden restaurant table', background_style: '', surface_style: '', main_vessel: 'white oval plate' },
    food_components: { main_item: 'Hainanese chicken rice', garnishes: ['coriander', 'cucumber'], sides: ['eggplant'] },
  },
  'remove-06-beef-mash-second-dish': {
    scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'indoor ambient light', spin: '0' },
    canvas: { background: 'marble tabletop', background_style: '', surface_style: '', main_vessel: 'white dinner plate' },
    food_components: { main_item: 'beef with mushroom gravy and mashed potatoes', garnishes: ['parsley'], sides: ['Brussels sprouts'] },
  },
}

function mimeTypeFor(fileName: string): 'image/jpeg' | 'image/webp' {
  return fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
}

function targetLabel(caseId: ApprovedCaseId): string {
  return {
    'remove-04-fish-tacos-beer': 'bottom of beer glass or bottle at top left',
    'remove-05-hainanese-utensils': 'fork and spoon on the right of the plate',
    'remove-06-beef-mash-second-dish': 'second beef-and-mash dish including its plate',
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

const runApprovedBatch = process.env.RUN_APPROVED_NB2_REMOVE_BATCH_02 === 'true' ? it : it.skip

describe('Remove/NB2 batch 02', () => {
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
        batch: 'remove-nb2-02',
        approvedCaseIds,
        executedAt: new Date().toISOString(),
        records: result.records,
      }, null, 2)}\n`,
      'utf8',
    )
  }, 600_000)
})
