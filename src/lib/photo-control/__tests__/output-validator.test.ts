/**
 * @jest-environment node
 */

import {
  looselyMatches,
  scoreOutputAgainstExpected,
} from '@/lib/photo-control/output-validator'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'

function schema(partial: {
  main_item?: string
  garnishes?: string[]
  sides?: string[]
  main_vessel?: string
  lighting?: string
  framing?: MinimalSchema['scene_setup']['framing']
  angle?: MinimalSchema['scene_setup']['angle']
  spin?: MinimalSchema['scene_setup']['spin']
  background?: string
  backgroundStyle?: string
  surfaceStyle?: string
} = {}): MinimalSchema {
  return {
    scene_setup: {
      angle: partial.angle ?? '45-degree',
      framing: partial.framing ?? 'close-up',
      lighting: partial.lighting ?? 'bright-and-airy',
      spin: partial.spin ?? '0',
    },
    canvas: {
      background: partial.background ?? 'white table',
      background_style: partial.backgroundStyle ?? '',
      surface_style: partial.surfaceStyle ?? '',
      main_vessel: partial.main_vessel ?? 'white plate',
    },
    food_components: {
      main_item: partial.main_item ?? 'burger',
      garnishes: partial.garnishes ?? [],
      sides: partial.sides ?? [],
    },
  }
}

