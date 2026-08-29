/**
 * @jest-environment node
 */

import { createHash } from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import {
  deriveSelectionBoundingRegion,
  deriveSelectionSourcePoint,
  type AnnotationStroke,
  type MovePlacement,
  type Selection,
} from '@/lib/studio/object-edit/contracts'
import { parseStudioObjectEditSpikeManifest, type StudioObjectEditSpikeManifest } from './manifest'
import { prepareObjectEditImages } from '@/lib/studio/object-edit/reference-image'

const fixtureDirectory = join(
  process.cwd(),
  '.kiro/specs/studio-object-selection-remove-move/test-images',
)
const manifestPath = join(fixtureDirectory, 'nb2-spike-manifest.v1.json')
const flashModel = 'gemini-3.1-flash-image'

type Point = { x: number; y: number }
type FixtureDraft = {
  id: string
  fileName: string
  operation: 'remove' | 'move'
  target: Point
  additionalTargets?: readonly Point[]
  destination?: Point
  scenarioTags: readonly string[]
}

const drafts: readonly FixtureDraft[] = [
  {
    id: 'remove-01-cheeseburger-salad',
    fileName: '01-cheeseburger-delivery_landscape.jpg',
    operation: 'remove',
    target: { x: 0.69, y: 0.49 },
    scenarioTags: ['side', 'isolated_foreground'],
  },
  {
    id: 'remove-02-chicken-burger-roll',
    fileName: '02-chicken-burger.jpg',
    operation: 'remove',
    target: { x: 0.5, y: 0.92 },
    scenarioTags: ['small', 'ambiguous'],
  },
  {
    id: 'remove-03-rogan-josh-fork',
    fileName: '03-Chicken-Rogan-Josh.jpg',
    operation: 'remove',
    target: { x: 0.14, y: 0.75 },
    scenarioTags: ['overlapping', 'isolated_foreground'],
  },
  {
    id: 'remove-04-fish-tacos-beer',
    fileName: '04-fish-tacos.jpg',
    operation: 'remove',
    target: { x: 0.07, y: 0.08 },
    scenarioTags: ['background', 'small'],
  },
  {
    id: 'remove-05-hainanese-utensils',
    fileName: '05-Hainanese_Chicken_Rice.jpg',
    operation: 'remove',
    target: { x: 0.8, y: 0.55 },
    scenarioTags: ['overlapping', 'side'],
  },
  {
    id: 'remove-06-beef-mash-second-dish',
    fileName: '06-mashed-potatoes-with-beef-and-mushroom-gravy.webp',
    operation: 'remove',
    target: { x: 0.53, y: 0.2 },
    scenarioTags: ['background', 'ambiguous'],
  },
  {
    id: 'remove-07-pizza-person',
    fileName: '07-pizza-neopolitana.jpg',
    operation: 'remove',
    target: { x: 0.5, y: 0.12 },
    scenarioTags: ['background', 'overlapping'],
  },
  {
    id: 'remove-08-roast-beef-napkin',
    fileName: '08-Roast-beef-dinner-wide-FS.webp',
    operation: 'remove',
    target: { x: 0.79, y: 0.24 },
    scenarioTags: ['side', 'isolated_foreground'],
  },
  {
    id: 'remove-09-salmon-milk',
    fileName: '09-salmon-mash-asparagus.jpg',
    operation: 'remove',
    target: { x: 0.84, y: 0.29 },
    scenarioTags: ['isolated_foreground', 'small'],
  },
  {
    id: 'remove-10-massaman-secondary-dish',
    fileName: '10-thai-massaman-curry.jpg',
    operation: 'remove',
    target: { x: 0.08, y: 0.8 },
    scenarioTags: ['background', 'overlapping'],
  },
  {
    id: 'move-01-cheeseburger-tomatoes',
    fileName: '01-cheeseburger-delivery_landscape.jpg',
    operation: 'move',
    target: { x: 0.72, y: 0.56 },
    destination: { x: 0.36, y: 0.64 },
    scenarioTags: ['small', 'side'],
  },
  {
    id: 'move-02-chicken-burger-pickles',
    fileName: '02-chicken-burger.jpg',
    operation: 'move',
    target: { x: 0.76, y: 0.58 },
    destination: { x: 0.16, y: 0.62 },
    scenarioTags: ['ambiguous', 'side'],
  },
  {
    id: 'move-03-rogan-josh-chilli',
    fileName: '03-Chicken-Rogan-Josh.jpg',
    operation: 'move',
    target: { x: 0.49, y: 0.93 },
    destination: { x: 0.52, y: 0.46 },
    scenarioTags: ['small', 'isolated_foreground'],
  },
  {
    id: 'move-04-fish-tacos-limes',
    fileName: '04-fish-tacos.jpg',
    operation: 'move',
    target: { x: 0.28, y: 0.76 },
    destination: { x: 0.53, y: 0.45 },
    scenarioTags: ['side', 'overlapping'],
  },
  {
    id: 'move-05-hainanese-utensils',
    fileName: '05-Hainanese_Chicken_Rice.jpg',
    operation: 'move',
    target: { x: 0.79, y: 0.54 },
    destination: { x: 0.27, y: 0.64 },
    scenarioTags: ['overlapping', 'ambiguous'],
  },
  {
    id: 'move-06-beef-mash-sprouts',
    fileName: '06-mashed-potatoes-with-beef-and-mushroom-gravy.webp',
    operation: 'move',
    target: { x: 0.75, y: 0.49 },
    destination: { x: 0.31, y: 0.5 },
    scenarioTags: ['background', 'side'],
  },
  {
    id: 'move-07-pizza-basil',
    fileName: '07-pizza-neopolitana.jpg',
    operation: 'move',
    target: { x: 0.52, y: 0.52 },
    additionalTargets: [
      { x: 0.38, y: 0.37 },
      { x: 0.64, y: 0.39 },
    ],
    destination: { x: 0.7, y: 0.5 },
    scenarioTags: ['small', 'ambiguous'],
  },
  {
    id: 'move-08-roast-beef-knife',
    fileName: '08-Roast-beef-dinner-wide-FS.webp',
    operation: 'move',
    target: { x: 0.2, y: 0.68 },
    destination: { x: 0.67, y: 0.62 },
    scenarioTags: ['side', 'isolated_foreground'],
  },
  {
    id: 'move-09-salmon-milk',
    fileName: '09-salmon-mash-asparagus.jpg',
    operation: 'move',
    target: { x: 0.84, y: 0.29 },
    destination: { x: 0.3, y: 0.29 },
    scenarioTags: ['isolated_foreground', 'background'],
  },
  {
    id: 'move-10-massaman-lime',
    fileName: '10-thai-massaman-curry.jpg',
    operation: 'move',
    target: { x: 0.85, y: 0.92 },
    destination: { x: 0.85, y: 0.12 },
    scenarioTags: ['small', 'background'],
  },
]

