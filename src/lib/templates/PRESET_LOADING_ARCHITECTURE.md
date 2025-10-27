# Preset Loading Architecture

## Overview

This document describes the architecture for loading layout presets in the Dynamic Menu Layout Engine. Currently, presets are hard-coded in `presets.ts`, but the system is designed to support external preset configurations in the future.

## Current Implementation

### Hard-Coded Presets

All presets are currently defined as TypeScript constants in `src/lib/templates/presets.ts`:

```typescript
export const LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  'dense-catalog': DENSE_CATALOG,
  'image-forward': IMAGE_FORWARD,
  'balanced': BALANCED,
  'feature-band': FEATURE_BAND,
  'text-only': TEXT_ONLY
}
```

### Preset Lookup Functions

The module provides several helper functions for accessing presets:

- `getPresetById(id)` - Get preset by ID (returns undefined if not found)
- `getPresetByIdOrDefault(id)` - Get preset with fallback to default
- `getAllPresets()` - Get all presets as array
- `getPresetsByFamily(family)` - Filter presets by family
- `isValidPresetId(id)` - Check if preset exists

## Future Architecture: JSON-Based Preset Loading

### Design Goals

1. **No Code Changes Required**: Users should be able to add custom presets without modifying TypeScript code
2. **Validation**: All external presets must be validated against schema
3. **Backward Compatibility**: Hard-coded presets remain as fallback
4. **Performance**: Presets should be cached and loaded efficiently
5. **Type Safety**: Runtime validation with Zod schemas

### Preset JSON Schema

External presets will follow this JSON structure:

```json
{
  "id": "custom-elegant",
  "name": "Custom Elegant",
  "family": "balanced",
  "gridConfig": {
    "columns": {
      "mobile": 2,
      "tablet": 3,
      "desktop": 4,
      "print": 5
    },
    "gap": "gap-4",
    "sectionSpacing": "mb-8"
  },
  "tileConfig": {
    "aspectRatio": "4/3",
    "borderRadius": "rounded-xl",
    "padding": "p-5",
    "textSize": {
      "name": "text-lg",
      "price": "text-xl",
      "description": "text-base"
    }
  },
  "metadataMode": "overlay"
}
```

### Validation Schema

Add Zod schema to `types.ts` for runtime validation:

```typescript
import { z } from 'zod'

export const LayoutPresetSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  family: z.enum(['dense', 'image-forward', 'balanced', 'feature-band']),
  gridConfig: z.object({
    columns: z.object({
      mobile: z.number().int().min(1).max(3),
      tablet: z.number().int().min(2).max(4),
      desktop: z.number().int().min(3).max(6),
      print: z.number().int().min(3).max(8)
    }),
    gap: z.string().regex(/^gap-\d+$/),
    sectionSpacing: z.string().regex(/^mb-\d+$/)
  }),
  tileConfig: z.object({
    aspectRatio: z.string(),
    borderRadius: z.string().regex(/^rounded-/),
    padding: z.string().regex(/^p-\d+$/),
    textSize: z.object({
      name: z.string().regex(/^text-/),
      price: z.string().regex(/^text-/),
      description: z.string().regex(/^text-/)
    })
  }),
  metadataMode: z.enum(['overlay', 'adjacent'])
})
```

### Loading Sources

Future implementation will support loading presets from multiple sources:

#### 1. File System (JSON Files)

```typescript
/**
 * Load preset from JSON file
 * @param filePath - Path to JSON file
 * @returns Validated layout preset
 */
export async function loadPresetFromFile(filePath: string): Promise<LayoutPreset> {
  const fileContent = await fs.readFile(filePath, 'utf-8')
  const json = JSON.parse(fileContent)
  return LayoutPresetSchema.parse(json)
}

/**
 * Load all presets from directory
 * @param dirPath - Directory containing preset JSON files
 * @returns Array of validated presets
 */
export async function loadPresetsFromDirectory(dirPath: string): Promise<LayoutPreset[]> {
  const files = await fs.readdir(dirPath)
  const jsonFiles = files.filter(f => f.endsWith('.json'))
  
  const presets = await Promise.all(
    jsonFiles.map(file => loadPresetFromFile(path.join(dirPath, file)))
  )
  
  return presets
}
```

