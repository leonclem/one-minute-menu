# Extraction API Documentation

This document describes the API endpoints for the AI-powered menu extraction system.

## Overview

The extraction API provides two main endpoints:
1. **POST /api/extraction/submit** - Submit a menu image for AI extraction
2. **GET /api/extraction/status/[jobId]** - Check the status and results of an extraction job

## Authentication

All endpoints require authentication. Users must be logged in with a valid session token.

**Error Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

## Rate Limiting

The extraction API enforces rate limiting to prevent abuse:
- **Free tier**: 10 uploads per hour
- **Premium tier**: 50 uploads per hour (configurable via `PLAN_RUNTIME_LIMITS`)

Rate limits can be overridden using the `EXTRACTION_RATE_LIMIT_PER_HOUR` environment variable.

**Error Response (429 Too Many Requests):**
```json
{
  "error": "Rate limit exceeded (10/10 uploads/hour)",
  "code": "RATE_LIMIT_EXCEEDED",
  "resetAt": "2024-01-15T15:00:00.000Z"
}
```

## Quota Enforcement

Monthly extraction quotas are enforced based on user plan:
- **Free tier**: 5 extractions per month
- **Premium tier**: 50 extractions per month
- **Enterprise tier**: Unlimited

**Error Response (403 Forbidden):**
```json
{
  "error": "Monthly extraction limit reached (5/5)",
  "code": "QUOTA_EXCEEDED",
  "upgrade": {
    "cta": "Upgrade to Premium",
    "href": "/upgrade",
    "reason": "Increase extraction limit from 5 to 50 per month"
  }
}
```

---

## POST /api/extraction/submit

Submit a menu image for AI-powered extraction.

### Request

**URL:** `/api/extraction/submit`

**Method:** `POST`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <session_token>` (handled by Supabase)

**Body:**
```json
{
  "imageUrl": "https://example.com/menu-image.jpg",
  "schemaVersion": "stage1",
  "promptVersion": "v1.0",
  "currency": "USD",
  "language": "en",
  "force": false
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `imageUrl` | string | Yes | URL of the menu image to extract. Must be a valid URL pointing to an image. |
| `schemaVersion` | string | No | Schema version to use (`stage1` or `stage2`). Default: `stage1` |
| `promptVersion` | string | No | Prompt version to use. Default: latest version |
| `currency` | string | No | Currency override (e.g., `USD`, `SGD`, `EUR`). If not provided, will be auto-detected. |
| `language` | string | No | Language override (e.g., `en`, `zh`, `es`). If not provided, will be auto-detected. |
| `force` | boolean | No | Force reprocessing even if cached result exists. Default: `false` |

### Image Validation

The API validates images before processing:
- **Supported formats**: JPEG, JPG, PNG, WebP
- **Maximum size**: 8MB
- **Validation**: Image must be accessible and valid

**Error Response (400 Bad Request):**
```json
{
  "error": "Unsupported image format. Supported formats: image/jpeg, image/jpg, image/png, image/webp"
}
```

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "queued",
    "estimatedCompletionTime": "2024-01-15T14:30:15.000Z",
    "quotaRemaining": 4,
    "processingTime": 245
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | string | Unique identifier for the extraction job. Use this to check status. |
| `status` | string | Current job status (`queued`, `processing`, `completed`, `failed`) |
| `estimatedCompletionTime` | string | ISO 8601 timestamp of estimated completion (typically 10-15 seconds) |
| `quotaRemaining` | number | Number of extractions remaining in current month |
| `processingTime` | number | Time taken to submit the job (milliseconds) |

### Error Responses

**400 Bad Request - Missing imageUrl:**
```json
{
  "error": "imageUrl is required"
}
```

**400 Bad Request - Invalid imageUrl:**
```json
{
  "error": "Invalid imageUrl format"
}
```

**400 Bad Request - Invalid JSON:**
```json
{
  "error": "Invalid JSON in request body"
}
```

**400 Bad Request - Image validation failed:**
```json
{
  "error": "Image too large. Maximum size: 8MB"
}
```

**500 Internal Server Error - Service not configured:**
```json
{
  "error": "Extraction service not configured"
}
```

**500 Internal Server Error - Extraction failed:**
```json
{
  "error": "Failed to submit extraction job",
  "code": "EXTRACTION_FAILED"
}
```

### Example Usage

```javascript
// Submit extraction job
const response = await fetch('/api/extraction/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    imageUrl: 'https://storage.example.com/menus/menu-123.jpg',
    schemaVersion: 'stage1',
    currency: 'USD'
  })
})

const data = await response.json()

if (data.success) {
  console.log('Job submitted:', data.data.jobId)
  console.log('Estimated completion:', data.data.estimatedCompletionTime)
  
  // Poll for results
  pollJobStatus(data.data.jobId)
} else {
  console.error('Submission failed:', data.error)
}
```

---

## GET /api/extraction/status/[jobId]

Get the status and results of an extraction job.

### Request

**URL:** `/api/extraction/status/{jobId}`

**Method:** `GET`

**Headers:**
- `Authorization: Bearer <session_token>` (handled by Supabase)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `jobId` | string | Yes | The unique identifier of the extraction job |

### Response

**Success (200 OK) - Queued Job:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "queued",
    "schemaVersion": "stage1",
    "promptVersion": "v1.0",
    "createdAt": "2024-01-15T14:30:00.000Z"
  }
}
```

**Success (200 OK) - Processing Job:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "schemaVersion": "stage1",
    "promptVersion": "v1.0",
    "createdAt": "2024-01-15T14:30:00.000Z"
  }
}
```

