# Syncing Placeholder Images to Production

Placeholder item images are generated locally (via the Admin dashboard) and stored in your
**local Supabase Storage** instance. They are not automatically available in Production —
you need to sync them manually using the script described below.

## Background

Placeholder items are sample menu items shown to new users before they add their own content.
Each item has two images stored in Supabase Storage:

- `photo.webp` — the generated food photo
- `cutout.webp` — the background-removed cutout version

They live in the `menu-images` bucket under the `placeholder-items/` prefix, organised by
image key (e.g. `placeholder-items/japanese_tonkotsu_ramen/photo.webp`).

The image library is defined in `src/data/placeholder-menus/image-library.json`. As of the
time of writing there are 55 image keys, meaning 110 files total (55 × photo + 55 × cutout).

---

## The Sync Script

**`scripts/sync-placeholder-images.js`**

Copies placeholder images from a source Supabase project (default: local) to a destination
(e.g. Production). Safe to re-run — existing files in the destination are skipped by default.

### Credentials you need

Both are in your Supabase **Production** dashboard under **Project Settings → API**:

- `DEST_SUPABASE_URL` — e.g. `https://uztyljbiqyrykzwtdbpa.supabase.co`
- `DEST_SUPABASE_SERVICE_KEY` — the `service_role` secret key (not the anon key)

The source credentials are read automatically from `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`), so you don't need to set those.

---

## How to Run (Windows PowerShell)

> **Important:** You must use PowerShell's `$env:VAR="value"` syntax.
> The bash-style `VAR=value command` syntax does not work on Windows.
> The CMD `set VAR=value` syntax also does not work in PowerShell — it sets a PowerShell
> variable, not an environment variable, so the script won't see it.

### Step 1 — Set your destination credentials

```powershell
$env:DEST_SUPABASE_URL="https://your-project.supabase.co"
$env:DEST_SUPABASE_SERVICE_KEY="your-service-role-key"
```

These persist for the life of the terminal session, so you only need to set them once.

### Step 2 — Dry run first (recommended)

```powershell
$env:DRY_RUN="true"
node scripts/sync-placeholder-images.js
```

This lists every file that would be copied without writing anything. Check the output looks
sensible — you should see one `photo.webp` and one `cutout.webp` per image key.

The file count will be **double** the number of image keys (e.g. 55 keys = 110 files).
That is expected and correct.

### Step 3 — Run the real sync

```powershell
$env:DRY_RUN="false"
node scripts/sync-placeholder-images.js
```

Or via npm:

```powershell
$env:DRY_RUN="false"
npm run sync:placeholder-images
```

---

## Options

All options are set as environment variables.

| Variable | Default | Description |
|---|---|---|
| `DEST_SUPABASE_URL` | *(required)* | URL of the destination Supabase project |
| `DEST_SUPABASE_SERVICE_KEY` | *(required)* | Service role key for the destination |
| `SOURCE_SUPABASE_URL` | Value of `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` | Override the source project |
| `SOURCE_SUPABASE_SERVICE_KEY` | Value of `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` | Override the source service key |
| `DRY_RUN` | `false` | Set to `true` to preview without writing |
| `SKIP_EXISTING` | `true` | Skip files already present in destination. Set to `false` to overwrite |
| `IMAGE_KEY_FILTER` | *(none)* | Only sync keys starting with this prefix, e.g. `japanese_` |

---

## Syncing a Subset (e.g. newly generated images)

If you've generated images for a new cuisine and only want to push those:

```powershell
$env:IMAGE_KEY_FILTER="korean_"
$env:DRY_RUN="true"
node scripts/sync-placeholder-images.js
```

Then set `DRY_RUN=false` to execute.

---

## Troubleshooting

**"Missing destination credentials" error**
You haven't set `DEST_SUPABASE_URL` and/or `DEST_SUPABASE_SERVICE_KEY`, or they were set
using CMD `set` syntax inside a PowerShell session (which doesn't work). Use `$env:VAR=`.

**Source shows `http://localhost:54323` instead of `54321`**
The script was picking up the wrong env var. This was a bug that has been fixed — the script
now reads `NEXT_PUBLIC_SUPABASE_URL` from `.env.local` which correctly points to port `54321`
(the API port). Port `54323` is Supabase Studio (the web UI) and will return HTML, not JSON.

**"Unexpected token '<'" error from source**
Your local Supabase isn't running. Start it with `npx supabase start` and retry.

**File count is double what you expected**
That's correct — each image key has both a `photo.webp` and a `cutout.webp`, so the file
count is always 2× the number of image keys.
