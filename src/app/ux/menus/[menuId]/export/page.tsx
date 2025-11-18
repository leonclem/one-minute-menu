import dynamic from 'next/dynamic'

const UXMenuExportClient = dynamic(() => import('./export-client'), {
  ssr: false,
})

interface UXMenuExportPageProps {
  params: {
    menuId: string
  }
}

export default function UXMenuExportPage({ params }: UXMenuExportPageProps) {
  return <UXMenuExportClient menuId={params.menuId} />
}