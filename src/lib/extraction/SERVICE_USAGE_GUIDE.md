# Menu Extraction Service - Usage Guide

## Quick Start

```typescript
import { createMenuExtractionService } from '@/lib/extraction'
import { createClient } from '@supabase/supabase-js'

// 1. Initialize the service
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const extractionService = createMenuExtractionService(
  process.env.OPENAI_API_KEY!,
  supabase
)

// 2. Submit an extraction job
const job = await extractionService.submitExtractionJob(
  imageUrl,      // URL of the menu image in Supabase Storage
  userId,        // User ID from auth
  {
    schemaVersion: 'stage1',  // Use 'stage1' for MVP
    currency: 'USD',          // Optional: override currency detection
    includeExamples: true     // Include examples in prompt (recommended)
  }
)

// 3. Check the results
if (job.status === 'completed') {
  const menu = job.result?.menu
  const categories = menu?.categories
  
  // Handle uncertain items
  const uncertainItems = job.result?.uncertainItems || []
  
  // Check cost
  const cost = job.tokenUsage?.estimatedCost
  console.log(`Extraction cost: $${cost}`)
}
```

## API Reference

### `submitExtractionJob(imageUrl, userId, options)`

Submits a menu image for extraction.

**Parameters:**
- `imageUrl` (string) - URL of the menu image
- `userId` (string) - User ID from authentication
- `options` (ExtractionOptions) - Optional configuration

**Options:**
```typescript
{
  schemaVersion?: 'stage1' | 'stage2'  // Default: 'stage1'
  promptVersion?: string                // Default: 'v1.0'
  currency?: string                     // Override currency detection
  language?: string                     // Override language detection
  includeExamples?: boolean            // Include examples in prompt (default: true)
  customInstructions?: string          // Additional instructions
}
```

**Returns:** `Promise<ExtractionJob>`

**Example:**
```typescript
const job = await service.submitExtractionJob(
  'https://storage.supabase.co/menu.jpg',
  'user-123',
  {
    schemaVersion: 'stage1',
    currency: 'SGD',
    includeExamples: true
  }
)
```

### `getJobStatus(jobId)`

Retrieves the status and results of an extraction job.

**Parameters:**
- `jobId` (string) - Job ID returned from `submitExtractionJob`

**Returns:** `Promise<ExtractionJob | null>`

**Example:**
```typescript
const job = await service.getJobStatus('job-123')

if (job?.status === 'completed') {
  // Process results
} else if (job?.status === 'failed') {
  console.error('Extraction failed:', job.error)
}
```

### `processWithVisionLLM(imageUrl, promptPackage, options)`

Low-level method to process an image with the vision-LLM API.

**Note:** Usually you should use `submitExtractionJob` instead.

**Parameters:**
- `imageUrl` (string) - URL of the menu image
- `promptPackage` (PromptPackage) - Prompt configuration from `getPromptPackage()`
- `options` (ExtractionOptions) - Optional configuration

**Returns:** `Promise<{ extractionResult, usage }>`

## Data Structures

### ExtractionJob

```typescript
interface ExtractionJob {
  id: string                    // Job identifier
  userId: string                // User who submitted
  imageUrl: string              // Menu image URL
  imageHash: string             // SHA-256 hash for idempotency
  status: 'queued' | 'processing' | 'completed' | 'failed'
  schemaVersion: 'stage1' | 'stage2'
  promptVersion: string         // e.g., 'v1.0'
  result?: ExtractionResult     // Extraction results (if completed)
  error?: string                // Error message (if failed)
  createdAt: Date
  completedAt?: Date
  processingTime?: number       // Milliseconds
  tokenUsage?: TokenUsage       // Token usage and cost
}
```

### ExtractionResult

```typescript
interface ExtractionResult {
  menu: StructuredMenu          // Hierarchical menu structure
  currency: string              // Detected currency (e.g., 'USD')
  uncertainItems: UncertainItem[]     // Items needing review
  superfluousText: SuperfluousText[]  // Decorative text
}
```

