import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations } from '@/lib/database'
import TemplatePreview from './TemplatePreview'

interface TemplatePageProps {
  params: {
    menuId: string
  }
}

export default async function TemplatePage({ params }: TemplatePageProps) {
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

  // Check if menu has extraction data
  if (!menu.extractionMetadata) {
    redirect(`/dashboard/menus/${params.menuId}`)
  }

  return <TemplatePreview menu={menu} />
}
