/**
 * GridMenu Template Engine Selector
 * 
 * This module provides the V1/V2 switching mechanism via feature flag.
 * It routes layout generation requests to the appropriate engine version
 * based on environment configuration.
 */

import { generateLayout as generateLayoutV1 } from './layout-engine'
import { generateLayoutV2, type LayoutEngineInputV2 } from './v2/layout-engine-v2'
import type { LayoutEngineInput, LayoutInstance } from './engine-types'
import type { LayoutDocumentV2 } from './v2/engine-types-v2'

// =============================================================================
// Types
// =============================================================================

/**
 * Supported layout engine versions
 */
export type EngineVersion = 'v1' | 'v2'

/**
 * Union type for engine inputs (V1 or V2)
 */
export type EngineInput = LayoutEngineInput | LayoutEngineInputV2

/**
 * Union type for engine outputs (V1 or V2)
 */
export type EngineOutput = LayoutInstance | LayoutDocumentV2

// =============================================================================
// Engine Version Detection
// =============================================================================

/**
 * Get the current engine version from environment variable.
 * 
 * Reads from NEXT_PUBLIC_LAYOUT_ENGINE_VERSION environment variable.
 * Defaults to 'v1' when not set or invalid.
 * 
 * @returns Current engine version ('v1' or 'v2')
 * 
 * @example
 * ```typescript
 * // In .env.local:
 * // NEXT_PUBLIC_LAYOUT_ENGINE_VERSION=v2
 * 
 * const version = getEngineVersion() // 'v2'
 * ```
 */
export function getEngineVersion(): EngineVersion {
  const envVersion = process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION as EngineVersion
  
  // Validate environment variable value
  if (envVersion === 'v1' || envVersion === 'v2') {
    return envVersion
  }
  
  // Default to V1 for safety
  return 'v1'
}

// =============================================================================
// Engine Routing
// =============================================================================

/**
 * Generate layout using the specified engine version.
 * 
 * Routes the request to V1 or V2 engine based on the version parameter.
 * If no version is provided, uses the environment-configured default.
 * 
 * @param input - Layout engine input (V1 or V2 format)
 * @param version - Optional engine version override
 * @returns Promise resolving to layout output (V1 or V2 format)
 * 
 * @example
 * ```typescript
 * // Use environment default
 * const layout = await generateLayoutWithVersion(input)
 * 
 * // Force V2 engine
 * const layoutV2 = await generateLayoutWithVersion(inputV2, 'v2')
 * ```
 */
export async function generateLayoutWithVersion(
  input: EngineInput,
  version?: EngineVersion
): Promise<EngineOutput> {
  const engineVersion = version ?? getEngineVersion()
  
  if (engineVersion === 'v2') {
    // Route to V2 engine
    return await generateLayoutV2(input as LayoutEngineInputV2)
  }
  
  // Route to V1 engine (default)
  return generateLayoutV1(input as LayoutEngineInput)
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if input is V2 format.
 * 
 * V2 inputs have a templateId string instead of a template object.
 * 
 * @param input - Engine input to check
 * @returns True if input is V2 format
 */
export function isV2Input(input: EngineInput): input is LayoutEngineInputV2 {
  return typeof (input as LayoutEngineInputV2).templateId === 'string'
}

/**
 * Type guard to check if output is V2 format.
 * 
 * V2 outputs have a templateId field and pages array.
 * V1 outputs have a template object and pages array.
 * 
 * @param output - Engine output to check
 * @returns True if output is V2 format
 */
export function isV2Output(output: EngineOutput): output is LayoutDocumentV2 {
  return 'templateId' in output && typeof output.templateId === 'string'
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get engine version information for debugging.
 * 
 * @returns Object with current version and environment variable value
 */
export function getEngineInfo() {
  return {
    currentVersion: getEngineVersion(),
    envVariable: process.env.NEXT_PUBLIC_LAYOUT_ENGINE_VERSION || 'undefined',
    defaultVersion: 'v1'
  }
}