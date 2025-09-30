'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { computeOnboardingStatus } from '@/lib/onboarding'

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true)
  const [menus, setMenus] = useState<any[]>([])

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const res = await fetch('/api/menus')
        const data = await res.json()
        if (res.ok) setMenus(data.data || [])
      } finally {
        setLoading(false)
      }
    }
    fetchMenus()
  }, [])

  const status = useMemo(() => computeOnboardingStatus(menus as any), [menus])
  const primary = useMemo(() => (menus && menus.length > 0 ? menus[0] : null), [menus])

  const steps = [
    { key: 'create', label: 'Create your menu', done: status.hasMenu },
    { key: 'photo', label: 'Upload or snap a menu photo', done: status.hasImage },
    { key: 'items', label: 'Confirm items and prices', done: status.hasItems },
    { key: 'publish', label: 'Publish and get QR code', done: status.isPublished },
  ]

  const skipHref = status.hasMenu ? '/dashboard' : '/dashboard/menus/new'

  return (
    <div className="min-h-screen bg-secondary-50">
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-secondary-900">Getting Started</h1>
            <Link href={skipHref} className="text-sm text-secondary-600 hover:text-secondary-900">Skip</Link>
          </div>
        </div>
      </header>

      <main className="container-mobile py-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>4 quick steps</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Progress indicator */}
              <div className="mb-4">
                <div className="h-2 w-full rounded bg-secondary-200">
                  <div
                    className="h-2 rounded bg-primary-500 transition-all"
                    style={{ width: `${status.completionPercent}%` }}
                    aria-valuenow={status.completionPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    role="progressbar"
                  />
                </div>
                <div className="mt-2 text-xs text-secondary-600">{status.completionPercent}% complete</div>
              </div>

              <ol className="space-y-3">
                {steps.map((s, idx) => (
                  <li key={s.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${s.done ? 'bg-green-100 text-green-800' : 'bg-secondary-200 text-secondary-700'}`}>{idx+1}</span>
                      <span className={`text-sm ${s.done ? 'line-through text-secondary-500' : 'text-secondary-900'}`}>{s.label}</span>
                    </div>
                    {s.done && (
                      <span className="text-green-600">✓</span>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Primary actions */}
          <div className="grid gap-4">
            {!status.hasMenu && (
              <Link href="/dashboard/menus/new" className="btn btn-primary text-center">Create your first menu</Link>
            )}

            {status.hasMenu && !status.hasImage && primary && (
              <Link href={`/dashboard/menus/${primary.id}`} className="btn btn-primary text-center">Upload a menu photo</Link>
            )}

            {status.hasMenu && status.hasImage && !status.hasItems && primary && (
              <Link href={`/dashboard/menus/${primary.id}`} className="btn btn-primary text-center">Review extracted items</Link>
            )}

            {status.hasMenu && status.hasItems && !status.isPublished && primary && (
              <Link href={`/dashboard/menus/${primary.id}`} className="btn btn-primary text-center">Publish and get QR</Link>
            )}

            {status.isPublished && primary && (
              <div className="text-center">
                <p className="text-secondary-700 mb-3">All set! Download your QR code:</p>
                <div className="flex justify-center gap-3">
                  <a href={`/api/menus/${primary.id}/qr?format=png&size=1024`} className="btn btn-outline" target="_blank" rel="noreferrer">PNG</a>
                  <a href={`/api/menus/${primary.id}/qr?format=pdf&size=1024`} className="btn btn-outline" target="_blank" rel="noreferrer">PDF</a>
                </div>
              </div>
            )}
          </div>

          {/* Demo mode */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-secondary-900 mb-1">Try with sample photos</h3>
                  <p className="text-sm text-secondary-600">Explore the flow without using your own images.</p>
                </div>
                <Link href="/onboarding/demo" className="btn btn-outline">Start demo</Link>
              </div>
            </CardContent>
          </Card>

          {/* Mobile tips */}
          <Card>
            <CardHeader>
              <CardTitle>Mobile tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-secondary-700 space-y-2">
                <li>Use your phone’s back camera for sharper menu photos</li>
                <li>Fill the frame and avoid glare or shadows</li>
                <li>Large tap targets and bottom-aligned actions help one-handed use</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}


