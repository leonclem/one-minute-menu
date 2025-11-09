import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

export const metadata: Metadata = {
  title: 'Choose Template | GridMenu',
}

const UXMenuTemplateClient = dynamic(() => import('./template-client'), { ssr: false })

export default function Page({ params }: { params: { menuId: string } }) {
  return <UXMenuTemplateClient menuId={params.menuId} />
}