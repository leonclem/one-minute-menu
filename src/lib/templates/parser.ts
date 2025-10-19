// Template Parser
// This module parses Figma files and extracts layout structure, styling, and binding points
// Runs at build-time/import only

import type {
  FigmaNode,
  LayoutProperties,
  TemplateBindings,
  ParsedTemplate,
  ComputedStyles,
  TemplateAssets,
  ConditionalLayer,
  FontDefinition,
  ColorDefinition,
  SpacingDefinition,
} from '@/types/templates'
import { FigmaClient, createFigmaClient } from './figma-client'

// ============================================================================
// Parser Configuration
// ============================================================================

interface ParserConfig {
  figmaClient?: FigmaClient
  extractAssets?: boolean
  generateCSS?: boolean
}

// ============================================================================
// Binding Point Detection
// ============================================================================

const BINDING_PATTERNS = {
  restaurantName: /\{\{restaurant\.name\}\}/i,
  categoryName: /\{\{category\.name\}\}/i,
  categoryItems: /\{\{category\.items\}\}/i,
  itemName: /\{\{item\.name\}\}/i,
  itemPrice: /\{\{item\.price\}\}/i,
  itemDescription: /\{\{item\.description\}\}/i,
  itemIcon: /\{\{item\.image_icon\}\}/i,
  itemDietaryTags: /\{\{item\.dietaryTags\}\}/i,
  itemAllergens: /\{\{item\.allergens\}\}/i,
  itemVariants: /\{\{item\.variants\}\}/i,
}

const CUSTOMIZATION_PATTERNS = {
  color: /\{\{([a-z_]+)_color\}\}/i,
  font: /\{\{([a-z_]+)_font\}\}/i,
}

// ============================================================================
// Template Parser Class
// ============================================================================

export class TemplateParser {
  private figmaClient: FigmaClient
  private extractAssets: boolean
  private generateCSS: boolean

  constructor(config: ParserConfig = {}) {
    this.figmaClient = config.figmaClient || createFigmaClient()
    this.extractAssets = config.extractAssets ?? true
    this.generateCSS = config.generateCSS ?? true
  }

  /**
   * Parse a Figma file and extract template structure
   */
  async parseFigmaFile(fileKey: string): Promise<ParsedTemplate> {
    // Fetch file from Figma API
    const fileData = await this.figmaClient.getFile(fileKey)

    // Extract nodes from document
    const nodes = this.figmaClient.extractNodes(fileData.document)

    // Find the root template node (usually a frame or page)
    const rootNode = this.findTemplateRoot(nodes)

    if (!rootNode) {
      throw new Error('Could not find template root node in Figma file')
    }

    // Extract binding points
    const bindings = await this.extractBindingPoints([rootNode])

    // Generate CSS from layout
    const styles = this.generateCSS 
      ? await this.generateStyles(rootNode)
      : { css: '', fonts: [], colors: {} }

    // Extract assets
    const assets = this.extractAssets
      ? await this.extractTemplateAssets(fileKey, rootNode)
      : { images: [], fonts: [] }

    return {
      structure: rootNode,
      bindings,
      styles,
      assets,
    }
  }

  /**
   * Find the root template node (typically a frame named "Template" or similar)
   */
  private findTemplateRoot(nodes: FigmaNode[]): FigmaNode | null {
    // Look for a frame or page with "template" in the name
    for (const node of nodes) {
      if (
        (node.type === 'FRAME' || node.type === 'PAGE') &&
        /template/i.test(node.name)
      ) {
        return node
      }

      // Recursively search children
      if (node.children) {
        const found = this.findTemplateRoot(node.children)
        if (found) return found
      }
    }

    // Fallback: return first frame
    return nodes.find(n => n.type === 'FRAME') || nodes[0] || null
  }

