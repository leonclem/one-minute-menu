import { logger } from '@/lib/logger'

/** Same green Node uses for inspected strings, without the inspect line breaks. */
const GREEN = '\x1b[32m'
const RESET = '\x1b[0m'

export function isStudioPromptLoggingEnabled(): boolean {
  return process.env.STUDIO_LOG_PROMPTS === 'true'
}

/**
 * Prints a long dev-only string in green.
 * Logging it as an object field makes Node re-quote and split the text, which
 * shows up as blank gap lines. The escape codes are display-only.
 */
export function logDevGreenText(text: string): void {
  console.log(`${GREEN}${text}${RESET}`)
}

/** Prints the exact model-facing prompt when STUDIO_LOG_PROMPTS=true. Local/dev only. */
export function logStudioPrompt(context: string, prompt: string): void {
  if (!isStudioPromptLoggingEnabled()) return
  logger.info(`📝 [Studio] Prompt (${context}) length=${prompt.length}`)
  logDevGreenText(prompt)
}
