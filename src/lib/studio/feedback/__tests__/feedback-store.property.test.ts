/**
 * **Validates: Requirements 6.10**
 */

import fc from 'fast-check'
import { buildFeedbackRow } from '@/lib/studio/feedback/feedback-store'

const allowedFeedbackColumns = [
  'user_id',
  'studio_image_id',
  'dish_id',
  'source_image_id',
  'requested_modifications',
  'rating',
  'reason_tags',
  'comment',
  'updated_at',
] as const

const feedbackReasonTagArbitrary = fc.constantFrom(
  'identity_changed',
  'style_missed',
  'unwanted_prop',
  'obviously_fake',
  'useful_result'
)

const extraInputArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 24 }),
  fc.jsonValue(),
  { maxKeys: 8 }
)

const extractedJsonArbitrary = fc.record({
  marker: fc.string().map((value) => `extracted-json:${value}`),
  data: fc.jsonValue(),
})

describe('Feature: studio-controlled-beta-readiness, Property 10', () => {
  it('builds feedback rows from only the allow-listed persisted columns', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        fc.record({ change_summary: fc.array(fc.string(), { maxLength: 8 }) }),
        fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
        fc.array(feedbackReasonTagArbitrary, { maxLength: 5 }),
        fc.option(fc.string(), { nil: null }),
        fc.string(),
        fc.string().map((value) => `prompt-text:${value}`),
        fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 32 }),
        fc.string().map((value) => `storage-path:${value}`),
        extractedJsonArbitrary,
        extraInputArbitrary,
        (
          userId,
          dishId,
          studioImageId,
          sourceImageId,
          requestedModifications,
          rating,
          reasonTags,
          comment,
          now,
          promptText,
          imageBytes,
          storagePath,
          extractedJson,
          extraInput
        ) => {
          const value = {
            ...extraInput,
            studioImageId,
            rating,
            reasonTags,
            comment,
            prompt_text: promptText,
            image_bytes: imageBytes,
            storage_path: storagePath,
            extracted_json: extractedJson,
          }

          const row = buildFeedbackRow({
            ...extraInput,
            userId,
            dishId,
            sourceImageId,
            requestedModifications,
            value,
            now,
            prompt_text: promptText,
            image_bytes: imageBytes,
            storage_path: storagePath,
            extracted_json: extractedJson,
          } as Parameters<typeof buildFeedbackRow>[0])

          expect(Object.keys(row).sort()).toEqual([...allowedFeedbackColumns].sort())
          expect(row).toEqual({
            user_id: userId,
            studio_image_id: studioImageId,
            dish_id: dishId,
            source_image_id: sourceImageId,
            requested_modifications: requestedModifications,
            rating,
            reason_tags: reasonTags,
            comment,
            updated_at: now,
          })

          const serialisedRow = JSON.stringify(row)
          expect(serialisedRow).not.toContain(promptText)
          expect(serialisedRow).not.toContain(storagePath)
          expect(serialisedRow).not.toContain(extractedJson.marker)
          expect(Object.values(row)).not.toContain(imageBytes)
        }
      ),
      { numRuns: 100 }
    )
  })
})
