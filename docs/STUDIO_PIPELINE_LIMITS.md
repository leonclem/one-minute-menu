# Studio Pipeline Limits (Gemini request/response)

Reference for every size, length, and count limit between a Studio upload and a generated
image, where each one is enforced, and why. Written 2026-08-19 after the `MAX_PROMPT_LENGTH_BY_TASK.edit`
investigation, which showed that an undocumented limit is indistinguishable from a bug.

**Rule of thumb for this document:** if a limit exists because Gemini, Supabase, or Vercel
imposes it, say so and cite the real ceiling. If it exists because we chose a number, say
that too. The [Limits with no recorded rationale](#limits-with-no-recorded-rationale) section
lists the ones we could not justify from the code or history.

## Where limits sit in the flow

```
browser file
  │  ① upload guards (MIME, 9 MiB, aspect)
  ▼
Supabase Storage ──► studio_images row
  │  ② extraction request  → gemini-2.5-flash
  ▼
raw extraction JSON
  ├──► ③ validator ──► metadata.editorState   (no length limits)
  └──► ④ diagnostics ──► metadata.extraction   (per-path limits + 64 KB bound)
  │  ⑤ scene descriptor + prompt composition
  ▼
prompt string ── ⑥ generation request → gemini-3.1-flash-image / gemini-3-pro-image
  ▼
⑦ image bytes ──► Storage + new studio_images row
```

---

## ① Upload guards (client, before any Gemini call)

| Limit | Value | Enforced in | On breach |
|---|---|---|---|
| MIME allow-list | `image/png`, `image/jpeg`, `image/webp` | `photo-control/image-uploader.ts` (`ALLOWED_MIME`), `photo-control/request-validation.ts` (`PHOTO_CONTROL_VALID_MIME_TYPES`) | Upload rejected client-side with the allowed list |
| File size | 9 MiB (`9 * 1024 * 1024`) | `PHOTO_CONTROL_MAX_IMAGE_BYTES`, re-checked server-side in `studio/image-bytes.ts` | Rejected; server path throws `StudioImageLoadError` (400) |
| Aspect elongation | longer ÷ shorter ≤ 3 | `studio/source-image-aspect.ts` (`MAX_SOURCE_ASPECT_ELONGATION`) | `SOURCE_ASPECT_REJECTION` message asking the user to crop |
| Prepare / upload / cleanup timeouts | 15 s / 90 s / 10 s | `studio/client-upload.ts` | Friendly timeout error; orphaned object best-effort deleted |

Reasoning that is recorded:

- **Aspect rail** — mutate preserves the source framing, so an extreme panorama is both
  unusable in the Workbench and not something the model will hold onto. The threshold of 3
  was chosen to accept every common phone ratio (square, 4:3, 3:4, 16:9, 9:16 ≈ 1.78) with
  headroom. 21:9 (≈ 2.33) is still under the rail. Reject only when the longer side is more
  than 3× the shorter side (true panoramas).
- **Direct-to-Storage upload** — exists because Vercel caps request bodies at 4.5 MB. That
  external limit is the reason the browser PUTs to a signed Storage URL instead of posting
  the file to an API route. It is *not* the reason for the 9 MiB number.
- **Server re-check** — the client cap is advisory; `image-bytes.ts` re-checks after
  downloading from Storage because the row could have been written by a different path.

---

## ② Extraction request (to `gemini-2.5-flash`)

Built in `photo-control/gemini-extraction-client.ts`.

| Setting | Value | Reasoning |
|---|---|---|
| Model | `gemini-2.5-flash` (`STUDIO_EXTRACTION_MODEL`) | Cheap, fast, supports structured output. Extraction is free to the user, so cost matters more than nuance. |
| `responseMimeType` | `application/json` | Forces parseable output instead of prose. |
| `responseSchema` | `EXTRACTION_RESPONSE_SCHEMA` | Constrains the model to the shape the validator expects; the enum fields below are the real limits. |
| `thinkingConfig.thinkingBudget` | `512` | **No recorded rationale.** See call-outs. |
| Image | inline base64, one image | Source photo only; no reference stack on the extraction path. |

Enum constraints in the response schema are hard limits on what the model may say. They are
defined once in `photo-control/minimal-schema.ts` and mirrored into the schema:

| Field | Allowed values |
|---|---|
| `scene_setup.angle` | 4 values (`ANGLE_VALUES`) |
| `scene_setup.framing` | 3 values (`FRAMING_VALUES`) |
| `scene_setup.spin` | 3 values (`SPIN_VALUES`) |
| `scene_setup.lighting` | 4 seeded keys (`bright-and-airy`, `low-key`, `studio`, `golden-hour`) |
| `*.colour` | `#RRGGBB` hex only |

Anything outside these is treated as invalid by the validator and logged as an omission
rather than passed through. There is **no length limit on `description` or on the material
strings in the request schema** — the model may return as much prose as it likes, and the
limits are applied afterwards.

### Structural limit: the schema only models food

`food_components` covers `main_item`, `garnishes`, and `sides`. Non-food items in the
photo — cutlery, napkins, hands, stray packaging — have no structured field, so they can only
appear inside the prose `description`. Generation directives forbid *adding* props, but there
is no symmetric structured path to *remove* props already in the upload. Extending the schema
would mean a new array plus validator, hydrator, state-delta, directive, control-panel, and
persistence changes, and would add pressure to the 64 KB diagnostics budget. Deliberately
deferred (2026-08-18) in favour of exploring a draw-to-remove eraser instead.

---

## ③ Validator → `metadata.editorState` (no length limits)

`photo-control/schema-validator.ts` coerces enums, trims whitespace, and drops invalid
values. It does **not** truncate strings. Whatever survives validation is persisted at full
length in `metadata.editorState` and is what the control panel edits.

This is deliberate and worth remembering: the truncation everyone trips over lives in
diagnostics (④), not in the editor state.

The critical asymmetry is that **`description` has no home in the editor state at all** —
`MinimalSchema` models only the structured control fields, so the model's prose observation
survives *only* in the diagnostics block. That makes the diagnostics string limits the sole
gate on how much observed detail can ever reach a prompt, which is why a number chosen for
metadata hygiene ended up governing generation quality.

---

## ④ Diagnostics → `metadata.extraction`

`studio/extraction-diagnostics.ts`. Applied at two call sites: `buildExtractionDiagnostics`
when extraction runs, and `sanitizeExtractionDiagnostics` when a stored block is read back
on the mutate/re-shoot path. Both end with `boundDiagnostics`.

Current version: `EXTRACTION_DIAGNOSTICS_VERSION = 3`. Version 1 and 2 blocks are treated as
stale by `extractionDiagnosticsNeedsRefresh`, which triggers re-extraction so images
uploaded under the old 120- then 800-character description limits pick up the longer one.
Opening a source image in Studio re-extracts once; generated variants are not refreshed by
this check.

### Per-value limits

| Value | Limit | Constant |
|---|---|---|
| `description` | 8000 chars | `OBSERVED_PATH_LIMITS.description` |
| `backdrop.material`, `backdrop.colour`, `surface.material`, `surface.colour` | 120 chars | `OBSERVED_PATH_LIMITS` |
| Any other observed string | 120 chars | `DEFAULT_STRING_LIMIT` |
| Array items (`garnishes`, `sides`) | 12 items × 80 chars | `MAX_ARRAY_ITEMS`, `ARRAY_ITEM_LIMIT` |
| Warnings | 16 entries; `path` 80 chars, `message` 160 chars | `safeWarning`, `.slice(0, 16)` |
| Whole block | 65536 | `EXTRACTION_DIAGNOSTICS_MAX_BYTES` |

Despite the name, the block bound counts **characters**, not bytes: `diagnosticsSize` is
`JSON.stringify(value).length`. For ASCII text the two coincide, but a description full of
accented characters or emoji consumes more real bytes than the check accounts for. Nothing
downstream depends on the true byte count, so this is a naming inaccuracy rather than a bug.

Every string also passes `safeText`, which replaces any run of 24+ base64-ish characters
with `[redacted]`. That guard is the one with a clear purpose: it stops an accidentally
echoed data URL from being persisted into metadata. It is independent of the length limits
and would still work without them.

`description` was raised from 120 to 800 (2026-08-19) because 120 characters is roughly one
clause — not enough to carry plating, portioning, or non-food props into a re-shoot prompt.
It was raised again from 800 to 8000 (2026-08-22) because 800 was still a hygiene number, not
a model limit, and was the field that actually starved generation quality. 8000 characters is
several paragraphs of observed detail and still sits comfortably under the 64 KB block bound
and the 100k prompt ceiling.

### Degradation ladder (`boundDiagnostics`)

If the block exceeds 64 KB it is shrunk in this order, returning as soon as it fits:

1. Warnings truncated to 8.
2. `description` cut to 4000, then 2000, then 800, then 400, then 200, then 100, then 50.
3. `garnishes`/`sides` capped at 8, then 4, then 2, then 0 items.
4. Observation sections dropped in `dropObservationSections` order — garnishes, sides,
   backdrop colour, surface colour, backdrop material, surface material, canvas background,
   spin, angle, framing, lighting.
5. `observations` emptied entirely.

The ordering encodes what is expendable: prose first, then decorative arrays, then
descriptive material, and the control-state-bearing scene fields last. Degrading beats
failing — a diagnostics block that cannot be written would break the upload, while a
shortened one only costs prompt richness.

---

## ⑤ Prompt composition (`photo-control/prompt-composer.ts`)

| Limit | Value | Notes |
|---|---|---|
| `MAX_PROMPT_LENGTH_BY_TASK.edit` | 100000 chars | Shared rogue-construction tripwire. Ours, not a model limit. |
| `MAX_PROMPT_LENGTH_BY_TASK.reshoot` | 100000 chars | Same ceiling as edit. Overflow is trimmed, not rejected. |
| `MIN_DESCRIPTION_LENGTH` | 50 chars | Floor below which a trimmed description stops being useful. |
| Directive size switch | 500 chars | Triggers three behaviours at once — see below. |

The 500-character directive threshold is doing more than it looks. Above it,
`normalizeDirective` de-duplicates repeated sentences, and on the legacy path (no explicit
descriptor) the directive moves into `descriptor.instruction` instead of its own
`Requested directive:` line, while the descriptor JSON switches from indented to compact.
A separate 500-character check on the serialized descriptor controls the same indentation
choice. These are space-saving measures from the era of the 2492-character cap; with a 100000
ceiling they mostly change prompt formatting rather than fit, and are worth revisiting as a
group rather than individually.

`trimDescriptionToFit` halves `subject.description` until the composed prompt fits the
task's ceiling, using the actual directive for the size estimate. `subject.description` is
the only expendable field in the descriptor — everything else is an identity lock or a
staged instruction — so it is the only thing that degrades. If the prompt still does not fit
after trimming to the floor, composition fails with `COMPOSITION_FAILURE` and the route
returns 400 without debiting credits.

### The real Gemini ceiling, for calibration

Flash Image accepts ~131k input tokens and Pro Image ~64k, which is on the order of
260k–520k characters of text *before* counting the reference image. Our 100k-character
ceiling is a runaway-construction tripwire (~25-50k text tokens), still below both model
windows after the source photo is attached. It exists to catch a bug, not to satisfy the API.

### Cautionary note: the 2492 limit

`edit` was capped at 2492 characters until 2026-08-19. That number was not from Google — it
was the length of a test fixture's prompt, frozen into a constant and then treated as an API
constraint by everyone who read it. Once the diagnostics description grew to 800 characters,
previously working edits started failing composition. The cap was raised to 20000 as a
plausible sanity ceiling, then to a shared 100000 for edit and reshoot on 2026-08-22 when
the 20000/6000 split was recognised as leftover from that same misconception. **Any new
limit added to this pipeline should be documented here with its origin at the moment it is
introduced.**

---

## ⑥ Generation request (to `gemini-3.1-flash-image` / `gemini-3-pro-image`)

Built in `nano-banana.ts`; capabilities resolved in `studio/model-config.ts`.

| Setting | Value | Reasoning |
|---|---|---|
| `candidateCount` | `clamp(number_of_images, 1, 4)` | Studio always requests 1. The clamp protects the shared client from other callers. |
| `responseModalities` | `['IMAGE']` | Text output is never wanted on this path. |
| `imageConfig.imageSize` | `STUDIO_IMAGE_SIZE`, default `2K` | Studio's export sizes need the larger render. |
| `imageConfig.aspectRatio` | omitted on the Studio path unless explicitly set | Mutate preserves source framing; sending a ratio would fight the reference image. Non-Studio callers default to `1:1` and `1k`. |
| `thinkingConfig.thinkingLevel` | `STUDIO_THINKING_LEVEL`, default `high` | Only sent to Flash models — `modelSupportsThinkingLevel` excludes Pro, which rejects it. |

`safety_filter_level: 'block_some'` and `person_generation: 'dont_allow'` are set by
`mutation-engine.ts` but are **not** API request fields. `nano-banana.ts` turns them into
prompt text: `person_generation` appends `"No people in the image."`, and
`safety_filter_level` appends a `"Content safety: …"` line that the Studio path deliberately
suppresses. `validateParams` restricts both to their documented enums, so a typo fails fast
rather than silently changing the prompt.

Those suffixes, along with `negative_prompt` and the non-Studio aspect-ratio line, are
appended **after** `composePrompt` has already checked its budget, so they are not counted
against `MAX_PROMPT_LENGTH_BY_TASK`. The overrun is tens of characters against a 100000
ceiling, so it does not matter today, but a future caller adding a large suffix here would
bypass the composer's accounting entirely.

### Reference image limits

Real model capabilities, from `REFERENCE_LIMITS`:

| Family | total | style | object | character | high-fidelity |
|---|---|---|---|---|---|
| `pro` | 14 | 3 | 14 | 14 | 5 |
| `flash` | 10 | 0 | 10 | 4 | 0 |
| `legacy` | 3 | 3 | 3 | 3 | 3 |

These mirror Google's documented per-model capacities, so they are the one limit table in
this document that is genuinely external. `STUDIO_MAX_REFS` can lower them but is clamped to
the documented value and logs a warning if it tries to exceed it. Studio's mutate and
re-shoot paths attach exactly one reference — the source photo — so the caps are headroom
rather than a constraint today.

---

## ⑦ Rate, quota, and product limits

| Limit | Default | Env override | Enforced in |
|---|---|---|---|
| Generations per user per day | 25 | `STUDIO_DAILY_GENERATION_LIMIT` | `studio/persistence.ts` → 429 |
| Billable failures per dish before block | 5 | `STUDIO_DISH_FAILURE_LIMIT` | `studio/generation-failures.ts` → dish blocked until an admin clears it |
| Credits per generation | 1 Flash / 2 Pro | `STUDIO_CREDIT_COST_NB2`, `STUDIO_CREDIT_COST_NB_PRO` | `studio/credits.ts` |
| Credits per export | 1 AI expand / 1 cutout | `STUDIO_CREDIT_COST_EXPORT_AI`, `STUDIO_CREDIT_COST_EXPORT_CUTOUT` | `studio/credits.ts` |
| Staged control changes per apply | 3 | — | `photo-control/edit-limits.ts` (`MAX_PENDING_CHANGES`) |

The daily and per-dish limits are cost controls, and the failure counter specifically guards
against a pathological source photo burning credits in a loop. `MAX_PENDING_CHANGES` is a
quality guardrail: more simultaneous changes make the model drift from the source, and the
Studio UI now warns rather than hard-blocks (with a "don't show again" option).

---

## Limits with no recorded rationale

These work, but nobody has written down why the specific number was chosen. Treat each as a
candidate for either justification or removal — not as a constraint to design around.

| Limit | Value | Why it is unclear |
|---|---|---|
| Extraction `thinkingBudget` | 512 | No note on where 512 came from or what quality/cost trade-off it represents. Untested against 0 or a higher budget. |
| `EXTRACTION_DIAGNOSTICS_MAX_BYTES` | 65536 | Nothing in Postgres or Supabase forces 64 KB; JSONB fields tolerate vastly more. Raised from 8192 on 2026-08-22 as a runaway-metadata tripwire. The degradation ladder still exists to serve this number. |
| `DEFAULT_STRING_LIMIT` | 120 | The stated goals (no secrets, bounded rows) are already met by base64 redaction and the 64 KB bound. 120 was the value that silently starved the description field for months; description now has its own 8000-character path. |
| `ARRAY_ITEM_LIMIT` / `MAX_ARRAY_ITEMS` | 80 / 12 | No rationale. A dish with 13 garnishes silently loses the rest. |
| Warning caps | 16 entries, 80/160 chars | No rationale. |
| `MIN_DESCRIPTION_LENGTH` | 50 | Inherited from the original re-shoot trim loop. 50 characters is likely below the point where the text helps at all. |
| Directive/descriptor 500-char switches | 500 | Three separate behaviours keyed off the same unexplained number, all inherited from the 2492-cap era. |
| Upload cap | 9 MiB | Why 9 and not 10 or 20 is unrecorded. Gemini's inline-data request ceiling should be confirmed before treating 9 MiB as safe headroom rather than an arbitrary round-down. |
| Non-Studio `imageSize` default | `1k` | Inconsistent with Studio's `2K`. Fine if intentional for menu generation, but the divergence is undocumented. |
| `MAX_SOURCE_ASPECT_ELONGATION` | 3 | The *reason* is documented; the *threshold* is a judgement call with no test against real rejections. |

## Adding or changing a limit

1. Put the constant in the module that owns the stage, not at a call site.
2. Write a comment saying whether the number is external (Gemini/Supabase/Vercel) or ours.
3. Prefer graceful degradation over rejection for anything on the user's happy path.
4. Assert the constant in tests by importing it — never hard-code the number in an
   expectation, which is how 2492 became load-bearing.
5. Update the tables above in the same commit.

## Related documents

- `docs/pivot/IMAGE_PIPELINE_NOTES.md` — pipeline topology, routes, and credit-cost background (historical).
- `docs/EXTRACTION_ADMIN_GUIDE.md` — operator view of extraction diagnostics.
