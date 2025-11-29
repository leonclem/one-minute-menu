/**
 * ItemImageFallback Component
 * 
 * Renders a tasteful fallback when a menu item doesn't have an image
 * but the template expects one. Uses category-aware icons and template
 * accent colors to create visual consistency.
 */

'use client'

import React from 'react'

export interface ItemImageFallbackProps {
  /** Category name to determine which icon to show */
  category?: string
  /** Accent color from the template palette */
  accentColor: string
  /** Background color for the fallback */
  backgroundColor?: string
  /** Shape of the fallback area */
  shape: 'square' | 'circle' | 'rectangle'
  /** Size dimensions */
  size: { width: number | string; height: number | string }
  /** Optional className for additional styling */
  className?: string
}

/**
 * Map category keywords to food icons
 */
function getCategoryIcon(category?: string): string {
  if (!category) return '🍽️'
  
  const lowerCategory = category.toLowerCase()
  
  // Drinks
  if (lowerCategory.includes('drink') || lowerCategory.includes('beverage')) return '🥤'
  if (lowerCategory.includes('wine') || lowerCategory.includes('vino')) return '🍷'
  if (lowerCategory.includes('beer') || lowerCategory.includes('birra')) return '🍺'
  if (lowerCategory.includes('coffee') || lowerCategory.includes('caffè') || lowerCategory.includes('cafe')) return '☕'
  if (lowerCategory.includes('tea') || lowerCategory.includes('tè')) return '🍵'
  if (lowerCategory.includes('cocktail') || lowerCategory.includes('aperitivo')) return '🍸'
  if (lowerCategory.includes('juice') || lowerCategory.includes('succo')) return '🧃'
  
  // Courses
  if (lowerCategory.includes('appetizer') || lowerCategory.includes('antipasti') || lowerCategory.includes('starter')) return '🥗'
  if (lowerCategory.includes('soup') || lowerCategory.includes('zuppa') || lowerCategory.includes('minestra')) return '🍲'
  if (lowerCategory.includes('salad') || lowerCategory.includes('insalata')) return '🥗'
  if (lowerCategory.includes('pasta') || lowerCategory.includes('primi')) return '🍝'
  if (lowerCategory.includes('pizza')) return '🍕'
  if (lowerCategory.includes('risotto') || lowerCategory.includes('rice') || lowerCategory.includes('riso')) return '🍚'
  if (lowerCategory.includes('main') || lowerCategory.includes('secondi') || lowerCategory.includes('entree')) return '🍖'
  if (lowerCategory.includes('fish') || lowerCategory.includes('pesce') || lowerCategory.includes('seafood')) return '🐟'
  if (lowerCategory.includes('meat') || lowerCategory.includes('carne') || lowerCategory.includes('steak')) return '🥩'
  if (lowerCategory.includes('chicken') || lowerCategory.includes('pollo')) return '🍗'
  if (lowerCategory.includes('vegetarian') || lowerCategory.includes('vegan') || lowerCategory.includes('verdure')) return '🥬'
  
  // Desserts
  if (lowerCategory.includes('dessert') || lowerCategory.includes('dolci') || lowerCategory.includes('sweet')) return '🍰'
  if (lowerCategory.includes('ice') || lowerCategory.includes('gelato')) return '🍨'
  if (lowerCategory.includes('pastry') || lowerCategory.includes('pasticceria')) return '🥐'
  
  // Other
  if (lowerCategory.includes('breakfast') || lowerCategory.includes('colazione')) return '🍳'
  if (lowerCategory.includes('lunch') || lowerCategory.includes('pranzo')) return '🥪'
  if (lowerCategory.includes('dinner') || lowerCategory.includes('cena')) return '🍽️'
  if (lowerCategory.includes('snack') || lowerCategory.includes('spuntino')) return '🥨'
  if (lowerCategory.includes('side') || lowerCategory.includes('contorni')) return '🥔'
  if (lowerCategory.includes('bread') || lowerCategory.includes('pane')) return '🍞'
  if (lowerCategory.includes('cheese') || lowerCategory.includes('formaggio')) return '🧀'
  
  // Default
  return '🍽️'
}

/**
 * Get a subtle pattern background
 */
function getPatternBackground(accentColor: string): string {
  // Create a subtle diagonal stripe pattern using the accent color at low opacity
  return `repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    ${accentColor}08 10px,
    ${accentColor}08 20px
  )`
}

export function ItemImageFallback({
  category,
  accentColor,
  backgroundColor = '#f5f5f5',
  shape,
  size,
  className = ''
}: ItemImageFallbackProps) {
  const icon = getCategoryIcon(category)
  
  // Calculate border radius based on shape
  const borderRadius = shape === 'circle' ? '50%' : shape === 'square' ? '8px' : '8px'
  
  // Calculate icon size relative to container
  const iconSize = shape === 'circle' ? '2.5rem' : '3rem'
  
  return (
    <div
      className={`item-image-fallback ${className}`}
      style={{
        width: size.width,
        height: size.height,
        borderRadius,
        backgroundColor,
        background: `${getPatternBackground(accentColor)}, ${backgroundColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px solid ${accentColor}20`,
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem'
        }}
      >
        <span
          style={{
            fontSize: iconSize,
            filter: 'grayscale(30%)',
            opacity: 0.85
          }}
          role="img"
          aria-label={category || 'Menu item'}
        >
          {icon}
        </span>
      </div>
    </div>
  )
}

export default ItemImageFallback

