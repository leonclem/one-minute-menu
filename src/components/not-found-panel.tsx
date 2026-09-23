import Link from 'next/link'

type NotFoundAction = {
  href: string
  label: string
  variant?: 'primary' | 'outline'
}

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  backgroundColor: '#ffffff',
  color: '#111827',
} as const

const cardStyle = {
  width: '100%',
  maxWidth: '28rem',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  backgroundColor: '#ffffff',
  color: '#111827',
  padding: '24px',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
} as const

const primaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '8px 16px',
  borderRadius: '6px',
  backgroundColor: '#0891b2',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 600,
} as const

const outlineLinkStyle = {
  ...primaryLinkStyle,
  backgroundColor: '#ffffff',
  color: '#374151',
  border: '1px solid #d1d5db',
} as const

export function NotFoundPanel({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions: NotFoundAction[]
}) {
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>{title}</h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: 1.5, color: '#374151' }}>{description}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              style={action.variant === 'outline' ? outlineLinkStyle : primaryLinkStyle}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
