# Pivot Git Workflow & Deployment Guide

The agreed workflow (see PIVOT_TRACKER.md decisions log, 2026-07-17): **short-lived branches, one
per chunk, merged back to `main` promptly behind feature flags** — instead of the single
long-lived `pivot/photo-studio-mvp` branch suggested in requirements §9.2.

This is safe because `main` does **not** auto-deploy to production (`vercel.json` sets
`deploymentEnabled: { main: false }`); production deploys are always manual and deliberate.

## Branch naming

```text
studio/chunk-NN-<short-slug>
```

Examples: `studio/chunk-01-foundations`, `studio/chunk-02-studio-shell`.

Branch names are ephemeral — they are deleted after merge and leave no trace in history, so don't
overthink them. The lasting record is commit messages and this docs folder.

## Per-chunk loop

```bash
# 1. Start from up-to-date main
git checkout main
git pull

# 2. Create the chunk branch
git checkout -b studio/chunk-02-studio-shell

# 3. Work. Commit small and often:
git add -A
git commit -m "feat(studio): <what changed>"

# 4. Back up / share the branch (first push sets the upstream)
git push -u origin studio/chunk-02-studio-shell
# subsequent pushes are just: git push

# 5. When the chunk is done and tests pass, merge to main
#    (via GitHub PR, or locally:)
git checkout main
git pull
git merge studio/chunk-02-studio-shell
git push

# 6. Tidy up — delete the merged branch
git branch -d studio/chunk-02-studio-shell
git push origin --delete studio/chunk-02-studio-shell
```

Safety notes:

- Nothing in steps 1–4 can affect `main` or production.
- `git checkout main` / `git checkout <branch>` switches your working folder between versions;
  commit (or stash) before switching.
- If unsure at any point, run `git status` and ask the agent before proceeding — do not guess
  with `reset`, `force`, or `rebase` commands.

## Environments & deployment

| Environment | What it is | How code gets there |
|---|---|---|
| **Dev (local)** | `npm run dev` on your machine, local Supabase | Just run it on any branch |
| **Preview (Vercel)** | Throwaway URL per deploy, for checking a build | `vercel` (no `--prod`) from the repo, or Vercel's automatic branch previews if enabled |
| **Production (Vercel)** | Live site | Manual only — see checklist below |

### Pending backlog (running total across chunks)

Because many chunks may land on `main` before you deploy, do **not** reconstruct
deploy steps from “everything since we branched.” Use the living backlog:

**[PENDING_PRODUCTION_DEPLOY.md](PENDING_PRODUCTION_DEPLOY.md)**

Each chunk that adds a migration or env var appends rows there. Before any
production deploy, clear every `Pending` row for that environment.

### Production deploy checklist

1. Merge the chunk to `main` and ensure you're on it: `git checkout main && git pull`.
2. Open [PENDING_PRODUCTION_DEPLOY.md](PENDING_PRODUCTION_DEPLOY.md) and apply every
   `Pending` migration and env var for the target environment.
3. Run the test suite: `npm test`.
4. Run the pre-deploy check: `npm run deploy-check`.
5. Deploy: `npm run deploy:vercel` (runs `vercel --prod`).
6. Smoke-test the live site (see “Other production actions” in the pending backlog).
7. Mark applied backlog rows `Applied` and add a row to the deploy history log.

### Rollback

Vercel keeps previous deployments: promote the prior deployment from the Vercel dashboard
(Deployments → ⋯ → Promote to Production). This does not undo database migrations — which is why
migrations should stay additive during the pivot.
