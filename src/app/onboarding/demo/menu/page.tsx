export const dynamic = 'force-dynamic'

export default function DemoPublicMenu() {
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Demo Menu</h1>
        <p className="text-sm text-secondary-600 mb-6">This is a sample, read-only public view for the demo.</p>
        <ul className="divide-y border rounded">
          <li className="p-4 flex justify-between">
            <span>Chicken Rice</span>
            <span className="font-semibold">$8.50</span>
          </li>
          <li className="p-4 flex justify-between">
            <span>Beef Noodles</span>
            <span className="font-semibold">$12.00</span>
          </li>
          <li className="p-4 flex justify-between">
            <span>Iced Coffee</span>
            <span className="font-semibold">$3.50</span>
          </li>
        </ul>
      </main>
    </div>
  )
}


