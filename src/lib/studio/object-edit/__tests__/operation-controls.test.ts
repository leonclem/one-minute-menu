import {
  applyOperationControlPatch,
  isInternalAvailable,
  isOperationAvailable,
  isProductionAvailable,
  OperationControlValidationError,
  type OperationControlRecord,
} from '../operation-controls'

const id = '61b3a294-2a76-4be9-a0f0-0123456789ab'
const now = '2026-08-26T12:00:00.000Z'

function control(overrides: Partial<OperationControlRecord> = {}): OperationControlRecord {
  return {
    operation: 'remove',
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
    ...overrides,
  }
}

describe('object-edit operation controls', () => {
  it('is fail-closed for missing, pending, and malformed states', () => {
    expect(isProductionAvailable(null)).toBe(false)
    expect(isProductionAvailable(control())).toBe(false)
    expect(isProductionAvailable({ decision: 'no_go', production_enabled: true })).toBe(false)
    expect(isInternalAvailable(null, true)).toBe(false)
    expect(isInternalAvailable(control({ internal_enabled: true }), false)).toBe(false)
  })

  it('requires an operation-specific go decision and matching production control', () => {
    const remove = control({ decision: 'go', production_enabled: true })
    const move = control({ operation: 'move', decision: 'no_go', production_enabled: true })

    expect(isProductionAvailable(remove)).toBe(true)
    expect(isProductionAvailable(move)).toBe(false)
    expect(isOperationAvailable(remove, 'production')).toBe(true)
    expect(isOperationAvailable(move, 'production')).toBe(false)
  })

  it('keeps a patch local to the targeted operation and requires complete decisions', () => {
    const current = control()
    const next = applyOperationControlPatch(current, { internalEnabled: true })

    expect(next.operation).toBe('remove')
    expect(next.internal_enabled).toBe(true)
    expect(next.production_enabled).toBe(false)
    expect(() => applyOperationControlPatch(current, { decision: 'go' })).toThrow(
      OperationControlValidationError,
    )
  })

  it('accepts a fully evidenced decision and preserves controls not in its patch', () => {
    const next = applyOperationControlPatch(control({ internal_enabled: true }), {
      decision: 'go',
      decisionAt: now,
      reviewerUserId: id,
      rationale: 'Reviewed all operation-and-model evidence.',
      evidenceSetId: id,
      spatialUsefulness: 'inconclusive',
      productionEnabled: true,
    })

    expect(next).toMatchObject({
      decision: 'go',
      internal_enabled: true,
      production_enabled: true,
      spatial_usefulness: 'inconclusive',
    })
  })
})
