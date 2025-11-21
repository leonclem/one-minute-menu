'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useToast } from '@/components/ui'
import { trackConversionEvent } from '@/lib/conversion-tracking'

interface UXErrorFeedbackProps {
  context?: 'demo' | 'conversion' | 'flow' | 'generic'
  menuId?: string
  hint?: string
}

/**
 * Small inline feedback form shown on UX error states.
 * Designed to be low-friction and non-blocking while giving us
 * qualitative signal about where users get stuck.
 */
export function UXErrorFeedback({ context = 'generic', menuId, hint }: UXErrorFeedbackProps) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const pathname = usePathname()
  const { showToast } = useToast()

  const onSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault()
    if (!message.trim() || submitting) return
    setSubmitting(true)

    const payload = {
      level: 'info',
      source: 'ux-error-feedback',
      path: pathname,
      context,
      menuId,
      message: message.trim(),
    }

    try {
      // Best-effort log to server
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {})

      // Track as a conversion-style event for funnel analytics
      trackConversionEvent({
        event: 'ux_feedback',
        metadata: {
          path: pathname,
          context,
          hasMenuId: Boolean(menuId),
        },
      })

      setSubmitted(true)
      setMessage('')
      showToast({
        type: 'success',
        title: 'Feedback sent',
        description: 'Thank you — this helps us improve the experience.',
      })
    } catch {
      showToast({
        type: 'error',
        title: 'Could not send feedback',
        description: 'Please try again in a moment.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <p className="mt-3 text-xs text-ux-text-secondary">
        We received your feedback. If you keep seeing issues, you can also contact support from the footer.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-2">
      {hint && (
        <p className="text-xs text-ux-text-secondary">
          {hint}
        </p>
      )}
      <label className="block">
        <span className="sr-only">Tell us what happened</span>
        <textarea
          className="w-full rounded-md border border-ux-border bg-ux-background-secondary text-sm text-ux-text px-3 py-2 resize-none min-h-[72px] focus:outline-none focus:ring-2 focus:ring-ux-primary"
          placeholder="Optional: What were you trying to do when this happened?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={submitting}
        />
      </label>
      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-semibold bg-ux-primary text-white shadow-sm hover:bg-ux-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ux-primary disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={submitting || !message.trim()}
        >
          {submitting ? 'Sending…' : 'Send feedback'}
        </button>
      </div>
    </form>
  )
}


