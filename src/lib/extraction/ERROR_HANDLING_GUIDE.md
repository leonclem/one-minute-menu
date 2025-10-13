# Error Handling Guide

## Overview

This guide documents the comprehensive error handling system for menu extraction, implemented as part of Task 5. The error handling system provides:

- **API error handling** for rate limiting, service unavailable, and other HTTP errors
- **Validation error handling** with partial data salvage capabilities
- **Image quality assessment** based on confidence scores
- **Fallback mechanisms** to manual entry for failed extractions
- **User-friendly error messages** and actionable guidance

## Requirements Addressed

- **Requirement 10.4**: Validation error handling with partial data salvage
- **Requirement 7.5**: User-friendly error messages and guidance
- **Requirement 11.3**: Image quality assessment and feedback
- **Requirement 15.7**: Graceful degradation and error handling patterns

## Architecture

### Error Handler (`error-handler.ts`)

The `ExtractionErrorHandler` class provides static methods for handling different error scenarios:

```typescript
import { ExtractionErrorHandler } from './error-handler'

// Handle API errors
const errorResponse = ExtractionErrorHandler.handleVisionAPIError(error)

// Handle validation errors with salvage attempt
const errorResponse = ExtractionErrorHandler.handleValidationError(
  validationResult,
  rawData,
  salvageAttempt
)

// Assess image quality
const assessment = ExtractionErrorHandler.assessImageQuality(result)

// Handle image quality issues
const errorResponse = ExtractionErrorHandler.handleImageQualityIssue(assessment)

// Handle quota exceeded
const errorResponse = ExtractionErrorHandler.handleQuotaExceeded(
  currentUsage,
  limit,
  resetDate
)
```

### Error Response Structure

All error handlers return a standardized `ErrorResponse`:

```typescript
interface ErrorResponse {
  success: boolean              // Whether extraction succeeded (can be true with partial data)
  category: ErrorCategory       // Type of error
  retryable: boolean           // Whether the operation can be retried
  retryAfter?: number          // Seconds to wait before retry
  partial?: boolean            // Whether partial data was recovered
  message: string              // Technical message for logging
  userMessage: string          // User-friendly message for display
  fallbackMode: FallbackMode   // Suggested fallback action
  guidance?: string[]          // Step-by-step guidance for user
  data?: Partial<ExtractionResult>  // Salvaged partial data
  warnings?: string[]          // Validation warnings
  requiresReview?: boolean     // Whether user review is required
  technicalDetails?: string    // Technical details for debugging
}
```

## Error Categories

### 1. API Errors (`api_error`)

Handles errors from the OpenAI Vision API:

#### Rate Limiting (429)
- **Retryable**: Yes
- **Retry After**: 60 seconds (or from Retry-After header)
- **Fallback**: Retry with delay
- **User Message**: "Too many extraction requests. Please wait a moment and try again."
- **Guidance**:
  - Wait 60 seconds before trying again
  - Consider upgrading your plan for higher limits
  - Use manual entry if you need immediate results

#### Service Unavailable (503)
- **Retryable**: Yes
- **Retry After**: 30 seconds
- **Fallback**: Automatic retry
- **User Message**: "The extraction service is temporarily unavailable. We'll retry automatically."

#### Token Limit Exceeded (400)
- **Retryable**: No
- **Fallback**: Manual entry
- **User Message**: "This menu image is too large or complex to process."
- **Guidance**:
  - Try photographing the menu in smaller sections
  - Ensure the image is clear and well-lit
  - Crop out unnecessary parts of the image
  - Use manual entry for this menu

#### Authentication Errors (401/403)
- **Retryable**: No
- **Fallback**: Manual entry
- **User Message**: "There was an authentication problem. Please contact support."

#### Server Errors (500/502/504)
- **Retryable**: Yes
- **Retry After**: 30 seconds
- **Fallback**: Automatic retry
- **User Message**: "The extraction service encountered an error. We'll retry automatically."

### 2. Validation Errors (`validation_error`)

Handles schema validation failures with partial data salvage:

#### With Salvaged Data
- **Success**: True (partial)
- **Retryable**: No
- **Requires Review**: Yes
- **User Message**: "We extracted X menu items, but some data may need review."
- **Guidance**:
  - Please review the extracted items carefully
  - Some items may have incomplete or incorrect data
  - You can edit any item before publishing
  - Consider retaking the photo for better results

