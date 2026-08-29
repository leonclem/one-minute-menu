# Studio object-edit Task 16 runbook

## Supported delivery scope

The current delivery supports **Remove only**. Task 12 recorded `go` for Remove using the canonical-plus-spatial-enrichment approach and `no-go` for Move. Move remains excluded: do not add Move placement UI, destination analytics, Move accessibility evidence, or a Move release control. The Remove API and UI must continue to fail closed when its operation decision or audience control is absent, malformed, non-`go`, or disabled.

Spatial Inventory is secondary evidence. It is validated and persisted separately from canonical `data`, and read, matching, reconciliation, and persistence failures remain soft. Clean Image A, annotated Image B, and the accepted normalized Remove selection remain authoritative. Provider visual quality is evidence for human review, not an automated score or threshold decision.

## Security and privacy controls

- Authenticate before parsing resource-dependent input or accessing a dish, source image, storage bytes, provider, persistence, debit, or success analytics.
- Validate the authenticated user's dish/source relationship and reject cross-user, cross-dish, and archived sources before loading bytes.
- Enforce the object-edit body limit using both the declared length (when usable) and the actual UTF-8 request body length. Reject strict unknown keys.
- Keep evidence and operation-control tables service-role-only through RLS. Reviewer/control mutations require an authorized administrator and are written through audited, operation-keyed RPCs.
- Structured object-edit diagnostics allow only request/user/dish/image identifiers, operation, model class, stage, duration, bounded codes, persistence stage, and coarse soft-failure classifications. Never log bytes, URLs, prompts, labels, canonical or spatial JSON, complete coordinates, reviewer rationale, or raw provider responses.
- A rejected Remove submission must not invoke the provider, create a generated row or Child Variant, debit credits, or record generation-success analytics.

## Migrations, rollout, and rollback

Migrations are additive. Apply pending migrations with `npx supabase db push` or apply a specific migration directly with the approved Supabase query workflow. Never use a database reset, truncate, destructive delete, or recreate command.

To roll back Remove, disable its independent `internal_enabled` and/or `production_enabled` operation control through the authorized control path. This is reversible and leaves Move's decision/control unchanged. Existing Studio generation and extraction data remain readable. If storage staging outlives a failed child commit, use the existing storage-compensation/orphan diagnostic path; do not delete database data as a cleanup shortcut.

## Spike and evidence review

Spike execution is bounded and records operation/model-specific evidence, immutable artifact digests, outcomes, and qualitative observations. A reviewer records the operation-specific decision and Spatial Usefulness Finding only after reviewing the linked evidence. Scores, averages, and thresholds must not create or suggest `go`/`no-go` decisions. Remove and Move evidence and decisions remain independent; this delivery does not seek a Move decision or release.

## Verification

Run non-watch checks from the repository root:

```text
npx jest --runInBand src/lib/studio/object-edit
npx jest --runInBand src/app/api/studio/__tests__/object-edit-route.test.ts src/app/studio/_components/studio-object-edit.test.tsx src/app/studio/_components/studio-workbench-canvas.test.tsx
npx jest --runInBand src/lib/studio/object-edit/__tests__/task16-security.test.ts scripts/__tests__/validate-studio-object-edit-traceability.test.js
npm run validate:studio-object-edit-traceability
npm run report:studio-object-edit-traceability
npx tsc --noEmit
npm run build
```

The report command emits a human-readable requirement-level traceability report from `.kiro/specs/studio-object-selection-remove-move/traceability.json`. Keep the registry links and latest verification result current; do not modify the approved requirements or design to make a check pass.
