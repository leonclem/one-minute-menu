import { InputHTMLAttributes, forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface UXInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

/**
 * UXInput component with UX implementation styling
 */
const UXInput = forwardRef<HTMLInputElement, UXInputProps>(
  ({ className, type = 'text', label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const describedBy =
      error ? errorId : helperText ? helperId : undefined

    return (
      <div className="space-y-2">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-ux-text"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            'input-ux',
            error && 'border-ux-error focus:border-ux-error',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-sm text-ux-error" role="alert" id={errorId}>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-sm text-ux-text-secondary break-words" id={helperId}>
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

UXInput.displayName = 'UXInput'

export { UXInput }