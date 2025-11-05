import { UXWrapper, UXSection } from '@/components/ux'
import UXRegisterClient from './register-client'

// Force dynamic rendering for authentication
export const dynamic = 'force-dynamic'

export default function UXRegisterPage() {
  return (
    <UXWrapper variant="centered">
      <UXSection 
        title="Create Your Account"
        subtitle="Get started with your digital menu in just a few steps"
      >
        <UXRegisterClient />
      </UXSection>
    </UXWrapper>
  )
}