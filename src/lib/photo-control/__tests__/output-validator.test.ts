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
  framing?: string
  background?: string
}): MinimalSchema {
  return {
    scene_setup: {
      angle: '45-degree',
      framing: partial.framing ?? 'close-up',
      lighting: partial.lighting ?? 'bright-and-airy',
      spin: '0',
    },
    canvas: {
      background: partial.background ?? 'white table',
      background_style: '',
      surface_style: '',
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

  it('marks custom lighting keys as not_evaluated', () => {
    const result = scoreOutputAgainstExpected(
      schema({ lighting: 'warm-restaurant-ambient' }),
      schema({ lighting: 'bright-and-airy' }),
    )
    expect(result.dimensions.find((d) => d.id === 'lighting')?.status).toBe('not_evaluated')
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
})
