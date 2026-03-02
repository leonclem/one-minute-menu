import { sendEmail } from './email-client'
import type { User } from '@/types'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gridmenu.ai'
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@gridmenu.ai'
const FROM_NAME = process.env.FROM_NAME || 'GridMenu'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gridmenu.ai'

const LOGO_URL = `${APP_URL}/logos/logo-400.png`

/** Wraps email body content in the standard branded shell. */
function emailShell(body: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header -->
      <div style="background-color: #ffffff; padding: 24px 32px; border-radius: 8px 8px 0 0; text-align: center; border: 1px solid #01B3BF; border-bottom: 3px solid #01B3BF;">
        <img src="${LOGO_URL}" alt="GridMenu" width="160" height="auto"
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

/** Primary CTA button using brand primary colour. */
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

/**
 * Sends an email notification to the admin when a new user registers and is pending approval.
 * Returns true if the email was successfully sent, false otherwise.
 */
export async function sendAdminNewUserAlert(profile: User): Promise<boolean> {
  const sent = await sendEmail({
    to: ADMIN_EMAIL,
    from: FROM_EMAIL,
    fromName: FROM_NAME,
    subject: `New Pilot Registration: ${profile.email}`,
    text: `A new user has registered and is pending approval.\n\nEmail: ${profile.email}\nUser ID: ${profile.id}\n\nApprove them here: ${APP_URL}/admin?tab=user-management`,
    html: emailShell(`
      <h2 style="color: #1a202c; margin-top: 0;">New Pilot Registration</h2>
      <p style="color: #4a5568; font-size: 16px;">A new user has registered and is awaiting your approval.</p>
      <div style="background-color: #f0fdfe; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #01B3BF;">
        <p style="margin: 0; color: #4a5568;"><strong>Email:</strong> ${profile.email}</p>
        <p style="margin: 6px 0 0 0; color: #4a5568;"><strong>User ID:</strong> ${profile.id}</p>
      </div>
      ${primaryButton(`${APP_URL}/admin?tab=user-management`, 'Review in Admin Hub')}
    `),
  })

  if (sent) {
    console.log(`[notifications] Admin alert sent for ${profile.email}`)
  } else {
    console.error(`[notifications] Failed to send admin alert for ${profile.email}`)
  }

  return sent
}

/**
 * Sends a welcome email to the user once their account has been approved.
 */
export async function sendUserApprovalNotification(profile: User): Promise<void> {
  const sent = await sendEmail({
    to: profile.email,
    from: FROM_EMAIL,
    fromName: FROM_NAME,
    subject: 'Welcome to GridMenu — your account is ready!',
    text: `Great news! Your GridMenu pilot account has been approved. You can now create your brand new menus!\n\nGet started here: ${APP_URL}/dashboard`,
    html: emailShell(`
      <h2 style="color: #1a202c; margin-top: 0;">You're In!</h2>
      <p style="color: #4a5568; font-size: 16px;">Your GridMenu pilot account has been approved.</p>
      <p style="color: #4a5568; font-size: 16px;">Head to your dashboard to start creating your first photo-perfect menu.</p>
      ${primaryButton(`${APP_URL}/dashboard`, 'Go to Dashboard')}
      <p style="color: #718096; font-size: 14px; margin-top: 32px; border-top: 1px solid #edf2f7; padding-top: 20px;">
        Welcome aboard,<br>The GridMenu Team
      </p>
    `),
  })

  if (sent) {
    console.log(`[notifications] Approval notification sent to ${profile.email}`)
  } else {
    console.error(`[notifications] Failed to send approval notification to ${profile.email}`)
  }
}
