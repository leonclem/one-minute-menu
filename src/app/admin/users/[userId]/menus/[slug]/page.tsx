import { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth-utils'
import AdminMenuPreviewClient from './AdminMenuPreviewClient'

type PageProps = {
  params: { userId: string; slug: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: `Admin Preview: ${params.slug} | GridMenu`,
  }
}

export default async function AdminMenuPreviewPage({ params }: PageProps) {
  await requireAdmin()
  return <AdminMenuPreviewClient userId={params.userId} slug={params.slug} />
}
