/** @jest-environment node */

const mockExtract = jest.fn()

jest.mock('@/lib/photo-control/gemini-extraction-client', () => ({
  GeminiExtractionClient: jest.fn().mockImplementation(() => ({
    extract: (...args: unknown[]) => mockExtract(...args),
  })),
}))

jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }))

import {
  extractStudioOutputEvidence,
  reuseOrExtractStudioOutputEvidence,
  scoreStudioOutputEvidence,
} from '@/lib/studio/output-validation'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'

const expected: MinimalSchema = {
  scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'soft-natural', spin: '0' },
  canvas: { background: 'white', background_style: '', surface_style: '', main_vessel: 'plate' },
  food_components: { main_item: 'burger', garnishes: [], sides: [] },
}

const extractionRaw = {
  ...expected,
  spatial_inventory: {
    extractorVersion: 'test',
    elements: [
      {
        label: 'burger',
        hint: { kind: 'center', center: { x: 0.5, y: 0.5 } },
        visibility: 'visible',
      },
    ],
  },
}

describe('reusable studio output evidence', () => {
  beforeEach(() => {
    delete process.env.STUDIO_OUTPUT_VALIDATION_ENABLED
    mockExtract.mockResolvedValue({ raw: extractionRaw })
  })

  afterEach(() => jest.clearAllMocks())

  it('retains validated canonical evidence, optional spatial observation, digest, and versions', async () => {
    const evidence = await extractStudioOutputEvidence({ imageBase64: 'aW1hZ2U=', mimeType: 'image/png' })

    expect(evidence).toMatchObject({
      canonical: expected,
      versions: { evidence: 1, canonical: 1, spatial: 1 },
      spatialObservation: { spatial_inventory: extractionRaw.spatial_inventory },
    })
    expect(evidence?.imageDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(evidence?.extractionId).toMatch(/^[a-f0-9]{64}$/)
  })

  it('reuses compatible extraction evidence without another provider request', async () => {
    const input = { imageBase64: 'aW1hZ2U=', mimeType: 'image/png' as const }
    const first = await extractStudioOutputEvidence(input)
    const reused = await reuseOrExtractStudioOutputEvidence(input, first)

    expect(reused).toBe(first)
    expect(mockExtract).toHaveBeenCalledTimes(1)
  })

  it('keeps extract failures soft and preserves skipped validation semantics', async () => {
    mockExtract.mockRejectedValueOnce(new Error('provider unavailable'))
    const evidence = await extractStudioOutputEvidence({ imageBase64: 'aW1hZ2U=', mimeType: 'image/png' })

    expect(evidence).toBeNull()
    expect(scoreStudioOutputEvidence({ evidence, expected })).toMatchObject({ status: 'skipped', score: 0 })
  })
})
