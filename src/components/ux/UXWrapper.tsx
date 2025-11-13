import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface UXWrapperProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'centered' | 'full-width'
}

/**
 * UXWrapper component that provides consistent styling for wrapping existing functionality
 * with the new UX implementation design system
 */
export function UXWrapper({ 
  children, 
  className,
  variant = 'default' 
}: UXWrapperProps) {
  const baseClasses = 'ux-wrapper'
  
  const variantClasses = {
    default: 'container-ux py-8',
    centered: 'container-ux py-8 flex flex-col items-center justify-center min-h-[60vh]',
    'full-width': 'w-full py-8'
  }

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      {children}
    </div>
  )
}

/**
 * UXSection component for creating consistent sections within the UX flow
 */
interface UXSectionProps {
  children: ReactNode
  title?: string
  subtitle?: string
  className?: string
}

export function UXSection({ children, title, subtitle, className }: UXSectionProps) {
  return (
    <section className={cn('ux-section py-12', className)}>
      <div className="container-ux">
        {(title || subtitle) && (
          <div className="text-center mb-8">
            {title && (
              <h2 className="text-3xl md:text-4xl font-bold text-ux-text mb-4">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-lg text-ux-text-secondary max-w-2xl mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}

/**
 * UXCard component for consistent card styling
 */
interface UXCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  hover?: boolean
  clickable?: boolean
}

export function UXCard({ 
  children, 
  className, 
  hover = false, 
  clickable = false,
  onClick,
  ...props
}: UXCardProps) {
  const baseClasses = 'card-ux'
  const interactiveClasses = clickable ? 'cursor-pointer hover:shadow-lg' : hover ? 'hover:shadow-lg' : ''
  
  return (
    <div 
      className={cn(baseClasses, interactiveClasses, className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}