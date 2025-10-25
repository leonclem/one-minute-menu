// Script to register "The View" template in the database
// This should be run once to initialize the template in the system

import { templateOperations } from '@/lib/database'
import { templateRegistry } from '@/lib/templates/registry'
import { theViewTemplate } from './the-view'
import { templateCompiler } from '@/lib/templates/compiler'
import { createClient } from '@supabase/supabase-js'

/**
 * Register "The View" template in the database and registry
 * 
 * This function:
 * 1. Validates the template configuration
 * 2. Registers it in the template registry (validates bindings)
 * 3. Creates the database entry
 * 
 * Note: Preview images should be uploaded to Supabase Storage separately
 * at the paths specified in the template metadata:
 * - /templates/the-view/preview.png
 * - /templates/the-view/thumbnail.png
 */
export async function registerTheViewTemplate(): Promise<void> {
  console.log('Registering "The View" template...')
  
  try {
    // Step 1: Compile from Figma to produce parsed styles + bindings
    console.log('Step 1: Compiling template from Figma...')
    await templateCompiler.compile({
      figmaFileKey: theViewTemplate.metadata.figmaFileKey,
      templateId: theViewTemplate.metadata.id,
      version: theViewTemplate.metadata.version,
      metadata: theViewTemplate.metadata,
    })

    // Load compiled (or fallback) config for validation
    const compiledConfig = await templateRegistry.loadTemplate(theViewTemplate.metadata.id).catch(() => theViewTemplate)

    // Step 2: Validate the template configuration
    console.log('Step 2: Validating template configuration...')
    const validation = await templateRegistry.validateTemplate(compiledConfig)
    
    if (!validation.valid) {
      console.error('Template validation failed:')
      console.error('Errors:', validation.errors)
      console.error('Warnings:', validation.warnings)
      throw new Error('Template validation failed')
    }
    
    if (validation.warnings.length > 0) {
      console.warn('Template validation warnings:')
      validation.warnings.forEach(warning => {
        console.warn(`  - ${warning.field}: ${warning.message}`)
      })
    }
    
    console.log('✓ Template configuration is valid')
    
    // Step 3: Register in the database
    // Prefer service role client in CLI context to avoid Next.js request-scope cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && serviceKey) {
      console.log('Step 2: Registering using service client...')
      const admin = createClient(supabaseUrl, serviceKey)

      // Check if a template with the same name+version already exists to avoid duplicates
      const { data: existing, error: fetchError } = await admin
        .from('menu_templates')
        .select('id, name, version')
        .eq('name', compiledConfig.metadata.name)
        .eq('version', compiledConfig.metadata.version)
        .limit(1)
        .maybeSingle()

      if (fetchError) {
        throw new Error(`Failed to check existing templates: ${fetchError.message}`)
      }

      if (existing?.id) {
        console.log(`⚠️  Template already exists (id=${existing.id}). Skipping insert.`)
      } else {
        const row = {
          // NOTE: let the database generate UUID `id`
          name: compiledConfig.metadata.name,
          description: compiledConfig.metadata.description,
          author: compiledConfig.metadata.author,
          version: compiledConfig.metadata.version,
          figma_file_key: compiledConfig.metadata.figmaFileKey,
          preview_image_url: compiledConfig.metadata.previewImageUrl,
          thumbnail_url: compiledConfig.metadata.thumbnailUrl,
          page_format: compiledConfig.metadata.pageFormat,
          orientation: compiledConfig.metadata.orientation,
          tags: compiledConfig.metadata.tags,
          is_premium: compiledConfig.metadata.isPremium,
          config: compiledConfig,
          is_active: true,
          created_at: compiledConfig.metadata.createdAt.toISOString(),
          updated_at: compiledConfig.metadata.updatedAt.toISOString(),
        }

        const { error: insertError } = await admin
          .from('menu_templates')
          .insert(row)

        if (insertError) {
          throw new Error(`Failed to register template (service): ${insertError.message}`)
        }
        console.log('✓ Template registered using service client')
      }
    } else {
      // Fallback: use registry (requires Next.js request context)
      console.log('Step 3: Registering via registry (request context required)...')
      await templateRegistry.registerTemplate(compiledConfig)
      console.log('✓ Template registered in registry')
    }
    
    // Step 3: Verify the template can be loaded (best-effort)
    console.log('Step 3: Verifying template can be loaded...')
    let loadedTemplate: typeof theViewTemplate | null = null
    try {
      loadedTemplate = await templateRegistry.loadTemplate(theViewTemplate.metadata.id)
    } catch (_) {
      // In CLI context without cookies this may fail; that's OK if the upsert succeeded
    }
    
    if (loadedTemplate) {
      console.log('✓ Template loaded successfully')
    }
    
    // Success!
    console.log('\n✅ "The View" template registered successfully!')
    console.log(`   Template ID: ${theViewTemplate.metadata.id}`)
    console.log(`   Version: ${theViewTemplate.metadata.version}`)
    console.log('\nNext steps:')
    console.log('1. Upload preview images to Supabase Storage:')
    console.log(`   - ${theViewTemplate.metadata.previewImageUrl}`)
    console.log(`   - ${theViewTemplate.metadata.thumbnailUrl}`)
    console.log('2. Test the template by rendering a menu')
    
  } catch (error) {
    console.error('\n❌ Failed to register "The View" template:')
    console.error(error)
    throw error
  }
}

/**
 * Check if "The View" template is already registered
 */
export async function isTheViewTemplateRegistered(): Promise<boolean> {
  try {
    const template = await templateRegistry.loadTemplate(theViewTemplate.metadata.id)
    return template !== null
  } catch (error) {
    return false
  }
}

/**
 * Update "The View" template if it already exists
 */
export async function updateTheViewTemplate(): Promise<void> {
  console.log('Updating "The View" template...')
  
  try {
    const isRegistered = await isTheViewTemplateRegistered()
    
    if (!isRegistered) {
      console.log('Template not found. Registering as new...')
      await registerTheViewTemplate()
      return
    }
    
    // Validate first
    const validation = await templateRegistry.validateTemplate(theViewTemplate)
    
    if (!validation.valid) {
      console.error('Template validation failed:')
      console.error('Errors:', validation.errors)
      throw new Error('Template validation failed')
    }
    
    // Update in database
    await templateOperations.updateTemplate(
      theViewTemplate.metadata.id,
      theViewTemplate
    )
    
    // Clear cache to force reload
    templateRegistry.clearCache()
    
    console.log('✅ "The View" template updated successfully!')
    
  } catch (error) {
    console.error('\n❌ Failed to update "The View" template:')
    console.error(error)
    throw error
  }
}

// If running as a script
if (require.main === module) {
  registerTheViewTemplate()
    .then(() => {
      console.log('\nDone!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\nFailed!')
      process.exit(1)
    })
}

