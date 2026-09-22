import { HERO_COMPARE_DISHES } from './dishes'
import { HERO_COMPARE_START, nextHeroCompareCursor, type HeroCompareCursor } from './cycle'

function labels(dishes: ReadonlyArray<{ name: string; variants: ReadonlyArray<{ label: string }> }>, steps: number) {
  const seen: string[] = []
  let cursor: HeroCompareCursor = HERO_COMPARE_START
  seen.push(labelAt(dishes, cursor))
  for (let i = 0; i < steps; i += 1) {
    cursor = nextHeroCompareCursor(dishes, cursor)
    seen.push(labelAt(dishes, cursor))
  }
  return seen
}

function labelAt(
  dishes: ReadonlyArray<{ name: string; variants: ReadonlyArray<{ label: string }> }>,
  cursor: HeroCompareCursor,
) {
  const dish = dishes[cursor.dishIndex]
  return `${dish.name} / ${dish.variants[cursor.variantIndex].label}`
}

describe('nextHeroCompareCursor', () => {
  it('alternates dishes, then steps through each dish’s variants', () => {
    expect(labels(HERO_COMPARE_DISHES, 6)).toEqual([
      'Massaman Curry / Slate',
      'Banana Bread / Hot',
      'Banana Bread / Overhead',
      'Banana Bread / Rotated',
      'Massaman Curry / Slate',
      'Massaman Curry / Fresh',
      'Massaman Curry / Moody',
    ])
  })

  it('follows each dish’s own variant count when a dish is added', () => {
    const dishes = [
      { name: 'Soup', variants: [{ label: 'Bright' }] },
      { name: 'Salad', variants: [{ label: 'Day' }, { label: 'Night' }] },
      ...HERO_COMPARE_DISHES,
    ]

    expect(labels(dishes, 4)).toEqual([
      'Soup / Bright',
      'Salad / Day',
      'Salad / Night',
      'Massaman Curry / Slate',
      'Massaman Curry / Fresh',
    ])
  })
})