  /**
   * Extract binding points from Figma nodes based on layer naming conventions
   */
  async extractBindingPoints(nodes: FigmaNode[]): Promise<TemplateBindings> {
    const bindings: Partial<TemplateBindings> = {
      conditionalLayers: [],
    }

    const conditionalLayers: ConditionalLayer[] = []

    const traverse = (node: FigmaNode) => {
      const layerName = node.name

      // Check for required bindings
      if (BINDING_PATTERNS.restaurantName.test(layerName)) {
        bindings.restaurantName = layerName
      }
      if (BINDING_PATTERNS.categoryName.test(layerName)) {
        bindings.categoryName = layerName
      }
      if (BINDING_PATTERNS.categoryItems.test(layerName)) {
        bindings.categoryItems = layerName
      }
      if (BINDING_PATTERNS.itemName.test(layerName)) {
        bindings.itemName = layerName
      }

      // Check for optional bindings
      if (BINDING_PATTERNS.itemPrice.test(layerName)) {
        bindings.itemPrice = layerName
        conditionalLayers.push({
          layerName,
          condition: 'hasPrice',
          action: 'show',
        })
      }
      if (BINDING_PATTERNS.itemDescription.test(layerName)) {
        bindings.itemDescription = layerName
        conditionalLayers.push({
          layerName,
          condition: 'hasDescription',
          action: 'show',
        })
      }
      if (BINDING_PATTERNS.itemIcon.test(layerName)) {
        bindings.itemIcon = layerName
        conditionalLayers.push({
          layerName,
          condition: 'hasIcon',
          action: 'show',
        })
      }
      if (BINDING_PATTERNS.itemDietaryTags.test(layerName)) {
        bindings.itemDietaryTags = layerName
        conditionalLayers.push({
          layerName,
          condition: 'hasDietaryTags',
          action: 'show',
        })
      }
      if (BINDING_PATTERNS.itemAllergens.test(layerName)) {
        bindings.itemAllergens = layerName
        conditionalLayers.push({
          layerName,
          condition: 'hasAllergens',
          action: 'show',
        })
      }
      if (BINDING_PATTERNS.itemVariants.test(layerName)) {
        bindings.itemVariants = layerName
        conditionalLayers.push({
          layerName,
          condition: 'hasVariants',
          action: 'show',
        })
      }

      // Recursively traverse children
      if (node.children) {
        node.children.forEach(traverse)
      }
    }

    nodes.forEach(traverse)

    bindings.conditionalLayers = conditionalLayers

    // Validate required bindings
    if (!bindings.restaurantName) {
      throw new Error('Missing required binding: {{restaurant.name}}')
    }
    if (!bindings.categoryName) {
      throw new Error('Missing required binding: {{category.name}}')
    }
    if (!bindings.categoryItems) {
      throw new Error('Missing required binding: {{category.items}}')
    }
    if (!bindings.itemName) {
      throw new Error('Missing required binding: {{item.name}}')
    }

    return bindings as TemplateBindings
  }

  /**
   * Generate CSS from Figma layout properties
   */
  private async generateStyles(rootNode: FigmaNode): Promise<ComputedStyles> {
    const cssRules: string[] = []
    const fonts = new Set<string>()
    const colors: Record<string, string> = {}

    const traverse = (node: FigmaNode, selector: string) => {
      const css = this.convertToCSS(node.layout, node.styles)
      
      if (css) {
        cssRules.push(`${selector} { ${css} }`)
      }

      // Extract fonts
      if (node.styles.typography) {
        fonts.add(node.styles.typography.fontFamily)
      }

      // Extract colors
      if (node.styles.fills.length > 0) {
        const fill = node.styles.fills[0]
        if (fill.type === 'SOLID' && fill.color) {
          const colorKey = `color-${node.id}`
          colors[colorKey] = this.rgbaToHex(fill.color)
        }
      }

      // Recursively process children
      if (node.children) {
        node.children.forEach((child, index) => {
          traverse(child, `${selector} > .node-${child.id}`)
        })
      }
    }

    traverse(rootNode, '.template-root')

    return {
      css: cssRules.join('\n'),
      fonts: Array.from(fonts),
      colors,
    }
  }

