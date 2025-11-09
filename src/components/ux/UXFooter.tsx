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
            <Link href="/privacy" className="ux-footer-link">
              Privacy Policy
            </Link>
            <Link href="/terms" className="ux-footer-link">
              Terms of Service
            </Link>
            <Link href="/support" className="ux-footer-link">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}