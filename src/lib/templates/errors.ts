// Template System Error Types and HTTP Mapping

export type TemplateErrorCode =
  | 'TEMPLATE_NOT_FOUND'
  | 'INVALID_TEMPLATE_CONFIG'
  | 'DATABASE_ERROR'
  | 'STORAGE_ERROR'
  | 'COMPILATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'MENU_NOT_FOUND'
  | 'NO_CATEGORIES'
  | 'UNAUTHORIZED'
  | 'UNKNOWN_ERROR'

export class TemplateError extends Error {
  constructor(
    message: string,
    public code: TemplateErrorCode = 'UNKNOWN_ERROR',
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'TemplateError'
  }
}

export function mapErrorToHttp(error: unknown): { status: number; body: any } {
  // Known template error
  if (error instanceof TemplateError) {
    const status =
      error.code === 'UNAUTHORIZED' ? 401 :
      error.code === 'TEMPLATE_NOT_FOUND' ? 404 :
      error.code === 'MENU_NOT_FOUND' ? 404 :
      error.code === 'NO_CATEGORIES' ? 400 :
      error.code === 'INVALID_TEMPLATE_CONFIG' ? 400 :
      error.code === 'VALIDATION_FAILED' ? 400 :
      error.code === 'DATABASE_ERROR' ? 500 :
      error.code === 'STORAGE_ERROR' ? 503 :
      error.code === 'COMPILATION_FAILED' ? 500 :
      500
    return { status, body: { error: error.message, code: error.code, details: error.details } }
  }

  // Template registry/compiler errors (with code field)
  if (error instanceof Error && (error as any).code) {
    const code: string = (error as any).code
    const status =
      code === 'UNAUTHORIZED' ? 401 :
      code === 'TEMPLATE_NOT_FOUND' ? 404 :
      code === 'MENU_NOT_FOUND' ? 404 :
      code === 'NO_CATEGORIES' ? 400 :
      code === 'INVALID_TEMPLATE_CONFIG' ? 400 :
      code === 'VALIDATION_FAILED' ? 400 :
      code === 'DATABASE_ERROR' ? 500 :
      code === 'STORAGE_ERROR' ? 503 :
      code === 'COMPILATION_FAILED' ? 500 :
      400
    return { status, body: { error: error.message, code } }
  }

  // Propagate existing structured error objects
  if (error && typeof error === 'object' && 'message' in error && 'code' in (error as any)) {
    const e = error as any
    return { status: 400, body: { error: e.message, code: e.code } }
  }

  // Fallback unknown error
  return { status: 500, body: { error: 'Internal server error' } }
}


