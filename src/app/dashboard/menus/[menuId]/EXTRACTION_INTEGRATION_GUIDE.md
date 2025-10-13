# Extraction Integration Guide

## Overview
This guide explains how the new vision-LLM extraction service is integrated into the menu creation flow, replacing the old OCR-based approach.

## Architecture

### Flow Diagram
```
User clicks "Extract Items"
         ↓
Submit extraction job (POST /api/extraction/submit)
         ↓
Poll for status (GET /api/extraction/status/:jobId)
         ↓
Display results in ExtractionReview modal
         ↓
User reviews/edits categories and items
         ↓
Save to menu (POST /api/menus/:menuId/items)
         ↓
Refresh menu display
```

## Components

### 1. MenuEditor (Main Integration Point)
**Location**: `src/app/dashboard/menus/[menuId]/MenuEditor.tsx`

#### State Management
```typescript
// Extraction state
const [extractionJobId, setExtractionJobId] = useState<string | null>(null)
const [extractionStatus, setExtractionStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle')
const [extractionError, setExtractionError] = useState<string | null>(null)
const [extractionResult, setExtractionResult] = useState<any | null>(null)
const [showExtractionReview, setShowExtractionReview] = useState(false)
```

#### Key Functions

##### handleExtractItems()
Submits extraction job to the API:
```typescript
const handleExtractItems = async () => {
  // Submit job
  const result = await fetch('/api/extraction/submit', {
    method: 'POST',
    body: JSON.stringify({ menuId, imageUrl })
  })
  
  // Start polling
  pollExtractionJob(result.data.jobId)
}
```

##### pollExtractionJob()
Polls for job completion:
```typescript
const pollExtractionJob = async (jobId: string) => {
  const poll = async () => {
    const data = await fetch(`/api/extraction/status/${jobId}`)
    
    if (data.status === 'completed') {
      setExtractionResult(data.result)
      setShowExtractionReview(true)
    } else if (data.status === 'queued' || data.status === 'processing') {
      setTimeout(poll, 2000) // Poll every 2 seconds
    }
  }
  await poll()
}
```

##### handleSaveExtraction()
Converts hierarchical categories to flat menu items:
```typescript
const handleSaveExtraction = async (categories: Category[], resolvedItems: ExtractedMenuItem[]) => {
  // Flatten categories
  const flattenCategories = (cats: Category[], parentCategory?: string) => {
    const items: MenuItemFormData[] = []
    
    for (const cat of cats) {
      const categoryName = parentCategory ? `${parentCategory} > ${cat.name}` : cat.name
      
      // Add items from this category
      for (const item of cat.items) {
        items.push({
          name: item.name,
          price: item.price,
          description: item.description || '',
          category: categoryName,
          available: true
        })
      }
      
      // Recursively add subcategories
      if (cat.subcategories) {
        items.push(...flattenCategories(cat.subcategories, categoryName))
      }
    }
    
    return items
  }
  
  const allItems = flattenCategories(categories)
  
  // Bulk add items
  for (const item of allItems) {
    await fetch(`/api/menus/${menuId}/items`, {
      method: 'POST',
      body: JSON.stringify(item)
    })
  }
  
  // Refresh menu
  const refreshed = await fetch(`/api/menus/${menuId}`)
  setMenu(refreshed.data)
}
```

### 2. ExtractionReview Component
**Location**: `src/components/ExtractionReview.tsx`

#### Props
```typescript
interface ExtractionReviewProps {
  result: ExtractionResult          // Extraction result from API
  onSave: (categories, resolvedItems) => Promise<void>  // Save handler
  onCancel: () => void              // Cancel handler
  loading?: boolean                 // Loading state
}
```

#### Features
- **Header**: Summary stats (items, categories, uncertain items)
- **Uncertain Items Panel**: Highlighted section for items needing attention
- **Category Tree**: Hierarchical display with inline editing
- **Superfluous Text**: Collapsible section for decorative text
- **Metadata**: Extraction details (currency, confidence, etc.)

#### Usage Example
```typescript
<ExtractionReview
  result={extractionResult}
  onSave={handleSaveExtraction}
  onCancel={() => {
    setShowExtractionReview(false)
    setExtractionResult(null)
  }}
  loading={saving}
/>
```

### 3. CategoryTree Component
**Location**: `src/components/CategoryTree.tsx`

Displays hierarchical menu structure with:
- Expand/collapse for categories
- Inline editing for names, prices, descriptions
- Confidence score color coding
- Move up/down buttons for reordering

### 4. UncertainItemsPanel Component
**Location**: `src/components/UncertainItemsPanel.tsx`

Displays uncertain items with:
- Reasons and confidence scores
- Actions: add to menu, mark as superfluous, needs retake
- Category suggestion dropdown
- Feedback submission

## API Integration

### Extraction Submission
**Endpoint**: `POST /api/extraction/submit`

**Request**:
```json
{
  "menuId": "menu-uuid",
  "imageUrl": "https://storage.example.com/menu.jpg"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "jobId": "job-uuid",
    "status": "queued",
    "estimatedTime": "30-60 seconds"
  }
}
```

### Status Polling
**Endpoint**: `GET /api/extraction/status/:jobId`

**Response (Processing)**:
```json
{
  "success": true,
  "data": {
    "jobId": "job-uuid",
    "status": "processing"
  }
}
```

**Response (Completed)**:
```json
{
  "success": true,
  "data": {
    "jobId": "job-uuid",
    "status": "completed",
    "result": {
      "menu": {
        "categories": [
          {
            "name": "Appetizers",
            "items": [
              {
                "name": "Spring Rolls",
                "price": 8.99,
                "description": "Crispy vegetable rolls",
                "confidence": 0.95
              }
            ],
            "confidence": 0.92
          }
        ]
      },
      "currency": "USD",
      "uncertainItems": [],
      "superfluousText": []
    }
  }
}
```

