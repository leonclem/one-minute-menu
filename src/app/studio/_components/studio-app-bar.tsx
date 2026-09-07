'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useStudioCredits } from './studio-credits-context'

interface StudioAppBarProps {
  showCredits: boolean
}

export function StudioAppBar({ showCredits }: StudioAppBarProps) {
  const pathname = usePathname()
  const { creditBalance } = useStudioCredits()
  const onDishesHome = pathname === '/studio'

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0c1416]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 hover:opacity-80">
            <Image
              src="/logos/logo.svg"
              alt=""
              width={22}
              height={22}
              priority
              className="logo-drop-shadow"
            />
            <span className="text-[17px] font-bold tracking-[-0.02em] text-white">GridMenu</span>
          </Link>
          {onDishesHome ? (
            <span className="truncate text-sm font-semibold text-white/55">All dishes</span>
          ) : (
            <Link href="/studio" className="studio-link truncate text-sm font-semibold">
              All dishes
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {showCredits && creditBalance !== null ? (
            <Link
              href="/pricing"
              className="studio-credits-pill"
              aria-label={`${creditBalance} Studio credits remaining`}
              data-testid="studio-shell-credits"
            >
              <span aria-hidden>✦</span>
              {creditBalance} credits
            </Link>
          ) : null}
          <Link href="/dashboard/settings" className="hidden text-sm font-semibold text-white/55 hover:text-white sm:inline">
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm font-semibold text-white/55 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
