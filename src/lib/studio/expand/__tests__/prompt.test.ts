/**
 * @jest-environment node
 */

import { buildExpandScenePrompt } from '../prompt'

describe('buildExpandScenePrompt', () => {
  it('describes a camera-phone zoom-out that keeps the frame shape', () => {
    const prompt = buildExpandScenePrompt('3:4')
    expect(prompt).toContain('reducing zoom on a camera phone')
    expect(prompt).toContain("Keep this image's aspect ratio")
    expect(prompt).toContain('Do not move, tilt, orbit')
    expect(prompt).toContain('Continue objects that already touch')
    expect(prompt).toContain('Do not add food, props')
    expect(prompt).toContain('Add the extra scene on every side')
    expect(prompt).toContain('Emit the result as 3:4')
  })

  it('asks for extra scene mostly on the named side without changing shape', () => {
    const prompt = buildExpandScenePrompt('3:4', 'left')
    expect(prompt).toContain('mostly to the left')
    expect(prompt).toContain('frame shape stays the same')
    expect(prompt).toContain('Do not add extra scene to the right')
    expect(prompt).not.toContain('Do not invent scene above, below, or to the right')
  })

  it('asks for extra scene mostly in a corner without changing shape', () => {
    const prompt = buildExpandScenePrompt('3:4', 'top_left')
    expect(prompt).toContain('mostly above and to the left')
    expect(prompt).toContain('Keep the frame shape the same')
    expect(prompt).toContain('bottom-right of the frame')
    expect(prompt).not.toContain('Do not invent scene above, below, or to the right')
  })
})
