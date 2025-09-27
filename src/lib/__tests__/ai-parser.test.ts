import { parseMenuFallback, buildPrompt } from '@/lib/ai-parser'

describe('ai-parser fallback', () => {
  it('extracts simple name and price pairs', () => {
    const text = `
Chicken Rice $5.00
Roasted Duck - 8.50
ICED TEA 2.00
`
    const items = parseMenuFallback(text)
    expect(items.length).toBeGreaterThanOrEqual(3)

    const names = items.map(i => i.name.toLowerCase())
    expect(names).toContain('chicken rice')
    expect(names).toContain('roasted duck')
    expect(names).toContain('iced tea')
  })

  it('handles comma separated descriptions', () => {
    const text = `Spaghetti, tomato sauce $12.90`
    const items = parseMenuFallback(text)
    expect(items[0].name.toLowerCase()).toBe('spaghetti')
    expect(items[0].description?.toLowerCase()).toContain('tomato')
    expect(items[0].price).toBeCloseTo(12.9)
  })
})

describe('ai-parser buildPrompt', () => {
  it('includes currency and OCR text', () => {
    const prompt = buildPrompt('Sample OCR', 'SGD')
    expect(prompt).toContain('SGD')
    expect(prompt).toContain('<ocr>')
    expect(prompt).toContain('Sample OCR')
  })
})


