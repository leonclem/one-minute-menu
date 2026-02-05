import sgMail from '@sendgrid/mail'
import { createWorkerSupabaseClient } from '@/lib/supabase-worker'

// Initialize SendGrid with API Key from environment variables
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || 'noreply@gridmenu.ai'
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'GridMenu'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gridmenu.ai'

// Deliverability / legitimacy helpers (best-effort; no hardcoded real-world address)
const COMPANY_NAME = process.env.COMPANY_NAME || process.env.SENDGRID_COMPANY_NAME || FROM_NAME
const COMPANY_MAILING_ADDRESS =
  process.env.COMPANY_MAILING_ADDRESS ||
  process.env.SENDGRID_COMPANY_MAILING_ADDRESS ||
  ''
const COMPANY_SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL ||
  process.env.SENDGRID_SUPPORT_EMAIL ||
  FROM_EMAIL

function withCompanyPrefix(subject: string): string {
  // Avoid double-prefixing if already present
  if (subject.toLowerCase().startsWith(COMPANY_NAME.toLowerCase())) return subject
  return `${COMPANY_NAME} — ${subject}`
}

function renderComplianceFooterText(): string {
  const lines: string[] = []
  if (COMPANY_MAILING_ADDRESS.trim()) {
    lines.push(COMPANY_MAILING_ADDRESS.trim())
  }
  if (COMPANY_SUPPORT_EMAIL.trim()) {
    lines.push(`Support: ${COMPANY_SUPPORT_EMAIL.trim()}`)
  }
  if (lines.length === 0) return ''
  return `\n\n—\n${COMPANY_NAME}\n${lines.join('\n')}`
}

function renderComplianceFooterHtml(): string {
  const address = COMPANY_MAILING_ADDRESS.trim()
  const support = COMPANY_SUPPORT_EMAIL.trim()
  if (!address && !support) return ''

  return `
    <div style="margin-top: 32px; border-top: 1px solid #edf2f7; padding-top: 16px; color: #718096; font-size: 12px; line-height: 1.5;">
      <div style="font-weight: 600; color: #4a5568;">${COMPANY_NAME}</div>
      ${address ? `<div>${address}</div>` : ''}
      ${support ? `<div>Support: <a href="mailto:${support}" style="color: #3182ce; text-decoration: none;">${support}</a></div>` : ''}
    </div>
  `
}

/**
 * Helper to create a Supabase client compatible with both Next.js and Worker environments.
 * It uses the worker client which bypasses cookie issues.
 */
const getServiceClient = () => {
  return createWorkerSupabaseClient()
}

/**
 * Notification service for sending payment-related emails
 * Integrates with SendGrid API for transactional emails
 */
