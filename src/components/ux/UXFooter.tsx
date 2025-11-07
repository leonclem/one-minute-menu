import Link from 'next/link'

export function UXFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="ux-footer shrink-0" style={{ backgroundColor: 'rgb(var(--ux-primary))' }}>
      <div className="container-ux py-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-white/90 text-soft-shadow">
            © {year} GridMenu. Built for food & beverage businesses.
          </p>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-white/90 hover:text-white transition-colors text-soft-shadow">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-white/90 hover:text-white transition-colors text-soft-shadow">
              Terms of Service
            </Link>
            <Link href="/support" className="text-white/90 hover:text-white transition-colors text-soft-shadow">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}