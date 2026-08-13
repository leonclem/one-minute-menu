# Studio Generation Worker Queue Plan

## Purpose

Move the Studio **Generate** workflow from synchronous processing in the main Next.js application to a durable queue executed by the Railway Docker worker. This is a planning document only; it does not change the current implementation.

## Current behaviour

The Studio client submits generation through `POST /api/studio/mutate`. The main application currently performs the entire workflow inline:

1. Authenticates Studio access and validates the dish/source image.
2. Checks the dish breaker, daily generation limit, and available credits.
3. Builds the scene descriptor and canonical Gemini prompt.
4. Loads source image bytes and calls Gemini through `MutationEngine` / `NanoBananaClient`.
5. Runs soft post-generation Gemini extraction/validation.
6. Uploads the result, creates a `studio_images` record, debits credits, and updates the current dish image.
7. Returns the completed image in the original HTTP response.

This path has no job queue, worker dispatch, job ID, status polling, or durable progress record. Therefore Railway worker logs do not show Studio Generate activity; the worker is not involved.

## Target architecture

```text
Studio browser
  -> POST /api/studio/mutate
  -> validate and create immutable job snapshot
  -> insert studio_generation_jobs row (queued)
  <- 202 Accepted { jobId, status }

Railway worker
  -> atomically claim queued job
  -> load and validate source image
  -> Gemini image generation
  -> optional post-generation validation
  -> idempotently persist Studio image and finalize credit charge
  -> update dish current image and job state

Studio browser
  -> poll authenticated job-status endpoint
  -> render Queued / Generating / Complete / Failed
```

A dedicated `studio_generation_jobs` queue is recommended. Do not repurpose `image_generation_jobs`, which has menu-item-specific semantics, or `studio_export_variants`, which represents output formats rather than an editable Studio mutation. The existing Studio export worker queue is the closest reusable implementation pattern.

## Queue data contract

Create an additive Supabase migration for `studio_generation_jobs`. The domain row is also the queue record.

Required fields:

- Identity and ownership: `id`, `user_id`, `dish_id`, `source_image_id`.
- Immutable request snapshot: model, final composed prompt, target editor state, staged validation fields, sanitized extraction diagnostics, change summary, and expected credit cost.
- Queue state: `status` (`queued`, `processing`, `completed`, `failed`), `worker_id`, `priority`, `available_at`, `retry_count`, `started_at`, `completed_at`, `error_code`, and `error_message`.
- Result state: `result_image_id`, `result_image_url`, and output-validation summary.
- Idempotency: `idempotency_key`, unique per user.
- Audit state: `created_at`, `updated_at`, and the existing updated-at trigger pattern.

The migration should also include:

- A partial queue index for claimable `queued` rows ordered by priority then FIFO creation time.
- A stale-processing index.
- A partial unique active-job index to prevent concurrent generations for the same dish, unless product requirements intentionally permit multiple parallel revisions.
- User RLS for selecting only their own jobs. Clients must not insert, update, or delete queue rows directly.
- A `claim_studio_generation_job(worker_id)` RPC using `FOR UPDATE SKIP LOCKED`.
- A bounded `reset_stale_studio_generation_jobs(...)` recovery RPC.

## Idempotency and credits

A worker can crash after Gemini succeeds but before it records completion. Retrying must never create a second result image or debit a user twice.

Use the job ID as the durable idempotency boundary:

- Make generated-image persistence idempotent, either by preallocating the resulting Studio image ID or associating a deterministic result with the job ID.
- Refactor the current persistence path so a replay returns the prior completed result instead of generating a new random image ID/storage path.
- Finalize credit charging through an idempotent operation keyed by `studio_generation_job_id` (preferably an RPC/transaction or a unique ledger reference).
- Charge only after a durable output asset exists, preserving current billing behaviour.
- Reserve credit availability at enqueue time, then finalize the debit on completion. This prevents several queued jobs from independently passing a balance check and collectively exceeding the user balance.

## API changes

Initially retain `POST /api/studio/mutate`, but convert it into a fast enqueue endpoint that returns `202 Accepted` rather than a final image.

The enqueue route continues to perform the fast, authoritative checks:

- Studio authentication and access policy.
- Dish and source-image ownership.
- Dish circuit-breaker state.
- Daily-limit / credit-reservation checks.
- Request schema and directive validation.
- Style resolution, delta calculation, descriptor construction, and canonical prompt composition.

The API must no longer load image bytes, call Gemini, validate generated output, persist results, debit credits, or require the Gemini API key. Those actions belong solely to the worker.

Add a user-scoped status endpoint such as `GET /api/studio/mutate/{jobId}`. It should return job status, timestamps, retry count, completed result details, validation summary, credit outcome, and a user-safe error. It must not expose prompts, image bytes, provider credentials, raw provider error bodies, or stack traces.

Duplicate submissions with the same idempotency key should return the existing job instead of creating a second paid request.

## Worker implementation

Add a focused Studio generation executor to the existing Railway worker. Follow the existing Studio export executor and job processor conventions.

The executor should:

1. Atomically claim a queued Studio generation job.
2. Reload the job, dish, source image, and storage metadata using service-role access.
3. Revalidate the job's user/dish/source-image relationship, storage path, and MIME type. Worker job payloads are untrusted despite originating from the application.
4. Load source bytes from storage.
5. Call the existing `MutationEngine` / Gemini client using the stored prompt and selected model.
6. Run the current soft post-generation output validation.
7. Persist one idempotent generated Studio image linked to the job.
8. Finalize the single credit debit/reservation.
9. Set the dish's current image and reset its failure counter.
10. Mark the job completed with result and validation metadata.

