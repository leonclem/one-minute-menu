import { createServerSupabaseClient } from './supabase-server'

// Simple in-memory cache with TTL for feature flags
// In serverless environments, this won't persist across requests,
// but it helps reduce DB hits within a single request or in development
interface CacheEntry {
  value: boolean
  expiresAt: number
}

const flagCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60000 // 1 minute

/**
 * Reads a feature flag value from the database with in-memory caching.
 * Feature flags are readable by anyone (not protected by RLS) as they're global config.
 * Uses standard authenticated client.
 */
export async function getFeatureFlag(flagId: string): Promise<boolean> {
  // Check cache first
  const cached = flagCache.get(flagId)
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[feature-flags] Flag "${flagId}" = ${cached.value} (cached)`)
    return cached.value
  }

  try {
    const supabase = createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('id', flagId)
      .single()
    
    if (error) {
      console.error(`[feature-flags] Error reading flag "${flagId}":`, error)
      // Default to true (safe mode) if flag is missing
      return true
    }
    
    const result = data?.enabled ?? true
    
    // Cache the result
    flagCache.set(flagId, {
      value: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
    
    console.log(`[feature-flags] Flag "${flagId}" = ${result}`)
    return result
  } catch (err) {
    console.error(`[feature-flags] Exception reading flag "${flagId}":`, err)
    // Default to true (safe mode) if there's an exception
    return true
  }
}

/**
 * Clears the feature flag cache (useful for testing or forced refresh)
 */
export function clearFeatureFlagCache(): void {
  flagCache.clear()
  console.log('[feature-flags] Cache cleared')
}

