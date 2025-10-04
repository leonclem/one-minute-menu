## Kiro Dev Runbook

This is a quick reference to start everything needed for local development and testing.

### Components
- Next.js web app (App Router) with integrated OCR processing
- Supabase local stack (Postgres, Auth, Storage)
- Google Vision API (integrated directly in Next.js API routes)
- AI parsing via OpenAI API (optional)

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