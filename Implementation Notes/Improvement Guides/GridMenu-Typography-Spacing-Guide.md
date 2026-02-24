# GridMenu Typography & Spacing Guide

**Version:** 1.0  
**Date:** February 2026  
**Purpose:** Design system specifications for menu templates

---

## Table of Contents

1. [Typography System](#typography-system)
2. [Spacing System](#spacing-system)
3. [Hierarchy Principles](#hierarchy-principles)
4. [Practical Examples](#practical-examples)
5. [Quick Reference](#quick-reference)
6. [Implementation Priorities](#implementation-priorities)

---

## Typography System

### Font Family Hierarchy

#### Three-Font System (Recommended)

```css
/* HEADINGS - Serif for elegance */
--font-heading: 'Playfair Display', 'Merriweather', Georgia, serif;

/* UI TEXT - Sans-serif for clarity */
--font-ui: 'Inter', 'Montserrat', 'Raleway', system-ui, sans-serif;

/* BODY - Optimised for readability */
--font-body: 'Source Sans Pro', 'Open Sans', 'Lato', system-ui, sans-serif;
```

#### Two-Font System (Simpler Alternative)

```css
/* HEADINGS */
--font-heading: 'Merriweather', Georgia, serif;

/* EVERYTHING ELSE */
--font-body: 'Inter', system-ui, sans-serif;
```

#### Usage Rules

| Element | Font Family | Rationale |
|---------|-------------|-----------|
| Category headers | `font-heading` (serif) | Provides elegance and hierarchy |
| Menu item names | `font-ui` (sans-serif) | Needs to be scannable |
| Descriptions | `font-body` (sans-serif) | Optimised readability |
| Prices | `font-ui` (sans-serif) | Matches item names |
| Footer text | `font-body` (sans-serif) | Subtle and clear |

---

### Font Size Scale

**Base Size:** 16px (never go below 14px for body text)

**Modular Scale:** 1.33x multiplier ("Perfect Fourth")

```css
/* SIZE SCALE */
--text-xs: 12px;    /* Footer text, labels */
--text-sm: 14px;    /* Descriptions */
--text-base: 16px;  /* Default body */
--text-lg: 21px;    /* Menu item names */
--text-xl: 28px;    /* Category headers */
--text-2xl: 37px;   /* Page title */
--text-3xl: 49px;   /* Hero/banner */
```

#### Applied to Menu Elements

```css
.page-title {
  font-family: var(--font-heading);
  font-size: var(--text-3xl);    /* 49px */
  font-weight: 700;
  line-height: 1.1;
}

.category-header {
  font-family: var(--font-heading);
  font-size: var(--text-xl);     /* 28px */
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

.menu-item-name {
  font-family: var(--font-ui);
  font-size: var(--text-lg);     /* 21px */
  font-weight: 600;
  line-height: 1.3;
}

.menu-item-description {
  font-family: var(--font-body);
  font-size: var(--text-sm);     /* 14px */
  font-weight: 400;
  line-height: 1.6;              /* CRITICAL */
}

.menu-item-price {
  font-family: var(--font-ui);
  font-size: var(--text-lg);     /* 21px */
  font-weight: 700;              /* Heavier than name */
  line-height: 1;
}

.footer-text {
  font-family: var(--font-body);
  font-size: var(--text-xs);     /* 12px */
  font-weight: 400;
  line-height: 1.5;
}
```

---

### Font Weight Guidelines

```css
/* WEIGHT HIERARCHY */
--weight-light: 300;      /* Large display text only (24px+) */
--weight-regular: 400;    /* Descriptions, body text */
--weight-medium: 500;     /* Subheadings, emphasis */
--weight-semibold: 600;   /* Menu item names */
--weight-bold: 700;       /* Category headers, prices */
--weight-black: 900;      /* Page titles, hero text */
```

#### Weight Rules

| Rule | Specification |
|------|---------------|
| ❌ Never use light (300) | For text under 24px - illegible |
| ✅ Descriptions always regular (400) | Anything heavier is tiring to read |
| ✅ Prices always bolder than names | Creates clear hierarchy |
| ⚠️ Light weights for print | Use 400+ for print menus |

---

### Letter Spacing (Tracking)

```css
/* TIGHTER for headings */
.category-header {
  letter-spacing: 0.02em;  /* 2% - subtle tightening */
}

/* NORMAL for body */
.menu-item-description {
  letter-spacing: 0;       /* Default */
}

/* WIDER for all-caps (essential) */
.label-uppercase {
  letter-spacing: 0.1em;   /* 10% - prevents cramping */
  text-transform: uppercase;
}

/* PRICES - slightly looser */
.menu-item-price {
  letter-spacing: 0.01em;  /* 1% - improves number readability */
}
```

**Golden Rule:** If using `text-transform: uppercase`, **always** add `letter-spacing: 0.08em` minimum.

---

### Line Height (Leading)

```css
/* TIGHT for headings */
.page-title, .category-header {
  line-height: 1.1;  /* Compact, dramatic */
}

/* MODERATE for UI text */
.menu-item-name, .menu-item-price {
  line-height: 1.3;  /* Tight but readable */
}

/* GENEROUS for body text */
.menu-item-description {
  line-height: 1.6;  /* CRITICAL - needs air */
}

/* EXTRA for long-form content */
.about-section {
  line-height: 1.8;  /* For paragraphs */
}
```

#### Line Height Rules

| Text Size | Line Height | Use Case |
|-----------|-------------|----------|
| Large (28px+) | 1.1 - 1.2 | Headings, titles |
| Medium (18-24px) | 1.3 | UI elements, names |
| Small (14-16px) | 1.6 - 1.8 | Body text, descriptions |

**Rule:** The smaller the font, the MORE line-height needed.

---

### Text Alignment

#### Grid Layouts (Current Design)

```css
.menu-item-card {
  text-align: center;  /* ✅ Works for grid tiles */
}

.menu-item-name,
.menu-item-description,
.menu-item-price {
  text-align: center;
}
```

#### Alternative: Left-Aligned (Better for Long Descriptions)

```css
.menu-item-card {
  text-align: left;
}

.menu-item-price {
  text-align: right;
  margin-left: auto;   /* Pushes to right */
}
```

#### When to Use Each

| Layout | Best For |
|--------|----------|
| **Centre** | Grid layouts, short descriptions (1-2 lines), symmetrical designs |
| **Left** | List layouts, long descriptions (3+ lines), scannable menus |

---

## Spacing System

### Base Unit: 8px Grid

All spacing should be multiples of 8px (or 4px for fine-tuning):

```css
/* SPACING SCALE */
--space-1: 4px;   /* Tiny gap */
--space-2: 8px;   /* Small gap */
--space-3: 12px;  /* Moderate gap */
--space-4: 16px;  /* Standard gap */
--space-5: 24px;  /* Comfortable gap */
--space-6: 32px;  /* Large gap */
--space-8: 48px;  /* Section gap */
--space-10: 64px; /* Category gap */
```

---

### Menu Item Card Internal Spacing

```css
.menu-item-card {
  padding: var(--space-5);  /* 24px all around */
  
  /* OR more generous: */
  padding: var(--space-6);  /* 32px all around */
}

/* INTERNAL STRUCTURE */
.menu-item-image {
  margin-bottom: var(--space-4);  /* 16px to name */
}

.menu-item-name {
  margin-bottom: var(--space-2);  /* 8px to description */
  /* Name and description should feel connected */
}

.menu-item-description {
  margin-bottom: var(--space-3);  /* 12px to price */
  /* Separates content from price */
}

.menu-item-price {
  margin-top: auto;  /* Pushes to bottom in flexbox */
}
```

#### Visual Hierarchy Formula

```
Image
  ↓ 16px (moderate separation)
Name
  ↓ 8px (tight - they belong together)
Description  
  ↓ 12px (medium - separates from price)
Price
```

---

### Grid Gap (Between Cards)

```css
.menu-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);  /* 24px between cards */
  
  /* OR more generous: */
  gap: var(--space-6);  /* 32px between cards */
}
```

**Rule:** Gap should equal or exceed the card's internal padding for visual balance.

---

### Category Spacing

```css
.category-section {
  margin-bottom: var(--space-10);  /* 64px between categories */
}

.category-header {
  margin-bottom: var(--space-6);   /* 32px to first item */
}
```

#### Category Rhythm

```
Category Header
  ↓ 32px (half the inter-category gap)
[Grid of items with 24px gaps]
  ↓ 64px (full category separation)
Next Category Header
```

---

### Page Margins

```css
.menu-page {
  padding: var(--space-10);  /* 64px page edges */
  
  /* OR for A4/Letter print: */
  padding: 48px;             /* Standard print margin */
}
```

---

## Hierarchy Principles

### The Three-Level System

#### Level 1: Page Structure (Categories)

```css
font-size: 28px
font-weight: 700
margin-bottom: 32px
+ decorative element (underline, background, etc.)
```

**Purpose:** Divides menu into scannable sections

#### Level 2: Content Units (Menu Items)

```css
font-size: 21px (name) / 21px (price)
font-weight: 600 (name) / 700 (price)
margin between elements: 8-16px
```

**Purpose:** Primary information - what and how much

#### Level 3: Supporting Info (Descriptions)

```css
font-size: 14px
font-weight: 400
line-height: 1.6 (most important!)
```

**Purpose:** Additional context, ingredients

---

### How Spacing Creates Hierarchy

**Tight spacing (8px)** = "These elements belong together"  
→ Menu item name + description

**Medium spacing (16-24px)** = "These are separate items"  
→ Between menu items

**Large spacing (48-64px)** = "This is a new section"  
→ Between categories

---

## Practical Examples

### Current Layout Specifications

Based on your screenshot, here are the recommended specifications:

```css
/* CATEGORY HEADER */
.category-header {
  font-family: 'Merriweather', serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  letter-spacing: 0.02em;
  color: #5a5a5a;
  margin-bottom: 32px;
  padding-bottom: 12px;
  border-bottom: 3px solid #d4a574;
}

/* MENU CARD */
.menu-item-card {
  background: #f5f5f0;
  padding: 24px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  text-align: center;
}

/* IMAGE */
.menu-item-image {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 16px;
}

/* NAME */
.menu-item-name {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  color: #2d2d2d;
  margin-bottom: 8px;
}

/* DESCRIPTION */
.menu-item-description {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;     /* CRITICAL */
  color: #666666;
  margin-bottom: 12px;
  flex-grow: 1;         /* Pushes price to bottom */
}

/* PRICE */
.menu-item-price {
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 700;     /* Heavier than name */
  line-height: 1;
  color: #b8860b;
}

/* GRID */
.menu-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  margin-bottom: 64px;
}

/* PAGE */
.menu-page {
  padding: 64px;
  background: #ffffff;
}
```

---

### Tailwind CSS Example

```jsx
<div className="p-16 bg-white">
  {/* Category Header */}
  <h2 className="font-serif text-3xl font-bold text-center mb-8 pb-3 border-b-4 border-amber-600">
    Insalate
  </h2>

  {/* Grid */}
  <div className="grid grid-cols-4 gap-6 mb-16">
    
    {/* Menu Card */}
    <div className="bg-stone-50 p-6 rounded-lg flex flex-col text-center">
      
      {/* Image */}
      <img 
        src="/image.jpg" 
        className="w-full h-48 object-cover rounded-md mb-4"
      />
      
      {/* Name */}
      <h3 className="font-semibold text-lg mb-2 leading-tight">
        Spinach Salad
      </h3>
      
      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed mb-3 flex-grow">
        Apples, goat cheese, apple cider dressing
      </p>
      
      {/* Price */}
      <p className="text-lg font-bold text-amber-700">
        $9.50
      </p>
    </div>
    
  </div>
</div>
```

---

## Quick Reference

### Typography Scale

| Element | Size | Weight | Line Height | Font |
|---------|------|--------|-------------|------|
| **Page Title** | 49px | 700 | 1.1 | Serif |
| **Category** | 28px | 700 | 1.2 | Serif |
| **Item Name** | 21px | 600 | 1.3 | Sans |
| **Description** | 14px | 400 | 1.6 | Sans |
| **Price** | 21px | 700 | 1.0 | Sans |
| **Footer** | 12px | 400 | 1.5 | Sans |

### Spacing Scale

| Element | Spacing |
|---------|---------|
| **Image → Name** | 16px |
| **Name → Description** | 8px |
| **Description → Price** | 12px |
| **Card Padding** | 24px |
| **Grid Gap** | 24px |
| **Category Gap** | 64px |
| **Page Margin** | 64px |

### Line Height Rules

| Text Type | Line Height |
|-----------|-------------|
| **Headings** | 1.1 - 1.2 |
| **UI Elements** | 1.3 |
| **Body Text** | 1.6 - 1.8 |

---

## Implementation Priorities

### Priority 1: Biggest Impact (Do First)

1. **Fix description line-height to 1.6**
   - Currently looks cramped in your screenshot
   - Single biggest readability improvement

2. **Standardise spacing: name/description/price**
   - 8px between name and description
   - 12px between description and price

3. **Make prices heavier than names**
   - Names: font-weight: 600
   - Prices: font-weight: 700

### Priority 2: Polish

4. **Implement modular font-size scale**
   - Use the 1.33x multiplier system
   - Ensures consistent visual rhythm

5. **Add subtle letter-spacing to category headers**
   - `letter-spacing: 0.02em`
   - Improves readability at larger sizes

6. **Ensure consistent card padding**
   - 24px on all sides
   - Creates breathing room

### Priority 3: Refinement

7. **Consider serif fonts for category headers only**
   - Provides elegant distinction
   - Keep body text sans-serif

8. **Standardise grid gaps to 24px**
   - Consistent rhythm across templates

9. **Add 64px spacing between categories**
   - Clear visual separation

---

## Testing Checklist

Before finalising a template:

- [ ] Description line-height is at least 1.6
- [ ] Spacing follows 8px grid system
- [ ] Prices are bolder than menu item names
- [ ] Category headers use larger font size (28px+)
- [ ] Grid gaps are consistent (24px recommended)
- [ ] Page margins are generous (48-64px)
- [ ] Text is readable at 14px minimum
- [ ] Letter-spacing applied to uppercase text
- [ ] All spacing is multiples of 4px or 8px

---

## Notes for Developers

### CSS Variables Setup

```css
:root {
  /* Typography */
  --font-heading: 'Merriweather', Georgia, serif;
  --font-ui: 'Inter', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  
  /* Font Sizes */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 21px;
  --text-xl: 28px;
  --text-2xl: 37px;
  --text-3xl: 49px;
  
  /* Font Weights */
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-black: 900;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;
  --space-10: 64px;
}
```

### Tailwind Config Extension

```javascript
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        heading: ['Merriweather', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        'lg': '21px',
        'xl': '28px',
        '2xl': '37px',
        '3xl': '49px',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '24px',
        '6': '32px',
        '8': '48px',
        '10': '64px',
      },
      lineHeight: {
        'tight': '1.1',
        'snug': '1.3',
        'relaxed': '1.6',
        'loose': '1.8',
      },
    },
  },
}
```

---

## Common Mistakes to Avoid

| ❌ Mistake | ✅ Correct Approach |
|-----------|---------------------|
| Using same weight for all text | Use weight hierarchy (400 → 600 → 700) |
| Inconsistent spacing values (13px, 17px) | Stick to 8px grid (8, 16, 24, 32) |
| Line-height under 1.5 for body text | Minimum 1.6 for descriptions |
| Uppercase text without letter-spacing | Always add 0.08em+ spacing |
| Light fonts (300) at small sizes | Use 400+ for text under 24px |
| Centre-aligning long descriptions | Left-align when text exceeds 2 lines |

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Maintained by:** GridMenu Design Team

---

## Additional Resources

- [Google Fonts](https://fonts.google.com/) - Free web fonts
- [Type Scale Calculator](https://typescale.com/) - Generate modular scales
- [Modular Scale](https://www.modularscale.com/) - Visualise scale relationships
- [Butterick's Practical Typography](https://practicaltypography.com/) - Typography fundamentals
