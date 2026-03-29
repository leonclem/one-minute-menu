/**
 * Unit Tests for isCutoutFeatureEnabled
 *
 * The feature is enabled by default and disabled only via the
 * CUTOUT_GENERATION_DISABLED env var, mirroring AI_IMAGE_GENERATION_DISABLED.
 */

import { isCutoutFeatureEnabled } from '@/lib/background-removal/feature-flag'

describe('isCutoutFeatureEnabled', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.CUTOUT_GENERATION_DISABLED
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns true when CUTOUT_GENERATION_DISABLED is not set', () => {
    expect(isCutoutFeatureEnabled()).toBe(true)
  })

  it('returns false when CUTOUT_GENERATION_DISABLED is "true"', () => {
    process.env.CUTOUT_GENERATION_DISABLED = 'true'
    expect(isCutoutFeatureEnabled()).toBe(false)
  })

  it('returns true when CUTOUT_GENERATION_DISABLED is "false"', () => {
    process.env.CUTOUT_GENERATION_DISABLED = 'false'
    expect(isCutoutFeatureEnabled()).toBe(true)
  })

  it('returns true when CUTOUT_GENERATION_DISABLED is any value other than "true"', () => {
    process.env.CUTOUT_GENERATION_DISABLED = '1'
    expect(isCutoutFeatureEnabled()).toBe(true)
  })
})
