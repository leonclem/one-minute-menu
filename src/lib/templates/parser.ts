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

// Decorative conventions (v1)
const DECOR_PATTERNS = {
  backgroundTexture: /\{\{decor\.background_texture\}\}/i,
}

// Layout conventions (v1)
const LAYOUT_PATTERNS = {
  categoriesColumns: /\{\{layout\.categories\.columns:(\d+)\}\}/i,
  itemsColumns: /\{\{layout\.items\.columns:(\d+)\}\}/i,
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

    // Extract assets first so styles can embed asset URLs (e.g., background texture)
    const assets = this.extractAssets
      ? await this.extractTemplateAssets(fileKey, rootNode)
      : { images: [], fonts: [] }

    // Extract binding points
    const bindings = await this.extractBindingPoints([rootNode])

    // Generate CSS from layout (with access to assets)
    const styles = this.generateCSS 
      ? await this.generateStyles(rootNode, assets)
      : { css: '', fonts: [], colors: {} }

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
    // v1 Rule: prefer a named root like "A4 Portrait" or "Template Root"; fallback to first top-level frame
    const preferredName = /^(a4\s+portrait|template\s+root)$/i
    const altPreferred = /(a4|us\s*letter|tabloid)/i

    // Prefer exact preferred names
    const exact = nodes.find(n => (n.type === 'FRAME' || n.type === 'PAGE') && preferredName.test(n.name))
    if (exact) return exact

    // Then any frame with common page keywords
    const pageLike = nodes.find(n => (n.type === 'FRAME' || n.type === 'PAGE') && altPreferred.test(n.name))
    if (pageLike) return pageLike

    // Fallback: first frame
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
   * Detect item template subtree inside the {{category.items}} container
   * and emit class hooks to match renderer semantics.
   */
  detectItemTemplate(categoryItemsNode: FigmaNode | null | undefined): {
    classes: string[]
  } {
    if (!categoryItemsNode) return { classes: [] }

    const classes = new Set<string>(['.menu-item', '.item-top-row', '.item-left-group', '.item-right-group'])

    const walk = (n: FigmaNode) => {
      const nm = n.name || ''
      if (BINDING_PATTERNS.itemName.test(nm)) classes.add('.item-name')
      if (BINDING_PATTERNS.itemPrice.test(nm)) classes.add('.item-price')
      if (BINDING_PATTERNS.itemDescription.test(nm)) classes.add('.item-description')
      if (n.children) n.children.forEach(walk)
    }
    walk(categoryItemsNode)

    return { classes: Array.from(classes) }
  }

  /**
   * Generate CSS from Figma layout properties
   * Now generates ONLY semantic CSS that targets renderer's class names
   */
  private async generateStyles(rootNode: FigmaNode, assets?: TemplateAssets): Promise<ComputedStyles> {
    const cssRules: string[] = []
    const fonts = new Set<string>()
    const colors: Record<string, string> = {}

    // Helper to find nodes by name pattern
    const findByName = (n: FigmaNode, target: string): FigmaNode | null => {
      if (n.name === target) return n
      if (!n.children) return null
      for (const c of n.children) {
        const found = findByName(c, target)
        if (found) return found
      }
      return null
    }

    // 1. Map root frame to .menu-container
    const rootCss = this.convertToCSS(rootNode.layout, rootNode.styles)
    if (rootCss) {
      cssRules.push(`.menu-container { ${rootCss} }`)
    }

    // 2. Generate semantic CSS for each binding point
    const bindingNodeToClass: Array<{ name: string; className: string; role: string }> = [
      { name: '{{restaurant.name}}', className: '.restaurant-name', role: 'restaurant-name' },
      { name: '{{category.name}}', className: '.category-name', role: 'category-name' },
      { name: '{{item.name}}', className: '.item-name', role: 'item-name' },
      { name: '{{item.price}}', className: '.item-price', role: 'item-price' },
      { name: '{{item.description}}', className: '.item-description', role: 'item-description' },
    ]

    for (const map of bindingNodeToClass) {
      const node = findByName(rootNode, map.name)
      if (node) {
        // Extract layout CSS
        const layoutCss = this.convertToCSS(node.layout, node.styles)
        
        // Extract typography
        const typo = node.styles?.typography
        let typoCss = ''
        if (typo) {
          const fontParts: string[] = []
          fontParts.push(`font-family: '${typo.fontFamily}', sans-serif`)
          fontParts.push(`font-weight: ${typo.fontWeight}`)
          fontParts.push(`font-size: ${typo.fontSize}px`)
          
          const lineHeight = typo.lineHeight || typo.fontSize * 1.2
          fontParts.push(`line-height: ${Math.round(lineHeight)}px`)
          
          typoCss = fontParts.join('; ')
          fonts.add(typo.fontFamily)
        }
        
        // Extract text color from fills
        let colorCss = ''
        if (node.styles?.fills?.length > 0) {
          const fill = node.styles.fills[0]
          if (fill.type === 'SOLID' && fill.color) {
            const hexColor = this.rgbaToHex(fill.color)
            colorCss = `color: ${hexColor}`
            colors[map.role] = hexColor
          }
        }
        
        // Merge all CSS properties
        const allCss = [layoutCss, typoCss, colorCss].filter(Boolean).join('; ')
        if (allCss) {
          cssRules.push(`${map.className} { ${allCss} }`)
        }
      }
    }

    // Map {{category.items}} container to semantic class used by renderer
    const catItemsNode = findByName(rootNode, '{{category.items}}')
    if (catItemsNode) {
      const catCss = this.convertToCSS(catItemsNode.layout, catItemsNode.styles)
      if (catCss) cssRules.push(`.category-items { ${catCss} }`)

      // If the Figma container has a solid fill, use it as category box background
      const fill = catItemsNode.styles?.fills?.[0]
      let bgColor: string | null = null
      if (fill && fill.type === 'SOLID' && fill.color) {
        bgColor = this.rgbaToHex(fill.color)
      } else {
        // Fallback: if parent {{category}} has a fill, use that so the name area is covered too
        const findParentCategory = (parent: FigmaNode | undefined, target: FigmaNode): FigmaNode | null => {
          if (!parent) return null
          if (/\{\{category\}\}/i.test(parent.name)) return parent
          // Walk up by searching recursively from root for a node whose children contain target
          return null
        }
        // Simple upward search: walk the tree to find the direct {{category}} ancestor
        const searchCategoryAncestor = (node: FigmaNode, lookingFor: FigmaNode): FigmaNode | null => {
          if (node.children && node.children.includes(lookingFor)) {
            if (/\{\{category\}\}/i.test(node.name)) return node
          }
          if (!node.children) return null
          for (const c of node.children) {
            const found = searchCategoryAncestor(c, lookingFor)
            if (found) return found
          }
          return null
        }
        const categoryAncestor = searchCategoryAncestor(rootNode, catItemsNode)
        const catFill = categoryAncestor?.styles?.fills?.[0]
        if (catFill && catFill.type === 'SOLID' && catFill.color) {
          bgColor = this.rgbaToHex(catFill.color)
        }
      }
      if (bgColor) {
        // Add padding - use 10px default for now, can be enhanced later
        cssRules.push(`.category { background-color: ${bgColor}; padding: 10px; border-radius: 4px; }`)
      }

      // Items columns from suffix: {{category.items}}:2cols
      const suffixMatch = catItemsNode.name.match(/\{\{category\.items\}\}:(\d+)cols/i)
      let inferredItemCols: number | null = suffixMatch ? parseInt(suffixMatch[1], 10) : null

      // If no suffix, infer from direct children that contain item bindings
      if (!inferredItemCols && catItemsNode.children && catItemsNode.children.length > 0) {
        const isItemColumn = (n: FigmaNode): boolean => {
          let found = false
          const walk = (x: FigmaNode) => {
            if (/\{\{item\./i.test(x.name)) found = true
            x.children?.forEach(walk)
          }
          walk(n)
          return found
        }
        const colCount = catItemsNode.children.filter(isItemColumn).length
        if (colCount >= 2) {
          inferredItemCols = colCount
        }
      }

      if (inferredItemCols && inferredItemCols > 1) {
        const itemGap = catItemsNode.layout?.itemSpacing || 12
        cssRules.push(`.category-items { display: grid; grid-template-columns: repeat(${inferredItemCols}, minmax(0, 1fr)); gap: ${itemGap}px }`)
      }
    }

    // Layout conventions: columns for categories and for items
    // Find any node declaring columns and generate corresponding grid CSS
    const findColumns = (n: FigmaNode, regex: RegExp): number | null => {
      if (regex.test(n.name)) {
        const m = n.name.match(regex)
        if (m && m[1]) return Math.max(1, parseInt(m[1], 10))
      }
      if (!n.children) return null
      for (const c of n.children) {
        const res = findColumns(c, regex)
        if (res) return res
      }
      return null
    }

    const categoriesCols = findColumns(rootNode, LAYOUT_PATTERNS.categoriesColumns)
    if (categoriesCols) {
      const gapPx = rootNode.layout?.itemSpacing || 24
      cssRules.push(`.categories-container { display: grid; grid-template-columns: repeat(${categoriesCols}, minmax(0, 1fr)); gap: ${gapPx}px }`)
    }
    
    // Heuristic: if root has multiple sibling groups that contain categories, infer columns
    if (!categoriesCols && rootNode.children && rootNode.children.length > 0) {
      const nodeContainsCategory = (n: FigmaNode): boolean => {
        if (/\{\{category(\.name)?\}\}/i.test(n.name)) return true
        if (!n.children) return false
        return n.children.some(nodeContainsCategory)
      }
      const topLevelCategoryGroups = rootNode.children.filter(nodeContainsCategory)
      if (topLevelCategoryGroups.length >= 2) {
        const cols = Math.min(4, topLevelCategoryGroups.length)
        const gapPx = rootNode.layout?.itemSpacing || 24
        cssRules.push(`.categories-container { display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: ${gapPx}px }`)
      }
    }

    const itemsCols = findColumns(rootNode, LAYOUT_PATTERNS.itemsColumns)
    if (itemsCols) {
      const itemGap = catItemsNode?.layout?.itemSpacing || 12
      cssRules.push(`.category-items { display: grid; grid-template-columns: repeat(${itemsCols}, minmax(0, 1fr)); gap: ${itemGap}px }`)
    }

    // Decorative: background texture → .menu-container::before with image URL if available
    const decorNode = findByName(rootNode, '{{decor.background_texture}}')
    if (decorNode) {
      let url: string | undefined
      const img = assets?.images?.find(i => i.id === decorNode.id)
      if (img?.url) url = img.url
      const bgDecl = url
        ? `background-image: url("${url}")`
        : `background-image: var(--decor-background-url)`
      cssRules.push(`.menu-container{position:relative}`)
      cssRules.push(`.menu-container::before{content:"";position:absolute;inset:0;pointer-events:none;${bgDecl};background-size:cover;background-position:center;opacity:.35;mix-blend-mode:multiply}`)
    }

    // Decorative: banner/section blocks → emit pseudo-element overlays from fills
    const findDecorBlocks = (n: FigmaNode, acc: FigmaNode[] = []): FigmaNode[] => {
      if (/\{\{decor\.block_/.test(n.name)) acc.push(n)
      n.children?.forEach(child => findDecorBlocks(child, acc))
      return acc
    }
    const blocks = findDecorBlocks(rootNode)
    blocks.forEach((block) => {
      const name = (block.name.match(/\{\{decor\.block_([^}]+)\}\}/i)?.[1] || 'section').toLowerCase()
      const fill = block.styles?.fills?.[0]
      const color = fill && fill.type === 'SOLID' && fill.color ? this.rgbaToHex(fill.color) : '#000'
      // For now apply to page as a full-width banner; designers can adjust with margins via other layers later
      cssRules.push(`.section--${name}::before{content:"";display:block;width:100%;height:8mm;background:${color};}`)
    })

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
