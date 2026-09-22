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
    title: 'Your account is being reviewed.',
    description: 'You can use Studio after an admin approves your account. This is usually within 24 hours.',
    role: 'status',
    live: 'polite',
  },
  no_credit: {
    title: 'You have no Studio credits available.',
    description:
      'Upload and extraction are free. A successful generation uses credits. Buy more on the pricing page, or keep uploading while you wait.',
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
      className="rounded-[11px] border border-[#f8bc02]/35 bg-[rgba(248,188,2,0.13)] p-4 focus:outline-none focus:ring-2 focus:ring-[#f8bc02]/40"
    >
      <h2 id={headingId} className="text-sm font-bold text-[#f8bc02]">
        {message.title}
      </h2>
      <p id={descriptionId} className="mt-1 text-sm leading-5 text-[#f8bc02]/90">
        {message.description}
      </p>
      <Link
        href={kind === 'no_credit' ? '/pricing' : '/support'}
        className="mt-3 inline-block text-sm font-semibold text-[#5fd3da] underline underline-offset-2 hover:text-[#7fdee4] focus:outline-none focus:ring-2 focus:ring-[#5fd3da]/40"
      >
        {kind === 'no_credit' ? 'See pricing' : 'Contact support'}
      </Link>
    </section>
  )
}
