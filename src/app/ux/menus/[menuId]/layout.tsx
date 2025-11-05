import { UXWrapper } from '@/components/ux'

export default function MenuProcessingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UXWrapper>
      {children}
    </UXWrapper>
  )
}