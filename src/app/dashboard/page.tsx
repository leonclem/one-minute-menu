import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations, menuOperations } from '@/lib/database'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import EditableMenuTitle from './EditableMenuTitle'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { getCurrentUser } from '@/lib/auth-utils'
const QuotaUsageDashboard = nextDynamic(() => import('@/components/QuotaUsageDashboard'), { ssr: false })

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }

  // Get user profile, menus, and check if user is admin
  const [profile, menus, currentUser] = await Promise.all([
    userOperations.getProfile(user.id),
    menuOperations.getUserMenus(user.id),
    getCurrentUser()
  ])
  
  const isAdmin = currentUser?.role === 'admin'

  // Show dashboard even if the user has no menus. Onboarding remains available via links below.

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-secondary-900">
              Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              {isAdmin && (
                <Link
                  href="/admin/analytics"
                  className="text-sm text-secondary-500 hover:text-secondary-700"
                >
                  Analytics
                </Link>
              )}
              <span className="text-sm text-secondary-600">
                {user.email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-secondary-500 hover:text-secondary-700"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-mobile py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div>
            <h2 className="text-xl font-semibold text-secondary-900 mb-4">
              Welcome back! 👋
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Plan Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-secondary-600">
                    Current Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary-600 capitalize">
                    {profile?.plan || 'Free'}
                  </div>
                  <p className="text-sm text-secondary-500 mt-1">
                    {profile?.plan === 'free' ? '1 menu, 20 items' : 'Unlimited'}
                  </p>
                </CardContent>
              </Card>

              {/* Menu Count */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-secondary-600">
                    Your Menus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-secondary-900">
                    {menus?.length || 0}
                  </div>
                  <p className="text-sm text-secondary-500 mt-1">
                    {menus?.length === 1 ? 'menu created' : 'menus created'}
                  </p>
                </CardContent>
              </Card>

              {/* Quick Action */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-secondary-600">
                    Quick Start
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <Link
                      href="/dashboard/menus/new"
                      className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500"
                    >
                      Create your first menu →
                    </Link>
                    <Link
                      href="/onboarding"
                      className="inline-flex items-center text-xs text-secondary-600 hover:text-secondary-800"
                    >
                      Open onboarding walkthrough
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* AI Image Generation (Summary) */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-secondary-900">AI Image Generation</h2>
            <QuotaUsageDashboard variant="summary" showAdminLink={isAdmin} />
          </div>

          {/* Menus Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-secondary-900">
                Your Menus
              </h2>
              <Link
                href="/dashboard/menus/new"
                className="btn btn-primary"
              >
                Create Menu
              </Link>
            </div>

            {menus && menus.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {menus.map((menu) => (
                  <Card key={menu.id}>
                  <CardHeader>
                    <CardTitle>
                      <EditableMenuTitle id={menu.id} name={menu.name} />
                    </CardTitle>
                  </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-secondary-600">Status:</span>
                          <span className={`capitalize px-2 py-1 rounded-full text-xs ${
                            menu.status === 'published' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {menu.status}
                            {menu.status === 'published' && menu.publishedAt && (
                              <span className="ml-1 text-xs opacity-75">
                                ({new Date(menu.publishedAt).toLocaleDateString()})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-secondary-600">Items:</span>
                          <span>{menu.items?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-secondary-600">Version:</span>
                          <span>v{menu.version}</span>
                        </div>
                        <div className="pt-2">
                          <Link
                            href={`/dashboard/menus/${menu.id}`}
                            className="text-sm font-medium text-primary-600 hover:text-primary-500"
                          >
                            Edit menu →
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="mx-auto h-12 w-12 text-secondary-400 mb-4">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-secondary-900 mb-2">
                    No menus yet
                  </h3>
                  <p className="text-secondary-600 mb-6">
                    Create your first digital menu to get started
                  </p>
                  <div className="flex flex-col items-center gap-2">
                    <Link
                      href="/dashboard/menus/new"
                      className="btn btn-primary"
                    >
                      Create Your First Menu
                    </Link>
                    <Link
                      href="/onboarding"
                      className="text-xs text-secondary-600 hover:text-secondary-800"
                    >
                      Or open onboarding walkthrough
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}