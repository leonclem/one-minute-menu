# Customization API Contracts

## Overview

This document defines the API contracts for future user-facing customization features. These interfaces are designed to support advanced layout customization without requiring code changes, enabling features like:

- Manual preset selection
- Theme overrides
- Custom tile ordering
- Featured item highlighting
- Drag-and-drop layout editing

## Current State (MVP)

The MVP uses automatic preset selection based on heuristics. Future versions will expose these APIs to give users fine-grained control over layout generation.

## Core Interfaces

### LayoutCustomization

The main interface for customizing layout generation:

```typescript
/**
 * User customization options for layout generation
 * These options override automatic selections and defaults
 */
export interface LayoutCustomization {
  /**
   * Manually selected preset ID
   * Overrides automatic preset selection
   */
  presetId?: string
  
  /**
   * Theme overrides for colors, fonts, and spacing
   * Merged with preset defaults
   */
  themeOverrides?: Partial<TemplateTheme>
  
  /**
   * Custom ordering of menu items
   * Array of item IDs in desired display order
   * If provided, overrides default section ordering
   */
  tileOrder?: string[]
  
  /**
   * Items to emphasize with special styling
   * Array of item IDs to mark as featured
   */
  featuredItems?: string[]
  
  /**
   * Custom section ordering
   * Array of section names in desired display order
   */
  sectionOrder?: string[]
  
  /**
   * Hide specific items from layout
   * Array of item IDs to exclude
   */
  hiddenItems?: string[]
  
  /**
   * Custom tile sizes for specific items
   * Map of item ID to span configuration
   */
  customTileSizes?: Record<string, { columns: number; rows: number }>
  
  /**
   * Filler tile preferences
   * Control how empty spaces are filled
   */
  fillerPreferences?: {
    enabled: boolean
    style: 'color' | 'pattern' | 'icon'
    content?: string // Icon name or pattern ID
  }
  
  /**
   * Export preferences
   * Default settings for exports
   */
  exportPreferences?: {
    defaultFormat: 'html' | 'pdf' | 'png' | 'jpg'
    pdfOrientation: 'portrait' | 'landscape'
    imageWidth?: number
    imageHeight?: number
  }
}
```

### TemplateTheme

Theme customization interface:

```typescript
/**
 * Theme configuration for layout styling
 * Extends base theme with layout-specific options
 */
export interface TemplateTheme {
  /**
   * Typography settings
   */
  typography: {
    scale: number // Base font size multiplier (0.8 - 1.5)
    spacing: number // Line height multiplier (1.0 - 2.0)
    borderRadius: number // Corner radius multiplier (0 - 2.0)
  }
  
  /**
   * Color palette
   */
  colors: {
    primary: string // Main brand color (hex)
    secondary: string // Secondary brand color (hex)
    accent: string // Accent color for highlights (hex)
    background: string // Background color (hex)
    text: string // Text color (hex)
    overlay?: string // Overlay background (hex with alpha)
  }
  
  /**
   * Spacing overrides
   */
  spacing?: {
    gridGap?: string // Tailwind class (e.g., 'gap-4')
    sectionSpacing?: string // Tailwind class (e.g., 'mb-8')
    tilePadding?: string // Tailwind class (e.g., 'p-4')
  }
  
  /**
   * Font family overrides
   */
  fonts?: {
    heading?: string // Font family for headings
    body?: string // Font family for body text
    price?: string // Font family for prices
  }
}
```

### CustomizationPreset

Saved customization configurations:

```typescript
/**
 * Saved customization preset
 * Users can save and reuse customization configurations
 */
export interface CustomizationPreset {
  id: string
  name: string
  description?: string
  customization: LayoutCustomization
  createdAt: Date
  updatedAt: Date
  userId: string
  isPublic: boolean // Can other users see/use this preset?
}
```

## API Endpoints

### 1. Generate Layout with Customization

**Endpoint**: `POST /api/templates/generate`

**Request Body**:
```typescript
{
  menuId: string
  outputContext: OutputContext
  customization?: LayoutCustomization
}
```

**Response**:
```typescript
{
  layout: GridLayout
  metrics: LayoutMetrics
  appliedCustomization: LayoutCustomization // What was actually applied
}
```

