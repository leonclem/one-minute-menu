# CategoryTree Component Usage Guide

## Overview

The `CategoryTree` component displays extracted menu items in a hierarchical tree structure with inline editing capabilities and reordering functionality. It's designed for reviewing and editing AI-extracted menu data.

## Features

- ✅ Hierarchical display of categories and subcategories
- ✅ Expand/collapse functionality for categories
- ✅ Inline editing for category names, item names, prices, and descriptions
- ✅ Confidence score display with color coding
- ✅ Move up/down buttons for reordering items
- ✅ Readonly mode for display-only scenarios
- ✅ Keyboard shortcuts (Enter to save, Escape to cancel)

## Installation

```bash
npm install lucide-react
```

## Basic Usage

```typescript
import { CategoryTree } from '@/components/CategoryTree'
import { Category } from '@/lib/extraction/schema-stage1'

function MenuReview() {
  const [categories, setCategories] = useState<Category[]>([
    {
      name: 'Appetizers',
      confidence: 0.95,
      items: [
        {
          name: 'Spring Rolls',
          price: 8.5,
          description: 'Crispy vegetable rolls',
          confidence: 0.9
        }
      ]
    }
  ])

  const handleReorder = (newCategories: Category[]) => {
    setCategories(newCategories)
  }

  const handleEditItem = (
    categoryPath: number[],
    itemIndex: number,
    updates: Partial<MenuItem>
  ) => {
    // Update the item at the specified path
    const newCategories = [...categories]
    let targetCategory = newCategories[categoryPath[0]]
    
    // Navigate to nested category if needed
    for (let i = 1; i < categoryPath.length; i++) {
      targetCategory = targetCategory.subcategories![categoryPath[i]]
    }
    
    // Update the item
    targetCategory.items[itemIndex] = {
      ...targetCategory.items[itemIndex],
      ...updates
    }
    
    setCategories(newCategories)
  }

  const handleEditCategory = (
    categoryPath: number[],
    updates: Partial<Category>
  ) => {
    // Update the category at the specified path
    const newCategories = [...categories]
    let targetCategory = newCategories[categoryPath[0]]
    
    // Navigate to nested category if needed
    for (let i = 1; i < categoryPath.length; i++) {
      targetCategory = targetCategory.subcategories![categoryPath[i]]
    }
    
    // Update the category
    Object.assign(targetCategory, updates)
    setCategories(newCategories)
  }

  return (
    <CategoryTree
      categories={categories}
      onReorder={handleReorder}
      onEditItem={handleEditItem}
      onEditCategory={handleEditCategory}
    />
  )
}
```

## Props

### CategoryTreeProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `categories` | `Category[]` | Yes | Array of categories to display |
| `onReorder` | `(newCategories: Category[]) => void` | No | Callback when items are reordered |
| `onEditItem` | `(categoryPath: number[], itemIndex: number, updates: Partial<MenuItem>) => void` | No | Callback when an item is edited |
| `onEditCategory` | `(categoryPath: number[], updates: Partial<Category>) => void` | No | Callback when a category is edited |
| `readonly` | `boolean` | No | If true, disables editing and reordering (default: false) |

## Data Structures

### Category

```typescript
interface Category {
  name: string
  items: MenuItem[]
  subcategories?: Category[]
  confidence: number // 0.0 to 1.0
}
```

### MenuItem

```typescript
interface MenuItem {
  name: string
  price: number
  description?: string
  confidence: number // 0.0 to 1.0
}
```

## Confidence Score Color Coding

The component uses color coding to indicate confidence levels:

- **Green** (>0.8): High confidence - data is likely accurate
- **Yellow** (0.6-0.8): Medium confidence - review recommended
- **Red** (<0.6): Low confidence - requires careful review

## Keyboard Shortcuts

When editing a field:
- **Enter**: Save changes
- **Escape**: Cancel editing

## Examples

### Readonly Mode

```typescript
<CategoryTree
  categories={categories}
  readonly={true}
/>
```

### With Nested Subcategories

```typescript
const categories: Category[] = [
  {
    name: 'Main Courses',
    confidence: 0.88,
    items: [
      {
        name: 'Pasta Carbonara',
        price: 15.5,
        confidence: 0.92
      }
    ],
    subcategories: [
      {
        name: 'Steaks',
        confidence: 0.75,
        items: [
          {
            name: 'Ribeye Steak',
            price: 35.0,
            description: '300g premium beef',
            confidence: 0.55
          }
        ]
      }
    ]
  }
]

<CategoryTree categories={categories} />
```

### Handling Category Path

The `categoryPath` parameter in callbacks is an array of indices representing the path to a nested category:

- `[0]` - First top-level category
- `[1, 0]` - First subcategory of the second top-level category
- `[2, 1, 0]` - First sub-subcategory of the second subcategory of the third top-level category

## Styling

The component uses Tailwind CSS classes and is fully responsive. Key styling features:

- Hover effects on edit buttons
- Color-coded confidence scores
- Smooth transitions for expand/collapse
- Disabled state styling for reorder buttons

## Accessibility

- Semantic HTML structure
- Keyboard navigation support
- Clear visual feedback for interactive elements
- Disabled state for unavailable actions

## Integration with Extraction Flow

This component is designed to work with the AI Text Extraction system:

1. Extract menu data using the vision-LLM service
2. Display results in CategoryTree for review
3. User makes corrections via inline editing
4. User reorders items as needed
5. Save final menu structure

## Requirements Satisfied

This component satisfies the following requirements from the AI Text Extraction spec:

- **Requirement 1.1**: Hierarchical structure extraction and display
- **Requirement 1.3**: Pre-organized categories without manual sorting
- **Requirement 4.1**: Confidence score display for focused review
- **Requirement 7.3**: Inline editing without leaving review interface

## Testing

The component includes comprehensive tests covering:

- Rendering and display
- Expand/collapse functionality
- Inline editing (category names, item names, prices, descriptions)
- Reordering (move up/down)
- Confidence score display
- Readonly mode
- Keyboard shortcuts

Run tests with:

```bash
npm test -- CategoryTree.test.tsx
```

## Future Enhancements

Potential improvements for Stage 2:

- Drag-and-drop reordering
- Bulk editing operations
- Category merging/splitting
- Export to different formats
- Undo/redo functionality