The worker must classify errors consistently:

- Retry with exponential backoff: temporary Gemini failures, rate limits, timeouts, temporary storage/database failures, and other transient provider conditions.
- Fail terminally: invalid job/source state, missing or unauthorized source image, safety/content-policy blocks, insufficient credit at claim time, and other permanent domain/4xx failures.
- Preserve existing dish-breaker behaviour for billable provider failures.
- Recover stale `processing` jobs until the configured retry budget is exhausted.

## Worker scheduling

The existing poller is sequential: extraction, menu image generation, Studio export, then legacy export. Add Studio generation immediately after extraction and before generic menu image generation. Studio generation is interactive user-facing work and should not be starved behind a sustained menu-generation backlog.

Add the corresponding claim call, processor method, retry/terminal-failure handler, stale-recovery call, and queue metrics to the worker.

## Studio client changes

`submitPendingChanges()` currently awaits a final image response. Convert it to an asynchronous job experience:

1. Submit the generation and store the returned job ID.
2. Display `Queued` immediately, then `Generating` after the worker claims it.
3. Poll the status endpoint while status is non-terminal, following the robust polling approach already used by the Studio export panel.
4. On completion, append and select the result image, update the active source/current dish image, update the credit balance, and emit existing completion analytics.
5. On failure, display a user-safe message, update dish-blocked state where relevant, and offer a retry that creates a new idempotency key/job.
6. Rehydrate pending jobs on Studio page load so refreshing or closing a browser tab does not hide in-progress work.

## Observability and security

Use structured worker and API logs for each lifecycle step. Every entry should carry:

```text
job_id, user_id, dish_id, source_image_id, model,
status, retry_count, duration_ms, provider_error_code
```

Record job staged, claimed, Gemini started/completed, validation completed/skipped, result persisted, credits finalized, retry scheduled, terminal failure, and stale recovery. Do not log prompt text, image bytes, signed URLs, API keys, or raw provider error bodies. The migration provides an opportunity to replace current prompt-heavy diagnostics with correlated job logging.

Add queue/worker metrics and alerts for:

- Queue depth and age of the oldest job.
- Claim latency and end-to-end generation duration.
- Retry rate and terminal failure rate by error category.
- Stale recoveries.
- Completed jobs without a result image.
- Duplicate or failed credit-finalization anomalies.

## Test plan

Before enabling the queue, cover:

- Concurrent claims receive separate jobs; one job cannot be processed twice.
- Duplicate idempotency requests return a single job.
- RLS prevents users from reading another user's job.
- A successful job produces one Studio image and one credit debit.
- A replay after partial success does not duplicate an image or charge.
- Transient provider failures back off; terminal failures do not retry.
- Stale jobs requeue or fail after the retry limit.
- Client queued, processing, completed, failed, retry, and reload-recovery flows.
- User-scoped status endpoint behaviour.
- A staging end-to-end run: enqueue -> Railway claim -> completed image/current dish update/ledger entry, plus a forced provider failure.

## Safe rollout

1. Apply the additive migration first. Never reset or recreate the database for this change.
2. Deploy worker support while queue enqueueing remains disabled by a feature flag.
3. Verify Railway health, job claim logs, metrics, and stale recovery with controlled test jobs.
4. Enable the feature for internal/admin users, then a limited cohort.
5. Monitor queue age, completion rate, provider failures, and credit anomalies before broad release.
6. Keep the synchronous implementation available only behind an explicit rollback flag during rollout. Never execute a single user request through both flows, as this can double provider cost and credit charges.
7. If enqueueing is disabled, allow already queued jobs to drain or explicitly expose their state to support staff; do not silently abandon them.

## Relevant existing implementation references

- `src/app/studio/_components/studio-client.tsx`: current synchronous `submitPendingChanges()` workflow.
- `src/app/api/studio/mutate/route.ts`: current inline API generation, validation, persistence, and credit flow.
- `src/lib/photo-control/mutation-engine.ts` and `src/lib/nano-banana.ts`: Gemini generation path.
- `src/lib/studio/output-validation.ts`: soft post-generation validation.
- `src/lib/studio/persistence.ts`: generated image persistence.
- `src/app/api/studio/exports/route.ts` and `src/app/studio/_components/studio-export-panel.tsx`: existing enqueue/status-polling UI/API pattern.
- `src/lib/worker/job-poller.ts` and `src/lib/worker/job-processor.ts`: Railway worker scheduling and retry integration points.
- `src/lib/studio/export-executor.ts`: worker-side Studio execution and defense-in-depth pattern.
- `supabase/migrations/078_studio_export_variant_queue.sql`: closest queue-schema/claim/stale-recovery reference.
- `docs/BACKGROUND_IMAGE_JOBS_DEPLOYMENT.md`: deployment and worker operational guidance.

## Decisions to confirm before implementation

1. Should a dish permit only one active generation job, or should a user be able to queue several distinct edits simultaneously?
2. Should credit be formally reserved at enqueue time, and what is the cancellation/expiry policy for abandoned queued jobs?
3. What maximum queue wait time and generation duration are acceptable for the Studio UX?
4. Should a failed job's retry action create a new job only, or should some transient failed jobs be manually requeueable under the same job ID?
5. What retention period should apply to completed and failed job records?
6. Should Studio generation receive strict priority over menu image generation, or a fairness/concurrency quota to protect other workloads?