**Example**:
```typescript
const response = await fetch('/api/templates/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    menuId: 'menu-123',
    outputContext: 'desktop',
    customization: {
      presetId: 'image-forward',
      themeOverrides: {
        colors: {
          primary: '#FF6B6B',
          secondary: '#4ECDC4'
        }
      },
      featuredItems: ['item-1', 'item-5', 'item-12']
    }
  })
})

const { layout, metrics } = await response.json()
```

### 2. Save Customization Preset

**Endpoint**: `POST /api/templates/customization/presets`

**Request Body**:
```typescript
{
  name: string
  description?: string
  customization: LayoutCustomization
  isPublic?: boolean
}
```

**Response**:
```typescript
{
  preset: CustomizationPreset
}
```

**Example**:
```typescript
const response = await fetch('/api/templates/customization/presets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Custom Style',
    description: 'Bold colors with featured items',
    customization: {
      presetId: 'balanced',
      themeOverrides: {
        colors: {
          primary: '#FF6B6B',
          accent: '#FFD93D'
        }
      }
    },
    isPublic: false
  })
})

const { preset } = await response.json()
```

### 3. Get User's Customization Presets

**Endpoint**: `GET /api/templates/customization/presets`

**Query Parameters**:
- `userId` (optional): Filter by user
- `isPublic` (optional): Filter public presets

**Response**:
```typescript
{
  presets: CustomizationPreset[]
}
```

### 4. Update Customization Preset

**Endpoint**: `PATCH /api/templates/customization/presets/:id`

**Request Body**:
```typescript
{
  name?: string
  description?: string
  customization?: LayoutCustomization
  isPublic?: boolean
}
```

**Response**:
```typescript
{
  preset: CustomizationPreset
}
```

### 5. Delete Customization Preset

**Endpoint**: `DELETE /api/templates/customization/presets/:id`

**Response**:
```typescript
{
  success: boolean
}
```

### 6. Apply Theme Override

**Endpoint**: `POST /api/templates/theme/apply`

**Request Body**:
```typescript
{
  menuId: string
  theme: TemplateTheme
}
```

**Response**:
```typescript
{
  preview: string // HTML preview with theme applied
}
```

### 7. Validate Customization

**Endpoint**: `POST /api/templates/customization/validate`

**Request Body**:
```typescript
{
  customization: LayoutCustomization
}
```

**Response**:
```typescript
{
  isValid: boolean
  errors: string[]
  warnings: string[]
}
```

## UI Component Contracts

### CustomizationPanel Component

```typescript
interface CustomizationPanelProps {
  menuId: string
  currentLayout: GridLayout
  onCustomizationChange: (customization: LayoutCustomization) => void
  onSavePreset: (name: string, description?: string) => Promise<void>
}

/**
 * Main customization panel component
 * Provides UI for all customization options
 */
export function CustomizationPanel(props: CustomizationPanelProps) {
  // Implementation
}
```

### PresetSelector Component

```typescript
interface PresetSelectorProps {
  currentPresetId: string
  onPresetChange: (presetId: string) => void
  showCustomPresets?: boolean
}

/**
 * Preset selection dropdown
 * Shows built-in and custom presets
 */
export function PresetSelector(props: PresetSelectorProps) {
  // Implementation
}
```

### ThemeEditor Component

```typescript
interface ThemeEditorProps {
  currentTheme: TemplateTheme
  onThemeChange: (theme: Partial<TemplateTheme>) => void
  onReset: () => void
}

/**
 * Visual theme editor with color pickers and sliders
 */
export function ThemeEditor(props: ThemeEditorProps) {
  // Implementation
}
```

### TileOrderEditor Component

```typescript
interface TileOrderEditorProps {
  items: LayoutItem[]
  currentOrder: string[]
  onOrderChange: (order: string[]) => void
  enableDragDrop?: boolean
}

/**
 * Drag-and-drop tile reordering interface
 */
export function TileOrderEditor(props: TileOrderEditorProps) {
  // Implementation
}
```

### FeaturedItemSelector Component

```typescript
interface FeaturedItemSelectorProps {
  items: LayoutItem[]
  featuredItems: string[]
  onFeaturedChange: (itemIds: string[]) => void
}

/**
 * Multi-select interface for marking items as featured
 */
export function FeaturedItemSelector(props: FeaturedItemSelectorProps) {
  // Implementation
}
```

