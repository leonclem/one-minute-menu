/**
 * @jest-environment node
 */

import { isStudioPromptLoggingEnabled, logStudioPrompt } from '../prompt-logging'

describe('prompt-logging', () => {
  const original = process.env.STUDIO_LOG_PROMPTS

  afterEach(() => {
    if (original === undefined) delete process.env.STUDIO_LOG_PROMPTS
    else process.env.STUDIO_LOG_PROMPTS = original
  })

  it('defaults off', () => {
    delete process.env.STUDIO_LOG_PROMPTS
    expect(isStudioPromptLoggingEnabled()).toBe(false)
  })

  it('enables only for the exact true token', () => {
    process.env.STUDIO_LOG_PROMPTS = 'true'
    expect(isStudioPromptLoggingEnabled()).toBe(true)
    process.env.STUDIO_LOG_PROMPTS = '1'
    expect(isStudioPromptLoggingEnabled()).toBe(false)
  })

  it('does not log when the flag is off', () => {
    delete process.env.STUDIO_LOG_PROMPTS
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    logStudioPrompt('mutate', 'secret prompt text')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
