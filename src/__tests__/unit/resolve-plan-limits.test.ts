/**
 * Unit tests for resolvePlanLimits (database.ts).
 * Ensures plan is source of truth: Grid+ never gets unlimited from stale plan_limits.
 */

import { resolvePlanLimits } from '@/lib/database'
import { PLAN_CONFIGS } from '@/types'

describe('resolvePlanLimits', () => {
  it('uses plan defaults when plan_limits is missing', () => {
    expect(resolvePlanLimits(undefined, 'free').menus).toBe(1)
    expect(resolvePlanLimits(undefined, 'grid_plus').menus).toBe(5)
    expect(resolvePlanLimits(undefined, 'grid_plus_premium').menus).toBe(-1)
  })

  it('Grid+ with stale unlimited (-1) in DB resolves to 5 menus (plan is source of truth)', () => {
    const resolved = resolvePlanLimits(
      { menus: -1, items: 500, monthly_uploads: 100, ai_image_generations: 100 },
      'grid_plus'
    )
    expect(resolved.menus).toBe(5)
    expect(resolved.menuItems).toBe(500)
  })

  it('Grid+Premium keeps unlimited when DB has -1', () => {
    const resolved = resolvePlanLimits(
      { menus: -1, items: -1, monthly_uploads: -1, ai_image_generations: 1000 },
      'grid_plus_premium'
    )
    expect(resolved.menus).toBe(-1)
    expect(resolved.menuItems).toBe(-1)
  })

  it('Free plan never gets unlimited from DB', () => {
    const resolved = resolvePlanLimits(
      { menus: -1, items: -1 },
      'free'
    )
    expect(resolved.menus).toBe(1)
    expect(resolved.menuItems).toBe(40)
  })

  it('uses DB value when plan default is finite and DB has a finite value', () => {
    const resolved = resolvePlanLimits(
      { menus: 5, items: 500 },
      'grid_plus'
    )
    expect(resolved.menus).toBe(5)
    expect(resolved.menuItems).toBe(500)
  })

  it('matches PLAN_CONFIGS for each plan when dbLimits is empty', () => {
    const plans = ['free', 'grid_plus', 'grid_plus_premium'] as const
    for (const plan of plans) {
      const resolved = resolvePlanLimits({}, plan)
      const config = PLAN_CONFIGS[plan]
      expect(resolved.menus).toBe(config.menus)
      expect(resolved.menuItems).toBe(config.menuItems)
      expect(resolved.monthlyUploads).toBe(config.monthlyUploads)
      expect(resolved.aiImageGenerations).toBe(config.aiImageGenerations)
    }
  })
})
