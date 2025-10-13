# UncertainItemsPanel Component Usage Guide

## Overview

The `UncertainItemsPanel` component displays uncertain items extracted from menu images, allowing users to review and resolve them through various actions. This component is a critical part of the menu extraction review workflow, helping users handle items that the AI couldn't extract with high confidence.

**Requirements Addressed:** 4.2, 4.3, 4.4, 4.5, 14.1, 14.2

## Features

- ✅ Display uncertain items with reasons and confidence scores
- ✅ Color-coded confidence indicators (red <0.3, orange 0.3-0.5, yellow >0.5)
- ✅ Expand/collapse individual items for focused review
- ✅ Three resolution actions: Add to Menu, Mark Superfluous, Needs Retake
- ✅ Category suggestion dropdown with hierarchical categories
- ✅ Inline editing for item details (name, price, description)
- ✅ Feedback submission for system errors or unclear menus
- ✅ Prioritized display (first item expanded by default)
- ✅ Empty state with success message
- ✅ Readonly mode for viewing only

## Installation

The component is located at `src/components/UncertainItemsPanel.tsx` and can be imported as:

```typescript
import { UncertainItemsPanel, ItemResolution } from '@/components/UncertainItemsPanel'
```

## Props

### UncertainItemsPanelProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `UncertainItem[]` | Yes | Array of uncertain items to display |
| `categories` | `Category[]` | Yes | Available categories for item assignment |
| `onResolve` | `(itemIndex: number, resolution: ItemResolution) => void` | Yes | Callback when item is resolved |
| `onDismiss` | `(itemIndex: number) => void` | Yes | Callback when item is dismissed |
| `onSubmitFeedback` | `(itemIndex: number, feedback: string, feedbackType: 'system_error' \| 'menu_unclear') => void` | No | Optional callback for feedback submission |
| `readonly` | `boolean` | No | If true, disables all actions (default: false) |

### UncertainItem Type

```typescript
interface UncertainItem {
  text: string                  // The uncertain text extracted
  reason: string                // Why extraction was uncertain
  confidence: number            // Confidence score (0.0-1.0)
  suggestedCategory?: string    // AI-suggested category
  suggestedPrice?: number       // AI-suggested price
}
```

### ItemResolution Type

```typescript
interface ItemResolution {
  action: 'add_to_menu' | 'mark_superfluous' | 'needs_retake'
  category?: string             // Required for 'add_to_menu'
  correctedData?: {             // Required for 'add_to_menu'
    name?: string
    price?: number
    description?: string
  }
  feedback?: string             // Optional user feedback
}
```

## Basic Usage

```typescript
import React, { useState } from 'react'
import { UncertainItemsPanel } from '@/components/UncertainItemsPanel'
import { UncertainItem, Category } from '@/lib/extraction/schema-stage1'

function MenuReviewPage() {
  const [uncertainItems, setUncertainItems] = useState<UncertainItem[]>([
    {
      text: 'Grilled Salmon',
      reason: 'Price partially obscured by shadow',
      confidence: 0.45,
      suggestedCategory: 'Main Courses',
      suggestedPrice: 24.99
    }
  ])

  const categories: Category[] = [
    {
      name: 'Appetizers',
      items: [],
      confidence: 1.0
    },
    {
      name: 'Main Courses',
      items: [],
      confidence: 0.95
    }
  ]

  const handleResolve = (itemIndex: number, resolution: ItemResolution) => {
    const item = uncertainItems[itemIndex]
    
    if (resolution.action === 'add_to_menu') {
      // Add item to menu with corrected data
      console.log('Adding to menu:', resolution.correctedData)
    } else if (resolution.action === 'mark_superfluous') {
      // Mark as decorative text
      console.log('Marked as superfluous')
    } else if (resolution.action === 'needs_retake') {
      // Request photo retake
      console.log('Needs retake')
    }
    
    // Remove from uncertain items
    setUncertainItems(prev => prev.filter((_, idx) => idx !== itemIndex))
  }

  const handleDismiss = (itemIndex: number) => {
    setUncertainItems(prev => prev.filter((_, idx) => idx !== itemIndex))
  }

  return (
    <UncertainItemsPanel
      items={uncertainItems}
      categories={categories}
      onResolve={handleResolve}
      onDismiss={handleDismiss}
    />
  )
}
```

## Advanced Usage

### With Feedback Submission

