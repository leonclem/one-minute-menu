import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const UXMenuExtractedClient = dynamic(() => import('./extracted-client'), {
  ssr: false,
})

interface UXMenuExtractedPageProps {
  params: {
    menuId: string
  }
}

export default function UXMenuExtractedPage({ params }: UXMenuExtractedPageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-secondary-600 font-medium">Loading menu data...</p>
        </div>
      </div>
    }>
      <UXMenuExtractedClient menuId={params.menuId} />
    </Suspense>
  )
}