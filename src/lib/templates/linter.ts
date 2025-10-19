// Template Linter
// This module validates template configurations to ensure they meet requirements
// Runs during template registration to catch issues early

import type {
  TemplateConfig,
  TemplateBindings,
  FigmaNode,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '@/types/templates'

// ============================================================================
// Validation Rules
// ============================================================================

const REQUIRED_BINDINGS = [
  'restaurantName',
  'categoryName',
  'categoryItems',
  'itemName',
] as const

const OPTIONAL_BINDINGS = [
  'itemPrice',
  'itemDescription',
  'itemIcon',
  'itemDietaryTags',
  'itemAllergens',
  'itemVariants',
] as const

const REQUIRED_PLACEHOLDERS = [
  '{{restaurant.name}}',
  '{{category.name}}',
  '{{item.name}}',
] as const

const VALID_PAGE_FORMATS = ['A4', 'US_LETTER', 'TABLOID', 'DIGITAL'] as const
const VALID_ORIENTATIONS = ['portrait', 'landscape'] as const

// Size constraints (in pixels at 72 DPI)
const PAGE_SIZE_CONSTRAINTS = {
  A4: {
    portrait: { width: 595, height: 842, maxWidth: 650, maxHeight: 900 },
    landscape: { width: 842, height: 595, maxWidth: 900, maxHeight: 650 },
  },
  US_LETTER: {
    portrait: { width: 612, height: 792, maxWidth: 670, maxHeight: 850 },
    landscape: { width: 792, height: 612, maxWidth: 850, maxHeight: 670 },
  },
  TABLOID: {
    portrait: { width: 792, height: 1224, maxWidth: 850, maxHeight: 1300 },
    landscape: { width: 1224, height: 792, maxWidth: 1300, maxHeight: 850 },
  },
  DIGITAL: {
    portrait: { width: 375, height: 812, maxWidth: 500, maxHeight: 1000 },
    landscape: { width: 812, height: 375, maxWidth: 1000, maxHeight: 500 },
  },
}

const MIN_CATEGORY_SECTIONS = 1
const MAX_CATEGORY_SECTIONS = 10

// ============================================================================
// Template Linter Class
// ============================================================================

export class TemplateLinter {
  /**
   * Validate a complete template configuration
   */
  validate(config: TemplateConfig, structure?: FigmaNode): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Validate metadata
    this.validateMetadata(config, errors, warnings)

    // Validate bindings
    this.validateBindings(config.bindings, errors, warnings)

    // Validate bindings against structure if provided
    if (structure) {
      this.validateBindingsAgainstStructure(config.bindings, structure, errors, warnings)
    }

    // Validate styling
    this.validateStyling(config, errors, warnings)

    // Validate customization options
    this.validateCustomization(config, errors, warnings)

    // Validate size constraints
    if (structure) {
      this.validateSizeConstraints(config, structure, errors, warnings)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate template metadata
   */
  private validateMetadata(
    config: TemplateConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const { metadata } = config

    // Required fields
    if (!metadata.id || metadata.id.trim() === '') {
      errors.push({
        field: 'metadata.id',
        message: 'Template ID is required',
        code: 'MISSING_ID',
      })
    }

    if (!metadata.name || metadata.name.trim() === '') {
      errors.push({
        field: 'metadata.name',
        message: 'Template name is required',
        code: 'MISSING_NAME',
      })
    }

    if (!metadata.figmaFileKey || metadata.figmaFileKey.trim() === '') {
      errors.push({
        field: 'metadata.figmaFileKey',
        message: 'Figma file key is required',
        code: 'MISSING_FIGMA_KEY',
      })
    }

    // Validate page format
    if (!VALID_PAGE_FORMATS.includes(metadata.pageFormat as any)) {
      errors.push({
        field: 'metadata.pageFormat',
        message: `Invalid page format. Must be one of: ${VALID_PAGE_FORMATS.join(', ')}`,
        code: 'INVALID_PAGE_FORMAT',
      })
    }

    // Validate orientation
    if (!VALID_ORIENTATIONS.includes(metadata.orientation as any)) {
      errors.push({
        field: 'metadata.orientation',
        message: `Invalid orientation. Must be one of: ${VALID_ORIENTATIONS.join(', ')}`,
        code: 'INVALID_ORIENTATION',
      })
    }

    // Validate version format
    if (!metadata.version || !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      warnings.push({
        field: 'metadata.version',
        message: 'Version should follow semantic versioning (e.g., 1.0.0)',
        code: 'INVALID_VERSION_FORMAT',
      })
    }

    // Validate URLs
    if (metadata.previewImageUrl && !this.isValidUrl(metadata.previewImageUrl)) {
      warnings.push({
        field: 'metadata.previewImageUrl',
        message: 'Preview image URL appears to be invalid',
        code: 'INVALID_PREVIEW_URL',
      })
    }

    if (metadata.thumbnailUrl && !this.isValidUrl(metadata.thumbnailUrl)) {
      warnings.push({
        field: 'metadata.thumbnailUrl',
        message: 'Thumbnail URL appears to be invalid',
        code: 'INVALID_THUMBNAIL_URL',
      })
    }
  }

  /**
   * Validate template bindings
   */
  private validateBindings(
    bindings: TemplateBindings,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check required bindings
    for (const required of REQUIRED_BINDINGS) {
      if (!bindings[required] || bindings[required].trim() === '') {
        errors.push({
          field: `bindings.${required}`,
          message: `Required binding '${required}' is missing`,
          code: 'MISSING_REQUIRED_BINDING',
        })
      }
    }

    // Validate conditional layers
    if (!bindings.conditionalLayers || !Array.isArray(bindings.conditionalLayers)) {
      warnings.push({
        field: 'bindings.conditionalLayers',
        message: 'Conditional layers array is missing or invalid',
        code: 'MISSING_CONDITIONAL_LAYERS',
      })
    } else {
      bindings.conditionalLayers.forEach((layer, index) => {
        if (!layer.layerName || layer.layerName.trim() === '') {
          errors.push({
            field: `bindings.conditionalLayers[${index}].layerName`,
            message: 'Conditional layer name is required',
            code: 'MISSING_LAYER_NAME',
          })
        }

        if (!layer.condition) {
          errors.push({
            field: `bindings.conditionalLayers[${index}].condition`,
            message: 'Conditional layer condition is required',
            code: 'MISSING_CONDITION',
          })
        }

        if (!['show', 'hide'].includes(layer.action)) {
          errors.push({
            field: `bindings.conditionalLayers[${index}].action`,
            message: 'Conditional layer action must be "show" or "hide"',
            code: 'INVALID_ACTION',
          })
        }
      })
    }
  }

  /**
   * Validate that bindings reference existing layers in the Figma structure
   */
  private validateBindingsAgainstStructure(
    bindings: TemplateBindings,
    structure: FigmaNode,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const layerNames = this.collectLayerNames(structure)

    // Check that required placeholder patterns exist in layer names
    const allLayerNamesText = layerNames.join(' ')

    for (const placeholder of REQUIRED_PLACEHOLDERS) {
      if (!allLayerNamesText.includes(placeholder)) {
        errors.push({
          field: 'structure',
          message: `Required placeholder '${placeholder}' not found in any layer name`,
          code: 'MISSING_PLACEHOLDER',
        })
      }
    }

    // Check that binding layer names exist in structure
    const bindingFields = [
      ...REQUIRED_BINDINGS,
      ...OPTIONAL_BINDINGS,
    ] as const

    for (const field of bindingFields) {
      const layerName = bindings[field]
      if (layerName && !layerNames.includes(layerName)) {
        warnings.push({
          field: `bindings.${field}`,
          message: `Binding references layer '${layerName}' which was not found in structure`,
          code: 'LAYER_NOT_FOUND',
        })
      }
    }

    // Check conditional layers
    if (bindings.conditionalLayers) {
      bindings.conditionalLayers.forEach((layer, index) => {
        if (!layerNames.includes(layer.layerName)) {
          warnings.push({
            field: `bindings.conditionalLayers[${index}]`,
            message: `Conditional layer '${layer.layerName}' not found in structure`,
            code: 'CONDITIONAL_LAYER_NOT_FOUND',
          })
        }
      })
    }
  }

  /**
   * Validate styling configuration
   */
  private validateStyling(
    config: TemplateConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const { styling } = config

    if (!styling) {
      warnings.push({
        field: 'styling',
        message: 'Styling configuration is missing',
        code: 'MISSING_STYLING',
      })
      return
    }

    // Validate fonts
    if (!styling.fonts || !Array.isArray(styling.fonts)) {
      warnings.push({
        field: 'styling.fonts',
        message: 'Fonts array is missing or invalid',
        code: 'MISSING_FONTS',
      })
    } else if (styling.fonts.length === 0) {
      warnings.push({
        field: 'styling.fonts',
        message: 'No fonts defined in template',
        code: 'NO_FONTS',
      })
    }

    // Validate colors
    if (!styling.colors || !Array.isArray(styling.colors)) {
      warnings.push({
        field: 'styling.colors',
        message: 'Colors array is missing or invalid',
        code: 'MISSING_COLORS',
      })
    } else if (styling.colors.length === 0) {
      warnings.push({
        field: 'styling.colors',
        message: 'No colors defined in template',
        code: 'NO_COLORS',
      })
    } else {
      // Validate color hex codes
      styling.colors.forEach((color, index) => {
        if (!this.isValidHexColor(color.value)) {
          errors.push({
            field: `styling.colors[${index}].value`,
            message: `Invalid hex color code: ${color.value}`,
            code: 'INVALID_COLOR',
          })
        }
      })
    }

    // Validate spacing
    if (!styling.spacing) {
      warnings.push({
        field: 'styling.spacing',
        message: 'Spacing configuration is missing',
        code: 'MISSING_SPACING',
      })
    }
  }

  /**
   * Validate customization options
   */
  private validateCustomization(
    config: TemplateConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const { customization, styling } = config

    if (!customization) {
      warnings.push({
        field: 'customization',
        message: 'Customization options are missing',
        code: 'MISSING_CUSTOMIZATION',
      })
      return
    }

    // If color customization is enabled, check that customizable colors are defined
    if (customization.allowColorCustomization) {
      if (!customization.customizableColors || customization.customizableColors.length === 0) {
        warnings.push({
          field: 'customization.customizableColors',
          message: 'Color customization is enabled but no customizable colors are defined',
          code: 'NO_CUSTOMIZABLE_COLORS',
        })
      } else if (styling?.colors) {
        // Check that customizable colors reference valid color roles
        const colorRoles = styling.colors.map(c => c.role)
        customization.customizableColors.forEach(role => {
          if (!colorRoles.includes(role)) {
            warnings.push({
              field: 'customization.customizableColors',
              message: `Customizable color role '${role}' not found in styling.colors`,
              code: 'INVALID_COLOR_ROLE',
            })
          }
        })
      }
    }

    // If font customization is enabled, check that customizable fonts are defined
    if (customization.allowFontCustomization) {
      if (!customization.customizableFonts || customization.customizableFonts.length === 0) {
        warnings.push({
          field: 'customization.customizableFonts',
          message: 'Font customization is enabled but no customizable fonts are defined',
          code: 'NO_CUSTOMIZABLE_FONTS',
        })
      } else if (styling?.fonts) {
        // Check that customizable fonts reference valid font roles
        const fontRoles = styling.fonts.map(f => f.role)
        customization.customizableFonts.forEach(role => {
          if (!fontRoles.includes(role)) {
            warnings.push({
              field: 'customization.customizableFonts',
              message: `Customizable font role '${role}' not found in styling.fonts`,
              code: 'INVALID_FONT_ROLE',
            })
          }
        })
      }
    }
  }

  /**
   * Validate size constraints for the template format
   */
  private validateSizeConstraints(
    config: TemplateConfig,
    structure: FigmaNode,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const { pageFormat, orientation } = config.metadata

    // Get size constraints for this format
    const constraints = PAGE_SIZE_CONSTRAINTS[pageFormat]?.[orientation]

    if (!constraints) {
      warnings.push({
        field: 'metadata',
        message: `No size constraints defined for ${pageFormat} ${orientation}`,
        code: 'NO_SIZE_CONSTRAINTS',
      })
      return
    }

    // Check if structure has size information (would need to be added to FigmaNode type)
    // For now, we'll just add a warning that size should be checked
    warnings.push({
      field: 'structure',
      message: `Ensure template dimensions are appropriate for ${pageFormat} ${orientation} (recommended: ${constraints.width}x${constraints.height}px)`,
      code: 'CHECK_DIMENSIONS',
    })
  }

  /**
   * Collect all layer names from a Figma node tree
   */
  private collectLayerNames(node: FigmaNode): string[] {
    const names: string[] = [node.name]

    if (node.children) {
      node.children.forEach(child => {
        names.push(...this.collectLayerNames(child))
      })
    }

    return names
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Validate hex color code
   */
  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(color)
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a template linter instance
 */
export function createTemplateLinter(): TemplateLinter {
  return new TemplateLinter()
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Quick validation check for required placeholders
 */
export function hasRequiredPlaceholders(structure: FigmaNode): boolean {
  const linter = new TemplateLinter()
  const layerNames = linter['collectLayerNames'](structure)
  const allLayerNamesText = layerNames.join(' ')

  return REQUIRED_PLACEHOLDERS.every(placeholder => 
    allLayerNamesText.includes(placeholder)
  )
}

/**
 * Get a list of missing required placeholders
 */
export function getMissingPlaceholders(structure: FigmaNode): string[] {
  const linter = new TemplateLinter()
  const layerNames = linter['collectLayerNames'](structure)
  const allLayerNamesText = layerNames.join(' ')

  return REQUIRED_PLACEHOLDERS.filter(placeholder => 
    !allLayerNamesText.includes(placeholder)
  )
}