export const notificationService = {
  /**
   * Sends a subscription confirmation email after successful subscription purchase
   * @param userId - The user ID
   * @param plan - The subscription plan (grid_plus or grid_plus_premium)
   * @param amountCents - The amount paid in cents
   */
  async sendSubscriptionConfirmation(
    userId: string,
    plan: 'grid_plus' | 'grid_plus_premium',
    amountCents: number
  ): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('[notification-service] SENDGRID_API_KEY missing. Skipping subscription confirmation email.')
      return
    }

    try {
      // Get user details from database
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email, restaurant_name')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        console.error('[notification-service] Failed to fetch user profile:', error)
        return
      }

      const planName = plan === 'grid_plus_premium' ? 'Grid+ Premium' : 'Grid+'
      const amountDollars = (amountCents / 100).toFixed(2)

      const msg = {
        to: profile.email,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME
        },
        subject: withCompanyPrefix(`Welcome to ${planName}! Your subscription is active`),
        text: `Thank you for subscribing to ${planName}!\n\nYour subscription is now active and you have access to all premium features.\n\nAmount: $${amountDollars}\nPlan: ${planName}\n\nManage your subscription: ${APP_URL}/upgrade\n\nThank you for choosing ${COMPANY_NAME}!${renderComplianceFooterText()}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1a202c; margin-top: 0;">Welcome to ${planName}!</h2>
            <p style="color: #4a5568; font-size: 16px;">Thank you for subscribing to ${planName}. Your subscription is now active and you have access to all premium features.</p>
            <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #4a5568;"><strong>Plan:</strong> ${planName}</p>
              <p style="margin: 5px 0 0 0; color: #4a5568;"><strong>Amount:</strong> $${amountDollars}/month</p>
            </div>
            <p style="color: #4a5568; font-size: 16px;">You can manage your subscription, update payment methods, and view invoices at any time.</p>
            <div style="margin: 30px 0;">
              <a href="${APP_URL}/upgrade" 
                 style="display: inline-block; background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Manage Subscription
              </a>
            </div>
            <p style="color: #718096; font-size: 14px; margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px;">
              Thank you for choosing GridMenu,<br>The GridMenu Team
            </p>
            ${renderComplianceFooterHtml()}
          </div>
        `,
      }

      await sgMail.send(msg)
      console.log(`[notification-service] Subscription confirmation sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send subscription confirmation:', error)
      // Don't throw - email failure shouldn't break fulfillment
    }
  },

  /**
   * Sends a Creator Pack confirmation email after successful purchase
   * @param userId - The user ID
   * @param isFree - Whether this is a free trial pack
   */
  async sendCreatorPackConfirmation(
    userId: string,
    isFree: boolean
  ): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('[notification-service] SENDGRID_API_KEY missing. Skipping Creator Pack confirmation email.')
      return
    }

    try {
      // Get user details from database
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email, restaurant_name')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        console.error('[notification-service] Failed to fetch user profile:', error)
        return
      }

      const subject = isFree 
        ? 'Your free Creator Pack is ready!' 
        : 'Your Creator Pack purchase is confirmed'
      
      const greeting = isFree
        ? 'Your free Creator Pack has been added to your account!'
        : 'Thank you for purchasing a Creator Pack!'

      const msg = {
        to: profile.email,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME
        },
        subject: withCompanyPrefix(subject),
        text: `${greeting}\n\nYou can now create one additional menu with full editing capabilities.\n\nPack Details:\n- Valid for: 24 months\n- Edit window: 7 days from creation\n- Additional menus: 1\n\nStart creating: ${APP_URL}/dashboard\n\nThank you for choosing ${COMPANY_NAME}!${renderComplianceFooterText()}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1a202c; margin-top: 0;">${isFree ? 'Your Free Creator Pack is Ready!' : 'Creator Pack Confirmed'}</h2>
            <p style="color: #4a5568; font-size: 16px;">${greeting}</p>
            <p style="color: #4a5568; font-size: 16px;">You can now create one additional menu with full editing capabilities.</p>
            <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #4a5568;"><strong>Pack Type:</strong> Creator Pack ${isFree ? '(Free)' : ''}</p>
              <p style="margin: 5px 0 0 0; color: #4a5568;"><strong>Valid for:</strong> 24 months</p>
              <p style="margin: 5px 0 0 0; color: #4a5568;"><strong>Edit window:</strong> 7 days from creation</p>
              <p style="margin: 5px 0 0 0; color: #4a5568;"><strong>Additional menus:</strong> 1</p>
            </div>
            <div style="margin: 30px 0;">
              <a href="${APP_URL}/dashboard" 
                 style="display: inline-block; background-color: #38a169; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Start Creating
              </a>
            </div>
            <p style="color: #718096; font-size: 14px; margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px;">
              Thank you for choosing GridMenu,<br>The GridMenu Team
            </p>
            ${renderComplianceFooterHtml()}
          </div>
        `,
      }

      await sgMail.send(msg)
      console.log(`[notification-service] Creator Pack confirmation sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send Creator Pack confirmation:', error)
      // Don't throw - email failure shouldn't break fulfillment
    }
  },

  /**
   * Sends a payment failed notification email
   * @param userId - The user ID
   * @param reason - The failure reason from Stripe
   */
  async sendPaymentFailedNotification(
    userId: string,
    reason: string
  ): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('[notification-service] SENDGRID_API_KEY missing. Skipping payment failed notification.')
      return
    }

    try {
      // Get user details from database
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email, restaurant_name')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        console.error('[notification-service] Failed to fetch user profile:', error)
        return
      }

      const msg = {
        to: profile.email,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME
        },
        subject: withCompanyPrefix('Payment Failed - Action Required'),
        text: `We were unable to process your payment.\n\nReason: ${reason}\n\nPlease update your payment method to continue using ${COMPANY_NAME} premium features.\n\nUpdate payment method: ${APP_URL}/upgrade\n\nIf you have questions, please contact our support team.${renderComplianceFooterText()}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #c53030; margin-top: 0;">Payment Failed</h2>
            <p style="color: #4a5568; font-size: 16px;">We were unable to process your payment for your GridMenu subscription.</p>
            <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #fc8181;">
              <p style="margin: 0; color: #742a2a;"><strong>Reason:</strong> ${reason}</p>
            </div>
            <p style="color: #4a5568; font-size: 16px;">Please update your payment method to continue using GridMenu premium features.</p>
            <div style="margin: 30px 0;">
              <a href="${APP_URL}/upgrade" 
                 style="display: inline-block; background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Update Payment Method
              </a>
            </div>
            <p style="color: #718096; font-size: 14px; margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px;">
              If you have questions, please contact our support team.<br>The GridMenu Team
            </p>
            ${renderComplianceFooterHtml()}
          </div>
        `,
      }

      await sgMail.send(msg)
      console.log(`[notification-service] Payment failed notification sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send payment failed notification:', error)
      // Don't throw - email failure shouldn't break fulfillment
    }
  },

  /**
   * Sends a subscription cancelled notification email
   * @param userId - The user ID
   * @param periodEnd - The date when access will end
   */
  async sendSubscriptionCancelledNotification(
    userId: string,
    periodEnd: Date
  ): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('[notification-service] SENDGRID_API_KEY missing. Skipping subscription cancelled notification.')
      return
    }

    try {
      // Get user details from database
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email, restaurant_name')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        console.error('[notification-service] Failed to fetch user profile:', error)
        return
      }

      const periodEndFormatted = periodEnd.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      const msg = {
        to: profile.email,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME
        },
        subject: withCompanyPrefix('Your subscription has been cancelled'),
        text: `Your ${COMPANY_NAME} subscription has been cancelled.\n\nYou will continue to have access to premium features until ${periodEndFormatted}.\n\nAfter this date, your account will be downgraded to the free plan.\n\nIf you change your mind, you can resubscribe at any time: ${APP_URL}/upgrade\n\nThank you for using ${COMPANY_NAME}!${renderComplianceFooterText()}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1a202c; margin-top: 0;">Subscription Cancelled</h2>
            <p style="color: #4a5568; font-size: 16px;">Your GridMenu subscription has been cancelled.</p>
            <div style="background-color: #fffaf0; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ed8936;">
              <p style="margin: 0; color: #7c2d12;"><strong>Access until:</strong> ${periodEndFormatted}</p>
            </div>
            <p style="color: #4a5568; font-size: 16px;">You will continue to have access to premium features until ${periodEndFormatted}. After this date, your account will be downgraded to the free plan.</p>
            <p style="color: #4a5568; font-size: 16px;">If you change your mind, you can resubscribe at any time.</p>
            <div style="margin: 30px 0;">
              <a href="${APP_URL}/upgrade" 
                 style="display: inline-block; background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Resubscribe
              </a>
            </div>
            <p style="color: #718096; font-size: 14px; margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px;">
              Thank you for using GridMenu,<br>The GridMenu Team
            </p>
            ${renderComplianceFooterHtml()}
          </div>
        `,
      }

      await sgMail.send(msg)
      console.log(`[notification-service] Subscription cancelled notification sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send subscription cancelled notification:', error)
      // Don't throw - email failure shouldn't break fulfillment
    }
  },

  /**
   * Sends an export completion email with download link
   * @param userId - The user ID
   * @param downloadUrl - The signed download URL (valid for 7 days)
   * @param menuName - The name of the menu from metadata
   * @param exportType - The export type (pdf or image)
   */
  async sendExportCompletionEmail(
    userId: string,
    downloadUrl: string,
    menuName: string,
    exportType: 'pdf' | 'image'
  ): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('[notification-service] SENDGRID_API_KEY missing. Skipping export completion email.')
      return
    }

    try {
      // Get user details from database
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email, restaurant_name')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        console.error('[notification-service] Failed to fetch user profile:', error)
        return
      }

      const exportTypeLabel = exportType === 'pdf' ? 'PDF' : 'Image'
      const subject = withCompanyPrefix(`Your ${exportTypeLabel} export is ready: ${menuName}`)

      const msg = {
        to: profile.email,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME
        },
        subject,
        // IMPORTANT: Disable click tracking for export download links.
        // Outlook/Edge can flag tracked download redirects (especially if the branded tracking
        // domain isn't serving a valid HTTPS certificate). This keeps the link as the direct
        // Supabase signed HTTPS URL and avoids scary "can't be downloaded securely" warnings.
        trackingSettings: {
          clickTracking: {
            enable: false,
            enableText: false,
          },
        },
        text: `Your ${exportTypeLabel} export for "${menuName}" is ready!\n\nYou can download your file using the link below. This link will be valid for 7 days.\n\nDownload: ${downloadUrl}\n\nMenu: ${menuName}\nType: ${exportTypeLabel}\n\nThank you for using ${COMPANY_NAME}!${renderComplianceFooterText()}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1a202c; margin-top: 0;">Your Export is Ready!</h2>
            <p style="color: #4a5568; font-size: 16px;">Your ${exportTypeLabel} export for <strong>"${menuName}"</strong> has been successfully generated.</p>
            <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
              <p style="margin: 0; color: #065f46;"><strong>Menu:</strong> ${menuName}</p>
              <p style="margin: 5px 0 0 0; color: #065f46;"><strong>Type:</strong> ${exportTypeLabel}</p>
            </div>
            <p style="color: #4a5568; font-size: 16px;">Click the button below to download your file. This link will be valid for 7 days.</p>
            <div style="margin: 30px 0;">
              <a href="${downloadUrl}" 
                 style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Download ${exportTypeLabel}
              </a>
            </div>
            <p style="color: #718096; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #3182ce; font-size: 14px; word-break: break-all;">${downloadUrl}</p>
            <p style="color: #718096; font-size: 14px; margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px;">
              Thank you for using GridMenu,<br>The GridMenu Team
            </p>
            ${renderComplianceFooterHtml()}
          </div>
        `,
      }

      await sgMail.send(msg)
      console.log(`[notification-service] Export completion email sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send export completion email:', error)
      // Don't throw - email failure shouldn't break fulfillment
    }
  },

  /**
   * Sends an export failure email with error details
   * Only sent for terminal failures (after all retries exhausted)
   * @param userId - The user ID
   * @param menuName - The name of the menu from metadata
   * @param exportType - The export type (pdf or image)
   * @param errorMessage - User-friendly error message
   */
  async sendExportFailureEmail(
    userId: string,
    menuName: string,
    exportType: 'pdf' | 'image',
    errorMessage: string
  ): Promise<void> {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('[notification-service] SENDGRID_API_KEY missing. Skipping export failure email.')
      return
    }

    try {
      // Get user details from database
      const supabase = getServiceClient()
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email, restaurant_name')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        console.error('[notification-service] Failed to fetch user profile:', error)
        return
      }

      const exportTypeLabel = exportType === 'pdf' ? 'PDF' : 'Image'
      const subject = withCompanyPrefix(`Export failed: ${menuName} (${exportTypeLabel})`)

      const msg = {
        to: profile.email,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME
        },
        subject,
        text: `We were unable to complete your ${exportTypeLabel} export for "${menuName}".\n\nError: ${errorMessage}\n\nMenu: ${menuName}\nType: ${exportTypeLabel}\n\nPlease try again or contact support if the problem persists.\n\nSupport: ${APP_URL}/support${renderComplianceFooterText()}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #c53030; margin-top: 0;">Export Failed</h2>
            <p style="color: #4a5568; font-size: 16px;">We were unable to complete your ${exportTypeLabel} export for <strong>"${menuName}"</strong>.</p>
            <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #fc8181;">
              <p style="margin: 0; color: #742a2a;"><strong>Menu:</strong> ${menuName}</p>
              <p style="margin: 5px 0 0 0; color: #742a2a;"><strong>Type:</strong> ${exportTypeLabel}</p>
              <p style="margin: 10px 0 0 0; color: #742a2a;"><strong>Error:</strong> ${errorMessage}</p>
            </div>
            <p style="color: #4a5568; font-size: 16px;">Please try exporting again. If the problem persists, please contact our support team.</p>
            <div style="margin: 30px 0;">
              <a href="${APP_URL}/support" 
                 style="display: inline-block; background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Contact Support
              </a>
            </div>
            <p style="color: #718096; font-size: 14px; margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px;">
              We apologize for the inconvenience,<br>The GridMenu Team
            </p>
            ${renderComplianceFooterHtml()}
          </div>
        `,
      }

      await sgMail.send(msg)
      console.log(`[notification-service] Export failure email sent to ${profile.email}`)
    } catch (error) {
      console.error('[notification-service] Failed to send export failure email:', error)
      // Don't throw - email failure shouldn't break fulfillment
    }
  }
}
