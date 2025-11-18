import dynamic from 'next/dynamic'

const UXMenuExtractedClient = dynamic(() => import('./extracted-client'), {
  ssr: false,
})

interface UXMenuExtractedPageProps {
  params: {
    menuId: string
  }
}

export default function UXMenuExtractedPage({ params }: UXMenuExtractedPageProps) {
  return <UXMenuExtractedClient menuId={params.menuId} />
}