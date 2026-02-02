import { getItemDailyGenerationLimit } from '@/lib/image-generation-limits'

describe('getItemDailyGenerationLimit', () => {
  it('returns the expected limits by plan', () => {
    expect(getItemDailyGenerationLimit('free')).toBe(20)
    expect(getItemDailyGenerationLimit('grid_plus')).toBe(100)
    expect(getItemDailyGenerationLimit('grid_plus_premium')).toBe(250)
    // legacy mapping
    expect(getItemDailyGenerationLimit('premium')).toBe(100)
    expect(getItemDailyGenerationLimit('enterprise')).toBe(250)
  })

  it('treats admins as effectively unlimited', () => {
    expect(getItemDailyGenerationLimit('free', 'admin')).toBeGreaterThan(1000)
  })
})

