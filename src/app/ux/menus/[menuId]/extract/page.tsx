import dynamic from 'next/dynamic'

const UXMenuExtractClient = dynamic(() => import('./extract-client'), {
  ssr: false,
})

interface UXMenuExtractPageProps {
  params: {
    menuId: string
  }
}

export default function UXMenuExtractPage({ params }: UXMenuExtractPageProps) {
  return <UXMenuExtractClient menuId={params.menuId} />
}