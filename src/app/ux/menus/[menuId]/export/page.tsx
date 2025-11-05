import UXMenuExportClient from './export-client'

interface UXMenuExportPageProps {
  params: {
    menuId: string
  }
}

export default function UXMenuExportPage({ params }: UXMenuExportPageProps) {
  return <UXMenuExportClient menuId={params.menuId} />
}