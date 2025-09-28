"use client"

import Link from 'next/link'

interface UpgradePromptProps {
  title?: string
  message: string
  cta?: string
  href?: string
  reason?: string
  className?: string
}

export function UpgradePrompt({
  title = 'Upgrade required',
  message,
  cta = 'Upgrade plan',
  href = '/upgrade',
  reason,
  className = ''
}: UpgradePromptProps) {
  return (
    <div className={`rounded-md border border-amber-200 bg-amber-50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-900">{title}</h3>
          <p className="mt-1 text-sm text-amber-800">{message}</p>
          {reason && (
            <p className="mt-1 text-xs text-amber-700">{reason}</p>
          )}
          <div className="mt-3">
            <Link href={href} className="btn btn-primary">
              {cta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UpgradePrompt