```typescript
function MenuReviewWithFeedback() {
  const handleSubmitFeedback = (
    itemIndex: number,
    feedback: string,
    feedbackType: 'system_error' | 'menu_unclear'
  ) => {
    // Send feedback to backend
    fetch('/api/extraction/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemIndex,
        feedback,
        feedbackType,
        jobId: extractionJobId
      })
    })
  }

  return (
    <UncertainItemsPanel
      items={uncertainItems}
      categories={categories}
      onResolve={handleResolve}
      onDismiss={handleDismiss}
      onSubmitFeedback={handleSubmitFeedback}
    />
  )
}
```

### Readonly Mode

```typescript
function MenuReviewReadonly() {
  return (
    <UncertainItemsPanel
      items={uncertainItems}
      categories={categories}
      onResolve={() => {}}
      onDismiss={() => {}}
      readonly={true}
    />
  )
}
```

### Integration with Extraction Results

```typescript
import { ExtractionResult } from '@/lib/extraction/schema-stage1'

function MenuExtractionReview({ result }: { result: ExtractionResult }) {
  return (
    <div className="space-y-6">
      {/* Show uncertain items first (prioritized) */}
      {result.uncertainItems.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Items Needing Review</h2>
          <UncertainItemsPanel
            items={result.uncertainItems}
            categories={result.menu.categories}
            onResolve={handleResolve}
            onDismiss={handleDismiss}
            onSubmitFeedback={handleSubmitFeedback}
          />
        </div>
      )}
      
      {/* Show extracted menu below */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Extracted Menu</h2>
        <CategoryTree categories={result.menu.categories} />
      </div>
    </div>
  )
}
```

## User Actions

### 1. Add to Menu

When a user clicks "Add to Menu":
1. An edit form appears with pre-filled suggested values
2. User can edit name, price, description, and select category
3. Form validates price (must be valid number ≥ 0)
4. On submit, `onResolve` is called with `action: 'add_to_menu'`

```typescript
// Resolution object for "Add to Menu"
{
  action: 'add_to_menu',
  category: 'Main Courses > Seafood',
  correctedData: {
    name: 'Grilled Salmon Fillet',
    price: 26.50,
    description: 'Fresh Atlantic salmon grilled to perfection'
  }
}
```

### 2. Mark Superfluous

When a user clicks "Mark Superfluous":
1. Confirmation dialog appears
2. If confirmed, `onResolve` is called with `action: 'mark_superfluous'`
3. Item is removed from uncertain items

```typescript
// Resolution object for "Mark Superfluous"
{
  action: 'mark_superfluous'
}
```

### 3. Needs Retake

When a user clicks "Needs Retake":
1. Confirmation dialog appears
2. If confirmed, `onResolve` is called with `action: 'needs_retake'`
3. Item is flagged for photo retake

```typescript
// Resolution object for "Needs Retake"
{
  action: 'needs_retake'
}
```

### 4. Submit Feedback

When a user clicks "Submit Feedback":
1. Feedback form appears with issue type dropdown
2. User selects type: "System Error" or "Menu Unclear"
3. User enters feedback text
4. On submit, `onSubmitFeedback` is called (if provided)

```typescript
// Feedback submission
onSubmitFeedback(
  0, // itemIndex
  'The price was clearly visible but extraction failed',
  'system_error'
)
```

## Confidence Color Coding

The component uses color coding to indicate confidence levels:

| Confidence | Color | Background | Meaning |
|------------|-------|------------|---------|
| < 0.3 | Red | `bg-red-50 border-red-300` | Very uncertain, likely needs retake |
| 0.3 - 0.5 | Orange | `bg-orange-50 border-orange-300` | Moderately uncertain, review carefully |
| > 0.5 | Yellow | `bg-yellow-50 border-yellow-300` | Somewhat uncertain, minor issues |

## Category Dropdown

The category dropdown supports hierarchical categories:

```typescript
// Flat categories
['Appetizers', 'Main Courses', 'Desserts']

// Hierarchical categories (displayed with " > " separator)
[
  'Appetizers',
  'Main Courses',
  'Main Courses > Seafood',
  'Main Courses > Steaks',
  'Desserts'
]
```

## Empty State

When there are no uncertain items, the component displays a success message:

```
✓ No uncertain items - all items extracted successfully!
```

This provides positive feedback to users that the extraction was successful.

## Styling

The component uses Tailwind CSS classes and follows the same design patterns as `CategoryTree`:

