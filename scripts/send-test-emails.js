#!/usr/bin/env node
/**
 * send-test-emails.js
 *
 * Sends all transactional emails with realistic sample data so you can
 * visually inspect them in a real inbox or Inbucket.
 *
 * Usage:
 *   node scripts/send-test-emails.js --to you@example.com         # → real inbox via Postmark
 *   node scripts/send-test-emails.js --to you@example.com --only 3,7  # specific emails only
 *
 * Requirements for real inbox sends:
 *   - POSTMARK_SERVER_TOKEN set to a real token (not POSTMARK_API_TEST) in .env.local
 *   - NEXT_PUBLIC_APP_URL=https://gridmenu.ai in .env.local (so the logo URL resolves publicly)
 *
 * Inbucket (bundled with supabase start) UI at http://localhost:54324
 * Note: Inbucket only captures Supabase auth emails — it cannot receive app emails sent
 * via this script. Use --to with a real inbox for app email testing.
 */

require('dotenv').config({ path: '.env.local' })
const { ServerClient } = require('postmark')

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const toIndex = args.indexOf('--to')
const onlyIndex = args.indexOf('--only')

const TO = toIndex !== -1 ? args[toIndex + 1] : null
const ONLY = onlyIndex !== -1
  ? args[onlyIndex + 1].split(',').map(n => parseInt(n.trim(), 10))
  : null

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gridmenu.ai'
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@gridmenu.ai'
const FROM_NAME = process.env.FROM_NAME || 'GridMenu'
const COMPANY_NAME = process.env.COMPANY_NAME || FROM_NAME
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gridmenu.ai'

// Logo strategy:
// - If APP_URL is a real public domain (not localhost), use the hosted URL — works in all clients
// - Otherwise (localhost dev), embed as base64 — works in Mailpit and most clients except Gmail
const fs = require('fs')
const path = require('path')
const logoPath = path.join(__dirname, '..', 'public', 'logos', 'logo-400.png')
const isPublicUrl = APP_URL && !APP_URL.includes('localhost') && !APP_URL.includes('127.0.0.1')
const LOGO_URL = isPublicUrl
  ? `${APP_URL}/logos/logo-400.png`
  : `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`

if (!isPublicUrl) {
  console.warn('\nNote: APP_URL is localhost — logo will be base64 embedded.')
  console.warn('Gmail blocks data: URIs. Set NEXT_PUBLIC_APP_URL=https://gridmenu.ai in .env.local')
  console.warn('to use the hosted logo URL when testing with a real inbox.\n')
}

const recipient = TO || 'test@gridmenu.ai'

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const SAMPLE = {
  user: {
    id: 'usr_01HXYZ1234ABCDEF',
    email: recipient,
    restaurant_name: "Bella Cucina",
  },
  plan: {
    name: 'Grid+',
    amountDollars: '12.00',
  },
  planPremium: {
    name: 'Grid+ Premium',
    amountDollars: '29.00',
  },
  periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  export: {
    menuName: 'Summer Dinner Menu 2025',
    downloadUrl: `${APP_URL}/exports/sample-download-link-abc123`,
  },
  paymentFailReason: 'Your card has insufficient funds.',
  exportError: 'Puppeteer timed out after 60s — the menu may contain unsupported content.',
}