#### Without Salvaged Data
- **Success**: False
- **Retryable**: Yes
- **Fallback**: Retry with adjusted parameters
- **User Message**: "The extraction returned invalid data. We'll try again with adjusted settings."

### 3. Image Quality Issues (`image_quality`)

Assesses extraction quality based on confidence scores:

#### Quality Levels

| Quality | Confidence Range | Can Proceed | Action |
|---------|-----------------|-------------|---------|
| Excellent | ≥ 0.9 | Yes | No error returned |
| Good | 0.75 - 0.89 | Yes | No error returned |
| Fair | 0.6 - 0.74 | Yes | Warning, requires review |
| Poor | 0.3 - 0.59 | Yes | Warning, requires careful review |
| Unacceptable | < 0.3 | No | Error, suggest retake |

#### Fair Quality Response
- **Success**: True (partial)
- **Requires Review**: Yes
- **User Message**: "Extraction completed, but image quality was fair. Please review carefully."
- **Guidance**:
  - Review items with yellow confidence indicators

#### Poor Quality Response
- **Success**: True (partial)
- **Requires Review**: Yes
- **User Message**: "Extraction completed, but image quality was poor. Please review carefully."
- **Guidance**:
  - Consider retaking the photo with better lighting
  - Ensure the menu is in focus and clearly visible
  - Review all extracted items carefully

#### Unacceptable Quality Response
- **Success**: False
- **Fallback**: Manual entry
- **User Message**: "The image quality is too low for reliable extraction."
- **Guidance**:
  - Retake the photo with better lighting
  - Hold the camera steady to avoid blur
  - Ensure the menu fills most of the frame
  - Avoid glare and shadows
  - Consider using manual entry instead

### 4. Quota Exceeded (`quota_exceeded`)

Handles extraction quota limits:

- **Retryable**: No
- **Fallback**: Manual entry
- **User Message**: "You've reached your extraction limit (X/Y). Your quota resets on [date]."
- **Guidance**:
  - Upgrade your plan for more extractions
  - Use manual entry for this menu
  - Your quota resets on [date]

### 5. Invalid Input (`invalid_input`)

Handles invalid image format or size:

- **Retryable**: No
- **Fallback**: Manual entry
- **User Message**: "There was a problem with your menu image."
- **Guidance**:
  - Ensure the image is a valid format (JPEG or PNG)
  - Check that the image is not corrupted
  - Try uploading a different image
  - Use manual entry if the problem persists

## Integration with Menu Extraction Service

The error handler is integrated into `MenuExtractionService`:

### Validation with Error Handling

```typescript
// In processWithVisionLLM method
const validation = await this.validateResult(rawData)

if (!validation.valid) {
  // Attempt to salvage partial data
  const validator = new SchemaValidator()
  const salvageAttempt = validator.salvagePartialData(rawData)
  
  if (salvageAttempt.itemsRecovered > 0) {
    // Return salvaged data with warnings
    return {
      extractionResult: salvageAttempt.salvaged as ExtractionResult,
      usage: completion.usage,
      validation: {
        ...validation,
        partial: true,
        salvaged: salvageAttempt
      }
    }
  }
  
  // No salvageable data - throw error
  throw new Error(...)
}
```

### API Error Handling

```typescript
// In submitExtractionJob method
try {
  // ... extraction logic
} catch (error) {
  // Handle error and update job status
  const errorResponse = ExtractionErrorHandler.handleVisionAPIError(error)
  
  if (jobId) {
    await this.failJob(jobId, errorResponse)
  }
  
  throw error
}
```

### Image Quality Assessment

```typescript
// After successful extraction
const assessment = service.assessImageQuality(result)
const qualityError = ExtractionErrorHandler.handleImageQualityIssue(assessment)

if (qualityError && !qualityError.success) {
  // Handle unacceptable quality
  throw new Error(qualityError.message)
}

if (qualityError && qualityError.requiresReview) {
  // Show warning to user
  console.warn(qualityError.userMessage)
}
```

## User-Friendly Messages

The error handler provides a method to create UI-ready messages:

