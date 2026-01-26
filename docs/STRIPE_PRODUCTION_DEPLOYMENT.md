# Stripe Payment Integration - Production Deployment Checklist

This checklist guides you through deploying the Stripe payment integration to production. Complete each section in order.

## Pre-Deployment Verification

Before deploying to production, ensure:

- [x] All unit tests pass (`npm test`)
- [ ] All property tests pass with 100 iterations
- [x] Local testing with Stripe CLI completed successfully
- [x] Code review completed and approved

---

## 1. Environment Variables Setup

### 1.1 Stripe API Keys (Production)

1. Log into [Stripe Dashboard](https://dashboard.stripe.com) (ensure you're in **Live mode**, not Test mode)
2. Go to **Developers → API keys**
3. Copy the following keys:

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `STRIPE_SECRET_KEY` | Live secret key (starts with `sk_live_`) | API keys page |
| `STRIPE_PUBLISHABLE_KEY` | Live publishable key (starts with `pk_live_`) | API keys page |

### 1.2 Stripe Price IDs (Production)

After creating products in Section 3, you'll have these:

| Variable | Description |
|----------|-------------|
| `STRIPE_PRICE_ID_GRID_PLUS` | Price ID for Grid Plus subscription |
| `STRIPE_PRICE_ID_GRID_PLUS_PREMIUM` | Price ID for Grid Plus Premium subscription |
| `STRIPE_PRICE_ID_CREATOR_PACK` | Price ID for Creator Pack one-time purchase |

### 1.3 Stripe Webhook Secret (Production)

After creating the webhook endpoint in Section 4, you'll have:

| Variable | Description |
|----------|-------------|
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (starts with `whsec_`) |

### 1.4 SendGrid Configuration (Optional but Recommended)

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key for transactional emails |
| `SENDGRID_FROM_EMAIL` | Verified sender email address |
| `SENDGRID_FROM_NAME` | Display name for emails (e.g., "GridMenu") |

### 1.5 Complete Environment Variables Template

```bash
# Stripe Production Keys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Production Price IDs
STRIPE_PRICE_ID_GRID_PLUS=price_...
STRIPE_PRICE_ID_GRID_PLUS_PREMIUM=price_...
STRIPE_PRICE_ID_CREATOR_PACK=price_...

# SendGrid (Email Notifications)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@gridmenu.ai
SENDGRID_FROM_NAME=GridMenu

# Existing Supabase Config (should already be set)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 2. Database Migration

### 2.1 Run Migration

Apply the Stripe integration migration to your production database:

```bash
# Using Supabase CLI
supabase db push

# Or apply directly via SQL editor in Supabase Dashboard
# File: supabase/migrations/034_stripe_integration.sql
```

### 2.2 Verify Migration Success

Run these queries to verify the migration:

```sql
-- Check profiles table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'subscription_period_end');

-- Check webhook_events table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'webhook_events'
);

-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('profiles', 'webhook_events', 'purchase_audit')
AND indexname LIKE '%stripe%' OR indexname LIKE '%webhook%';
```

Expected results:
- 4 new columns in profiles table
- webhook_events table exists
- Stripe/webhook indexes present

### 2.3 Rollback Procedure (If Needed)

```sql
-- WARNING: Only run if migration needs to be reverted
-- This will remove Stripe data from profiles

ALTER TABLE profiles DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE profiles DROP COLUMN IF EXISTS subscription_period_end;

DROP TABLE IF EXISTS webhook_events;

