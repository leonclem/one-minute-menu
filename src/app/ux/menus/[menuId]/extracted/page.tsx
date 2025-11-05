import UXMenuExtractedClient from './extracted-client'

interface UXMenuExtractedPageProps {
  params: {
    menuId: string
  }
}

export default function UXMenuExtractedPage({ params }: UXMenuExtractedPageProps) {
  return <UXMenuExtractedClient menuId={params.menuId} />
}