function digest(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function mimeTypeFor(fileName: string): 'image/jpeg' | 'image/webp' {
  return fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
}

function isTransientWindowsFileLock(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY'
}

async function readFixtureBytes(fileName: string): Promise<Buffer> {
  const path = join(fixtureDirectory, fileName)
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await readFile(path)
    } catch (error) {
      if (!isTransientWindowsFileLock(error)) throw error
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt))
    }
  }
  throw lastError
}

async function readUniqueFixtureBytes(): Promise<Map<string, Buffer>> {
  const sourceBytesByFileName = new Map<string, Buffer>()
  for (const fileName of new Set(drafts.map((draft) => draft.fileName))) {
    sourceBytesByFileName.set(fileName, await readFixtureBytes(fileName))
  }
  return sourceBytesByFileName
}

function selectionFor(point: Point, additionalPoints: readonly Point[] = []): Selection {
  const strokes: readonly AnnotationStroke[] = [
    { kind: 'tap', points: [point] },
    ...additionalPoints.map((additionalPoint) => ({
      kind: 'tap' as const,
      points: [additionalPoint],
    })),
  ]
  return {
    version: 1,
    strokes,
    boundingRegion: deriveSelectionBoundingRegion(strokes),
  }
}

async function buildManifest(): Promise<StudioObjectEditSpikeManifest> {
  const sourceBytesByFileName = await readUniqueFixtureBytes()
  const cases = await Promise.all(
    drafts.map(async (draft) => {
      const sourceBytes = sourceBytesByFileName.get(draft.fileName)
      if (!sourceBytes) throw new Error(`Fixture unavailable: ${draft.fileName}`)
      const metadata = await sharp(sourceBytes).metadata()
      if (!metadata.width || !metadata.height) throw new Error(`Fixture has no dimensions: ${draft.fileName}`)

      const selection = selectionFor(draft.target, draft.additionalTargets)
      const placement: MovePlacement | undefined =
        draft.operation === 'move'
          ? {
              source: deriveSelectionSourcePoint(selection.boundingRegion),
              destination: draft.destination!,
            }
          : undefined
      const intent =
        draft.operation === 'move'
          ? { version: 1 as const, operation: 'move' as const, selection, placement: placement! }
          : { version: 1 as const, operation: 'remove' as const, selection }
      const prepared = await prepareObjectEditImages({
        sourceBytes,
        sourceMimeType: mimeTypeFor(draft.fileName),
        intent,
      })
      const annotatedBytes = Buffer.from(prepared.annotated.data, 'base64')
      return {
        id: draft.id,
        operation: draft.operation,
        requestedModelClass: 'nb2' as const,
        configuredModelIdentifier: flashModel,
        sourceArtifact: {
          storagePath: `studio-object-edit-spike/inputs/${draft.fileName}`,
          mimeType: mimeTypeFor(draft.fileName),
          sha256: digest(sourceBytes),
        },
        annotatedArtifact: {
          storagePath: `studio-object-edit-spike/annotated/${draft.id}.png`,
          mimeType: 'image/png',
          sha256: digest(annotatedBytes),
        },
        selection,
        ...(placement === undefined ? {} : { placement }),
        scenarioTags: [...draft.scenarioTags],
      }
    }),
  )
  return parseStudioObjectEditSpikeManifest({
    version: 1,
    label: 'NB2 initial Remove and Move controlled A/B/C spike fixtures',
    cases,
  })
}

describe('NB2 spike fixture manifest', () => {
  it('freezes valid source and production-rendered annotation artifacts', async () => {
    const manifest = await buildManifest()
    expect(manifest.cases).toHaveLength(20)
    expect(manifest.cases.filter((scenarioCase) => scenarioCase.operation === 'remove')).toHaveLength(10)
    expect(manifest.cases.filter((scenarioCase) => scenarioCase.operation === 'move')).toHaveLength(10)

    if (process.env.UPDATE_NB2_SPIKE_MANIFEST === 'true') {
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    }

    const persistedManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    expect(persistedManifest).toEqual(manifest)
  }, 30_000)
})