**Suggested Directory Structure:**
```
public/presets/
├── custom-elegant.json
├── custom-minimal.json
└── custom-bold.json
```

#### 2. Database (User-Defined Presets)

```typescript
/**
 * Load preset from database
 * @param presetId - Database ID of preset
 * @returns Validated layout preset
 */
export async function loadPresetFromDatabase(presetId: string): Promise<LayoutPreset> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('layout_presets')
    .select('*')
    .eq('id', presetId)
    .single()
  
  if (error) throw new Error(`Failed to load preset: ${error.message}`)
  
  return LayoutPresetSchema.parse(data.config)
}

/**
 * Save custom preset to database
 * @param preset - Layout preset to save
 * @param userId - User who owns the preset
 */
export async function savePresetToDatabase(
  preset: LayoutPreset,
  userId: string
): Promise<void> {
  const supabase = createClient()
  await supabase.from('layout_presets').insert({
    id: preset.id,
    user_id: userId,
    config: preset,
    created_at: new Date().toISOString()
  })
}
```

**Database Schema:**
```sql
CREATE TABLE layout_presets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  config JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_layout_presets_user ON layout_presets(user_id);
CREATE INDEX idx_layout_presets_public ON layout_presets(is_public) WHERE is_public = true;
```

#### 3. Remote API (Preset Marketplace)

```typescript
/**
 * Load preset from remote API
 * @param presetId - Remote preset identifier
 * @returns Validated layout preset
 */
export async function loadPresetFromAPI(presetId: string): Promise<LayoutPreset> {
  const response = await fetch(`https://api.example.com/presets/${presetId}`)
  if (!response.ok) throw new Error('Failed to fetch preset')
  
  const json = await response.json()
  return LayoutPresetSchema.parse(json)
}
```

### Preset Registry with Dynamic Loading

Extend the current preset registry to support dynamic loading:

```typescript
/**
 * Enhanced preset registry with dynamic loading support
 */
class PresetRegistry {
  private presets: Map<string, LayoutPreset> = new Map()
  private loadedSources: Set<string> = new Set()
  
  constructor() {
    // Load hard-coded presets
    Object.entries(LAYOUT_PRESETS).forEach(([id, preset]) => {
      this.presets.set(id, preset)
    })
  }
  
  /**
   * Get preset by ID
   */
  get(id: string): LayoutPreset | undefined {
    return this.presets.get(id)
  }
  
  /**
   * Register a new preset
   */
  register(preset: LayoutPreset): void {
    // Validate before registering
    LayoutPresetSchema.parse(preset)
    this.presets.set(preset.id, preset)
  }
  
  /**
   * Load presets from directory (if not already loaded)
   */
  async loadFromDirectory(dirPath: string): Promise<void> {
    if (this.loadedSources.has(dirPath)) return
    
    const presets = await loadPresetsFromDirectory(dirPath)
    presets.forEach(preset => this.register(preset))
    this.loadedSources.add(dirPath)
  }
  
  /**
   * Load user's custom presets from database
   */
  async loadUserPresets(userId: string): Promise<void> {
    const supabase = createClient()
    const { data } = await supabase
      .from('layout_presets')
      .select('config')
      .eq('user_id', userId)
    
    data?.forEach(row => {
      const preset = LayoutPresetSchema.parse(row.config)
      this.register(preset)
    })
  }
  
  /**
   * Get all registered presets
   */
  getAll(): LayoutPreset[] {
    return Array.from(this.presets.values())
  }
}

// Singleton instance
export const presetRegistry = new PresetRegistry()
```

### Usage Example

```typescript
// In API route or server component
import { presetRegistry } from '@/lib/templates/preset-registry'

// Load custom presets on startup
await presetRegistry.loadFromDirectory('public/presets')

