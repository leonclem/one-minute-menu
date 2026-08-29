#!/usr/bin/env node

const {
  expandCriteria,
  loadRegistry,
  validateRegistry,
} = require('./validate-studio-object-edit-traceability')

function asInline(value) {
  if (Array.isArray(value)) return value.join(', ')
  return value === undefined || value === null || value === '' ? 'pending' : String(value)
}

function main() {
  const registry = loadRegistry()
  const result = validateRegistry(registry)
  if (!result.valid) {
    console.error('Cannot generate traceability report from an invalid registry:')
    for (const error of result.errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  const criteria = expandCriteria(registry)
  const requirementRows = registry.requirements.map((requirement) => {
    const evidence = requirement.releaseEvidence
    return `| ${requirement.requirement} | ${requirement.criterionCount} | ${asInline(requirement.implementationTasks)} | ${asInline(requirement.files)} | ${asInline(requirement.test?.name)} | ${asInline(requirement.verificationArtifact)} | ${asInline(evidence?.latestResult)} |`
  })

  process.stdout.write([
    '# Studio Object Edit Traceability Report',
    '',
    `Generated from registry version ${registry.version}. Validated ${criteria.length} acceptance criteria.`,
    '',
    '## Delivery scope',
    '',
    'This report covers the approved Remove implementation and shared controls only. Move remains excluded from this delivery because Task 12 recorded `no_go`; no Move UI, placement, analytics, or release evidence is implied by this registry.',
    '',
    'Spatial Inventory is optional and non-blocking. Provider visual quality remains subject to human review; no score or threshold creates a release decision.',
    '',
    '## Requirement-level links',
    '',
    '| Requirement | Criteria | Tasks | Files | Test | Verification artifact | Latest result |',
    '|---:|---:|---|---|---|---|---|',
    ...requirementRows,
    '',
    '## Operational controls',
    '',
    '- Apply additive migrations with `npx supabase db push`; never reset or wipe the database.',
    '- Roll back Remove by disabling its independent internal/production control; Move remains unchanged.',
    '- Review evidence and reviewer authorization independently from production enablement.',
    '- Diagnose storage-orphan compensation through server diagnostics without logging bytes, URLs, prompts, labels, or coordinates.',
    '',
  ].join('\n'))
}

if (require.main === module) main()

module.exports = { asInline }
