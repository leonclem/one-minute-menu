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
          <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/gridmenu"
                target="_blank"
                rel="noreferrer"
                aria-label="GridMenu on X"
                className="inline-flex h-5 w-5 items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" fill="#ffffff" />
                  <path
                    fill="rgb(var(--ux-primary))"
                    d="M8 7.2h1.7l2.1 2.9 2.5-2.9H16l-3.1 3.5L16.2 17h-1.7l-2.3-3.1L10 17H8.3l3.3-3.7z"
                  />
                </svg>
              </a>
              <a
                href="https://www.facebook.com/gridmenu/"
                target="_blank"
                rel="noreferrer"
                aria-label="GridMenu on Facebook"
                className="inline-flex h-5 w-5 items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" fill="#ffffff" />
                  <path
                    fill="rgb(var(--ux-primary))"
                    d="M13.3 8H14.8V6.1C14.5 6.1 13.7 6 12.8 6c-1.9 0-3.1 1.1-3.1 3.2V11H8v2h1.7v5h2.1v-5h1.7l.3-2h-2V9.4c0-.8.3-1.4 1.5-1.4z"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="mt-4 text-left">
          <p className="text-[10px] text-white/60 text-soft-shadow leading-relaxed">
            GridMenu is operated by Gorrrf Private Ltd (UEN: 202550882W), registered in Singapore. &nbsp;•&nbsp; Registered address: 111 Somerset Road, #08-10A, 111 Somerset, Singapore 238164.
          </p>
        </div>
      </div>
    </footer>
  )
}