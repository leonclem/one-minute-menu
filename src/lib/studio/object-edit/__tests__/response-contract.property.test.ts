import fc from 'fast-check'

import { StudioGenerationErrorZ, StudioGenerationSuccessZ } from '../contracts'

describe('object-edit browser response contract properties', () => {
  it('Property 14: successful responses expose exactly the established browser envelope', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.option(fc.constantFrom('pass' as const, 'warn' as const, 'fail' as const, 'skipped' as const), { nil: undefined }),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0, max: 100000, noNaN: true }),
        (imageUrl, imageId, dishId, model, validationStatus, cost, balanceAfter) => {
          const response = {
            imageUrl,
            imageId,
            dishId,
            model,
            ...(validationStatus === undefined ? {} : { validationStatus }),
            credits: { cost, balanceAfter },
          }
          const parsed = StudioGenerationSuccessZ.parse(response)
          expect(parsed).toEqual(response)
          expect(Object.keys(parsed).sort()).toEqual(
            validationStatus === undefined
              ? ['credits', 'dishId', 'imageId', 'imageUrl', 'model']
              : ['credits', 'dishId', 'imageId', 'imageUrl', 'model', 'validationStatus'],
          )
          expect(Object.keys(parsed.credits).sort()).toEqual(['balanceAfter', 'cost'])
          for (const internalKey of ['rawProviderResponse', 'providerModelIdentity', 'canonical', 'selection', 'spatial']) {
            expect(StudioGenerationSuccessZ.safeParse({ ...response, [internalKey]: {} }).success).toBe(false)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Property 15: error envelopes accept only established optional browser fields and reject internal payloads', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 300 }),
        fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
        fc.option(fc.nat({ max: 10000 }), { nil: undefined }),
        (error, code, retryAfter) => {
          const body = { error, ...(code === undefined ? {} : { code }), ...(retryAfter === undefined ? {} : { retryAfter }) }
          expect(StudioGenerationErrorZ.parse(body)).toEqual(body)
          for (const sensitiveKey of ['rawProviderResponse', 'providerModelIdentity', 'canonical', 'selection', 'spatial', 'stack']) {
            expect(StudioGenerationErrorZ.safeParse({ ...body, [sensitiveKey]: 'private' }).success).toBe(false)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
