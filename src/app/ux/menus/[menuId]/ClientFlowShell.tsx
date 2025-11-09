'use client'

import { useEffect, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { UXProgressSteps } from '@/components/ux'

interface ClientFlowShellProps {
  menuId: string
  children: ReactNode
}

export default function ClientFlowShell({ menuId, children }: ClientFlowShellProps) {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || !menuId) return
    const segments = pathname.split('/').filter(Boolean)
    const step = segments[segments.length - 1] || ''
    const validSteps = new Set(['upload', 'extract', 'extracted', 'template', 'export'])
    const lastStep = validSteps.has(step) ? step : undefined
    try {
      const key = `uxFlow:${menuId}`
      const existing = sessionStorage.getItem(key)
      const parsed = existing ? JSON.parse(existing) : {}
      sessionStorage.setItem(
        key,
        JSON.stringify({
          ...parsed,
          lastStep: lastStep ?? parsed.lastStep ?? 'upload',
          updatedAt: new Date().toISOString(),
        })
      )
    } catch {
      // ignore storage errors
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname, menuId])

  return (
    <>
      <UXProgressSteps
        currentStep={(pathname?.split('/').filter(Boolean).at(-1) as any) || 'upload'}
        menuId={menuId}
      />
      <div key={pathname} className="ux-route-fade w-full">
        {children}
      </div>
    </>
  )
}

