const {
  REQUIREMENT_CRITERION_COUNTS,
  TRACEABILITY_PATH,
  expandCriteria,
  loadRegistry,
  shouldSkipMissingRegistry,
  validateRegistry,
} = require('../validate-studio-object-edit-traceability')

describe('studio object-edit traceability validator', () => {
  it('expands the versioned registry into every approved acceptance criterion', () => {
    const registry = loadRegistry()
    const result = validateRegistry(registry)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(expandCriteria(registry)).toHaveLength(324)
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual(
      expect.arrayContaining(['1.1', '2.29', '16.62', '20.17']),
    )
  })

  it('fails when a criterion range is incomplete', () => {
    const registry = loadRegistry()
    const incomplete = {
      ...registry,
      requirements: registry.requirements.map((requirement) =>
        requirement.requirement === 16
          ? { ...requirement, criterionCount: requirement.criterionCount - 1 }
          : requirement,
      ),
    }

    const result = validateRegistry(incomplete)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Requirement 16 must enumerate 62 acceptance criteria.')
  })

  it('allows pending links during implementation but rejects absent release evidence', () => {
    const registry = loadRegistry()
    const withoutEvidence = {
      ...registry,
      requirements: registry.requirements.map((requirement) =>
        requirement.requirement === 1
          ? {
              ...requirement,
              releaseEvidence: { ...requirement.releaseEvidence, rationale: '' },
            }
          : requirement,
      ),
    }

    expect(validateRegistry(registry).valid).toBe(true)
    const result = validateRegistry(withoutEvidence)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Requirement 1 is missing release evidence field 'rationale'.")
  })

  it('keeps the canonical requirement counts under test', () => {
    expect(REQUIREMENT_CRITERION_COUNTS).toMatchObject({
      1: 17,
      2: 29,
      16: 62,
      20: 17,
    })
  })

  it('skips a missing registry on Vercel or CI, but not in a local checkout', () => {
    const missingPath = `${TRACEABILITY_PATH}.does-not-exist`
    const presentPath = __filename

    expect(shouldSkipMissingRegistry({ VERCEL: '1' }, missingPath)).toBe(true)
    expect(shouldSkipMissingRegistry({ CI: 'true' }, missingPath)).toBe(true)
    expect(shouldSkipMissingRegistry({}, missingPath)).toBe(false)
    expect(shouldSkipMissingRegistry({ VERCEL: '1' }, presentPath)).toBe(false)
  })
})
