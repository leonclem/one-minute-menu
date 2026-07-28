/**
 * @jest-environment node
 */

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn() },
}))

import { logger } from '@/lib/logger'
import {
  configuredStudioImageSize,
  configuredThinkingLevel,
  documentedLimit,
  envMaxRefs,
  maxReferencesFor,
  maxRefsFor,
  modelSupportsThinkingLevel,
  referenceLimitForModel,
  STUDIO_FLASH_MODEL,
  STUDIO_PRO_MODEL,
} from '../model-config'

const warnSpy = logger.warn as jest.Mock
const originalEnv = process.env

function warningText(): string {
  return warnSpy.mock.calls.map((call) => JSON.stringify(call)).join('\n')
}

describe('studio model configuration', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.STUDIO_MAX_REFS
    delete process.env.STUDIO_THINKING_LEVEL
    delete process.env.STUDIO_IMAGE_SIZE
    warnSpy.mockClear()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('expresses documented per-kind reference limits without conflating Flash styles with objects', () => {
    expect(referenceLimitForModel(STUDIO_PRO_MODEL)).toBe(14)
    expect(documentedLimit(STUDIO_PRO_MODEL, 'total')).toBe(14)
    expect(documentedLimit(STUDIO_PRO_MODEL, 'style')).toBe(3)
    expect(documentedLimit(STUDIO_PRO_MODEL, 'highFidelity')).toBe(5)
    expect(documentedLimit(STUDIO_PRO_MODEL, 'high-fidelity')).toBe(5)

    expect(referenceLimitForModel(STUDIO_FLASH_MODEL)).toBe(10)
    expect(documentedLimit(STUDIO_FLASH_MODEL, 'object')).toBe(10)
    expect(documentedLimit(STUDIO_FLASH_MODEL, 'character')).toBe(4)
    expect(documentedLimit(STUDIO_FLASH_MODEL, 'style')).toBe(0)

    expect(documentedLimit('gemini-2.5-flash-image', 'total')).toBe(3)
    expect(documentedLimit('unrecognised-model', 'style')).toBe(3)
  })


  it('identifies Flash-family thinking support while preserving Pro and legacy omissions', () => {
    expect(modelSupportsThinkingLevel(STUDIO_FLASH_MODEL)).toBe(true)
    expect(modelSupportsThinkingLevel(`${STUDIO_FLASH_MODEL}-preview`)).toBe(true)
    expect(modelSupportsThinkingLevel('gemini-2.5-flash-image')).toBe(true)
    expect(modelSupportsThinkingLevel(STUDIO_PRO_MODEL)).toBe(false)
    expect(modelSupportsThinkingLevel('legacy-image-model')).toBe(false)
  })

  it('uses high thinking by default and accepts the supported configured values', () => {
    expect(configuredThinkingLevel()).toBe('high')

    process.env.STUDIO_THINKING_LEVEL = 'minimal'
    expect(configuredThinkingLevel()).toBe('minimal')

    process.env.STUDIO_THINKING_LEVEL = ' HIGH '
    expect(configuredThinkingLevel()).toBe('high')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns and falls back to high for an unsupported thinking level', () => {
    process.env.STUDIO_THINKING_LEVEL = 'medium'

    expect(configuredThinkingLevel()).toBe('high')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warningText()).toContain('medium')
    expect(warningText()).toContain('high')
  })

  it('normalizes configured image size tokens and defaults to 2K', () => {
    expect(configuredStudioImageSize()).toBe('2K')

    process.env.STUDIO_IMAGE_SIZE = ' 4k '
    expect(configuredStudioImageSize()).toBe('4K')
  })

  it('applies below-limit overrides silently for each model', () => {
    process.env.STUDIO_MAX_REFS = '2'

    expect(maxRefsFor(STUDIO_PRO_MODEL)).toBe(2)
    expect(maxReferencesFor(STUDIO_FLASH_MODEL, 'object')).toBe(2)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('clamps overrides to each model and kind without allowing a Pro limit to leak to Flash', () => {
    process.env.STUDIO_MAX_REFS = '20'

    expect(maxRefsFor(STUDIO_PRO_MODEL)).toBe(14)
    expect(warningText()).toContain('20')
    expect(warningText()).toContain('14')

    warnSpy.mockClear()
    expect(maxRefsFor(STUDIO_FLASH_MODEL)).toBe(10)
    expect(warningText()).toContain('20')
    expect(warningText()).toContain('10')

    warnSpy.mockClear()
    expect(maxReferencesFor(STUDIO_FLASH_MODEL, 'style')).toBe(0)
    expect(warningText()).toContain('20')
    expect(warningText()).toContain('0')
  })


  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['non-numeric', 'many'],
    ['zero', '0'],
    ['negative', '-1'],
  ])('warns and falls back to documented limits for a %s override', (_case, value) => {
    if (value === undefined) {
      delete process.env.STUDIO_MAX_REFS
    } else {
      process.env.STUDIO_MAX_REFS = value
    }

    expect(envMaxRefs()).toBe(Number.POSITIVE_INFINITY)
    expect(maxRefsFor(STUDIO_PRO_MODEL)).toBe(14)
    expect(maxRefsFor(STUDIO_FLASH_MODEL)).toBe(10)
    expect(warnSpy).toHaveBeenCalled()
    expect(warningText()).toContain('documented limit')
  })
})
