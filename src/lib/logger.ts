/* eslint-disable no-console */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

function formatMessage(level: LogLevel, message: any, args: any[]): any[] {
  // Keep formatting simple to reduce overhead and avoid eslint no-console in prod
  return [message, ...args]
}

export const logger = {
  debug(message?: any, ...optionalParams: any[]): void {
    if (!isProd()) console.debug(...formatMessage('debug', message, optionalParams))
  },
  info(message?: any, ...optionalParams: any[]): void {
    if (!isProd()) console.log(...formatMessage('info', message, optionalParams))
  },
  warn(message?: any, ...optionalParams: any[]): void {
    if (!isProd()) console.warn(...formatMessage('warn', message, optionalParams))
  },
  error(message?: any, ...optionalParams: any[]): void {
    // Always log errors in non-test environments
    if (process.env.NODE_ENV !== 'test') console.error(...formatMessage('error', message, optionalParams))
  }
}
