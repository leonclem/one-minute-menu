/**
 * Property-Based Tests for Original Image Preservation
 *
 * Property: Original Image Preservation — FOR ALL AI-generated images,
 * the original image URL must remain unchanged after cut-out generation
 * is attempted.
 *
 * **Validates: Requirements 1.5, 14.4**
 */

import * as fc from 'fast-check'
import { CutoutGenerationService } from '@/lib/background-removal/cutout-service'
import type { BackgroundRemovalProvider, BackgroundRemovalResult } from '@/lib/background-removal/types'

// Mock local-image-proxy to avoid @google-cloud/storage ESM import issues
jest.mock('@/lib/background-removal/local-image-proxy', () => ({
  resolvePublicImageUrl: jest.fn().mockImplementation((url: string) =>
    Promise.resolve({ url, cleanup: jest.fn().mockResolvedValue(undefined) })
  ),
}))

// Mock the logger to suppress output during tests
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock the feature flag to always return enabled
jest.mock('@/lib/background-removal/feature-flag', () => ({
  isCutoutFeatureEnabled: jest.fn().mockResolvedValue(true),
}))

/**
 * Helper: create a mock BackgroundRemovalProvider that returns a successful result.
 */
function createMockProvider(providerName: string = 'test-provider'): BackgroundRemovalProvider {
  return {
    name: providerName,
    removeBackground: jest.fn().mockResolvedValue({
      imageBuffer: Buffer.from('fake-png-data'),
      processingTimeMs: 500,
      modelVersion: 'test-v1',
    } as BackgroundRemovalResult),
    isAvailable: jest.fn().mockResolvedValue(true),
  }
}

/**
 * Helper: create a mock BackgroundRemovalProvider that throws an error.
 */
function createFailingProvider(): BackgroundRemovalProvider {
  return {
    name: 'failing-provider',
    removeBackground: jest.fn().mockRejectedValue({
      code: 'PROVIDER_ERROR',
      message: 'Processing failed',
      category: 'processing_failed',
    }),
    isAvailable: jest.fn().mockResolvedValue(true),
  }
}

/**
 * Helper: create a mock Supabase client that captures update payloads
 * passed to `.update()` on the `ai_generated_images` table.
 *
 * The captured payloads are stored in the returned `capturedUpdates` array.
 */
function createMockSupabase(options: {
  imageId: string
  originalUrl: string
  logId: string
}) {
  const capturedUpdates: Record<string, unknown>[] = []

  const mockFrom = jest.fn().mockImplementation((table: string) => {
    if (table === 'cutout_generation_logs') {
      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: options.logId },
              error: null,
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: options.logId,
                image_id: options.imageId,
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }
    }
    // ai_generated_images
    return {
      update: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
        capturedUpdates.push(payload)
        return {
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: options.imageId,
              original_url: options.originalUrl,
              cutout_generation_log_id: options.logId,
            },
            error: null,
          }),
        }),
      }),
    }
  })

  const mockSupabase = {
    from: mockFrom,
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://storage.example.com/cutout.png' },
        }),
      }),
    },
  } as any

  return { mockSupabase, capturedUpdates }
}

describe('Property: Original Image Preservation', () => {
  // ── Generators ──────────────────────────────────────────────────────────

  const uuidArb = fc.uuid()
  const urlArb = fc.webUrl()

  // ── Property 1: requestCutout never touches original_url ───────────────

  it('requestCutout update payloads never contain original_url', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        urlArb,
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        async (imageId, imageUrl, userId, menuId, menuItemId, logId) => {
          const { mockSupabase, capturedUpdates } = createMockSupabase({
            imageId,
            originalUrl: imageUrl,
            logId,
          })
          const provider = createMockProvider()
          const service = new CutoutGenerationService(provider, mockSupabase)

          await service.requestCutout({
            imageId,
            imageUrl,
            userId,
            menuId,
            menuItemId,
          })

          for (const payload of capturedUpdates) {
            expect(payload).not.toHaveProperty('original_url')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 2: processPendingCutout success never touches original_url ─

  it('processPendingCutout success update payloads never contain original_url', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        urlArb,
        uuidArb,
        async (imageId, originalUrl, logId) => {
          const { mockSupabase, capturedUpdates } = createMockSupabase({
            imageId,
            originalUrl,
            logId,
          })
          const provider = createMockProvider()
          const service = new CutoutGenerationService(provider, mockSupabase)

          await service.processPendingCutout(logId)

          for (const payload of capturedUpdates) {
            expect(payload).not.toHaveProperty('original_url')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 3: processPendingCutout failure never touches original_url ─

  it('processPendingCutout failure update payloads never contain original_url', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        urlArb,
        uuidArb,
        async (imageId, originalUrl, logId) => {
          const { mockSupabase, capturedUpdates } = createMockSupabase({
            imageId,
            originalUrl,
            logId,
          })
          const provider = createFailingProvider()
          const service = new CutoutGenerationService(provider, mockSupabase)

          await service.processPendingCutout(logId)

          for (const payload of capturedUpdates) {
            expect(payload).not.toHaveProperty('original_url')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 4: invalidateCutout never touches original_url ────────────

  it('invalidateCutout update payloads never contain original_url', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        urlArb,
        uuidArb,
        async (imageId, originalUrl, logId) => {
          const { mockSupabase, capturedUpdates } = createMockSupabase({
            imageId,
            originalUrl,
            logId,
          })
          const provider = createMockProvider()
          const service = new CutoutGenerationService(provider, mockSupabase)

          await service.invalidateCutout(imageId)

          for (const payload of capturedUpdates) {
            expect(payload).not.toHaveProperty('original_url')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
