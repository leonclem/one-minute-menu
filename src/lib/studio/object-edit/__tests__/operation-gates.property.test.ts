import fc from 'fast-check'

import {
  applyOperationControlPatch,
  isInternalAvailable,
  isOperationAvailable,
  isProductionAvailable,
  type ObjectEditDecision,
  type OperationControlRecord,
} from '../operation-controls'

const id = '61b3a294-2a76-4be9-a0f0-0123456789ab'
const now = '2026-08-26T12:00:00.000Z'

function control(operation: 'remove' | 'move', decision: ObjectEditDecision, productionEnabled: boolean, internalEnabled: boolean): OperationControlRecord {
  const hasDecision = decision !== 'pending'
  return {
    operation,
    decision,
    decision_at: hasDecision ? now : null,
    reviewer_user_id: hasDecision ? id : null,
    rationale: hasDecision ? 'Human decision.' : null,
    evidence_set_id: hasDecision ? id : null,
    spatial_usefulness: hasDecision ? 'inconclusive' : 'pending',
    internal_enabled: internalEnabled,
    production_enabled: productionEnabled,
    created_at: now,
    updated_at: now,
  }
}

describe('object-edit operation gate properties', () => {
  it('Property 20: Remove and Move gates follow the exact independent truth table and local updates', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ObjectEditDecision>('pending', 'go', 'no_go'),
        fc.constantFrom<ObjectEditDecision>('pending', 'go', 'no_go'),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom('remove' as const, 'move' as const),
        (removeDecision, moveDecision, removeProduction, moveProduction, removeInternal, moveInternal, authorisedTester, target) => {
          const remove = control('remove', removeDecision, removeProduction, removeInternal)
          const move = control('move', moveDecision, moveProduction, moveInternal)
          expect(isProductionAvailable(remove)).toBe(removeDecision === 'go' && removeProduction)
          expect(isProductionAvailable(move)).toBe(moveDecision === 'go' && moveProduction)
          expect(isInternalAvailable(remove, authorisedTester)).toBe(authorisedTester && removeInternal)
          expect(isInternalAvailable(move, authorisedTester)).toBe(authorisedTester && moveInternal)
          expect(isOperationAvailable(remove, 'production')).toBe(removeDecision === 'go' && removeProduction)
          expect(isOperationAvailable(move, 'production')).toBe(moveDecision === 'go' && moveProduction)
          expect(isProductionAvailable(null)).toBe(false)

          const controls = { remove, move }
          const beforeOther = JSON.stringify(controls[target === 'remove' ? 'move' : 'remove'])
          const next = { ...controls, [target]: applyOperationControlPatch(controls[target], { internalEnabled: !controls[target].internal_enabled }) }
          expect(JSON.stringify(next[target === 'remove' ? 'move' : 'remove'])).toBe(beforeOther)
          expect(next[target].operation).toBe(target)
          expect(next[target].internal_enabled).toBe(!controls[target].internal_enabled)
        },
      ),
      { numRuns: 100 },
    )
  })
})
