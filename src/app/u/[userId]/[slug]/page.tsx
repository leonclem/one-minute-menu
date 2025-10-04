import { Metadata, Viewport } from 'next'
import { menuOperations } from '@/lib/database'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cn, formatCurrency } from '@/lib/utils'
import CopyOrderNote from '@/components/CopyOrderNote'

type PageProps = {
  params: { userId: string; slug: string }
  searchParams?: Record<string, string | string[] | undefined>
}

export const revalidate = 30

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    // Try published first, then draft
    let menu = await menuOperations.getLatestPublishedSnapshotByUserAndSlug(params.userId, params.slug)
    if (!menu) {
      menu = await menuOperations.getDraftByUserAndSlug(params.userId, params.slug)
    }
    if (!menu) return { title: 'Menu not found' }
    return {
      title: `${menu.name} · Menu`,
      description: `View ${menu.name} menu`,
    }
  } catch (error) {
    // Fallback for build-time errors
    console.error('Error generating metadata:', error)
    return { title: 'Menu' }
  }
}

export async function generateViewport({ params }: PageProps): Promise<Viewport> {
  try {
    // Try published first, then draft
    let menu = await menuOperations.getPublishedMenuByUserAndSlug(params.userId, params.slug)
    if (!menu) {
      menu = await menuOperations.getDraftByUserAndSlug(params.userId, params.slug)
    }
    return {
      width: 'device-width',
      initialScale: 1,
      maximumScale: 5,
      userScalable: true,
      themeColor: menu ? menu.theme.colors.primary : '#3B82F6',
    }
  } catch (error) {
    // Fallback for build-time errors
    console.error('Error generating viewport:', error)
    return {
      width: 'device-width',
      initialScale: 1,
      maximumScale: 5,
      userScalable: true,
      themeColor: '#3B82F6',
    }
  }
}

export default async function PublicMenuPage({ params, searchParams }: PageProps) {
  // Owner preview support
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const preview = (typeof searchParams?.preview === 'string' && searchParams?.preview === '1') || (Array.isArray(searchParams?.preview) && searchParams?.preview.includes('1'))

  let menu = null

  // If owner and query contains preview=1, fetch draft first
  if (preview && user && user.id === params.userId) {
    menu = await menuOperations.getDraftByUserAndSlug(params.userId, params.slug)
  }
  
  // If no draft found (or not preview), try published version
  if (!menu) {
    menu = await menuOperations.getLatestPublishedSnapshotByUserAndSlug(params.userId, params.slug)
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
  const payment = menu.paymentInfo

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

      {/* Payment information */}
      {payment && (payment.payNowQR || payment.instructions || (payment.alternativePayments && payment.alternativePayments.length > 0)) && (
        <section className="mt-6" aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="text-lg font-semibold mb-2" style={{ color: colors.text }}>Payment</h2>
          <div className="rounded-lg border p-3" style={{ borderColor: colors.secondary }}>
            {payment.payNowQR && (
              <div className="mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={payment.payNowQR} alt="PayNow QR code" className="w-40 h-40 mx-auto rounded bg-white" />
                <p className="mt-2 text-center text-xs" style={{ color: colors.secondary }}>Scan with your banking app</p>
              </div>
            )}
            {payment.instructions && (
              <p className="text-sm" style={{ color: colors.text }}>{payment.instructions}</p>
            )}
            {payment.alternativePayments && payment.alternativePayments.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm" style={{ color: colors.text }}>
                {payment.alternativePayments.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs" style={{ color: colors.secondary }}>
              {payment.disclaimer || 'Payment handled by your bank app; platform does not process funds'}
            </p>
          </div>
        </section>
      )}

      {/* Copy order note for quick reference at counter */}
      {availableItems.length > 0 && (
        <div className="mt-4">
          <CopyOrderNote items={availableItems.map(i => ({ name: i.name }))} />
        </div>
      )}

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

      

      <footer className="mt-12 pb-8 text-center text-xs" style={{ color: colors.secondary }}>
        Updated {menu.updatedAt.toLocaleDateString()}
      </footer>
    </main>
  )
}


