// Security-related helpers: input sanitization and basic validators

export function sanitizeString(input: unknown, maxLength = 500): string | undefined {
  if (typeof input !== 'string') return undefined
  const trimmed = input.trim().replace(/\s+/g, ' ')
  // Remove control chars except newlines and tabs
  const cleaned = trimmed.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  return cleaned.slice(0, maxLength)
}

export function sanitizeArrayOfStrings(input: unknown, maxItemLength = 200, maxItems = 20): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  const result: string[] = []
  for (const item of input) {
    const s = sanitizeString(item, maxItemLength)
    if (typeof s === 'string' && s.length > 0) result.push(s)
    if (result.length >= maxItems) break
  }
  return result
}

export function sanitizeMenuItemPayload<T extends { name?: string; description?: string; category?: string }>(data: T): T {
  const out = { ...data }
  if (out.name !== undefined) out.name = sanitizeString(out.name, 100) as any
  if (out.description !== undefined) out.description = sanitizeString(out.description, 500) as any
  if (out.category !== undefined) out.category = sanitizeString(out.category, 50) as any
  return out
}

export function sanitizeMenuPayload<T extends { name?: string; paymentInfo?: any }>(data: T): T {
  const out = { ...data }
  if (out.name !== undefined) out.name = sanitizeString(out.name, 100) as any
  if (out.paymentInfo) {
    const pi = { ...out.paymentInfo }
    if (pi.instructions !== undefined) pi.instructions = sanitizeString(pi.instructions, 300)
    if (pi.alternativePayments !== undefined) pi.alternativePayments = sanitizeArrayOfStrings(pi.alternativePayments, 50, 5)
    if (pi.disclaimer !== undefined) pi.disclaimer = sanitizeString(pi.disclaimer, 200)
    out.paymentInfo = pi
  }
  return out
}


