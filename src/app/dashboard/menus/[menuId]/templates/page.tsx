import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, templateOperations } from '@/lib/database'
import TemplateManagementView from './TemplateManagementView'

interface TemplatesPageProps {
  params: {
    menuId: string
  }
}

export default async function TemplatesPage({ params }: TemplatesPageProps) {
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

  // Get available templates
  const templates = await templateOperations.listTemplates()
  
  // Get user's template preference for this menu
  const userPreference = await templateOperations.getUserPreference(user.id, params.menuId)

  return (
    <TemplateManagementView
      menu={menu}
      templates={templates}
      userPreference={userPreference}
    />
  )
}
