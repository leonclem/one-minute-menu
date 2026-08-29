/**
 * @jest-environment node
 */

import fc from 'fast-check'

import { applyOperationControlPatch, type OperationControlRecord } from '../operation-controls'
import { ReviewerDecisionInputZ } from './reviewer-decision'

const id = '61b3a294-2a76-4be9-a0f0-0123456789ab'
const now = '2026-08-26T12:00:00.000Z'

function control(operation: 'remove' | 'move'): OperationControlRecord {
  return {
    operation,
    decision: 'pending',
    decision_at: null,
    reviewer_user_id: null,
    rationale: null,
    evidence_set_id: null,
    spatial_usefulness: 'pending',
    internal_enabled: false,
    production_enabled: false,
    created_at: now,
    updated_at: now,
  }
}

describe('reviewer-decision properties', () => {
  it('Property 19: scores, averages, and thresholds cannot alter human decisions, controls, or findings', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 5 }),
        fc.constantFrom('remove' as const, 'move' as const),
        fc.constantFrom('go' as const, 'no_go' as const),
        fc.constantFrom('useful' as const, 'not_useful' as const, 'inconclusive' as const),
        (scores, threshold, operation, decision, spatialUsefulness) => {
          const average = scores.reduce((total, score) => total + score, 0) / scores.length
          expect(Number.isFinite(average)).toBe(true)
          expect(threshold).toBeGreaterThanOrEqual(1)
          const patch = {
            decision,
            decisionAt: now,
            reviewerUserId: id,
            rationale: 'Human reviewer recorded a written rationale.',
            evidenceSetId: id,
            spatialUsefulness,
          }
          const first = applyOperationControlPatch(control(operation), patch)
          const second = applyOperationControlPatch(control(operation), patch)
          expect(second).toEqual(first)
          expect(first).not.toHaveProperty('scores')
          expect(first).not.toHaveProperty('average')
          expect(first).not.toHaveProperty('threshold')

          expect(ReviewerDecisionInputZ.safeParse({
            operation,
            label: 'Evidence set',
            decision,
            rationale: patch.rationale,
            spatialUsefulness,
            executionIds: [id],
            scores,
            average,
            threshold,
          }).success).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
