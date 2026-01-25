// Security-related helpers: input sanitization and security event logging

import { NextRequest } from 'next/server'

// ============================================================================
// INPUT SANITIZATION FUNCTIONS
// ============================================================================

export function sanitizeString(input: unknown, maxLength = 500): string | undefined {
  if (typeof input !== 'string') return undefined
  const trimmed = input.trim().replace(/\s+/g, ' ')
  // Remove control chars except newlines and tabs
  const cleaned = trimmed.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  return cleaned.slice(0, maxLength)
}

export function sanitizeArrayOfStrings(input: unknown, maxItemLength = 200, maxItems = 20): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  const result: string[] = []
  for (const item of input) {
    const s = sanitizeString(item, maxItemLength)
    if (typeof s === 'string' && s.length > 0) result.push(s)
    if (result.length >= maxItems) break
  }
  return result
}

export function sanitizeMenuItemPayload<T extends { name?: string; description?: string; category?: string }>(data: T): T {
  const out = { ...data }
  if (out.name !== undefined) out.name = sanitizeString(out.name, 100) as any
  if (out.description !== undefined) out.description = sanitizeString(out.description, 500) as any
  if (out.category !== undefined) out.category = sanitizeString(out.category, 50) as any
  return out
}

export function sanitizeMenuPayload<T extends {
  name?: string;
  paymentInfo?: any;
  establishmentType?: string;
  primaryCuisine?: string;
  venueInfo?: any;
}>(data: T): T {
  const out = { ...data }
  if (out.name !== undefined) out.name = sanitizeString(out.name, 100) as any
  if (out.establishmentType !== undefined) out.establishmentType = sanitizeString(out.establishmentType, 50) as any
  if (out.primaryCuisine !== undefined) out.primaryCuisine = sanitizeString(out.primaryCuisine, 50) as any

  if (out.venueInfo) {
    const vi = { ...out.venueInfo }
    if (vi.address !== undefined) vi.address = sanitizeString(vi.address, 200)
    if (vi.email !== undefined) vi.email = sanitizeString(vi.email, 100)
    if (vi.phone !== undefined) vi.phone = sanitizeString(vi.phone, 50)
    if (vi.socialMedia) {
      const sm = { ...vi.socialMedia }
      if (sm.instagram !== undefined) sm.instagram = sanitizeString(sm.instagram, 50)
      if (sm.facebook !== undefined) sm.facebook = sanitizeString(sm.facebook, 100)
      if (sm.x !== undefined) sm.x = sanitizeString(sm.x, 50)
      if (sm.website !== undefined) sm.website = sanitizeString(sm.website, 100)
      vi.socialMedia = sm
    }
    out.venueInfo = vi
  }

  if (out.paymentInfo) {
    const pi = { ...out.paymentInfo }
    if (pi.instructions !== undefined) pi.instructions = sanitizeString(pi.instructions, 300)
    if (pi.alternativePayments !== undefined) pi.alternativePayments = sanitizeArrayOfStrings(pi.alternativePayments, 50, 5)
    if (pi.disclaimer !== undefined) pi.disclaimer = sanitizeString(pi.disclaimer, 200)
    out.paymentInfo = pi
  }
  return out
}

export function sanitizeProfilePayload<T extends {
  username?: string;
  restaurantName?: string;
  establishmentType?: string;
  primaryCuisine?: string;
  location?: string;
  onboardingCompleted?: boolean;
}>(data: T): T {
  const out = { ...data }
  if (out.username !== undefined) out.username = sanitizeString(out.username, 50) as any
  if (out.restaurantName !== undefined) out.restaurantName = sanitizeString(out.restaurantName, 100) as any
  if (out.establishmentType !== undefined) out.establishmentType = sanitizeString(out.establishmentType, 50) as any
  if (out.primaryCuisine !== undefined) out.primaryCuisine = sanitizeString(out.primaryCuisine, 50) as any
  if (out.location !== undefined) out.location = sanitizeString(out.location, 100) as any
  // onboardingCompleted is boolean, no sanitization needed beyond existence check
  return out
}


// ============================================================================
// SECURITY EVENT LOGGING
// ============================================================================

/**
 * Security event types
 */
export type SecurityEventType =
  | 'invalid_signature'
  | 'missing_signature'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'invalid_input'
  | 'suspicious_activity'

/**
 * Security event metadata
 */
