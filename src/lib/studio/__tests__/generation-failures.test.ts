/**
 * @jest-environment node
 */

import { NanoBananaError } from '@/lib/nano-banana'
import {
  assertDishNotBlocked,
  getStudioDishFailureLimit,
  isBillableProviderFailure,
  StudioDishBlockedError,
} from '../generation-failures'

describe('generation-failures classifier', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.STUDIO_DISH_FAILURE_LIMIT
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('defaults failure limit to 5', () => {
    expect(getStudioDishFailureLimit()).toBe(5)
  })

  it('treats safety / no-image / generation-failed as billable', () => {
    expect(
      isBillableProviderFailure(new NanoBananaError('x', 'SAFETY_FILTER_BLOCKED', 403)),
    ).toBe(true)
    expect(
      isBillableProviderFailure(new NanoBananaError('x', 'NO_IMAGE_PRODUCED', 502)),
    ).toBe(true)
    expect(
      isBillableProviderFailure(new NanoBananaError('x', 'CONTENT_POLICY_VIOLATION', 403)),
    ).toBe(true)
  })

  it('does not treat rate limit / auth / unavailable as billable', () => {
    expect(
      isBillableProviderFailure(new NanoBananaError('x', 'RATE_LIMIT_EXCEEDED', 429)),
    ).toBe(false)
    expect(
      isBillableProviderFailure(new NanoBananaError('x', 'AUTHENTICATION_ERROR', 401)),
    ).toBe(false)
    expect(
      isBillableProviderFailure(new NanoBananaError('x', 'SERVICE_UNAVAILABLE', 503)),
    ).toBe(false)
  })

  it('assertDishNotBlocked throws 423 when blocked', () => {
    expect(() =>
      assertDishNotBlocked({
        name: 'Burger',
        generation_blocked_at: '2026-07-27T00:00:00Z',
        generation_failure_count: 5,
      }),
    ).toThrow(StudioDishBlockedError)

    expect(() =>
      assertDishNotBlocked({
        name: 'Burger',
        generation_blocked_at: null,
        generation_failure_count: 2,
      }),
    ).not.toThrow()
  })
})
