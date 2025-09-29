import { sanitizeString, sanitizeArrayOfStrings, sanitizeMenuItemPayload, sanitizeMenuPayload } from '@/lib/security'

describe('security sanitizers', () => {
  test('sanitizeString trims, collapses whitespace and removes control chars', () => {
    const input = '  hello\tworld\n\u0000bad  '\n+    const out = sanitizeString(input)
    expect(out).toBe('hello world\nbad')
  })

  test('sanitizeString enforces max length', () => {
    const out = sanitizeString('x'.repeat(600), 100)!
    expect(out.length).toBe(100)
  })

  test('sanitizeArrayOfStrings filters non-strings and trims each', () => {
    const out = sanitizeArrayOfStrings(['  a  ', 1, null, 'b  '], 10, 10)!
    expect(out).toEqual(['a', 'b'])
  })

  test('sanitizeMenuItemPayload cleans fields', () => {
    const payload = sanitizeMenuItemPayload({
      name: '  Burger  ',
      description: '  Tasty  burger  ',
      category: '  Mains  ',
    })
    expect(payload.name).toBe('Burger')
    expect(payload.description).toBe('Tasty burger')
    expect(payload.category).toBe('Mains')
  })

  test('sanitizeMenuPayload cleans nested paymentInfo', () => {
    const payload = sanitizeMenuPayload({
      name: '  Lunch  Menu  ',
      paymentInfo: {
        instructions: '  Pay  via bank  ',
        alternativePayments: ['  cash  ', '  paylah  ', 1 as any],
        disclaimer: '  Disclaim  ',
      },
    })
    expect(payload.name).toBe('Lunch Menu')
    expect(payload.paymentInfo.instructions).toBe('Pay via bank')
    expect(payload.paymentInfo.alternativePayments).toEqual(['cash', 'paylah'])
    expect(payload.paymentInfo.disclaimer).toBe('Disclaim')
  })
})


