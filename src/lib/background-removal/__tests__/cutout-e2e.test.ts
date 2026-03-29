/**
 * End-to-end integration test for the cut-out generation pipeline.
 *
 * Exercises the full lifecycle using mocked Supabase and provider:
 * 1. Happy path: request → worker processes → provider succeeds → cutout stored → resolveImageUrl returns cutout
 * 2. Failure path: provider error → status failed → resolveImageUrl falls back to original
 * 3. Lifecycle: cutout succeeds → invalidate → resolveImageUrl returns original
 * 4. Stale completion: source image replaced → worker discards result
 * 5. Feature flag disabled: resolveImageUrl always returns original
 *
 * Validates: Requirements 1.2–1.6, 3.1–3.5, 10.1–10.5, 11.1–11.4
 */

import { CutoutGenerationService } from '../cutout-service'
import type { BackgroundRemovalProvider, BackgroundRemovalResult, BackgroundRemovalError } from '../types'
import type { CutoutStatus } from '@/types'
import { isCutoutFeatureEnabled } from '../feature-flag'

// ── Mock logger to suppress output ──────────────────────────────────────────
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

// ── Mock local-image-proxy to avoid @google-cloud/storage ESM import ────────
jest.mock('../local-image-proxy', () => ({
  resolvePublicImageUrl: jest.fn().mockImplementation((url: string) =>
    Promise.resolve({ url, cleanup: jest.fn().mockResolvedValue(undefined) })
  ),
}))

// ── Mock feature-flag to avoid real Supabase admin client creation ───────────
// The mock implementation is updated in beforeEach to reflect featureFlags state.
jest.mock('../feature-flag', () => ({
  isCutoutFeatureEnabled: jest.fn(),
}))

// ── In-memory DB state ──────────────────────────────────────────────────────

interface ImageRow {
  id: string
  original_url: string
  cutout_url: string | null
  cutout_status: CutoutStatus | 'processing'
  cutout_provider: string | null
  cutout_model_version: string | null
  cutout_requested_at: string | null
  cutout_completed_at: string | null
  cutout_failure_reason: string | null
  cutout_generation_log_id: string | null
}

interface LogRow {
  id: string
  image_id: string
  user_id: string
  menu_id: string
  menu_item_id: string
  source_image_type: string
  provider_name: string
  provider_model_version: string | null
  status: string
  processing_duration_ms: number | null
  output_asset_created: boolean
  error_category: string | null
  error_code: string | null
  error_message: string | null
  requested_at: string
  completed_at: string | null
}

interface FeatureFlagRow {
  id: string
  enabled: boolean
}

let images: Map<string, ImageRow>
let logs: Map<string, LogRow>
let featureFlags: Map<string, FeatureFlagRow>
let uploadedFiles: Map<string, Buffer>
let logIdCounter: number

// ── Chainable Supabase mock builder ─────────────────────────────────────────

