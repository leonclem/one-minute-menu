# Export Jobs API Documentation

REST API for creating and managing asynchronous PDF and image export jobs.

## Base URL

```
Production: https://your-app.vercel.app/api/export
Development: http://localhost:3000/api/export
```

## Authentication

All endpoints require authentication via Next.js session cookie. Include the session cookie in requests:

```bash
curl -H "Cookie: next-auth.session-token=..." \
  https://your-app.vercel.app/api/export/jobs
```

## Endpoints

### Create Export Job

Create a new PDF or image export job for a menu.

**Endpoint:** `POST /api/export/jobs`

**Request Body:**

```typescript
{
  menu_id: string;        // UUID of menu to export (required)
  export_type: 'pdf' | 'image';  // Export format (required)
  metadata?: {            // Optional metadata
    format?: 'A4' | 'Letter';  // PDF page format (default: A4)
    orientation?: 'portrait' | 'landscape';  // PDF orientation (default: portrait)
  };
}
```

**Example Request:**

```bash
curl -X POST https://your-app.vercel.app/api/export/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "menu_id": "123e4567-e89b-12d3-a456-426614174000",
    "export_type": "pdf",
    "metadata": {
      "format": "A4",
      "orientation": "portrait"
    }
  }'
```

**Success Response (201 Created):**

```json
{
  "job_id": "987fcdeb-51a2-43f1-b456-426614174999",
  "status": "pending",
  "created_at": "2026-01-30T12:00:00.000Z",
  "estimated_wait_seconds": 15
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_EXPORT_TYPE` | export_type must be 'pdf' or 'image' |
| 400 | `INVALID_MENU_ID` | menu_id must be a valid UUID |
| 401 | `UNAUTHORIZED` | User not authenticated |
| 403 | `FORBIDDEN` | User doesn't own this menu |
| 422 | `PENDING_LIMIT_EXCEEDED` | Too many pending jobs (5 free, 20 subscribers) |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests (10/hour free, 50/hour subscribers) |

**Example Error Response:**

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "You have exceeded your hourly export limit. Please try again later.",
  "limit": 10,
  "reset_at": "2026-01-30T13:00:00.000Z"
}
```

---

### Get Job Status

Query the status of a specific export job.

**Endpoint:** `GET /api/export/jobs/:jobId`

**Path Parameters:**

- `jobId` (string, required): UUID of the export job

**Example Request:**

```bash
curl https://your-app.vercel.app/api/export/jobs/987fcdeb-51a2-43f1-b456-426614174999 \
  -H "Cookie: next-auth.session-token=..."
