# Build Plan — Chunk 4: Background & Lighting Reference Libraries

**Requirements refs:** §7.4, §7.5, §6.4, §10 Phase 3.

**Branch:** `studio/chunk-04-reference-libraries`

**Goal:** Replace hardcoded lighting tiles and add background/surface swapping via
admin-managed, DB-backed reference libraries. Studio users pick visual styles;
prompt fragments resolve server-side. Still behind `NEXT_PUBLIC_ENABLE_PHOTO_STUDIO`.

## Decisions for this chunk

1. **DB-backed admin-managed libraries.** `studio_lighting_styles` +
   `studio_background_styles` with RLS (authenticated read of active rows;
   admin-only write). Matches requirements Phase 3.
2. **Lighting leaves the fixed enum.** `scene_setup.lighting` becomes a
   style-key string so admins can add styles without a schema deploy. Add
   editable `canvas.background_style` (key); keep free-text `canvas.background`
   as the extracted source description (non-editable).
3. **Prompt fragments stay server-side.** Customer `GET /api/studio/styles`
   returns display fields only. `/api/studio/mutate` resolves fragments +
   negative constraints and merges them into the directive (§5.1).
4. **FOH omits lighting/background from client directive** via
   `generateDirective(..., { excludePaths })`. Admin Photo Control sandbox
   retains the existing hardcoded `buildLightingClause` path (consolidation
   deferred).
5. **Thumbnails are static paths** under `public/studio/controls/`; admin
   upload UI deferred.

## Scope

1. Migration `073_studio_reference_libraries.sql` — tables, RLS, indexes, seed
   of 6 lighting + 8 background styles from the requirements doc.
2. `src/lib/studio/reference-libraries.ts` + types; customer + admin APIs.
3. Engine: schema, state-delta, directive-generator, change-summary, restage.
4. Mutate route: server-side fragment resolution + clause merge.
5. FOH: Background section + lighting tiles from DB; preview PNGs.
6. Minimal admin CRUD UI for both libraries.
7. Tests + tracker + pending deploy backlog.

## Out of scope

- Admin thumbnail upload UI.
- Plating/vessel library (Phase 7).
- Output/crop presets.
- Credits (Phase 5).
- Production deploy.
- Consolidating admin Photo Control onto the DB style path.

## Acceptance criteria

- [x] Admin can list/create/update/deactivate lighting and background styles.
- [x] Authenticated Studio user sees active lighting + background style tiles.
- [x] Selecting a background stages a change and generates without altering the dish identity locks.
- [x] Lighting styles beyond the original 3 work via DB keys + prompt fragments.
- [x] Customer styles API never returns `prompt_fragment` / `negative_constraints`.
- [x] Admin Photo Control sandbox still works on its enum path.
- [x] Tests pass; tracker + pending deploy backlog updated in the same commits.
