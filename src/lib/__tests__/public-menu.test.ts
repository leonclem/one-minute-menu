import { meetsWCAGAA, formatCurrency } from '@/lib/utils'

describe('Public menu basics', () => {
  it('meets WCAG AA for default colors', () => {
    // default theme in DB uses text #111827 on white background
    expect(meetsWCAGAA('#111827', '#FFFFFF')).toBe(true)
  })

  it('formats SGD prices correctly', () => {
    expect(formatCurrency(5)).toContain('5.00')
  })
})


