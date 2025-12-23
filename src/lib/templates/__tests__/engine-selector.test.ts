/**
 * Tests for Engine Selector
 * 
 * Verifies the V1/V2 switching mechanism works correctly.
 */

import { 
  getEngineVersion, 
  generateLayoutWithVersion,
  isV2Input,
  isV2Output,
  getEngineInfo,
  type EngineVersion 
} from '../engine-selector'

// Mock the environment variable
const originalEnv = process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION

describe('Engine Selector', () => {
  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION = originalEnv
    } else {
      delete process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION
    }
  })

  describe('getEngineVersion', () => {
    it('returns v1 by default when env var not set', () => {
      delete process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION
      expect(getEngineVersion()).toBe('v1')
    })

    it('returns v1 when env var is v1', () => {
      process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION = 'v1'
      expect(getEngineVersion()).toBe('v1')
    })

    it('returns v2 when env var is v2', () => {
      process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION = 'v2'
      expect(getEngineVersion()).toBe('v2')
    })

    it('returns v1 for invalid env var values', () => {
      process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION = 'invalid'
      expect(getEngineVersion()).toBe('v1')
    })
  })

  describe('Type Guards', () => {
    it('isV2Input correctly identifies V2 input format', () => {
      const v1Input = {
        menu: {} as any,
        template: {} as any
      }
      
      const v2Input = {
        menu: {} as any,
        templateId: 'classic-cards-v2'
      }

      expect(isV2Input(v1Input)).toBe(false)
      expect(isV2Input(v2Input)).toBe(true)
    })

    it('isV2Output correctly identifies V2 output format', () => {
      const v1Output = {
        template: {} as any,
        pages: []
      }
      
      const v2Output = {
        templateId: 'classic-cards-v2',
        pages: []
      }

      expect(isV2Output(v1Output)).toBe(false)
      expect(isV2Output(v2Output)).toBe(true)
    })
  })

  describe('getEngineInfo', () => {
    it('returns correct engine information', () => {
      process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION = 'v2'
      
      const info = getEngineInfo()
      
      expect(info.currentVersion).toBe('v2')
      expect(info.envVariable).toBe('v2')
      expect(info.defaultVersion).toBe('v1')
    })

    it('handles undefined env variable', () => {
      delete process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION
      
      const info = getEngineInfo()
      
      expect(info.currentVersion).toBe('v1')
      expect(info.envVariable).toBe('undefined')
      expect(info.defaultVersion).toBe('v1')
    })
  })
})