function createMockSupabase() {
  /**
   * Build a chainable query builder that simulates Supabase's fluent API.
   * Each chain method returns the same builder so calls like
   * `.from('x').select('*').eq('id', val).single()` work naturally.
   */
  function chainBuilder(resolve: () => { data: any; error: any }) {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => resolve()),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
    }
    // Make update/insert return the builder so .eq/.select/.single chain
    builder.update.mockReturnValue(builder)
    builder.insert.mockReturnValue(builder)
    return builder
  }

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'feature_flags') {
      return chainBuilder(() => {
        const flag = featureFlags.get('cutout_generation')
        return flag ? { data: { enabled: flag.enabled }, error: null } : { data: null, error: { message: 'not found' } }
      })
    }

    if (table === 'cutout_generation_logs') {
      // We need to handle insert, update, and select differently.
      // Return a builder that tracks the operation via the last call.
      let pendingInsertData: any = null
      let pendingUpdateData: any = null
      let filterEqField: string | null = null
      let filterEqValue: string | null = null

      const builder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((field: string, value: string) => {
          filterEqField = field
          filterEqValue = value
          return builder
        }),
        single: jest.fn().mockImplementation(() => {
          // Fetch by id
          if (filterEqField === 'id' && filterEqValue) {
            const log = logs.get(filterEqValue)
            return log ? { data: { ...log }, error: null } : { data: null, error: { message: 'not found' } }
          }
          return { data: null, error: { message: 'no filter' } }
        }),
        insert: jest.fn().mockImplementation((data: any) => {
          pendingInsertData = data
          return builder
        }),
        update: jest.fn().mockImplementation((data: any) => {
          pendingUpdateData = data
          return builder
        }),
      }

      // Override select to handle insert().select().single() chain
      const origSelect = builder.select
      builder.select = jest.fn().mockImplementation((...args: any[]) => {
        if (pendingInsertData) {
          // Insert path: insert().select('id').single()
          const insertData = pendingInsertData
          pendingInsertData = null
          return {
            ...builder,
            single: jest.fn().mockImplementation(() => {
              const id = `log-${++logIdCounter}`
              const newLog: LogRow = {
                id,
                image_id: insertData.image_id,
                user_id: insertData.user_id,
                menu_id: insertData.menu_id,
                menu_item_id: insertData.menu_item_id,
                source_image_type: insertData.source_image_type,
                provider_name: insertData.provider_name,
                status: insertData.status,
                provider_model_version: null,
                processing_duration_ms: null,
                output_asset_created: false,
                error_category: null,
                error_code: null,
                error_message: null,
                requested_at: new Date().toISOString(),
                completed_at: null,
              }
              logs.set(id, newLog)
              return { data: { id }, error: null }
            }),
          }
        }
        return builder
      })

      // Override eq to handle update().eq() chain
      const origEq = builder.eq
      builder.eq = jest.fn().mockImplementation((field: string, value: string) => {
        filterEqField = field
        filterEqValue = value
        if (pendingUpdateData && field === 'id') {
          const updateData = pendingUpdateData
          pendingUpdateData = null
          const existing = logs.get(value)
          if (existing) {
            Object.assign(existing, updateData)
          }
          return { data: null, error: null }
        }
        return builder
      })

      return builder
    }

    if (table === 'ai_generated_images') {
      let pendingUpdateData: any = null
      let filterEqField: string | null = null
      let filterEqValue: string | null = null

      const builder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((field: string, value: string) => {
          filterEqField = field
          filterEqValue = value
          if (pendingUpdateData && field === 'id') {
            const updateData = pendingUpdateData
            pendingUpdateData = null
            const img = images.get(value)
            if (img) {
              Object.assign(img, updateData)
            }
            return { data: null, error: null }
          }
          return builder
        }),
        single: jest.fn().mockImplementation(() => {
          if (filterEqField === 'id' && filterEqValue) {
            const img = images.get(filterEqValue)
            return img ? { data: { ...img }, error: null } : { data: null, error: { message: 'not found' } }
          }
          return { data: null, error: { message: 'no filter' } }
        }),
        update: jest.fn().mockImplementation((data: any) => {
          pendingUpdateData = data
          return builder
        }),
      }

      return builder
    }

    // Default: return a no-op builder
    return chainBuilder(() => ({ data: null, error: null }))
  })

  const storage = {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockImplementation(
        (path: string, buffer: Buffer, _opts: any) => {
          uploadedFiles.set(path, buffer)
          return { error: null }
        }
      ),
      getPublicUrl: jest.fn().mockImplementation((path: string) => ({
        data: { publicUrl: `https://storage.example.com/${path}` },
      })),
    }),
  }

  return { from, storage } as any
}

// ── Mock provider ───────────────────────────────────────────────────────────

