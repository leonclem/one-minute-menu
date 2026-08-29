# Studio object-edit Task 17 validation

Validated on 2026-08-28 against the approved delivery scope: **Remove only**. Task 12 recorded Remove `go` for approach C and Move `no_go`; Move is not delivery-ready and no Move release control was enabled.

## Automated results

- Targeted Remove/shared object-edit validation: **43 suites passed, 133 tests passed**.
  - Includes all `src/lib/studio/object-edit/__tests__` unit/property suites, the object-edit route and UI/workbench tests, provider/mutation contract suites, shared generation/finalization/evidence/ownership tests, and migration/security/traceability tests.
- Property run-count inspection: applicable object-edit and object-edit provider property suites use `numRuns: 100`.
- Full repository Jest regression run after the compatibility fixes below: **452 suites passed, 4322 tests passed, 40 tests skipped, 4 snapshots passed**.
- `npx tsc --noEmit`: **passed**.
- `npm run build`: **passed**. Production-safety and traceability validation also passed during the build.
- `npm run validate:studio-object-edit-traceability`: **324 acceptance criteria validated**.
- `npm run verify:studio-object-edit-local-db`: **passed 11 checks**.

## Local database verification

The local Supabase instance at `127.0.0.1:54322` was used inside a transaction that is rolled back at the end. The verifier confirmed:

- object-edit tables and the atomic commit RPC exist;
- control, audit, and evidence tables have RLS enabled;
- review/control RPCs are executable by `service_role` and denied to `anon` and `authenticated`;
- Remove and Move are independently seeded fail-closed;
- Remove can be enabled without changing Move;
- rollback disables only Remove controls and leaves Move unchanged;
- every control update appends an audit event and audit rows cannot be updated;
- missing and malformed controls fail closed;
- atomic child commit failure leaves no generated child or dish-state partial;
- the verification transaction leaves no fixture, control, or audit changes behind.

The first generic `npx supabase db push --local --yes` attempt stopped at pre-existing migration 079 because it tried to create an already-existing policy. No reset, truncate, destructive delete, or database recreation was used. The object-edit schema was already present locally; migration 089 was applied directly through the approved additive local migration path so the live privilege checks matched the migration. The unrelated 079 migration-history drift remains documented rather than “fixed” by destructive commands.

Storage compensation was covered by the passing `finalize-generation-atomic.test.ts` suite; no generated storage object or database fixture was left by the local verifier.

## Compatibility fixes made during validation

- Updated the existing Studio request regression assertion to verify the redacted `promptHash` rather than a removed raw `promptText` log field, and raised that property’s run count to 100.
- Updated the analytics registry test count to include the nine existing Studio object-edit events (55 total entries).

These changes do not enable Move or authorize production availability. Remove remains subject to the separate Task 18 production release checkpoint and explicit operation-specific control authorization.
