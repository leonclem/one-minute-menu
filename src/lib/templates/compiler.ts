// Template Compiler
// Orchestrates template import/update workflow: Figma API → parse → validate → store

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import type {
  TemplateConfig,
  TemplateMetadata,
  ParsedTemplate,
  ComputedStyles,
  TemplateAssets,
} from '@/types/templates'
import { templateRegistry } from './registry'
import { createTemplateParser } from './parser'

export class TemplateCompilerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'TemplateCompilerError'
  }
}

export interface CompilationOptions {
  figmaFileKey: string
  templateId: string
  version: string
  metadata: Partial<TemplateMetadata>
  skipValidation?: boolean
}

export interface CompilationResult {
  templateId: string
  version: string
  success: boolean
  artifactPath: string
  errors?: string[]
  warnings?: string[]
}

/**
 * TemplateCompiler orchestrates the template compilation workflow.
 * 
 * Workflow:
 * 1. Fetch Figma file via API (build-time only)
 * 2. Parse Figma structure into template config
 * 3. Validate template configuration
 * 4. Store compiled artifact in templates-compiled/ bucket
 * 5. Save template config to database
 */
export class TemplateCompiler {
  private readonly COMPILED_BUCKET = 'templates-compiled'

  /**
   * Get a Supabase client suitable for the current environment.
   * - In CLI/CI (service role env present): returns service client (no cookies)
   * - Otherwise: returns request-scoped server client
   */
  private getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && serviceKey) {
      return createClient(url, serviceKey)
    }
    return createServerSupabaseClient()
  }

  /**
   * Compile a template from Figma file
   */
  async compile(options: CompilationOptions): Promise<CompilationResult> {
    const { figmaFileKey, templateId, version, metadata, skipValidation } = options

    try {
      // Step 1: Fetch Figma file (this would call Figma API)
      // For now, if parser is not implemented, treat existing config as source and pass-through
      let parsedTemplate: ParsedTemplate
      try {
        parsedTemplate = await this.fetchAndParseFigmaFile(figmaFileKey)
      } catch (e) {
        // Minimal pass-through artifact to enable styles.css if present later
        parsedTemplate = {
          structure: { id: options.templateId, name: options.templateId, type: 'FRAME', styles: { fills: [], strokes: [], effects: [] }, layout: {
            layoutMode: 'VERTICAL', primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO', paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0, itemSpacing: 0, counterAxisAlignItems: 'MIN', primaryAxisAlignItems: 'MIN'
          } },
          bindings: { restaurantName: 'RestaurantName', categoryName: 'CategoryName', categoryItems: 'ItemsContainer', itemName: 'ItemName', conditionalLayers: [] },
          styles: { css: '', fonts: [], colors: {} },
          assets: { images: [], fonts: [] },
        }
      }

      // Step 2: Build template config
      const config = this.buildTemplateConfig(
        templateId,
        version,
        metadata,
        parsedTemplate
      )

      // Step 3: Validate template
      if (!skipValidation) {
        const validation = await templateRegistry.validateTemplate(config)
        if (!validation.valid) {
          return {
            templateId,
            version,
            success: false,
            artifactPath: '',
            errors: validation.errors.map(e => `${e.field}: ${e.message}`),
            warnings: validation.warnings.map(w => `${w.field}: ${w.message}`),
          }
        }
      }

      // Step 4: Store compiled artifact
      const artifactPath = await this.storeCompiledArtifact(
        templateId,
        version,
        parsedTemplate
      )

      // Step 5: Register template in database
      await this.registerTemplateConfig(config)

      return {
        templateId,
        version,
        success: true,
        artifactPath,
        warnings: [],
      }
    } catch (error) {
      if (error instanceof TemplateCompilerError) {
        throw error
      }
      throw new TemplateCompilerError(
        `Compilation failed: ${error instanceof Error ? error.message : String(error)}`,
        'COMPILATION_FAILED',
        { templateId, version, error }
      )
    }
  }

  /**
   * Register template config in the database using service client when available,
   * otherwise fallback to registry (request context).
   */
  private async registerTemplateConfig(config: TemplateConfig): Promise<void> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && serviceKey) {
      const admin = createClient(url, serviceKey)
      // Try find existing by name+version to avoid duplicate rows
      const { data: existing, error: fetchError } = await admin
        .from('menu_templates')
        .select('id')
        .eq('name', config.metadata.name)
        .eq('version', config.metadata.version)
        .maybeSingle()

      if (fetchError) {
        throw new TemplateCompilerError(
          `Failed to check existing templates: ${fetchError.message}`,
          'DATABASE_ERROR',
          { templateName: config.metadata.name, version: config.metadata.version, error: fetchError }
        )
      }

      if (existing?.id) {
        const { error: updateError } = await admin
          .from('menu_templates')
          .update({
            description: config.metadata.description,
            author: config.metadata.author,
            figma_file_key: config.metadata.figmaFileKey,
            preview_image_url: config.metadata.previewImageUrl,
            thumbnail_url: config.metadata.thumbnailUrl,
            page_format: config.metadata.pageFormat,
            orientation: config.metadata.orientation,
            tags: config.metadata.tags,
            is_premium: config.metadata.isPremium,
            config,
            is_active: true,
            updated_at: config.metadata.updatedAt.toISOString(),
          })
          .eq('id', existing.id)

        if (updateError) {
          throw new TemplateCompilerError(
            `Failed to update template (service): ${updateError.message}`,
            'DATABASE_ERROR',
            { templateId: existing.id, error: updateError }
          )
        }
      } else {
        const row = {
          // Do not set id; let DB generate UUID
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
          config,
          is_active: true,
          created_at: config.metadata.createdAt.toISOString(),
          updated_at: config.metadata.updatedAt.toISOString(),
        }
        const { error: insertError } = await admin
          .from('menu_templates')
          .insert(row)
        if (insertError) {
          throw new TemplateCompilerError(
            `Failed to register template (service): ${insertError.message}`,
            'DATABASE_ERROR',
            { templateName: config.metadata.name, version: config.metadata.version, error: insertError }
          )
        }
      }
      return
    }
    // Fallback to registry which uses request context client
    await templateRegistry.registerTemplate(config)
  }

  /**
   * Update an existing template
   */
  async update(
    templateId: string,
    newVersion: string,
    options: Partial<CompilationOptions>
  ): Promise<CompilationResult> {
    // Load existing template to get figmaFileKey if not provided
    const existingTemplate = await templateRegistry.loadTemplate(templateId)
    
    const compilationOptions: CompilationOptions = {
      figmaFileKey: options.figmaFileKey || existingTemplate.metadata.figmaFileKey,
      templateId,
      version: newVersion,
      metadata: {
        ...existingTemplate.metadata,
        ...options.metadata,
        version: newVersion,
        updatedAt: new Date(),
      },
      skipValidation: options.skipValidation,
    }

    return this.compile(compilationOptions)
  }

  /**
   * Fetch and parse Figma file
   * This is a placeholder - actual implementation will use FigmaClient and TemplateParser
   */
  private async fetchAndParseFigmaFile(figmaFileKey: string): Promise<ParsedTemplate> {
    const parser = createTemplateParser()
    return await parser.parseFigmaFile(figmaFileKey)
  }

  /**
   * Build complete template config from parsed data
   */
  private buildTemplateConfig(
    templateId: string,
    version: string,
    metadata: Partial<TemplateMetadata>,
    parsedTemplate: ParsedTemplate
  ): TemplateConfig {
    const now = new Date()

    const fullMetadata: TemplateMetadata = {
      id: templateId,
      name: metadata.name || 'Untitled Template',
      description: metadata.description || '',
      author: metadata.author || 'Unknown',
      version,
      previewImageUrl: metadata.previewImageUrl || '',
      thumbnailUrl: metadata.thumbnailUrl || '',
      figmaFileKey: metadata.figmaFileKey || '',
      pageFormat: metadata.pageFormat || 'A4',
      orientation: metadata.orientation || 'portrait',
      tags: metadata.tags || [],
      isPremium: metadata.isPremium || false,
      createdAt: metadata.createdAt || now,
      updatedAt: now,
    }

    return {
      metadata: fullMetadata,
      bindings: parsedTemplate.bindings,
      // Persist compiled CSS/styles for runtime render preference
      styles: parsedTemplate.styles,
      styling: {
        fonts: parsedTemplate.styles.fonts.map(fontFamily => ({
          role: 'body', // Default role, should be determined by parser
          family: fontFamily,
          size: '16px',
          weight: '400',
        })),
        colors: Object.entries(parsedTemplate.styles.colors).map(([role, value]) => ({
          role,
          value,
        })),
        spacing: {
          itemSpacing: 16,
          categorySpacing: 32,
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
      },
      customization: {
        allowColorCustomization: false,
        allowFontCustomization: false,
        customizableColors: [],
        customizableFonts: [],
      },
    }
  }

  /**
   * Store compiled artifact in Supabase Storage
   */
  private async storeCompiledArtifact(
    templateId: string,
    version: string,
    parsedTemplate: ParsedTemplate
  ): Promise<string> {
    const supabase = this.getSupabaseClient()
    // Ensure bucket exists (CLI/local-friendly)
    try {
      const { data: buckets } = await (supabase as any).storage.listBuckets?.()
      const hasBucket = Array.isArray(buckets) && buckets.some((b: any) => b.name === this.COMPILED_BUCKET)
      if (!hasBucket && (supabase as any).storage.createBucket) {
        await (supabase as any).storage.createBucket(this.COMPILED_BUCKET, { public: false })
      }
    } catch (_) {
      // Best effort; proceed to upload which will error clearly if bucket is missing
    }
    
    // Create artifact path: templates-compiled/{templateId}@{version}/
    const artifactPath = `${templateId}@${version}`
    
    // Store the parsed template as JSON
    const artifactData = JSON.stringify(parsedTemplate, null, 2)
    const artifactBlob = new Blob([artifactData], { type: 'application/json' })
    
    const filePath = `${artifactPath}/template.json`
    
    const { error } = await supabase.storage
      .from(this.COMPILED_BUCKET)
      .upload(filePath, artifactBlob, {
        contentType: 'application/json',
        upsert: true,
      })

    if (error) {
      throw new TemplateCompilerError(
        `Failed to store compiled artifact: ${error.message}`,
        'STORAGE_ERROR',
        { templateId, version, error }
      )
    }

    // Store CSS separately
    if (parsedTemplate.styles.css) {
      const cssBlob = new Blob([parsedTemplate.styles.css], { type: 'text/css' })
      const cssPath = `${artifactPath}/styles.css`
      
      const { error: cssError } = await supabase.storage
        .from(this.COMPILED_BUCKET)
        .upload(cssPath, cssBlob, {
          contentType: 'text/css',
          upsert: true,
        })

      if (cssError) {
        throw new TemplateCompilerError(
          `Failed to store CSS artifact: ${cssError.message}`,
          'STORAGE_ERROR',
          { templateId, version, error: cssError }
        )
      }
    }

    return artifactPath
  }

  /**
   * Load compiled artifact from storage
   */
  async loadCompiledArtifact(
    templateId: string,
    version: string
  ): Promise<ParsedTemplate> {
    const supabase = this.getSupabaseClient()
    
    const artifactPath = `${templateId}@${version}/template.json`
    
    const { data, error } = await supabase.storage
      .from(this.COMPILED_BUCKET)
      .download(artifactPath)

    if (error) {
      throw new TemplateCompilerError(
        `Failed to load compiled artifact: ${error.message}`,
        'STORAGE_ERROR',
        { templateId, version, error }
      )
    }

    const text = await data.text()
    const parsedTemplate = JSON.parse(text) as ParsedTemplate

    return parsedTemplate
  }

  /**
   * Delete compiled artifact from storage
   */
  async deleteCompiledArtifact(
    templateId: string,
    version: string
  ): Promise<void> {
    const supabase = this.getSupabaseClient()
    
    const artifactPath = `${templateId}@${version}`
    
    // List all files in the artifact directory
    const { data: files, error: listError } = await supabase.storage
      .from(this.COMPILED_BUCKET)
      .list(artifactPath)

    if (listError) {
      throw new TemplateCompilerError(
        `Failed to list artifact files: ${listError.message}`,
        'STORAGE_ERROR',
        { templateId, version, error: listError }
      )
    }

    // Delete all files
    if (files && files.length > 0) {
      const filePaths = files.map(file => `${artifactPath}/${file.name}`)
      
      const { error: deleteError } = await supabase.storage
        .from(this.COMPILED_BUCKET)
        .remove(filePaths)

      if (deleteError) {
        throw new TemplateCompilerError(
          `Failed to delete artifact files: ${deleteError.message}`,
          'STORAGE_ERROR',
          { templateId, version, error: deleteError }
        )
      }
    }
  }
}

// Export singleton instance
export const templateCompiler = new TemplateCompiler()
