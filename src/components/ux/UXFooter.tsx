import Link from 'next/link'

export function UXFooter() {
  return (
    <footer className="ux-footer border-t border-ux-border bg-ux-background-secondary">
      <div className="container-ux py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-ux-text-secondary">
            © 2024 GridMenu. Built for restaurants.
          </p>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-ux-text-secondary hover:text-ux-text transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-ux-text-secondary hover:text-ux-text transition-colors">
              Terms of Service
            </Link>
            <Link href="/support" className="text-ux-text-secondary hover:text-ux-text transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}