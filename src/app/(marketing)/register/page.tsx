import { UXWrapper, UXSection } from '@/components/ux'
import UXRegisterClient from './register-client'
import { getFeatureFlag } from '@/lib/feature-flags'

// Force dynamic rendering for authentication
export const dynamic = 'force-dynamic'

export default async function UXRegisterPage() {
  const requireAdminApproval = await getFeatureFlag('require_admin_approval')
  console.log('[register-page] requireAdminApproval =', requireAdminApproval)
  
  return (
    <UXWrapper variant="centered">
      <UXSection>
        {/* Hero heading with white text and subtle shadow */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
            Create Your Account
          </h1>
          <p className="mt-2 text-white/90 text-hero-shadow-strong">
            Get started with your digital menu in just a few steps
          </p>
        </div>
        <UXRegisterClient requireAdminApproval={requireAdminApproval} />
      </UXSection>
    </UXWrapper>
  )
}