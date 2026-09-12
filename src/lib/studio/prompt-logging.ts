import { logger } from '@/lib/logger'

export function isStudioPromptLoggingEnabled(): boolean {
  return process.env.STUDIO_LOG_PROMPTS === 'true'
}

/** Prints the exact model-facing prompt when STUDIO_LOG_PROMPTS=true. Local/dev only. */
export function logStudioPrompt(context: string, prompt: string): void {
  if (!isStudioPromptLoggingEnabled()) return
  logger.info(`📝 [Studio] Prompt (${context})`, {
    promptLength: prompt.length,
    prompt,
  })
}
