/**
 * CompatibilityBadge Component
 * 
 * Displays the compatibility status of a template with a menu.
 * Shows OK (green), WARNING (yellow), or INCOMPATIBLE (red) badges
 * with appropriate icons and tooltip messages.
 */

'use client'

import React from 'react'

export interface CompatibilityBadgeProps {
  status: 'OK' | 'WARNING' | 'INCOMPATIBLE'
  message?: string
  warnings?: string[]
}

export default function CompatibilityBadge({ 
  status, 
  message, 
  warnings = []
}: CompatibilityBadgeProps) {
  const getBadgeStyles = () => {
    switch (status) {
      case 'OK':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'INCOMPATIBLE':
        return 'bg-red-100 text-red-800 border-red-200'
    }
  }

  const getIcon = () => {
    switch (status) {
      case 'OK':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'WARNING':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'INCOMPATIBLE':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  const tooltipContent = message || (warnings.length > 0 ? warnings.join('. ') : '')

  return (
    <div 
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getBadgeStyles()}`} 
      title={tooltipContent}
      role="status"
      aria-label={`Template compatibility: ${status}${tooltipContent ? `. ${tooltipContent}` : ''}`}
    >
      {getIcon()}
      <span className="ml-1.5">{status}</span>
    </div>
  )
}
