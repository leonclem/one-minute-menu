/**
 * @jest-environment node
 *
 * Isolated internal-only composition enquiry. This is intentionally not the
 * production two-reference object-edit contract: it uses a third ingredient
 * reference and has one user-approved NB2 execution only.
 */

import { createHash } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

import sharp from 'sharp'

import { getNanoBananaClient, NanoBananaError } from '@/lib/nano-banana'
import { STUDIO_FLASH_MODEL, referenceLimitForModel } from '@/lib/studio/model-config'
import { configuredSpikeArtifactOwnerUserId, uploadSpikeArtifact } from './artifacts'
import { SPIKE_LIVE_CONFIRMATION } from './runner'

const fixtureDirectory = join(
  process.cwd(),
  '.kiro/specs/studio-object-selection-remove-move/test-images',
)
const resultsDirectory = join(fixtureDirectory, 'results')
const sourcePath = join(fixtureDirectory, '01-cheeseburger-delivery_landscape.jpg')
const pepperPath = join(fixtureDirectory, 'red-pepper.jpg')
const imageBPath = join(resultsDirectory, 'cheeseburger-red-pepper-addition-nb2-image-b-lower.png')
const proposalPath = join(resultsDirectory, 'cheeseburger-red-pepper-addition-nb2-proposal.json')
const resultPath = join(resultsDirectory, 'cheeseburger-red-pepper-addition-nb2-01.json')

