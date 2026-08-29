/**
 * @jest-environment node
 *
 * Internal-only NB Pro confirmation for the explicitly approved Move cases 01
 * and 04. It is skipped unless its exact batch flag is supplied; it is never a
 * customer route and cannot execute a partial comparison group.
 */

import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

import sharp from 'sharp'

import { STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import { SpikeScenarioCaseZ, parseStudioObjectEditSpikeManifest, type SpikeScenarioCase } from './manifest'
import { SPIKE_LIVE_CONFIRMATION, runStudioObjectEditSpike, type RunnableSpikeCase } from './runner'

const fixtureDirectory = join(
  process.cwd(),
  '.kiro/specs/studio-object-selection-remove-move/test-images',
)
const manifestPath = join(fixtureDirectory, 'nb2-spike-manifest.v1.json')
const resultPath = join(fixtureDirectory, 'results', 'move-nb-pro-confirmation-01.json')
const approvedCaseIds = ['move-01-cheeseburger-tomatoes', 'move-04-fish-tacos-limes'] as const

type ApprovedCaseId = (typeof approvedCaseIds)[number]

const fileNameByCaseId: Record<ApprovedCaseId, string> = {
  'move-01-cheeseburger-tomatoes': '01-cheeseburger-delivery_landscape.jpg',
  'move-04-fish-tacos-limes': '04-fish-tacos.jpg',
}

const canonicalByCaseId: Record<ApprovedCaseId, RunnableSpikeCase['canonical']> = {
  'move-01-cheeseburger-tomatoes': {
    scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'natural daylight', spin: '0' },
    canvas: { background: 'dark restaurant tabletop', background_style: '', surface_style: '', main_vessel: 'white plate' },
    food_components: { main_item: 'cheeseburger', garnishes: ['side salad'], sides: [] },
  },
  'move-04-fish-tacos-limes': {
    scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'natural daylight', spin: '0' },
    canvas: { background: 'light tabletop', background_style: '', surface_style: '', main_vessel: 'white plate with blue rim' },
    food_components: { main_item: 'fish tacos', garnishes: ['cabbage and crema', 'lime wedges'], sides: [] },
  },
}

function targetLabel(caseId: ApprovedCaseId): string {
  return {
    'move-01-cheeseburger-tomatoes': 'two cherry tomatoes in front-right of the plate',
    'move-04-fish-tacos-limes': 'lime wedges at the lower-left of the plate',
  }[caseId]
}

function derivedNbProCase(scenarioCase: SpikeScenarioCase): SpikeScenarioCase {
  return SpikeScenarioCaseZ.parse({
    ...scenarioCase,
    requestedModelClass: 'nb_pro',
    configuredModelIdentifier: STUDIO_PRO_MODEL,
  })
}

async function runnableCase(baseScenarioCase: SpikeScenarioCase): Promise<RunnableSpikeCase> {
  const caseId = baseScenarioCase.id as ApprovedCaseId
  if (!approvedCaseIds.includes(caseId)) throw new Error(`Unapproved fixture case: ${baseScenarioCase.id}`)

  const scenarioCase = derivedNbProCase(baseScenarioCase)
  const fileName = fileNameByCaseId[caseId]
  const sourceBytes = await readFile(join(fixtureDirectory, fileName))
  const metadata = await sharp(sourceBytes).metadata()
  if (!metadata.width || !metadata.height) throw new Error(`Fixture dimensions unavailable: ${fileName}`)
  const target = scenarioCase.selection.strokes[0].points[0]

  return {
    scenarioCase,
    sourceBytes,
    sourceMimeType: 'image/jpeg',
    canonical: canonicalByCaseId[caseId],
    currentSpatialInventory: {
      version: 1,
      imageId: `fixture-${scenarioCase.sourceArtifact.sha256}`,
      naturalWidth: metadata.width,
      naturalHeight: metadata.height,
      elements: [
        {
          id: `00000000-0000-4000-8000-00000000000${caseId === 'move-01-cheeseburger-tomatoes' ? 1 : 4}`,
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
  expect(selectedCases).toHaveLength(2)
  return Promise.all(selectedCases.map(runnableCase))
}

const runApprovedBatch = process.env.RUN_APPROVED_NB_PRO_MOVE_CONFIRMATION_01 === 'true' ? it : it.skip

describe('Move/NB Pro confirmation 01', () => {
  it('constructs exactly the approved two-case NB Pro A/B/C groups without provider execution', async () => {
    const result = await runStudioObjectEditSpike(await selectedRunnableCases(), {
      mode: 'dry_run',
      maxExecutions: 6,
      filters: {
        caseIds: [...approvedCaseIds],
        operations: ['move'],
        requestedModelClasses: ['nb_pro'],
      },
    })

    expect(result.mode).toBe('dry_run')
    expect(result.selectedExecutionCount).toBe(6)
    expect(result.records).toHaveLength(6)
    expect(new Set(result.records.map((record) => record.caseId))).toEqual(new Set(approvedCaseIds))
    expect(result.records.map((record) => record.variant).sort()).toEqual(['A', 'A', 'B', 'B', 'C', 'C'])
    expect(result.records.every((record) => record.operation === 'move')).toBe(true)
    expect(result.records.every((record) => record.requestedModelClass === 'nb_pro')).toBe(true)
    expect(result.records.every((record) => record.configuredModelIdentifier === STUDIO_PRO_MODEL)).toBe(true)
    expect(result.records.every((record) => record.outcome === undefined)).toBe(true)
  }, 60_000)

  runApprovedBatch('executes only the approved two-case Move/NB Pro A/B/C confirmation', async () => {
    const result = await runStudioObjectEditSpike(await selectedRunnableCases(), {
      mode: 'live',
      confirmLiveExecution: SPIKE_LIVE_CONFIRMATION,
      maxExecutions: 6,
      filters: {
        caseIds: [...approvedCaseIds],
        operations: ['move'],
        requestedModelClasses: ['nb_pro'],
      },
    })

    expect(result.mode).toBe('live')
    expect(result.selectedExecutionCount).toBe(6)
    expect(result.records).toHaveLength(6)
    expect(new Set(result.records.map((record) => record.caseId))).toEqual(new Set(approvedCaseIds))
    expect(result.records.map((record) => record.variant).sort()).toEqual(['A', 'A', 'B', 'B', 'C', 'C'])
    expect(result.records.every((record) => record.operation === 'move')).toBe(true)
    expect(result.records.every((record) => record.requestedModelClass === 'nb_pro')).toBe(true)
    expect(result.records.every((record) => record.configuredModelIdentifier === STUDIO_PRO_MODEL)).toBe(true)

    await mkdir(dirname(resultPath), { recursive: true })
    await writeFile(
      resultPath,
      `${JSON.stringify({
        batch: 'move-nb-pro-confirmation-01',
        approvedCaseIds,
        executedAt: new Date().toISOString(),
        records: result.records,
      }, null, 2)}\n`,
      'utf8',
    )
  }, 600_000)
})
