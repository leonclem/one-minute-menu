import { 
  PromptConstructionService, 
  getPromptConstructionService,
  createBasicPrompt,
  validateMenuItemForImageGeneration
} from '../prompt-construction'
import type { MenuItem, ImageGenerationParams } from '@/types'

describe('PromptConstructionService', () => {
  let service: PromptConstructionService

  beforeEach(() => {
    service = new PromptConstructionService()
  })

  describe('buildPrompt', () => {
    const sampleItem: MenuItem = {
      id: '1',
      name: 'Grilled Salmon',
      description: 'Fresh Atlantic salmon with quinoa and roasted vegetables',
      price: 24.99,
      available: true,
      category: 'Main Course',
      order: 0,
      imageSource: 'none'
    }

    it('should build prompt with modern style', () => {
      const params: ImageGenerationParams = {
        style: 'modern',
        presentation: 'white_plate'
      }

      const result = service.buildPrompt(sampleItem, params)

      expect(result.prompt).toContain('Grilled Salmon')
      expect(result.prompt).toContain('Fresh Atlantic salmon with quinoa and roasted vegetables')
      expect(result.prompt).toContain('clean modern presentation')
      expect(result.prompt).toContain('white plate')
      expect(result.prompt).toContain('professional photography')
      expect(result.appliedTemplate).toBe('modern')
      expect(result.truncated).toBe(false)
    })

    it('should build prompt with rustic style', () => {
      const params: ImageGenerationParams = {
        style: 'rustic',
        presentation: 'wooden_board',
        lighting: 'warm'
      }

      const result = service.buildPrompt(sampleItem, params)

      expect(result.prompt).toContain('Rustic food photography')
      expect(result.prompt).toContain('wooden')
      expect(result.prompt).toContain('warm')
      expect(result.appliedTemplate).toBe('rustic')
    })

    it('should build prompt with elegant style', () => {
      const params: ImageGenerationParams = {
        style: 'elegant',
        presentation: 'overhead',
        lighting: 'studio'
      }

      const result = service.buildPrompt(sampleItem, params)

      expect(result.prompt).toContain('Fine dining photography')
      expect(result.prompt).toContain('elegant restaurant presentation')
      expect(result.prompt).toContain('overhead view')
      expect(result.prompt).toContain('studio lighting')
      expect(result.appliedTemplate).toBe('elegant')
    })

    it('should build prompt with casual style', () => {
      const params: ImageGenerationParams = {
        style: 'casual',
        presentation: 'closeup',
        lighting: 'natural'
      }

      const result = service.buildPrompt(sampleItem, params)

      expect(result.prompt).toContain('Casual food photography')
      expect(result.prompt).toContain('approachable presentation')
      expect(result.prompt).toContain('close-up')
      expect(result.prompt).toContain('natural daylight')
      expect(result.appliedTemplate).toBe('casual')
    })

    it('should handle custom prompt additions', () => {
      const params: ImageGenerationParams = {
        style: 'modern',
        customPromptAdditions: 'garnished with fresh herbs, drizzled with olive oil'
      }

      const result = service.buildPrompt(sampleItem, params)

      expect(result.prompt).toContain('garnished with fresh herbs')
      expect(result.prompt).toContain('drizzled with olive oil')
    })

    it('should handle items without description', () => {
      const itemWithoutDescription: MenuItem = {
        ...sampleItem,
        description: undefined
      }

      const params: ImageGenerationParams = { style: 'modern' }
      const result = service.buildPrompt(itemWithoutDescription, params)

      expect(result.prompt).toContain('Grilled Salmon')
      expect(result.prompt).not.toContain('undefined')
      expect(result.prompt).not.toContain('null')
    })

    it('should truncate very long prompts', () => {
      const longDescription = 'A'.repeat(2000)
      const longItem: MenuItem = {
        ...sampleItem,
        description: longDescription
      }

      const params: ImageGenerationParams = {
        style: 'modern',
        customPromptAdditions: 'B'.repeat(500)
      }

      const result = service.buildPrompt(longItem, params)

      expect(result.truncated).toBe(true)
      expect(result.prompt.length).toBeLessThan(1900)
      expect(result.prompt).toContain('Grilled Salmon') // Should preserve item name
    })

    it('should estimate token count', () => {
      const params: ImageGenerationParams = { style: 'modern' }
      const result = service.buildPrompt(sampleItem, params)

      expect(result.tokens).toBeGreaterThan(0)
      expect(typeof result.tokens).toBe('number')
    })

    it('should default to modern style for unknown styles', () => {
      const params: ImageGenerationParams = {
        style: 'unknown-style' as any
      }

      const result = service.buildPrompt(sampleItem, params)

      expect(result.appliedTemplate).toBe('modern')
      expect(result.prompt).toContain('clean modern presentation')
    })
  })

  describe('buildNegativePrompt', () => {
    it('should build negative prompt with defaults', () => {
      const params: ImageGenerationParams = { style: 'modern' }
      const template = service.getPromptTemplate('modern')

      const result = service.buildNegativePrompt(params, template)

      expect(result).toContain('text')
      expect(result).toContain('watermark')
      expect(result).toContain('people')
      expect(result).toContain('blurry')
      expect(result).toContain('low quality')
    })

    it('should include custom negative prompt', () => {
      const params: ImageGenerationParams = {
        style: 'modern',
        negativePrompt: 'no utensils, no hands'
      }
      const template = service.getPromptTemplate('modern')

      const result = service.buildNegativePrompt(params, template)

      expect(result).toContain('no utensils')
      expect(result).toContain('no hands')
      expect(result).toContain('text') // Should still include defaults
    })

    it('should remove duplicates from negative prompt', () => {
      const params: ImageGenerationParams = {
        style: 'modern',
        negativePrompt: 'text, blurry, text' // Duplicate 'text'
      }
      const template = service.getPromptTemplate('modern')

      const result = service.buildNegativePrompt(params, template)

      const textMatches = (result.match(/\btext\b/g) || []).length
      expect(textMatches).toBe(1) // Should appear only once
    })

    it('should handle empty custom negative prompt', () => {
      const params: ImageGenerationParams = {
        style: 'modern',
        negativePrompt: '   ' // Only whitespace
      }
      const template = service.getPromptTemplate('modern')

      const result = service.buildNegativePrompt(params, template)

      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('text')
    })
  })

  describe('validatePrompt', () => {
    it('should validate a good prompt', () => {
      const goodPrompt = 'Professional food photography of grilled salmon with quinoa and roasted vegetables, served on white plate, natural lighting, high quality'

      const result = service.validatePrompt(goodPrompt)

      expect(result.valid).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.estimatedQuality).toBe('high')
    })

    it('should warn about short prompts', () => {
      const shortPrompt = 'Salmon'

      const result = service.validatePrompt(shortPrompt)

      expect(result.valid).toBe(false)
      expect(result.warnings).toContain('Prompt is very short')
      expect(result.suggestions).toContain('Add more descriptive details about the dish')
      expect(result.estimatedQuality).toBe('low')
    })

    it('should warn about long prompts', () => {
      const longPrompt = 'A'.repeat(1600)

      const result = service.validatePrompt(longPrompt)

      expect(result.warnings).toContain('Prompt is quite long and may be truncated')
      expect(result.suggestions).toContain('Consider shortening the description')
    })

    it('should detect vague terms', () => {
      const vaguePrompt = 'Delicious amazing food that tastes great and looks nice'

      const result = service.validatePrompt(vaguePrompt)

      expect(result.warnings).toContain('Contains vague descriptive terms')
      expect(result.suggestions).toContain('Replace subjective terms with specific visual details')
    })

    it('should recognize visual details', () => {
      const visualPrompt = 'Golden brown crispy chicken with fresh herbs and colorful roasted vegetables'

      const result = service.validatePrompt(visualPrompt)

      expect(result.estimatedQuality).toBe('high')
    })

    it('should suggest adding ingredients', () => {
      const simplePrompt = 'Grilled salmon on plate'

      const result = service.validatePrompt(simplePrompt)

      expect(result.suggestions).toContain('Consider mentioning key ingredients or accompaniments')
    })
  })

  describe('suggestImprovements', () => {
    it('should suggest adding details for vague prompts', () => {
      const vaguePrompt = 'Good food'

      const suggestions = service.suggestImprovements(vaguePrompt)

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'add_detail',
            message: expect.stringContaining('specific visual details')
          })
        ])
      )
    })

    it('should suggest improving specificity', () => {
      const genericPrompt = 'Pasta dish on table'

      const suggestions = service.suggestImprovements(genericPrompt)

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'improve_specificity',
            message: expect.stringContaining('colors, textures, or cooking methods')
          })
        ])
      )
    })

    it('should suggest negative prompt improvements', () => {
      const basicPrompt = 'Salmon dish'

      const suggestions = service.suggestImprovements(basicPrompt)

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'add_negative',
            message: expect.stringContaining('quality modifiers to negative prompt')
          })
        ])
      )
    })

    it('should provide examples with suggestions', () => {
      const simplePrompt = 'Pasta'

      const suggestions = service.suggestImprovements(simplePrompt)

      const detailSuggestion = suggestions.find(s => s.type === 'add_detail')
      expect(detailSuggestion?.example).toBeDefined()
      expect(detailSuggestion?.example).toContain('creamy fettuccine')
    })
  })

  describe('getPromptTemplate', () => {
    it('should return correct template for each style', () => {
      const modernTemplate = service.getPromptTemplate('modern')
      expect(modernTemplate.id).toBe('modern')
      expect(modernTemplate.name).toBe('Modern')

      const rusticTemplate = service.getPromptTemplate('rustic')
      expect(rusticTemplate.id).toBe('rustic')
      expect(rusticTemplate.name).toBe('Rustic')

      const elegantTemplate = service.getPromptTemplate('elegant')
      expect(elegantTemplate.id).toBe('elegant')
      expect(elegantTemplate.name).toBe('Elegant')

      const casualTemplate = service.getPromptTemplate('casual')
      expect(casualTemplate.id).toBe('casual')
      expect(casualTemplate.name).toBe('Casual')
    })

    it('should return modern template for unknown style', () => {
      const unknownTemplate = service.getPromptTemplate('unknown')
      expect(unknownTemplate.id).toBe('modern')
    })
  })

  describe('getAllTemplates', () => {
    it('should return all available templates', () => {
      const templates = service.getAllTemplates()

      expect(templates).toHaveLength(4)
      expect(templates.map(t => t.id)).toEqual(
        expect.arrayContaining(['modern', 'rustic', 'elegant', 'casual'])
      )
    })
  })
})

