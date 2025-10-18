# Menu Extraction API Documentation

## Overview

This document describes the API endpoints for the AI menu extraction system. These endpoints allow you to submit menu images for extraction, check job status, and retrieve results.

## Base URL

```
Production: https://your-domain.com/api
Development: http://localhost:3000/api
```

## Authentication

All API endpoints require authentication using a Bearer token.

```http
Authorization: Bearer <your-auth-token>
```

Get your auth token from the Supabase session after login.

## Endpoints

### 1. Submit Extraction Job

Submit a menu image for AI extraction.

**Endpoint:** `POST /api/extraction/submit`

**Request:**

```http
POST /api/extraction/submit
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
- image: File (JPEG or PNG, max 8MB)
- schemaVersion: string (optional, "stage1" or "stage2", default: "stage1")
- currency: string (optional, e.g., "SGD", "USD")
- language: string (optional, e.g., "en", "zh")
```

**Response (Success):**

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "estimatedCompletionTime": 30,
  "message": "Extraction job submitted successfully"
}
```

**Response (Error):**

```json
{
  "success": false,
  "error": "Quota exceeded",
  "message": "You have reached your monthly extraction limit",
  "remainingQuota": 0
}
```

**Status Codes:**
- `200 OK` - Job submitted successfully
- `400 Bad Request` - Invalid image or parameters
- `401 Unauthorized` - Missing or invalid auth token
- `403 Forbidden` - Quota exceeded
- `413 Payload Too Large` - Image exceeds 8MB
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

**Rate Limits:**
- 10 uploads per hour per user
- 100 uploads per day per user

**Example (cURL):**

```bash
curl -X POST https://your-domain.com/api/extraction/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@menu.jpg" \
  -F "schemaVersion=stage1"
```

**Example (JavaScript):**

```javascript
const formData = new FormData()
formData.append('image', imageFile)
formData.append('schemaVersion', 'stage1')

const response = await fetch('/api/extraction/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`
  },
  body: formData
})

const data = await response.json()
console.log('Job ID:', data.jobId)
```

---

### 2. Get Job Status

Check the status of an extraction job and retrieve results when complete.

**Endpoint:** `GET /api/extraction/status/:jobId`

**Request:**

```http
GET /api/extraction/status/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Response (Queued):**

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Response (Processing):**

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "createdAt": "2024-01-15T10:30:00Z",
  "startedAt": "2024-01-15T10:30:05Z"
}
```

**Response (Completed):**

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:30:25Z",
  "processingTime": 25000,
  "result": {
    "menu": {
      "categories": [
        {
          "name": "APPETIZERS",
          "items": [
            {
              "name": "GARLIC BUTTER TOAST",
              "price": 6,
              "description": "Crispy sourdough with herb butter",
              "confidence": 1.0
            }
          ],
          "confidence": 1.0
        }
      ]
    },
    "uncertainItems": [],
    "superfluousText": [],
    "confidence": 0.95,
    "currency": "SGD",
    "detectedLanguage": "en",
    "tokenUsage": {
      "inputTokens": 1500,
      "outputTokens": 800,
      "estimatedCost": 0.025
    },
    "schemaVersion": "stage1",
    "promptVersion": "v1.0"
  }
}
```

**Response (Failed):**

```json
{
  "success": false,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "createdAt": "2024-01-15T10:30:00Z",
  "error": "Image quality too low for reliable extraction",
  "guidance": [
    "Ensure good lighting",
    "Hold camera steady",
    "Avoid glare and shadows"
  ],
  "fallbackMode": "manual_entry"
}
```

**Status Codes:**
- `200 OK` - Job found
- `401 Unauthorized` - Missing or invalid auth token
- `403 Forbidden` - Not authorized to view this job
- `404 Not Found` - Job not found
- `500 Internal Server Error` - Server error

**Example (cURL):**

