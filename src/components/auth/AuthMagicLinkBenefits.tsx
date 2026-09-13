const MAGIC_LINK_BENEFITS = [
  'No passwords to remember',
  'More secure than traditional login',
  'Perfect for mobile devices',
  'One-click access from your email',
]

export function AuthMagicLinkBenefits() {
  return (
    <div className="mt-8">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-[var(--studio-panel,#0f1c1f)] px-3 text-white/45">
            Why magic links?
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-sm text-white/65">
        {MAGIC_LINK_BENEFITS.map((item) => (
          <li key={item} className="flex items-center">
            <svg
              className="mr-2 h-4 w-4 shrink-0 text-[var(--studio-teal,#01b3bf)]"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414 1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
