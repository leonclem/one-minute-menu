import sgMail from '@sendgrid/mail'
import type { User } from '@/types'

// Initialize SendGrid with API Key from environment variables
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gridmenu.ai'
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@gridmenu.ai'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gridmenu.ai'

/**
 * Sends an email notification to the admin when a new user registers and is pending approval.
 * Returns true if the email was successfully sent, false otherwise.
 */
export async function sendAdminNewUserAlert(profile: User): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[notifications] SENDGRID_API_KEY missing. Skipping admin alert.')
    return false
  }

  const msg = {
    to: ADMIN_EMAIL,
    from: FROM_EMAIL,
    subject: `🚀 New Pilot Registration: ${profile.email}`,
    text: `A new user has registered and is pending approval.\n\nEmail: ${profile.email}\nUser ID: ${profile.id}\n\nApprove them here: ${APP_URL}/admin?tab=user-management`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1a202c; margin-top: 0;">New Pilot Registration</h2>
        <p style="color: #4a5568; font-size: 16px;">A new user has registered and is awaiting your approval.</p>
        <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #4a5568;"><strong>Email:</strong> ${profile.email}</p>
          <p style="margin: 5px 0 0 0; color: #4a5568;"><strong>User ID:</strong> ${profile.id}</p>
        </div>
        <a href="${APP_URL}/admin?tab=user-management" 
           style="display: inline-block; background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Review in Admin Hub
        </a>
      </div>
    `,
  }

  try {
    await sgMail.send(msg)
    console.log(`[notifications] Admin alert sent for ${profile.email}`)
    return true
  } catch (error) {
    console.error('[notifications] Failed to send admin alert:', error)
    return false
  }
}

/**
 * Sends a welcome email to the user once their account has been approved.
 */
export async function sendUserApprovalNotification(profile: User) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[notifications] SENDGRID_API_KEY missing. Skipping user approval notification.')
    return
  }

  const msg = {
    to: profile.email,
    from: FROM_EMAIL,
    subject: 'Welcome to GridMenu! Your account is ready.',
    text: `Great news! Your GridMenu account has been approved. You can now start creating your AI-powered menus.\n\nGet started here: ${APP_URL}/dashboard`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1a202c; margin-top: 0;">You're In!</h2>
        <p style="color: #4a5568; font-size: 16px;">Great news! Your GridMenu pilot account has been approved.</p>
        <p style="color: #4a5568; font-size: 16px;">You can now access your dashboard and start creating your first photo-perfect menu.</p>
        <div style="margin: 30px 0;">
          <a href="${APP_URL}/dashboard" 
             style="display: inline-block; background-color: #38a169; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Go to Dashboard
          </a>
        </div>
        <p style="color: #718096; font-size: 14px; margin-top: 40px; border-top: 1px solid #edf2f7; padding-top: 20px;">
          Welcome aboard,<br>The GridMenu Team
        </p>
      </div>
    `,
  }

  try {
    await sgMail.send(msg)
    console.log(`[notifications] Approval notification sent to ${profile.email}`)
  } catch (error) {
    console.error('[notifications] Failed to send user approval notification:', error)
  }
}