// ---------------------------------------------------------------------------
// HTML helpers (mirrors src/lib/notification-service.ts)
// ---------------------------------------------------------------------------
function emailShell(body) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #ffffff; padding: 24px 32px; border-radius: 8px 8px 0 0; text-align: center; border: 1px solid #01B3BF; border-bottom: 3px solid #01B3BF;">
        <img src="${LOGO_URL}" alt="${COMPANY_NAME}" width="160" height="auto"
             style="display: block; margin: 0 auto; max-width: 160px;"
             onerror="this.style.display='none'" />
      </div>
      <div style="padding: 32px; border: 1px solid #01B3BF; border-top: none; border-radius: 0 0 8px 8px;">
        ${body}
      </div>
    </div>`
}

function primaryButton(href, label) {
  return `
    <div style="margin: 28px 0;">
      <a href="${href}" style="display: inline-block; background-color: #01B3BF; color: #ffffff;
         padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
        ${label}
      </a>
    </div>`
}

function infoBox(content) {
  return `<div style="background-color: #f0fdfe; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #01B3BF;">${content}</div>`
}

function accentBox(content) {
  return `<div style="background-color: #fffbeb; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #F8BC02;">${content}</div>`
}

function errorBox(content) {
  return `<div style="background-color: #fff5f5; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #fc8181;">${content}</div>`
}

function signOff(line) {
  const text = line || `Thank you for choosing ${COMPANY_NAME},<br>The ${COMPANY_NAME} Team`
  return `<p style="color: #718096; font-size: 14px; margin-top: 32px; border-top: 1px solid #edf2f7; padding-top: 20px;">${text}</p>`
}

// ---------------------------------------------------------------------------
// Email definitions
// ---------------------------------------------------------------------------
function buildEmails() {
  const { user, plan, planPremium, periodEnd, export: exp, paymentFailReason, exportError } = SAMPLE
  const periodEndFormatted = periodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return [
    // 1 — Admin new user alert
    {
      num: 1,
      label: 'Admin — New Pilot Registration',
      to: ADMIN_EMAIL === 'admin@gridmenu.ai' ? recipient : ADMIN_EMAIL,
      subject: `New Pilot Registration: ${user.email}`,
      text: `A new user has registered and is pending approval.\n\nEmail: ${user.email}\nUser ID: ${user.id}\n\nApprove them here: ${APP_URL}/admin?tab=user-management`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">New Pilot Registration</h2>
        <p style="color: #4a5568; font-size: 16px;">A new user has registered and is awaiting your approval.</p>
        ${infoBox(`
          <p style="margin: 0; color: #4a5568;"><strong>Email:</strong> ${user.email}</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>User ID:</strong> ${user.id}</p>
        `)}
        ${primaryButton(`${APP_URL}/admin?tab=user-management`, 'Review in Admin Hub')}
      `),
    },

    // 2 — User approval / welcome
    {
      num: 2,
      label: 'User — Account Approved',
      to: recipient,
      subject: 'Welcome to GridMenu — your account is ready!',
      text: `Great news! Your GridMenu pilot account has been approved. You can now create your brand new menus!\n\nGet started here: ${APP_URL}/dashboard`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">You're In!</h2>
        <p style="color: #4a5568; font-size: 16px;">Your GridMenu pilot account has been approved.</p>
        <p style="color: #4a5568; font-size: 16px;">Head to your dashboard to start creating your first photo-perfect menu.</p>
        ${primaryButton(`${APP_URL}/dashboard`, 'Go to Dashboard')}
        ${signOff('Welcome aboard,<br>The GridMenu Team')}
      `),
    },

    // 3a — Subscription confirmation (Grid+)
    {
      num: 3,
      label: 'User — Subscription Confirmation (Grid+)',
      to: recipient,
      subject: `${COMPANY_NAME} — Welcome to ${plan.name} — your subscription is active!`,
      text: `Thank you for subscribing to ${plan.name}!\n\nYour subscription is now active and you have access to all ${plan.name} features.\n\nPlan: ${plan.name}\nAmount: $${plan.amountDollars}/month\n\nTo manage your subscription or update your payment method, visit your account settings: ${APP_URL}/dashboard/settings\n\nThank you for choosing ${COMPANY_NAME}!`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">Welcome to ${plan.name}!</h2>
        <p style="color: #4a5568; font-size: 16px;">Your subscription is now active and you have access to all ${plan.name} features.</p>
        ${infoBox(`
          <p style="margin: 0; color: #4a5568;"><strong>Plan:</strong> ${plan.name}</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Amount:</strong> $${plan.amountDollars}/month</p>
        `)}
        <p style="color: #4a5568; font-size: 16px;">You can manage your subscription, update your payment method, and view invoices from your account settings.</p>
        ${primaryButton(`${APP_URL}/dashboard/settings`, 'Manage Subscription')}
        ${signOff()}
      `),
    },

    // 3b — Subscription confirmation (Grid+ Premium)
    {
      num: 3,
      label: 'User — Subscription Confirmation (Grid+ Premium)',
      to: recipient,
      subject: `${COMPANY_NAME} — Welcome to ${planPremium.name} — your subscription is active!`,
      text: `Thank you for subscribing to ${planPremium.name}!\n\nYour subscription is now active and you have access to all ${planPremium.name} features.\n\nPlan: ${planPremium.name}\nAmount: $${planPremium.amountDollars}/month\n\nTo manage your subscription or update your payment method, visit your account settings: ${APP_URL}/dashboard/settings\n\nThank you for choosing ${COMPANY_NAME}!`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">Welcome to ${planPremium.name}!</h2>
        <p style="color: #4a5568; font-size: 16px;">Your subscription is now active and you have access to all ${planPremium.name} features.</p>
        ${infoBox(`
          <p style="margin: 0; color: #4a5568;"><strong>Plan:</strong> ${planPremium.name}</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Amount:</strong> $${planPremium.amountDollars}/month</p>
        `)}
        <p style="color: #4a5568; font-size: 16px;">You can manage your subscription, update your payment method, and view invoices from your account settings.</p>
        ${primaryButton(`${APP_URL}/dashboard/settings`, 'Manage Subscription')}
        ${signOff()}
      `),
    },

    // 4a — Creator Pack (paid)
    {
      num: 4,
      label: 'User — Creator Pack Confirmation (paid)',
      to: recipient,
      subject: `${COMPANY_NAME} — Your Creator Pack purchase is confirmed`,
      text: `Thank you for purchasing a Creator Pack!\n\nYou can now create one additional menu with full editing capabilities.\n\nPack Details:\n- Valid for: 24 months\n- Edit window: 7 days from creation\n- Additional menus: 1\n- Exported PDF menu storage: 30 days\n\nStart creating: ${APP_URL}/dashboard\n\nThank you for choosing ${COMPANY_NAME}!`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">Creator Pack Confirmed</h2>
        <p style="color: #4a5568; font-size: 16px;">Thank you for purchasing a Creator Pack!</p>
        <p style="color: #4a5568; font-size: 16px;">You can now create one additional menu with full editing capabilities.</p>
        ${accentBox(`
          <p style="margin: 0; color: #4a5568;"><strong>Pack Type:</strong> Creator Pack</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Valid for:</strong> 24 months</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Edit window:</strong> 7 days from creation</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Additional menus:</strong> 1</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Exported PDF menu storage:</strong> 30 days</p>
        `)}
        ${primaryButton(`${APP_URL}/dashboard`, 'Start Creating')}
        ${signOff()}
      `),
    },

    // 4b — Creator Pack (free)
    {
      num: 4,
      label: 'User — Creator Pack Confirmation (free)',
      to: recipient,
      subject: `${COMPANY_NAME} — Your free Creator Pack is ready!`,
      text: `Your free Creator Pack has been added to your account!\n\nYou can now create one additional menu with full editing capabilities.\n\nPack Details:\n- Valid for: 24 months\n- Edit window: 7 days from creation\n- Additional menus: 1\n- Exported PDF menu storage: 30 days\n\nStart creating: ${APP_URL}/dashboard\n\nThank you for choosing ${COMPANY_NAME}!`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">Your Free Creator Pack is Ready!</h2>
        <p style="color: #4a5568; font-size: 16px;">Your free Creator Pack has been added to your account!</p>
        <p style="color: #4a5568; font-size: 16px;">You can now create one additional menu with full editing capabilities.</p>
        ${accentBox(`
          <p style="margin: 0; color: #4a5568;"><strong>Pack Type:</strong> Creator Pack (Free)</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Valid for:</strong> 24 months</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Edit window:</strong> 7 days from creation</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Additional menus:</strong> 1</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Exported PDF menu storage:</strong> 30 days</p>
        `)}
        ${primaryButton(`${APP_URL}/dashboard`, 'Start Creating')}
        ${signOff()}
      `),
    },

    // 5 — Payment failed
    {
      num: 5,
      label: 'User — Payment Failed',
      to: recipient,
      subject: `${COMPANY_NAME} — Payment failed — action required`,
      text: `We were unable to process your payment.\n\nReason: ${paymentFailReason}\n\nPlease update your payment method to continue using ${COMPANY_NAME} premium features.\n\nUpdate payment method: ${APP_URL}/upgrade\n\nIf you have questions, please contact our support team.`,
      html: emailShell(`
        <h2 style="color: #c53030; margin-top: 0;">Payment Failed</h2>
        <p style="color: #4a5568; font-size: 16px;">We were unable to process your payment for your ${COMPANY_NAME} subscription.</p>
        ${errorBox(`<p style="margin: 0; color: #742a2a;"><strong>Reason:</strong> ${paymentFailReason}</p>`)}
        <p style="color: #4a5568; font-size: 16px;">Please update your payment method to continue using premium features.</p>
        ${primaryButton(`${APP_URL}/dashboard/settings`, 'Update Payment Method')}
        <p style="color: #718096; font-size: 14px; margin-top: 32px; border-top: 1px solid #edf2f7; padding-top: 20px;">
          If you have questions, please contact our support team.<br>The ${COMPANY_NAME} Team
        </p>
      `),
    },

    // 6a — Cancellation scheduled (cancel_at_period_end = true)
    {
      num: 6,
      label: 'User — Cancellation Scheduled',
      to: recipient,
      subject: `${COMPANY_NAME} — Your subscription will be cancelled`,
      text: `Your ${COMPANY_NAME} subscription has been set to cancel at the end of the current billing period.\n\nYou will keep access to all premium features until ${periodEndFormatted}.\n\nChanged your mind? You can reactivate your subscription before that date: ${APP_URL}/dashboard/settings\n\nThank you for using ${COMPANY_NAME}!`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">Cancellation Scheduled</h2>
        <p style="color: #4a5568; font-size: 16px;">Your ${COMPANY_NAME} subscription is set to cancel at the end of your current billing period.</p>
        ${accentBox(`<p style="margin: 0; color: #4a5568;"><strong>Access until:</strong> ${periodEndFormatted}</p>`)}
        <p style="color: #4a5568; font-size: 16px;">You'll keep full access to all premium features until ${periodEndFormatted}. No further charges will be made.</p>
        <p style="color: #4a5568; font-size: 16px;">Changed your mind? You can reactivate your subscription before that date.</p>
        ${primaryButton(`${APP_URL}/dashboard/settings`, 'Manage Subscription')}
        ${signOff()}
      `),
    },

    // 6b — Subscription cancelled (subscription.deleted fires at period end)
    {
      num: 6,
      label: 'User — Subscription Cancelled',
      to: recipient,
      subject: `${COMPANY_NAME} — Your subscription has been cancelled`,
      text: `Your ${COMPANY_NAME} subscription has been cancelled.\n\nYou will continue to have access to premium features until ${periodEndFormatted}.\n\nAfter this date, your account will be downgraded to the free plan.\n\nIf you change your mind, you can resubscribe at any time: ${APP_URL}/dashboard/settings\n\nThank you for using ${COMPANY_NAME}!`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">Subscription Cancelled</h2>
        <p style="color: #4a5568; font-size: 16px;">Your ${COMPANY_NAME} subscription has been cancelled.</p>
        ${accentBox(`<p style="margin: 0; color: #4a5568;"><strong>Access until:</strong> ${periodEndFormatted}</p>`)}
        <p style="color: #4a5568; font-size: 16px;">You'll keep access to premium features until ${periodEndFormatted}, then your account moves to the free plan.</p>
        <p style="color: #4a5568; font-size: 16px;">Changed your mind? You can resubscribe at any time.</p>
        ${primaryButton(`${APP_URL}/dashboard/settings`, 'Manage Subscription')}
        ${signOff()}
      `),
    },

    // 7 — Export ready (PDF)
    {
      num: 7,
      label: 'User — Export Ready (PDF)',
      to: recipient,
      subject: `${COMPANY_NAME} — Your PDF export is ready: ${exp.menuName}`,
      text: `Your PDF export for "${exp.menuName}" is ready!\n\nDownload your file using the link below. This link is valid for 7 days. Your file is stored for 30 days — you can re-download it from your dashboard at any time during that period.\n\nDownload: ${exp.downloadUrl}\n\nMenu: ${exp.menuName}\nType: PDF\n\nThank you for using ${COMPANY_NAME}!`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">Your Export is Ready!</h2>
        <p style="color: #4a5568; font-size: 16px;">Your PDF export for <strong>"${exp.menuName}"</strong> has been successfully generated.</p>
        ${infoBox(`
          <p style="margin: 0; color: #4a5568;"><strong>Menu:</strong> ${exp.menuName}</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Type:</strong> PDF</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>File stored for:</strong> 30 days</p>
        `)}
        <p style="color: #4a5568; font-size: 16px;">Click below to download your file. This link is valid for 7 days.</p>
        ${primaryButton(exp.downloadUrl, 'Download PDF')}
        <p style="color: #718096; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #01B3BF; font-size: 14px; word-break: break-all;">${exp.downloadUrl}</p>
        <p style="color: #718096; font-size: 14px;">You can also re-download this file from your dashboard for up to <strong>30 days</strong> after export.</p>
        ${signOff()}
      `),
    },

    // 7b — Export ready (Image)
    {
      num: 7,
      label: 'User — Export Ready (Image)',
      to: recipient,
      subject: `${COMPANY_NAME} — Your Image export is ready: ${exp.menuName}`,
      text: `Your Image export for "${exp.menuName}" is ready!\n\nDownload your file using the link below. This link is valid for 7 days. Your file is stored for 30 days — you can re-download it from your dashboard at any time during that period.\n\nDownload: ${exp.downloadUrl}\n\nMenu: ${exp.menuName}\nType: Image\n\nThank you for using ${COMPANY_NAME}!`,
      html: emailShell(`
        <h2 style="color: #1a202c; margin-top: 0;">Your Export is Ready!</h2>
        <p style="color: #4a5568; font-size: 16px;">Your Image export for <strong>"${exp.menuName}"</strong> has been successfully generated.</p>
        ${infoBox(`
          <p style="margin: 0; color: #4a5568;"><strong>Menu:</strong> ${exp.menuName}</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Type:</strong> Image</p>
          <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>File stored for:</strong> 30 days</p>
        `)}
        <p style="color: #4a5568; font-size: 16px;">Click below to download your file. This link is valid for 7 days.</p>
        ${primaryButton(exp.downloadUrl, 'Download Image')}
        <p style="color: #718096; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #01B3BF; font-size: 14px; word-break: break-all;">${exp.downloadUrl}</p>
        <p style="color: #718096; font-size: 14px;">You can also re-download this file from your dashboard for up to <strong>30 days</strong> after export.</p>
        ${signOff()}
      `),
    },

    // 8 — Export failed
    {
      num: 8,
      label: 'User — Export Failed',
      to: recipient,
      subject: `${COMPANY_NAME} — Export failed: ${exp.menuName} (PDF)`,
      text: `We were unable to complete your PDF export for "${exp.menuName}".\n\nError: ${exportError}\n\nMenu: ${exp.menuName}\nType: PDF\n\nPlease try again or contact support if the problem persists.\n\nSupport: ${APP_URL}/support`,
      html: emailShell(`
        <h2 style="color: #c53030; margin-top: 0;">Export Failed</h2>
        <p style="color: #4a5568; font-size: 16px;">We were unable to complete your PDF export for <strong>"${exp.menuName}"</strong>.</p>
        ${errorBox(`
          <p style="margin: 0; color: #742a2a;"><strong>Menu:</strong> ${exp.menuName}</p>
          <p style="margin: 6px 0 0 0; color: #742a2a;"><strong>Type:</strong> PDF</p>
          <p style="margin: 10px 0 0 0; color: #742a2a;"><strong>Error:</strong> ${exportError}</p>
        `)}
        <p style="color: #4a5568; font-size: 16px;">Please try exporting again. If the problem persists, contact our support team.</p>
        ${primaryButton(`${APP_URL}/support`, 'Contact Support')}
        <p style="color: #718096; font-size: 14px; margin-top: 32px; border-top: 1px solid #edf2f7; padding-top: 20px;">
          We apologise for the inconvenience,<br>The ${COMPANY_NAME} Team
        </p>
      `),
    },
  ]
}

