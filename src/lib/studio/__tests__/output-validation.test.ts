/**
 * @jest-environment node
 */

const mockExtract = jest.fn()

jest.mock('@/lib/photo-control/gemini-extraction-client', () => ({
  GeminiExtractionClient: jest.fn().mockImplementation(() => ({
    extract: (...args: unknown[]) => mockExtract(...args),
  })),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import {
  isStudioOutputValidationEnabled,
  readValidationFromMetadata,
  runStudioOutputValidation,
  validationToMetadata,
} from '@/lib/studio/output-validation'
import type { OutputValidationResult } from '@/lib/photo-control/output-validator'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'

const expected: MinimalSchema = {
  scene_setup: {
    angle: '45-degree',
    framing: 'close-up',
    lighting: 'bright-and-airy',
    spin: '0',
  },
  canvas: {
    background: 'white',
    background_style: '',
    surface_style: '',
    main_vessel: 'plate',
  },
  food_components: { main_item: 'burger', garnishes: [], sides: [] },
}

describe('studio output-validation helpers', () => {
  const original = process.env.STUDIO_OUTPUT_VALIDATION_ENABLED

  afterEach(() => {
    if (original === undefined) {
      delete process.env.STUDIO_OUTPUT_VALIDATION_ENABLED
    } else {
      process.env.STUDIO_OUTPUT_VALIDATION_ENABLED = original
    }
    jest.clearAllMocks()
  })

  it('defaults to enabled when unset', () => {
    delete process.env.STUDIO_OUTPUT_VALIDATION_ENABLED
    expect(isStudioOutputValidationEnabled()).toBe(true)
  })

  it('disables for false/0/off', () => {
    process.env.STUDIO_OUTPUT_VALIDATION_ENABLED = 'false'
    expect(isStudioOutputValidationEnabled()).toBe(false)
    process.env.STUDIO_OUTPUT_VALIDATION_ENABLED = '0'
    expect(isStudioOutputValidationEnabled()).toBe(false)
    process.env.STUDIO_OUTPUT_VALIDATION_ENABLED = 'off'
    expect(isStudioOutputValidationEnabled()).toBe(false)
  })

  it('skips re-extract when disabled', async () => {
    process.env.STUDIO_OUTPUT_VALIDATION_ENABLED = 'false'
    const result = await runStudioOutputValidation({
      imageBase64: 'abc',
      mimeType: 'image/png',
      expected,
    })
    expect(result.status).toBe('skipped')
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('soft-skips when extract throws', async () => {
    delete process.env.STUDIO_OUTPUT_VALIDATION_ENABLED
    mockExtract.mockRejectedValue(new Error('boom'))
    const result = await runStudioOutputValidation({
      imageBase64: 'abc',
      mimeType: 'image/png',
      expected,
    })
    expect(result.status).toBe('skipped')
    expect(result.summary).toMatch(/extract error/i)
  })

  it('scores a successful re-extract', async () => {
    delete process.env.STUDIO_OUTPUT_VALIDATION_ENABLED
    mockExtract.mockResolvedValue({
      raw: {
        scene_setup: {
          angle: '45-degree',
          framing: 'close-up',
          lighting: 'bright-and-airy',
        },
        canvas: { background: 'white', main_vessel: 'plate' },
        food_components: { main_item: 'burger', garnishes: [], sides: [] },
      },
    })
    const result = await runStudioOutputValidation({
      imageBase64: 'abc',
      mimeType: 'image/png',
      expected,
    })
    expect(result.status).toBe('pass')
    expect(mockExtract).toHaveBeenCalled()
  })

  it('round-trips metadata read/write', () => {
    const result: OutputValidationResult = {
      status: 'warn',
      score: 70,
      summary: 'Minor consistency warnings: vessel may have changed',
      dimensions: [{ id: 'vessel', status: 'warn', note: 'vessel may have changed' }],
    }
    const meta = { validation: validationToMetadata(result) }
    expect(readValidationFromMetadata(meta)).toEqual({
      status: 'warn',
      score: 70,
      summary: 'Minor consistency warnings: vessel may have changed',
    })
  })

  it('returns null for missing validation metadata', () => {
    expect(readValidationFromMetadata({})).toBeNull()
    expect(readValidationFromMetadata(null)).toBeNull()
  })
})
