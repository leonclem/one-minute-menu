/**
 * @jest-environment node
 *
 * Internal-only invocation for the user-approved, one-case Remove/NB Pro A/B/C
 * enquiry. It is skipped unless its exact batch flag is supplied; it is never a
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
const resultPath = join(fixtureDirectory, 'results', 'remove-nb-pro-hainanese-01.json')
const approvedCaseId = 'remove-05-hainanese-utensils'

const canonical: RunnableSpikeCase['canonical'] = {
  scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'indoor daylight', spin: '0' },
  canvas: { background: 'wooden restaurant table', background_style: '', surface_style: '', main_vessel: 'white oval plate' },
  food_components: { main_item: 'Hainanese chicken rice', garnishes: ['coriander', 'cucumber'], sides: ['eggplant'] },
}

function derivedNbProCase(scenarioCase: SpikeScenarioCase): SpikeScenarioCase {
  return SpikeScenarioCaseZ.parse({
    ...scenarioCase,
    requestedModelClass: 'nb_pro',
    configuredModelIdentifier: STUDIO_PRO_MODEL,
  })
}

async function runnableCase(): Promise<RunnableSpikeCase> {
  const manifest = parseStudioObjectEditSpikeManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
  const baseScenarioCase = manifest.cases.find((scenarioCase) => scenarioCase.id === approvedCaseId)
  if (!baseScenarioCase) throw new Error(`Fixture case unavailable: ${approvedCaseId}`)

  const scenarioCase = derivedNbProCase(baseScenarioCase)
  const sourceBytes = await readFile(join(fixtureDirectory, '05-Hainanese_Chicken_Rice.jpg'))
  const metadata = await sharp(sourceBytes).metadata()
  if (!metadata.width || !metadata.height) throw new Error('Fixture dimensions unavailable: 05-Hainanese_Chicken_Rice.jpg')
  const target = scenarioCase.selection.strokes[0].points[0]

  return {
    scenarioCase,
    sourceBytes,
    sourceMimeType: 'image/jpeg',
    canonical,
    currentSpatialInventory: {
      version: 1,
      imageId: `fixture-${scenarioCase.sourceArtifact.sha256}`,
      naturalWidth: metadata.width,
      naturalHeight: metadata.height,
      elements: [
        {
          id: '00000000-0000-4000-8000-000000000005',
          label: 'fork and spoon on the right of the plate',
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

const runApprovedBatch = process.env.RUN_APPROVED_NB_PRO_REMOVE_HAINANESE_01 === 'true' ? it : it.skip

describe('Remove/NB Pro Hainanese enquiry 01', () => {
  it('constructs exactly one approved NB Pro A/B/C group without provider execution', async () => {
    const result = await runStudioObjectEditSpike([await runnableCase()], {
      mode: 'dry_run',
      maxExecutions: 3,
      filters: {
        caseIds: [approvedCaseId],
        operations: ['remove'],
        requestedModelClasses: ['nb_pro'],
      },
    })

    expect(result.mode).toBe('dry_run')
    expect(result.selectedExecutionCount).toBe(3)
    expect(result.records).toHaveLength(3)
    expect(result.records.map((record) => record.variant)).toEqual(['A', 'B', 'C'])
    expect(result.records.every((record) => record.caseId === approvedCaseId)).toBe(true)
    expect(result.records.every((record) => record.requestedModelClass === 'nb_pro')).toBe(true)
    expect(result.records.every((record) => record.configuredModelIdentifier === STUDIO_PRO_MODEL)).toBe(true)
    expect(result.records.every((record) => record.outcome === undefined)).toBe(true)
  }, 60_000)

  runApprovedBatch('executes only the approved Remove/NB Pro Hainanese A/B/C enquiry', async () => {
    const result = await runStudioObjectEditSpike([await runnableCase()], {
      mode: 'live',
      confirmLiveExecution: SPIKE_LIVE_CONFIRMATION,
      maxExecutions: 3,
      filters: {
        caseIds: [approvedCaseId],
        operations: ['remove'],
        requestedModelClasses: ['nb_pro'],
      },
    })

    expect(result.mode).toBe('live')
    expect(result.selectedExecutionCount).toBe(3)
    expect(result.records).toHaveLength(3)
    expect(result.records.map((record) => record.variant)).toEqual(['A', 'B', 'C'])
    expect(result.records.every((record) => record.requestedModelClass === 'nb_pro')).toBe(true)
    expect(result.records.every((record) => record.configuredModelIdentifier === STUDIO_PRO_MODEL)).toBe(true)

    await mkdir(dirname(resultPath), { recursive: true })
    await writeFile(
      resultPath,
      `${JSON.stringify({
        batch: 'remove-nb-pro-hainanese-01',
        approvedCaseId,
        executedAt: new Date().toISOString(),
        records: result.records,
      }, null, 2)}\n`,
      'utf8',
    )
  }, 600_000)
})
