# Patch — Studio first-upload auth lock (2026-08-14)

**Type:** Independent patch (bug fix, not a requirements phase / chunk).

**Requirements refs (adjacent):** §7.2 (studio image persistence).

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual.

**Goal:** First source-image upload on `/studio` must succeed without a
"Timed out while checking your sign-in" error.

## Problem

Uploading the first photo for a new dish failed after ~15s with:

> Timed out while checking your sign-in. Refresh the page and try again.

Refreshing and uploading the same file then succeeded immediately. The file was
not uploaded on the first attempt; the second attempt was fast because the hung
`getSession()` call was skipped after a full reload.

Root cause: `uploadStudioSourceFile()` called `supabase.auth.getSession()` in
the browser. GoTrue holds an auth lock while it notifies `onAuthStateChange`
subscribers. `useAnalyticsIdentify` used an `async` callback that `await`ed a
`profiles` query, which itself calls `getSession()` for the access token —
deadlocking session recovery. The 15s timeout added on 2026-08-05 surfaced that
hang as a user-facing error instead of an infinite spinner.

## Solution

1. Make the PostHog auth listener return immediately and identify in a
   fire-and-forget task, so it never holds the GoTrue lock.
2. Stop the Studio upload client from calling `getSession()`. A same-origin
   `POST /api/studio/source/upload-url` issues a signed Storage URL (cookie
   auth on the server). The browser PUTs the file to that URL with `fetch`.
3. Best-effort cleanup uses `DELETE` on the same route instead of the browser
   Storage client.

Direct-to-Storage upload (bypass Vercel 4.5 MB) is unchanged.

## Scope

- `src/lib/posthog/useAnalyticsIdentify.ts`
- `src/lib/studio/client-upload.ts`
- `src/app/api/studio/source/upload-url/route.ts`
- Unit tests for the listener, signed-URL route, and client upload

## Production deploy

No new migration or env var.

## Manual test plan

1. Hard-refresh `/studio` (or open it in a new session).
2. Create a new dish if needed, then upload a source photo as the first action.
3. The image appears without the sign-in timeout error.
4. Repeat after a normal refresh — still succeeds.
5. File larger than 9 MiB is still rejected client-side before upload.