// Derived from the product-owner supplied lower guide image.
const destination = { x: 0.92, y: 0.57 } as const

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function destinationGuideSvg(width: number, height: number): Buffer {
  const x = destination.x * width
  const y = destination.y * height
  const radius = Math.max(18, Math.min(width, height) * 0.06)
  const crosshair = radius * 1.45
  const ring = radius * 1.85
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<g data-guidance="add ingredient destination" fill="none" stroke-linecap="round">` +
      `<circle cx="${x}" cy="${y}" r="${ring}" stroke="#111827" stroke-width="${radius * 0.35}" stroke-dasharray="${radius * 0.45} ${radius * 0.3}"/>` +
      `<circle cx="${x}" cy="${y}" r="${ring}" stroke="#FFD400" stroke-width="${Math.max(2, radius * 0.15)}" stroke-dasharray="${radius * 0.45} ${radius * 0.3}"/>` +
      `<circle cx="${x}" cy="${y}" r="${radius}" stroke="#111827" stroke-width="${radius * 0.5}"/>` +
      `<circle cx="${x}" cy="${y}" r="${radius}" stroke="#FFD400" stroke-width="${Math.max(2, radius * 0.22)}"/>` +
      `<path d="M ${x - crosshair} ${y} H ${x + crosshair} M ${x} ${y - crosshair} V ${y + crosshair}" stroke="#111827" stroke-width="${Math.max(3, radius * 0.32)}"/>` +
      `<path d="M ${x - crosshair} ${y} H ${x + crosshair} M ${x} ${y - crosshair} V ${y + crosshair}" stroke="#FFD400" stroke-width="${Math.max(1.5, radius * 0.13)}"/>` +
      `</g></svg>`,
    'utf8',
  )
}

const prompt = [
  'Image A is the clean cheeseburger scene to preserve.',
  'Image B is a destination-only location guide derived from Image A and must not appear in the output.',
  'Image C is a visual-fidelity reference for one whole red bell pepper only; do not copy its white background into the output.',
  'Add exactly one whole red bell pepper, based on Image C, centered on the marked location in Image B: the open dark slate to the right of the white plate.',
  'Scale the pepper plausibly for the existing table setting: it should read as a naturally sized side ingredient, remain fully within the slate area, and not overlap the plate, burger, salad, or existing tomatoes.',
  'Integrate the pepper as if it were photographed with Image A: match Image A\'s camera perspective, natural daylight direction, color treatment, surface contact, and realistic contact shadow on the slate.',
  'Preserve Image A\'s burger, salad, plate, slate, backdrop, composition, and every existing unselected element. Do not move, remove, duplicate, crop, or restyle existing food or table elements.',
  'Do not reproduce the guide marker, rings, crosshair, or any annotation from Image B. Produce one coherent photographic image only.',
].join('\n\n')

async function prepareExperiment() {
  const [sourceBytes, pepperBytes] = await Promise.all([readFile(sourcePath), readFile(pepperPath)])
  const [sourceMetadata, pepperMetadata] = await Promise.all([
    sharp(sourceBytes, { failOn: 'error' }).metadata(),
    sharp(pepperBytes, { failOn: 'error' }).metadata(),
  ])
  if (sourceMetadata.format !== 'jpeg' || !sourceMetadata.width || !sourceMetadata.height) {
    throw new Error('Cheeseburger source is not a readable JPEG.')
  }
  if (pepperMetadata.format !== 'jpeg' || !pepperMetadata.width || !pepperMetadata.height) {
    throw new Error('Red pepper reference is not a readable JPEG.')
  }
  if (referenceLimitForModel(STUDIO_FLASH_MODEL) < 3) {
    throw new Error('NB2 reference capacity is insufficient for this approved three-reference experiment.')
  }

  const cleanBytes = await sharp(sourceBytes, { failOn: 'error' })
    .rotate()
    .ensureAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer()
  const cleanMetadata = await sharp(cleanBytes, { failOn: 'error' }).metadata()
  if (!cleanMetadata.width || !cleanMetadata.height) throw new Error('Clean scene dimensions unavailable.')

  const annotatedBytes = await sharp(cleanBytes, { failOn: 'error' })
    .composite([{ input: destinationGuideSvg(cleanMetadata.width, cleanMetadata.height), top: 0, left: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer()
  const annotatedMetadata = await sharp(annotatedBytes, { failOn: 'error' }).metadata()
  if (annotatedMetadata.width !== cleanMetadata.width || annotatedMetadata.height !== cleanMetadata.height) {
    throw new Error('Destination guide dimensions do not match the clean scene.')
  }

  const params = {
    prompt,
    model: STUDIO_FLASH_MODEL,
    reference_images: [
      { mimeType: 'image/png' as const, data: cleanBytes.toString('base64'), role: 'dish' as const, comment: 'Image A: clean scene to preserve.' },
      { mimeType: 'image/png' as const, data: annotatedBytes.toString('base64'), role: 'layout' as const, comment: 'Image B: destination-only location guide.' },
      { mimeType: 'image/jpeg' as const, data: pepperBytes.toString('base64'), role: 'other' as const, comment: 'Image C: red bell pepper visual-fidelity reference only.' },
    ],
    person_generation: 'dont_allow' as const,
    safety_filter_level: 'block_some' as const,
    number_of_images: 1,
    image_size: '2K',
  }

  return { cleanBytes, annotatedBytes, pepperBytes, params }
}

async function writeDryRunArtifacts(experiment: Awaited<ReturnType<typeof prepareExperiment>>) {
  const { buildGeminiRequest } = await import('@/lib/nano-banana')
  const request = buildGeminiRequest(experiment.params)
  const parts = (request.requestBody.contents as Array<{ parts: Array<Record<string, unknown>> }>)[0].parts
  if (parts.length !== 4) throw new Error('Expected text plus exactly three ordered image references.')

  const proposal = {
    version: 1,
    mode: 'dry_run_only',
    model: STUDIO_FLASH_MODEL,
    destination,
    referenceOrder: [
      { image: 'A', role: 'clean_scene', mimeType: 'image/png', sha256: sha256(experiment.cleanBytes) },
      { image: 'B', role: 'destination_guide', mimeType: 'image/png', sha256: sha256(experiment.annotatedBytes) },
      { image: 'C', role: 'red_pepper_reference', mimeType: 'image/jpeg', sha256: sha256(experiment.pepperBytes) },
    ],
    finalPrompt: request.loggedPrompt,
  }
  await mkdir(resultsDirectory, { recursive: true })
  await Promise.all([
    writeFile(imageBPath, experiment.annotatedBytes),
    writeFile(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8'),
  ])
  return proposal
}

const runApprovedExperiment = process.env.RUN_APPROVED_NB2_RED_PEPPER_ADDITION_01 === 'true' ? it : it.skip

describe('NB2 red-pepper addition enquiry 01', () => {
  it('constructs exactly one dry-run-only NB2 three-reference experiment', async () => {
    const experiment = await prepareExperiment()
    const proposal = await writeDryRunArtifacts(experiment)

    expect(proposal.model).toBe(STUDIO_FLASH_MODEL)
    expect(proposal.destination).toEqual(destination)
    expect(proposal.referenceOrder.map((reference) => reference.image)).toEqual(['A', 'B', 'C'])
    expect(proposal.finalPrompt).toContain('Image A is the clean cheeseburger scene to preserve.')
    expect(proposal.finalPrompt).toContain('Image B is a destination-only location guide')
    expect(proposal.finalPrompt).toContain('Image C is a visual-fidelity reference for one whole red bell pepper only')
  }, 60_000)

  runApprovedExperiment('executes exactly one approved NB2 red-pepper composition enquiry', async () => {
    if (process.env.STUDIO_OBJECT_EDIT_SPIKE_LIVE_ENABLED !== 'true') {
      throw new Error('Live experiment requires STUDIO_OBJECT_EDIT_SPIKE_LIVE_ENABLED=true.')
    }
    if (process.env.SPIKE_LIVE_CONFIRMATION !== SPIKE_LIVE_CONFIRMATION) {
      throw new Error('Live experiment requires the explicit internal confirmation value.')
    }
    configuredSpikeArtifactOwnerUserId()

    const experiment = await prepareExperiment()
    const proposal = await writeDryRunArtifacts(experiment)
    const record: Record<string, unknown> = {
      experiment: 'red-pepper-addition-01',
      model: STUDIO_FLASH_MODEL,
      destination,
      referenceOrder: proposal.referenceOrder,
      promptSha256: sha256(proposal.finalPrompt),
      promptLength: proposal.finalPrompt.length,
      providerReportedModelIdentity: null,
      providerIdentityReported: false,
      mode: 'live',
    }

    try {
      const result = await getNanoBananaClient().generateImage(experiment.params)
      const imageBytes = Buffer.from(result.images[0], 'base64')
      const outputArtifact = await uploadSpikeArtifact({
        mimeType: 'image/png',
        bytes: imageBytes,
        label: 'red-pepper-addition-nb2-01',
      })
      Object.assign(record, {
        outcome: 'generated',
        outputArtifact,
        providerReportedModelIdentity: result.metadata.providerModelIdentity,
        providerIdentityReported: result.metadata.providerModelIdentity !== null,
      })
    } catch (error) {
      Object.assign(record, {
        outcome: error instanceof NanoBananaError ? 'provider_error' : 'transport_error',
        noFailureArtifactReturned: true,
      })
    }

    await mkdir(resultsDirectory, { recursive: true })
    await writeFile(resultPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
    expect(record.outcome).toBeDefined()
  }, 600_000)
})
