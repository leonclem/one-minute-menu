'use client'

import { useEffect, ReactNode, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { UXProgressSteps } from '@/components/ux'
import { saveUXProgress, type UXFlowStep } from '@/lib/ux-progress'

interface ClientFlowShellProps {
  menuId: string
  children: ReactNode
}

export default function ClientFlowShell({ menuId, children }: ClientFlowShellProps) {
  const pathname = usePathname()

  const currentStep: UXFlowStep = useMemo(() => {
    const segments = pathname?.split('/').filter(Boolean) ?? []
    const step = (segments[segments.length - 1] || 'upload') as UXFlowStep
    const validSteps: UXFlowStep[] = ['upload', 'extract', 'extracted', 'template', 'export']
    return validSteps.includes(step) ? step : 'upload'
  }, [pathname])

  useEffect(() => {
    if (!pathname || !menuId) return
    // Persist last visited step for this menu in encrypted localStorage.
    saveUXProgress(menuId, currentStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname, menuId, currentStep])

  return (
    <>
      <UXProgressSteps currentStep={currentStep} menuId={menuId} />
      <div key={pathname} className="ux-route-fade w-full">
        {children}
      </div>
    </>
  )
}

