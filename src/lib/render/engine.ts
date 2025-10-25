/**
 * Render Engine
 * 
 * Generates HTML/CSS output from template + bound data.
 * Handles print-specific optimizations and responsive layouts.
 */

import type {
  BoundData,
  ParsedTemplate,
  RenderOptions,
  RenderResult,
  RenderMetadata,
  CategoryBinding,
  ItemBinding,
  GlobalStyles,
  UserCustomization,
  ComputedStyles,
} from '@/types/templates'

/**
 * Cache for rendered templates
 * Key: templateId@version:hash(boundData)
 */
const renderCache = new Map<string, { result: RenderResult; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 100

export class RenderEngine {
  private cssCache = new Map<string, string>()
  private htmlFragmentCache = new Map<string, string>()
  /**
   * Main render method that generates HTML/CSS from bound data and template
   */
  async render(
    boundData: BoundData,
    template: ParsedTemplate,
    options: RenderOptions
  ): Promise<RenderResult> {
    const startTime = performance.now()

    // Check cache first
    const cacheKey = this.generateCacheKey(boundData, template, options)
    const cached = this.getCachedRender(cacheKey)
    if (cached) {
      return cached
    }

    // Generate HTML structure
    const html = this.generateHTML(boundData, template)

    // Generate CSS styles (with caching)
    const css = this.generateCSSCached(template, boundData.globalStyles)

    // Apply format-specific optimizations
    const optimized = this.optimizeForFormat(html, css, options.format)

    // Collect metadata
    const metadata = this.generateMetadata(boundData, template, startTime)

    const result: RenderResult = {
      html: optimized.html,
      css: optimized.css,
      assets: this.collectAssets(template),
      metadata,
    }

    // Cache the result
    this.cacheRender(cacheKey, result)

    return result
  }

  /**
   * Generate cache key for render result
   */
  private generateCacheKey(
    boundData: BoundData,
    template: ParsedTemplate,
    options: RenderOptions
  ): string {
    // Simple hash based on key properties
    const dataHash = this.hashObject({
      restaurantName: boundData.restaurantName,
      categoryCount: boundData.categoryBindings.length,
      itemCount: this.countItems(boundData.categoryBindings),
      colors: boundData.globalStyles.colors,
      fonts: boundData.globalStyles.fonts,
    })
    return `${template.structure.id}:${options.format}:${dataHash}`
  }

  /**
   * Simple object hash for cache keys
   */
  private hashObject(obj: any): string {
    return JSON.stringify(obj)
      .split('')
      .reduce((hash, char) => {
        const chr = char.charCodeAt(0)
        hash = (hash << 5) - hash + chr
        return hash & hash
      }, 0)
      .toString(36)
  }

  /**
   * Get cached render result if available and not expired
   */
  private getCachedRender(key: string): RenderResult | null {
    const cached = renderCache.get(key)
    if (!cached) return null

    const age = Date.now() - cached.timestamp
    if (age > CACHE_TTL) {
      renderCache.delete(key)
      return null
    }

    return cached.result
  }

  /**
   * Cache render result with size limit
   */
  private cacheRender(key: string, result: RenderResult): void {
    // Implement LRU eviction if cache is full
    if (renderCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = Array.from(renderCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
      renderCache.delete(oldestKey)
    }

    renderCache.set(key, {
      result,
      timestamp: Date.now(),
    })
  }

  /**
   * Generate CSS with caching
   */
  private generateCSSCached(template: ParsedTemplate, globalStyles: GlobalStyles): string {
    const cacheKey = `${template.structure.id}:${this.hashObject(globalStyles)}`
    
    const cached = this.cssCache.get(cacheKey)
    if (cached) return cached

    const css = this.generateCSS(template, globalStyles)
    this.cssCache.set(cacheKey, css)

    return css
  }

  /**
   * Generate semantic HTML from bound data
   * Uses incremental rendering for large menus (100+ items)
   */
  private generateHTML(boundData: BoundData, template: ParsedTemplate): string {
    const restaurantNameHtml = boundData.restaurantName
      ? `<div class="restaurant-name">${this.escapeHtml(boundData.restaurantName)}</div>`
      : ''

    const totalItems = this.countItems(boundData.categoryBindings)
    
    // Use incremental rendering for large menus
    const categoriesHtml = totalItems > 100
      ? this.renderCategoriesIncremental(boundData.categoryBindings)
      : boundData.categoryBindings
          .map((category) => this.renderCategory(category))
          .join('\n')

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Menu</title>
</head>
<body>
  <div class="menu-container">
    ${restaurantNameHtml}
    <div class="categories-container">
      ${categoriesHtml}
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Render categories incrementally with batching for better performance
   */
  private renderCategoriesIncremental(categories: CategoryBinding[]): string {
    const BATCH_SIZE = 10
    const batches: string[] = []

    for (let i = 0; i < categories.length; i += BATCH_SIZE) {
      const batch = categories.slice(i, i + BATCH_SIZE)
      const batchHtml = batch
        .map((category) => this.renderCategory(category))
        .join('\n')
      batches.push(batchHtml)
    }

    return batches.join('\n')
  }

  /**
   * Render a single category with its items
   */
  private renderCategory(category: CategoryBinding, level: number = 0): string {
    const categoryClass = level === 0 ? 'category' : 'subcategory'
    
    const itemsHtml = category.items
      .map((item) => this.renderItem(item))
      .join('\n')

    const subcategoriesHtml = category.subcategories
      ? category.subcategories
          .map((subcat) => this.renderCategory(subcat, level + 1))
          .join('\n')
      : ''

    return `
<div class="${categoryClass}" data-category-level="${level}">
  <div class="category-header">
    <h2 class="category-name">${this.escapeHtml(category.categoryName)}</h2>
  </div>
  <div class="category-items">
    ${itemsHtml}
  </div>
  ${subcategoriesHtml}
</div>
    `.trim()
  }

  /**
   * Render a single menu item
   */
  private renderItem(item: ItemBinding): string {
    const iconHtml = item.showIcon && item.icon
      ? `<img src="${this.escapeHtml(item.icon)}" alt="" class="item-icon" />`
      : ''

    const priceHtml = item.showPrice && item.price
      ? `<span class="item-price">${this.escapeHtml(item.price)}</span>`
      : ''

    const descriptionHtml = item.showDescription && item.description
      ? `<p class="item-description">${this.escapeHtml(item.description)}</p>`
      : ''

    const dietaryTagsHtml = item.showDietaryTags && item.dietaryTags && item.dietaryTags.length > 0
      ? `<div class="item-dietary-tags">${item.dietaryTags.map(tag => 
          `<span class="dietary-tag dietary-tag-${tag.type}">${this.escapeHtml(tag.label)}</span>`
        ).join('')}</div>`
      : ''

    const allergensHtml = item.showAllergens && item.allergens && item.allergens.length > 0
      ? `<div class="item-allergens"><span class="allergens-label">Allergens:</span> ${item.allergens.map(a => this.escapeHtml(a)).join(', ')}</div>`
      : ''

    const variantsHtml = item.showVariants && item.variants && item.variants.length > 0
      ? `<div class="item-variants">${item.variants.map(v => 
          `<div class="variant"><span class="variant-label">${this.escapeHtml(v.label)}</span><span class="variant-price">${this.escapeHtml(v.price)}</span></div>`
        ).join('')}</div>`
      : ''

    return `
<div class="menu-item">
  <div class="item-top-row">
    <div class="item-left-group">
      ${iconHtml}
      <span class="item-name">${this.escapeHtml(item.name)}</span>
    </div>
    <div class="item-right-group">
      ${priceHtml}
    </div>
  </div>
  ${descriptionHtml}
  ${dietaryTagsHtml}
  ${allergensHtml}
  ${variantsHtml}
</div>
    `.trim()
  }

  /**
   * Generate CSS from template and global styles
   */
  private generateCSS(template: ParsedTemplate, globalStyles: GlobalStyles): string {
    // Always include default semantic CSS to ensure a readable baseline,
    // then append compiled template CSS so it can override and refine.
    const defaultCSS = this.generateDefaultCSS()
    const compiledCSS = template.styles.css || ''
    const customCSS = this.generateCustomCSS(globalStyles)
    
    // Generate Google Fonts imports for all fonts used in the template
    const fontImports = this.generateFontImports(template.styles.fonts || [])
    
    return `
${fontImports}

${defaultCSS}

/* Compiled template CSS */
${compiledCSS}

/* Custom styles from global configuration */
${customCSS}

/* Print-specific styles */
@media print {
  body {
    margin: 0;
    padding: 0;
  }
  
  .menu-container {
    width: 100%;
  }
}
    `.trim()
  }

  /**
   * Generate Google Fonts @import statements
   */
  private generateFontImports(fonts: string[]): string {
    if (!fonts || fonts.length === 0) return ''
    
    // Build Google Fonts URL with all fonts
    const fontFamilies = fonts.map(font => {
      // Google Fonts API expects font names with + instead of spaces
      // and we want multiple weights: 400,600,700
      const encodedFont = font.replace(/\s+/g, '+')
      return `family=${encodedFont}:wght@400;600;700`
    }).join('&')
    
    const googleFontsUrl = `https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`
    
    return `@import url('${googleFontsUrl}');`
  }

  /**
   * Generate default CSS when template doesn't provide styles
   */
  private generateDefaultCSS(): string {
    return `
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif);
  line-height: 1.6;
  color: var(--color-primary, #333);
  background-color: var(--color-background, #ffffff);
}

.menu-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  /* Apply base styles here because preview injects a body-less fragment */
  background-color: var(--color-background, #ffffff);
  color: var(--color-primary, #333);
  font-family: var(--font-body, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif);
}

.restaurant-name {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 32px;
  text-align: center;
  font-family: var(--font-restaurant-name, inherit);
}

.categories-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.category {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category-header {
  border-bottom: 2px solid var(--color-category-divider, #333);
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.category-name {
  font-size: 24px;
  font-weight: 600;
  font-family: var(--font-category-name, inherit);
}

.subcategory {
  margin-left: 16px;
  margin-top: 16px;
}

.subcategory .category-name {
  font-size: 20px;
}

.category-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.menu-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.item-left-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.item-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.item-name {
  font-size: 16px;
  font-weight: 500;
  font-family: var(--font-item-name, inherit);
}

.item-right-group {
  display: flex;
  align-items: center;
}

.item-price {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  font-family: var(--font-item-price, inherit);
}

.item-description {
  font-size: 14px;
  color: var(--color-secondary, #666);
  margin-top: 4px;
  font-family: var(--font-item-description, inherit);
}

.item-dietary-tags {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.dietary-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background-color: var(--color-dietary-tag-bg, #f0f0f0);
  color: var(--color-dietary-tag-text, #666);
  text-transform: uppercase;
  font-weight: 500;
  font-family: var(--font-dietary-tags, inherit);
}

.dietary-tag-vegetarian { background-color: #d4edda; color: #155724; }
.dietary-tag-vegan { background-color: #d1ecf1; color: #0c5460; }
.dietary-tag-gluten-free { background-color: #fff3cd; color: #856404; }

.item-allergens {
  font-size: 12px;
  color: var(--color-allergen-text, #dc3545);
  margin-top: 4px;
}

.allergens-label {
  font-weight: 600;
}

.item-variants {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
  padding-left: 16px;
}

.variant {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #666;
}

.variant-label {
  font-weight: 500;
}

.variant-price {
  font-weight: 600;
}
    `.trim()
  }

  /**
   * Generate custom CSS from global styles
   */
  private generateCustomCSS(globalStyles: GlobalStyles): string {
    const colorVars = Object.entries(globalStyles.colors)
      .map(([role, value]) => `  --color-${role}: ${value};`)
      .join('\n')

    const fontVars = Object.entries(globalStyles.fonts)
      .map(([role, value]) => `  --font-${role}: ${value};`)
      .join('\n')

    return `
:root {
${colorVars}
${fontVars}
  --spacing-item: ${globalStyles.spacing.itemSpacing}px;
  --spacing-category: ${globalStyles.spacing.categorySpacing}px;
  --padding-top: ${globalStyles.spacing.padding.top}px;
  --padding-right: ${globalStyles.spacing.padding.right}px;
  --padding-bottom: ${globalStyles.spacing.padding.bottom}px;
  --padding-left: ${globalStyles.spacing.padding.left}px;
}

.menu-container {
  padding: var(--padding-top) var(--padding-right) var(--padding-bottom) var(--padding-left);
}

.categories-container {
  gap: var(--spacing-category);
}

.category-items {
  gap: var(--spacing-item);
}
    `.trim()
  }

  /**
   * Apply format-specific optimizations
   */
  private optimizeForFormat(
    html: string,
    css: string,
    format: 'html' | 'pdf' | 'png'
  ): { html: string; css: string } {
    if (format === 'pdf' || format === 'png') {
      return this.optimizeForPrint(html, css)
    }
    return { html, css }
  }

  /**
   * Optimize HTML/CSS for print output
   * Adds pagination rules to prevent awkward page breaks
   */
  private optimizeForPrint(html: string, css: string): { html: string; css: string } {
    const printCSS = `
/* Print pagination rules */
.category,
.menu-item {
  page-break-inside: avoid;
  break-inside: avoid;
}

.category-header {
  page-break-after: avoid;
  break-after: avoid;
}

/* Keep category header with at least one item */
.category-header + .category-items > .menu-item:first-child {
  page-break-before: avoid;
  break-before: avoid;
}

/* Allow controlled breaks for very long items */
.menu-item.allow-break {
  page-break-inside: auto;
  break-inside: auto;
}

/* Prevent orphaned category headers */
.category {
  orphans: 2;
  widows: 2;
}
    `.trim()

    return {
      html,
      css: `${css}\n\n${printCSS}`,
    }
  }

  /**
   * Collect assets from template
   */
  private collectAssets(template: ParsedTemplate): Array<{ type: 'image' | 'font'; url: string; embedded: boolean }> {
    const assets: Array<{ type: 'image' | 'font'; url: string; embedded: boolean }> = []

    // Add font assets
    if (template.assets?.fonts) {
      template.assets.fonts.forEach((font) => {
        assets.push({
          type: 'font',
          url: font.url,
          embedded: false,
        })
      })
    }

    // Add image assets
    if (template.assets?.images) {
      template.assets.images.forEach((image) => {
        assets.push({
          type: 'image',
          url: image.url,
          embedded: false,
        })
      })
    }

    return assets
  }

  /**
   * Generate render metadata
   */
  private generateMetadata(
    boundData: BoundData,
    template: ParsedTemplate,
    startTime: number
  ): RenderMetadata {
    const itemCount = this.countItems(boundData.categoryBindings)
    const categoryCount = this.countCategories(boundData.categoryBindings)
    const renderTime = performance.now() - startTime

    return {
      templateId: template.structure.id,
      templateVersion: '1.0.0', // Should come from template metadata
      renderedAt: new Date(),
      itemCount,
      categoryCount,
      estimatedPrintSize: this.estimatePrintSize(itemCount, categoryCount),
    }
  }

  /**
   * Count total items across all categories
   */
  private countItems(categories: CategoryBinding[]): number {
    return categories.reduce((total, category) => {
      const itemCount = category.items.length
      const subcategoryCount = category.subcategories
        ? this.countItems(category.subcategories)
        : 0
      return total + itemCount + subcategoryCount
    }, 0)
  }

  /**
   * Count total categories including subcategories
   */
  private countCategories(categories: CategoryBinding[]): number {
    return categories.reduce((total, category) => {
      const subcategoryCount = category.subcategories
        ? this.countCategories(category.subcategories)
        : 0
      return total + 1 + subcategoryCount
    }, 0)
  }

  /**
   * Estimate print size based on content
   */
  private estimatePrintSize(itemCount: number, categoryCount: number): string {
    // Rough estimation: ~10 items per page
    const estimatedPages = Math.ceil((itemCount + categoryCount * 2) / 10)
    
    if (estimatedPages === 1) return '1 page'
    if (estimatedPages <= 3) return `${estimatedPages} pages`
    return `${estimatedPages} pages (consider splitting into sections)`
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (char) => map[char])
  }

  /**
   * Clear all caches (useful for testing or memory management)
   */
  clearCache(): void {
    this.cssCache.clear()
    this.htmlFragmentCache.clear()
    renderCache.clear()
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    renderCacheSize: number
    cssCacheSize: number
    htmlFragmentCacheSize: number
  } {
    return {
      renderCacheSize: renderCache.size,
      cssCacheSize: this.cssCache.size,
      htmlFragmentCacheSize: this.htmlFragmentCache.size,
    }
  }
}

// Export singleton instance
export const renderEngine = new RenderEngine()
