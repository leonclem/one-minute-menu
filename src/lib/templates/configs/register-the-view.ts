// Script to register "The View" template in the database
// This should be run once to initialize the template in the system

import { templateOperations } from '@/lib/database'
import { templateRegistry } from '@/lib/templates/registry'
import { theViewTemplate } from './the-view'

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
    // Step 1: Validate the template configuration
    console.log('Step 1: Validating template configuration...')
    const validation = await templateRegistry.validateTemplate(theViewTemplate)
    
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
    
    // Step 2: Register in the template registry
    console.log('Step 2: Registering in template registry...')
    await templateRegistry.registerTemplate(theViewTemplate)
    console.log('✓ Template registered in registry')
    
    // Step 3: Verify the template can be loaded
    console.log('Step 3: Verifying template can be loaded...')
    const loadedTemplate = await templateRegistry.loadTemplate(theViewTemplate.metadata.id)
    
    if (!loadedTemplate) {
      throw new Error('Failed to load template after registration')
    }
    
    console.log('✓ Template loaded successfully')
    
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