DROP INDEX IF EXISTS idx_profiles_stripe_customer;
DROP INDEX IF EXISTS idx_profiles_stripe_subscription;
DROP INDEX IF EXISTS idx_purchase_audit_transaction_status;
DROP INDEX IF EXISTS idx_purchase_audit_user_created;
```

---

## 3. Stripe Products Configuration

### 3.1 Create Products in Stripe Dashboard

1. Go to [Stripe Products](https://dashboard.stripe.com/products) (ensure Live mode)
2. Click **+ Add product** for each product:

#### Grid Plus Subscription

| Field | Value |
|-------|-------|
| Name | Grid Plus |
| Description | Monthly subscription with enhanced features |
| Pricing model | Standard pricing |
| Price | $X.XX/month (your price) |
| Billing period | Monthly |

#### Grid Plus Premium Subscription

| Field | Value |
|-------|-------|
| Name | Grid Plus Premium |
| Description | Premium monthly subscription with all features |
| Pricing model | Standard pricing |
| Price | $X.XX/month (your price) |
| Billing period | Monthly |

#### Creator Pack (One-Time)

| Field | Value |
|-------|-------|
| Name | Creator Pack |
| Description | One-time purchase for additional menus |
| Pricing model | Standard pricing |
| Price | $X.XX one time (your price) |
| Billing period | One time |

### 3.2 Copy Price IDs

After creating each product:
1. Click on the product
2. Find the **Price** section
3. Copy the Price ID (starts with `price_`)
4. Add to your environment variables

---

## 4. Webhook Endpoint Configuration

### 4.1 Create Webhook Endpoint

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks) (ensure Live mode)
2. Click **+ Add endpoint**
3. Configure:

| Field | Value |
|-------|-------|
| Endpoint URL | `https://your-domain.com/api/webhooks/stripe` |
| Description | GridMenu Payment Webhooks |
| Listen to | Events on your account |

### 4.2 Select Event Types

Select these specific events:

**Checkout Events:**
- `checkout.session.completed`

**Subscription Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Invoice Events:**
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### 4.3 Copy Webhook Secret

After creating the endpoint:
1. Click on the endpoint to view details
2. Click **Reveal** under Signing secret
3. Copy the secret (starts with `whsec_`)
4. Add to `STRIPE_WEBHOOK_SECRET` environment variable

### 4.4 Verify Webhook Endpoint

After deployment, test the webhook:
1. In Stripe Dashboard, go to your webhook endpoint
2. Click **Send test webhook**
3. Select `checkout.session.completed`
4. Verify your server responds with 200

---

## 5. SendGrid Configuration (Email Notifications)

### 5.1 Create SendGrid Account

