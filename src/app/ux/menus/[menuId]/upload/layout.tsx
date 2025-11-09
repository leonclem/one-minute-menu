import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Upload Your Menu | GridMenu',
}

export default function UploadUxLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defer shared header/footer/background to parent [menuId]/layout for a single-page experience
  return children
}
