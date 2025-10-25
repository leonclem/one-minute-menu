// "Racing Green" Template Configuration
// A clean, modern menu template with elegant typography and layout

import type { TemplateConfig } from '@/types/templates'

/**
 * "Racing Green" Template
 * 
 * A green menu template with a racing green color scheme. Perfect for upscale restaurants and cafes.
 */
export const racingGreenTemplate: TemplateConfig = {
  metadata: {
    id: 'racing-green',
    name: 'Racing Green',
    description: 'A racing green menu template with a green color scheme. Perfect for upscale restaurants and cafes.',
    author: 'QR Menu System',
    version: '1.0.1',
    previewImageUrl: '/templates/racing-green/preview.svg',
    thumbnailUrl: '/templates/racing-green/thumbnail.png',
    figmaFileKey: 'racing-green-template', // Placeholder - would be actual Figma file key
    pageFormat: 'A4',
    orientation: 'portrait',
    tags: ['green', 'racing', 'restaurant', 'cafe', 'print'],
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

  // Optional template-specific CSS to achieve sidebar/header layout until parser is wired
  styles: {
    css: `
.menu-container {
  position: relative;
  min-height: 297mm; /* A4 portrait visual frame */
  border: 6px solid var(--color-category-divider, #031709);
  padding-left: calc(20mm + 24px); /* content offset for sidebar */
}

/* Left sidebar strip */
.menu-container::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 20mm;
  background-color: var(--color-category-divider, #031709);
}

/* Sidebar vertical title */
.menu-container::after {
  content: "Racing Green";
  position: absolute;
  left: 10mm; top: 50%;
  transform: translate(-50%, -50%) rotate(-90deg);
  color: var(--color-background, #c3e6ce);
  font-family: var(--font-restaurant-name, serif);
  font-size: 20px; letter-spacing: 1px;
}

.restaurant-name { /* page heading */
  font-size: 40px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 18px;
  position: relative;
}
.restaurant-name::after { /* decorative underline */
  content: "";
  display: block;
  width: 120px;
  height: 2px;
  margin: 8px auto 0;
  background-color: var(--color-category-divider, #031709);
}

.category-header { 
  border-bottom-width: 3px; 
  border-bottom-color: var(--color-category-divider, #031709);
}

.category-name { margin-top: 24px; }
.item-description { margin-top: 6px; }
.item-price { text-align: right; }
`,
    fonts: [],
    colors: {},
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
        value: '#031709', // Racing green text
      },
      {
        role: 'secondary',
        value: '#000802', // White for descriptions
      },
      {
        role: 'accent',
        value: '#000802', // Racing green accent for highlights
      },
      {
        role: 'background',
        value: '#c3e6ce', // Racing green background
      },
      {
        role: 'category-divider',
        value: '#031709', // Racing green for dividers
      },
      {
        role: 'dietary-tag-bg',
        value: '#000802', // Racing green background for tags
      },
      {
        role: 'dietary-tag-text',
        value: '#000802', // White for dietary tags
      },
      {
        role: 'allergen-text',
        value: '#000802', // White for allergen warnings
      },
    ],

    spacing: {
      itemSpacing: 12, // Space between items in pixels
      categorySpacing: 24, // Space between categories in pixels
      padding: {
        top: 24,
        right: 24,
        bottom: 24,
        left: 24,
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
export default racingGreenTemplate