```typescript
const errorResponse = ExtractionErrorHandler.handleVisionAPIError(error)
const uiMessage = ExtractionErrorHandler.createUserFriendlyMessage(errorResponse)

// Returns:
{
  title: "Service Error",
  message: "Too many extraction requests. Please wait a moment and try again.",
  actions: [
    { label: "Retry", action: "retry" },
    { label: "Manual Entry", action: "manual_entry" }
  ]
}
```

### Action Types

- `retry`: Retry the extraction
- `retake`: Retake the photo
- `review`: Review extracted items
- `manual_entry`: Switch to manual entry
- `upgrade`: Upgrade plan (for quota errors)

## Convenience Functions

### `validateAndHandleErrors`

Validates extraction result and returns appropriate error response:

```typescript
import { validateAndHandleErrors } from './error-handler'

const errorResponse = validateAndHandleErrors(
  validationResult,
  rawData,
  salvageAttempt
)

if (errorResponse && !errorResponse.success) {
  // Handle error
}
```

### `isRetryableError`

Check if an error can be retried:

```typescript
import { isRetryableError } from './error-handler'

if (isRetryableError(errorResponse)) {
  // Schedule retry
}
```

### `getRetryDelay`

Get retry delay in milliseconds:

```typescript
import { getRetryDelay } from './error-handler'

const delayMs = getRetryDelay(errorResponse)
setTimeout(() => retry(), delayMs)
```

### `shouldOfferManualEntry`

Check if manual entry should be offered:

```typescript
import { shouldOfferManualEntry } from './error-handler'

if (shouldOfferManualEntry(errorResponse)) {
  // Show manual entry option
}
```

## Testing

Comprehensive tests are provided in `__tests__/error-handler.test.ts`:

```bash
npm test -- error-handler.test.ts
```

### Test Coverage

- ✅ API error handling (all HTTP status codes)
- ✅ Validation error handling (with and without salvage)
- ✅ Image quality assessment (all quality levels)
- ✅ Image quality issue handling
- ✅ Quota exceeded handling
- ✅ User-friendly message creation
- ✅ Convenience functions

## Best Practices

### 1. Always Use Error Handler

```typescript
// ❌ Don't throw raw errors
throw new Error('API failed')

// ✅ Use error handler
const errorResponse = ExtractionErrorHandler.handleVisionAPIError(error)
throw new Error(errorResponse.message)
```

### 2. Provide User Guidance

```typescript
// ❌ Generic error message
return { error: 'Extraction failed' }

// ✅ Specific guidance
return {
  error: errorResponse.userMessage,
  guidance: errorResponse.guidance
}
```

### 3. Attempt Data Salvage

```typescript
// ❌ Discard all data on validation error
if (!validation.valid) {
  throw new Error('Invalid data')
}

// ✅ Attempt to salvage partial data
if (!validation.valid) {
  const salvageAttempt = validator.salvagePartialData(rawData)
  if (salvageAttempt.itemsRecovered > 0) {
    return salvageAttempt.salvaged
  }
  throw new Error('Invalid data')
}
```

### 4. Assess Image Quality

```typescript
// ❌ Accept any extraction result
return result

// ✅ Assess quality and warn user
const assessment = ExtractionErrorHandler.assessImageQuality(result)
const qualityError = ExtractionErrorHandler.handleImageQualityIssue(assessment)

if (qualityError?.requiresReview) {
  result.warnings = qualityError.warnings
}

return result
```

## Future Enhancements

1. **Machine Learning Integration**: Use historical correction data to improve error detection
2. **Automatic Retry Strategies**: Implement exponential backoff with jitter
3. **Error Analytics**: Track error patterns to identify systemic issues
4. **Localization**: Support multiple languages for error messages
5. **Context-Aware Guidance**: Provide guidance based on user's history and menu type

## Related Files

- `src/lib/extraction/error-handler.ts` - Error handler implementation
- `src/lib/extraction/menu-extraction-service.ts` - Service integration
- `src/lib/extraction/schema-validator.ts` - Validation with salvage
- `src/lib/extraction/__tests__/error-handler.test.ts` - Comprehensive tests
- `src/lib/retry.ts` - Retry utility with HTTP error handling

## Support

For issues or questions about error handling:

1. Check the test file for usage examples
2. Review the error response structure
3. Consult the requirements document (requirements.md)
4. Check the design document (design.md) for architectural context
