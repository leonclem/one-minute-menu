/**
 * Build the public URL for a menu using user-namespaced slug: /u/:userId/:slug
 * For now we use userId; can be swapped to username later without callers changing.
 */
export function buildPublicMenuUrl(origin: string, userId: string, slug: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}/u/${encodeURIComponent(userId)}/${encodeURIComponent(slug)}`
}

/**
 * Generate a QR code PNG buffer for a given URL.
 * Size defaults to 512 for good print quality; margin keeps quiet zone.
 */
export async function generateQrPng(url: string, size: number = 512): Promise<Buffer> {
  const { toDataURL } = await import('qrcode')
  const dataUrl = await toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: size,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
  const base64 = dataUrl.split(',')[1]
  return Buffer.from(base64, 'base64')
}


