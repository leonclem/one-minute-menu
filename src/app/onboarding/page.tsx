'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface MenuSummary {
  id: string
  status?: string
}

export default function OnboardingPage() {
  const [menus, setMenus] = useState<MenuSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/menus')
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) {
          setMenus(Array.isArray(json?.data) ? json.data : [])
        }
      } catch {
        // best-effort only; onboarding should still render
        if (!cancelled) setMenus([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const hasMenus = Array.isArray(menus) && menus.length > 0
  const stepsCompleted = hasMenus ? 1 : 0
  const progress = stepsCompleted * 25

  return (
    <main className="min-h-screen bg-secondary-50 flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-md p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-secondary-900">
            4 quick steps to get your menu live
          </h1>
          <p className="text-sm text-secondary-600">
            We&apos;ll guide you from your first menu upload to a QR-ready digital menu.
          </p>
        </header>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="w-full h-2 rounded-full bg-secondary-100 overflow-hidden"
        >
          <div
            className="h-full bg-primary-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-secondary-700">
            Step {stepsCompleted + 1} of 4
          </span>
          <Link href="/dashboard/menus/new" className="text-primary-600 hover:text-primary-800">
            Skip
          </Link>
        </div>
      </div>
    </main>
  )
}


