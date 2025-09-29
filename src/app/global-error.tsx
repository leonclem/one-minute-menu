"use client"

import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    try {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'fatal', message: error.message, stack: error.stack, digest: error.digest, source: 'global-error' })
      }).catch(() => {})
    } catch {}
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen w-full flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-lg border p-4">
            <h1 className="text-lg font-semibold mb-2">A critical error occurred</h1>
            <p className="text-sm text-secondary-700">Please reload the page to continue.</p>
            <div className="mt-4">
              <button className="btn" onClick={() => window.location.reload()}>Reload</button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}


