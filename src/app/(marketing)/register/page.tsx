import type { Metadata } from 'next'
import { UXWrapper, UXSection } from '@/components/ux'
import UXRegisterClient from './register-client'
import { getFeatureFlag } from '@/lib/feature-flags'

// Force dynamic rendering for authentication
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Create Your Account | GridMenu',
  description:
    'Sign up for GridMenu’s AI food photo studio. Start with 10 free credits. No prompt engineering.',
}

export default async function UXRegisterPage() {
  const requireAdminApproval = await getFeatureFlag('require_admin_approval')
  console.log('[register-page] requireAdminApproval =', requireAdminApproval)
  
  return (
    <UXWrapper variant="centered">
      <UXSection>
        {/* Hero heading with white text and subtle shadow */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Create your account
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Start with 10 free photo credits
          </p>
        </div>
        <UXRegisterClient requireAdminApproval={requireAdminApproval} />
      </UXSection>
    </UXWrapper>
  )
}