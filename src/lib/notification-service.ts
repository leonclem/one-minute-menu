import { sendEmail } from './email-client'
import { createWorkerSupabaseClient } from '@/lib/supabase-worker'

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@gridmenu.ai'
const FROM_NAME = process.env.FROM_NAME || 'GridMenu'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gridmenu.ai'

const COMPANY_NAME = process.env.COMPANY_NAME || FROM_NAME
const COMPANY_MAILING_ADDRESS = process.env.COMPANY_MAILING_ADDRESS || ''
const COMPANY_SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || FROM_EMAIL

const LOGO_URL = `${APP_URL}/logos/logo-400.png`

function withCompanyPrefix(subject: string): string {
  if (subject.toLowerCase().startsWith(COMPANY_NAME.toLowerCase())) return subject
  return `${COMPANY_NAME} — ${subject}`
}

function renderComplianceFooterText(): string {
  const lines: string[] = []
  if (COMPANY_MAILING_ADDRESS.trim()) lines.push(COMPANY_MAILING_ADDRESS.trim())
  if (COMPANY_SUPPORT_EMAIL.trim()) lines.push(`Support: ${COMPANY_SUPPORT_EMAIL.trim()}`)
  if (lines.length === 0) return ''
  return `\n\n—\n${COMPANY_NAME}\n${lines.join('\n')}`
}

function renderComplianceFooterHtml(): string {
  const address = COMPANY_MAILING_ADDRESS.trim()
  const support = COMPANY_SUPPORT_EMAIL.trim()
  if (!address && !support) return ''
  return `
    <div style="margin-top: 24px; border-top: 1px solid #edf2f7; padding-top: 16px; color: #718096; font-size: 12px; line-height: 1.5;">
      <div style="font-weight: 600; color: #4a5568;">${COMPANY_NAME}</div>
      ${address ? `<div>${address}</div>` : ''}
      ${support ? `<div>Support: <a href="mailto:${support}" style="color: #01B3BF; text-decoration: none;">${support}</a></div>` : ''}
    </div>
  `
}

