# Job Queue Integration Guide

This guide explains how to use the job queue system for menu extraction jobs.

## Overview

The job queue system manages the lifecycle of menu extraction jobs, from submission to completion. It provides:

- **Job Submission**: Submit extraction jobs with idempotency checks
- **Status Polling**: Check job status and wait for completion
- **LISTEN/NOTIFY**: Real-time updates via Supabase realtime
- **Retry Mechanism**: Automatic retry for failed jobs
- **Quota Enforcement**: Monthly and hourly rate limits

## Requirements Addressed

- **15.2**: Maintains job queue mechanism with LISTEN/NOTIFY pattern
- **15.8**: Enforces plan limits and quota
- **12.2**: Implements rate limiting (10 uploads/hour per user)
- **12.3**: Tracks monthly extraction quotas

## Database Table

The system uses the `menu_extraction_jobs` table (renamed from `ocr_jobs`):

```sql
CREATE TABLE menu_extraction_jobs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  image_url TEXT NOT NULL,
  image_hash VARCHAR(64), -- SHA-256 for idempotency
  status VARCHAR(20) NOT NULL, -- 'queued', 'processing', 'completed', 'failed'
  schema_version VARCHAR(20) DEFAULT 'stage1',
  prompt_version VARCHAR(50) DEFAULT 'v1.0',
  result JSONB,
  error_message TEXT,
  processing_time INTEGER, -- milliseconds
  retry_count INTEGER DEFAULT 0,
  token_usage JSONB, -- { inputTokens, outputTokens, estimatedCost }
  confidence REAL, -- 0.0-1.0
  uncertain_items JSONB,
  superfluous_text JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

## Usage Examples

### 1. Submit a Job

```typescript
import { JobQueueManager } from '@/lib/extraction/job-queue'
import { computeSha256FromUrl } from '@/lib/utils'

const queueManager = new JobQueueManager()

// Compute image hash for idempotency
const imageHash = await computeSha256FromUrl(imageUrl)

// Submit job
const result = await queueManager.submitJob(
  userId,
  imageUrl,
  imageHash,
  {
    schemaVersion: 'stage1',
    promptVersion: 'v1.0',
    force: false // Set to true to bypass idempotency check
  }
)

if (result.cached) {
  console.log('Using cached result:', result.job)
} else {
  console.log('New job submitted:', result.job.id)
}
```

### 2. Check Job Status

```typescript
const job = await queueManager.getJobStatus(jobId, userId)

if (job) {
  console.log('Job status:', job.status)
  
  if (job.status === 'completed') {
    console.log('Result:', job.result)
    console.log('Confidence:', job.confidence)
  } else if (job.status === 'failed') {
    console.log('Error:', job.error)
  }
}
```

### 3. Poll for Completion

```typescript
import { pollJobStatus } from '@/lib/extraction/job-queue'

try {
  const job = await pollJobStatus(jobId, userId, {
    maxAttempts: 60, // 60 attempts
    intervalMs: 5000, // 5 seconds between polls
    onUpdate: (job) => {
      console.log('Job update:', job.status)
    }
  })
  
  console.log('Job completed:', job)
} catch (error) {
  console.error('Polling timeout or error:', error)
}
```

### 4. Real-time Updates with LISTEN/NOTIFY

```typescript
import { JobNotificationListener } from '@/lib/extraction/job-queue'

const listener = new JobNotificationListener()

// Subscribe to job updates
const unsubscribe = await listener.subscribe(userId, (job) => {
  console.log('Job updated:', job.id, job.status)
  
  if (job.status === 'completed') {
    console.log('Extraction complete!')
  } else if (job.status === 'failed') {
    console.error('Extraction failed:', job.error)
  }
})

// Later, unsubscribe
await unsubscribe()
```

### 5. Retry Failed Jobs

```typescript
try {
  const newJob = await queueManager.retryJob(failedJobId, userId)
  console.log('Retry job created:', newJob.id)
} catch (error) {
  if (error.code === 'MAX_RETRIES_EXCEEDED') {
    console.error('Maximum retry attempts reached')
  }
}
```

### 6. Check Quota Before Submission

```typescript
// Check monthly quota
const quotaResult = await queueManager.checkQuota(userId)

if (!quotaResult.allowed) {
  console.error(quotaResult.reason)
  // Show upgrade prompt
  return
}

console.log(`Quota: ${quotaResult.current}/${quotaResult.limit}`)

// Check rate limit
const rateLimitResult = await queueManager.checkRateLimit(userId, 10)

if (!rateLimitResult.allowed) {
  console.error(`Rate limit exceeded. Try again after ${rateLimitResult.resetAt}`)
  return
}
```

### 7. Mark Job as Completed

```typescript
const completedJob = await queueManager.markJobCompleted(
  jobId,
  {
    menu: {
      categories: [
        {
          name: 'Appetizers',
          items: [
            { name: 'Spring Rolls', price: 8.99, confidence: 0.95 }
          ]
        }
      ]
    },
    currency: 'USD',
    uncertainItems: [],
    superfluousText: []
  },
  5000, // processing time in ms
  {
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCost: 0.02
  },
  0.95, // overall confidence
  [], // uncertain items
  [] // superfluous text
)

