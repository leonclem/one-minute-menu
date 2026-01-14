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

export function sanitizeMenuPayload<T extends { 
  name?: string; 
  paymentInfo?: any;
  establishmentType?: string;
  primaryCuisine?: string;
  venueInfo?: any;
}>(data: T): T {
  const out = { ...data }
  if (out.name !== undefined) out.name = sanitizeString(out.name, 100) as any
  if (out.establishmentType !== undefined) out.establishmentType = sanitizeString(out.establishmentType, 50) as any
  if (out.primaryCuisine !== undefined) out.primaryCuisine = sanitizeString(out.primaryCuisine, 50) as any
  
  if (out.venueInfo) {
    const vi = { ...out.venueInfo }
    if (vi.address !== undefined) vi.address = sanitizeString(vi.address, 200)
    if (vi.email !== undefined) vi.email = sanitizeString(vi.email, 100)
    if (vi.phone !== undefined) vi.phone = sanitizeString(vi.phone, 50)
    if (vi.socialMedia) {
      const sm = { ...vi.socialMedia }
      if (sm.instagram !== undefined) sm.instagram = sanitizeString(sm.instagram, 50)
      if (sm.facebook !== undefined) sm.facebook = sanitizeString(sm.facebook, 100)
      if (sm.x !== undefined) sm.x = sanitizeString(sm.x, 50)
      if (sm.website !== undefined) sm.website = sanitizeString(sm.website, 100)
      vi.socialMedia = sm
    }
    out.venueInfo = vi
  }

  if (out.paymentInfo) {
    const pi = { ...out.paymentInfo }
    if (pi.instructions !== undefined) pi.instructions = sanitizeString(pi.instructions, 300)
    if (pi.alternativePayments !== undefined) pi.alternativePayments = sanitizeArrayOfStrings(pi.alternativePayments, 50, 5)
    if (pi.disclaimer !== undefined) pi.disclaimer = sanitizeString(pi.disclaimer, 200)
    out.paymentInfo = pi
  }
  return out
}

export function sanitizeProfilePayload<T extends { 
  username?: string; 
  restaurantName?: string;
  establishmentType?: string;
  primaryCuisine?: string;
  location?: string;
  onboardingCompleted?: boolean;
}>(data: T): T {
  const out = { ...data }
  if (out.username !== undefined) out.username = sanitizeString(out.username, 50) as any
  if (out.restaurantName !== undefined) out.restaurantName = sanitizeString(out.restaurantName, 100) as any
  if (out.establishmentType !== undefined) out.establishmentType = sanitizeString(out.establishmentType, 50) as any
  if (out.primaryCuisine !== undefined) out.primaryCuisine = sanitizeString(out.primaryCuisine, 50) as any
  if (out.location !== undefined) out.location = sanitizeString(out.location, 100) as any
  // onboardingCompleted is boolean, no sanitization needed beyond existence check
  return out
}


