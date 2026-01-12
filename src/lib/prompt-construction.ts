import type { MenuItem, ImageGenerationParams } from '@/types'

// Prompt construction service for AI image generation
// Transforms menu item data into effective image generation prompts

export interface PromptResult {
  prompt: string
  negativePrompt: string
  tokens: number
  truncated: boolean
  appliedTemplate: string
}

export interface PromptValidation {
  valid: boolean
  warnings: string[]
  suggestions: string[]
  estimatedQuality: 'low' | 'medium' | 'high'
}

export interface PromptSuggestion {
  type: 'add_detail' | 'remove_vague' | 'improve_specificity' | 'add_negative'
  message: string
  example?: string
}

export interface PromptTemplate {
  id: string
  name: string
  basePrompt: string
  styleModifiers: string[]
  defaultNegativePrompt: string
  aspectRatio: string
}

// Predefined prompt templates for different styles
const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  modern: {
    id: 'modern',
    name: 'Modern',
    basePrompt: 'Professional food photography of {item_name}, {description}, clean modern presentation',
    styleModifiers: ['minimalist plating', 'bright natural lighting', 'clean white background'],
    defaultNegativePrompt: 'cluttered, messy, dark, blurry, low quality',
    aspectRatio: '1:1'
  },
  rustic: {
    id: 'rustic',
    name: 'Rustic',
    basePrompt: 'Rustic food photography of {item_name}, {description}, homestyle presentation',
    styleModifiers: ['wooden table', 'warm lighting', 'natural textures', 'cozy atmosphere'],
    defaultNegativePrompt: 'artificial, plastic, sterile, overly polished',
    aspectRatio: '1:1'
  },
  elegant: {
    id: 'elegant',
    name: 'Elegant',
    basePrompt: 'Fine dining photography of {item_name}, {description}, elegant restaurant presentation',
    styleModifiers: ['sophisticated plating', 'dramatic lighting', 'premium ingredients', 'artistic arrangement'],
    defaultNegativePrompt: 'casual, messy, cheap looking, fast food style',
    aspectRatio: '1:1'
  },
  casual: {
    id: 'casual',
    name: 'Casual',
    basePrompt: 'Casual food photography of {item_name}, {description}, approachable presentation',
    styleModifiers: ['friendly atmosphere', 'natural lighting', 'comfortable setting'],
    defaultNegativePrompt: 'formal, intimidating, overly fancy, pretentious',
    aspectRatio: '1:1'
  }
}

// Presentation style modifiers
const PRESENTATION_MODIFIERS: Record<string, string[]> = {
  white_plate: ['served on a clean white plate', 'white ceramic dishware'],
  wooden_board: ['presented on a rustic wooden board', 'natural wood serving surface'],
  overhead: ['overhead view', 'top-down perspective', 'flat lay style'],
  closeup: ['close-up shot', 'detailed view', 'macro photography style'],
  bokeh: ['shallow depth of field', 'bokeh background', 'blurred background', 'focus on the foreground']
}

// Lighting style modifiers
const LIGHTING_MODIFIERS: Record<string, string[]> = {
  warm: ['warm golden lighting', 'cozy ambient light'],
  natural: ['natural daylight', 'soft window light'],
  studio: ['professional studio lighting', 'controlled lighting setup'],
  cinematic: ['cinematic color grading', 'moody atmosphere', 'dramatic lighting', 'film aesthetic'],
  golden_hour: ['golden hour lighting', 'warm backlighting', 'long soft shadows', 'sunset atmosphere']
}

// Common negative prompt elements for food photography
const DEFAULT_NEGATIVE_ELEMENTS = [
  'text', 'watermark', 'logo', 'people', 'hands', 'utensils being used',
  'blurry', 'low quality', 'pixelated', 'overexposed', 'underexposed',
  'artificial colors', 'plastic looking', 'unappetizing'
]

