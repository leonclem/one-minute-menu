# Background Image Jobs Deployment Plan

This runbook covers the rollout details specific to moving **batch and single** image generation onto the Railway worker. The web app enqueues `image_generation_jobs` rows; the worker runs Nano Banana, storage, menu sync, cutout requests, and drains pending cutouts. Use it alongside the standard app and worker deployment checklists.

## Release Order

1. Apply Supabase migrations through `supabase/migrations/065_image_generation_worker_queue.sql` before releasing code that submits background image jobs.
2. Verify the migration added the queue columns, active-job index, and `claim_image_generation_job(TEXT)` RPC:
   - `image_generation_jobs.menu_id`
   - `image_generation_jobs.batch_id`
   - `image_generation_jobs.worker_id`
   - `image_generation_jobs.available_at`
   - `image_generation_jobs.priority`
   - `idx_gen_jobs_one_active_per_menu_item`
   - `claim_image_generation_job(TEXT)`
3. Confirm the `ai-generated-images` storage bucket exists and still accepts worker service-role uploads.
4. Keep `AI_IMAGE_GENERATION_DISABLED=true` on the web app if the app deployment must happen before the Railway worker is updated.
5. Deploy the Railway worker with the new image-job code and environment variables.
6. Deploy or enable the web app batch submission path once the worker is healthy and able to claim jobs.

Do not reset the database as part of this rollout. For linked environments, prefer Supabase's normal forward-only migration flow, such as `npx supabase db push`.

## Railway Environment Audit

Required for both export jobs and image generation jobs:

- `SUPABASE_URL`: production Supabase API URL.
- `SUPABASE_SERVICE_ROLE_KEY`: production service role key. This must only be present in server and worker environments.
- `STORAGE_BUCKET`: existing export storage bucket, normally `export-files`, because the same worker still processes exports.
- `WORKER_ID`: stable unique ID for this Railway service, for example `worker-1`.
- `NODE_ENV=production`.
- `LOG_LEVEL=info`.
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.

Required for image generation:

- `NANO_BANANA_API_KEY`: Google/Gemini image generation key used by `getNanoBananaClient()`.
- `NANO_BANANA_BASE_URL`: optional override only if the default Gemini image endpoint should not be used.
- `NEXT_PUBLIC_SUPABASE_URL`: production Supabase public URL, used by worker-side image URL handling (signed URL translation).
- `SUPABASE_INTERNAL_URL` or `WORKER_SUPABASE_URL`: optional Docker-internal networking override. Only needed if running the worker in Docker locally and it cannot reach `SUPABASE_URL` via `localhost`. Not required for production Railway deployments.
- `CUTOUT_GENERATION_DISABLED`: set to `true` if cutout/background removal should not run during the first rollout.
- `BACKGROUND_REMOVAL_PROVIDER=replicate`: required if cutout generation remains enabled.
- `REPLICATE_API_TOKEN`: required when `BACKGROUND_REMOVAL_PROVIDER=replicate`.
- `REPLICATE_BACKGROUND_MODEL`: optional Replicate background-removal model override.

**Cutouts:** After each successful image generation job, the Railway worker runs `processPendingCutouts()` so pending cutout rows are processed without relying on Vercel Cron. Keep `GET/POST /api/admin/cutout-worker` as a manual or cron **fallback** if you want redundancy; you may disable the cron once Railway cutout draining is verified in production.

Required or useful on the web app side:

- `NANO_BANANA_API_KEY`: **not** required on the web app for user-facing `/api/generate-image` or `/api/image-generation/batches` (those routes only enqueue jobs). The key must be present on the **Railway worker** where generation runs. Admin-only routes that still call the model directly may require the key on the app server.
- `AI_IMAGE_GENERATION_DISABLED`: set to `true` to pause new single and batch generation requests; remove or set to `false` after validation.
- `NEXT_PUBLIC_AI_IMAGE_GENERATION_DISABLED`: set to `true` only if the client UI should hide or disable image creation affordances.
- `GENERATION_ALERT_DAILY_USD` and `GENERATION_ALERT_MONTHLY_USD`: optional cost alert thresholds.

## Pre-Release Checks

- Run the focused image generation API, worker, and export-gate tests from the branch.
- Build the app and Railway worker image from the same commit intended for deployment.
- Confirm Railway logs show the worker polling without startup errors.
- Confirm `/health` reports a healthy database, storage, and Puppeteer connection.
- Confirm there are no unexpected queued or processing image jobs before enabling the web app flow:

```sql
SELECT status, COUNT(*)
FROM image_generation_jobs
WHERE status IN ('queued', 'processing')
GROUP BY status;
```

## Rollout Checks

After the migration, worker, and app release are live:

1. Submit one single-image generation request for a test menu item.
2. Confirm a queued `image_generation_jobs` row is created with `menu_id`, `menu_item_id`, `available_at`, and `priority`.
3. Confirm the Railway worker claims the job through `claim_image_generation_job(TEXT)` and sets `status='processing'` with `worker_id`.
4. Confirm the job completes, writes `ai_generated_images` rows, uploads image variants to `ai-generated-images`, and records `result_count`.
5. Confirm the first completed image is auto-selected on `menu_items` and synced into `menus.menu_data`.
6. Submit a small batch from the extracted page and confirm each item progresses through queued, processing, and completed states.
7. Start an export while one image job is queued or processing and confirm the server rejects it.
8. Retry export after all image jobs complete and confirm it succeeds.
9. Review Railway logs for Nano Banana, storage, Supabase RPC, and cutout/background-removal errors.
10. Review generation analytics and quota counters for the test user.

## Rollback

If the worker cannot process image jobs reliably:

1. Set `AI_IMAGE_GENERATION_DISABLED=true` on the web app to stop new image generation requests.
2. Redeploy or restart the previous Railway worker if export processing is affected.
3. Leave completed migration `065_image_generation_worker_queue.sql` in place; it is additive and safe for older code paths.
4. Investigate failed jobs from `image_generation_jobs` and retry only after the worker fix is deployed.

