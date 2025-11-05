'use client'

import Link from 'next/link'
import { useState } from 'react'

export function UXHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Navigation items
  const navigationItems = [
    { href: '/ux/pricing', label: 'Pricing' },
    { href: '/support', label: 'Support' },
    { href: '/admin', label: 'Admin' }, // Admin access as per requirements
    { href: '/auth/signin', label: 'Sign In' },
  ]

  return (
    <header className="ux-header border-b border-ux-border bg-white sticky top-0 z-50">
      <div className="container-ux">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/ux" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded bg-ux-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-ux-text" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-ux-text">GridMenu</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navigationItems.map((item) => (
              <Link 
                key={item.href}
                href={item.href} 
                className="text-ux-text-secondary hover:text-ux-text transition-colors font-medium px-3 py-2 rounded-md hover:bg-ux-background-secondary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-md text-ux-text-secondary hover:text-ux-text hover:bg-ux-background-secondary transition-colors"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-ux-border bg-white py-4 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-2">
              {navigationItems.map((item) => (
                <Link 
                  key={item.href}
                  href={item.href} 
                  className="text-ux-text-secondary hover:text-ux-text transition-colors font-medium px-3 py-2 rounded-md hover:bg-ux-background-secondary"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}