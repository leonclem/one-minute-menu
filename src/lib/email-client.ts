import { ServerClient } from 'postmark'
import { LinkTrackingOptions } from 'postmark/dist/client/models/message/SupportingTypes'

/**
 * Thin wrapper around the Postmark client.
 *
 * Localhost behaviour:
 *   Set POSTMARK_SERVER_TOKEN=POSTMARK_API_TEST in .env.local to silently
 *   swallow all emails without hitting the real API (Postmark's official test token).
 *   Alternatively, leave the var unset and emails will be logged to console only.
 *
 * Production behaviour:
 *   Set POSTMARK_SERVER_TOKEN to your real server token from the Postmark dashboard.
 */

export interface EmailMessage {
  to: string
  from: string
  fromName?: string
  subject: string
  html: string
  text: string
  /** Postmark message stream — defaults to POSTMARK_TRANSACTIONAL_STREAM env var or 'outbound' */
  messageStream?: string
  /** Set true to disable link click tracking (e.g. for download links) */
  disableClickTracking?: boolean
}

function getClient(): ServerClient | null {
  const token = process.env.POSTMARK_SERVER_TOKEN
  if (!token) return null
  return new ServerClient(token)
}

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const client = getClient()

  if (!client) {
    console.warn('[email-client] POSTMARK_SERVER_TOKEN not set — email not sent:', msg.subject)
    return false
  }

  const from = msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from

  try {
    const result = await client.sendEmail({
      From: from,
      To: msg.to,
      Subject: msg.subject,
      HtmlBody: msg.html,
      TextBody: msg.text,
      MessageStream: msg.messageStream ?? process.env.POSTMARK_TRANSACTIONAL_STREAM ?? 'outbound',
      ...(msg.disableClickTracking ? { TrackLinks: LinkTrackingOptions.None } : {}),
    })
    console.log(`[email-client] Sent "${msg.subject}" to ${msg.to} — MessageID: ${result.MessageID}, ErrorCode: ${result.ErrorCode}, Message: ${result.Message}`)
    return result.ErrorCode === 0
  } catch (error: any) {
    // Postmark API errors surface as objects with statusCode + body
    const detail = error?.response?.body ?? error?.message ?? error
    console.error(`[email-client] Failed to send "${msg.subject}" to ${msg.to} from ${from}:`, JSON.stringify(detail))
    return false
  }
}
