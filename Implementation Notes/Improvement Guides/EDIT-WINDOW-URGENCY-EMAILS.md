# Edit Window Urgency Emails

## Overview

A future feature to send reminder emails to free users as their 7-day editing window approaches expiry, e.g. "Your edit window closes in 3 days — finish your menu now!"

The goal is to drive re-engagement and nudge users towards either completing their menu or upgrading to Grid+.

---

## Background: How the Edit Window Works

Free users are subject to a 7-day editing window. There are actually two independent mechanisms enforcing this:

1. **Profile grace period** — `profiles.created_at + 7 days`. Checked in `src/lib/database.ts` (`assertUserCanEditMenu`). This is a safety net in case the Creator Pack is not yet provisioned.
2. **Pack edit window** — `user_packs.edit_window_end`. Set at the moment the free Creator Pack row is inserted (via `src/app/api/checkout/route.ts` or `src/lib/purchase-logger.ts`). This is the authoritative, named window.

A user can edit if **either** window is active. In the normal flow both start at roughly the same time (signup), so they expire together.

Paid subscribers (`grid_plus`, `grid_plus_premium`, `enterprise`) bypass both windows entirely and should never receive these emails.

---

## Key Complexity: Avoiding Duplicate Emails

Because there are two overlapping windows, a naive sweep could send two emails for the same user and effectively the same deadline. The rule to avoid this:

> **Base reminder emails solely on `user_packs.edit_window_end`, not on `profiles.created_at`.**

The grace period is an internal safety net — it should never drive outbound communications.

### Edge Case: Users Who Never Claimed Their Pack

A user who signed up but never visited the checkout/pricing page to claim their free Creator Pack will have **no `user_packs` row** — only the grace period protects them. Options:

- **Option A**: Sweep `profiles` for users still in their grace window with no pack, and send a different email: "Claim your free menu before your trial expires." This is a separate email type, not a duplicate.
- **Option B**: Force pack provisioning at onboarding completion, eliminating this edge case entirely. This is likely the cleaner long-term solution.

---

## Proposed Implementation Approach

### 1. Track Whether a Reminder Has Been Sent

Add a column to `user_packs` (or a separate `email_log` table):

```sql
ALTER TABLE user_packs ADD COLUMN edit_window_reminder_sent_at TIMESTAMPTZ;
```

This prevents repeat sends if the cron runs daily.

### 2. New Cron Endpoint

Add a daily cron job (e.g. `/api/admin/edit-window-reminders`) alongside the existing `cutout-worker` cron in `vercel.json`. The sweep logic:

```
Find all user_packs WHERE:
  - pack_type = 'creator_pack'
  - edit_window_end is between NOW() + 2 days and NOW() + 4 days  (the "3 days left" window)
  - edit_window_reminder_sent_at IS NULL
  - user is NOT a paid subscriber
```

Mark `edit_window_reminder_sent_at = NOW()` immediately after queuing the send to ensure idempotency.

### 3. New Email Template

Add `sendEditWindowReminderEmail(userId, menuName, editWindowEnd)` to `src/lib/notification-service.ts`, following the existing pattern. The email should:
- State clearly when the window closes (formatted date)
- Link directly to the menu editor
- Offer an upgrade CTA for Grid+

### 4. What to Do If the User Has No Menu Yet

If the user has an active pack but zero menus, the reminder becomes a "get started" nudge rather than an urgency prompt. The email copy should branch accordingly.

---

## Files to Touch When Implementing

| File | Change |
|---|---|
| `supabase/migrations/` | Add `edit_window_reminder_sent_at` to `user_packs` |
| `vercel.json` | Add daily cron entry |
| `src/app/api/admin/edit-window-reminders/route.ts` | New cron handler |
| `src/lib/notification-service.ts` | New `sendEditWindowReminderEmail` method |
| `src/lib/database.ts` | Reference for how edit access is currently checked |
| `src/app/api/checkout/route.ts` | Reference for where packs are granted |

---

## Open Questions

- Should we send a reminder at 3 days, or also at 1 day? Two reminders could feel spammy; one is probably enough.
- Should users who haven't created a menu yet receive a different email variant?
- Is Option A or B preferable for the "no pack" edge case (see above)?
- Should reminders be suppressible by the user (unsubscribe preference)?
