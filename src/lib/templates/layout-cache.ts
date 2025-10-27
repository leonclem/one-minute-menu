/**
 * Layout Calculation Caching
 * 
 * Provides memoization for grid layout generation to improve performance.
 * Cache keys are based on menu data hash and preset ID.
 * Cache is invalidated when menu data changes.
 */

import type {
  LayoutMenuData,
  LayoutPreset,
  OutputContext,
  GridLayout
} from './types'

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Maximum number of cached layouts to store
 * Prevents unbounded memory growth
 */
const MAX_CACHE_SIZE = 100

/**
 * Cache entry with timestamp for potential TTL implementation
 */
interface CacheEntry {
  layout: GridLayout
  timestamp: number
}

/**
 * In-memory cache storage
 * Key format: `${menuDataHash}-${presetId}-${context}`
 */
const layoutCache = new Map<string, CacheEntry>()

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Generate a stable hash from menu data
 * Uses a simple string-based hash for deterministic cache keys
 * 
 * @param data - Menu data to hash
 * @returns Hash string
 */
export function hashMenuData(data: LayoutMenuData): string {
  // Create a stable string representation of the menu data
  const sections = data.sections.map(section => ({
    name: section.name,
    items: section.items.map(item => ({
      name: item.name,
      price: item.price,
      description: item.description || '',
      imageRef: item.imageRef || '',
      featured: item.featured
    }))
  }))

  const dataString = JSON.stringify({
    metadata: data.metadata,
    sections
  })

  // Simple hash function (djb2)
  let hash = 5381
  for (let i = 0; i < dataString.length; i++) {
    hash = ((hash << 5) + hash) + dataString.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }

  return hash.toString(36)
}

/**
 * Generate cache key from menu data, preset, and context
 * 
 * @param data - Menu data
 * @param preset - Layout preset
 * @param context - Output context
 * @returns Cache key string
 */
export function generateCacheKey(
  data: LayoutMenuData,
  preset: LayoutPreset,
  context: OutputContext
): string {
  const menuHash = hashMenuData(data)
  return `${menuHash}-${preset.id}-${context}`
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get cached layout if available
 * 
 * @param key - Cache key
 * @returns Cached layout or undefined if not found
 */
export function getCachedLayout(key: string): GridLayout | undefined {
  const entry = layoutCache.get(key)
  
  if (!entry) {
    return undefined
  }

  return entry.layout
}

/**
 * Store layout in cache
 * Implements LRU eviction when cache size exceeds limit
 * 
 * @param key - Cache key
 * @param layout - Grid layout to cache
 */
export function setCachedLayout(key: string, layout: GridLayout): void {
  // Check if we need to evict entries
  if (layoutCache.size >= MAX_CACHE_SIZE) {
    // Find and remove oldest entry (simple LRU)
    let oldestKey: string | null = null
    let oldestTimestamp = Infinity

    const entries = Array.from(layoutCache.entries())
    for (const [k, entry] of entries) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
        oldestKey = k
      }
    }

    if (oldestKey) {
      layoutCache.delete(oldestKey)
    }
  }

  // Store new entry
  layoutCache.set(key, {
    layout,
    timestamp: Date.now()
  })
}

/**
 * Invalidate cache entries for specific menu data
 * Call this when menu data is updated
 * 
 * @param data - Menu data that was updated
 */
export function invalidateCacheForMenu(data: LayoutMenuData): void {
  const menuHash = hashMenuData(data)
  
  // Remove all entries that start with this menu hash
  const keysToDelete: string[] = []
  
  const keys = Array.from(layoutCache.keys())
  for (const key of keys) {
    if (key.startsWith(menuHash)) {
      keysToDelete.push(key)
    }
  }

  for (const key of keysToDelete) {
    layoutCache.delete(key)
  }
}

/**
 * Clear entire cache
 * Useful for testing or manual cache management
 */
export function clearCache(): void {
  layoutCache.clear()
}

/**
 * Get cache statistics
 * Useful for monitoring and debugging
 * 
 * @returns Object with cache statistics
 */
export function getCacheStats(): {
  size: number
  maxSize: number
  hitRate?: number
} {
  return {
    size: layoutCache.size,
    maxSize: MAX_CACHE_SIZE
  }
}

// ============================================================================
// Cache Metrics (for monitoring)
// ============================================================================

let cacheHits = 0
let cacheMisses = 0

/**
 * Record a cache hit
 * @internal
 */
export function recordCacheHit(): void {
  cacheHits++
}

/**
 * Record a cache miss
 * @internal
 */
export function recordCacheMiss(): void {
  cacheMisses++
}

/**
 * Get cache hit rate
 * 
 * @returns Hit rate as percentage (0-100)
 */
export function getCacheHitRate(): number {
  const total = cacheHits + cacheMisses
  if (total === 0) return 0
  return (cacheHits / total) * 100
}

/**
 * Reset cache metrics
 * Useful for testing
 */
export function resetCacheMetrics(): void {
  cacheHits = 0
  cacheMisses = 0
}
