/**
 * @jest-environment node
 *
 * Internal-only invocation for a user-approved live spike batch. It is skipped
 * unless the exact batch flag is supplied by the invoking process; it is never
 * a customer route or a general-purpose test command.
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
const resultPath = join(fixtureDirectory, 'results', 'remove-nb2-batch-01.json')
const approvedCaseIds = [
  'remove-01-cheeseburger-salad',
  'remove-02-chicken-burger-roll',
  'remove-03-rogan-josh-fork',
] as const

const fileNameByCaseId: Record<(typeof approvedCaseIds)[number], string> = {
  'remove-01-cheeseburger-salad': '01-cheeseburger-delivery_landscape.jpg',
  'remove-02-chicken-burger-roll': '02-chicken-burger.jpg',
  'remove-03-rogan-josh-fork': '03-Chicken-Rogan-Josh.jpg',
}

const canonicalByCaseId: Record<(typeof approvedCaseIds)[number], RunnableSpikeCase['canonical']> = {
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

function mimeTypeFor(fileName: string): 'image/jpeg' | 'image/webp' {
  return fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
}

function targetLabel(caseId: (typeof approvedCaseIds)[number]): string {
  return {
    'remove-01-cheeseburger-salad': 'side salad',
    'remove-02-chicken-burger-roll': 'blurred foreground bread roll',
    'remove-03-rogan-josh-fork': 'front-left fork',
  }[caseId]
}

async function runnableCase(scenarioCase: SpikeScenarioCase): Promise<RunnableSpikeCase> {
  if (!approvedCaseIds.includes(scenarioCase.id as (typeof approvedCaseIds)[number])) {
    throw new Error(`Unapproved fixture case: ${scenarioCase.id}`)
  }
  const caseId = scenarioCase.id as (typeof approvedCaseIds)[number]
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

const runApprovedBatch = process.env.RUN_APPROVED_NB2_REMOVE_BATCH_01 === 'true' ? it : it.skip

runApprovedBatch('executes only the approved three-case Remove/NB2 A/B/C batch', async () => {
  const manifest = parseStudioObjectEditSpikeManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
  const selectedCases = manifest.cases.filter((scenarioCase) =>
    approvedCaseIds.includes(scenarioCase.id as (typeof approvedCaseIds)[number]),
  )
  expect(selectedCases).toHaveLength(3)

  const result = await runStudioObjectEditSpike(await Promise.all(selectedCases.map(runnableCase)), {
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
      batch: 'remove-nb2-01',
      approvedCaseIds,
      executedAt: new Date().toISOString(),
      records: result.records,
    }, null, 2)}\n`,
    'utf8',
  )
}, 600_000)
