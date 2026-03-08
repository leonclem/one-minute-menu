import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, userOperations } from '@/lib/database'
import MenuEditor from './MenuEditor'

interface MenuPageProps {
  params: {
    menuId: string
  }
}

export default async function MenuPage({ params }: MenuPageProps) {
  const supabase = createServerSupabaseClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }

  // Get the menu and profile in parallel
  const [menu, profile] = await Promise.all([
    menuOperations.getMenu(params.menuId, user.id),
    userOperations.getProfile(user.id),
  ])
  
  if (!menu) {
    redirect('/dashboard')
  }

  const isSubscriber = ['grid_plus', 'grid_plus_premium', 'premium', 'enterprise'].includes(profile?.plan ?? 'free')
  const isAdmin = profile?.role === 'admin'

  return <MenuEditor menu={menu} canDelete={isSubscriber || isAdmin} />
}