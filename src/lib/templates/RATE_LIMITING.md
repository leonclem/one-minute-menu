# Rate Limiting for Template Export Endpoints

## Overview

Rate limiting is implemented for template export endpoints to prevent abuse and protect server resources during CPU-intensive operations (PDF and image generation).

## Implementation

### Two-Layer Approach

1. **User-Based Rate Limiting** (Primary)
   - Implemented in export API routes
   - Tracks requests per authenticated user
   - More accurate and fair for authenticated users
   - Persists across requests within the time window

2. **IP-Based Rate Limiting** (Backup)
   - Implemented in middleware (`src/middleware.ts`)
   - Provides additional protection against abuse
   - Applies to all requests regardless of authentication

## Rate Limits

### Per-User Limits (Primary)

Configured in `src/lib/templates/rate-limiter.ts`:

| Endpoint | Limit | Window | Notes |
|----------|-------|--------|-------|
| Layout Generation | 60 requests | 1 minute | Fast operation, higher limit |
| HTML Export | 30 requests | 1 minute | Lightweight, moderate limit |
| PDF Export | 10 requests | 1 minute | CPU-intensive, strict limit |
| Image Export | 10 requests | 1 minute | CPU-intensive, strict limit |

### IP-Based Limits (Backup)

Configured in `src/middleware.ts`:

| Endpoint Pattern | Limit | Window | Notes |
|-----------------|-------|--------|-------|
| `/api/templates/export/(pdf\|image)` | 20 requests | 1 minute | Backup protection |

## Response Format

When rate limit is exceeded, the API returns:

```json
{
  "error": "Rate limit exceeded",
  "code": "CONCURRENCY_LIMIT",
  "retryAfter": 45
}
```

With HTTP headers:
- `X-RateLimit-Remaining`: Number of requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds until retry is allowed (when limit exceeded)

## Monitoring

Rate limit violations are logged with the following information:

```javascript
{
  identifier: "user-id or IP",
  maxRequests: 10,
  windowMs: 60000,
  retryAfter: 45,
  resetTime: "2025-10-27T04:45:44.448Z",
  timestamp: "2025-10-27T04:45:44.448Z"
}
```

Search logs for `[RateLimiter] Rate limit exceeded` to identify abuse patterns.

## Architecture

### In-Memory Store

The current implementation uses an in-memory store suitable for:
- Single-instance deployments
- MVP and development environments
- Serverless functions (with cold start resets)

### Production Considerations

For production at scale, consider:

1. **Redis-Based Rate Limiting**
   - Distributed rate limiting across multiple instances
   - Persistent state across deployments
   - More accurate tracking

2. **Per-Plan Quotas**
   - Different limits for free/pro/enterprise users
   - Monthly quotas in addition to per-minute limits
   - Integration with billing system

3. **Sliding Window Algorithm**
   - More accurate than fixed window
   - Prevents burst traffic at window boundaries
   - Better user experience

## Testing

Comprehensive tests are available in `src/lib/templates/__tests__/rate-limiter.test.ts`:

```bash
npm test -- src/lib/templates/__tests__/rate-limiter.test.ts
```

Tests cover:
- Basic rate limiting behavior
- User isolation
- Window expiration
- Error handling
- Logging
- Edge cases

## Usage Example

### In API Routes

```typescript
import { pdfExportLimiter, applyRateLimit } from '@/lib/templates/rate-limiter'

export async function POST(request: NextRequest) {
  // Get authenticated user
  const { user } = await supabase.auth.getUser()
  
  // Apply rate limiting
  const rateLimit = applyRateLimit(pdfExportLimiter, user.id)
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        code: ERROR_CODES.CONCURRENCY_LIMIT,
        retryAfter: rateLimit.retryAfter
      },
      { 
        status: 429,
        headers: rateLimit.headers
      }
    )
  }
  
  // Process request...
}
```

### Custom Rate Limiter

```typescript
import { RateLimiter } from '@/lib/templates/rate-limiter'

const customLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000, // 1 minute
  message: 'Custom rate limit message'
})

// Check if request is allowed
const result = customLimiter.check(userId)

if (!result.allowed) {
  // Handle rate limit exceeded
}

// Or throw error if exceeded
customLimiter.consume(userId) // Throws LayoutEngineError if exceeded
```

## Troubleshooting

### Rate Limit Too Strict

If legitimate users are hitting rate limits:

1. Check logs for patterns
2. Adjust limits in `src/lib/templates/rate-limiter.ts`
3. Consider implementing per-plan quotas
4. Add user feedback for approaching limits

### Rate Limit Too Lenient

If abuse is detected:

1. Lower limits for affected endpoints
2. Add IP-based limits in middleware
3. Implement CAPTCHA for suspicious patterns
4. Consider temporary bans for repeat offenders

### Cold Start Resets

In serverless environments, rate limits reset on cold starts:

1. This is acceptable for MVP
2. For production, migrate to Redis
3. Document behavior for users
4. Consider longer time windows to reduce impact