export class PromptConstructionService {
  /**
   * Build a complete prompt from menu item data and style parameters
   */
  buildPrompt(item: MenuItem, params: ImageGenerationParams): PromptResult {
    const template = this.getPromptTemplate(params.style || 'modern')
    
    // Normalize and clamp description to avoid overly long or noisy prompts
    const normalizedDescription = this.normalizeDescription(item.description || '')

    // Start with base prompt
    let prompt = template.basePrompt
      .replace('{item_name}', item.name)
      .replace('{description}', normalizedDescription)
    
    // Add style modifiers from template
    const styleElements = [...template.styleModifiers]
    
    // Add category context if available to help with ambiguous item names
    if (item.category && item.category.toLowerCase() !== 'uncategorized' && item.category.toLowerCase() !== 'default') {
      styleElements.push(`from the ${item.category} category`)
    }
    
    // Add presentation modifiers
    if (params.presentation) {
      const presentationMods = PRESENTATION_MODIFIERS[params.presentation] || []
      styleElements.push(...presentationMods)
    }
    
    // Add lighting modifiers
    if (params.lighting) {
      const lightingMods = LIGHTING_MODIFIERS[params.lighting] || []
      styleElements.push(...lightingMods)
    }

    // Add establishment context
    if (params.establishmentType) {
      switch (params.establishmentType) {
        case 'bakery-dessert':
          styleElements.push('bakery display style', 'soft textures', 'tempting sweet treats', 'pastel color palette', 'warm oven lighting')
          break
        case 'hawker-foodcourt':
          styleElements.push('vibrant street food style', 'authentic local setting', 'casual presentation', 'bustling atmosphere', 'bright natural lighting')
          break
        case 'fine-dining':
          styleElements.push('elegant presentation', 'sophisticated plating', 'premium restaurant setting', 'luxury feel')
          break
        case 'experience-restaurant':
          styleElements.push('immersive dining atmosphere', 'theatrical presentation', 'unique experiential setting', 'artistic and creative plating', 'dramatic lighting')
          break
        case 'casual-dining':
          styleElements.push('relaxed atmosphere', 'approachable presentation', 'casual dining setting')
          break
        case 'cafe-brunch':
          styleElements.push('cafe setting', 'natural morning light', 'warm inviting atmosphere', 'cozy cafe background', 'brunch aesthetic')
          break
        case 'bar-pub':
          styleElements.push('moody bar lighting', 'pub atmosphere', 'social setting')
          break
        case 'quick-service':
          styleElements.push('clean presentation', 'bright lighting', 'fresh and fast')
          break
      }
    }

    // Add cuisine context
    if (params.primaryCuisine) {
      styleElements.push(`${params.primaryCuisine} cuisine style`)
      switch (params.primaryCuisine) {
        case 'local-sg':
          styleElements.push('authentic singaporean presentation', 'traditional local motifs', 'vibrant spices and herbs', 'kopitiam style elements')
          break
        case 'peranakan':
          styleElements.push('ornate nyonya ware', 'intricate presentation', 'vibrant traditional colors', 'peranakan cultural motifs')
          break
        case 'japanese':
          styleElements.push('minimalist aesthetic', 'zen presentation', 'precise arrangement', 'authentic japanese plating')
          break
        case 'italian':
          styleElements.push('rustic italian style', 'fresh Mediterranean ingredients', 'traditional presentation')
          break
        case 'korean':
          styleElements.push('modern korean aesthetic', 'vibrant banchan presentation', 'k-food styling')
          break
        case 'thai-viet':
          styleElements.push('southeast asian freshness', 'vibrant herbs', 'tropical plating style')
          break
        case 'mexican':
          styleElements.push('vibrant mexican presentation', 'authentic textures and colors', 'fresh ingredients like lime, cilantro, and chilies', 'rustic pottery or colorful ceramics')
          break
      }
    }
    
    // If description is very short or missing, add boosters to guide composition
    if (!normalizedDescription || normalizedDescription.length < 10) {
      styleElements.push('close-up shot', 'appetizing presentation', 'well-lit with natural light')
    }

    // Add custom prompt additions
    if (params.customPromptAdditions?.trim()) {
      styleElements.push(params.customPromptAdditions.trim())
    }
    
    // Combine all elements
    if (styleElements.length > 0) {
      prompt += ', ' + styleElements.join(', ')
    }
    
    // Add quality and technical parameters
    prompt += ', high quality, professional photography, appetizing, well-lit'
    
    // Build negative prompt
    const negativePrompt = this.buildNegativePrompt(params, template)
    
    // Check for truncation
    const maxLength = 1000 // Keep prompts concise to improve model focus
    let truncated = false
    if (prompt.length > maxLength) {
      prompt = this.intelligentTruncate(prompt, maxLength)
      truncated = true
    }
    
    return {
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim(),
      tokens: this.estimateTokens(prompt + negativePrompt),
      truncated,
      appliedTemplate: template.id
    }
  }
  
