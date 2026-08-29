#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const TRACEABILITY_PATH = path.join(
  __dirname,
  '..',
  '.kiro',
  'specs',
  'studio-object-selection-remove-move',
  'traceability.json',
)

const REQUIREMENT_CRITERION_COUNTS = Object.freeze({
  1: 17,
  2: 29,
  3: 10,
  4: 12,
  5: 12,
  6: 10,
  7: 9,
  8: 23,
  9: 10,
  10: 12,
  11: 11,
  12: 9,
  13: 8,
  14: 16,
  15: 6,
  16: 62,
  17: 18,
  18: 17,
  19: 16,
  20: 17,
})

const RELEASE_EVIDENCE_FIELDS = Object.freeze([
  'status',
  'evidenceSet',
  'decision',
  'reviewer',
  'decisionDate',
  'rationale',
  'spatialUsefulnessFinding',
  'releaseControlAuditEvent',
  'latestResult',
])

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function expandCriteria(registry) {
  if (!registry || !Array.isArray(registry.requirements)) return []

  return registry.requirements.flatMap((requirement) => {
    if (!Number.isInteger(requirement.requirement) || !Number.isInteger(requirement.criterionCount)) {
      return []
    }

    return Array.from({ length: requirement.criterionCount }, (_, index) => ({
      criterionId: `${requirement.requirement}.${index + 1}`,
      requirement,
    }))
  })
}

function validateRequirementLinks(requirement, errors) {
  const identifier = `Requirement ${requirement.requirement}`
  if (!Array.isArray(requirement.designSections) || requirement.designSections.length === 0 || !requirement.designSections.every(isNonEmptyString)) {
    errors.push(`${identifier} is missing design-section links.`)
  }
  if (!Array.isArray(requirement.implementationTasks) || requirement.implementationTasks.length === 0 || !requirement.implementationTasks.every(isNonEmptyString)) {
    errors.push(`${identifier} is missing implementation-task links.`)
  }
  if (!Array.isArray(requirement.files) || requirement.files.length === 0 || !requirement.files.every(isNonEmptyString)) {
    errors.push(`${identifier} is missing file links.`)
  }
  if (!requirement.test || !isNonEmptyString(requirement.test.type) || !isNonEmptyString(requirement.test.name)) {
    errors.push(`${identifier} is missing test links.`)
  }
  if (!isNonEmptyString(requirement.verificationArtifact)) {
    errors.push(`${identifier} is missing a verification artifact link.`)
  }

  const evidence = requirement.releaseEvidence
  if (!evidence || typeof evidence !== 'object') {
    errors.push(`${identifier} is missing operation-specific release evidence fields.`)
    return
  }
  for (const field of RELEASE_EVIDENCE_FIELDS) {
    if (!isNonEmptyString(evidence[field])) {
      errors.push(`${identifier} is missing release evidence field '${field}'.`)
    }
  }

  if (evidence.status === 'released') {
    for (const field of RELEASE_EVIDENCE_FIELDS.filter((field) => field !== 'status')) {
      if (evidence[field] === 'pending') {
        errors.push(`${identifier} has released status but pending '${field}' evidence.`)
      }
    }
    if (evidence.decision !== 'go') {
      errors.push(`${identifier} has released status without a go decision.`)
    }
  }
}

function validateRegistry(registry) {
  const errors = []
  if (!registry || registry.version !== 1) {
    errors.push('Traceability registry must declare version 1.')
  }
  if (!registry || registry.feature !== 'studio-object-selection-remove-move') {
    errors.push('Traceability registry has an unexpected feature identifier.')
  }

  const requirements = Array.isArray(registry && registry.requirements) ? registry.requirements : []
  const byRequirement = new Map()
  for (const requirement of requirements) {
    if (!Number.isInteger(requirement.requirement)) {
      errors.push('Traceability registry contains a requirement without an integer identifier.')
      continue
    }
    if (byRequirement.has(requirement.requirement)) {
      errors.push(`Traceability registry duplicates requirement ${requirement.requirement}.`)
      continue
    }
    byRequirement.set(requirement.requirement, requirement)
  }

  for (const [requirementNumber, criterionCount] of Object.entries(REQUIREMENT_CRITERION_COUNTS)) {
    const requirement = byRequirement.get(Number(requirementNumber))
    if (!requirement) {
      errors.push(`Traceability registry is missing requirement ${requirementNumber}.`)
      continue
    }
    if (requirement.criterionCount !== criterionCount) {
      errors.push(
        `Requirement ${requirementNumber} must enumerate ${criterionCount} acceptance criteria.`,
      )
    }
    validateRequirementLinks(requirement, errors)
  }

  for (const requirementNumber of byRequirement.keys()) {
    if (!Object.prototype.hasOwnProperty.call(REQUIREMENT_CRITERION_COUNTS, requirementNumber)) {
      errors.push(`Traceability registry contains unknown requirement ${requirementNumber}.`)
    }
  }

  const criteria = expandCriteria(registry)
  const expectedCount = Object.values(REQUIREMENT_CRITERION_COUNTS).reduce(
    (total, count) => total + count,
    0,
  )
  const criterionIds = new Set(criteria.map((criterion) => criterion.criterionId))
  if (criterionIds.size !== expectedCount) {
    errors.push(`Traceability registry expands to ${criterionIds.size} criteria; expected ${expectedCount}.`)
  }
  for (const [requirementNumber, criterionCount] of Object.entries(REQUIREMENT_CRITERION_COUNTS)) {
    for (let index = 1; index <= criterionCount; index += 1) {
      const criterionId = `${requirementNumber}.${index}`
      if (!criterionIds.has(criterionId)) {
        errors.push(`Traceability registry is missing criterion ${criterionId}.`)
      }
    }
  }

  return { criteria, errors, valid: errors.length === 0 }
}

function loadRegistry(filePath = TRACEABILITY_PATH) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function main() {
  let registry
  try {
    registry = loadRegistry()
  } catch (error) {
    console.error(`Traceability validation failed: unable to read ${TRACEABILITY_PATH}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
    return
  }

  const result = validateRegistry(registry)
  if (!result.valid) {
    console.error('Traceability validation failed:')
    for (const error of result.errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  console.log(`Validated ${result.criteria.length} acceptance criteria for studio-object-selection-remove-move.`)
}

if (require.main === module) main()

module.exports = {
  RELEASE_EVIDENCE_FIELDS,
  REQUIREMENT_CRITERION_COUNTS,
  TRACEABILITY_PATH,
  expandCriteria,
  loadRegistry,
  validateRegistry,
}