- Consistent spacing and padding
- Hover states for interactive elements
- Focus states for accessibility
- Responsive design
- Color-coded confidence indicators

## Accessibility

- All form inputs have associated labels with `htmlFor` attributes
- Buttons have descriptive titles
- Color coding is supplemented with text indicators
- Keyboard navigation supported
- Screen reader friendly

## Best Practices

### 1. Prioritize Uncertain Items

Always display uncertain items at the top of the review interface:

```typescript
<div className="space-y-6">
  {/* Uncertain items first */}
  <UncertainItemsPanel items={uncertainItems} ... />
  
  {/* Extracted menu below */}
  <CategoryTree categories={categories} ... />
</div>
```

### 2. Handle Resolutions Properly

Update your state and backend when items are resolved:

```typescript
const handleResolve = async (itemIndex: number, resolution: ItemResolution) => {
  const item = uncertainItems[itemIndex]
  
  // Update backend
  await fetch('/api/extraction/resolve', {
    method: 'POST',
    body: JSON.stringify({ item, resolution })
  })
  
  // Update local state
  setUncertainItems(prev => prev.filter((_, idx) => idx !== itemIndex))
  
  // If adding to menu, update menu state
  if (resolution.action === 'add_to_menu') {
    addItemToMenu(resolution.category, resolution.correctedData)
  }
}
```

### 3. Provide Feedback Mechanism

Always provide the `onSubmitFeedback` callback to collect user feedback:

```typescript
<UncertainItemsPanel
  items={uncertainItems}
  categories={categories}
  onResolve={handleResolve}
  onDismiss={handleDismiss}
  onSubmitFeedback={handleSubmitFeedback} // Important for improvement
/>
```

### 4. Track Metrics

Track resolution actions for analytics:

```typescript
const handleResolve = (itemIndex: number, resolution: ItemResolution) => {
  // Track metrics
  analytics.track('uncertain_item_resolved', {
    action: resolution.action,
    confidence: uncertainItems[itemIndex].confidence,
    hadSuggestions: !!(
      uncertainItems[itemIndex].suggestedCategory ||
      uncertainItems[itemIndex].suggestedPrice
    )
  })
  
  // Handle resolution...
}
```

## Testing

The component includes comprehensive tests in `src/components/__tests__/UncertainItemsPanel.test.tsx`:

```bash
npm test -- UncertainItemsPanel.test.tsx
```

Test coverage includes:
- Display of uncertain items
- Confidence color coding
- Expand/collapse behavior
- Add to Menu workflow
- Mark Superfluous action
- Needs Retake action
- Feedback submission
- Readonly mode
- Empty state

## Related Components

- **CategoryTree**: Displays extracted menu in hierarchical structure
- **MenuExtractionService**: Generates uncertain items during extraction
- **ExtractionReviewPage**: Integrates both components for full review workflow

## Troubleshooting

### Issue: Categories not showing in dropdown

**Solution**: Ensure categories array is properly structured with `name` and `items` fields:

```typescript
const categories: Category[] = [
  {
    name: 'Appetizers',
    items: [],
    confidence: 1.0
  }
]
```

### Issue: onResolve not being called

**Solution**: Check that you're not in readonly mode and that the callback is properly defined:

```typescript
<UncertainItemsPanel
  readonly={false} // Make sure this is false
  onResolve={(itemIndex, resolution) => {
    console.log('Resolve called:', itemIndex, resolution)
  }}
  ...
/>
```

### Issue: Form validation failing

**Solution**: Ensure price is a valid number:

```typescript
// The component validates:
// - Price must be a valid number
// - Price must be >= 0
// - Category must be selected
```

## Future Enhancements

Potential improvements for future versions:

1. **Bulk Actions**: Resolve multiple items at once
2. **Undo/Redo**: Allow users to undo resolutions
3. **Smart Suggestions**: ML-based category suggestions
4. **Keyboard Shortcuts**: Quick actions via keyboard
5. **Drag and Drop**: Drag items to categories
6. **Image Preview**: Show relevant portion of menu image
7. **Confidence Threshold**: Filter by confidence level
8. **Export**: Export uncertain items for batch processing

## Support

For issues or questions:
- Check the example file: `src/components/UncertainItemsPanel.example.tsx`
- Review tests: `src/components/__tests__/UncertainItemsPanel.test.tsx`
- See design document: `.kiro/specs/ai-text-extraction/design.md`
