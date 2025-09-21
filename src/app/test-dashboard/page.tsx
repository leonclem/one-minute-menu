import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import Link from 'next/link'

// Test dashboard that bypasses authentication for development
export default function TestDashboardPage() {
  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com'
  }
  
  const mockProfile = {
    plan: 'free' as const,
    limits: {
      menus: 1,
      menuItems: 20,
      ocrJobs: 5,
      monthlyUploads: 10,
    }
  }
  
  const mockMenus = [
    {
      id: 'test-menu-1',
      name: 'Main Menu',
      status: 'draft',
      menu_data: {
        items: [
          { id: '1', name: 'Chicken Rice', price: 8.50, available: true },
          { id: '2', name: 'Beef Noodles', price: 12.00, available: true },
          { id: '3', name: 'Iced Coffee', price: 3.50, available: false },
        ]
      },
      created_at: new Date().toISOString(),
    }
  ]

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-secondary-900">
              Test Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-secondary-600">
                {mockUser.email}
              </span>
              <Link 
                href="/"
                className="text-sm text-secondary-500 hover:text-secondary-700"
              >
                Back to Home
              </Link>
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
              Welcome back! 👋 (Test Mode)
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
                    {mockProfile.plan}
                  </div>
                  <p className="text-sm text-secondary-500 mt-1">
                    {mockProfile.plan === 'free' ? '1 menu, 20 items' : 'Unlimited'}
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
                    {mockMenus.length}
                  </div>
                  <p className="text-sm text-secondary-500 mt-1">
                    {mockMenus.length === 1 ? 'menu created' : 'menus created'}
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
                  <Link
                    href="/test-dashboard/menus/new"
                    className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500"
                  >
                    Create new menu →
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Menus Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-secondary-900">
                Your Menus
              </h2>
              <Link
                href="/test-dashboard/menus/new"
                className="btn btn-primary"
              >
                Create Menu
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mockMenus.map((menu) => (
                <Card key={menu.id}>
                  <CardHeader>
                    <CardTitle>{menu.name}</CardTitle>
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
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary-600">Items:</span>
                        <span>{menu.menu_data?.items?.length || 0}</span>
                      </div>
                      <div className="pt-2">
                        <Link
                          href={`/test-dashboard/menus/${menu.id}`}
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
          </div>

          {/* Test Notice */}
          <div className="rounded-lg bg-yellow-50 p-6">
            <h3 className="text-lg font-medium text-yellow-900 mb-2">
              🧪 Test Mode Active
            </h3>
            <p className="text-sm text-yellow-800">
              This is a test dashboard that bypasses authentication. 
              In production, users would need to sign in to access this page.
              The menu editor and API calls will work with mock data.
            </p>
            <div className="mt-4">
              <Link 
                href="/test-auth"
                className="text-sm font-medium text-yellow-900 hover:text-yellow-700"
              >
                Test real authentication →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}