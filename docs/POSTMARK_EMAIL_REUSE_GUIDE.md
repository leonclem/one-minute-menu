# Postmark Email Reuse Guide

This guide documents the current GridMenu Postmark email implementation so it can be reused in another project. It reflects the active code paths in `src/lib/email-client.ts`, `src/lib/notification-service.ts`, and `src/lib/notifications.ts`.

Some older project docs still mention SendGrid. Treat Postmark as the current implementation for application transactional email.

## Current Architecture

GridMenu separates email sending into two layers:

- `src/lib/email-client.ts` is the thin Postmark adapter. It knows how to create a Postmark `ServerClient`, map the app's message shape to Postmark fields, select the message stream, disable link tracking when needed, and log send results.
- `src/lib/notification-service.ts` and `src/lib/notifications.ts` build product-specific transactional emails. They fetch recipients or accept profile data, render HTML and text bodies, apply GridMenu branding, and call `sendEmail`.

The reusable part for another project is primarily `email-client.ts`, plus the pattern used by the notification services:

1. Load configuration from environment variables.
2. Build both text and HTML bodies.
3. Call `sendEmail`.
4. Treat failures as non-fatal for the business workflow unless the product explicitly requires a hard failure.

## Dependency

Install the Postmark package:

```bash
npm install postmark
```

GridMenu currently uses the `postmark` package and imports:

```ts
import { ServerClient } from 'postmark'
import { LinkTrackingOptions } from 'postmark/dist/client/models/message/SupportingTypes'
```

## Required Configuration

At minimum, a new project needs:

```bash
POSTMARK_SERVER_TOKEN=your-postmark-server-token
FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=https://your-app.example
```

Recommended optional values:

```bash
FROM_NAME=Your Product Name
POSTMARK_TRANSACTIONAL_STREAM=outbound
ADMIN_EMAIL=admin@yourdomain.com
COMPANY_NAME=Your Company Name
COMPANY_MAILING_ADDRESS="123 Example Street, City, Country"
SUPPORT_EMAIL=support@yourdomain.com
```

GridMenu fallbacks are:

- `FROM_EMAIL`: `noreply@gridmenu.ai`
- `FROM_NAME`: `GridMenu`
- `NEXT_PUBLIC_APP_URL`: `https://gridmenu.ai`
- `POSTMARK_TRANSACTIONAL_STREAM`: `outbound`
- `COMPANY_NAME`: falls back to `FROM_NAME`
- `SUPPORT_EMAIL`: falls back to `FROM_EMAIL`
- `COMPANY_MAILING_ADDRESS`: blank
- `ADMIN_EMAIL`: `admin@gridmenu.ai`

For another project, avoid relying on GridMenu defaults. Configure all product identity values explicitly in each environment.

## Postmark Account Setup

Before production use:

- Create or select a Postmark Server.
- Verify the sender signature or sending domain for `FROM_EMAIL`.
- Use a transactional Message Stream, usually `outbound`, unless the Postmark account has a custom stream.
- Add DNS records for SPF, DKIM, and return-path handling as instructed by Postmark.
- Store the real server token only in the production secret store, never in committed files.

## Low-Level Send Logic

GridMenu's `sendEmail` accepts this message shape:

```ts
export interface EmailMessage {
  to: string
  from: string
  fromName?: string
  subject: string
  html: string
  text: string
  messageStream?: string
  disableClickTracking?: boolean
}
```

The implementation:

- Reads `POSTMARK_SERVER_TOKEN`.
- Returns `false` and logs a warning if the token is missing.
- Formats the sender as either `email@example.com` or `Name <email@example.com>`.
- Sends `From`, `To`, `Subject`, `HtmlBody`, `TextBody`, and `MessageStream` to Postmark.
- Uses `messageStream`, then `POSTMARK_TRANSACTIONAL_STREAM`, then `outbound`.
- Sets `TrackLinks: None` when `disableClickTracking` is true.
- Logs the Postmark `MessageID`, `ErrorCode`, and `Message`.
- Returns `true` only when Postmark returns `ErrorCode === 0`.
- Catches Postmark API errors, logs the response detail, and returns `false`.

This boolean return keeps calling services simple. For critical emails, a new project may want to persist failed sends for retry, but GridMenu does not currently implement an email retry queue.

## Notification Service Pattern

GridMenu uses product-level notification functions for each email type instead of scattering Postmark calls through the app.

Examples include:

- Subscription confirmation.
- Creator Pack confirmation.
- Payment failed notification.
- Subscription cancellation notifications.
- Export completed and export failed notifications.
- Admin alert for a new user.
- User approval welcome email.

The pattern is:

