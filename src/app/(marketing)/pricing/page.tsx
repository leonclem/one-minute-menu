import { UXWrapper, UXCard, UXButton } from '@/components/ux'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import UXPricingPageContent from './PricingPageContent'

export const metadata: Metadata = {
  title: 'Pricing - Choose Your Plan | GridMenu',
  description: 'Simple, transparent pricing. One-time Creator Packs or monthly subscriptions for unlimited power. All plans include photo-perfect AI menu generation.',
  keywords: ['menu pricing', 'AI menu cost', 'restaurant menu subscription', 'GridMenu plans'],
}

export default async function PricingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  return <UXPricingPageContent initialUser={user} />
}