```bash
curl -X GET https://your-domain.com/api/extraction/status/JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example (JavaScript with Polling):**

```javascript
async function pollJobStatus(jobId) {
  const maxAttempts = 60  // 3 minutes max
  const pollInterval = 3000  // 3 seconds
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`/api/extraction/status/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })
    
    const data = await response.json()
    
    if (data.status === 'completed') {
      return data.result
    }
    
    if (data.status === 'failed') {
      throw new Error(data.error)
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
  
  throw new Error('Extraction timeout')
}
```

---

### 3. Submit Feedback

Submit feedback on extraction quality to help improve the system.

**Endpoint:** `POST /api/extraction/feedback`

**Request:**

```http
POST /api/extraction/feedback
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "feedbackType": "system_error",
  "itemId": "item-123",
  "correctionMade": "Changed price from $10 to $12",
  "comment": "Price was incorrect in extraction"
}
```

**Feedback Types:**
- `system_error` - Extraction was incorrect
- `menu_unclear` - Photo quality or menu formatting issue
- `excellent` - Extraction was perfect

**Response (Success):**

```json
{
  "success": true,
  "message": "Feedback submitted successfully",
  "feedbackId": "660e8400-e29b-41d4-a716-446655440000"
}
```

**Status Codes:**
- `200 OK` - Feedback submitted
- `400 Bad Request` - Invalid feedback data
- `401 Unauthorized` - Missing or invalid auth token
- `404 Not Found` - Job not found
- `500 Internal Server Error` - Server error

**Example (JavaScript):**

```javascript
await fetch('/api/extraction/feedback', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    jobId: '550e8400-e29b-41d4-a716-446655440000',
    feedbackType: 'system_error',
    itemId: 'item-123',
    correctionMade: 'Changed price from $10 to $12',
    comment: 'Price was incorrect'
  })
})
```

---

## Data Models

### ExtractionResult (Stage 1)

```typescript
interface ExtractionResult {
  menu: StructuredMenu
  uncertainItems: UncertainItem[]
  superfluousText: SuperfluousText[]
  confidence: number  // 0.0 to 1.0
  currency: string
  detectedLanguage: string
  processingTime: number  // milliseconds
  tokenUsage: {
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }
  schemaVersion: 'stage1' | 'stage2'
  promptVersion: string
}

interface StructuredMenu {
  categories: Category[]
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

### ExtractionResult (Stage 2 Extensions)

```typescript
interface MenuItem {
  name: string
  price?: number  // Optional if variants present
  description?: string
  confidence: number
  
  // Stage 2 fields
  variants?: ItemVariant[]
  modifierGroups?: ModifierGroup[]
  additional?: AdditionalInfo
}

interface ItemVariant {
  size?: string  // "Small", "Large", null for single size
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
  priceDelta: number  // 0 for included, positive for upcharge
}

interface AdditionalInfo {
  servedWith?: string[]
  forPax?: number
  prepTimeMin?: number
  notes?: string[]
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error code or type",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional error details"
  }
}
```

### Common Errors

| Error Code | HTTP Status | Description | Solution |
|------------|-------------|-------------|----------|
| `invalid_image_format` | 400 | Image is not JPEG or PNG | Convert to JPEG or PNG |
| `image_too_large` | 413 | Image exceeds 8MB | Compress or resize image |
| `quota_exceeded` | 403 | Monthly extraction limit reached | Upgrade plan or wait for reset |
| `rate_limit_exceeded` | 429 | Too many requests | Wait and retry |
| `invalid_auth_token` | 401 | Auth token missing or invalid | Re-authenticate |
| `job_not_found` | 404 | Job ID doesn't exist | Check job ID |
| `extraction_failed` | 500 | Extraction processing failed | Retry or use manual entry |
| `api_error` | 500 | Vision API error | Retry later |

---

## Rate Limits

### Per-User Limits

- **Upload rate:** 10 uploads per hour
- **Status checks:** 100 requests per minute
- **Feedback submissions:** 50 per hour

### Quota Limits

- **Free tier:** 5 extractions per month
- **Premium tier:** 50 extractions per month
- **Enterprise tier:** Custom limits

### Rate Limit Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1642252800
```

---

## Webhooks (Future Feature)

Receive notifications when extraction jobs complete.

**Configuration:**

```json
{
  "webhookUrl": "https://your-domain.com/webhook",
  "events": ["extraction.completed", "extraction.failed"]
}
```

**Webhook Payload:**

```json
{
  "event": "extraction.completed",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:25Z",
  "data": {
    "status": "completed",
    "result": { /* extraction result */ }
  }
}
```

---

## Best Practices

### Image Optimization

Before uploading:
1. Resize to 1024-2048px
2. Compress to 85% JPEG quality
3. Ensure good lighting and focus
4. Remove EXIF data for privacy

### Polling Strategy

```javascript
// Exponential backoff
const delays = [1000, 2000, 3000, 5000, 5000]  // ms

for (let i = 0; i < delays.length; i++) {
  const status = await checkStatus(jobId)
  if (status.completed) break
  await sleep(delays[i])
}
```

### Error Handling

```javascript
try {
  const result = await submitExtraction(image)
} catch (error) {
  if (error.status === 403) {
    // Quota exceeded - show upgrade prompt
  } else if (error.status === 429) {
    // Rate limited - retry with backoff
  } else if (error.status === 500) {
    // Server error - fallback to manual entry
  }
}
```

### Caching

Cache extraction results by image hash to avoid duplicate API calls:

```javascript
const imageHash = await hashImage(imageBuffer)
const cached = localStorage.getItem(`extraction_${imageHash}`)
if (cached) return JSON.parse(cached)

// Otherwise submit new extraction
const result = await submitExtraction(image)
localStorage.setItem(`extraction_${imageHash}`, JSON.stringify(result))
```

---

## Testing

### Test Endpoints

```
Staging: https://staging.your-domain.com/api
```

### Test Images

Use these test images to verify integration:

- `test-simple-menu.jpg` - Simple single-column menu
- `test-multi-column.jpg` - Multi-column menu with categories
- `test-poor-quality.jpg` - Low quality image (should fail gracefully)

### Example Test

```javascript
describe('Extraction API', () => {
  it('should submit extraction job', async () => {
    const formData = new FormData()
    formData.append('image', testImage)
    
    const response = await fetch('/api/extraction/submit', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testToken}` },
      body: formData
    })
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.jobId).toBeDefined()
  })
  
  it('should get job status', async () => {
    const response = await fetch(`/api/extraction/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${testToken}` }
    })
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toMatch(/queued|processing|completed|failed/)
  })
})
```

---

## Support

### Documentation

- [Menu Photo Best Practices](./MENU_PHOTO_BEST_PRACTICES.md)
- [Troubleshooting Guide](./EXTRACTION_TROUBLESHOOTING.md)
- [Stage Comparison](./EXTRACTION_STAGE_COMPARISON.md)
- [Admin Guide](./EXTRACTION_ADMIN_GUIDE.md)

### Contact

- **API Issues:** api-support@example.com
- **General Support:** support@example.com
- **Documentation:** docs@example.com

---

## Changelog

### v1.0 (Current)

- Initial API release
- Stage 1 extraction support
- Job submission and status endpoints
- Feedback submission

### v2.0 (Planned)

- Stage 2 extraction support
- Webhook notifications
- Batch processing
- Enhanced error details

---

**Last Updated:** [Current Date]  
**API Version:** 1.0  
**Maintained By:** Engineering Team
