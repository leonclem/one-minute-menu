import { redirect } from 'next/navigation'
import UploadClient from './UploadClient'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations } from '@/lib/database'

interface PageProps {
  params: { menuId: string }
}

export const dynamic = 'force-dynamic'

export default async function UploadPage({ params }: PageProps) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const menu = await menuOperations.getMenu(params.menuId, user.id)
  if (!menu) {
    redirect('/dashboard')
  }

  return <UploadClient menuId={params.menuId} />
}


