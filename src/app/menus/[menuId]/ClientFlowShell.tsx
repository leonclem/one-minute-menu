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

  const pathnameInfo = useMemo(() => {
    const segments = pathname?.split('/').filter(Boolean) ?? []
    const menuIdx = segments.indexOf('menus')
    const menuIdFromPath = menuIdx !== -1 ? segments[menuIdx + 1] : undefined
    const step = (segments[segments.length - 1] || 'upload') as UXFlowStep
    const validSteps: UXFlowStep[] = ['upload', 'extract', 'extracted', 'template', 'export']
    return {
      step: validSteps.includes(step) ? step : 'upload',
      menuId: menuIdFromPath
    }
  }, [pathname])

  const currentStep = pathnameInfo.step
  const flowMenuId = pathnameInfo.menuId

  useEffect(() => {
    if (!pathname || !menuId) return
    // Persist last visited step for this menu in encrypted localStorage.
    saveUXProgress(menuId, currentStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname, menuId, currentStep])

  const isDemo = flowMenuId?.startsWith('demo-') || menuId?.startsWith('demo-')

  return (
    <>
      {isDemo && <UXProgressSteps currentStep={currentStep} menuId={menuId} />}
      <div key={pathname} className="ux-route-fade w-full">
        {children}
      </div>
    </>
  )
}

