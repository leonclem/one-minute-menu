/**
 * Engine Selector Usage Examples
 * 
 * This file demonstrates how to use the engine selector to switch
 * between V1 and V2 layout engines.
 */

import { generateLayoutWithVersion, getEngineVersion, getEngineInfo } from './engine-selector'
import type { LayoutEngineInput } from './engine-types'
import type { LayoutEngineInputV2 } from './v2/layout-engine-v2'

// =============================================================================
// Example 1: Using Environment Default
// =============================================================================

export async function generateLayoutWithDefault(menu: any) {
  console.log('Current engine version:', getEngineVersion())
  
  // This will use V1 or V2 based on NEXT_PUBLIC_LAYOUT_ENGINE_VERSION
  if (getEngineVersion() === 'v1') {
    const v1Input: LayoutEngineInput = {
      menu,
      template: {} as any // V1 template object
    }
    return await generateLayoutWithVersion(v1Input)
  } else {
    const v2Input: LayoutEngineInputV2 = {
      menu,
      templateId: 'classic-cards-v2' // V2 template ID
    }
    return await generateLayoutWithVersion(v2Input)
  }
}

// =============================================================================
// Example 2: Explicit Version Override
// =============================================================================

export async function generateLayoutV2Explicitly(menu: any) {
  const v2Input: LayoutEngineInputV2 = {
    menu,
    templateId: 'classic-cards-v2',
    debug: true
  }
  
  // Force V2 engine regardless of environment setting
  return await generateLayoutWithVersion(v2Input, 'v2')
}

// =============================================================================
// Example 3: Feature Flag Check
// =============================================================================

export function checkEngineConfiguration() {
  const info = getEngineInfo()
  
  console.log('Engine Configuration:')
  console.log(`- Current Version: ${info.currentVersion}`)
  console.log(`- Environment Variable: ${info.envVariable}`)
  console.log(`- Default Version: ${info.defaultVersion}`)
  
  if (info.currentVersion === 'v2') {
    console.log('✅ V2 engine is active')
  } else {
    console.log('ℹ️  V1 engine is active (default)')
  }
}

// =============================================================================
// Example 4: Migration Helper
// =============================================================================

export async function generateLayoutWithFallback(menu: any, templateId: string) {
  try {
    // Try V2 first if available
    if (getEngineVersion() === 'v2') {
      const v2Input: LayoutEngineInputV2 = {
        menu,
        templateId
      }
      return await generateLayoutWithVersion(v2Input, 'v2')
    }
  } catch (error) {
    console.warn('V2 engine failed, falling back to V1:', error)
  }
  
  // Fallback to V1
  const v1Input: LayoutEngineInput = {
    menu,
    template: {} as any // Convert templateId to V1 template object
  }
  return await generateLayoutWithVersion(v1Input, 'v1')
}