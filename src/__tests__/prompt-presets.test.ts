import { PROMPT_PRESETS } from '@/app/admin/_components/prompt-presets'

describe('PROMPT_PRESETS', () => {
  it('has unique ids', () => {
    const ids = PROMPT_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})


