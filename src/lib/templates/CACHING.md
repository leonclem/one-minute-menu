# Layout Calculation Caching

## Overview

The grid layout generator includes built-in caching to improve performance when generating layouts for the same menu data multiple times. This is particularly useful when:

- Users preview layouts with different themes
- The same menu is rendered multiple times in a session
- API endpoints are called repeatedly with the same parameters

## How It Works

### Automatic Caching

Caching is automatic and transparent. When you call `generateGridLayout()`, the function:

1. Generates a cache key based on menu data hash, preset ID, and output context
2. Checks if a cached layout exists
3. Returns the cached layout if found (cache hit)
4. Otherwise, generates a new layout and stores it in cache (cache miss)

```typescript
import { generateGridLayout } from '@/lib/templates/grid-generator'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'

// First call - cache miss, layout is generated and cached
const layout1 = generateGridLayout(menuData, LAYOUT_PRESETS['balanced'], 'desktop')

// Second call with same inputs - cache hit, returns cached layout
const layout2 = generateGridLayout(menuData, LAYOUT_PRESETS['balanced'], 'desktop')
```

### Cache Key Generation

Cache keys are generated from:
- **Menu data hash**: A deterministic hash of the menu structure, items, and prices
- **Preset ID**: The layout preset identifier (e.g., 'balanced', 'dense-catalog')
- **Output context**: The target device context ('mobile', 'tablet', 'desktop', 'print')

This ensures that different combinations are cached separately.

## Cache Management

### Invalidating Cache

When menu data is updated, you should invalidate the cache to ensure fresh layouts are generated:

```typescript
import { invalidateCacheForMenu } from '@/lib/templates/grid-generator'

// After updating menu data
await updateMenuInDatabase(menuId, newMenuData)

// Invalidate all cached layouts for this menu
invalidateCacheForMenu(newMenuData)
```

### Clearing All Cache

To clear the entire cache (useful for testing or memory management):

```typescript
import { clearCache } from '@/lib/templates/grid-generator'

// Clear all cached layouts
clearCache()
```

### Cache Statistics

Monitor cache performance with statistics:

```typescript
import { getCacheStats, getCacheHitRate } from '@/lib/templates/grid-generator'

// Get cache size and limits
const stats = getCacheStats()
console.log(`Cache size: ${stats.size}/${stats.maxSize}`)

// Get hit rate percentage
const hitRate = getCacheHitRate()
console.log(`Cache hit rate: ${hitRate.toFixed(2)}%`)
```

## Configuration

### Cache Size Limit

The cache has a maximum size of **100 entries** by default. When the limit is reached, the oldest entry is evicted (LRU - Least Recently Used).

To modify the cache size, edit `MAX_CACHE_SIZE` in `src/lib/templates/layout-cache.ts`:

```typescript
const MAX_CACHE_SIZE = 100 // Adjust as needed
```

### Memory Considerations

Each cached layout contains:
- Grid structure with tile positions
- Section metadata
- Preset configuration reference

Typical memory usage per cached layout: ~5-20 KB depending on menu size.

With 100 cached layouts, expect ~0.5-2 MB of memory usage.

## Performance Impact

### Benchmarks

Typical performance improvements with caching:

| Menu Size | First Call (Uncached) | Subsequent Calls (Cached) | Speedup |
|-----------|----------------------|---------------------------|---------|
| 10 items  | ~2-5 ms             | <1 ms                     | 2-5x    |
| 50 items  | ~5-15 ms            | <1 ms                     | 5-15x   |
| 100 items | ~10-30 ms           | <1 ms                     | 10-30x  |

### When Caching Helps Most

- **Preview mode**: Users switching between presets or contexts
- **API endpoints**: Repeated requests for the same menu
- **Server-side rendering**: Multiple renders of the same menu

### When Caching Doesn't Help

- **One-time renders**: Single layout generation per menu
- **Frequently changing data**: Menus updated on every request
- **Unique combinations**: Every request uses different preset/context

## Best Practices

### 1. Invalidate on Updates

Always invalidate cache when menu data changes:

```typescript
// In your menu update handler
async function updateMenu(menuId: string, updates: MenuUpdates) {
  const updatedMenu = await database.updateMenu(menuId, updates)
  const layoutData = transformExtractionToLayout(updatedMenu)
  
  // Invalidate cache for this menu
  invalidateCacheForMenu(layoutData)
  
  return updatedMenu
}
```

### 2. Monitor Cache Performance

Track cache hit rates in production to optimize cache size:

```typescript
// In your API route
export async function GET(request: Request) {
  const layout = generateGridLayout(menuData, preset, context)
  
  // Log metrics periodically
  if (Math.random() < 0.01) { // 1% sampling
    const hitRate = getCacheHitRate()
    console.log(`Layout cache hit rate: ${hitRate}%`)
  }
  
  return Response.json(layout)
}
```

### 3. Clear Cache on Deployment

Consider clearing cache on application restart or deployment:

```typescript
// In your app initialization
import { clearCache } from '@/lib/templates/grid-generator'

if (process.env.NODE_ENV === 'production') {
  // Clear cache on startup to ensure fresh state
  clearCache()
}
```

### 4. Test Without Cache

When writing tests, clear cache in `beforeEach` to ensure isolation:

```typescript
import { clearCache } from '@/lib/templates/grid-generator'
import { resetCacheMetrics } from '@/lib/templates/layout-cache'

describe('My Tests', () => {
  beforeEach(() => {
    clearCache()
    resetCacheMetrics()
  })
  
  // Your tests...
})
```

## Troubleshooting

### Cache Not Working

If you're not seeing cache hits:

1. **Check cache key consistency**: Ensure menu data structure is identical
2. **Verify cache isn't being cleared**: Check for unintended `clearCache()` calls
3. **Monitor cache size**: Use `getCacheStats()` to verify entries are being stored

### Stale Data

If you're seeing outdated layouts:

1. **Invalidate on updates**: Ensure `invalidateCacheForMenu()` is called after changes
2. **Check hash function**: Verify menu data changes result in different hashes
3. **Clear cache manually**: Use `clearCache()` as a temporary fix

### Memory Issues

If cache is consuming too much memory:

1. **Reduce cache size**: Lower `MAX_CACHE_SIZE` in `layout-cache.ts`
2. **Clear cache periodically**: Implement a scheduled cache clear
3. **Monitor cache stats**: Track `getCacheStats().size` over time

## Future Enhancements

Potential improvements for future versions:

- **TTL (Time To Live)**: Automatically expire old cache entries
- **Persistent cache**: Store cache in Redis or database
- **Cache warming**: Pre-generate layouts for popular menus
- **Selective caching**: Cache only frequently accessed menus
- **Cache compression**: Reduce memory footprint with compression
