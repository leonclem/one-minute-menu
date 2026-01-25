'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UpgradePage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/pricing')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-2">Redirecting...</h1>
        <p className="text-gray-500">Taking you to our pricing page.</p>
      </div>
    </div>
  )
}