console.log('Job marked as completed:', completedJob)
```

### 8. Mark Job as Failed

```typescript
const failedJob = await queueManager.markJobFailed(
  jobId,
  'API rate limit exceeded',
  true // increment retry count
)

console.log('Job marked as failed:', failedJob)
```

## API Route Integration

### Example: Extraction Submission Endpoint

```typescript
// app/api/extraction/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { JobQueueManager } from '@/lib/extraction/job-queue'
import { computeSha256FromUrl } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageUrl, schemaVersion = 'stage1' } = await request.json()

  const queueManager = new JobQueueManager(supabase)

  // Check quota
  const quotaResult = await queueManager.checkQuota(user.id)
  if (!quotaResult.allowed) {
    return NextResponse.json(
      { error: quotaResult.reason, code: 'QUOTA_EXCEEDED' },
      { status: 403 }
    )
  }

  // Check rate limit
  const rateLimitResult = await queueManager.checkRateLimit(user.id, 10)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', resetAt: rateLimitResult.resetAt },
      { status: 429 }
    )
  }

  // Compute image hash
  const imageHash = await computeSha256FromUrl(imageUrl)

  // Submit job
  const result = await queueManager.submitJob(user.id, imageUrl, imageHash, {
    schemaVersion
  })

  return NextResponse.json({
    success: true,
    jobId: result.job.id,
    cached: result.cached,
    estimatedTime: 30 // seconds
  })
}
```

### Example: Status Polling Endpoint

```typescript
// app/api/extraction/status/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { JobQueueManager } from '@/lib/extraction/job-queue'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const queueManager = new JobQueueManager(supabase)
  const job = await queueManager.getJobStatus(params.jobId, user.id)

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      confidence: job.confidence,
      processingTime: job.processingTime,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    }
  })
}
```

## Error Handling

The job queue system throws `JobQueueError` with specific error codes:

```typescript
try {
  await queueManager.submitJob(userId, imageUrl, imageHash)
} catch (error) {
  if (error instanceof JobQueueError) {
    switch (error.code) {
      case 'QUOTA_EXCEEDED':
        // Show upgrade prompt
        break
      case 'RATE_LIMIT_EXCEEDED':
        // Show retry timer
        break
      case 'JOB_NOT_FOUND':
        // Job doesn't exist
        break
      case 'MAX_RETRIES_EXCEEDED':
        // Too many retries
        break
      default:
        // Generic error
        console.error(error.message)
    }
  }
}
```

## Quota Limits

Default quota limits by plan:

- **Free**: 5 extractions/month, 10 uploads/hour
- **Premium**: 50 extractions/month, 20 uploads/hour
- **Enterprise**: Unlimited extractions, 50 uploads/hour

Limits are stored in `profiles.plan_limits` JSONB field:

```json
{
  "menus": 1,
  "items": 20,
  "ocr_jobs": 5,
  "monthly_uploads": 10
}
```

## Retry Mechanism

Failed jobs can be retried up to 3 times:

1. Job fails with transient error (API rate limit, network issue)
2. System marks job as failed with `retry_count` incremented
3. User or system calls `retryJob()` to create new job
4. New job has `retry_count` from previous job + 1
5. After 3 retries, job cannot be retried again

## LISTEN/NOTIFY Pattern

The database triggers send notifications on job updates:

```sql
CREATE FUNCTION notify_menu_extraction_jobs()
RETURNS TRIGGER AS $
BEGIN
    PERFORM pg_notify('menu_extraction_jobs', json_build_object(
        'id', NEW.id,
        'status', NEW.status,
        'user_id', NEW.user_id,
        'confidence', NEW.confidence
    )::text);
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER menu_extraction_jobs_notify_insert
    AFTER INSERT ON menu_extraction_jobs
    FOR EACH ROW EXECUTE FUNCTION notify_menu_extraction_jobs();

CREATE TRIGGER menu_extraction_jobs_notify_update
    AFTER UPDATE ON menu_extraction_jobs
    FOR EACH ROW EXECUTE FUNCTION notify_menu_extraction_jobs();
```

## Testing

Run tests with:

```bash
npm test src/lib/extraction/__tests__/job-queue.test.ts
```

Tests cover:
- Job submission with idempotency
- Status polling
- Retry mechanism
- Quota enforcement
- Rate limiting
- Error handling

## Migration from OCR Jobs

The system maintains backward compatibility with the old `ocr_jobs` table:

1. Database migration renames `ocr_jobs` → `menu_extraction_jobs`
2. Existing `ocrOperations` in `database.ts` updated to use new table
3. API routes updated to query new table
4. New `JobQueueManager` provides enhanced functionality

Old code using `ocrOperations` continues to work, but new code should use `JobQueueManager` for full feature support.
