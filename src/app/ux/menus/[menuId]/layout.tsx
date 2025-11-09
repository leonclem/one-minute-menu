import type { Metadata } from 'next'
import { UXHeader } from '@/components/ux/UXHeader'
import { UXFooter } from '@/components/ux/UXFooter'
import ClientFlowShell from './ClientFlowShell'

export const metadata: Metadata = {
  title: 'Menu Processing | GridMenu',
}

export default function MenuProcessingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { menuId: string }
}) {
  // Defer persistent chrome (header/footer/background) to parent /ux/layout.
  // Here we only provide the client shell that manages transitions and progress.
  return (
    <ClientFlowShell menuId={params.menuId}>
      {children}
    </ClientFlowShell>
  )
}