/** Wraps email body content in the standard branded shell. */
function emailShell(body: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header -->
      <div style="background-color: #ffffff; padding: 24px 32px; border-radius: 8px 8px 0 0; text-align: center; border: 1px solid #01B3BF; border-bottom: 3px solid #01B3BF;">
        <img src="${LOGO_URL}" alt="${COMPANY_NAME}" width="160" height="auto"
             style="display: block; margin: 0 auto; max-width: 160px;"
             onerror="this.style.display='none'" />
      </div>
      <!-- Body -->
      <div style="padding: 32px; border: 1px solid #01B3BF; border-top: none; border-radius: 0 0 8px 8px;">
        ${body}
      </div>
    </div>
  `
}

/** Primary CTA button — brand primary #01B3BF. */
function primaryButton(href: string, label: string): string {
  return `
    <div style="margin: 28px 0;">
      <a href="${href}"
         style="display: inline-block; background-color: #01B3BF; color: #ffffff; padding: 12px 28px;
                text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
        ${label}
      </a>
    </div>
  `
}

/** Secondary/accent highlight box — brand secondary #F8BC02. */
function accentBox(content: string): string {
  return `
    <div style="background-color: #fffbeb; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #F8BC02;">
      ${content}
    </div>
  `
}

/** Info box using brand primary tint. */
function infoBox(content: string): string {
  return `
    <div style="background-color: #f0fdfe; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #01B3BF;">
      ${content}
    </div>
  `
}

/** Warning/error box. */
function errorBox(content: string): string {
  return `
    <div style="background-color: #fff5f5; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #fc8181;">
      ${content}
    </div>
  `
}

/** Standard email sign-off. */
function signOff(line = `Thank you for choosing ${COMPANY_NAME},<br>The ${COMPANY_NAME} Team`): string {
  return `
    <p style="color: #718096; font-size: 14px; margin-top: 32px; border-top: 1px solid #edf2f7; padding-top: 20px;">
      ${line}
    </p>
  `
}

const getServiceClient = () => createWorkerSupabaseClient()

/**
 * Notification service for sending transactional emails via Postmark.
 */
export const notificationService = {

  async sendSubscriptionConfirmation(
    userId: string,
    plan: 'grid_plus' | 'grid_plus_premium',
    amountCents: number
  ): Promise<void> {
    try {
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles').select('email, restaurant_name').eq('id', userId).single()
      if (error || !profile) { console.error('[notification-service] Failed to fetch profile:', error); return }

      const planName = plan === 'grid_plus_premium' ? 'Grid+ Premium' : 'Grid+'
      const amountDollars = (amountCents / 100).toFixed(2)

      await sendEmail({
        to: profile.email,
        from: FROM_EMAIL,
        fromName: FROM_NAME,
        subject: withCompanyPrefix(`Welcome to ${planName} — your subscription is active`),
        text: `Thank you for subscribing to ${planName}!\n\nYour subscription is now active and you have access to all ${planName} features.\n\nPlan: ${planName}\nAmount: ${amountDollars}/month\n\nTo manage your subscription or update your payment method, visit your account settings: ${APP_URL}/dashboard/settings\n\nThank you for choosing ${COMPANY_NAME}!${renderComplianceFooterText()}`,
        html: emailShell(`
          <h2 style="color: #1a202c; margin-top: 0;">Welcome to ${planName}!</h2>
          <p style="color: #4a5568; font-size: 16px;">Your subscription is now active and you have access to all ${planName} features.</p>
          ${infoBox(`
            <p style="margin: 0; color: #4a5568;"><strong>Plan:</strong> ${planName}</p>
            <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Amount:</strong> $${amountDollars}/month</p>
          `)}
          ${primaryButton(`${APP_URL}/dashboard/settings`, 'Manage Subscription')}
          ${signOff()}
          ${renderComplianceFooterHtml()}
        `),
      })
      console.log(`[notification-service] Subscription confirmation sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send subscription confirmation:', error)
    }
  },

  async sendCreatorPackConfirmation(userId: string, isFree: boolean): Promise<void> {
    try {
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles').select('email, restaurant_name').eq('id', userId).single()
      if (error || !profile) { console.error('[notification-service] Failed to fetch profile:', error); return }

      const subject = isFree ? 'Your free Creator Pack is ready!' : 'Your Creator Pack purchase is confirmed'
      const greeting = isFree
        ? 'Your free Creator Pack has been added to your account!'
        : 'Thank you for purchasing a Creator Pack!'

      await sendEmail({
        to: profile.email,
        from: FROM_EMAIL,
        fromName: FROM_NAME,
        subject: withCompanyPrefix(subject),
        text: `${greeting}\n\nYou can now create one additional menu with full editing capabilities.\n\nPack Details:\n- Valid for: 24 months\n- Edit window: 7 days from creation\n- Additional menus: 1\n\nStart creating: ${APP_URL}/dashboard\n\nThank you for choosing ${COMPANY_NAME}!${renderComplianceFooterText()}`,
        html: emailShell(`
          <h2 style="color: #1a202c; margin-top: 0;">${isFree ? 'Your Free Creator Pack is Ready!' : 'Creator Pack Confirmed'}</h2>
          <p style="color: #4a5568; font-size: 16px;">${greeting}</p>
          <p style="color: #4a5568; font-size: 16px;">You can now create one additional menu with full editing capabilities.</p>
          ${accentBox(`
            <p style="margin: 0; color: #4a5568;"><strong>Pack Type:</strong> Creator Pack${isFree ? ' (Free)' : ''}</p>
            <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Valid for:</strong> 24 months</p>
            <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Edit window:</strong> 7 days from creation</p>
            <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Additional menus:</strong> 1</p>
          `)}
          ${primaryButton(`${APP_URL}/dashboard`, 'Start Creating')}
          ${signOff()}
          ${renderComplianceFooterHtml()}
        `),
      })
      console.log(`[notification-service] Creator Pack confirmation sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send Creator Pack confirmation:', error)
    }
  },

  async sendPaymentFailedNotification(userId: string, reason: string): Promise<void> {
    try {
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles').select('email, restaurant_name').eq('id', userId).single()
      if (error || !profile) { console.error('[notification-service] Failed to fetch profile:', error); return }

      await sendEmail({
        to: profile.email,
        from: FROM_EMAIL,
        fromName: FROM_NAME,
        subject: withCompanyPrefix('Payment failed — action required'),
        text: `We were unable to process your payment.\n\nReason: ${reason}\n\nPlease update your payment method to continue using ${COMPANY_NAME} premium features.\n\nUpdate payment method: ${APP_URL}/dashboard/settings\n\nIf you have questions, please contact our support team.${renderComplianceFooterText()}`,
        html: emailShell(`
          <h2 style="color: #c53030; margin-top: 0;">Payment Failed</h2>
          <p style="color: #4a5568; font-size: 16px;">We were unable to process your payment for your ${COMPANY_NAME} subscription.</p>
          ${errorBox(`
            <p style="margin: 0; color: #742a2a;"><strong>Reason:</strong> ${reason}</p>
          `)}
          <p style="color: #4a5568; font-size: 16px;">Please update your payment method to continue using premium features.</p>
          ${primaryButton(`${APP_URL}/dashboard/settings`, 'Update Payment Method')}
          <p style="color: #718096; font-size: 14px; margin-top: 32px; border-top: 1px solid #edf2f7; padding-top: 20px;">
            If you have questions, please contact our support team.<br>The ${COMPANY_NAME} Team
          </p>
          ${renderComplianceFooterHtml()}
        `),
      })
      console.log(`[notification-service] Payment failed notification sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send payment failed notification:', error)
    }
  },

  async sendCancellationScheduledNotification(userId: string, periodEnd: Date): Promise<void> {
    try {
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles').select('email, restaurant_name').eq('id', userId).single()
      if (error || !profile) { console.error('[notification-service] Failed to fetch profile:', error); return }

      const periodEndFormatted = periodEnd.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })

      await sendEmail({
        to: profile.email,
        from: FROM_EMAIL,
        fromName: FROM_NAME,
        subject: withCompanyPrefix('Your subscription will be cancelled'),
        text: `Your ${COMPANY_NAME} subscription has been set to cancel at the end of the current billing period.\n\nYou will keep access to all premium features until ${periodEndFormatted}.\n\nChanged your mind? You can reactivate your subscription before that date: ${APP_URL}/dashboard/settings\n\nThank you for using ${COMPANY_NAME}!${renderComplianceFooterText()}`,
        html: emailShell(`
          <h2 style="color: #1a202c; margin-top: 0;">Cancellation Scheduled</h2>
          <p style="color: #4a5568; font-size: 16px;">Your ${COMPANY_NAME} subscription is set to cancel at the end of your current billing period.</p>
          ${accentBox(`
            <p style="margin: 0; color: #4a5568;"><strong>Access until:</strong> ${periodEndFormatted}</p>
          `)}
          <p style="color: #4a5568; font-size: 16px;">You'll keep full access to all premium features until ${periodEndFormatted}. No further charges will be made.</p>
          <p style="color: #4a5568; font-size: 16px;">Changed your mind? You can reactivate your subscription before that date.</p>
          ${primaryButton(`${APP_URL}/dashboard/settings`, 'Manage Subscription')}
          ${signOff()}
          ${renderComplianceFooterHtml()}
        `),
      })
      console.log(`[notification-service] Cancellation scheduled notification sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send cancellation scheduled notification:', error)
    }
  },

  async sendSubscriptionCancelledNotification(userId: string, periodEnd: Date): Promise<void> {
    try {
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles').select('email, restaurant_name').eq('id', userId).single()
      if (error || !profile) { console.error('[notification-service] Failed to fetch profile:', error); return }

      const periodEndFormatted = periodEnd.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })

      await sendEmail({
        to: profile.email,
        from: FROM_EMAIL,
        fromName: FROM_NAME,
        subject: withCompanyPrefix('Your subscription has been cancelled'),
        text: `Your ${COMPANY_NAME} subscription has been cancelled.\n\nYou will continue to have access to premium features until ${periodEndFormatted}.\n\nAfter this date, your account will be downgraded to the free plan.\n\nIf you change your mind, you can resubscribe at any time: ${APP_URL}/pricing\n\nThank you for using ${COMPANY_NAME}!${renderComplianceFooterText()}`,
        html: emailShell(`
          <h2 style="color: #1a202c; margin-top: 0;">Subscription Cancelled</h2>
          <p style="color: #4a5568; font-size: 16px;">Your ${COMPANY_NAME} subscription has been cancelled.</p>
          ${accentBox(`
            <p style="margin: 0; color: #4a5568;"><strong>Access until:</strong> ${periodEndFormatted}</p>
          `)}
          <p style="color: #4a5568; font-size: 16px;">You'll keep access to premium features until ${periodEndFormatted}, then your account moves to the free plan.</p>
          <p style="color: #4a5568; font-size: 16px;">Changed your mind? You can resubscribe at any time.</p>
          ${primaryButton(`${APP_URL}/pricing`, 'Re-subscribe')}
          ${signOff()}
          ${renderComplianceFooterHtml()}
        `),
      })
      console.log(`[notification-service] Subscription cancelled notification sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send subscription cancelled notification:', error)
    }
  },

  async sendExportCompletionEmail(
    userId: string,
    downloadUrl: string,
    menuName: string,
    exportType: 'pdf' | 'image'
  ): Promise<void> {
    try {
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles').select('email, restaurant_name').eq('id', userId).single()
      if (error || !profile) { console.error('[notification-service] Failed to fetch profile:', error); return }

      const exportTypeLabel = exportType === 'pdf' ? 'PDF' : 'Image'

      await sendEmail({
        to: profile.email,
        from: FROM_EMAIL,
        fromName: FROM_NAME,
        subject: withCompanyPrefix(`Your ${exportTypeLabel} export is ready: ${menuName}`),
        // Disable click tracking — Outlook/Edge flags tracked download redirects as unsafe
        disableClickTracking: true,
        text: `Your ${exportTypeLabel} export for "${menuName}" is ready!\n\nDownload your file using the link below. This link is valid for 7 days.\n\nDownload: ${downloadUrl}\n\nMenu: ${menuName}\nType: ${exportTypeLabel}\n\nThank you for using ${COMPANY_NAME}!${renderComplianceFooterText()}`,
        html: emailShell(`
          <h2 style="color: #1a202c; margin-top: 0;">Your Export is Ready!</h2>
          <p style="color: #4a5568; font-size: 16px;">Your ${exportTypeLabel} export for <strong>"${menuName}"</strong> has been successfully generated.</p>
          ${infoBox(`
            <p style="margin: 0; color: #4a5568;"><strong>Menu:</strong> ${menuName}</p>
            <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>Type:</strong> ${exportTypeLabel}</p>
          `)}
          <p style="color: #4a5568; font-size: 16px;">Click below to download your file. This link is valid for 7 days.</p>
          ${primaryButton(downloadUrl, `Download ${exportTypeLabel}`)}
          <p style="color: #718096; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #01B3BF; font-size: 14px; word-break: break-all;">${downloadUrl}</p>
          ${signOff()}
          ${renderComplianceFooterHtml()}
        `),
      })
      console.log(`[notification-service] Export completion email sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send export completion email:', error)
    }
  },

  async sendExportFailureEmail(
    userId: string,
    menuName: string,
    exportType: 'pdf' | 'image',
    errorMessage: string
  ): Promise<void> {
    try {
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles').select('email, restaurant_name').eq('id', userId).single()
      if (error || !profile) { console.error('[notification-service] Failed to fetch profile:', error); return }

      const exportTypeLabel = exportType === 'pdf' ? 'PDF' : 'Image'

      await sendEmail({
        to: profile.email,
        from: FROM_EMAIL,
        fromName: FROM_NAME,
        subject: withCompanyPrefix(`Export failed: ${menuName} (${exportTypeLabel})`),
        text: `We were unable to complete your ${exportTypeLabel} export for "${menuName}".\n\nError: ${errorMessage}\n\nMenu: ${menuName}\nType: ${exportTypeLabel}\n\nPlease try again or contact support if the problem persists.\n\nSupport: ${APP_URL}/support${renderComplianceFooterText()}`,
        html: emailShell(`
          <h2 style="color: #c53030; margin-top: 0;">Export Failed</h2>
          <p style="color: #4a5568; font-size: 16px;">We were unable to complete your ${exportTypeLabel} export for <strong>"${menuName}"</strong>.</p>
          ${errorBox(`
            <p style="margin: 0; color: #742a2a;"><strong>Menu:</strong> ${menuName}</p>
            <p style="margin: 6px 0 0 0; color: #742a2a;"><strong>Type:</strong> ${exportTypeLabel}</p>
            <p style="margin: 10px 0 0 0; color: #742a2a;"><strong>Error:</strong> ${errorMessage}</p>
          `)}
          <p style="color: #4a5568; font-size: 16px;">Please try exporting again. If the problem persists, contact our support team.</p>
          ${primaryButton(`${APP_URL}/support`, 'Contact Support')}
          <p style="color: #718096; font-size: 14px; margin-top: 32px; border-top: 1px solid #edf2f7; padding-top: 20px;">
            We apologise for the inconvenience,<br>The ${COMPANY_NAME} Team
          </p>
          ${renderComplianceFooterHtml()}
        `),
      })
      console.log(`[notification-service] Export failure email sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send export failure email:', error)
    }
  },
}