## Data Structures

### ExtractionResult
```typescript
interface ExtractionResult {
  menu: StructuredMenu
  currency: string
  uncertainItems: UncertainItem[]
  superfluousText: SuperfluousText[]
}
```

### StructuredMenu
```typescript
interface StructuredMenu {
  categories: Category[]
}
```

### Category
```typescript
interface Category {
  name: string
  items: MenuItem[]
  subcategories?: Category[]  // Nested hierarchy
  confidence: number
}
```

### MenuItem
```typescript
interface MenuItem {
  name: string
  price: number
  description?: string
  confidence: number
}
```

### UncertainItem
```typescript
interface UncertainItem {
  text: string
  reason: string
  confidence: number
  suggestedCategory?: string
  suggestedPrice?: number
}
```

## Error Handling

### Rate Limiting
```typescript
catch (e) {
  if (e.body?.code === 'RATE_LIMIT_EXCEEDED') {
    showToast({ 
      type: 'info', 
      title: 'Rate limit', 
      description: 'Please wait before trying again.' 
    })
  }
}
```

### Plan Limits
```typescript
catch (e) {
  if (e.body?.code === 'PLAN_LIMIT_EXCEEDED') {
    showToast({ 
      type: 'info', 
      title: 'Plan limit reached', 
      description: 'Monthly extraction limit reached.' 
    })
  }
}
```

### Extraction Failures
```typescript
if (data.status === 'failed') {
  setExtractionError(data.error || 'Extraction failed')
  showToast({ 
    type: 'error', 
    title: 'Extraction failed', 
    description: 'Please try again or add items manually' 
  })
}
```

## UI States

### Idle
- "Extract Items" button enabled
- No status indicators

### Queued
- "Extracting..." button disabled
- Spinner with "Extraction queued..." message

### Processing
- "Extracting..." button disabled
- Spinner with "Extracting menu items with AI..." message
- "This usually takes 30-60 seconds" helper text

### Completed
- ExtractionReview modal opens
- Full-screen overlay with results
- CategoryTree and UncertainItemsPanel displayed

### Failed
- Error message displayed
- "Enter Items Manually" fallback button

## Testing

### Manual Testing Checklist
- [ ] Upload menu image
- [ ] Click "Extract Items"
- [ ] Verify loading states
- [ ] Wait for extraction to complete
- [ ] Review hierarchical categories
- [ ] Edit item names/prices/descriptions
- [ ] Resolve uncertain items
- [ ] Save to menu
- [ ] Verify items appear correctly
- [ ] Test error scenarios (rate limit, plan limit, failure)

### Integration Testing
```typescript
describe('Extraction Integration', () => {
  it('should submit extraction job', async () => {
    const response = await fetch('/api/extraction/submit', {
      method: 'POST',
      body: JSON.stringify({ menuId, imageUrl })
    })
    expect(response.ok).toBe(true)
    expect(response.data.jobId).toBeDefined()
  })
  
  it('should poll for status', async () => {
    const response = await fetch(`/api/extraction/status/${jobId}`)
    expect(response.ok).toBe(true)
    expect(response.data.status).toBeOneOf(['queued', 'processing', 'completed', 'failed'])
  })
  
  it('should save extraction results', async () => {
    // Test covered by existing menu item API tests
  })
})
```

## Troubleshooting

### Extraction not starting
- Check if image is uploaded
- Verify API key is configured
- Check rate limits and plan limits
- Review server logs for errors

### Polling not working
- Check network connectivity
- Verify job ID is correct
- Check if job expired (timeout)
- Review browser console for errors

### Results not displaying
- Check if extraction completed successfully
- Verify result structure matches schema
- Check for JavaScript errors in console
- Review component props

### Items not saving
- Check plan limits (item count)
- Verify menu ID is correct
- Check network connectivity
- Review API response for errors

## Best Practices

### Performance
1. **Debounce polling**: Don't poll too frequently (2 seconds is optimal)
2. **Cancel polling**: Stop polling when component unmounts
3. **Optimize re-renders**: Use React.memo for heavy components
4. **Lazy load**: Load extraction results progressively for large menus

### User Experience
1. **Show progress**: Display loading states and estimated time
2. **Provide feedback**: Use toasts for success/error messages
3. **Enable cancellation**: Allow users to cancel extraction
4. **Fallback gracefully**: Provide manual entry option on failure

### Error Handling
1. **Catch all errors**: Handle network, API, and validation errors
2. **Show user-friendly messages**: Avoid technical jargon
3. **Log errors**: Send errors to monitoring service
4. **Provide recovery**: Offer retry or alternative actions

## Future Enhancements

### Planned Features
1. **Progress indicator**: Show percentage complete
2. **Retry mechanism**: Allow retrying without re-uploading
3. **Partial save**: Save reviewed items incrementally
4. **Undo/redo**: Support undo for edits
5. **Keyboard shortcuts**: Add shortcuts for common actions
6. **Auto-save draft**: Save review state to resume later
7. **Comparison view**: Show original image alongside results

### Performance Optimizations
1. **Debounce polling**: Reduce frequency after initial checks
2. **Optimistic updates**: Update UI immediately on edits
3. **Lazy loading**: Load results progressively
4. **Caching**: Cache results by image hash

## Support

For questions or issues:
- Review this guide and TASK_10_COMPLETION.md
- Check API documentation in `src/app/api/extraction/API_DOCUMENTATION.md`
- Review component usage guides:
  - `src/components/CATEGORYTREE_USAGE.md`
  - `src/components/UNCERTAINITEMSPANEL_USAGE.md`
- Check service documentation in `src/lib/extraction/SERVICE_USAGE_GUIDE.md`