// Load user's custom presets
await presetRegistry.loadUserPresets(userId)

// Get preset (works for both built-in and custom)
const preset = presetRegistry.get('custom-elegant') ?? presetRegistry.get('balanced')
```

## Preset Validation Rules

When loading external presets, validate:

### 1. Structure Validation
- All required fields present
- Correct data types
- Valid enum values

### 2. Semantic Validation
- Column counts increase with screen size (mobile ≤ tablet ≤ desktop ≤ print)
- Tailwind classes are valid (check against whitelist)
- Aspect ratios are valid CSS values
- Gap and spacing values are reasonable

### 3. Security Validation
- No script injection in string fields
- File paths are within allowed directories
- Database queries use parameterized statements

### Example Validation Function

```typescript
export function validatePresetSemantic(preset: LayoutPreset): string[] {
  const errors: string[] = []
  
  // Check column progression
  const cols = preset.gridConfig.columns
  if (cols.mobile > cols.tablet) {
    errors.push('Mobile columns cannot exceed tablet columns')
  }
  if (cols.tablet > cols.desktop) {
    errors.push('Tablet columns cannot exceed desktop columns')
  }
  if (cols.desktop > cols.print) {
    errors.push('Desktop columns cannot exceed print columns')
  }
  
  // Check Tailwind classes
  const validGaps = ['gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-6', 'gap-8']
  if (!validGaps.includes(preset.gridConfig.gap)) {
    errors.push(`Invalid gap value: ${preset.gridConfig.gap}`)
  }
  
  // Check aspect ratio
  const validAspectRatios = ['1/1', '4/3', '16/9', '3/2', 'auto']
  if (!validAspectRatios.includes(preset.tileConfig.aspectRatio)) {
    errors.push(`Invalid aspect ratio: ${preset.tileConfig.aspectRatio}`)
  }
  
  return errors
}
```

## Caching Strategy

To optimize performance when loading external presets:

```typescript
/**
 * Preset cache with TTL
 */
class PresetCache {
  private cache = new Map<string, { preset: LayoutPreset; expires: number }>()
  private ttl = 1000 * 60 * 60 // 1 hour
  
  get(id: string): LayoutPreset | undefined {
    const entry = this.cache.get(id)
    if (!entry) return undefined
    
    if (Date.now() > entry.expires) {
      this.cache.delete(id)
      return undefined
    }
    
    return entry.preset
  }
  
  set(id: string, preset: LayoutPreset): void {
    this.cache.set(id, {
      preset,
      expires: Date.now() + this.ttl
    })
  }
  
  invalidate(id: string): void {
    this.cache.delete(id)
  }
  
  clear(): void {
    this.cache.clear()
  }
}

