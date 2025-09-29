"use client"

import { useEffect } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Best-effort client log (non-blocking)
    try {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'error', message: error.message, stack: error.stack, digest: error.digest, source: 'segment-error' })
      }).catch(() => {})
    } catch {}
  }, [error])

  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-secondary-700 mb-4">An unexpected error occurred. You can try again.</p>
          <div className="flex gap-2">
            <Button onClick={() => reset()}>Try again</Button>
            <Button variant="outline" onClick={() => (window.location.href = '/')}>Go home</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