### StructuredMenu

```typescript
interface StructuredMenu {
  categories: Category[]        // Top-level categories
}

interface Category {
  name: string                  // Category name
  items: MenuItem[]             // Menu items in this category
  subcategories?: Category[]    // Nested subcategories
  confidence: number            // 0.0 to 1.0
}

interface MenuItem {
  name: string                  // Item name
  price: number                 // Price (numeric, no currency symbol)
  description?: string          // Optional description
  confidence: number            // 0.0 to 1.0
}
```

### TokenUsage

```typescript
interface TokenUsage {
  inputTokens: number           // Tokens in prompt + image
  outputTokens: number          // Tokens in response
  totalTokens: number           // Sum of input + output
  estimatedCost: number         // Cost in USD
}
```

## Utility Functions

### `estimateExtractionCost(imageSize, includeExamples)`

Estimates the cost of an extraction before submitting.

**Parameters:**
- `imageSize` (number) - Image size in bytes
- `includeExamples` (boolean) - Whether to include examples in prompt

**Returns:** `number` - Estimated cost in USD

**Example:**
```typescript
const cost = estimateExtractionCost(1024 * 1024, true)
console.log(`Estimated cost: $${cost}`)  // ~$0.0125
```

### `isWithinCostBudget(estimatedCost, budget)`

Checks if an estimated cost is within budget.

**Parameters:**
- `estimatedCost` (number) - Estimated cost in USD
- `budget` (number) - Budget limit in USD (default: 0.03)

**Returns:** `boolean`

**Example:**
```typescript
if (isWithinCostBudget(cost, 0.03)) {
  // Proceed with extraction
} else {
  // Cost too high, warn user
}
```

## Error Handling

### Common Errors

**Rate Limiting (429)**
```typescript
try {
  const job = await service.submitExtractionJob(...)
} catch (error) {
  if (error.status === 429) {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 60000))
    // Retry...
  }
}
```

**Validation Failure**
```typescript
try {
  const job = await service.submitExtractionJob(...)
} catch (error) {
  if (error.message.includes('validation failed')) {
    // Extraction returned invalid data
    // Fallback to manual entry
  }
}
```

**Image Quality Issues**
```typescript
const job = await service.submitExtractionJob(...)

if (job.result?.uncertainItems.length > 5) {
  // Many uncertain items - image quality may be poor
  // Suggest retaking photo
}
```

## Best Practices

### 1. Check for Existing Jobs (Idempotency)

The service automatically checks for duplicate images using SHA-256 hashing. If the same image is submitted twice, it returns the cached result instantly.

```typescript
// First submission - processes image
const job1 = await service.submitExtractionJob(imageUrl, userId)

// Second submission - returns cached result
const job2 = await service.submitExtractionJob(imageUrl, userId)
// job2 is returned immediately without API call
```

### 2. Handle Uncertain Items

Always check for uncertain items and present them to users for review:

```typescript
const uncertainItems = job.result?.uncertainItems || []

if (uncertainItems.length > 0) {
  // Show uncertain items panel
  uncertainItems.forEach(item => {
    console.log(`Uncertain: ${item.text}`)
    console.log(`Reason: ${item.reason}`)
    console.log(`Confidence: ${item.confidence}`)
  })
}
```

### 3. Monitor Costs

Track extraction costs to stay within budget:

```typescript
const job = await service.submitExtractionJob(...)

if (job.tokenUsage) {
  const cost = job.tokenUsage.estimatedCost
  
  // Log for monitoring
  console.log(`Extraction cost: $${cost}`)
  console.log(`Tokens used: ${job.tokenUsage.totalTokens}`)
  
  // Alert if cost is high
  if (cost > 0.05) {
    console.warn('High extraction cost!')
  }
}
```

### 4. Handle Processing Time

Extraction typically takes 3-8 seconds. Show loading states:

```typescript
// Show loading indicator
setLoading(true)

try {
  const job = await service.submitExtractionJob(...)
  
  console.log(`Processing took ${job.processingTime}ms`)
  
  // Process results
} finally {
  setLoading(false)
}
```

### 5. Validate Results

Always check confidence scores and validate critical data:

```typescript
const menu = job.result?.menu

menu?.categories.forEach(category => {
  if (category.confidence < 0.6) {
    console.warn(`Low confidence category: ${category.name}`)
  }
  
  category.items.forEach(item => {
    if (item.confidence < 0.6) {
      console.warn(`Low confidence item: ${item.name}`)
    }
    
    // Validate price
    if (item.price === 0) {
      console.warn(`Zero price for: ${item.name}`)
    }
    if (item.price > 10000) {
      console.warn(`Suspiciously high price: ${item.name} - $${item.price}`)
    }
  })
})
```

## Integration with Next.js API Routes

### Example API Route

```typescript
// app/api/extraction/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createMenuExtractionService } from '@/lib/extraction'

export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const supabase = createClient(...)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get image URL from request
    const { imageUrl, options } = await request.json()
    
    // Create service
    const service = createMenuExtractionService(
      process.env.OPENAI_API_KEY!,
      supabase
    )
    
    // Submit extraction job
    const job = await service.submitExtractionJob(
      imageUrl,
      user.id,
      options
    )
    
    return NextResponse.json({ job })
  } catch (error) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: 'Extraction failed' },
      { status: 500 }
    )
  }
}
```

### Example Client Usage

```typescript
// components/MenuUpload.tsx
async function handleUpload(file: File) {
  // 1. Upload image to Supabase Storage
  const { data, error } = await supabase.storage
    .from('menu-images')
    .upload(`${userId}/${file.name}`, file)
  
  if (error) throw error
  
  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('menu-images')
    .getPublicUrl(data.path)
  
  // 3. Submit extraction job
  const response = await fetch('/api/extraction/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: publicUrl,
      options: {
        schemaVersion: 'stage1',
        includeExamples: true
      }
    })
  })
  
  const { job } = await response.json()
  
  // 4. Poll for completion or use realtime
  // ... (see Task 6 for job queue integration)
}
```

## Performance Tips

### 1. Use Idempotency

Let the service handle duplicate detection automatically. Don't implement your own caching layer.

### 2. Optimize Image Size

Preprocess images before upload to reduce token usage:

```typescript
import { processImage } from '@/lib/image-utils'

const processed = await processImage(file, {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
  format: 'jpeg'
})

// Upload processed image
```

### 3. Batch Operations

For multiple menus, submit jobs in parallel:

```typescript
const jobs = await Promise.all(
  imageUrls.map(url => 
    service.submitExtractionJob(url, userId)
  )
)
```

### 4. Monitor Performance

Track metrics for optimization:

```typescript
const startTime = Date.now()
const job = await service.submitExtractionJob(...)
const endTime = Date.now()

console.log(`Total time: ${endTime - startTime}ms`)
console.log(`Processing time: ${job.processingTime}ms`)
console.log(`Network overhead: ${endTime - startTime - job.processingTime!}ms`)
```

## Troubleshooting

### Issue: "OpenAI API key is required"

**Solution:** Ensure `OPENAI_API_KEY` is set in environment variables.

### Issue: High extraction costs

**Solution:** 
- Reduce image size before upload
- Set `includeExamples: false` to reduce prompt tokens
- Check for duplicate submissions

### Issue: Low confidence scores

**Solution:**
- Improve image quality (lighting, focus, resolution)
- Ensure menu text is clearly visible
- Avoid glare and shadows
- Photograph menu sections separately if large

### Issue: Many uncertain items

**Solution:**
- Retake photo with better quality
- Ensure menu is flat and not curved
- Use good lighting
- Avoid reflections and glare

## Support

For issues or questions:
1. Check the test suite for examples
2. Review the design document
3. Check the completion documentation
4. Consult the requirements document
