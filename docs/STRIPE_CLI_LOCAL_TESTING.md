# Stripe CLI Local Testing Guide

This guide explains how to set up and use the Stripe CLI for local development and testing of the Stripe payment integration.

## Overview

The Stripe CLI is a command-line tool that allows you to:
- Forward webhook events from Stripe to your local development server
- Trigger test webhook events manually
- Monitor webhook traffic in real-time
- Test payment flows without deploying to production

## Prerequisites

- Node.js and npm installed
- GridMenu project running locally (`npm run dev`)
- Stripe account (test mode)

## Installation

### Windows

Using Scoop package manager:
```bash
scoop install stripe
```
Or download the latest windows_x86_64.zip installer from [Stripe CLI Releases](https://github.com/stripe/stripe-cli/releases)
Then run e.g. PS C:\Users\Leon Clements\Downloads\stripe_1.34.0_windows_x86_64> .\stripe.exe login

### macOS

Using Homebrew:
```bash
brew install stripe/stripe-cli/stripe
```

### Linux

Download the latest release from [Stripe CLI Releases](https://github.com/stripe/stripe-cli/releases) and extract to your PATH.

## Initial Setup

### 1. Login to Stripe

Authenticate the CLI with your Stripe account:

```bash
stripe login
```

This will open a browser window asking you to authorize the CLI. Make sure you're logged into your Stripe test account.

### 2. Verify Installation

Check that the CLI is installed correctly:

```bash
stripe --version
```

## Local Webhook Testing

### Step 1: Start Your Development Server

Start the Next.js development server:

```bash
npm run dev
```

Your server should be running at `http://localhost:3000`

### Step 2: Start Webhook Forwarding

In a separate terminal, start the Stripe CLI webhook listener:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Important**: The CLI will output a webhook signing secret that looks like:

```
> Ready! Your webhook signing secret is whsec_1234567890abcdef... (^C to quit)
```

### Step 3: Save the Webhook Secret

**CRITICAL**: Copy the webhook signing secret from the CLI output and add it to your `.env.local` file:

```bash
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

**Important Notes**:
- The Stripe CLI generates a **new webhook secret each time** you run `stripe listen` unless you reuse the same device/session
- You must update `.env.local` with the new secret every time you restart `stripe listen`
- If you see webhook signature verification errors, check that your `.env.local` has the correct secret from the current CLI session

### Step 4: Restart Your Dev Server

After updating `.env.local`, restart your Next.js dev server to load the new webhook secret:

```bash
# Stop the dev server (Ctrl+C)
npm run dev
```

## Testing Payment Flows

### Test Card Numbers

Stripe provides test card numbers for different scenarios:

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 0127` | Incorrect CVC |

**For all test cards**:
- Use any future expiration date (e.g., 12/34)
- Use any 3-digit CVC (e.g., 123)
- Use any ZIP code (e.g., 12345)

### Manual Testing Workflow

1. **Start the services**:
   ```bash
   # Terminal 1: Dev server
   npm run dev
   
   # Terminal 2: Stripe CLI
   stripe login
   # Note the pairing code, and follow the link to the dashboard provided, then confirm and close the browser tab
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

2. **Navigate to pricing page**:
   - Open `http://localhost:3000/pricing` in your browser
   - You can test as a logged-in user or as a guest

3. **Initiate a purchase**:
   - Click on "Upgrade to Grid+" or "Purchase Creator Pack"
   - You'll be redirected to Stripe Checkout

4. **Complete the payment**:
   - Use test card: `4242 4242 4242 4242`
   - Enter any future expiration date
   - Enter any CVC
   - Click "Pay"

5. **Monitor webhook events**:
   - Watch the Stripe CLI terminal for webhook events
   - You should see `checkout.session.completed` event
   - Check your dev server logs for processing confirmation

6. **Verify fulfillment**:
   - Check the database for updated user profile
   - Verify purchase_audit record was created
   - Confirm user's plan was upgraded

## Triggering Test Events

You can manually trigger webhook events without going through the full checkout flow:

### Trigger Checkout Completed

```bash
stripe trigger checkout.session.completed
```

### Trigger Subscription Events

```bash
# Subscription created
stripe trigger customer.subscription.created

# Subscription updated
stripe trigger customer.subscription.updated

# Subscription deleted (cancelled)
stripe trigger customer.subscription.deleted
```

### Trigger Invoice Events

```bash
# Successful payment
stripe trigger invoice.payment_succeeded

# Failed payment
stripe trigger invoice.payment_failed
```

**Note**: Triggered events may not have all the metadata your application expects. For full testing, use the manual workflow above.

## Monitoring Webhook Traffic

The Stripe CLI provides real-time monitoring of webhook events:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

You'll see output like:

```
2024-01-21 10:30:45   --> checkout.session.completed [evt_1234567890]
2024-01-21 10:30:45   <-- [200] POST http://localhost:3000/api/webhooks/stripe [evt_1234567890]
```

- `-->` indicates an incoming webhook from Stripe
- `<--` indicates the response from your server
- `[200]` shows the HTTP status code returned

## Troubleshooting

### Webhook Signature Verification Failed

**Problem**: You see "Webhook signature verification failed" errors in your logs.

**Solution**:
1. Check that `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the secret from `stripe listen` output
2. Restart your dev server after updating `.env.local`
3. Make sure you're using the raw request body for verification (not parsed JSON)
4. Optionally try running stripe config --list to verify keys

### Webhooks Not Being Received

**Problem**: Stripe CLI shows events being sent, but your server doesn't receive them. Or Stripe CLI shows `ERROR websocket.Client.writePump`.

**Solution**:
1. Verify your dev server is running on port 3000
2. Check that the webhook endpoint path is correct: `/api/webhooks/stripe`
3. **Restart Stripe CLI**: Sometimes the websocket connection to Stripe dies. Stop the CLI (Ctrl+C) and run the `stripe listen` command again.
4. **Update Secret**: If you restart the CLI, it may provide a NEW webhook secret. You MUST update `STRIPE_WEBHOOK_SECRET` in `.env.local` and restart your dev server.
5. Look for errors in your dev server logs
6. Try triggering a test event manually: `stripe trigger checkout.session.completed`

### Connection Refused

**Problem**: Stripe CLI shows "connection refused" errors.

**Solution**:
1. Make sure your dev server is running
2. Verify the port number (default is 3000)
3. Check for firewall or antivirus blocking localhost connections

### Events Not Processing

**Problem**: Webhooks are received but not processed correctly.

**Solution**:
1. Check your server logs for error messages
2. Verify database connection is working
3. Check that all required environment variables are set
4. Look for validation errors in the webhook payload

**Problem**: Stripe terminal not showing any output

**Solution**:
1. Try running stripe config --list
2. Verify key values vs .env.local
3. May need to login again via stripe login

## Environment Variables Checklist

Make sure your `.env.local` file contains:

```bash
# Stripe Test Mode Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... # From stripe listen output

# Stripe Test Mode Price IDs
STRIPE_PRICE_ID_GRID_PLUS=price_...
STRIPE_PRICE_ID_GRID_PLUS_PREMIUM=price_...
STRIPE_PRICE_ID_CREATOR_PACK=price_...

# Database
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Email (optional for local testing)
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=dev@gridmenu.ai
SENDGRID_FROM_NAME=GridMenu Dev
```

## Best Practices

### 1. Keep Stripe CLI Running

Keep the `stripe listen` command running in a dedicated terminal window while developing. This ensures you don't miss any webhook events.

### 2. Monitor Both Terminals

Watch both your dev server logs and Stripe CLI output to see the full picture of what's happening.

### 3. Use Test Mode Only

Always use test mode API keys (`sk_test_...` and `pk_test_...`) for local development. Never use production keys locally.

### 4. Test All Event Types

Test all webhook event types your application handles:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### 5. Test Error Scenarios

Don't just test successful payments. Test error scenarios too:
- Declined cards
- Expired cards
- Insufficient funds
- Invalid webhook signatures
- Missing metadata

### 6. Verify Database State

After each test, check the database to ensure:
- User profile was updated correctly
- Purchase audit record was created
- Quotas were updated
- Webhook event was logged

## Testing Checklist

Use this checklist to verify your local setup is working:

- [ ] Stripe CLI installed and authenticated
- [ ] Dev server running on port 3000
- [ ] Stripe CLI forwarding webhooks to localhost
- [ ] Webhook secret saved in `.env.local`
- [ ] Dev server restarted after updating `.env.local`
- [ ] Can create checkout session from upgrade page
- [ ] Can complete payment with test card
- [ ] Webhook received and processed successfully
- [ ] User profile updated in database
- [ ] Purchase audit record created
- [ ] Can trigger test events with `stripe trigger`
- [ ] Can see webhook traffic in Stripe CLI

## Advanced Usage

### Custom Webhook Endpoint

If you're running on a different port or path:

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

### Filter Specific Events

Only forward specific event types:

```bash
stripe listen --events checkout.session.completed,customer.subscription.created --forward-to localhost:3000/api/webhooks/stripe
```

### View Event Details

Get detailed information about a specific event:

```bash
stripe events retrieve evt_1234567890
```

### Resend an Event

Resend a specific event to your webhook endpoint:

```bash
stripe events resend evt_1234567890
```

## Integration with Automated Tests

You can use the Stripe CLI in your test scripts:

```bash
# Start webhook forwarding in background
stripe listen --forward-to localhost:3000/api/webhooks/stripe &

# Run your tests
npm test

# Stop webhook forwarding
pkill stripe
```

## Additional Resources

- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Webhooks Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)

## Support

If you encounter issues not covered in this guide:

1. Check the [Stripe CLI GitHub Issues](https://github.com/stripe/stripe-cli/issues)
2. Review the [Stripe API Logs](https://dashboard.stripe.com/test/logs) in your dashboard
3. Check the GridMenu server logs for detailed error messages
4. Consult the main [Stripe Payment Integration Design Document](.kiro/specs/stripe-payment-integration/design.md)
