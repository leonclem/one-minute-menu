// "The View" Template Configuration
// A clean, modern menu template with elegant typography and layout

import type { TemplateConfig } from '@/types/templates'

/**
 * "The View" Template
 * 
 * A sophisticated menu template featuring:
 * - Clean, modern design with elegant typography
 * - Category sections with prominent headers
 * - Item layout: name + icon (left), price (right), description below
 * - Support for dietary tags, allergens, and variants
 * - Customizable colors and fonts
 * - Optimized for A4 portrait print format
 */
export const theViewTemplate: TemplateConfig = {
  metadata: {
    id: 'the-view',
    name: 'The View',
    description: 'A clean, modern menu template with elegant typography and layout. Perfect for upscale restaurants and cafes.',
    author: 'QR Menu System',
    version: '1.0.0',
    previewImageUrl: '/templates/the-view/preview.svg',
    thumbnailUrl: '/templates/the-view/thumbnail.svg',
    figmaFileKey: 'the-view-template', // Placeholder - would be actual Figma file key
    pageFormat: 'A4',
    orientation: 'portrait',
    tags: ['modern', 'elegant', 'restaurant', 'cafe', 'print'],
    isPremium: false,
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-18'),
  },

  bindings: {
    // Required bindings
    restaurantName: 'RestaurantName',
    categoryName: 'CategoryName',
    categoryItems: 'ItemsContainer',
    itemName: 'ItemName',

    // Optional bindings
    itemPrice: 'ItemPrice',
    itemDescription: 'ItemDescription',
    itemIcon: 'ItemIcon',
    itemDietaryTags: 'DietaryTags',
    itemAllergens: 'Allergens',
    itemVariants: 'VariantsContainer',

    // Conditional rendering rules
    conditionalLayers: [
      {
        layerName: 'ItemPrice',
        condition: 'hasPrice',
        action: 'show',
      },
      {
        layerName: 'ItemDescription',
        condition: 'hasDescription',
        action: 'show',
      },
      {
        layerName: 'ItemIcon',
        condition: 'hasIcon',
        action: 'show',
      },
      {
        layerName: 'DietaryTags',
        condition: 'hasDietaryTags',
        action: 'show',
      },
      {
        layerName: 'Allergens',
        condition: 'hasAllergens',
        action: 'show',
      },
      {
        layerName: 'VariantsContainer',
        condition: 'hasVariants',
        action: 'show',
      },
    ],
  },

  styling: {
    fonts: [
      {
        role: 'restaurant-name',
        family: 'Playfair Display',
        size: '36px',
        weight: '700',
        lineHeight: '1.2',
      },
      {
        role: 'category-name',
        family: 'Playfair Display',
        size: '24px',
        weight: '600',
        lineHeight: '1.3',
      },
      {
        role: 'item-name',
        family: 'Inter',
        size: '16px',
        weight: '600',
        lineHeight: '1.5',
      },
      {
        role: 'item-price',
        family: 'Inter',
        size: '16px',
        weight: '600',
        lineHeight: '1.5',
      },
      {
        role: 'item-description',
        family: 'Inter',
        size: '14px',
        weight: '400',
        lineHeight: '1.6',
      },
      {
        role: 'dietary-tags',
        family: 'Inter',
        size: '12px',
        weight: '500',
        lineHeight: '1.4',
      },
      {
        role: 'allergens',
        family: 'Inter',
        size: '12px',
        weight: '400',
        lineHeight: '1.4',
      },
      {
        role: 'variants',
        family: 'Inter',
        size: '14px',
        weight: '400',
        lineHeight: '1.5',
      },
    ],

    colors: [
      {
        role: 'primary',
        value: '#1a1a1a', // Dark text
      },
      {
        role: 'secondary',
        value: '#666666', // Medium gray for descriptions
      },
      {
        role: 'accent',
        value: '#d4af37', // Gold accent for highlights
      },
      {
        role: 'background',
        value: '#ffffff', // White background
      },
      {
        role: 'category-divider',
        value: '#e0e0e0', // Light gray for dividers
      },
      {
        role: 'dietary-tag-bg',
        value: '#f0f0f0', // Light background for tags
      },
      {
        role: 'dietary-tag-text',
        value: '#2d5016', // Green for dietary tags
      },
      {
        role: 'allergen-text',
        value: '#c41e3a', // Red for allergen warnings
      },
    ],

    spacing: {
      itemSpacing: 24, // Space between items in pixels
      categorySpacing: 48, // Space between categories in pixels
      padding: {
        top: 48,
        right: 48,
        bottom: 48,
        left: 48,
      },
    },
  },

  customization: {
    allowColorCustomization: true,
    allowFontCustomization: true,
    customizableColors: ['primary', 'accent', 'category-divider'],
    customizableFonts: ['restaurant-name', 'category-name', 'item-name'],
  },
}

/**
 * Export the template configuration
 */
export default theViewTemplate