## Drag-and-Drop Tile Reordering

### DnD Context Setup

```typescript
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove } from '@dnd-kit/sortable'

/**
 * Drag-and-drop provider for tile reordering
 */
export function DraggableLayoutEditor({
  layout,
  onReorder
}: {
  layout: GridLayout
  onReorder: (newOrder: string[]) => void
}) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)
      const newOrder = arrayMove(items, oldIndex, newIndex)
      onReorder(newOrder.map(i => i.id))
    }
  }
  
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items}>
        {/* Render sortable tiles */}
      </SortableContext>
    </DndContext>
  )
}
```

### Sortable Tile Component

```typescript
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * Individual sortable tile
 */
export function SortableTile({ item }: { item: LayoutItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id: item.id })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MenuTile item={item} />
    </div>
  )
}
```

## Validation Rules

### Customization Validation

```typescript
/**
 * Validate customization configuration
 */
export function validateCustomization(
  customization: LayoutCustomization,
  menu: LayoutMenuData
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate preset ID
  if (customization.presetId && !isValidPresetId(customization.presetId)) {
    errors.push(`Invalid preset ID: ${customization.presetId}`)
  }
  
  // Validate tile order
  if (customization.tileOrder) {
    const allItemIds = menu.sections.flatMap(s => s.items.map(i => i.id))
    const invalidIds = customization.tileOrder.filter(id => !allItemIds.includes(id))
    if (invalidIds.length > 0) {
      errors.push(`Invalid item IDs in tileOrder: ${invalidIds.join(', ')}`)
    }
  }
  
  // Validate featured items
  if (customization.featuredItems) {
    const allItemIds = menu.sections.flatMap(s => s.items.map(i => i.id))
    const invalidIds = customization.featuredItems.filter(id => !allItemIds.includes(id))
    if (invalidIds.length > 0) {
      errors.push(`Invalid item IDs in featuredItems: ${invalidIds.join(', ')}`)
    }
  }
  
  // Validate theme colors
  if (customization.themeOverrides?.colors) {
    const colors = customization.themeOverrides.colors
    Object.entries(colors).forEach(([key, value]) => {
      if (value && !isValidHexColor(value)) {
        errors.push(`Invalid hex color for ${key}: ${value}`)
      }
    })
  }
  
  // Validate typography scale
  if (customization.themeOverrides?.typography?.scale) {
    const scale = customization.themeOverrides.typography.scale
    if (scale < 0.8 || scale > 1.5) {
      warnings.push('Typography scale outside recommended range (0.8-1.5)')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color)
}
```

## Database Schema

### Customization Presets Table

```sql
CREATE TABLE customization_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  customization JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_customization CHECK (jsonb_typeof(customization) = 'object')
);

CREATE INDEX idx_customization_presets_user ON customization_presets(user_id);
CREATE INDEX idx_customization_presets_public ON customization_presets(is_public) WHERE is_public = true;
CREATE INDEX idx_customization_presets_created ON customization_presets(created_at DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_customization_presets_config ON customization_presets USING GIN (customization);

-- Update timestamp trigger
CREATE TRIGGER update_customization_presets_updated_at
  BEFORE UPDATE ON customization_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Usage Examples

### Example 1: Manual Preset Selection

```typescript
// User selects a different preset
const customization: LayoutCustomization = {
  presetId: 'image-forward'
}

