# Patch — Name dish before first upload (2026-08-14)

**Type:** Independent patch (UX bug fix, not a requirements phase / chunk).

**Requirements refs (adjacent):** §7.3 (image library per dish).

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual.

**Goal:** Do not auto-create a dish named "My dishes". Ask for a dish name
before the first source photo can be uploaded.

## Problem

Visiting `/studio` with no dishes created a placeholder dish named
"My dishes" and enabled upload immediately. The first photo was then stored
under that unintuitive name.

## Solution

1. Stop calling `ensureDefaultStudioDish` from the Studio page and
   `GET /api/studio/dishes`. An empty library stays empty.
2. Upload CTAs (first-run panel and workbench) open the existing "Name your
   dish" modal when there is no active dish.
3. After the named dish is created from an upload CTA, the file picker opens.

Existing leftover "My dishes" rows are unchanged; the dish picker still hides
that placeholder name.

## Scope

- `src/app/studio/page.tsx`
- `src/app/api/studio/dishes/route.ts`
- `src/lib/studio/dishes.ts` (remove `ensureDefaultStudioDish`)
- `src/app/studio/_components/studio-client.tsx`
- `src/app/studio/_components/studio-first-run-panel.tsx`

## Production deploy

No new migration or env var.

## Manual test plan

1. Use an account with no Studio dishes (or delete the last dish).
2. Open `/studio`. The title is "Food Photo Studio", not "My dishes".
3. Click **Name your dish** (first-run or workbench). Enter a name.
4. The file picker opens; after upload the gallery uses the given name.
5. **New** still creates a named dish without forcing a file picker when a
   dish already exists.
