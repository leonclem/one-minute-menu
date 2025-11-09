'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import Logo from '../../../.kiro/specs/ux-implementation/Logos/logo.svg'

interface UXHeaderProps {
  userEmail?: string
}

export function UXHeader({ userEmail }: UXHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Navigation items
  const navigationItems = userEmail
    ? [
        { href: '/ux/pricing', label: 'Pricing' },
        { href: '/support', label: 'Support' },
      ]
    : [
        { href: '/ux/pricing', label: 'Pricing' },
        { href: '/support', label: 'Support' },
        { href: '/auth/signin', label: 'Sign In' },
      ]

  return (
    <header className="ux-header bg-transparent shrink-0">
      <div className="container-ux">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/ux" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <Image src={Logo} alt="GridMenu" width={24} height={24} priority className="logo-drop-shadow" />
            <span className="font-semibold text-white text-[21px] leading-none text-soft-shadow pl-[2px] pt-[4px]">GridMenu</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navigationItems.map((item) => (
              <Link 
                key={item.href}
                href={item.href} 
                className="ux-nav-link"
              >
                {item.label}
              </Link>
            ))}
            {userEmail && (
              <div className="flex items-center space-x-3">
                <form action="/auth/signout" method="post">
                  <button type="submit" className="ux-nav-link">Sign out</button>
                </form>
              </div>
            )}
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
          <div className="md:hidden py-4 animate-in slide-in-from-top-2 duration-200 bg-transparent">
            <nav className="flex flex-col space-y-2">
              {navigationItems.map((item) => (
                <Link 
                  key={item.href}
                  href={item.href} 
                  className="ux-nav-link"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {userEmail && (
                <div className="flex items-center justify-end pt-2">
                  <form action="/auth/signout" method="post">
                    <button type="submit" className="ux-nav-link">Sign out</button>
                  </form>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}