import { requireAdmin } from '@/lib/auth-utils'
import { PlaceholderImageManagerClient } from './placeholder-images-client'

export const dynamic = 'force-dynamic'

export default async function PlaceholderImagesPage() {
  await requireAdmin()
  return <PlaceholderImageManagerClient />
}
