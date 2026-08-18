import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isStudioPublicSurface } from '@/lib/product-mode'
import { getStudioCreditBalance } from '@/lib/studio/credits'
import { STUDIO_PRICING_SEO } from '@/lib/studio/public-seo'
import UXPricingPageContent from './PricingPageContent'

export const metadata: Metadata = {
  title: STUDIO_PRICING_SEO.title,
  description: STUDIO_PRICING_SEO.description,
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