export const presetCache = new PresetCache()
```

## Migration Path

### Phase 1: Current State (MVP)
- Hard-coded presets in `presets.ts`
- No external loading

### Phase 2: File-Based Loading
- Add JSON schema validation
- Support loading from `public/presets/` directory
- Implement preset registry
- Add caching layer

### Phase 3: Database Integration
- Create `layout_presets` table
- Add user preset management UI
- Support saving/loading custom presets
- Add preset sharing (public presets)

### Phase 4: Preset Marketplace
- Remote API for preset discovery
- Community-contributed presets
- Preset ratings and reviews
- Preset versioning

## Error Handling

When loading external presets fails:

```typescript
export async function loadPresetSafely(
  source: string,
  fallbackId: string = 'balanced'
): Promise<LayoutPreset> {
  try {
    const preset = await loadPresetFromFile(source)
    
    // Validate semantics
    const errors = validatePresetSemantic(preset)
    if (errors.length > 0) {
      console.warn('Preset validation warnings:', errors)
      // Continue with warnings, but log them
    }
    
    return preset
  } catch (error) {
    console.error('Failed to load preset, using fallback:', error)
    return LAYOUT_PRESETS[fallbackId]
  }
}
```

## Testing Strategy

### Unit Tests
- Test JSON parsing and validation
- Test semantic validation rules
- Test cache behavior
- Test fallback logic

### Integration Tests
- Test loading from file system
- Test loading from database
- Test preset registry operations
- Test error scenarios

### Example Test

```typescript
describe('Preset Loading', () => {
  it('should load valid preset from JSON', async () => {
    const json = {
      id: 'test-preset',
      name: 'Test Preset',
      family: 'balanced',
      // ... rest of config
    }
    
    const preset = await loadPresetFromJSON(json)
    expect(preset.id).toBe('test-preset')
  })
  
  it('should reject invalid preset', async () => {
    const json = {
      id: 'invalid',
      // missing required fields
    }
    
    await expect(loadPresetFromJSON(json)).rejects.toThrow()
  })
  
  it('should fall back to default on error', async () => {
    const preset = await loadPresetSafely('nonexistent.json')
    expect(preset.id).toBe('balanced')
  })
})
```

## Security Considerations

1. **Input Validation**: Always validate external presets with Zod schema
2. **Path Traversal**: Restrict file loading to specific directories
3. **SQL Injection**: Use parameterized queries for database operations
4. **XSS Prevention**: Sanitize all string fields before rendering
5. **Rate Limiting**: Limit preset creation/loading per user
6. **Access Control**: Verify user permissions before loading/saving presets

## Performance Considerations

1. **Lazy Loading**: Load presets on-demand, not at startup
2. **Caching**: Cache parsed presets in memory
3. **Batch Loading**: Load multiple presets in parallel
4. **CDN**: Serve public presets from CDN
5. **Compression**: Compress JSON files for faster transfer

## Documentation for Custom Preset Authors

### Creating a Custom Preset

1. **Copy Template**: Start with an existing preset JSON
2. **Modify Values**: Adjust columns, spacing, and styling
3. **Validate**: Use validation tool to check for errors
4. **Test**: Preview with sample menu data
5. **Save**: Store in `public/presets/` or database

### Preset Guidelines

- **Column Counts**: Ensure mobile ≤ tablet ≤ desktop ≤ print
- **Tailwind Classes**: Use only valid Tailwind utility classes
- **Aspect Ratios**: Stick to common ratios (1/1, 4/3, 16/9)
- **Spacing**: Use consistent spacing scale
- **Naming**: Use kebab-case for IDs, descriptive names

### Example Custom Preset

```json
{
  "id": "my-custom-preset",
  "name": "My Custom Preset",
  "family": "balanced",
  "gridConfig": {
    "columns": {
      "mobile": 2,
      "tablet": 3,
      "desktop": 4,
      "print": 5
    },
    "gap": "gap-4",
    "sectionSpacing": "mb-8"
  },
  "tileConfig": {
    "aspectRatio": "1/1",
    "borderRadius": "rounded-lg",
    "padding": "p-4",
    "textSize": {
      "name": "text-base",
      "price": "text-lg",
      "description": "text-sm"
    }
  },
  "metadataMode": "overlay"
}
```

## Future Enhancements

1. **Visual Preset Editor**: Drag-and-drop UI for creating presets
2. **Preset Inheritance**: Extend existing presets with overrides
3. **Conditional Presets**: Apply different presets based on menu characteristics
4. **A/B Testing**: Test multiple presets and track performance
5. **AI-Generated Presets**: Use ML to suggest optimal presets
6. **Preset Analytics**: Track which presets perform best
7. **Version Control**: Track preset changes over time
8. **Preset Templates**: Pre-built presets for specific cuisines/styles

## Conclusion

The preset loading architecture is designed to be extensible and maintainable. The current hard-coded implementation provides a solid foundation, while the documented future architecture enables powerful customization without sacrificing type safety or performance.

Key principles:
- **Start Simple**: Hard-coded presets for MVP
- **Plan for Growth**: Architecture supports external loading
- **Validate Everything**: Runtime validation with Zod
- **Fail Gracefully**: Always fall back to default preset
- **Cache Aggressively**: Optimize for performance
- **Document Thoroughly**: Enable community contributions
