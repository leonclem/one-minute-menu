export type HeroCompareCursor = {
  dishIndex: number
  variantIndex: number
  /**
   * intro-shown: the next tick switches to the other dish.
   * stepping: walk the rest of this dish's variants, then switch.
   */
  phase: 'intro-shown' | 'stepping'
}

export const HERO_COMPARE_START: HeroCompareCursor = {
  dishIndex: 0,
  variantIndex: 0,
  phase: 'intro-shown',
}

type DishLike = { variants: ReadonlyArray<unknown> }

/**
 * Alternate to the other dish, then step through that dish's variants,
 * then alternate back. Variant counts can differ per dish.
 */
export function nextHeroCompareCursor(
  dishes: ReadonlyArray<DishLike>,
  cursor: HeroCompareCursor,
): HeroCompareCursor {
  if (dishes.length === 0) return cursor

  const dishIndex = clampIndex(cursor.dishIndex, dishes.length)
  const variantCount = Math.max(dishes[dishIndex]?.variants.length ?? 0, 1)
  const variantIndex = clampIndex(cursor.variantIndex, variantCount)
  const hasAnotherVariant = cursor.phase === 'stepping' && variantIndex < variantCount - 1

  if (hasAnotherVariant) {
    return { dishIndex, variantIndex: variantIndex + 1, phase: 'stepping' }
  }

  return {
    dishIndex: (dishIndex + 1) % dishes.length,
    variantIndex: 0,
    phase: 'stepping',
  }
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}
