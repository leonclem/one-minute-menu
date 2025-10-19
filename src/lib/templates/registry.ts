// Template Registry
// Central registry for managing template configurations and compiled artifacts

import { createServerSupabaseClient } from '@/lib/supabase-server'
import type {
  TemplateConfig,
  TemplateMetadata,
  TemplateFilters,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '@/types/templates'

export class TemplateRegistryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'TemplateRegistryError'
  }
}

/**
 * TemplateRegistry manages template configurations and compiled artifacts.
 * 
 * Templates are compiled at build-time/import and stored in:
 * - Database: template metadata and configuration
 * - Storage: compiled artifacts (templates-compiled/ bucket)
 * 
 * At runtime, the registry loads compiled artifacts from storage and caches them in memory.
 */
export class TemplateRegistry {
  private templateCache: Map<string, TemplateConfig> = new Map()
  private cacheTimestamps: Map<string, number> = new Map()
  private readonly CACHE_TTL = 1000 * 60 * 60 // 1 hour

  /**
   * Load a template by ID from cache or storage
   */
  async loadTemplate(templateId: string): Promise<TemplateConfig> {
    // Check cache first
    const cached = this.getCachedTemplate(templateId)
    if (cached) {
      return cached
    }

    // Load from database and storage
    const supabase = createServerSupabaseClient()
    
    // Get template metadata from database
    const { data: templateData, error: dbError } = await supabase
      .from('menu_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single()

    if (dbError) {
      if (dbError.code === 'PGRST116') {
        throw new TemplateRegistryError(
          `Template not found: ${templateId}`,
          'TEMPLATE_NOT_FOUND',
          { templateId }
        )
      }
      throw new TemplateRegistryError(
        `Failed to load template: ${dbError.message}`,
        'DATABASE_ERROR',
        { templateId, error: dbError }
      )
    }

    // Parse the config from JSONB
    const config = this.parseTemplateConfig(templateData)
    
    // Cache the template
    this.cacheTemplate(templateId, config)
    
    return config
  }

  /**
   * List available templates with optional filtering
   */
  async listTemplates(filters?: TemplateFilters): Promise<TemplateMetadata[]> {
    const supabase = createServerSupabaseClient()
    
    let query = supabase
      .from('menu_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags)
    }

    if (filters?.pageFormat) {
      query = query.eq('page_format', filters.pageFormat)
    }

    if (filters?.orientation) {
      query = query.eq('orientation', filters.orientation)
    }

    if (filters?.isPremium !== undefined) {
      query = query.eq('is_premium', filters.isPremium)
    }

    if (filters?.searchQuery) {
      query = query.or(`name.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`)
    }

    const { data, error } = await query

    if (error) {
      throw new TemplateRegistryError(
        `Failed to list templates: ${error.message}`,
        'DATABASE_ERROR',
        { filters, error }
      )
    }

    return data.map(row => this.parseTemplateMetadata(row))
  }

  /**
   * Register a new template in the registry
   */
  async registerTemplate(config: TemplateConfig): Promise<void> {
    // Validate the template first
    const validation = await this.validateTemplate(config)
    if (!validation.valid) {
      throw new TemplateRegistryError(
        'Template validation failed',
        'INVALID_TEMPLATE_CONFIG',
        { errors: validation.errors, warnings: validation.warnings }
      )
    }

    const supabase = createServerSupabaseClient()

    // Prepare database row
    const row = {
      id: config.metadata.id,
      name: config.metadata.name,
      description: config.metadata.description,
      author: config.metadata.author,
      version: config.metadata.version,
      figma_file_key: config.metadata.figmaFileKey,
      preview_image_url: config.metadata.previewImageUrl,
      thumbnail_url: config.metadata.thumbnailUrl,
      page_format: config.metadata.pageFormat,
      orientation: config.metadata.orientation,
      tags: config.metadata.tags,
      is_premium: config.metadata.isPremium,
      config: config, // Store entire config as JSONB
      is_active: true,
      created_at: config.metadata.createdAt.toISOString(),
      updated_at: config.metadata.updatedAt.toISOString(),
    }

    const { error } = await supabase
      .from('menu_templates')
      .upsert(row, { onConflict: 'id' })

    if (error) {
      throw new TemplateRegistryError(
        `Failed to register template: ${error.message}`,
        'DATABASE_ERROR',
        { templateId: config.metadata.id, error }
      )
    }

    // Invalidate cache for this template
    this.invalidateCache(config.metadata.id)
  }

  /**
   * Validate a template configuration
   */
  async validateTemplate(config: TemplateConfig): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Validate metadata
    if (!config.metadata.id) {
      errors.push({
        field: 'metadata.id',
        message: 'Template ID is required',
        code: 'MISSING_ID',
      })
    }

    if (!config.metadata.name) {
      errors.push({
        field: 'metadata.name',
        message: 'Template name is required',
        code: 'MISSING_NAME',
      })
    }

    if (!config.metadata.version) {
      errors.push({
        field: 'metadata.version',
        message: 'Template version is required',
        code: 'MISSING_VERSION',
      })
    }

    // Validate required bindings
    const requiredBindings = ['restaurantName', 'categoryName', 'categoryItems', 'itemName']
    for (const binding of requiredBindings) {
      if (!config.bindings[binding as keyof typeof config.bindings]) {
        errors.push({
          field: `bindings.${binding}`,
          message: `Required binding '${binding}' is missing`,
          code: 'MISSING_REQUIRED_BINDING',
        })
      }
    }

    // Validate conditional layers reference valid bindings
    for (const conditional of config.bindings.conditionalLayers) {
      const validConditions = ['hasPrice', 'hasDescription', 'hasIcon', 'hasDietaryTags', 'hasAllergens', 'hasVariants']
      if (!validConditions.includes(conditional.condition)) {
        errors.push({
          field: 'bindings.conditionalLayers',
          message: `Invalid condition: ${conditional.condition}`,
          code: 'INVALID_CONDITION',
        })
      }
    }

    // Validate styling
    if (!config.styling.fonts || config.styling.fonts.length === 0) {
      warnings.push({
        field: 'styling.fonts',
        message: 'No fonts defined in template styling',
        code: 'NO_FONTS',
      })
    }

    if (!config.styling.colors || config.styling.colors.length === 0) {
      warnings.push({
        field: 'styling.colors',
        message: 'No colors defined in template styling',
        code: 'NO_COLORS',
      })
    }

    // Validate customization options
    if (config.customization.allowColorCustomization && config.customization.customizableColors.length === 0) {
      warnings.push({
        field: 'customization.customizableColors',
        message: 'Color customization is enabled but no customizable colors are defined',
        code: 'NO_CUSTOMIZABLE_COLORS',
      })
    }

    if (config.customization.allowFontCustomization && config.customization.customizableFonts.length === 0) {
      warnings.push({
        field: 'customization.customizableFonts',
        message: 'Font customization is enabled but no customizable fonts are defined',
        code: 'NO_CUSTOMIZABLE_FONTS',
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Get a template from cache if available and not expired
   */
  private getCachedTemplate(templateId: string): TemplateConfig | null {
    const cached = this.templateCache.get(templateId)
    const timestamp = this.cacheTimestamps.get(templateId)

    if (!cached || !timestamp) {
      return null
    }

    // Check if cache is expired
    if (Date.now() - timestamp > this.CACHE_TTL) {
      this.invalidateCache(templateId)
      return null
    }

    return cached
  }

  /**
   * Cache a template configuration
   */
  private cacheTemplate(templateId: string, config: TemplateConfig): void {
    this.templateCache.set(templateId, config)
    this.cacheTimestamps.set(templateId, Date.now())
  }

  /**
   * Invalidate cache for a specific template
   */
  private invalidateCache(templateId: string): void {
    this.templateCache.delete(templateId)
    this.cacheTimestamps.delete(templateId)
  }

  /**
   * Clear all cached templates
   */
  clearCache(): void {
    this.templateCache.clear()
    this.cacheTimestamps.clear()
  }

  /**
   * Parse template metadata from database row
   */
  private parseTemplateMetadata(row: any): TemplateMetadata {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      author: row.author,
      version: row.version,
      previewImageUrl: row.preview_image_url,
      thumbnailUrl: row.thumbnail_url,
      figmaFileKey: row.figma_file_key,
      pageFormat: row.page_format,
      orientation: row.orientation,
      tags: row.tags || [],
      isPremium: row.is_premium,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  /**
   * Parse full template config from database row
   */
  private parseTemplateConfig(row: any): TemplateConfig {
    // The config is stored as JSONB, so we can directly use it
    // but we need to ensure dates are properly parsed
    const config = row.config as TemplateConfig
    
    // Ensure metadata dates are Date objects
    config.metadata.createdAt = new Date(config.metadata.createdAt)
    config.metadata.updatedAt = new Date(config.metadata.updatedAt)
    
    return config
  }
}

// Export a singleton instance
export const templateRegistry = new TemplateRegistry()
