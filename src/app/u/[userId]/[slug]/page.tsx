import { Metadata, Viewport } from 'next'
import Image from 'next/image'
import { menuOperations } from '@/lib/database'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cn, formatCurrency } from '@/lib/utils'

type PageProps = {
  params: { userId: string; slug: string }
  searchParams?: Record<string, string | string[] | undefined>
}

export const revalidate = 30

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const menu = await menuOperations.getLatestPublishedSnapshotByUserAndSlug(params.userId, params.slug)
  if (!menu) return { title: 'Menu not found' }
  return {
    title: `${menu.name} · Menu`,
    description: `View ${menu.name} menu`,
  }
}

export async function generateViewport({ params }: PageProps): Promise<Viewport> {
  const menu = await menuOperations.getPublishedMenuByUserAndSlug(params.userId, params.slug)
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    themeColor: menu ? menu.theme.colors.primary : '#3B82F6',
  }
}

export default async function PublicMenuPage({ params, searchParams }: PageProps) {
  // Owner preview support
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const preview = (typeof searchParams?.preview === 'string' && searchParams?.preview === '1') || (Array.isArray(searchParams?.preview) && searchParams?.preview.includes('1'))

  // Fetch published snapshot by default
  let menu = await menuOperations.getLatestPublishedSnapshotByUserAndSlug(params.userId, params.slug)

  // If owner and query contains preview=1, fetch draft instead
  if (preview && user && user.id === params.userId) {
    const draft = await menuOperations.getDraftByUserAndSlug(params.userId, params.slug)
    if (draft) menu = draft
  }

  if (!menu) {

    return (
      <main className="mx-auto max-w-screen-sm p-4">
        <h1 className="text-xl font-semibold">Menu not found</h1>
        <p className="mt-2 text-sm text-gray-600">This menu may be unpublished or the link is incorrect.</p>
      </main>
    )
  }

  const colors = menu.theme.colors
  const availableItems = menu.items.filter(i => i.available)
  const unavailableItems = menu.items.filter(i => !i.available)

  return (
    <main
      className="mx-auto min-h-screen w-full max-w-screen-sm p-4"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      {preview && user && user.id === params.userId && (
        <div className="-mx-4 mb-3 rounded-b-md bg-yellow-100 px-4 py-2 text-center text-xs font-medium text-yellow-900">
          Preview — not live. Customers still see the last published version.
        </div>
      )}
      <header className="sticky top-0 z-10 -mx-4 mb-3 border-b px-4 py-3" style={{ backgroundColor: colors.background, borderColor: colors.secondary }}>
        <h1 className="text-2xl font-semibold" style={{ color: colors.text }}>{menu.name}</h1>
      </header>

      {/* Intentionally omit original menu photo from public view */}

      <section aria-labelledby="available-heading">
        <h2 id="available-heading" className="sr-only">Available items</h2>
        <ul className="space-y-3" role="list">
          {availableItems.map(item => (
            <li key={item.id} className={cn('rounded-lg border p-3', 'flex items-start justify-between gap-3')}
                style={{ borderColor: colors.secondary }}>
              <div className="min-w-0">
                <p className="truncate text-base font-medium" style={{ color: colors.text }}>{item.name}</p>
                {item.description ? (
                  <p className="mt-1 text-sm" style={{ color: colors.secondary }}>{item.description}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-base font-semibold" style={{ color: colors.primary }}>
                {formatCurrency(item.price)}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {unavailableItems.length > 0 && (
        <section aria-labelledby="unavailable-heading" className="mt-8">
          <h2 id="unavailable-heading" className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: colors.secondary }}>
            Currently unavailable
          </h2>
          <ul className="space-y-2" role="list">
            {unavailableItems.map(item => (
              <li key={item.id} className="rounded-md border p-3 opacity-60" style={{ borderColor: colors.secondary }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{item.name}</p>
                    {item.description ? (
                      <p className="mt-1 text-sm">{item.description}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs font-semibold" style={{ color: colors.secondary }}>Out of stock</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {menu.paymentInfo?.payNowQR && (
        <section aria-labelledby="payment-heading" className="mt-10">
          <h2 id="payment-heading" className="mb-2 text-sm font-semibold uppercase tracking-wide" style={{ color: colors.secondary }}>
            Payment
          </h2>
          <div className="flex items-center gap-4 rounded-lg border p-3" style={{ borderColor: colors.secondary }}>
            <div className="shrink-0 overflow-hidden rounded-md border" style={{ borderColor: colors.secondary }}>
              <Image src={menu.paymentInfo.payNowQR} alt="PayNow QR" width={128} height={128} loading="lazy" />
            </div>
            <div className="min-w-0 text-sm">
              <p>Scan the PayNow QR to pay at the counter.</p>
              <p className="mt-1 text-xs" style={{ color: colors.secondary }}>
                {menu.paymentInfo.disclaimer}
              </p>
            </div>
          </div>
        </section>
      )}

      <footer className="mt-12 pb-8 text-center text-xs" style={{ color: colors.secondary }}>
        Updated {menu.updatedAt.toLocaleDateString()}
      </footer>
    </main>
  )
}