export interface SecurityEventMetadata {
  userId?: string
  endpoint?: string
  details?: string
  [key: string]: any
}

/**
 * Log a security-relevant event
 * 
 * @param eventType - Type of security event
 * @param request - Next.js request object
 * @param requestId - Unique request identifier
 * @param metadata - Additional event metadata
 * 
 * Requirements: 10.6, 14.4
 */
export async function logSecurityEvent(
  eventType: SecurityEventType,
  request: NextRequest,
  requestId: string,
  metadata?: SecurityEventMetadata
): Promise<void> {
  // Dynamic import to avoid circular dependencies and allow mocking
  const { createServerSupabaseClient } = await import('./supabase-server')
  const supabase = createServerSupabaseClient()
  
  // Extract source IP (considering proxies)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const sourceIp = forwardedFor?.split(',')[0] || realIp || 'unknown'

  // Extract user agent
  const userAgent = request.headers.get('user-agent') || 'unknown'

  // Extract endpoint from URL
  const endpoint = metadata?.endpoint || request.nextUrl.pathname

  // Build log message
  const logMessage = `[security:${requestId}] ${eventType} from ${sourceIp} at ${endpoint}`
  
  // Log to console with appropriate level
  if (eventType === 'rate_limit_exceeded' || eventType === 'invalid_input') {
    console.warn(logMessage, metadata)
  } else {
    console.error(logMessage, metadata)
  }

  // Log to database for audit trail
  try {
    if (supabase && typeof supabase.from === 'function') {
      await supabase
        .from('webhook_events')
        .insert({
          stripe_event_id: `security_${requestId}`,
          event_type: `security.${eventType}`,
          processed: false,
          processing_error: metadata?.details || eventType,
          payload: {
            source_ip: sourceIp,
            user_agent: userAgent,
            timestamp: new Date().toISOString(),
            request_id: requestId,
            user_id: metadata?.userId,
            ...metadata,
            endpoint, // Set endpoint last to ensure it's not overwritten by metadata spread
          },
        })
    } else {
      console.warn(`[security:${requestId}] Database logging skipped: Supabase client not available`)
    }
  } catch (error) {
    // If database logging fails, at least we have console logs
    console.error(`[security:${requestId}] Failed to log security event to database:`, error)
  }
}

/**
 * Log an unauthorized access attempt
 * 
 * @param request - Next.js request object
 * @param requestId - Unique request identifier
 * @param userId - User ID if available
 * @param reason - Reason for unauthorized access
 */
export async function logUnauthorizedAccess(
  request: NextRequest,
  requestId: string,
  userId?: string,
  reason?: string
): Promise<void> {
  await logSecurityEvent('unauthorized_access', request, requestId, {
    userId,
    details: reason || 'Unauthorized access attempt',
  })
}

/**
 * Log a rate limit violation
 * 
 * @param request - Next.js request object
 * @param requestId - Unique request identifier
 * @param identifier - Rate limit identifier (user ID or IP)
 * @param retryAfter - Seconds until retry is allowed
 */
export async function logRateLimitViolation(
  request: NextRequest,
  requestId: string,
  identifier: string,
  retryAfter?: number
): Promise<void> {
  await logSecurityEvent('rate_limit_exceeded', request, requestId, {
    identifier,
    retryAfter,
    details: `Rate limit exceeded for ${identifier}`,
  })
}

/**
 * Log invalid input
 * 
 * @param request - Next.js request object
 * @param requestId - Unique request identifier
 * @param field - Field that failed validation
 * @param value - Invalid value (sanitized)
 * @param reason - Validation failure reason
 */
export async function logInvalidInput(
  request: NextRequest,
  requestId: string,
  field: string,
  value: any,
  reason: string
): Promise<void> {
  await logSecurityEvent('invalid_input', request, requestId, {
    field,
    value: sanitizeForLogging(value),
    details: reason,
  })
}

/**
 * Sanitize sensitive data before logging
 * 
 * @param value - Value to sanitize
 * @returns Sanitized value safe for logging
 */
function sanitizeForLogging(value: any): any {
  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > 100) {
      return value.substring(0, 100) + '...'
    }
    // Mask potential sensitive data patterns
    if (value.match(/^sk_/)) {
      return '[REDACTED_API_KEY]'
    }
    if (value.match(/^whsec_/)) {
      return '[REDACTED_WEBHOOK_SECRET]'
    }
  }
  return value
}
