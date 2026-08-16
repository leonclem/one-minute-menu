import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import HomePageContent from './HomePageContent'
import HomepageAnalytics from './HomepageAnalytics'
import { getHomePageMetadata } from './home-metadata'

export const metadata: Metadata = getHomePageMetadata()

export default async function HomePage() {
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <>
      <HomepageAnalytics />
      <HomePageContent initialUser={user} />
    </>
  )
}
