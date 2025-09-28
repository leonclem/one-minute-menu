'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-secondary-50">
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-secondary-500 hover:text-secondary-700">← Back</Link>
              <h1 className="text-2xl font-bold text-secondary-900">Upgrade your plan</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container-mobile py-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Free</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-secondary-700">
                <li>• 1 menu</li>
                <li>• Up to 20 items</li>
                <li>• 5 OCR jobs / month</li>
                <li>• 10 uploads / month</li>
              </ul>
              <Button variant="outline" className="mt-4" disabled>Current plan</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Premium</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-secondary-700">
                <li>• Up to 10 menus</li>
                <li>• Up to 500 items</li>
                <li>• 50 OCR jobs / month</li>
                <li>• 100 uploads / month</li>
              </ul>
              <Button variant="primary" className="mt-4">Contact to upgrade</Button>
            </CardContent>
          </Card>
        </div>
        <p className="mt-6 text-xs text-secondary-500">Stripe billing integration to be added in a later phase.</p>
      </main>
    </div>
  )
}


