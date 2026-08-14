import type { Metadata } from 'next'
import SignInClient from './signin-client'
import { isStudioPublicSurface } from '@/lib/product-mode'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign In | GridMenu',
  description: isStudioPublicSurface()
    ? 'Sign in to your GridMenu account to open Photo Studio.'
    : 'Sign in to manage your digital menus.',
}

export default function SignInPage() {
  return <SignInClient />
}