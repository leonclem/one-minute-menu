# Pivot Git Workflow & Deployment Guide

## Current workflow (2026-07-27)

**Commit directly to `main`** — no chunk branches for new work.

Rationale: Chunks 1–5 proved the pivot; short-lived branches added overhead without benefit
for a solo developer with no production users to protect. Feature flags still gate incomplete
product surfaces. `main` does **not** auto-deploy to production (`vercel.json` sets
`deploymentEnabled: { main: false }`); production deploys remain manual and deliberate.

Historical note: Chunks 1–5 were built on `studio/chunk-NN-*` branches (decision
2026-07-17). That approach is **superseded**; the chunk log keeps branch names for
traceability only.

## Units of work

| Type | When | Plan doc | Tracker section |
|---|---|---|---|
| **Chunk** | Maps to a requirements phase (e.g. Phase 5 → Chunk 6) | `docs/pivot/BUILD_PLAN_CHUNK_NN.md` | Chunk log |
| **Patch** | Bug fix, infra, or prod discovery outside the phase sequence | `docs/pivot/PATCH_<slug>_<date>.md` | Patches log |

Patches are **not** assigned chunk numbers.

## Development loop (on `main`)

```bash
# 1. Start from up-to-date main
git checkout main
git pull origin main

# 2. Check working tree — resolve or stash before starting
git status

# 3. Work. Commit small and often on main:
git add -A
git commit -m "feat(studio): <what changed>"

# 4. Back up to GitHub
git push origin main
```

### Before you start

- Read `docs/pivot/PIVOT_TRACKER.md` to confirm the next chunk or patch.
- Create or update the plan doc and tracker rows **before** application code (see
  `.cursor/rules/pivot-tracker.mdc`).
- Wait for explicit go-ahead on the plan before implementing (unless you are continuing
  approved work in the same session).

### Commit messages

Use clear prefixes so history is scannable:

```text
feat(studio): …     — new Studio feature or chunk/patch delivery
fix(studio): …      — bug fix or patch
docs(pivot): …      — tracker, build plans, workflow docs only
chore(…): …         — tooling, deps, non-product changes
```

### Safety notes

- Pushing to `main` updates the shared repo but does **not** deploy production.
- If `git status` shows unexpected changes, stop and ask the agent — do not guess with
  `reset`, `force`, or `rebase`.
- Never run destructive git commands (`reset --hard`, `push --force`, history rewrites)
  without explicit approval.

## Environments & deployment

| Environment | What it is | How code gets there |
|---|---|---|
| **Dev (local)** | `npm run dev` on your machine, local Supabase | Run on `main` (or any checkout) |
| **Preview (Vercel)** | Throwaway URL for checking a build | `vercel` (no `--prod`) from the repo |
| **Production (Vercel)** | Live site | Manual only — see checklist below |

### Deploy backlog (running total)

Multiple chunks or patches may land on `main` before you deploy. Do **not** reconstruct
deploy steps from git history alone. Use the living backlog:

**[PRODUCTION_DEPLOY_BACKLOG.md](PRODUCTION_DEPLOY_BACKLOG.md)**

Each chunk or patch that adds a migration, env var, or prod smoke step appends rows there.
Before any production deploy, clear every `Pending` row for that environment.

### Production deploy checklist

1. Ensure `main` is up to date: `git checkout main && git pull origin main`.
2. Open [PRODUCTION_DEPLOY_BACKLOG.md](PRODUCTION_DEPLOY_BACKLOG.md) and apply every
   `Pending` migration and env var for the target environment.
3. Run the test suite: `npm test`.
4. Run the pre-deploy check: `npm run deploy-check`.
5. Deploy: `npm run deploy:vercel` (runs `vercel --prod`).
6. Smoke-test the live site (see “Other production actions” in the deploy backlog).
7. Mark applied backlog rows `Applied` and add a row to the deploy history log.
8. Update `PIVOT_TRACKER.md` chunk/patch deploy status if applicable.

### Rollback

Vercel keeps previous deployments: promote the prior deployment from the Vercel dashboard
(Deployments → ⋯ → Promote to Production). This does not undo database migrations — which is why
migrations should stay additive during the pivot.

---

## Historical: chunk branches (Chunks 1–5 only)

Superseded 2026-07-27. Kept for reference if reviewing older build plans.

```text
studio/chunk-NN-<short-slug>
```

Examples: `studio/chunk-01-foundations`, `studio/chunk-05-prompt-state-layer`.

Old loop: branch off `main` → work → merge PR → delete branch. New work skips steps 2 and 6.