describe('getPromptConstructionService', () => {
  it('should return singleton instance', () => {
    const service1 = getPromptConstructionService()
    const service2 = getPromptConstructionService()

    expect(service1).toBe(service2)
    expect(service1).toBeInstanceOf(PromptConstructionService)
  })
})

describe('createBasicPrompt', () => {
  const sampleItem: MenuItem = {
    id: '1',
    name: 'Caesar Salad',
    description: 'Fresh romaine lettuce with parmesan cheese and croutons',
    price: 12.99,
    available: true,
    category: 'Salads',
    order: 0,
    imageSource: 'none'
  }

  it('should create basic prompt with default modern style', () => {
    const prompt = createBasicPrompt(sampleItem)

    expect(prompt).toContain('Caesar Salad')
    expect(prompt).toContain('romaine lettuce')
    expect(prompt).toContain('modern presentation')
    expect(prompt).toContain('professional photography')
  })

  it('should create basic prompt with specified style', () => {
    const prompt = createBasicPrompt(sampleItem, 'rustic')

    expect(prompt).toContain('Caesar Salad')
    expect(prompt).toContain('Rustic food photography')
    expect(prompt).toContain('wooden table')
  })
})

describe('validateMenuItemForImageGeneration', () => {
  it('should validate suitable menu item', () => {
    const goodItem: MenuItem = {
      id: '1',
      name: 'Grilled Chicken Breast',
      description: 'Herb-crusted chicken breast with roasted vegetables and garlic mashed potatoes',
      price: 18.99,
      available: true,
      category: 'Main Course',
      order: 0,
      imageSource: 'none'
    }

    const result = validateMenuItemForImageGeneration(goodItem)

    expect(result.suitable).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('should reject item without name', () => {
    const noNameItem: MenuItem = {
      id: '1',
      name: '',
      description: 'Some description',
      price: 10.99,
      available: true,
      category: 'Main Course',
      order: 0,
      imageSource: 'none'
    }

    const result = validateMenuItemForImageGeneration(noNameItem)

    expect(result.suitable).toBe(false)
    expect(result.issues).toContain('Item name is required')
  })

  it('should warn about short name', () => {
    const shortNameItem: MenuItem = {
      id: '1',
      name: 'AB',
      description: 'Some description',
      price: 10.99,
      available: true,
      category: 'Main Course',
      order: 0,
      imageSource: 'none'
    }

    const result = validateMenuItemForImageGeneration(shortNameItem)

    expect(result.issues).toContain('Item name is too short')
    expect(result.suggestions).toContain('Use a more descriptive name')
  })

  it('should suggest adding description', () => {
    const noDescItem: MenuItem = {
      id: '1',
      name: 'Chicken Sandwich',
      description: undefined,
      price: 12.99,
      available: true,
      category: 'Sandwiches',
      order: 0,
      imageSource: 'none'
    }

    const result = validateMenuItemForImageGeneration(noDescItem)

    expect(result.suitable).toBe(true) // Still suitable, just suggestions
    expect(result.suggestions).toContain('Add a description to improve image quality')
    expect(result.suggestions).toContain('Include ingredients, cooking method, or presentation style')
  })

  it('should warn about short description', () => {
    const shortDescItem: MenuItem = {
      id: '1',
      name: 'Burger',
      description: 'Good food',
      price: 15.99,
      available: true,
      category: 'Burgers',
      order: 0,
      imageSource: 'none'
    }

    const result = validateMenuItemForImageGeneration(shortDescItem)

    expect(result.suggestions).toContain('Description is quite short - consider adding more details')
  })

  it('should warn about generic descriptions', () => {
    const genericDescItem: MenuItem = {
      id: '1',
      name: 'Special Dish',
      description: 'A delicious food item that is a great meal for everyone',
      price: 20.99,
      available: true,
      category: 'Specials',
      order: 0,
      imageSource: 'none'
    }

    const result = validateMenuItemForImageGeneration(genericDescItem)

    expect(result.suggestions).toContain('Replace generic terms with specific ingredients or cooking methods')
  })
})