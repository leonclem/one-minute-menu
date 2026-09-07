'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { SignupConversionBeacon } from '@/components/analytics/SignupConversionBeacon'

function StudioSignupBeaconInner() {
  const params = useSearchParams()
  return <SignupConversionBeacon enabled={params.get('new_signup') === 'true'} />
}

export function StudioSignupBeacon() {
  return (
    <Suspense fallback={null}>
      <StudioSignupBeaconInner />
    </Suspense>
  )
}
