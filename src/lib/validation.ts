import { VALIDATION_RULES } from '@/types'
import type { MenuFormData, MenuItemFormData, CreateMenuFormData } from '@/types'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// Menu validation
export function validateMenu(data: Partial<MenuFormData>): ValidationResult {
  const errors: ValidationError[] = []
  
  // Validate name
  if (!data.name) {
    errors.push({ field: 'name', message: 'Menu name is required' })
  } else if (data.name.length < VALIDATION_RULES.menu.name.minLength) {
    errors.push({ field: 'name', message: 'Menu name is too short' })
  } else if (data.name.length > VALIDATION_RULES.menu.name.maxLength) {
    errors.push({ field: 'name', message: 'Menu name is too long' })
  }
  
  // Validate items if provided
  if (data.items) {
    data.items.forEach((item, index) => {
      const itemErrors = validateMenuItem(item)
      itemErrors.errors.forEach(error => {
        errors.push({
          field: `items.${index}.${error.field}`,
          message: error.message
        })
      })
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Menu item validation
export function validateMenuItem(data: Partial<MenuItemFormData>): ValidationResult {
  const errors: ValidationError[] = []
  
  // Validate name
  if (!data.name) {
    errors.push({ field: 'name', message: 'Item name is required' })
  } else if (data.name.length < VALIDATION_RULES.menuItem.name.minLength) {
    errors.push({ field: 'name', message: 'Item name is too short' })
  } else if (data.name.length > VALIDATION_RULES.menuItem.name.maxLength) {
    errors.push({ field: 'name', message: 'Item name is too long' })
  }
  
  // Validate description
  if (data.description && data.description.length > VALIDATION_RULES.menuItem.description.maxLength) {
    errors.push({ field: 'description', message: 'Description is too long' })
  }
  
  // Validate price
  if (data.price === undefined || data.price === null) {
    errors.push({ field: 'price', message: 'Price is required' })
  } else if (data.price < VALIDATION_RULES.menuItem.price.min) {
    errors.push({ field: 'price', message: 'Price cannot be negative' })
  } else if (data.price > VALIDATION_RULES.menuItem.price.max) {
    errors.push({ field: 'price', message: 'Price is too high' })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Create menu validation
export function validateCreateMenu(data: Partial<CreateMenuFormData>): ValidationResult {
  const errors: ValidationError[] = []
  
  // Validate name
  if (!data.name) {
    errors.push({ field: 'name', message: 'Menu name is required' })
  } else if (data.name.length < VALIDATION_RULES.menu.name.minLength) {
    errors.push({ field: 'name', message: 'Menu name is too short' })
  } else if (data.name.length > VALIDATION_RULES.menu.name.maxLength) {
    errors.push({ field: 'name', message: 'Menu name is too long' })
  }
  
  // Validate slug if provided
  if (data.slug) {
    if (data.slug.length < VALIDATION_RULES.menu.slug.minLength) {
      errors.push({ field: 'slug', message: 'Slug is too short' })
    } else if (data.slug.length > VALIDATION_RULES.menu.slug.maxLength) {
      errors.push({ field: 'slug', message: 'Slug is too long' })
    } else if (!VALIDATION_RULES.menu.slug.pattern.test(data.slug)) {
      errors.push({ field: 'slug', message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
    }
  }

  // Validate establishmentType if provided
  if (data.establishmentType && data.establishmentType.length > 50) {
    errors.push({ field: 'establishmentType', message: 'Establishment type is too long' })
  }

  // Validate primaryCuisine if provided
  if (data.primaryCuisine && data.primaryCuisine.length > 50) {
    errors.push({ field: 'primaryCuisine', message: 'Primary cuisine is too long' })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Slug generation and validation
export function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, VALIDATION_RULES.menu.slug.maxLength)
}

export function isValidSlug(slug: string): boolean {
  return VALIDATION_RULES.menu.slug.pattern.test(slug) &&
         slug.length >= VALIDATION_RULES.menu.slug.minLength &&
         slug.length <= VALIDATION_RULES.menu.slug.maxLength
}

// Price formatting and validation
export function formatPrice(price: number, currency = 'SGD'): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(price)
}

export function parsePrice(priceString: string): number | null {
  const cleaned = priceString.replace(/[^\d.-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}

// Form field helpers
export function getFieldError(errors: ValidationError[], fieldName: string): string | undefined {
  const error = errors.find(e => e.field === fieldName)
  return error?.message
}

export function hasFieldError(errors: ValidationError[], fieldName: string): boolean {
  return errors.some(e => e.field === fieldName)
}

// Sanitization helpers
export function sanitizeMenuName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function sanitizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, ' ')
}

// Menu item helpers
export function calculateMenuTotal(items: MenuItemFormData[]): number {
  return items
    .filter(item => item.available)
    .reduce((total, item) => total + item.price, 0)
}

export function getMenuCategories(items: MenuItemFormData[]): string[] {
  const categories = new Set(
    items
      .map(item => item.category)
      .filter((category): category is string => Boolean(category))
  )
  return Array.from(categories).sort()
}

export function groupItemsByCategory(items: MenuItemFormData[]): Record<string, MenuItemFormData[]> {
  const grouped: Record<string, MenuItemFormData[]> = {}
  
  items.forEach(item => {
    const category = item.category || 'Uncategorized'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(item)
  })
  
  return grouped
}