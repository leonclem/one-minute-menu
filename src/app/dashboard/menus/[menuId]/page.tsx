import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations } from '@/lib/database'
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

  // Get the menu
  const menu = await menuOperations.getMenu(params.menuId, user.id)
  
  if (!menu) {
    redirect('/dashboard')
  }

  return <MenuEditor menu={menu} />
}