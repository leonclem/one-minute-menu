import { buildPublicMenuUrl } from '@/lib/qr'

describe('QR URL builder', () => {
  it('builds user-namespaced menu URL', () => {
    const url = buildPublicMenuUrl('https://app.example.com/', 'user-123', 'my-menu')
    expect(url).toBe('https://app.example.com/u/user-123/my-menu')
  })

  it('escapes special characters', () => {
    const url = buildPublicMenuUrl('https://host', 'user id', 'menu name')
    expect(url).toBe('https://host/u/user%20id/menu%20name')
  })
})