  /**
   * Build negative prompt from parameters and template
   */
  buildNegativePrompt(params: ImageGenerationParams, template?: PromptTemplate): string {
    const negativeElements = [...DEFAULT_NEGATIVE_ELEMENTS]
    
    // Add template-specific negative elements
    if (template) {
      negativeElements.push(...template.defaultNegativePrompt.split(', '))
    }
    
    // Add custom negative prompt
    if (params.negativePrompt?.trim()) {
      negativeElements.push(...params.negativePrompt.split(',').map(s => s.trim()))
    }
    
    // Remove duplicates and empty strings
    const uniqueElements = Array.from(new Set(negativeElements))
      .filter(element => element.trim().length > 0)
    
    return uniqueElements.join(', ')
  }
  
  /**
   * Validate a prompt and provide feedback
   */
  validatePrompt(prompt: string): PromptValidation {
    const warnings: string[] = []
    const suggestions: string[] = []
    let estimatedQuality: 'low' | 'medium' | 'high' = 'medium'
    
    // Check prompt length
    if (prompt.length < 20) {
      warnings.push('Prompt is very short')
      suggestions.push('Add more descriptive details about the dish')
      estimatedQuality = 'low'
    }
    
    if (prompt.length > 1500) {
      warnings.push('Prompt is quite long and may be truncated')
      suggestions.push('Consider shortening the description')
    }
    
    // Check for vague terms
    const vagueTerms = ['delicious', 'tasty', 'good', 'nice', 'great', 'amazing']
    const hasVagueTerms = vagueTerms.some(term => 
      prompt.toLowerCase().includes(term.toLowerCase())
    )
    
    if (hasVagueTerms) {
      warnings.push('Contains vague descriptive terms')
      suggestions.push('Replace subjective terms with specific visual details')
      if (estimatedQuality !== 'low') estimatedQuality = 'medium'
    }
    
    // Check for specific visual details
    const visualTerms = ['color', 'texture', 'garnish', 'sauce', 'crispy', 'golden', 'fresh', 'grilled', 'roasted']
    const hasVisualDetails = visualTerms.some(term => 
      prompt.toLowerCase().includes(term.toLowerCase())
    )
    
    if (hasVisualDetails) {
      if (estimatedQuality !== 'low') estimatedQuality = 'high'
    } else {
      suggestions.push('Add visual details like colors, textures, or cooking methods')
      if (estimatedQuality !== 'low') estimatedQuality = 'medium'
    }
    
    // Check for ingredients
    const hasIngredients = prompt.includes('with ') || prompt.includes('and ')
    if (!hasIngredients) {
      suggestions.push('Consider mentioning key ingredients or accompaniments')
    }
    
    return {
      valid: warnings.length === 0,
      warnings,
      suggestions,
      estimatedQuality
    }
  }
  
  /**
   * Suggest improvements for a prompt based on previous results
   */
  suggestImprovements(prompt: string, previousResults?: any[]): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = []
    
    // Analyze current prompt
    const validation = this.validatePrompt(prompt)
    
    // Convert validation suggestions to structured suggestions
    validation.suggestions.forEach(suggestion => {
      if (suggestion.includes('descriptive details')) {
        suggestions.push({
          type: 'add_detail',
          message: 'Add more specific visual details',
          example: 'Instead of "pasta", try "creamy fettuccine pasta with herbs"'
        })
      } else if (suggestion.includes('visual details')) {
        suggestions.push({
          type: 'improve_specificity',
          message: 'Include colors, textures, or cooking methods',
          example: 'Add terms like "golden brown", "crispy", "garnished with fresh herbs"'
        })
      } else if (suggestion.includes('ingredients')) {
        suggestions.push({
          type: 'add_detail',
          message: 'Mention key ingredients or side dishes',
          example: 'Add "served with roasted vegetables" or "topped with parmesan"'
        })
      }
    })
    