// ---------------------------------------------------------------------------
// Send via Postmark
// ---------------------------------------------------------------------------
async function sendViaPostmark(emails) {
  const token = process.env.POSTMARK_SERVER_TOKEN
  if (!token || token === 'POSTMARK_API_TEST') {
    console.error('\nError: POSTMARK_SERVER_TOKEN is not set or is the test token.')
    console.error('Set a real token in .env.local to send to a real inbox.\n')
    process.exit(1)
  }

  const client = new ServerClient(token)
  const stream = process.env.POSTMARK_TRANSACTIONAL_STREAM || 'outbound'

  for (const email of emails) {
    process.stdout.write(`  Sending [${email.num}] ${email.label}... `)
    try {
      const result = await client.sendEmail({
        From: `${FROM_NAME} <${FROM_EMAIL}>`,
        To: email.to,
        Subject: email.subject,
        TextBody: email.text,
        HtmlBody: email.html,
        MessageStream: stream,
      })
      if (result.ErrorCode === 0) {
        console.log(`✓  (MessageID: ${result.MessageID})`)
      } else {
        console.log(`✗  ErrorCode ${result.ErrorCode}: ${result.Message}`)
      }
    } catch (err) {
      console.log(`✗  ${err.message}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!TO) {
    console.error('\nUsage: node scripts/send-test-emails.js --to you@example.com [--only 1,3,7]')
    console.error('\nTip: set NEXT_PUBLIC_APP_URL=https://gridmenu.ai in .env.local so the logo resolves.\n')
    process.exit(1)
  }

  let emails = buildEmails()

  if (ONLY) {
    emails = emails.filter(e => ONLY.includes(e.num))
    if (emails.length === 0) {
      console.error(`No emails matched --only ${ONLY.join(',')}`)
      process.exit(1)
    }
  }

  console.log(`\nGridMenu email test — sending ${emails.length} email(s) via Postmark → ${TO}\n`)
  await sendViaPostmark(emails)

  console.log('\nDone.\n')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