function createMockProvider(overrides?: Partial<BackgroundRemovalProvider>): BackgroundRemovalProvider {
  return {
    name: 'mock-provider',
    removeBackground: jest.fn().mockResolvedValue({
      imageBuffer: Buffer.from('transparent-png-data'),
      processingTimeMs: 1200,
      modelVersion: 'mock-v1',
    } as BackgroundRemovalResult),
    isAvailable: jest.fn().mockResolvedValue(true),
    ...overrides,
  }
}

// ── Test suite ──────────────────────────────────────────────────────────────

describe('Cut-out E2E integration', () => {
  const IMAGE_ID = 'img-001'
  const USER_ID = 'user-001'
  const MENU_ID = 'menu-001'
  const ITEM_ID = 'item-001'
  const ORIGINAL_URL = 'https://storage.example.com/originals/food.jpg'

  beforeEach(() => {
    images = new Map()
    logs = new Map()
    featureFlags = new Map()
    uploadedFiles = new Map()
    logIdCounter = 0

    // Seed a feature flag (enabled by default for most tests)
    featureFlags.set('cutout_generation', { id: 'cutout_generation', enabled: true })

    // Configure the feature-flag mock to read from the in-memory featureFlags map
    ;(isCutoutFeatureEnabled as jest.Mock).mockImplementation(async () => {
      const flag = featureFlags.get('cutout_generation')
      return flag ? flag.enabled : false
    })

    // Seed an AI-generated image
    images.set(IMAGE_ID, {
      id: IMAGE_ID,
      original_url: ORIGINAL_URL,
      cutout_url: null,
      cutout_status: 'not_requested',
      cutout_provider: null,
      cutout_model_version: null,
      cutout_requested_at: null,
      cutout_completed_at: null,
      cutout_failure_reason: null,
      cutout_generation_log_id: null,
    })
  })

  // ── 1. Happy path ──────────────────────────────────────────────────────

  describe('Happy path: full flow', () => {
    it('request → worker processes → provider succeeds → cutout stored → resolveImageUrl returns cutout', async () => {
      const supabase = createMockSupabase()
      const provider = createMockProvider()
      const service = new CutoutGenerationService(provider, supabase)

      // Step 1: Feature flag is enabled
      const enabled = await service.isEnabled()
      expect(enabled).toBe(true)

      // Step 2: Request cutout — creates pending log entry and sets image status
      const { logId } = await service.requestCutout({
        imageId: IMAGE_ID,
        imageUrl: ORIGINAL_URL,
        userId: USER_ID,
        menuId: MENU_ID,
        menuItemId: ITEM_ID,
      })

      expect(logId).toBeDefined()
      expect(logs.has(logId)).toBe(true)
      expect(logs.get(logId)!.status).toBe('pending')

      const imageAfterRequest = images.get(IMAGE_ID)!
      expect(imageAfterRequest.cutout_status).toBe('pending')
      expect(imageAfterRequest.cutout_generation_log_id).toBe(logId)

      // Step 3: Worker processes the pending job
      await service.processPendingCutout(logId)

      // Step 4: Provider was called
      expect(provider.removeBackground).toHaveBeenCalledWith(ORIGINAL_URL)

      // Step 5: Cut-out PNG uploaded to storage
      const storagePath = `cutouts/${IMAGE_ID}/cutout.png`
      expect(uploadedFiles.has(storagePath)).toBe(true)

      // Step 6: Image record updated with cutout result
      const imageAfterProcess = images.get(IMAGE_ID)!
      expect(imageAfterProcess.cutout_status).toBe('succeeded')
      expect(imageAfterProcess.cutout_url).toBe(`https://storage.example.com/${storagePath}`)
      expect(imageAfterProcess.cutout_provider).toBe('mock-provider')
      expect(imageAfterProcess.cutout_failure_reason).toBeNull()

      // Step 7: Log entry updated with success
      const logAfterProcess = logs.get(logId)!
      expect(logAfterProcess.status).toBe('succeeded')
      expect(logAfterProcess.processing_duration_ms).toBeGreaterThanOrEqual(0)
      expect(logAfterProcess.output_asset_created).toBe(true)

      // Step 8: resolveImageUrl returns the cutout URL
      const resolvedUrl = CutoutGenerationService.resolveImageUrl({
        originalUrl: ORIGINAL_URL,
        cutoutUrl: imageAfterProcess.cutout_url,
        cutoutStatus: 'succeeded',
        templateSupportsCutouts: true,
        featureEnabled: true,
      })
      expect(resolvedUrl).toBe(`https://storage.example.com/${storagePath}`)

      // Step 9: Original image URL is preserved
      expect(imageAfterProcess.original_url).toBe(ORIGINAL_URL)
    })
  })

  // ── 2. Provider failure path ───────────────────────────────────────────

  describe('Provider failure path', () => {
    it('provider error → status failed → resolveImageUrl falls back to original', async () => {
      const providerError: BackgroundRemovalError = {
        code: 'PROCESSING_FAILED',
        message: 'Could not segment the image',
        category: 'processing_failed',
      }
      const provider = createMockProvider({
        removeBackground: jest.fn().mockRejectedValue(providerError),
      })
      const supabase = createMockSupabase()
      const service = new CutoutGenerationService(provider, supabase)

      // Request cutout
      const { logId } = await service.requestCutout({
        imageId: IMAGE_ID,
        imageUrl: ORIGINAL_URL,
        userId: USER_ID,
        menuId: MENU_ID,
        menuItemId: ITEM_ID,
      })

      // Worker processes — provider throws
      await service.processPendingCutout(logId)

      // Image record: cutout_status = failed, failure reason set
      const img = images.get(IMAGE_ID)!
      expect(img.cutout_status).toBe('failed')
      expect(img.cutout_failure_reason).toBe('Could not segment the image')
      expect(img.cutout_url).toBeNull()

      // Log entry: status = failed, error info set
      const log = logs.get(logId)!
      expect(log.status).toBe('failed')
      expect(log.error_category).toBe('processing_failed')
      expect(log.error_message).toBe('Could not segment the image')

      // resolveImageUrl returns original (fallback)
      const resolvedUrl = CutoutGenerationService.resolveImageUrl({
        originalUrl: ORIGINAL_URL,
        cutoutUrl: null,
        cutoutStatus: 'failed',
        templateSupportsCutouts: true,
        featureEnabled: true,
      })
      expect(resolvedUrl).toBe(ORIGINAL_URL)
    })
  })

  // ── 3. Lifecycle: invalidation after success ───────────────────────────

  describe('Lifecycle: image regeneration invalidation', () => {
    it('cutout succeeds → invalidate → resolveImageUrl returns original', async () => {
      const supabase = createMockSupabase()
      const provider = createMockProvider()
      const service = new CutoutGenerationService(provider, supabase)

      // First: generate a successful cutout
      const { logId } = await service.requestCutout({
        imageId: IMAGE_ID,
        imageUrl: ORIGINAL_URL,
        userId: USER_ID,
        menuId: MENU_ID,
        menuItemId: ITEM_ID,
      })
      await service.processPendingCutout(logId)

      // Verify cutout succeeded
      const imgBefore = images.get(IMAGE_ID)!
      expect(imgBefore.cutout_status).toBe('succeeded')
      expect(imgBefore.cutout_url).toBeTruthy()

      const cutoutUrlBefore = imgBefore.cutout_url!

      // resolveImageUrl returns cutout before invalidation
      expect(
        CutoutGenerationService.resolveImageUrl({
          originalUrl: ORIGINAL_URL,
          cutoutUrl: cutoutUrlBefore,
          cutoutStatus: 'succeeded',
          templateSupportsCutouts: true,
          featureEnabled: true,
        })
      ).toBe(cutoutUrlBefore)

      // Invalidate (simulating image regeneration)
      await service.invalidateCutout(IMAGE_ID)

      // Image record: cutout_status = not_requested, cutout_url = null
      const imgAfter = images.get(IMAGE_ID)!
      expect(imgAfter.cutout_status).toBe('not_requested')
      expect(imgAfter.cutout_url).toBeNull()
      expect(imgAfter.cutout_generation_log_id).toBeNull()

      // resolveImageUrl returns original after invalidation
      expect(
        CutoutGenerationService.resolveImageUrl({
          originalUrl: ORIGINAL_URL,
          cutoutUrl: null,
          cutoutStatus: 'not_requested',
          templateSupportsCutouts: true,
          featureEnabled: true,
        })
      ).toBe(ORIGINAL_URL)
    })
  })

  // ── 4. Stale completion discard ────────────────────────────────────────

  describe('Stale completion discard', () => {
    it('source image replaced during processing → worker discards result', async () => {
      const supabase = createMockSupabase()
      const provider = createMockProvider()
      const service = new CutoutGenerationService(provider, supabase)

      // Request cutout (logId A)
      const { logId: logIdA } = await service.requestCutout({
        imageId: IMAGE_ID,
        imageUrl: ORIGINAL_URL,
        userId: USER_ID,
        menuId: MENU_ID,
        menuItemId: ITEM_ID,
      })

      // Simulate source image being replaced: a new cutout request (logId B)
      // is set on the image, making logId A stale
      const { logId: logIdB } = await service.requestCutout({
        imageId: IMAGE_ID,
        imageUrl: 'https://storage.example.com/originals/food-v2.jpg',
        userId: USER_ID,
        menuId: MENU_ID,
        menuItemId: ITEM_ID,
      })

      // Image now points to logId B
      expect(images.get(IMAGE_ID)!.cutout_generation_log_id).toBe(logIdB)

      // Worker tries to process logId A (stale)
      await service.processPendingCutout(logIdA)

      // Provider was called (it fetches the image before the stale check after provider call)
      // But the result should be discarded — image should still point to logId B
      const img = images.get(IMAGE_ID)!
      expect(img.cutout_generation_log_id).toBe(logIdB)

      // Log A should be marked as failed with stale reason
      const logA = logs.get(logIdA)!
      expect(logA.status).toBe('failed')
      expect(logA.error_code).toBe('STALE_COMPLETION')

      // No cutout URL should be set from the stale request
      // (the image status is 'pending' from logIdB's request, not 'succeeded')
      expect(img.cutout_status).toBe('pending')
    })
  })

  // ── 5. Feature flag disabled ───────────────────────────────────────────

  describe('Feature flag disabled', () => {
    it('resolveImageUrl always returns original regardless of cutout data', async () => {
      const supabase = createMockSupabase()
      const provider = createMockProvider()
      const service = new CutoutGenerationService(provider, supabase)

      // Disable feature flag
      featureFlags.set('cutout_generation', { id: 'cutout_generation', enabled: false })

      // isEnabled returns false
      const enabled = await service.isEnabled()
      expect(enabled).toBe(false)

      // Even with a valid cutout URL and succeeded status, resolveImageUrl returns original
      const resolvedUrl = CutoutGenerationService.resolveImageUrl({
        originalUrl: ORIGINAL_URL,
        cutoutUrl: 'https://storage.example.com/cutouts/img-001/cutout.png',
        cutoutStatus: 'succeeded',
        templateSupportsCutouts: true,
        featureEnabled: false,
      })
      expect(resolvedUrl).toBe(ORIGINAL_URL)
    })

    it('resolveImageUrl returns original when template does not support cutouts', () => {
      const resolvedUrl = CutoutGenerationService.resolveImageUrl({
        originalUrl: ORIGINAL_URL,
        cutoutUrl: 'https://storage.example.com/cutouts/img-001/cutout.png',
        cutoutStatus: 'succeeded',
        templateSupportsCutouts: false,
        featureEnabled: true,
      })
      expect(resolvedUrl).toBe(ORIGINAL_URL)
    })
  })
})
