# Visual Regression Testing Setup Guide

This guide explains how to set up and run visual regression tests for the Dynamic Menu Layout Engine.

## Overview

Visual regression tests capture screenshots of rendered layouts and compare them against baseline images to detect unintended visual changes. This ensures that:

- Layout presets render consistently across updates
- Responsive breakpoints work correctly
- Export formats (HTML, PDF, PNG) match the live preview
- Theme customizations don't break the layout

## Prerequisites

- Node.js 18+ installed
- Project dependencies installed (`npm install`)
- Development server running (`npm run dev`)

## Installation

### 1. Install Playwright

```bash
npm install -D @playwright/test
```

### 2. Install Browsers

```bash
npx playwright install
```

This downloads Chromium, Firefox, and WebKit browsers for testing.

### 3. Create Playwright Configuration

Create `playwright.config.ts` in the project root:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/app/api/templates/__tests__',
  testMatch: '**/visual-regression.test.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] }
    }
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
})
```

### 4. Create Test Page

Create a dedicated test page for visual regression testing:

**File:** `src/app/test/menu-layout/page.tsx`

```typescript
import { Suspense } from 'react'
import { GridMenuLayout } from '@/components/templates/GridMenuLayout'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'
import type { LayoutMenuData } from '@/lib/templates/types'

// Sample menu data for testing
const sampleMenuData: LayoutMenuData = {
  metadata: {
    title: 'Test Menu',
    currency: '$'
  },
  sections: [
    {
      name: 'Appetizers',
      items: [
        { name: 'Bruschetta', price: 8.99, description: 'Toasted bread with tomatoes', featured: false },
        { name: 'Calamari', price: 12.99, description: 'Crispy fried squid', featured: false },
        { name: 'Caesar Salad', price: 9.99, featured: false }
      ]
    },
    {
      name: 'Main Courses',
      items: [
        { name: 'Margherita Pizza', price: 14.99, description: 'Classic tomato and mozzarella', featured: true },
        { name: 'Spaghetti Carbonara', price: 16.99, description: 'Pasta with bacon and egg', featured: false }
      ]
    }
  ]
}

export default function MenuLayoutTestPage({
  searchParams
}: {
  searchParams: { preset?: string; context?: string }
}) {
  const presetId = searchParams.preset || 'balanced'
  const context = (searchParams.context || 'desktop') as any
  const preset = LAYOUT_PRESETS[presetId] || LAYOUT_PRESETS['balanced']
  
  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<div>Loading...</div>}>
        <GridMenuLayout
          data={sampleMenuData}
          preset={preset}
          context={context}
          className="max-w-7xl mx-auto p-6"
        />
      </Suspense>
    </div>
  )
}
```

## Running Tests

### Generate Baseline Screenshots

On first run, Playwright will generate baseline screenshots:

```bash
npx playwright test --update-snapshots
```

This creates a `__screenshots__` directory with baseline images.

### Run Visual Regression Tests

```bash
npx playwright test
```

### View Test Report

```bash
npx playwright show-report
```

### Update Baselines (After Intentional Changes)

When you intentionally change the layout, update the baselines:

```bash
npx playwright test --update-snapshots
```

## Test Structure

The visual regression tests are organized into categories:

### 1. Layout Presets
- Dense Catalog
- Image Forward
- Balanced
- Feature Band
- Text-Only

### 2. Responsive Breakpoints
- Mobile (375x667)
- Tablet (768x1024)
- Desktop (1920x1080)

### 3. Export Format Consistency
- HTML vs Live Preview
- PDF vs HTML
- PNG vs HTML

### 4. Theme Variations
- Custom colors
- Typography scales

## CI/CD Integration

### GitHub Actions Example

Add to `.github/workflows/visual-regression.yml`:

```yaml
name: Visual Regression Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Run visual regression tests
        run: npx playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Troubleshooting

### Tests Failing Due to Minor Differences

Adjust the threshold in test configuration:

```typescript
await expect(page).toHaveScreenshot('layout.png', {
  threshold: 0.2 // Allow 20% difference
})
```

### Fonts Rendering Differently

Ensure consistent font loading:

```typescript
// Wait for fonts to load
await page.waitForLoadState('networkidle')
await page.evaluate(() => document.fonts.ready)
```

### Flaky Tests

Add explicit waits:

```typescript
await page.waitForSelector('.menu-layout')
await page.waitForTimeout(500) // Allow animations to complete
```

## Best Practices

1. **Keep Baselines in Version Control**: Commit baseline screenshots to Git
2. **Review Changes Carefully**: Always review screenshot diffs before updating baselines
3. **Test on Multiple Browsers**: Run tests on Chromium, Firefox, and WebKit
4. **Use Consistent Test Data**: Use the same menu data for all tests
5. **Isolate Tests**: Each test should be independent and not rely on others
6. **Document Intentional Changes**: When updating baselines, document why in commit message

## Example Test Implementation

```typescript
import { test, expect } from '@playwright/test'

test.describe('Visual Regression Tests', () => {
  test('should render Dense Catalog preset consistently', async ({ page }) => {
    await page.goto('/test/menu-layout?preset=dense-catalog')
    await page.waitForSelector('.menu-layout')
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveScreenshot('dense-catalog-desktop.png', {
      fullPage: true,
      threshold: 0.1
    })
  })
  
  test('should render mobile layout consistently', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/test/menu-layout?preset=balanced&context=mobile')
    await page.waitForSelector('.menu-layout')
    
    await expect(page).toHaveScreenshot('balanced-mobile.png', {
      fullPage: true
    })
  })
})
```

## Next Steps

1. Install Playwright: `npm install -D @playwright/test`
2. Create `playwright.config.ts` in project root
3. Create test page at `src/app/test/menu-layout/page.tsx`
4. Remove `.skip` from tests in `visual-regression.test.ts`
5. Generate baselines: `npx playwright test --update-snapshots`
6. Run tests: `npx playwright test`

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Visual Comparisons Guide](https://playwright.dev/docs/test-snapshots)
- [Best Practices](https://playwright.dev/docs/best-practices)
