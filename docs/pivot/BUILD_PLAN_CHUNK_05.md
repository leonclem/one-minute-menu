# Build Plan — Chunk 5: Controlled Prompt/State Layer

**Requirements refs:** §5.2, §6.3, §7.2 (`image_edits` / validation storage), §10 Phase 4.

**Branch:** `studio/chunk-05-prompt-state-layer`

**Goal:** Make Studio generations more defensible by closing the loop on structured
state: strengthen identity-lock defaults, re-analyse generated outputs into the same
MinimalSchema JSON used for sources, compare source→output, persist a validation
summary, and soft-flag obvious failures — still behind `NEXT_PUBLIC_ENABLE_PHOTO_STUDIO`.

Much of Phase 4 already exists in `src/lib/photo-control/` (extract → validate →
hydrate → delta → directive → compose → mutate) and `studio_images.metadata.editorState`.
This chunk adds the **missing post-generation validation half** and tightens §5.2
preservation language.

## Decisions proposed for this chunk

Record in the tracker Decisions log when implementing (or adjust if rejected):

1. **No `image_edits` table yet.** Store validation on
   `studio_images.metadata.validation` (same pattern as `editorState` /
   `changeSummary`). Defer a dedicated edits ledger until credits/Phase 5 needs
   cost accounting per edit, or until validation history outgrows JSONB.
2. **Sync post-mutate re-extract.** After a successful Studio generate, run the
   existing Gemini extraction client on the output image, score against the
   **target** editor schema (what we asked for) and/or source schema, and attach
   results before the mutate response returns. Extra extract cost per generation
   is acceptable for private beta quality; gate with
   `STUDIO_OUTPUT_VALIDATION_ENABLED` (default `true` when unset).
3. **Soft-flag only.** Failed or low scores never block download, library save, or
   further edits. Persist `status: 'pass' | 'warn' | 'fail'` + dimension notes;
   surface a light FOH indicator on the Current/variant strip; richer detail can
   stay in metadata (admin Photo Control optional later).
4. **Heuristic schema compare, not a second vision “judge” model.** Compare
   extracted MinimalSchema fields (main item, vessel, garnish/side counts,
   forbidden-ish extras via component lists, lighting/background keys when
   present). Keep the scorer pure/unit-testable; no new model call beyond the
   re-extract.
5. **Strengthen identity locks in the directive** to match §5.2 defaults more
   explicitly (ingredient/component count, vessel unless changed, colours/textures,
   no unsolicited props/hands/text/cutlery). Keep the clause compact; do not
   reintroduce the old hard character cap.
6. **Admin Photo Control:** optionally run the same validation helper when useful
   for parity, but FOH `/api/studio/mutate` is the required integration path this
   chunk.

## Scope

### 1. Identity preservation (§5.2)

- Review `buildIdentityPreservationClause` (and related “leave unchanged” language)
  against the §5.2 default list.
- Expand the always-on preservation clause where gaps are clear; add/adjust unit
  + property tests that lock the new wording/keywords.
- Do **not** change FOH control surface in this item (no new toggles).

### 2. Output analysis + equality scoring

New focused module(s) under `src/lib/photo-control/` (keep files lean), e.g.:

- `output-validator.ts` — pure compare of `MinimalSchema` (source and/or target)
  vs extracted output schema → `{ status, score, dimensions[], summary }`.
- Dimensions aligned to Phase 4 list, implemented only where schema fields exist:
  - dish identity (main item / core food wording)
  - item count (garnishes + sides length / presence)
  - vessel consistency (`canvas.main_vessel` or equivalent)
  - background/prop additions (unexpected components / clutter signals if present)
  - lighting / background style keys when those fields are populated
  - framing notes only if extract already exposes useful signals (otherwise skip
    or mark `not_evaluated`)
- Reuse `gemini-extraction-client` + `schema-validator` + `hydrate` path for the
  output image (no parallel extraction stack).

### 3. Persist + wire into Studio mutate

- After persist of the generated `studio_images` row (or in the same metadata
  write), attach:
  - `metadata.validation` — scorer result
  - `metadata.editorState` — already done; ensure output extract’s hydrated state
    is available if we choose to store `metadata.outputAnalysis` / reuse
    `editorState` as the post-gen working state (prefer one clear convention;
    document in code comments + tracker).
- Env: `STUDIO_OUTPUT_VALIDATION_ENABLED` in `env.example` (+ production example
  if that file lists Studio vars). When `false`, skip re-extract and omit
  validation metadata (generation still succeeds).
- Mutate response may include a compact `validation` object for the client
  (status + short summary only; not full schema dumps).
- Failures in validation itself (extract timeout/error) → log +
  `status: 'skipped'` / soft warn; **never** fail the user’s generation.

### 4. FOH signal (minimal)

- On `/studio`, when Current (or a variant) has `metadata.validation.status` of
  `warn`/`fail`, show a small non-blocking indicator (e.g. text/status near
  Current actions — not a hero badge collage).
- No auto-retry, no blocking modal. Optional one-line summary from metadata.

### 5. Tests

- Unit tests for scorer: identity mismatch → fail/warn; matching schemas → pass;
  vessel change when vessel was not in the delta → warn/fail; empty/partial
  schemas → safe `not_evaluated` / skip dimensions.
- Mutate route test: when validation enabled, metadata includes validation;
  when disabled or extract throws, generation still returns 200 with image.
- Directive / identity-clause tests updated for §5.2 wording.
- No live Gemini calls in unit tests (mock extraction client).

### 6. Docs / tracker / deploy backlog

- Update `PIVOT_TRACKER.md`: Phase 4 row → Built (or In progress→Built at end);
  §5.2 status; chunk log; Decisions log for the six items above.
- Append `PENDING_PRODUCTION_DEPLOY.md` Pending row for
  `STUDIO_OUTPUT_VALIDATION_ENABLED` (and any smoke note for validation).
- Light touch on `IMAGE_PIPELINE_NOTES.md` or best-practices only if needed to
  describe the post-gen validation step (avoid large doc rewrites).

## Out of scope for this chunk

- `image_edits` table / cost_credits columns (Phase 5 adjacency).
- Credits ledger or changing `STUDIO_DAILY_GENERATION_LIMIT` behaviour.
- Clutter-removal FOH control (§7.7 remainder).
- Crop / output packs (§7.8–7.9).
- Plating/vessel library (§7.6).
- Hard-failing or auto-discarding generations.
- Second “judge” LLM beyond re-extract.
- Production deploy.
- Full admin validation analytics UI.
- Consolidating admin Photo Control onto DB lighting/background path (still deferred).

## Acceptance criteria

- [x] Identity-preservation directive covers §5.2 defaults more explicitly; tests lock it.
- [x] Successful Studio generate can re-extract the output and persist
      `metadata.validation` with pass/warn/fail (or skipped).
- [x] Validation failures never prevent save/download/further edits.
- [x] `STUDIO_OUTPUT_VALIDATION_ENABLED=false` skips re-extract cleanly.
- [x] FOH shows a minimal non-blocking indicator for warn/fail.
- [x] Scorer is unit-tested without live model calls; mutate tests cover enabled/disabled/error paths.
- [x] Tracker + pending deploy backlog updated in the same commits as the work.
- [x] Admin Photo Control generate path remains usable (no regression); Studio flag gating unchanged.

## Estimated shape

Roughly: 1–2 new lib modules + tests, mutate route wiring, small FOH indicator,
env example + pending deploy row, tracker/docs updates. **No DB migration** expected
(JSONB metadata only). One new optional env var.
