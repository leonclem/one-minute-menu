import type { Metadata } from 'next'
import SignInClient from './signin-client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign In | GridMenu',
  description: 'Sign in to your GridMenu account to open Photo Studio.',
}

export default function SignInPage() {
  return <SignInClient />
}