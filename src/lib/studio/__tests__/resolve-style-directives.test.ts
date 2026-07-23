/**
 * @jest-environment node
 */

const mockResolveLighting = jest.fn()
const mockResolveBackground = jest.fn()

jest.mock('../reference-libraries', () => ({
  resolveLightingStyle: (...args: unknown[]) => mockResolveLighting(...args),
  resolveBackgroundStyle: (...args: unknown[]) => mockResolveBackground(...args),
  buildStyleDirectiveClause: (prompt: string, constraints?: string | null) =>
    [prompt, constraints].filter(Boolean).join(' '),
}))

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import {
  mergeDirectiveWithStyleClauses,
  resolveStyleDirectiveClauses,
} from '../resolve-style-directives'

function schema(overrides?: {
  lighting?: string
  backgroundStyle?: string
  surfaceStyle?: string
}): MinimalSchema {
  return {
    scene_setup: {
      angle: '45-degree',
      framing: 'close-up',
      lighting: overrides?.lighting ?? 'bright-and-airy',
    },
    canvas: {
      background: 'table',
      background_style: overrides?.backgroundStyle ?? '',
      surface_style: overrides?.surfaceStyle ?? '',
      main_vessel: 'plate',
    },
    food_components: { main_item: 'burger', garnishes: [], sides: [] },
  }
}

describe('resolve-style-directives', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('resolves lighting and background clauses when keys change', async () => {
    const mockLightingRecord = {
      prompt_fragment: 'LIGHTING_CLAUSE',
      negative_constraints: 'No props.',
      thumbnail_path: 'light-moody',
      name: 'Moody',
    }
    const mockBackgroundRecord = {
      prompt_fragment: 'BACKGROUND_CLAUSE',
      negative_constraints: null,
      thumbnail_path: 'bg-dark-slate',
      name: 'Dark Slate',
    }
    const mockSurfaceRecord = {
      prompt_fragment: 'SURFACE_CLAUSE',
      negative_constraints: null,
      thumbnail_path: 'surface-granite-light',
      name: 'Light Granite',
    }

    mockResolveLighting.mockResolvedValue(mockLightingRecord)
    mockResolveBackground.mockImplementation((key) => {
      if (key === 'dark-slate') return Promise.resolve(mockBackgroundRecord)
      if (key === 'granite-light') return Promise.resolve(mockSurfaceRecord)
      return Promise.resolve(null)
    })

    const result = await resolveStyleDirectiveClauses(
      schema({ lighting: 'bright-and-airy', backgroundStyle: '', surfaceStyle: '' }),
      schema({ lighting: 'low-key', backgroundStyle: 'dark-slate', surfaceStyle: 'granite-light' }),
    )

    expect(result.error).toBeUndefined()
    expect(result.clauses).toEqual([
      'LIGHTING_CLAUSE No props.',
      'BACKGROUND_CLAUSE',
      'SURFACE_CLAUSE',
    ])
    expect(result.lightingStyle).toEqual(mockLightingRecord)
    expect(result.backgroundStyle).toEqual(mockBackgroundRecord)
    expect(result.surfaceStyle).toEqual(mockSurfaceRecord)
  })

  it('returns an error for unknown lighting style', async () => {
    mockResolveLighting.mockResolvedValue(null)

    const result = await resolveStyleDirectiveClauses(
      schema({ lighting: 'bright-and-airy' }),
      schema({ lighting: 'does-not-exist' }),
    )

    expect(result.error).toContain('Unknown or inactive lighting style')
    expect(result.clauses).toEqual([])
  })

  it('merges style clauses ahead of the client directive', () => {
    expect(
      mergeDirectiveWithStyleClauses('Keep the dish.', ['LIGHTING', 'BACKGROUND']),
    ).toBe('LIGHTING BACKGROUND Keep the dish.')
  })
})
