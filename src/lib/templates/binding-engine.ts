/**
 * Data Binding Engine
 * 
 * Maps menu data (MenuItemV2/CategoryV2) to template placeholders and handles
 * conditional rendering based on data availability.
 */

import type {
  BindingContext,
  BoundData,
  CategoryBinding,
  ItemBinding,
  ConditionalState,
  UserCustomization,
  GlobalStyles,
  SupportedCurrency,
  PriceDisplayMode,
  DietaryTag,
  VariantBinding,
} from '@/types/templates'
import type { MenuItemV2, CategoryV2 } from '@/lib/extraction/schema-stage2'
import { SUPPORTED_CURRENCIES } from '@/types/templates'

export class BindingEngine {
  /**
   * Main binding method that maps menu data to template structure
   */
  bind(context: BindingContext): BoundData {
    const { menu, template, customization } = context

    // Bind categories recursively
    const categoryBindings = menu.categories.map((category) =>
      this.bindCategory(category, customization)
    )

    // Apply customization to global styles
    const globalStyles = this.buildGlobalStyles(template, customization)

    return {
      restaurantName: menu.restaurantName,
      categoryBindings,
      globalStyles,
    }
  }

  /**
   * Bind a single category and its items
   */
  private bindCategory(
    category: CategoryV2,
    customization?: UserCustomization
  ): CategoryBinding {
    const items = category.items.map((item) =>
      this.bindItem(item, customization)
    )

    const subcategories = category.subcategories?.map((subcat) =>
      this.bindCategory(subcat, customization)
    )

    return {
      categoryName: category.name,
      items,
      subcategories,
    }
  }

  /**
   * Bind a single menu item with all its properties
   */
  private bindItem(
    item: MenuItemV2,
    customization?: UserCustomization
  ): ItemBinding {
    const conditionals = this.resolveConditionals(item)
    
    // Format price if available
    const formattedPrice = item.price
      ? this.formatPrice(
          item.price,
          'USD', // Default currency, should come from menu context
          customization?.priceDisplayMode || 'symbol'
        )
      : undefined

    // Process dietary tags (placeholder for future implementation)
    const dietaryTags = this.extractDietaryTags(item)

    // Process allergens (placeholder for future implementation)
    const allergens = this.extractAllergens(item)

    // Process variants
    const variants = this.bindVariants(item, customization?.priceDisplayMode || 'symbol')

    return {
      name: item.name,
      price: formattedPrice,
      description: item.description,
      icon: undefined, // Will be populated when image support is added
      dietaryTags,
      allergens,
      variants,
      showPrice: conditionals.hasPrice,
      showDescription: conditionals.hasDescription,
      showIcon: conditionals.hasIcon,
      showDietaryTags: conditionals.hasDietaryTags,
      showAllergens: conditionals.hasAllergens,
      showVariants: conditionals.hasVariants,
    }
  }

  /**
   * Format price with currency using Intl.NumberFormat
   * Supports MVP currencies: SGD, USD, GBP, EUR, AUD
   */
  formatPrice(
    price: number,
    currency: string,
    mode: PriceDisplayMode = 'symbol'
  ): string {
    // Validate currency is supported
    const currencyCode = currency.toUpperCase() as SupportedCurrency
    const currencyConfig = SUPPORTED_CURRENCIES[currencyCode]

    if (!currencyConfig) {
      // Fallback to USD if currency not supported
      console.warn(`Currency ${currency} not supported, falling back to USD`)
      return this.formatPrice(price, 'USD', mode)
    }

    const formatter = new Intl.NumberFormat(currencyConfig.locale, {
      style: 'currency',
      currency: currencyConfig.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    const formatted = formatter.format(price)

    // For amount-only mode, strip the currency symbol
    if (mode === 'amount-only') {
      // Remove currency symbols and trim whitespace
      return formatted
        .replace(/[^\d.,\s-]/g, '')
        .trim()
    }

    return formatted
  }

  /**
   * Resolve conditional visibility based on item data
   */
  resolveConditionals(item: MenuItemV2): ConditionalState {
    return {
      hasPrice: typeof item.price === 'number' || !!(item.variants && item.variants.length > 0),
      hasDescription: !!item.description && item.description.trim().length > 0,
      hasIcon: false, // Will be true when image support is added
      hasDietaryTags: false, // Placeholder for future implementation
      hasAllergens: false, // Placeholder for future implementation
      hasVariants: !!(item.variants && item.variants.length > 0),
    }
  }

  /**
   * Extract dietary tags from item
   * Placeholder for future implementation when dietary info is added to schema
   */
  private extractDietaryTags(item: MenuItemV2): DietaryTag[] | undefined {
    // TODO: Implement when dietary information is added to MenuItemV2 schema
    // For now, could parse from description or notes
    return undefined
  }

  /**
   * Extract allergens from item
   * Placeholder for future implementation when allergen info is added to schema
   */
  private extractAllergens(item: MenuItemV2): string[] | undefined {
    // TODO: Implement when allergen information is added to MenuItemV2 schema
    return undefined
  }

  /**
   * Bind item variants with formatted prices
   */
  private bindVariants(
    item: MenuItemV2,
    priceDisplayMode: PriceDisplayMode
  ): VariantBinding[] | undefined {
    if (!item.variants || item.variants.length === 0) {
      return undefined
    }

    return item.variants.map((variant) => ({
      label: variant.size || 'Standard',
      price: this.formatPrice(variant.price, 'USD', priceDisplayMode),
    }))
  }

  /**
   * Apply user customization to template styles
   */
  applyCustomization(
    baseStyles: GlobalStyles,
    customization?: UserCustomization
  ): GlobalStyles {
    if (!customization) {
      return baseStyles
    }

    const customizedStyles: GlobalStyles = {
      ...baseStyles,
      colors: { ...baseStyles.colors },
      fonts: { ...baseStyles.fonts },
    }

    // Apply color customizations
    if (customization.colors) {
      Object.entries(customization.colors).forEach(([role, value]) => {
        if (value) {
          customizedStyles.colors[role] = value
        }
      })
    }

    // Apply font customizations
    if (customization.fonts) {
      Object.entries(customization.fonts).forEach(([role, value]) => {
        if (value) {
          customizedStyles.fonts[role] = value
        }
      })
    }

    return customizedStyles
  }

  /**
   * Build global styles from template configuration
   */
  private buildGlobalStyles(
    template: any,
    customization?: UserCustomization
  ): GlobalStyles {
    const baseStyles: GlobalStyles = {
      colors: {},
      fonts: {},
      spacing: template.styling?.spacing || {
        itemSpacing: 16,
        categorySpacing: 32,
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
      },
    }

    // Extract colors from template styling
    if (template.styling?.colors) {
      template.styling.colors.forEach((color: any) => {
        baseStyles.colors[color.role] = color.value
      })
    }

    // Extract fonts from template styling
    if (template.styling?.fonts) {
      template.styling.fonts.forEach((font: any) => {
        baseStyles.fonts[font.role] = font.family
      })
    }

    // Apply customization
    return this.applyCustomization(baseStyles, customization)
  }
}

// Export singleton instance
export const bindingEngine = new BindingEngine()