const response = await fetch('/api/templates/generate', {
  method: 'POST',
  body: JSON.stringify({
    menuId: 'menu-123',
    outputContext: 'desktop',
    customization
  })
})
```

### Example 2: Theme Customization

```typescript
// User customizes colors
const customization: LayoutCustomization = {
  themeOverrides: {
    colors: {
      primary: '#FF6B6B',
      secondary: '#4ECDC4',
      accent: '#FFD93D'
    },
    typography: {
      scale: 1.2,
      spacing: 1.5,
      borderRadius: 1.0
    }
  }
}
```

### Example 3: Featured Items

```typescript
// User marks items as featured
const customization: LayoutCustomization = {
  featuredItems: ['item-1', 'item-5', 'item-12'],
  customTileSizes: {
    'item-1': { columns: 2, rows: 2 }, // Make featured item larger
    'item-5': { columns: 2, rows: 1 }
  }
}
```

### Example 4: Custom Ordering

```typescript
// User reorders items via drag-and-drop
const customization: LayoutCustomization = {
  tileOrder: [
    'item-5', 'item-1', 'item-3', 'item-2', 'item-4',
    'item-8', 'item-6', 'item-7', 'item-9', 'item-10'
  ],
  sectionOrder: ['Mains', 'Starters', 'Desserts'] // Reorder sections
}
```

### Example 5: Save and Reuse

```typescript
// Save customization as preset
const saveResponse = await fetch('/api/templates/customization/presets', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Restaurant Style',
    description: 'Bold colors with featured specials',
    customization: {
      presetId: 'balanced',
      themeOverrides: {
        colors: {
          primary: '#FF6B6B',
          accent: '#FFD93D'
        }
      },
      featuredItems: ['item-1', 'item-5']
    }
  })
})

const { preset } = await saveResponse.json()

// Later, apply saved preset
const applyResponse = await fetch('/api/templates/generate', {
  method: 'POST',
  body: JSON.stringify({
    menuId: 'menu-456',
    outputContext: 'mobile',
    customization: preset.customization
  })
})
```

## Security Considerations

### Authorization

```typescript
// Verify user owns the menu before applying customization
export async function authorizeCustomization(
  userId: string,
  menuId: string
): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase
    .from('menus')
    .select('user_id')
    .eq('id', menuId)
    .single()
  
  return data?.user_id === userId
}
```

### Input Sanitization

```typescript
// Sanitize customization input
export function sanitizeCustomization(
  customization: LayoutCustomization
): LayoutCustomization {
  return {
    ...customization,
    // Remove any script tags or dangerous content
    tileOrder: customization.tileOrder?.filter(id => isValidId(id)),
    featuredItems: customization.featuredItems?.filter(id => isValidId(id)),
    // Validate hex colors
    themeOverrides: customization.themeOverrides ? {
      ...customization.themeOverrides,
      colors: sanitizeColors(customization.themeOverrides.colors)
    } : undefined
  }
}
```

## Performance Considerations

### Caching Customized Layouts

```typescript
// Cache key includes customization hash
function getCustomizationCacheKey(
  menuId: string,
  context: OutputContext,
  customization?: LayoutCustomization
): string {
  const customHash = customization 
    ? hashObject(customization)
    : 'default'
  return `layout:${menuId}:${context}:${customHash}`
}

// Check cache before generating
const cacheKey = getCustomizationCacheKey(menuId, context, customization)
const cached = await layoutCache.get(cacheKey)
if (cached) return cached

// Generate and cache
const layout = await generateLayout(menuId, context, customization)
await layoutCache.set(cacheKey, layout, { ttl: 3600 })
```

### Debouncing Theme Changes

```typescript
// Debounce theme updates to avoid excessive re-renders
import { useDebouncedCallback } from 'use-debounce'

const debouncedThemeChange = useDebouncedCallback(
  (theme: TemplateTheme) => {
    onThemeChange(theme)
  },
  500 // Wait 500ms after user stops adjusting
)
```

## Future Enhancements

1. **Visual Layout Editor**: WYSIWYG editor for layout customization
2. **Template Marketplace**: Share and discover customization presets
3. **AI-Assisted Customization**: Suggest theme colors based on menu images
4. **Responsive Customization**: Different customizations per output context
5. **Animation Presets**: Customize transitions and hover effects
6. **Advanced Grid Controls**: Custom grid structures beyond rectangular
7. **Conditional Styling**: Apply styles based on item properties
8. **Version History**: Track and revert customization changes

## Conclusion

These API contracts provide a foundation for powerful customization features while maintaining:

- **Type Safety**: Full TypeScript interfaces
- **Validation**: Comprehensive input validation
- **Security**: Authorization and sanitization
- **Performance**: Caching and optimization
- **Extensibility**: Easy to add new customization options

The contracts are designed to be implemented incrementally, starting with basic preset selection and gradually adding more advanced features like drag-and-drop and theme editing.