describe('output-validator', () => {
  describe('looselyMatches', () => {
    it('matches equal and substring forms', () => {
      expect(looselyMatches('Beef Burger', 'beef burger')).toBe(true)
      expect(looselyMatches('burger', 'Smash Burger')).toBe(true)
      expect(looselyMatches('Smash Burger', 'burger')).toBe(true)
      expect(looselyMatches('burger', 'pasta')).toBe(false)
      expect(looselyMatches('', 'burger')).toBe(false)
    })
  })

  it('passes when schemas align', () => {
    const expected = schema({
      main_item: 'Cheeseburger',
      garnishes: ['lettuce'],
      sides: ['fries'],
      main_vessel: 'ceramic plate',
      lighting: 'low-key',
    })
    const actual = schema({
      main_item: 'cheeseburger',
      garnishes: ['lettuce'],
      sides: ['fries'],
      main_vessel: 'white ceramic plate',
      lighting: 'low-key',
    })
    const result = scoreOutputAgainstExpected(expected, actual)
    expect(result.status).toBe('pass')
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.dimensions.find((d) => d.id === 'dish_identity')?.status).toBe('pass')
  })

  it('fails on main item mismatch', () => {
    const result = scoreOutputAgainstExpected(
      schema({ main_item: 'burger' }),
      schema({ main_item: 'sushi platter' }),
    )
    expect(result.status).toBe('fail')
    expect(result.dimensions.find((d) => d.id === 'dish_identity')?.status).toBe('fail')
  })

  it('warns when vessel wording diverges', () => {
    const result = scoreOutputAgainstExpected(
      schema({ main_vessel: 'shallow bowl' }),
      schema({ main_vessel: 'wooden board' }),
    )
    expect(result.dimensions.find((d) => d.id === 'vessel')?.status).toBe('warn')
    expect(['warn', 'fail']).toContain(result.status)
  })

  it('fails when garnish/side counts drift far', () => {
    const result = scoreOutputAgainstExpected(
      schema({ garnishes: ['parsley'], sides: [] }),
      schema({ garnishes: ['parsley', 'cilantro', 'microgreens'], sides: ['fries'] }),
    )
    expect(result.dimensions.find((d) => d.id === 'item_count')?.status).toBe('fail')
    expect(result.status).toBe('fail')
  })

  it('compares custom database lighting keys when the extract has a value', () => {
    const matching = scoreOutputAgainstExpected(
      schema({ lighting: 'warm-restaurant-ambient' }),
      schema({ lighting: 'warm-restaurant-ambient' }),
      ['lighting'],
    )
    expect(matching.dimensions.find((d) => d.id === 'lighting')?.status).toBe('pass')

    const missing = scoreOutputAgainstExpected(
      schema({ lighting: 'warm-restaurant-ambient' }),
      schema({ lighting: '' }),
      ['lighting'],
    )
    expect(missing.dimensions.find((d) => d.id === 'lighting')?.status).toBe('not_evaluated')
  })

  it('evaluates angle, spin, backdrop, and surface as requested dimensions', () => {
    const expected = schema({
      angle: 'eye-level',
      spin: 'left-45',
      lighting: 'db-style-studio',
      backgroundStyle: 'studio-yellow',
      surfaceStyle: 'dark-slate',
    })
    const actual = schema({
      angle: 'eye-level',
      spin: 'left-45',
      lighting: 'db-style-studio',
      background: 'vibrant solid yellow studio backdrop',
      surfaceStyle: 'dark slate stone tabletop',
    })
    const result = scoreOutputAgainstExpected(
      expected,
      actual,
      ['angle', 'spin', 'lighting', 'background_style', 'surface_style'],
      {
        background_style: { material: 'vibrant solid yellow studio backdrop', colour: '#F2C200' },
        surface_style: { material: 'dark slate stone', colour: '#2E3338' },
      },
    )

    for (const id of ['angle', 'spin', 'lighting', 'background_style', 'surface_style']) {
      expect(result.dimensions.find((dimension) => dimension.id === id)?.status).toBe('pass')
    }
  })

  it('warns rather than fails when requested style descriptions differ', () => {
    const result = scoreOutputAgainstExpected(
      schema({ backgroundStyle: 'studio-yellow', surfaceStyle: 'dark-slate' }),
      schema({ background: 'blue painted wall', surfaceStyle: 'polished white marble' }),
      ['background_style', 'surface_style'],
      {
        background_style: { material: 'vibrant solid yellow studio backdrop', colour: '#F2C200' },
        surface_style: { material: 'dark slate stone', colour: '#2E3338' },
      },
    )

    expect(result.dimensions.find((dimension) => dimension.id === 'background_style')?.status).toBe(
      'warn',
    )
    expect(result.dimensions.find((dimension) => dimension.id === 'surface_style')?.status).toBe(
      'warn',
    )
  })

  it('fails exact angle and spin mismatches', () => {
    const result = scoreOutputAgainstExpected(
      schema({ angle: 'eye-level', spin: 'left-45' }),
      schema({ angle: 'top-down', spin: 'right-45' }),
      ['angle', 'spin'],
    )

    expect(result.dimensions.find((dimension) => dimension.id === 'angle')?.status).toBe('fail')
    expect(result.dimensions.find((dimension) => dimension.id === 'spin')?.status).toBe('fail')
    expect(result.status).toBe('fail')
  })

  it('marks requested dimensions without comparable output signals as not_evaluated', () => {
    const expected = schema({
      angle: 'eye-level',
      spin: 'left-45',
      lighting: 'db-style-studio',
      backgroundStyle: 'studio-yellow',
      surfaceStyle: 'dark-slate',
    })
    const actual = schema({ angle: 'eye-level', spin: 'left-45', lighting: '', background: '' })
    ;(actual.scene_setup as unknown as { angle: string; spin: string }).angle = ''
    ;(actual.scene_setup as unknown as { angle: string; spin: string }).spin = ''
    const result = scoreOutputAgainstExpected(
      expected,
      actual,
      ['angle', 'spin', 'lighting', 'background_style', 'surface_style'],
    )

    for (const id of ['angle', 'spin', 'lighting', 'background_style', 'surface_style']) {
      expect(result.dimensions.find((dimension) => dimension.id === id)?.status).toBe(
        'not_evaluated',
      )
    }
  })

  it('downgrades unassessed staged dimensions and names each one in the summary', () => {
    const expected = schema({
      lighting: 'db-style-studio',
      backgroundStyle: 'studio-yellow',
      surfaceStyle: 'dark-slate',
    })
    const actual = schema({ lighting: '' })
    const stagedFields = ['lighting', 'background_style', 'surface_style'] as const
    const result = scoreOutputAgainstExpected(expected, actual, stagedFields)

    expect(result.status).toBe('warn')
    for (const field of stagedFields) expect(result.summary).toContain(field)
  })

  it('keeps an evaluated failure above the staged not_evaluated downgrade', () => {
    const expected = schema({ lighting: 'db-style-studio' })
    const actual = schema({ main_item: 'sushi', lighting: '' })
    const result = scoreOutputAgainstExpected(expected, actual, ['lighting'])

    expect(result.status).toBe('fail')
    expect(result.summary).toContain('lighting')
  })

  it('handles empty expected main item as not_evaluated for identity', () => {
    const result = scoreOutputAgainstExpected(
      schema({ main_item: '' }),
      schema({ main_item: 'burger' }),
    )
    expect(result.dimensions.find((d) => d.id === 'dish_identity')?.status).toBe(
      'not_evaluated',
    )
  })

  it('does not downgrade an ordinary validation when no staged fields are supplied', () => {
    const result = scoreOutputAgainstExpected(schema(), schema(), [])
    expect(result.status).toBe('pass')
    expect(result.summary).toBe('Output looks consistent with the requested dish state.')
  })
})
