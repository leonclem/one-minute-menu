/**
 * @jest-environment node
 */

import { buildReframeSpikePrompt } from './prompt'

describe('reframe spike prompt', () => {
  it('describes a camera-phone zoom-out that keeps the frame shape', () => {
    const prompt = buildReframeSpikePrompt('all', '3:4')
    expect(prompt).toContain('reducing zoom on a camera phone')
    expect(prompt).toContain('Keep this image\'s aspect ratio')
    expect(prompt).toContain('Do not move, tilt, orbit')
    expect(prompt).toContain('Continue objects that already touch')
    expect(prompt).toContain('Do not add food, props')
    expect(prompt).toContain('Add the extra scene on every side')
    expect(prompt).toContain('Emit the result as 3:4')
  })

  it('names the padded side for directional layouts', () => {
    expect(buildReframeSpikePrompt('right')).toContain('only to the right')
    expect(buildReframeSpikePrompt('left')).toContain('only to the left')
  })
})
