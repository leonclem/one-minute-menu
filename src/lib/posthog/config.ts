export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'email',
  'phone',
  'full_name',
  'name',
  'address',
  'billing_address',
  'payment',
  'password',
  'dish_name',
  'dish_description',
  'menu_text',
  'file_name',
  'prompt',
])

export const PERSON_PROPERTY_ALLOWLIST = [
  'role',
  'plan',
  'subscription_status',
  'is_admin',
  'is_approved',
  'created_at',
] as const

export type PersonProperty = (typeof PERSON_PROPERTY_ALLOWLIST)[number]

export type PersonProperties = Partial<Record<PersonProperty, string | number | boolean | null>>

export function getPostHogToken(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_TOKEN ?? ''
}

export function getPostHogHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
}

export function getPostHogUiHost(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || undefined
}

export function isAnalyticsEnabledEnv(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'
}

export function isDev(): boolean {
  return process.env.NODE_ENV !== 'production'
}
