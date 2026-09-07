import type { Metadata } from 'next'
import { UXWrapper, UXSection } from '@/components/ux'
import UXRegisterClient from './register-client'
import { getFeatureFlag } from '@/lib/feature-flags'

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
    <div className="ux-food-bleed relative min-h-[70vh] w-full">
      <UXWrapper variant="centered">
        <UXSection>
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.03em] text-white md:text-4xl">
              Create your account
            </h1>
            <p className="mt-2 text-white/70">Start with 10 free photo credits</p>
          </div>
          <UXRegisterClient requireAdminApproval={requireAdminApproval} />
        </UXSection>
      </UXWrapper>
    </div>
  )
}
