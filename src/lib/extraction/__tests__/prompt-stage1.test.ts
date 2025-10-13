/**
 * Tests for Stage 1 Extraction Prompt Template
 */

import {
  buildStage1Prompt,
  getSystemRole,
  getTemperature,
  getPromptVersion,
  getPromptPackage,
  validatePromptOptions,
  getCurrencyFromLocation,
  getSupportedCurrencies,
  isSupportedCurrency,
  getCurrencyInfo,
  PROMPT_VERSION,
  PROMPT_TEMPERATURE,
  DEFAULT_CURRENCY,
  type PromptOptions
} from '../prompt-stage1'

describe('Stage 1 Prompt Template', () => {
  describe('buildStage1Prompt', () => {
    it('should build a complete prompt with default options', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('CRITICAL RULES')
      expect(prompt).toContain('EXTRACTION GUIDELINES')
      expect(prompt).toContain('Currency Detection')
      expect(prompt).toContain('OUTPUT SCHEMA')
      expect(prompt).toContain('EXAMPLE OUTPUT')
      expect(prompt).toContain('FINAL OUTPUT FORMAT')
    })

    it('should include schema in prompt', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('menu')
      expect(prompt).toContain('categories')
      expect(prompt).toContain('uncertainItems')
      expect(prompt).toContain('superfluousText')
    })

    it('should include confidence scoring instructions', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('Confidence Scoring Logic')
      expect(prompt).toContain('0.9-1.0')
      expect(prompt).toContain('0.7-0.8')
      expect(prompt).toContain('0.5-0.6')
    })

    it('should include uncertain items handling', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('Uncertain Items')
      expect(prompt).toContain('suggestedCategory')
      expect(prompt).toContain('suggestedPrice')
    })

    it('should include superfluous text handling', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('Superfluous Text')
      expect(prompt).toContain('decorative or non-menu text')
    })

    it('should exclude examples when includeExamples is false', () => {
      const prompt = buildStage1Prompt({ includeExamples: false })
      
      expect(prompt).not.toContain('EXAMPLE OUTPUT')
      expect(prompt).not.toContain('BAR BITES')
    })

    it('should include examples when includeExamples is true', () => {
      const prompt = buildStage1Prompt({ includeExamples: true })
      
      expect(prompt).toContain('EXAMPLE OUTPUT')
    })

    it('should use currency override when provided', () => {
      const prompt = buildStage1Prompt({ currencyOverride: 'USD' })
      
      expect(prompt).toContain('USD')
    })

    it('should include custom instructions when provided', () => {
      const customInstructions = 'Focus on extracting vegetarian items'
      const prompt = buildStage1Prompt({ customInstructions })
      
      expect(prompt).toContain('ADDITIONAL INSTRUCTIONS')
      expect(prompt).toContain(customInstructions)
    })
  })

  describe('getSystemRole', () => {
    it('should return system role string', () => {
      const role = getSystemRole()
      
      expect(role).toBeTruthy()
      expect(role).toContain('expert data extraction assistant')
      expect(role).toContain('food and beverage menus')
    })
  })

  describe('getTemperature', () => {
    it('should return temperature of 0 for deterministic extraction', () => {
      const temperature = getTemperature()
      
      expect(temperature).toBe(0)
      expect(temperature).toBe(PROMPT_TEMPERATURE)
    })
  })

  describe('getPromptVersion', () => {
    it('should return prompt version v1.0', () => {
      const version = getPromptVersion()
      
      expect(version).toBe('v1.0')
      expect(version).toBe(PROMPT_VERSION)
    })
  })

  describe('getPromptPackage', () => {
    it('should return complete prompt package', () => {
      const pkg = getPromptPackage()
      
      expect(pkg).toHaveProperty('systemRole')
      expect(pkg).toHaveProperty('userPrompt')
      expect(pkg).toHaveProperty('temperature')
      expect(pkg).toHaveProperty('version')
      expect(pkg).toHaveProperty('schemaVersion')
      
      expect(pkg.temperature).toBe(0)
      expect(pkg.version).toBe('v1.0')
      expect(pkg.schemaVersion).toBe('stage1')
    })

    it('should pass options to prompt builder', () => {
      const pkg = getPromptPackage({ includeExamples: false })
      
      expect(pkg.userPrompt).not.toContain('EXAMPLE OUTPUT')
    })
  })

  describe('validatePromptOptions', () => {
    it('should validate valid options', () => {
      const options: PromptOptions = {
        currencyOverride: 'SGD',
        includeExamples: true
      }
      
      const result = validatePromptOptions(options)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid currency override', () => {
      const options: PromptOptions = {
        currencyOverride: 'INVALID' as any
      }
      
      const result = validatePromptOptions(options)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid currency override: INVALID')
    })

    it('should reject custom instructions that are too long', () => {
      const options: PromptOptions = {
        customInstructions: 'x'.repeat(1001)
      }
      
      const result = validatePromptOptions(options)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('getCurrencyFromLocation', () => {
    it('should return SGD for Singapore', () => {
      expect(getCurrencyFromLocation('SG')).toBe('SGD')
      expect(getCurrencyFromLocation('sg')).toBe('SGD')
    })

    it('should return USD for United States', () => {
      expect(getCurrencyFromLocation('US')).toBe('USD')
    })

    it('should return MYR for Malaysia', () => {
      expect(getCurrencyFromLocation('MY')).toBe('MYR')
    })

    it('should return default currency for unknown location', () => {
      expect(getCurrencyFromLocation('XX')).toBe(DEFAULT_CURRENCY)
    })

    it('should return default currency when no location provided', () => {
      expect(getCurrencyFromLocation()).toBe(DEFAULT_CURRENCY)
    })
  })

  describe('getSupportedCurrencies', () => {
    it('should return array of supported currencies', () => {
      const currencies = getSupportedCurrencies()
      
      expect(Array.isArray(currencies)).toBe(true)
      expect(currencies.length).toBeGreaterThan(0)
      expect(currencies).toContain('SGD')
      expect(currencies).toContain('USD')
      expect(currencies).toContain('MYR')
    })
  })

  describe('isSupportedCurrency', () => {
    it('should return true for supported currencies', () => {
      expect(isSupportedCurrency('SGD')).toBe(true)
      expect(isSupportedCurrency('USD')).toBe(true)
      expect(isSupportedCurrency('MYR')).toBe(true)
      expect(isSupportedCurrency('EUR')).toBe(true)
    })

    it('should return false for unsupported currencies', () => {
      expect(isSupportedCurrency('INVALID')).toBe(false)
      expect(isSupportedCurrency('XXX')).toBe(false)
    })
  })

  describe('getCurrencyInfo', () => {
    it('should return currency info for SGD', () => {
      const info = getCurrencyInfo('SGD')
      
      expect(info).toHaveProperty('symbols')
      expect(info).toHaveProperty('name')
      expect(info.name).toBe('Singapore Dollar')
      expect(info.symbols).toContain('S$')
    })

    it('should return currency info for USD', () => {
      const info = getCurrencyInfo('USD')
      
      expect(info.name).toBe('US Dollar')
      expect(info.symbols).toContain('$')
    })

    it('should return currency info for MYR', () => {
      const info = getCurrencyInfo('MYR')
      
      expect(info.name).toBe('Malaysian Ringgit')
      expect(info.symbols).toContain('RM')
    })
  })

  describe('Currency Detection Instructions', () => {
    it('should include all supported currencies in prompt', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('SGD')
      expect(prompt).toContain('USD')
      expect(prompt).toContain('MYR')
      expect(prompt).toContain('EUR')
      expect(prompt).toContain('JPY')
    })

    it('should include currency symbols in prompt', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('S$')
      expect(prompt).toContain('RM')
      expect(prompt).toContain('฿')
    })

    it('should specify fallback currency', () => {
      const prompt = buildStage1Prompt({ currencyOverride: 'USD' })
      
      expect(prompt).toContain('default to: USD')
    })
  })

  describe('Prompt Structure', () => {
    it('should instruct to return only JSON', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('Return ONLY valid JSON')
      expect(prompt).toContain('no commentary')
      expect(prompt).toContain('no markdown')
    })

    it('should instruct not to fabricate data', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('Do NOT fabricate data')
      expect(prompt).toContain('if uncertain')
    })

    it('should include hierarchical structure instructions', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('hierarchical structure')
      expect(prompt).toContain('categories')
      expect(prompt).toContain('subcategories')
    })

    it('should instruct to strip currency symbols', () => {
      const prompt = buildStage1Prompt()
      
      expect(prompt).toContain('Strip currency symbols')
      expect(prompt).toContain('numeric values only')
    })
  })
})
