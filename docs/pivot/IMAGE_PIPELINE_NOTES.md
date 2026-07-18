# Image Generation Pipeline Notes (for Photo Studio)

Documented as part of Chunk 1 / Phase 0. Use this when building the customer-facing
`/studio` surface (Chunk 2). Live E2E verification of `/admin/photo-control` in a
running dev server remains a manual smoke check (see below).

## Two pipelines

| Pipeline | Who uses it | Persistence | Entry |
|---|---|---|---|
| **Photo Control (sandbox)** | Admin only today | In-session data URLs only — **not** written to Storage | `/admin/photo-control` |
| **Menu image generation** | Dashboard / menu items | `ai-generated-images` bucket + `ai_generated_images` / `image_generation_jobs` | `POST /api/generate-image` → worker |

Chunk 2 must either persist Photo Control outputs into Storage (preferred for the
studio library) or wrap the mutate path so outputs land in the same bucket/table
model as menu images.

---

## Photo Control flow (current sandbox)

### Client

`src/app/admin/photo-control/_components/photo-control-client.tsx`

1. Upload → `validateAndAcceptImage` (`src/lib/photo-control/image-uploader.ts`)
2. Extract → `POST /api/admin/photo-control/extract`
3. Hydrate editor state → `hydrate()` (`hydrator.ts`)
4. Stage control changes locally (max `MAX_PENDING_CHANGES` = 3)
5. On apply: `computeDelta` → `generateDirective` → `POST /api/admin/photo-control/mutate`
6. Mutated image returned as **data URL**; becomes new in-memory source; session prompt count increments

### Server routes (admin-gated)

| Route | File | Role |
|---|---|---|
| `POST /api/admin/photo-control/extract` | `src/app/api/admin/photo-control/extract/route.ts` | Gemini vision → MinimalSchema JSON |
| `POST /api/admin/photo-control/mutate` | `src/app/api/admin/photo-control/mutate/route.ts` | Compose prompt + call MutationEngine |

Both require `requireAdminApi()` and `NANO_BANANA_API_KEY`. Max image ~7 MB; MIME png/jpeg/webp.

### Prompt / state stack (`src/lib/photo-control/`)

| Module | Responsibility |
|---|---|
| `minimal-schema.ts` | Editor state shape (angle, lighting, vessel, garnishes, sides, …) |
| `schema-validator.ts` | Coerce / validate extraction JSON |
| `hydrator.ts` | Turn extraction into editable EditorState |
| `state-delta.ts` | Diff original vs target; count editable changes |
| `directive-generator.ts` | Human-readable instruction from delta |
| `prompt-composer.ts` | Directive + JSON anchors → model prompt (≤ ~2000 chars) |
| `mutation-engine.ts` | Calls `getNanoBananaClient().generateImage(...)` with source as inline dish reference |
| `gemini-extraction-client.ts` | Extraction LLM call |
| `edit-limits.ts` | `MAX_PENDING_CHANGES` |

### Models (Photo Control UI)

From the client model selector:

- Default: `gemini-3.1-flash-image-preview` (Nano Banana 2)
- Escalation: `gemini-3-pro-image-preview` (Nano Banana Pro)

`MutationEngine` defaults to flash unless the request overrides `model`.

### Gap for Chunk 2

- Outputs are **data URLs only** — no Supabase Storage upload, no DB row, lost on refresh.
- Routes are **admin-only** — FOH needs authenticated-user (non-admin) endpoints or a shared service layer with its own auth.
- Session “AI prompts this session” counter is admin sandbox UX, not credits.

---

## Menu image generation flow (production path)

1. `POST /api/generate-image` (`src/app/api/generate-image/route.ts`) — enqueues `image_generation_jobs` (does not call Gemini on the web request path when the background pipeline is used).
2. Worker: `src/lib/image-generation/job-executor.ts` → `getNanoBananaClient().generateImage()`.
3. Processing/upload: `src/lib/image-processing.ts` → bucket `ai-generated-images`, path pattern `{userId}/{imageId}/original_*.jpg` (+ thumbnail/mobile/desktop/webp/jpeg variants).
4. Prompt construction for menus: `src/lib/prompt-construction.ts` (separate from Photo Control).

Kill-switches:

- `AI_IMAGE_GENERATION_DISABLED=true` — backend 503 / skip
- `NEXT_PUBLIC_AI_IMAGE_GENERATION_DISABLED=true` — hide Create Photo in UI
- Cut-outs: `CUTOUT_GENERATION_DISABLED` via `src/lib/background-removal/feature-flag.ts`

---

## Cost assumptions (seed for credits)

Existing rough figure in `src/lib/quota-management.ts`: **~$0.02 per image** for menu generation estimates. Treat as a planning placeholder only.

Photo Studio credit pricing should differentiate:

| Model | Internal label | Relative cost (product decision) |
|---|---|---|
| Gemini 3.1 Flash Image / NB2 | Standard | Baseline credit cost |
| Gemini 3 Pro Image / NB Pro | High quality | Higher credits (confirmed decision 2026-07-17) |

Alert thresholds (optional): `GENERATION_ALERT_DAILY_USD`, `GENERATION_ALERT_MONTHLY_USD` in `env.example`.

---

## Manual smoke check (operator)

When the local app is running with a valid `NANO_BANANA_API_KEY` and an admin session:

1. Open `/admin/photo-control`
2. Upload a food photo → wait for extract/hydrate
3. Stage one lighting change (e.g. Low-Key)
4. Apply / generate → confirm output preview appears
5. Confirm Admin hub still links to Photo Control

**Status (Chunk 1):** Pipeline mapped from code as above. Live smoke check not executed in this session (requires running app + API key + admin login). Run before merging Chunk 2 work that depends on mutate behaviour.
