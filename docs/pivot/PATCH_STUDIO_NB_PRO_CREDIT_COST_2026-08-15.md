# Patch — Studio NB Pro credit cost 3 → 2 (2026-08-15)

**Type:** Independent patch (pricing default, not a requirements phase / chunk).

**Requirements refs (adjacent):** §8.1 credits; Q8 Pro model credit cost.

**Branch:** `main`

**Deploy status:** Built locally — production deploy is manual. Confirm the
Vercel env var (see below) or the old override will keep charging 3.

**Goal:** Charge **2 credits** for Nano Banana Pro mutates instead of 3, so the
premium is closer to Gemini’s actual cost gap and less likely to suppress use.

## Context

Studio generates at `STUDIO_IMAGE_SIZE` default **2K**. Gemini list prices used
for this decision:

| Size | NB2 (Flash) | NB Pro |
|---|---|---|
| 1K | 0.067 | 0.134 |
| 2K | 0.101 | 0.134 |
| 4K | 0.151 | 0.240 |

At 2K, Pro is ~33% more expensive than Flash (not ~63%). Integer credit prices
of 1 vs 2 still leave Pro above cost-parity; 1 vs 3 over-taxes a ~33% cost gap.

Exports are out of scope: AI expand/recompose still uses Flash and
`STUDIO_CREDIT_COST_EXPORT_AI` (default 1). Crop/resize remains free.

## Change

- Default `STUDIO_CREDIT_COST_NB_PRO` / `DEFAULT_STUDIO_CREDIT_COST_NB_PRO`: 3 → 2
- UI fallback and analytics fallback aligned to 2
- Control-panel Generate button shows the selected-model cost in-button
  (`Generate · 1 credit` / `Generate · 2 credits`) so the price is visible on
  mobile without a tooltip. Insufficient-credit check uses that same cost.
- Env example and pipeline notes updated

## Production deploy

1. In Vercel, set `STUDIO_CREDIT_COST_NB_PRO=2`, or delete the var so the new
   code default applies. An existing `=3` override will ignore this patch.
2. No migration.
3. Manual production deploy as usual (`main` does not auto-deploy).
