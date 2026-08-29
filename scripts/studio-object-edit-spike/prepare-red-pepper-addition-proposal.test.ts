/** @jest-environment node */

import { createHash } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

import sharp from 'sharp'

import { buildGeminiRequest } from '@/lib/nano-banana'
import { STUDIO_PRO_MODEL } from '@/lib/studio/model-config'

const fixtureDirectory = join(
  process.cwd(),
  '.kiro/specs/studio-object-selection-remove-move/test-images',
)
const resultsDirectory = join(fixtureDirectory, 'results')
const sourcePath = join(fixtureDirectory, '01-cheeseburger-delivery_landscape.jpg')
const pepperPath = join(fixtureDirectory, 'red-pepper.jpg')
const imageBPath = join(resultsDirectory, 'cheeseburger-red-pepper-addition-image-b.png')
const proposalPath = join(resultsDirectory, 'cheeseburger-red-pepper-addition-proposal.json')

const destination = { x: 0.85, y: 0.25 } as const

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function destinationGuideSvg(width: number, height: number): Buffer {
  const x = destination.x * width
  const y = destination.y * height
  const radius = Math.max(12, Math.min(width, height) * 0.035)
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
  'Add exactly one whole red bell pepper, based on Image C, centered on the marked location in Image B: the open dark slate to the upper-right of the white plate.',
  'Scale the pepper plausibly for the existing table setting: it should read as a naturally sized side ingredient, remain fully within the slate area, and not overlap the plate, burger, salad, or existing tomatoes.',
  'Integrate the pepper as if it were photographed with Image A: match Image A\'s camera perspective, natural daylight direction, color treatment, surface contact, and realistic contact shadow on the slate.',
  'Preserve Image A\'s burger, salad, plate, slate, backdrop, composition, and every existing unselected element. Do not move, remove, duplicate, crop, or restyle existing food or table elements.',
  'Do not reproduce the guide marker, rings, crosshair, or any annotation from Image B. Produce one coherent photographic image only.',
].join('\n\n')

it('constructs the local-only three-reference red-pepper addition proposal without provider execution', async () => {
  const [sourceBytes, pepperBytes] = await Promise.all([readFile(sourcePath), readFile(pepperPath)])
  const [sourceMetadata, pepperMetadata] = await Promise.all([
    sharp(sourceBytes, { failOn: 'error' }).metadata(),
    sharp(pepperBytes, { failOn: 'error' }).metadata(),
  ])
  expect(sourceMetadata.format).toBe('jpeg')
  expect(sourceMetadata.width).toBeGreaterThan(0)
  expect(sourceMetadata.height).toBeGreaterThan(0)
  expect(pepperMetadata.format).toBe('jpeg')
  expect(pepperMetadata.width).toBeGreaterThan(0)
  expect(pepperMetadata.height).toBeGreaterThan(0)

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
  expect(annotatedMetadata.width).toBe(cleanMetadata.width)
  expect(annotatedMetadata.height).toBe(cleanMetadata.height)

  const request = buildGeminiRequest({
    prompt,
    model: STUDIO_PRO_MODEL,
    reference_images: [
      { mimeType: 'image/png', data: cleanBytes.toString('base64'), role: 'dish', comment: 'Image A: clean scene to preserve.' },
      { mimeType: 'image/png', data: annotatedBytes.toString('base64'), role: 'layout', comment: 'Image B: destination-only location guide.' },
      { mimeType: 'image/jpeg', data: pepperBytes.toString('base64'), role: 'other', comment: 'Image C: red bell pepper visual-fidelity reference only.' },
    ],
    person_generation: 'dont_allow',
    safety_filter_level: 'block_some',
    number_of_images: 1,
    image_size: '2K',
  })
  const parts = (request.requestBody.contents as Array<{ parts: Array<Record<string, unknown>> }>)[0].parts
  expect(parts).toHaveLength(4)
  expect(request.loggedPrompt).toContain('Image A is the clean cheeseburger scene to preserve.')
  expect(request.loggedPrompt).toContain('Image B is a destination-only location guide')
  expect(request.loggedPrompt).toContain('Image C is a visual-fidelity reference for one whole red bell pepper only')
  expect(request.loggedPrompt).toContain('No people in the image.')

  const proposal = {
    version: 1,
    mode: 'dry_run_only',
    model: STUDIO_PRO_MODEL,
    destination,
    referenceOrder: [
      { image: 'A', role: 'clean_scene', mimeType: 'image/png', sha256: sha256(cleanBytes) },
      { image: 'B', role: 'destination_guide', mimeType: 'image/png', sha256: sha256(annotatedBytes) },
      { image: 'C', role: 'red_pepper_reference', mimeType: 'image/jpeg', sha256: sha256(pepperBytes) },
    ],
    finalPrompt: request.loggedPrompt,
  }

  await mkdir(resultsDirectory, { recursive: true })
  await Promise.all([
    writeFile(imageBPath, annotatedBytes),
    writeFile(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8'),
  ])

  console.log(JSON.stringify({ imageBPath, proposalPath, proposal }, null, 2))
}, 60_000)
