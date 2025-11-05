import UXMenuTemplateClient from './template-client'

interface UXMenuTemplatePageProps {
  params: {
    menuId: string
  }
}

export default function UXMenuTemplatePage({ params }: UXMenuTemplatePageProps) {
  return <UXMenuTemplateClient menuId={params.menuId} />
}