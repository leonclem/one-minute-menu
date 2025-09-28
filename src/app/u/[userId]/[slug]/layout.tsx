import PullToRefresh from '@/components/PullToRefresh'

export default function PublicMenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <PullToRefresh>
      {children}
    </PullToRefresh>
  )
}


