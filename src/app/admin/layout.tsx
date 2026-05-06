import type { ReactNode } from 'react'

/**
 * Admin route layout.
 *
 * Wraps all admin routes in a `data-ph-mask="admin"` subtree so that PostHog
 * session replay masks every rendered text node under `/admin`. See
 * `docs/ANALYTICS.md` — "Session Replay Privacy and Masking" — for the
 * convention.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div data-ph-mask="admin">{children}</div>
}