    // Check if negative prompt suggestions are needed
    if (!prompt.includes('professional') && !prompt.includes('high quality')) {
      suggestions.push({
        type: 'add_negative',
        message: 'Consider adding quality modifiers to negative prompt',
        example: 'Add "low quality, blurry, unappetizing" to negative prompt'
      })
    }
    
    return suggestions
  }
  
  /**
   * Get prompt template by style
   */
  getPromptTemplate(style: string): PromptTemplate {
    return PROMPT_TEMPLATES[style] || PROMPT_TEMPLATES.modern
  }
  
  /**
   * Get all available prompt templates
   */
  getAllTemplates(): PromptTemplate[] {
    return Object.values(PROMPT_TEMPLATES)
  }
  
  /**
   * Intelligently truncate a prompt while preserving key information
   */
  private intelligentTruncate(prompt: string, maxLength: number): string {
    if (prompt.length <= maxLength) return prompt
    
    // Split into parts: main description, style modifiers, quality terms
    const parts = prompt.split(', ')
    
    // Always keep the first part (main description)
    let result = parts[0]
    
    // Add parts until we approach the limit
    for (let i = 1; i < parts.length; i++) {
      const nextPart = ', ' + parts[i]
      if (result.length + nextPart.length <= maxLength - 50) { // Leave buffer
        result += nextPart
      } else {
        break
      }
    }
    
    // Always end with quality modifier if there's room
    const qualityModifier = ', high quality, professional photography'
    if (result.length + qualityModifier.length <= maxLength) {
      result += qualityModifier
    }
    
    return result
  }
  
  /**
   * Estimate token count for prompt (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4)
  }

  /**
   * Normalize and clamp a description string to a reasonable length, preserving words.
   */
  private normalizeDescription(description: string, maxChars = 350): string {
    const trimmed = description.trim().replace(/\s+/g, ' ')
    if (trimmed.length <= maxChars) return trimmed
    // Find a natural break before the limit
    const slice = trimmed.slice(0, maxChars)
    const lastPunct = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(', '), slice.lastIndexOf('; '))
    const lastSpace = slice.lastIndexOf(' ')
    const cut = lastPunct > 80 ? lastPunct + 1 : (lastSpace > 80 ? lastSpace : maxChars)
    return slice.slice(0, cut).trim()
  }
}

// Singleton instance
let promptService: PromptConstructionService | null = null

export function getPromptConstructionService(): PromptConstructionService {
  if (!promptService) {
    promptService = new PromptConstructionService()
  }
  return promptService
}

// Helper function to create a prompt from menu item with minimal parameters
export function createBasicPrompt(item: MenuItem, style: string = 'modern'): string {
  const service = getPromptConstructionService()
  const result = service.buildPrompt(item, { style: style as any })
  return result.prompt
}

// Helper function to validate menu item description for image generation
export function validateMenuItemForImageGeneration(item: MenuItem): {
  suitable: boolean
  issues: string[]
  suggestions: string[]
} {
  const issues: string[] = []
  const suggestions: string[] = []
  
  // Check if item has a name
  if (!item.name?.trim()) {
    issues.push('Item name is required')
    return { suitable: false, issues, suggestions }
  }
  
  // Check name length
  if (item.name.length < 3) {
    issues.push('Item name is too short')
    suggestions.push('Use a more descriptive name')
  }
  
  // Check if description exists and is useful
  if (!item.description?.trim()) {
    suggestions.push('Add a description to improve image quality')
    suggestions.push('Include ingredients, cooking method, or presentation style')
  } else {
    // Check description quality
    if (item.description && item.description.length < 10) {
      suggestions.push('Description is quite short - consider adding more details')
    }
    
    // Check for generic descriptions
    const genericTerms = ['food', 'dish', 'meal', 'item']
    const isGeneric = item.description ? genericTerms.some(term => 
      item.description!.toLowerCase().includes(term)
    ) : false
    
    if (isGeneric) {
      suggestions.push('Replace generic terms with specific ingredients or cooking methods')
    }
  }
  
  return {
    suitable: issues.length === 0,
    issues,
    suggestions
  }
}