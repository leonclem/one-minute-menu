import Link from 'next/link'

export type StudioStateNoticeProps =
  | { kind: 'disabled' }
  | { kind: 'pending_access' }
  | { kind: 'no_credit' }
  | { kind: 'blocked_dish' }

type StudioStateNoticeKind = StudioStateNoticeProps['kind']

type StudioStateMessage = {
  title: string
  description: string
  role: 'status' | 'alert'
  live: 'polite' | 'assertive'
}

const STUDIO_STATE_MESSAGES: Record<StudioStateNoticeKind, StudioStateMessage> = {
  disabled: {
    title: 'Photo Studio is unavailable right now.',
    description: 'Please check back later or contact support if you need help.',
    role: 'status',
    live: 'polite',
  },
  pending_access: {
    title: 'Photo Studio is in private beta.',
    description: 'Your account is not enabled yet. Contact support if you were invited to the beta.',
    role: 'status',
    live: 'polite',
  },
  no_credit: {
    title: 'You have no Studio credits available.',
    description:
      'Photo Studio is in private beta. Upload and extraction are free, while a successful generation uses credits. You can continue uploading and extracting while you request more credits.',
    role: 'status',
    live: 'polite',
  },
  blocked_dish: {
    title: 'Generation is paused for this dish.',
    description: 'An admin needs to clear the dish before generation can continue.',
    role: 'alert',
    live: 'assertive',
  },
}

export function StudioStateNotice({ kind }: StudioStateNoticeProps) {
  const message = STUDIO_STATE_MESSAGES[kind]
  const headingId = `studio-state-notice-${kind}-heading`
  const descriptionId = `studio-state-notice-${kind}-description`

  return (
    <section
      role={message.role}
      aria-live={message.live}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      data-testid="studio-state-notice"
      data-state={kind}
      data-inline={kind === 'no_credit' ? 'true' : undefined}
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 focus:outline-none focus:ring-2 focus:ring-ux-primary/40"
    >
      <h2 id={headingId} className="text-sm font-semibold">
        {message.title}
      </h2>
      <p id={descriptionId} className="mt-1 text-sm">
        {message.description}
      </p>
      <Link
        href="/support"
        className="mt-3 inline-block text-sm font-semibold text-ux-primary underline underline-offset-2 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ux-primary/40"
      >
        Contact support
      </Link>
    </section>
  )
}
