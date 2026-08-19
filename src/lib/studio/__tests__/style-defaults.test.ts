import { resolveReshootStyleDefaults } from '../style-defaults'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { ExtractionDiagnostics } from '@/lib/studio/extraction-diagnostics'

function schema(overrides: Partial<MinimalSchema['canvas']> = {}): MinimalSchema {
  return {
    scene_setup: {
      angle: '45-degree',
      framing: 'close-up',
      lighting: 'golden-hour',
      spin: '0',
    },
    canvas: {
      background: '',
      background_style: '',
      surface_style: '',
      main_vessel: 'bowl',
      ...overrides,
    },
    food_components: {
      main_item: 'dish',
      garnishes: [],
      sides: [],
    },
  }
}

describe('resolveReshootStyleDefaults', () => {
  it('prefers current editor state values', () => {
    const result = resolveReshootStyleDefaults(
      schema({ background_style: 'studio-red', surface_style: 'dark-slate' }),
      null,
    )
    expect(result).toEqual({
      lighting: 'golden-hour',
      backdrop: 'studio-red',
      surface: 'dark-slate',
    })
  })

  it('maps observed material keywords when editor state is empty', () => {
    const diagnostics = {
      version: 2,
      strictConformance: true,
      warnings: [],
      omittedFields: [],
      observations: {
        backdrop: { material: 'dark slate wall' },
        surface: { material: 'rustic wooden table' },
      },
    } as ExtractionDiagnostics

    const result = resolveReshootStyleDefaults(schema(), diagnostics)
    expect(result.backdrop).toBe('dark-slate')
    expect(result.surface).toBe('rustic-wood')
  })

  it('falls back to defined defaults when nothing else matches', () => {
    const result = resolveReshootStyleDefaults(schema(), null)
    expect(result).toEqual({
      lighting: 'golden-hour',
      backdrop: 'studio-grey-white',
      surface: 'white-tablecloth',
    })
  })
})