**Success (200 OK) - Completed Job:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "schemaVersion": "stage1",
    "promptVersion": "v1.0",
    "result": {
      "menu": {
        "categories": [
          {
            "name": "Appetizers",
            "items": [
              {
                "name": "Spring Rolls",
                "price": 8.99,
                "description": "Crispy vegetable spring rolls",
                "confidence": 0.95
              }
            ],
            "confidence": 0.95
          }
        ]
      },
      "uncertainItems": [],
      "superfluousText": [],
      "currency": "USD",
      "detectedLanguage": "en"
    },
    "createdAt": "2024-01-15T14:30:00.000Z",
    "completedAt": "2024-01-15T14:30:12.000Z",
    "processingTime": 12000,
    "tokenUsage": {
      "inputTokens": 1200,
      "outputTokens": 450,
      "totalTokens": 1650,
      "estimatedCost": 0.0245
    },
    "confidence": 0.92,
    "uncertainItems": [],
    "superfluousText": []
  }
}
```

**Success (200 OK) - Failed Job:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "failed",
    "schemaVersion": "stage1",
    "promptVersion": "v1.0",
    "error": "API rate limit exceeded. Please try again later.",
    "createdAt": "2024-01-15T14:30:00.000Z",
    "completedAt": "2024-01-15T14:30:05.000Z"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the extraction job |
| `status` | string | Current job status (`queued`, `processing`, `completed`, `failed`) |
| `schemaVersion` | string | Schema version used for extraction |
| `promptVersion` | string | Prompt version used for extraction |
| `result` | object | Extraction results (only present when status is `completed`) |
| `error` | string | Error message (only present when status is `failed`) |
| `createdAt` | string | ISO 8601 timestamp of job creation |
| `completedAt` | string | ISO 8601 timestamp of job completion (only present when completed or failed) |
| `processingTime` | number | Processing time in milliseconds (only present when completed) |
| `tokenUsage` | object | Token usage and cost information (only present when completed) |
| `confidence` | number | Overall confidence score 0.0-1.0 (only present when completed) |
| `uncertainItems` | array | Items that need manual review (only present when completed) |
| `superfluousText` | array | Decorative text that was filtered out (only present when completed) |

### Error Responses

**400 Bad Request - Missing jobId:**
```json
{
  "error": "jobId parameter is required"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden - User doesn't own job:**
```json
{
  "error": "Forbidden"
}
```

**404 Not Found:**
```json
{
  "error": "Job not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Database connection failed",
  "code": "STATUS_CHECK_FAILED"
}
```

### Example Usage

```javascript
// Poll for job completion
async function pollJobStatus(jobId) {
  const maxAttempts = 60 // 5 minutes at 5 second intervals
  const intervalMs = 5000
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`/api/extraction/status/${jobId}`)
    const data = await response.json()
    
    if (!data.success) {
      console.error('Status check failed:', data.error)
      return null
    }
    
    const job = data.data
    console.log(`Job status: ${job.status}`)
    
    if (job.status === 'completed') {
      console.log('Extraction completed!')
      console.log('Results:', job.result)
      return job
    }
    
    if (job.status === 'failed') {
      console.error('Extraction failed:', job.error)
      return null
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  
  console.error('Polling timeout')
  return null
}
```

---

## Result Schema

### Stage 1 Schema (MVP)

The Stage 1 schema includes basic menu structure with categories and items:

```typescript
interface ExtractionResult {
  menu: {
    categories: Category[]
  }
  uncertainItems: UncertainItem[]
  superfluousText: SuperfluousText[]
  currency: string
  detectedLanguage: string
}

interface Category {
  name: string
  items: MenuItem[]
  subcategories?: Category[]
  confidence: number
}

interface MenuItem {
  name: string
  price: number
  description?: string
  confidence: number
}

interface UncertainItem {
  text: string
  reason: string
  confidence: number
  suggestedCategory?: string
  suggestedPrice?: number
}

interface SuperfluousText {
  text: string
  context: string
  confidence: number
}
```

### Stage 2 Schema (Full)

Stage 2 extends the schema with variants, modifiers, and complex structures:

```typescript
interface MenuItem {
  name: string
  price: number
  description?: string
  confidence: number
  
  // Stage 2 additions
  variants?: ItemVariant[]
  modifierGroups?: ModifierGroup[]
  additional?: AdditionalInfo
}

interface ItemVariant {
  size?: string
  price: number
  attributes?: Record<string, any>
}

interface ModifierGroup {
  name: string
  type: 'single' | 'multi'
  required: boolean
  options: ModifierOption[]
}

interface ModifierOption {
  name: string
  priceDelta: number
}

interface AdditionalInfo {
  servedWith?: string[]
  forPax?: number
  prepTimeMin?: number
  notes?: string[]
}
```

---

## Cost Information

### Token Usage

The API tracks token usage for each extraction:
- **Input tokens**: Image tokens + prompt tokens (~1200-1500)
- **Output tokens**: Extracted menu data (~300-800 depending on menu size)
- **Total cost**: Calculated based on OpenAI pricing

### Pricing (as of 2024)

- **Input tokens**: $2.50 per 1M tokens
- **Output tokens**: $10.00 per 1M tokens
- **Average cost per extraction**: $0.02-0.03

### Cost Optimization

The API implements several cost optimization strategies:
- **Idempotency**: Cached results for duplicate image hashes
- **Image preprocessing**: Resize and compress images to reduce token usage
- **Deterministic extraction**: Temperature=0 to avoid wasted tokens
- **Quota enforcement**: Prevent abuse and cost overruns

---

## Best Practices

### 1. Image Quality

For best extraction results:
- Use high-resolution images (at least 1024x1024)
- Ensure good lighting and minimal glare
- Avoid blurry or distorted images
- Photograph menu sections separately if menu is large

### 2. Polling Strategy

When polling for job completion:
- Use 5-second intervals to balance responsiveness and API load
- Set a reasonable timeout (5 minutes recommended)
- Handle all job statuses (queued, processing, completed, failed)
- Implement exponential backoff for failed requests

### 3. Error Handling

Always handle errors gracefully:
- Check quota before submitting jobs
- Respect rate limits and retry after reset time
- Provide fallback to manual entry for failed extractions
- Display user-friendly error messages

### 4. Caching

Leverage idempotency for efficiency:
- Same image hash returns cached results
- Set `force: true` only when reprocessing is necessary
- Cache results client-side to avoid unnecessary API calls

---

## Environment Variables

The following environment variables configure the extraction API:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for vision-LLM | Required |
| `EXTRACTION_RATE_LIMIT_PER_HOUR` | Rate limit override | Plan-specific |

---

## Requirements Satisfied

This API implementation satisfies the following requirements:

- **15.3**: API routes for extraction submission and status
- **15.8**: Rate limiting (10 uploads/hour per user)
- **12.2**: Quota enforcement based on user plan
- **12.3**: Request validation (image format, size, quota)

---

## Testing

Comprehensive test suites are available:
- `src/app/api/extraction/__tests__/submit.test.ts` - Tests for submission endpoint
- `src/app/api/extraction/__tests__/status.test.ts` - Tests for status endpoint

Run tests with:
```bash
npm test -- src/app/api/extraction/__tests__
```
