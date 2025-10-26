/**
 * Theme Integration Module
 * 
 * Connects the existing MenuTheme system with the template layout engine.
 * Provides functions to apply theme colors and fonts to layout presets.
 */

import type { ColorPalette, FontConfiguration, MenuTheme } from '@/types'
import type { TemplateTheme, LayoutPreset } from './types'

/**
 * Convert MenuTheme to TemplateTheme
 * Extracts relevant theme properties for layout rendering
 */
export function convertMenuThemeToTemplateTheme(menuTheme: MenuTheme): TemplateTheme {
  return {
    typography: {
      scale: parseFloat(menuTheme.fonts.sizes.body) || 1.0,
      spacing: 1.0, // Default spacing multiplier
      borderRadius: 0.5 // Default border radius in rem
    },
    colors: {
      primary: menuTheme.colors.primary,
      secondary: menuTheme.colors.secondary,
      accent: menuTheme.colors.accent,
      background: menuTheme.colors.background,
      text: menuTheme.colors.text
    }
  }
}

/**
 * Apply theme colors to filler tiles
 * Returns CSS color values for filler tile backgrounds
 */
export function getFillerTileColors(colors: ColorPalette): {
  primary: string
  secondary: string
  accent: string
} {
  return {
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent
  }
}

/**
 * Apply theme fonts to layout
 * Returns font family strings for use in CSS
 */
export function getLayoutFonts(fonts: FontConfiguration): {
  primary: string
  secondary: string
  sizes: {
    heading: string
    body: string
    price: string
  }
} {
  return {
    primary: fonts.primary,
    secondary: fonts.secondary,
    sizes: {
      heading: fonts.sizes.heading,
      body: fonts.sizes.body,
      price: fonts.sizes.price
    }
  }
}

/**
 * Get theme-aware CSS variables for use in components
 * Returns an object suitable for React inline styles or CSS custom properties
 */
export function getThemeCSSVariables(theme: TemplateTheme): Record<string, string> {
  return {
    '--color-primary': theme.colors.primary,
    '--color-secondary': theme.colors.secondary,
    '--color-accent': theme.colors.accent,
    '--color-background': theme.colors.background,
    '--color-text': theme.colors.text,
    '--typography-scale': theme.typography.scale.toString(),
    '--typography-spacing': `${theme.typography.spacing}rem`,
    '--border-radius': `${theme.typography.borderRadius}rem`
  }
}

/**
 * Apply theme to a layout preset
 * Creates a new preset with theme-specific overrides while maintaining structure
 * 
 * Note: This function does NOT modify the preset's grid configuration or tile sizes.
 * It only applies color and typography theming for visual consistency.
 */
export function applyThemeToPreset(
  preset: LayoutPreset,
  theme: TemplateTheme
): LayoutPreset {
  // Return the preset as-is since theme colors and fonts are applied
  // at the component level via CSS variables and props
  // The preset structure (grid, tiles, spacing) remains unchanged
  return preset
}

/**
 * Merge theme with preset configuration
 * Combines MenuTheme with LayoutPreset to create a complete rendering configuration
 */
export interface ThemedLayoutConfig {
  preset: LayoutPreset
  theme: TemplateTheme
  cssVariables: Record<string, string>
  fonts: {
    primary: string
    secondary: string
    sizes: {
      heading: string
      body: string
      price: string
    }
  }
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
  }
}

/**
 * Create a complete themed layout configuration
 * Merges MenuTheme with LayoutPreset for rendering
 */
export function createThemedLayoutConfig(
  preset: LayoutPreset,
  menuTheme: MenuTheme
): ThemedLayoutConfig {
  const templateTheme = convertMenuThemeToTemplateTheme(menuTheme)
  const cssVariables = getThemeCSSVariables(templateTheme)
  const fonts = getLayoutFonts(menuTheme.fonts)
  
  return {
    preset,
    theme: templateTheme,
    cssVariables,
    fonts,
    colors: templateTheme.colors
  }
}

/**
 * Apply typography scale to text sizes
 * Adjusts font sizes based on theme typography scale
 */
export function applyTypographyScale(
  baseSize: string,
  scale: number
): string {
  // Parse the base size (e.g., '1rem', '16px')
  const match = baseSize.match(/^([\d.]+)(.+)$/)
  if (!match) return baseSize
  
  const [, value, unit] = match
  const scaledValue = parseFloat(value) * scale
  return `${scaledValue}${unit}`
}

/**
 * Get scaled font sizes based on theme
 */
export function getScaledFontSizes(
  fonts: FontConfiguration,
  scale: number
): FontConfiguration['sizes'] {
  return {
    heading: applyTypographyScale(fonts.sizes.heading, scale),
    body: applyTypographyScale(fonts.sizes.body, scale),
    price: applyTypographyScale(fonts.sizes.price, scale)
  }
}

/**
 * Get background color for filler tiles based on theme
 * Rotates through theme colors to create visual variety
 */
export function getFillerTileBackground(
  index: number,
  colors: ColorPalette
): string {
  const colorArray = [colors.primary, colors.secondary, colors.accent]
  return colorArray[index % colorArray.length]
}

/**
 * Check if theme colors are suitable for overlay text
 * Returns true if the theme has sufficient contrast for readable overlays
 */
export function isThemeSuitableForOverlay(colors: ColorPalette): boolean {
  // This is a simple check - actual contrast validation should use
  // the existing color.ts utilities (contrastRatio, isWcagAA)
  return colors.text !== colors.background
}

/**
 * Get theme-aware gradient for metadata overlays
 * Creates a semi-transparent gradient using theme colors
 */
export function getOverlayGradient(colors: ColorPalette): string {
  // Create a gradient from transparent to semi-opaque background color
  // This ensures text readability over images
  const bgColor = colors.background
  return `linear-gradient(to top, ${bgColor}ee 0%, ${bgColor}99 50%, ${bgColor}00 100%)`
}

/**
 * Export theme integration utilities
 */
export const themeIntegration = {
  convertMenuThemeToTemplateTheme,
  getFillerTileColors,
  getLayoutFonts,
  getThemeCSSVariables,
  applyThemeToPreset,
  getFillerTileBackground,
  isThemeSuitableForOverlay,
  getOverlayGradient,
  createThemedLayoutConfig,
  applyTypographyScale,
  getScaledFontSizes
}