```

**Success Response (200 OK):**

```json
{
  "job_id": "987fcdeb-51a2-43f1-b456-426614174999",
  "status": "completed",
  "export_type": "pdf",
  "menu_id": "123e4567-e89b-12d3-a456-426614174000",
  "priority": 100,
  "retry_count": 0,
  "file_url": "https://storage.supabase.co/v1/object/sign/export-files/user-123/exports/pdf/job-987.pdf?token=...",
  "created_at": "2026-01-30T12:00:00.000Z",
  "started_at": "2026-01-30T12:00:05.000Z",
  "completed_at": "2026-01-30T12:00:20.000Z"
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `pending` | Job is queued and waiting for a worker |
| `processing` | Job is currently being rendered by a worker |
| `completed` | Job finished successfully, file_url available |
| `failed` | Job failed after all retry attempts, error_message available |

**Failed Job Response:**

```json
{
  "job_id": "987fcdeb-51a2-43f1-b456-426614174999",
  "status": "failed",
  "export_type": "pdf",
  "menu_id": "123e4567-e89b-12d3-a456-426614174000",
  "priority": 10,
  "retry_count": 3,
  "error_message": "Menu exceeds size limits. Please reduce content.",
  "created_at": "2026-01-30T12:00:00.000Z",
  "started_at": "2026-01-30T12:00:05.000Z",
  "completed_at": "2026-01-30T12:02:30.000Z"
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | User not authenticated |
| 403 | `FORBIDDEN` | Job belongs to different user |
| 404 | `NOT_FOUND` | Job ID doesn't exist |

---

### List User Jobs

List all export jobs for the authenticated user with pagination.

**Endpoint:** `GET /api/export/jobs`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Number of jobs per page (max 100) |
| `offset` | number | 0 | Number of jobs to skip |
| `status` | string | - | Filter by status (pending, processing, completed, failed) |

**Example Request:**

```bash
# Get first 20 jobs
curl https://your-app.vercel.app/api/export/jobs \
  -H "Cookie: next-auth.session-token=..."

# Get completed jobs only
curl https://your-app.vercel.app/api/export/jobs?status=completed&limit=50 \
  -H "Cookie: next-auth.session-token=..."

# Pagination
curl https://your-app.vercel.app/api/export/jobs?limit=20&offset=20 \
  -H "Cookie: next-auth.session-token=..."
```

**Success Response (200 OK):**

```json
{
  "jobs": [
    {
      "job_id": "987fcdeb-51a2-43f1-b456-426614174999",
      "status": "completed",
      "export_type": "pdf",
      "menu_id": "123e4567-e89b-12d3-a456-426614174000",
      "created_at": "2026-01-30T12:00:00.000Z",
      "completed_at": "2026-01-30T12:00:20.000Z",
      "file_url": "https://storage.supabase.co/..."
    },
    {
      "job_id": "876dcfeb-41a2-33f1-a456-426614174888",
      "status": "pending",
      "export_type": "image",
      "menu_id": "123e4567-e89b-12d3-a456-426614174000",
      "created_at": "2026-01-30T11:55:00.000Z",
      "completed_at": null,
      "file_url": null
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | User not authenticated |
| 400 | `INVALID_LIMIT` | Limit must be between 1 and 100 |
| 400 | `INVALID_STATUS` | Status must be pending, processing, completed, or failed |

---

### Regenerate Download URL

Generate a new signed download URL for a completed export job (when original URL expires).

**Endpoint:** `POST /api/export/jobs/:jobId/download-url`

**Path Parameters:**

- `jobId` (string, required): UUID of the export job

**Example Request:**

```bash
curl -X POST https://your-app.vercel.app/api/export/jobs/987fcdeb-51a2-43f1-b456-426614174999/download-url \
  -H "Cookie: next-auth.session-token=..."
```

**Success Response (200 OK):**

```json
{
  "file_url": "https://storage.supabase.co/v1/object/sign/export-files/user-123/exports/pdf/job-987.pdf?token=NEW_TOKEN",
  "expires_at": "2026-02-06T12:00:00.000Z"
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | User not authenticated |
| 403 | `FORBIDDEN` | Job belongs to different user |
| 404 | `NOT_FOUND` | Job ID doesn't exist |
| 409 | `JOB_NOT_COMPLETED` | Job is not in completed status |

---

## Rate Limits

Rate limits are enforced per user based on subscription status:

| Tier | Hourly Limit | Pending Job Limit |
|------|--------------|-------------------|
| Free | 10 exports/hour | 5 pending jobs |
| Subscriber | 50 exports/hour | 20 pending jobs |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1706616000
```

When rate limit is exceeded, the API returns 429 with reset time:

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "You have exceeded your hourly export limit. Please try again later.",
  "limit": 10,
  "reset_at": "2026-01-30T13:00:00.000Z"
}
```

---

## Real-time Updates

Subscribe to job status updates via Supabase Realtime:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subscribe to job updates
const subscription = supabase
  .channel('export_jobs')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'export_jobs',
      filter: `id=eq.${jobId}`
    },
    (payload) => {
      console.log('Job status updated:', payload.new);
      
      if (payload.new.status === 'completed') {
        console.log('Download URL:', payload.new.file_url);
      }
      
      if (payload.new.status === 'failed') {
        console.log('Error:', payload.new.error_message);
      }
    }
  )
  .subscribe();

// Unsubscribe when done
subscription.unsubscribe();
```

**Realtime Events:**

- Job status changes (pending → processing → completed/failed)
- Completion with download URL
- Failure with error message

**Note:** Transient failures during retry are not broadcast to clients (internal logging only).

---

## Email Notifications

Users receive email notifications for terminal job states:

### Completion Email

**Subject:** `Your menu export is ready - [Menu Name]`

**Body:**
```
Your PDF export for "Breakfast Menu" is ready!

Download your file:
https://storage.supabase.co/...

This link expires in 7 days. You can regenerate it anytime from your export history.

Thanks for using our service!
```

### Failure Email

**Subject:** `Export failed - [Menu Name]`

**Body:**
```
We were unable to complete your PDF export for "Breakfast Menu".

Error: Menu exceeds size limits. Please reduce content.

If you need help, please contact support.
```

**Note:** Emails are only sent for terminal states (completed, failed). Transient failures during retry do not trigger emails.

---

## Error Codes

| Code | HTTP Status | Description | Retry? |
|------|-------------|-------------|--------|
| `INVALID_EXPORT_TYPE` | 400 | export_type must be 'pdf' or 'image' | No |
| `INVALID_MENU_ID` | 400 | menu_id must be a valid UUID | No |
| `INVALID_LIMIT` | 400 | Pagination limit out of range | No |
| `INVALID_STATUS` | 400 | Invalid status filter value | No |
| `UNAUTHORIZED` | 401 | User not authenticated | No |
| `FORBIDDEN` | 403 | User doesn't own this resource | No |
| `NOT_FOUND` | 404 | Resource doesn't exist | No |
| `JOB_NOT_COMPLETED` | 409 | Job is not in completed status | Yes |
| `PENDING_LIMIT_EXCEEDED` | 422 | Too many pending jobs | Yes |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Yes |
| `INTERNAL_ERROR` | 500 | Server error | Yes |

---

## Client Examples

### JavaScript/TypeScript

```typescript
// Create export job
async function createExportJob(menuId: string, exportType: 'pdf' | 'image') {
  const response = await fetch('/api/export/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_id: menuId,
      export_type: exportType
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
}

// Poll for job completion
async function waitForJobCompletion(jobId: string, timeout = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const response = await fetch(`/api/export/jobs/${jobId}`);
    const job = await response.json();
    
    if (job.status === 'completed') {
      return job.file_url;
    }
    
    if (job.status === 'failed') {
      throw new Error(job.error_message);
    }
    
    // Wait 2 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Job timeout');
}

// Usage
const job = await createExportJob('menu-123', 'pdf');
const downloadUrl = await waitForJobCompletion(job.job_id);
console.log('Download:', downloadUrl);
```

### React Hook

```typescript
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

function useExportJob(menuId: string, exportType: 'pdf' | 'image') {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Subscribe to job updates
  useEffect(() => {
    if (!jobId) return;
    
    const subscription = supabase
      .channel('export_jobs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'export_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          setStatus(payload.new.status);
          
          if (payload.new.status === 'completed') {
            setFileUrl(payload.new.file_url);
          }
          
          if (payload.new.status === 'failed') {
            setError(payload.new.error_message);
          }
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [jobId]);
  
  // Create export job
  const createJob = async () => {
    try {
      setStatus('creating');
      
      const response = await fetch('/api/export/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: menuId,
          export_type: exportType
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      const job = await response.json();
      setJobId(job.job_id);
      setStatus(job.status);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };
  
  return {
    createJob,
    status,
    fileUrl,
    error,
    isLoading: status === 'pending' || status === 'processing',
    isComplete: status === 'completed',
    isFailed: status === 'failed'
  };
}

// Usage
function ExportButton({ menuId }) {
  const { createJob, status, fileUrl, error, isLoading } = useExportJob(menuId, 'pdf');
  
  return (
    <div>
      <button onClick={createJob} disabled={isLoading}>
        {isLoading ? 'Exporting...' : 'Export PDF'}
      </button>
      
      {fileUrl && (
        <a href={fileUrl} download>Download PDF</a>
      )}
      
      {error && (
        <p className="error">{error}</p>
      )}
    </div>
  );
}
```

### Python

```python
import requests
import time

def create_export_job(menu_id: str, export_type: str, session_token: str):
    """Create a new export job."""
    response = requests.post(
        'https://your-app.vercel.app/api/export/jobs',
        json={
            'menu_id': menu_id,
            'export_type': export_type
        },
        cookies={'next-auth.session-token': session_token}
    )
    response.raise_for_status()
    return response.json()

def wait_for_job_completion(job_id: str, session_token: str, timeout: int = 60):
    """Poll for job completion."""
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        response = requests.get(
            f'https://your-app.vercel.app/api/export/jobs/{job_id}',
            cookies={'next-auth.session-token': session_token}
        )
        response.raise_for_status()
        job = response.json()
        
        if job['status'] == 'completed':
            return job['file_url']
        
        if job['status'] == 'failed':
            raise Exception(job['error_message'])
        
        time.sleep(2)
    
    raise TimeoutError('Job timeout')

# Usage
job = create_export_job('menu-123', 'pdf', 'your-session-token')
download_url = wait_for_job_completion(job['job_id'], 'your-session-token')
print(f'Download: {download_url}')
```

---

## Best Practices

### 1. Use Realtime for Status Updates

Don't poll the API repeatedly. Subscribe to Realtime updates for instant notifications:

```typescript
// ❌ Bad: Polling every second
setInterval(() => {
  fetch(`/api/export/jobs/${jobId}`);
}, 1000);

// ✅ Good: Subscribe to Realtime
supabase
  .channel('export_jobs')
  .on('postgres_changes', { ... }, handleUpdate)
  .subscribe();
```

### 2. Handle Rate Limits Gracefully

Check rate limit headers and show user-friendly messages:

```typescript
const response = await fetch('/api/export/jobs', { ... });

if (response.status === 429) {
  const resetTime = response.headers.get('X-RateLimit-Reset');
  const resetDate = new Date(parseInt(resetTime) * 1000);
  
  alert(`Rate limit exceeded. Try again at ${resetDate.toLocaleTimeString()}`);
}
```

### 3. Cache Download URLs

Signed URLs are valid for 7 days. Cache them to avoid regenerating:

```typescript
// Store in localStorage
localStorage.setItem(`export_${jobId}`, JSON.stringify({
  url: fileUrl,
  expires_at: expiresAt
}));

// Check expiry before using
const cached = JSON.parse(localStorage.getItem(`export_${jobId}`));
if (cached && new Date(cached.expires_at) > new Date()) {
  return cached.url;
}
```

### 4. Show Progress Indicators

Display job status to users:

```typescript
const statusMessages = {
  pending: 'Your export is queued...',
  processing: 'Generating your export...',
  completed: 'Export ready!',
  failed: 'Export failed'
};

<p>{statusMessages[job.status]}</p>
```

### 5. Handle Errors Appropriately

Different errors require different user actions:

```typescript
if (error.code === 'RATE_LIMIT_EXCEEDED') {
  // Show countdown timer
} else if (error.code === 'PENDING_LIMIT_EXCEEDED') {
  // Show list of pending jobs
} else if (error.code === 'FORBIDDEN') {
  // Redirect to login
} else {
  // Show generic error
}
```

---

## Changelog

### v1.0.0 (2026-01-30)
- Initial release
- PDF and image export support
- Priority queuing for subscribers
- Real-time status updates
- Email notifications
- Rate limiting
- Automatic retries

---

## Support

For API issues or questions:
- Check error codes and descriptions above
- Review client examples
- Contact engineering team
- Report bugs via issue tracker