```ts
await sendEmail({
  to: profile.email,
  from: FROM_EMAIL,
  fromName: FROM_NAME,
  subject: withCompanyPrefix('Subject line'),
  text: 'Plain text fallback...',
  html: emailShell('<h2>HTML body</h2>'),
})
```

For a new project, keep this separation:

- Put provider-specific code in one small client module.
- Put product-specific email copy and templates in service modules.
- Keep both `text` and `html` versions for every transactional email.
- Make send failures visible in logs, but decide per use case whether they should block the workflow.

## Branding And Compliance

GridMenu email templates use:

- A standard HTML shell with a logo loaded from `${NEXT_PUBLIC_APP_URL}/logos/logo-400.png`.
- A product prefix on many subjects via `COMPANY_NAME`.
- Inline styles for email client compatibility.
- Plain text bodies for every email.
- Optional compliance footer values from `COMPANY_MAILING_ADDRESS` and `SUPPORT_EMAIL`.

For a new project, confirm:

- The logo URL is publicly accessible. Localhost image URLs will not render in real inboxes.
- All transactional emails include enough company identity and support/contact information.
- Marketing or bulk email should use separate consent, unsubscribe, and message stream rules. The GridMenu code is for transactional email only.

## Local, Test, And Production Behavior

GridMenu supports three practical modes:

- Missing `POSTMARK_SERVER_TOKEN`: `sendEmail` logs a warning and returns `false`.
- `POSTMARK_SERVER_TOKEN=POSTMARK_API_TEST`: Postmark's official test token swallows email without delivering it. This is suitable for local or automated test environments that should exercise the send path without sending real mail.
- Real `POSTMARK_SERVER_TOKEN`: emails are sent through Postmark.

Use separate environment values per environment:

```bash
# Local development
POSTMARK_SERVER_TOKEN=POSTMARK_API_TEST
FROM_EMAIL=noreply@your-verified-domain.com
FROM_NAME="Your App Dev"
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Production
POSTMARK_SERVER_TOKEN=real-production-token
FROM_EMAIL=noreply@your-verified-domain.com
FROM_NAME="Your App"
NEXT_PUBLIC_APP_URL=https://your-app.example
POSTMARK_TRANSACTIONAL_STREAM=outbound
```

If sending to a real inbox from local development, use a real token and a public `NEXT_PUBLIC_APP_URL` so linked images resolve correctly.

## Link Tracking

GridMenu disables Postmark click tracking for export download emails:

```ts
disableClickTracking: true
```

This maps to `TrackLinks: LinkTrackingOptions.None`. The reason is practical: some email clients, especially Outlook/Edge combinations, may flag tracked redirect links for file downloads as unsafe.

For another project, consider disabling click tracking for:

- Signed download URLs.
- Passwordless login links.
- Account recovery links.
- Security-sensitive or short-lived URLs.

## Testing

GridMenu has two testing approaches:

- Unit tests mock `sendEmail` and assert the notification service builds the expected recipient, subject, text, HTML, and links.
- `scripts/send-test-emails.js` sends sample transactional emails to a real inbox for visual review when given a real Postmark token.

Recommended tests for a new project:

- Unit test every notification builder with `sendEmail` mocked.
- Assert both text and HTML include required dynamic values.
- Assert required links use the configured app URL.
- Assert profile or recipient lookup failures do not throw unexpectedly.
- Test download or sensitive emails with click tracking disabled where applicable.
- Run a real inbox smoke test before production launch.

GridMenu's helper command is:

```bash
npm run test:emails -- you@example.com
```

The underlying script requires a real token and refuses to run with `POSTMARK_API_TEST`.

## Operational Considerations

Before reusing this pattern in a new project, decide:

- Whether email failure should be best-effort or persisted for retry.
- Whether to centralize templates further if many emails are expected.
- Whether to use Postmark templates instead of in-code HTML.
- How to prevent duplicate sends for webhook-driven workflows. GridMenu relies on idempotent purchase/webhook processing around the notification calls.
- Which message streams should be used for transactional, broadcast, or lifecycle email.
- What logs or metrics are needed to alert on repeated email failures.
- Whether sensitive values in email bodies should be redacted from logs.

## Files Worth Reusing

Start with:

- `src/lib/email-client.ts` for the Postmark adapter.
- `src/lib/notification-service.ts` for examples of product-specific transactional emails with profile lookup and compliance footers.
- `src/lib/notifications.ts` for simpler direct-profile notification examples.
- `src/__tests__/unit/notification-service.test.ts` for the test pattern.
- `scripts/send-test-emails.js` if the new project wants a manual real-inbox preview script.

When copying these files to a new project, replace GridMenu-specific defaults, branding, copy, routes, product names, and any Supabase-specific recipient lookup logic.

