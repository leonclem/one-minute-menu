import UXMenuExtractClient from './extract-client'

interface UXMenuExtractPageProps {
  params: {
    menuId: string
  }
}

export default function UXMenuExtractPage({ params }: UXMenuExtractPageProps) {
  return <UXMenuExtractClient menuId={params.menuId} />
}