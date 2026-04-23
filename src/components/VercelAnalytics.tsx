'use client'

import { Analytics } from '@vercel/analytics/next'

export function VercelAnalytics() {
  return (
    <Analytics 
      beforeSend={(event) => {
        if (typeof window !== 'undefined' && window.localStorage.getItem('va-disable') === '1') {
          return null
        }
        return event
      }}
    />
  )
}