  /**
   * Convert Figma layout properties to CSS
   */
  convertToCSS(layout: LayoutProperties, styles?: any): string {
    const cssProps: string[] = []

    // Layout mode (flexbox)
    if (layout.layoutMode === 'HORIZONTAL') {
      cssProps.push('display: flex')
      cssProps.push('flex-direction: row')
    } else if (layout.layoutMode === 'VERTICAL') {
      cssProps.push('display: flex')
      cssProps.push('flex-direction: column')
    }

    // Spacing
    if (layout.itemSpacing > 0) {
      cssProps.push(`gap: ${layout.itemSpacing}px`)
    }

    // Padding
    if (layout.paddingTop > 0 || layout.paddingRight > 0 || 
        layout.paddingBottom > 0 || layout.paddingLeft > 0) {
      cssProps.push(
        `padding: ${layout.paddingTop}px ${layout.paddingRight}px ${layout.paddingBottom}px ${layout.paddingLeft}px`
      )
    }

    // Alignment
    if (layout.primaryAxisAlignItems) {
      const alignMap: Record<string, string> = {
        MIN: 'flex-start',
        CENTER: 'center',
        MAX: 'flex-end',
        SPACE_BETWEEN: 'space-between',
      }
      cssProps.push(`justify-content: ${alignMap[layout.primaryAxisAlignItems] || 'flex-start'}`)
    }

    if (layout.counterAxisAlignItems) {
      const alignMap: Record<string, string> = {
        MIN: 'flex-start',
        CENTER: 'center',
        MAX: 'flex-end',
      }
      cssProps.push(`align-items: ${alignMap[layout.counterAxisAlignItems] || 'flex-start'}`)
    }

    // Sizing
    if (layout.primaryAxisSizingMode === 'FIXED') {
      cssProps.push('flex-shrink: 0')
    } else if (layout.primaryAxisSizingMode === 'AUTO') {
      cssProps.push('flex-grow: 1')
    }

    return cssProps.join('; ')
  }

  /**
   * Extract typography from a Figma node
   */
  extractTypography(node: FigmaNode): FontDefinition | null {
    if (!node.styles.typography) return null

    const typo = node.styles.typography

    return {
      role: this.inferFontRole(node.name),
      family: typo.fontFamily,
      size: `${typo.fontSize}px`,
      weight: typo.fontWeight.toString(),
      lineHeight: typo.lineHeight ? `${typo.lineHeight}px` : undefined,
    }
  }

  /**
   * Infer font role from layer name
   */
  private inferFontRole(layerName: string): string {
    if (/heading|title|h[1-6]/i.test(layerName)) return 'heading'
    if (/price/i.test(layerName)) return 'price'
    if (/description|body/i.test(layerName)) return 'body'
    return 'default'
  }

  /**
   * Extract template assets (images, fonts)
   */
  private async extractTemplateAssets(
    fileKey: string,
    rootNode: FigmaNode
  ): Promise<TemplateAssets> {
    const imageNodes: string[] = []
    const fonts = new Set<string>()

    const traverse = (node: FigmaNode) => {
      // Collect image nodes
      if (node.type === 'RECTANGLE' || node.type === 'FRAME') {
        const hasImageFill = node.styles.fills.some(fill => fill.type === 'IMAGE')
        if (hasImageFill) {
          imageNodes.push(node.id)
        }
      }

      // Collect fonts
      if (node.styles.typography) {
        fonts.add(node.styles.typography.fontFamily)
      }

      if (node.children) {
        node.children.forEach(traverse)
      }
    }

    traverse(rootNode)

    // Fetch image URLs
    const images = imageNodes.length > 0
      ? await this.figmaClient.getImages(fileKey, imageNodes)
      : { images: {} }

    return {
      images: Object.entries(images.images)
        .filter(([_, url]) => url !== null)
        .map(([id, url]) => ({
          id,
          url: url!,
          width: 0, // Would need additional API call to get dimensions
          height: 0,
        })),
      fonts: Array.from(fonts).map(family => ({
        family,
        url: '', // Font URLs would need to be resolved separately
        weight: '400',
        style: 'normal',
      })),
    }
  }

  /**
   * Convert RGBA color to hex
   */
  private rgbaToHex(color: { r: number; g: number; b: number; a: number }): string {
    const r = Math.round(color.r * 255)
    const g = Math.round(color.g * 255)
    const b = Math.round(color.b * 255)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  /**
   * Detect customization variables in layer names
   */
  detectCustomizationVariables(nodes: FigmaNode[]): {
    colors: string[]
    fonts: string[]
  } {
    const colors = new Set<string>()
    const fonts = new Set<string>()

    const traverse = (node: FigmaNode) => {
      const layerName = node.name

      // Check for color variables
      const colorMatch = layerName.match(CUSTOMIZATION_PATTERNS.color)
      if (colorMatch) {
        colors.add(colorMatch[1])
      }

      // Check for font variables
      const fontMatch = layerName.match(CUSTOMIZATION_PATTERNS.font)
      if (fontMatch) {
        fonts.add(fontMatch[1])
      }

      if (node.children) {
        node.children.forEach(traverse)
      }
    }

    nodes.forEach(traverse)

    return {
      colors: Array.from(colors),
      fonts: Array.from(fonts),
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a template parser instance
 */
export function createTemplateParser(config?: ParserConfig): TemplateParser {
  return new TemplateParser(config)
}
