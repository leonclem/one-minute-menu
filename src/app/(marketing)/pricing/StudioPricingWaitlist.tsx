'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { UXWrapper, UXCard, UXButton } from '@/components/ux'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedHomePath } from '@/lib/product-mode'

function formatCreditBalance(balance: number): string {
  const label = balance === 1 ? 'credit' : 'credits'
  return `${balance} Studio ${label}`
}

export default function StudioPricingWaitlist({
  initialUser,
  initialCreditBalance = null,
}: {
  initialUser?: unknown
  initialCreditBalance?: number | null
}) {
  const [user, setUser] = useState<unknown>(initialUser || null)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const isLoggedIn = !!user
  const studioHref = getAuthenticatedHomePath()
  const creditBalance = initialCreditBalance ?? 0

  return (
    <UXWrapper>
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-white text-hero-shadow mb-4">
          Private beta - invite only
        </h1>
        <p className="text-lg text-white/90 text-hero-shadow-strong max-w-2xl mx-auto">
          {isLoggedIn
            ? 'Photo Studio is invite-only. Credits are admin-granted, not sold as a self-serve plan.'
            : 'Photo Studio is not on a self-serve plan. Join the waitlist and we will invite testers in small groups. Credits are granted by an admin.'}
        </p>
      </div>

      <div className="container-ux max-w-3xl mx-auto space-y-8">
        <UXCard>
          <div className="p-8 space-y-4">
            {isLoggedIn ? (
              <>
                <h2 className="text-xl font-bold text-ux-text">Your Studio credits</h2>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p className="text-3xl font-bold text-ux-text">{formatCreditBalance(creditBalance)}</p>
                  <p>Studio credits are admin-granted for invited testers, not purchased here.</p>
                  <p>
                    Need more credits? Contact{' '}
                    <a
                      href="mailto:support@gridmenu.ai"
                      className="text-ux-primary font-semibold hover:underline"
                    >
                      support@gridmenu.ai
                    </a>
                    .
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-ux-text">How access works</h2>
                <ul className="space-y-3 text-gray-700 text-sm">
                  <li>
                    Sign up to join the waitlist. Most applications are reviewed within 24 hours.
                  </li>
                  <li>Approved accounts still need a Studio invite before the editor opens.</li>
                  <li>
                    Studio credits are admin-granted for invited testers, not purchased here.
                  </li>
                </ul>
              </>
            )}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {isLoggedIn ? (
                <Link href={studioHref} className="w-full sm:w-auto">
                  <UXButton variant="primary" size="lg" className="w-full sm:w-auto">
                    Open Studio
                  </UXButton>
                </Link>
              ) : (
                <Link href="/register" className="w-full sm:w-auto">
                  <UXButton variant="primary" size="lg" className="w-full sm:w-auto">
                    Join the waitlist
                  </UXButton>
                </Link>
              )}
              <a href="mailto:support@gridmenu.ai" className="w-full sm:w-auto">
                <UXButton variant="outline" size="lg" className="w-full sm:w-auto">
                  Email support@gridmenu.ai
                </UXButton>
              </a>
            </div>
          </div>
        </UXCard>
      </div>
    </UXWrapper>
  )
}