1. Sign up at [SendGrid](https://sendgrid.com)
2. Complete email authentication (domain or single sender)

### 5.2 Create API Key

1. Go to **Settings → API Keys**
2. Click **Create API Key**
3. Name: "GridMenu Production"
4. Permissions: **Restricted Access** → Enable only "Mail Send"
5. Copy the API key (shown only once)

### 5.3 Verify Sender

1. Go to **Settings → Sender Authentication**
2. Either:
   - **Domain Authentication** (recommended for production)
   - **Single Sender Verification** (quick setup)

### 5.4 Email Templates (Optional)

Consider creating branded email templates in SendGrid for:
- Subscription confirmation
- Creator Pack purchase confirmation
- Payment failed notification
- Subscription cancelled notification

---

## 6. Vercel Deployment

### 6.1 Set Environment Variables

In Vercel Dashboard:
1. Go to your project → **Settings → Environment Variables**
2. Add all variables from Section 1.5
3. Ensure they're set for **Production** environment

### 6.2 Deploy

```bash
# Deploy to production
vercel --prod

# Or push to main branch if auto-deploy is enabled
git push origin main
```

### 6.3 Verify Deployment

After deployment, verify:
- [ ] Application loads without errors
- [ ] Upgrade page displays correctly
- [ ] API routes respond (check `/api/checkout` returns 401 for unauthenticated)

---

## 7. Post-Deployment Verification

### 7.1 Test Checkout Flow

1. Log in as a test user
2. Navigate to upgrade page
3. Click upgrade button
4. Verify redirect to Stripe Checkout
5. **DO NOT complete payment yet** - just verify the flow works

### 7.2 Test Webhook Connectivity

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Check for recent webhook attempts
3. Verify all show successful delivery (200 response)

### 7.3 First Live Transaction (Recommended)

1. Use a real card to make a small test purchase
2. Verify:
   - [ ] Payment succeeds in Stripe
   - [ ] Webhook received and processed
   - [ ] User profile updated in database
   - [ ] Confirmation email sent
   - [ ] Success page shows correctly
3. **Refund the test transaction** in Stripe Dashboard

---

## 8. Monitoring Setup

### 8.1 Stripe Dashboard Monitoring

Set up monitoring in Stripe:
1. **Webhooks**: Monitor webhook delivery success rate
2. **Events**: Review recent events for errors
3. **Logs**: Check API request logs

### 8.2 Application Monitoring

Monitor these in your application:
- Webhook processing errors (check `webhook_events` table)
- Fulfillment failures (check `purchase_audit` table)
- API error rates

### 8.3 Alerts to Configure

Set up alerts for:
- Webhook delivery failures (Stripe Dashboard → Webhooks → Add notification)
- High rate of failed payments
- Fulfillment processing errors

### 8.4 Database Queries for Monitoring

```sql
-- Recent webhook events
SELECT stripe_event_id, event_type, processed, processing_error, created_at
FROM webhook_events
ORDER BY created_at DESC
LIMIT 20;

-- Failed webhook processing
SELECT * FROM webhook_events
WHERE processed = false AND processing_error IS NOT NULL
ORDER BY created_at DESC;

-- Recent purchases
SELECT user_id, plan_type, amount, status, created_at
FROM purchase_audit
ORDER BY created_at DESC
LIMIT 20;

-- Active subscriptions count
SELECT subscription_status, COUNT(*)
FROM profiles
WHERE subscription_status IS NOT NULL
GROUP BY subscription_status;
```

---

## 9. Troubleshooting

### Common Issues

#### Webhook Signature Verification Failed
- **Cause**: Wrong webhook secret or modified request body
- **Fix**: Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe Dashboard

#### Customer Portal Not Working
- **Cause**: Customer Portal not configured in Stripe
- **Fix**: Go to Stripe Dashboard → Settings → Billing → Customer Portal → Configure

#### Payments Not Fulfilling
- **Cause**: Webhook not reaching server or processing error
- **Fix**: Check webhook_events table for errors, verify endpoint is accessible

#### Duplicate Customer IDs
- **Cause**: Customer ID reuse logic not working
- **Fix**: Verify `stripe_customer_id` is being saved to profiles on first purchase

---

## 10. Security Checklist

- [ ] All API keys are stored as environment variables (never in code)
- [ ] Production keys are different from test keys
- [ ] Webhook signature verification is enabled
- [ ] Rate limiting is configured on checkout and webhook endpoints
- [ ] RLS policies are enabled on sensitive tables
- [ ] HTTPS is enforced on all endpoints

---

## Quick Reference: Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Live secret key |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Live publishable key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signing secret |
| `STRIPE_PRICE_ID_GRID_PLUS` | Yes | Grid Plus price ID |
| `STRIPE_PRICE_ID_GRID_PLUS_PREMIUM` | Yes | Premium price ID |
| `STRIPE_PRICE_ID_CREATOR_PACK` | Yes | Creator Pack price ID |
| `SENDGRID_API_KEY` | Recommended | Email API key |
| `SENDGRID_FROM_EMAIL` | Recommended | Sender email |
| `SENDGRID_FROM_NAME` | Recommended | Sender name |

---

## Deployment Sign-Off

| Step | Completed | Date | Notes |
|------|-----------|------|-------|
| Pre-deployment tests pass | [ ] | | |
| Database migration applied | [ ] | | |
| Stripe products created | [ ] | | |
| Webhook endpoint configured | [ ] | | |
| Environment variables set | [ ] | | |
| Application deployed | [ ] | | |
| Test transaction successful | [ ] | | |
| Monitoring configured | [ ] | | |
