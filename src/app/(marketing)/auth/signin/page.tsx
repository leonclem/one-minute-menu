import type { Metadata } from 'next'
import { UXWrapper, UXSection } from '@/components/ux'
import SignInClient from './signin-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign In | GridMenu',
  description: 'Sign in to your GridMenu account to open Photo Studio.',
}

export default function SignInPage() {
  return (
    <div className="ux-food-bleed relative min-h-[70vh] w-full">
      <UXWrapper variant="centered">
        <UXSection>
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.03em] text-white md:text-4xl">
              Welcome back
            </h1>
            <p className="mt-2 text-white/70">Sign in to open Photo Studio</p>
          </div>
          <SignInClient />
        </UXSection>
      </UXWrapper>
    </div>
  )
}
