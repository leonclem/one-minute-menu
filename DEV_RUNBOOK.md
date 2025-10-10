## Kiro Dev Runbook

This is a quick reference to start everything needed for local development and testing.

### Components
- Next.js web app (App Router) with integrated OCR processing
- Supabase local stack (Postgres, Auth, Storage)
- Google Vision API (integrated directly in Next.js API routes)
- AI parsing via OpenAI API (optional)
 - AI menu image generation via Nano Banana (Gemini) API

### One-time setup (per machine)
1) Prerequisites
   - Node 18+
   - Python 3.10+
   - Supabase CLI: `npm i -g supabase`
   - Google Cloud Vision service account JSON key
   - OpenAI API key (optional; enables AI-powered parsing)

2) Web app deps (from repo root)
```
npm install
```

3) Google Vision API setup (add to `.env.local`)
```
# Add your Google Vision service account JSON content as a single line
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account","project_id":"..."}
```

Notes
- OCR now runs directly in Next.js API routes (no separate worker needed)
- The Google Vision credentials should be the JSON content, not a file path
- If your JSON has spaces or special characters, wrap the entire value in quotes

### Every development session
1) Start Supabase (repo root)
```
npx supabase start
```

2) Start the web app (repo root)
```
npm run dev
```

Note: After pulling changes that add new dependencies (e.g., `openai`), run `npm install` again.

**That's it!** OCR processing now runs directly in the Next.js API routes - no separate worker needed.

### AI Image Generation — Deploy & Migrations

1) Environment variables (server)
   - `NANO_BANANA_API_KEY` — required for image generation
   - Optional kill switches:
     - `AI_IMAGE_GENERATION_DISABLED=true` (backend returns 503)
     - `NEXT_PUBLIC_AI_IMAGE_GENERATION_DISABLED=true` (hide UI "Create Photo")

2) Database migrations (apply in order)
   - `supabase/migrations/010_ai_image_generation_schema.sql`
   - `supabase/migrations/011_image_selection_functions.sql`

3) Rollback guidance (if feature must be reverted)
   - Drop functions created by 011 (selection helpers)
   - Drop tables from 010: `ai_generated_images`, `image_generation_jobs`, `generation_quotas`, `generation_analytics`
   - Remove added columns from `menu_items` if needed (`ai_image_id`, `custom_image_url`, `image_source`, `generation_params`)

4) Smoke tests
   - Single generation for one item
   - Regeneration limit (5/day per item)
   - Variations (2–4)
   - Batch flow (3–5 items)
   - Quota enforcement (free plan)
   - Safety-block path returns suggestion
   - Public menu renders selected image

### How to test OCR
- In the dashboard, upload a menu photo, then click "Extract Items".
- OCR processing happens immediately (no queuing) and results appear in the UI
- Or via API (replace `<menuId>`):
```
curl -X POST "http://localhost:3000/api/menus/<menuId>/ocr?force=1"
```

After OCR completes (text appears immediately), you can:
- Click "Parse with AI" to extract items using OpenAI (requires `OPENAI_API_KEY`).
- Click "Fallback Parse" to use a heuristic parser (no API key required).

### Config reference
- Web app env: `.env.local` (Next.js)
- Rate limit: `OCR_RATE_LIMIT_PER_HOUR` (default 10) — set in web app env

AI parsing (web app `.env.local`):
```
# Required to enable "Parse with AI"
OPENAI_API_KEY=sk-...

# Optional overrides
OPENAI_MODEL=gpt-4o-mini
OPENAI_INPUT_TOKEN_RATE=0       # $ per token for prompt (for cost display)
OPENAI_OUTPUT_TOKEN_RATE=0      # $ per token for completion (for cost display)
```

Notes
- If `OPENAI_API_KEY` is missing or the OpenAI call fails, the system will fall back to the heuristic parser.
- No additional local services are required for AI parsing beyond the web app; ensure internet access for OpenAI API calls.

### Troubleshooting
- OCR not working: Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set in `.env.local` with valid JSON
- Vision API errors: Check that your Google Cloud project has Vision API enabled and billing set up
- Database connection issues: Ensure Supabase is running with `npx supabase start`

### Stopping services
- Stop Next.js: Ctrl+C
- Stop Supabase: `npx supabase stop`