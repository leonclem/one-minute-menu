import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isStudioPublicSurface } from '@/lib/product-mode'
import { getStudioCreditBalance } from '@/lib/studio/credits'
import UXPricingPageContent from './PricingPageContent'

export const metadata: Metadata = isStudioPublicSurface()
  ? {
      title: 'Pricing | GridMenu',
      description:
        'Buy Studio photo credits. New accounts start with 10 free credits. One-time Starter, Menu, and Studio packs. 1 credit is 1 standard AI photo.',
    }
  : {
      title: 'Pricing - Choose Your Plan | GridMenu',
      description:
        'Simple, transparent pricing. One-time Creator Packs or monthly subscriptions for unlimited power. All plans include photo-perfect AI menu generation.',
      keywords: ['menu pricing', 'AI menu cost', 'restaurant menu subscription', 'GridMenu plans'],
    }

export default async function PricingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  let initialCreditBalance: number | null = null
  if (isStudioPublicSurface() && user) {
    initialCreditBalance = await getStudioCreditBalance(user.id)
  }
  
  return (
    <UXPricingPageContent
      initialUser={user}
      initialCreditBalance={initialCreditBalance}
    />
  )
}
