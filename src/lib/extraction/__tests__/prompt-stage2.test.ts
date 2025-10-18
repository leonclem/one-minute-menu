/**
 * Tests for Stage 2 Extraction Prompt Template
 */

import {
  buildStage2Prompt,
  getSystemRoleV2,
  getTemperatureV2,
  getPromptVersionV2,
  getPromptPackageV2,
  PROMPT_VERSION_V2,
  PROMPT_TEMPERATURE_V2
} from '../prompt-stage2'

describe('Stage 2 Prompt Template', () => {
  describe('buildStage2Prompt', () => {
    it('should build a complete prompt with default options', () => {
      const prompt = buildStage2Prompt()

      expect(prompt).toContain('CRITICAL RULES')
      expect(prompt).toContain('EXTRACTION GUIDELINES (Stage 2)')
      expect(prompt).toContain('OUTPUT SCHEMA (Stage 2)')
      // Examples are disabled by default now (optimization)
      expect(prompt).not.toContain('EXAMPLE OUTPUT (Stage 2)')
      expect(prompt).toContain('FINAL OUTPUT FORMAT')
    })

    it('should reference Stage 2 fields in instructions', () => {
      const prompt = buildStage2Prompt()

      expect(prompt).toContain('variants')
      expect(prompt).toContain('modifierGroups')
      expect(prompt).toContain('setMenu')
      expect(prompt).toContain('additional')
    })

    it('should exclude examples when includeExamples is false', () => {
      const prompt = buildStage2Prompt({ includeExamples: false })
      expect(prompt).not.toContain('EXAMPLE OUTPUT (Stage 2)')
    })
  })

  describe('metadata helpers', () => {
    it('should return system role string', () => {
      const role = getSystemRoleV2()
      expect(role).toBeTruthy()
    })

    it('should return temperature of 0', () => {
      expect(getTemperatureV2()).toBe(0)
      expect(getTemperatureV2()).toBe(PROMPT_TEMPERATURE_V2)
    })

    it('should return prompt version v2.0', () => {
      expect(getPromptVersionV2()).toBe('v2.0')
      expect(getPromptVersionV2()).toBe(PROMPT_VERSION_V2)
    })
  })

  describe('getPromptPackageV2', () => {
    it('should return complete prompt package', () => {
      const pkg = getPromptPackageV2()
      expect(pkg).toHaveProperty('systemRole')
      expect(pkg).toHaveProperty('userPrompt')
      expect(pkg).toHaveProperty('temperature')
      expect(pkg).toHaveProperty('version')
      expect(pkg).toHaveProperty('schemaVersion')
      expect(pkg.temperature).toBe(0)
      expect(pkg.version).toBe('v2.0')
      expect(pkg.schemaVersion).toBe('stage2')
    })
  })
})


