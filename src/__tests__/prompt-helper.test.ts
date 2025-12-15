import { buildPromptHelperText } from '@/app/admin/_components/prompt-helper'

describe('buildPromptHelperText', () => {
  it('includes mode-specific guidance for composite', () => {
    const text = buildPromptHelperText('composite', {
      dishName: 'Steak frites',
      cameraAngle: 'three_quarter',
      lighting: 'natural_soft',
      background: 'restaurant_table',
    })

    expect(text).toContain('Reference-image COMPOSITE instructions:')
    expect(text).toContain('Place the generated plated dish naturally INTO the reference setting.')
    expect(text).toContain('Dish: Steak frites')
  })

  it('includes mode-specific guidance for style match', () => {
    const text = buildPromptHelperText('style_match', {
      cuisine: 'Italian',
      cameraAngle: 'top_down',
      lighting: 'moody_restaurant',
      background: 'dark_slate',
    })

    expect(text).toContain('Reference-image STYLE MATCH instructions:')
    expect(text).toContain('Use the reference image as the style reference')
    expect(text).toContain('Cuisine: Italian')
  })
})


