/** @jest-environment node */

import { createHash } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

import sharp from 'sharp'

import { STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import { buildGeminiRequest } from '@/lib/nano-banana'
import { constructSpikeComparisonGroup } from './construction'
import { SpikeScenarioCaseZ, parseStudioObjectEditSpikeManifest } from './manifest'
import type { RunnableSpikeCase } from './runner'

const fixtureDirectory = join(
  process.cwd(),
  '.kiro/specs/studio-object-selection-remove-move/test-images',
)
const manifestPath = join(fixtureDirectory, 'nb2-spike-manifest.v1.json')
const resultPath = join(fixtureDirectory, 'results', 'move-nb-pro-confirmation-01.json')
const imageBOutputPath = join(fixtureDirectory, 'results', 'move-01-cheeseburger-tomatoes-image-b-annotation.png')
const caseId = 'move-01-cheeseburger-tomatoes'

async function constructFrozenCheeseburgerGroup() {
  const manifest = parseStudioObjectEditSpikeManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
  const baseScenarioCase = manifest.cases.find((scenarioCase) => scenarioCase.id === caseId)
  if (!baseScenarioCase) throw new Error(`Fixture case unavailable: ${caseId}`)

  const scenarioCase = SpikeScenarioCaseZ.parse({
    ...baseScenarioCase,
    requestedModelClass: 'nb_pro',
    configuredModelIdentifier: STUDIO_PRO_MODEL,
  })
  const sourceBytes = await readFile(join(fixtureDirectory, '01-cheeseburger-delivery_landscape.jpg'))
  const metadata = await sharp(sourceBytes).metadata()
  if (!metadata.width || !metadata.height) throw new Error('Fixture dimensions unavailable: 01-cheeseburger-delivery_landscape.jpg')
  const target = scenarioCase.selection.strokes[0].points[0]

  const runnableCase: RunnableSpikeCase = {
    scenarioCase,
    sourceBytes,
    sourceMimeType: 'image/jpeg',
    canonical: {
      scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'natural daylight', spin: '0' },
      canvas: { background: 'dark restaurant tabletop', background_style: '', surface_style: '', main_vessel: 'white plate' },
      food_components: { main_item: 'cheeseburger', garnishes: ['side salad'], sides: [] },
    },
    currentSpatialInventory: {
      version: 1,
      imageId: `fixture-${scenarioCase.sourceArtifact.sha256}`,
      naturalWidth: metadata.width,
      naturalHeight: metadata.height,
      elements: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          label: 'two cherry tomatoes in front-right of the plate',
          hint: { kind: 'center', center: target },
          visibility: 'visible',
          evidence: 'Internal spike fixture annotation.',
        },
      ],
      extractedAt: '2026-08-26T00:00:00.000Z',
      extractorVersion: 'fixture-v1',
    },
  }

  return constructSpikeComparisonGroup(runnableCase)
}

it('reconstructs exact frozen Move/NB Pro cheeseburger A/B/C prompts without provider execution', async () => {
  const frozen = JSON.parse(await readFile(resultPath, 'utf8')) as {
    records: Array<{ caseId: string; variant: 'A' | 'B' | 'C'; contractDigest: string }>
  }
  const group = await constructFrozenCheeseburgerGroup()
  const expectedDigests = new Map(
    frozen.records
      .filter((record) => record.caseId === caseId)
      .map((record) => [record.variant, record.contractDigest]),
  )

  expect(group.requests).toHaveLength(3)
  for (const request of group.requests) {
    expect(request.contractDigest).toBe(expectedDigests.get(request.variant))
    const finalRequest = buildGeminiRequest({
      ...request.mutationInput,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      number_of_images: 1,
      image_size: '2K',
      request_scope: 'studio_object_edit',
    })
    expect(finalRequest.loggedPrompt).toBe(`${request.instruction}\nNo people in the image.`)
  }

  const annotationBytes = Buffer.from(group.preparedImages.annotated.data, 'base64')
  expect(createHash('sha256').update(annotationBytes).digest('hex')).toBe(
    '91afb8bdf4e2e2122e5e37791a0417d253e78148c3534fab6dfee5e3bbb3e750',
  )
  await mkdir(join(fixtureDirectory, 'results'), { recursive: true })
  await writeFile(imageBOutputPath, annotationBytes)

  console.log(
    JSON.stringify(
      group.requests.map(({ variant, instruction, contractDigest }) => ({ variant, contractDigest, instruction })),
      null,
      2,
    ),
  )
}, 60_000)
