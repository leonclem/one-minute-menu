'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type StudioCreditsContextValue = {
  creditBalance: number | null
  setCreditBalance: (balance: number | null) => void
}

const StudioCreditsContext = createContext<StudioCreditsContextValue | null>(null)

export function StudioCreditsProvider({
  initialBalance,
  children,
}: {
  initialBalance: number | null
  children: ReactNode
}) {
  const [creditBalance, setCreditBalance] = useState<number | null>(initialBalance)
  const value = useMemo(
    () => ({ creditBalance, setCreditBalance }),
    [creditBalance],
  )

  return (
    <StudioCreditsContext.Provider value={value}>{children}</StudioCreditsContext.Provider>
  )
}

export function useStudioCredits(): StudioCreditsContextValue {
  const context = useContext(StudioCreditsContext)
  if (!context) {
    throw new Error('useStudioCredits must be used within StudioCreditsProvider')
  }
  return context
}
