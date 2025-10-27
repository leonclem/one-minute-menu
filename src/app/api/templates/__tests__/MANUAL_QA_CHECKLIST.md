# Manual QA Testing Checklist

This checklist guides manual testing of the Dynamic Menu Layout Engine to verify functionality, usability, and quality across different devices and scenarios.

## Test Environment Setup

- [ ] Development server running (`npm run dev`)
- [ ] Test menu data available in database
- [ ] Multiple test menus prepared:
  - [ ] Small menu (5-10 items)
  - [ ] Medium menu (20-30 items)
  - [ ] Large menu (50+ items)
  - [ ] Text-only menu (no images)
  - [ ] Image-heavy menu (>70% with images)
  - [ ] Mixed media menu (some images, some text-only)

## Device Testing

### Desktop Testing (1920x1080)

#### Layout Rendering
- [ ] Navigate to menu template preview page
- [ ] Verify menu title displays correctly
- [ ] Verify all sections render with proper headers
- [ ] Verify all menu items display with name and price
- [ ] Verify descriptions show when available
- [ ] Verify images load correctly (if present)
- [ ] Verify grid columns match desktop preset (4-6 columns)
- [ ] Verify spacing between tiles is consistent
- [ ] Verify filler tiles appear in dead space (if applicable)

#### Preset Selection
- [ ] Test Dense Catalog preset
  - [ ] Verify compact layout with smaller tiles
  - [ ] Verify 4-6 columns on desktop
  - [ ] Verify text is readable
- [ ] Test Image Forward preset
  - [ ] Verify larger image tiles
  - [ ] Verify metadata overlay on images
  - [ ] Verify overlay text is legible
- [ ] Test Balanced preset
  - [ ] Verify balanced mix of images and text
  - [ ] Verify consistent tile sizes
- [ ] Test Feature Band preset
  - [ ] Verify wide tiles for featured items
  - [ ] Verify 3 columns on desktop
- [ ] Test Text-Only preset
  - [ ] Verify line-based layout
  - [ ] Verify price alignment
  - [ ] Verify no image placeholders

#### Export Functionality
- [ ] Click "Export HTML" button
  - [ ] Verify download starts
  - [ ] Open downloaded HTML file
  - [ ] Verify it matches preview
  - [ ] Verify styles are inline
  - [ ] Verify it works without internet connection
- [ ] Click "Export PDF" button
  - [ ] Verify download starts (may take 5-10 seconds)
  - [ ] Open downloaded PDF
  - [ ] Verify layout matches preview
  - [ ] Verify text is selectable
  - [ ] Verify page breaks are appropriate
  - [ ] Test both portrait and landscape orientations
- [ ] Click "Export PNG" button
  - [ ] Verify download starts
  - [ ] Open downloaded PNG
  - [ ] Verify image quality is good
  - [ ] Verify layout matches preview
- [ ] Click "Export JPG" button
  - [ ] Verify download starts
  - [ ] Open downloaded JPG
  - [ ] Verify image quality is acceptable

### Tablet Testing (768x1024)

- [ ] Open browser dev tools and set viewport to tablet size
- [ ] Verify grid adjusts to 3-4 columns
- [ ] Verify tiles resize appropriately
- [ ] Verify text remains readable
- [ ] Verify images scale correctly
- [ ] Verify spacing adjusts for smaller screen
- [ ] Test all presets on tablet viewport
- [ ] Test exports from tablet viewport

### Mobile Testing (375x667)

- [ ] Open browser dev tools and set viewport to mobile size
- [ ] Verify grid adjusts to 2-3 columns
- [ ] Verify tiles stack vertically
- [ ] Verify text is readable without zooming
- [ ] Verify images don't overflow
- [ ] Verify metadata overlay works on mobile
- [ ] Verify touch targets are large enough
- [ ] Test all presets on mobile viewport
- [ ] Test exports from mobile viewport

### Physical Device Testing

#### iPhone/Android Phone
- [ ] Open menu on actual mobile device
- [ ] Verify layout renders correctly
- [ ] Verify scrolling is smooth
- [ ] Verify images load on cellular connection
- [ ] Verify touch interactions work
- [ ] Test in portrait and landscape orientations

#### iPad/Android Tablet
- [ ] Open menu on actual tablet device
- [ ] Verify layout renders correctly
- [ ] Verify appropriate column count
- [ ] Test in portrait and landscape orientations

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through menu items
- [ ] Verify focus indicators are visible
- [ ] Verify tab order follows visual layout
- [ ] Verify all interactive elements are reachable
- [ ] Test with keyboard only (no mouse)

### Screen Reader Testing
- [ ] Test with NVDA (Windows) or VoiceOver (Mac)
- [ ] Verify menu title is announced
- [ ] Verify section headers are announced
- [ ] Verify item names and prices are announced
- [ ] Verify descriptions are announced
- [ ] Verify grid structure is conveyed
- [ ] Verify filler tiles are hidden from screen readers

### Contrast and Legibility
- [ ] Verify text meets WCAG AA contrast ratios (4.5:1)
- [ ] Verify overlay text is legible on all background images
- [ ] Test with browser zoom at 200%
- [ ] Verify text doesn't overlap or get cut off
- [ ] Test in high contrast mode (Windows)

### Color Blindness
- [ ] Test with color blindness simulator
- [ ] Verify information isn't conveyed by color alone
- [ ] Verify featured items are distinguishable

## Content Testing

### Special Characters
- [ ] Test menu with accented characters (é, ñ, ü)
- [ ] Test menu with currency symbols (€, £, ¥)
- [ ] Test menu with ampersands (&)
- [ ] Test menu with apostrophes (')
- [ ] Test menu with quotation marks (")
- [ ] Verify all characters render correctly in HTML export
- [ ] Verify all characters render correctly in PDF export

### Long Content
- [ ] Test with very long item names (150+ characters)
  - [ ] Verify text wraps appropriately
  - [ ] Verify tile height adjusts
- [ ] Test with very long descriptions (400+ characters)
  - [ ] Verify text doesn't overflow
  - [ ] Verify readability is maintained
- [ ] Test with very long section names (80+ characters)
  - [ ] Verify header wraps or truncates gracefully

### Edge Cases
- [ ] Test menu with single item
- [ ] Test menu with single section
- [ ] Test menu with 10+ sections
- [ ] Test menu with section containing 50+ items
- [ ] Test menu with all items at $0.00
- [ ] Test menu with prices over $1000
- [ ] Test menu with decimal prices ($9.99, $10.50)

## Performance Testing

### Load Time
- [ ] Measure time from page load to layout render
  - [ ] Should be under 1 second for typical menu
- [ ] Test with slow 3G network throttling
  - [ ] Verify progressive loading works
  - [ ] Verify images load lazily

### Export Performance
- [ ] Measure HTML export time
  - [ ] Should be under 1 second
- [ ] Measure PDF export time
  - [ ] Should be under 5 seconds for typical menu
  - [ ] Should be under 10 seconds for large menu
- [ ] Measure PNG export time
  - [ ] Should be under 4 seconds
- [ ] Test concurrent exports
  - [ ] Verify rate limiting works
  - [ ] Verify appropriate error messages

### Large Menu Stress Test
- [ ] Test with 100+ item menu
  - [ ] Verify layout generates successfully
  - [ ] Verify scrolling remains smooth
  - [ ] Verify exports complete without timeout
- [ ] Test with 200+ item menu
  - [ ] Verify system handles gracefully
  - [ ] Verify appropriate warnings if needed

## Print Testing

### Browser Print
- [ ] Use browser print preview (Ctrl+P / Cmd+P)
- [ ] Verify layout adjusts for print media
- [ ] Verify page breaks are appropriate
- [ ] Verify section headers don't orphan
- [ ] Verify colors print correctly
- [ ] Print to physical printer
  - [ ] Verify output matches preview
  - [ ] Verify text is readable
  - [ ] Verify images print clearly

### PDF Export Print
- [ ] Open exported PDF
- [ ] Print PDF to physical printer
- [ ] Verify output matches PDF preview
- [ ] Compare with browser print output
- [ ] Verify consistency between formats

## Theme Customization Testing

### Color Themes
- [ ] Apply custom primary color
  - [ ] Verify filler tiles use new color
  - [ ] Verify accents update
- [ ] Apply custom background color
  - [ ] Verify layout background changes
  - [ ] Verify text contrast is maintained
- [ ] Apply custom text color
  - [ ] Verify all text updates
  - [ ] Verify contrast is maintained

### Typography
- [ ] Adjust typography scale
  - [ ] Verify all text sizes scale proportionally
  - [ ] Verify layout remains balanced
- [ ] Adjust spacing values
  - [ ] Verify gaps between tiles update
  - [ ] Verify padding updates
- [ ] Adjust border radius
  - [ ] Verify tile corners update
  - [ ] Verify consistency across components

## Error Handling Testing

### Invalid Data
- [ ] Test with menu missing extraction data
  - [ ] Verify appropriate error message
- [ ] Test with corrupted menu data
  - [ ] Verify graceful degradation
- [ ] Test with missing images
  - [ ] Verify fallback rendering works
  - [ ] Verify no broken image icons

### Network Errors
- [ ] Disconnect network during export
  - [ ] Verify appropriate error message
  - [ ] Verify retry option available
- [ ] Test with slow network
  - [ ] Verify loading indicators show
  - [ ] Verify timeout handling

### Rate Limiting
- [ ] Trigger rate limit by rapid exports
  - [ ] Verify 429 error response
  - [ ] Verify retry-after header
  - [ ] Verify user-friendly error message

## Cross-Browser Testing

### Chrome/Edge (Chromium)
- [ ] Test all functionality
- [ ] Verify layout renders correctly
- [ ] Verify exports work

### Firefox
- [ ] Test all functionality
- [ ] Verify layout renders correctly
- [ ] Verify exports work
- [ ] Check for Firefox-specific issues

### Safari
- [ ] Test all functionality
- [ ] Verify layout renders correctly
- [ ] Verify exports work
- [ ] Check for Safari-specific issues

## Design Token Consistency

### HTML vs PDF vs PNG
- [ ] Export same menu in all three formats
- [ ] Open all exports side-by-side
- [ ] Verify spacing is identical
- [ ] Verify font sizes are identical
- [ ] Verify colors are identical
- [ ] Verify border radius is identical
- [ ] Measure and compare dimensions

### Live Preview vs Exports
- [ ] Take screenshot of live preview
- [ ] Compare with HTML export
- [ ] Compare with PNG export
- [ ] Verify pixel-perfect match (within threshold)

## User Experience Testing

### First-Time User
- [ ] Navigate to template preview without instructions
- [ ] Verify interface is intuitive
- [ ] Verify preset selection is clear
- [ ] Verify export buttons are obvious
- [ ] Verify loading states are clear

### Error Recovery
- [ ] Trigger an error
- [ ] Verify error message is helpful
- [ ] Verify user can recover without refresh
- [ ] Verify error doesn't break other functionality

### Progressive Enhancement
- [ ] Disable JavaScript
  - [ ] Verify basic content is accessible
  - [ ] Verify appropriate fallback message
- [ ] Disable CSS
  - [ ] Verify content is still readable
  - [ ] Verify semantic structure is maintained

## Documentation Verification

- [ ] Verify all features mentioned in docs work
- [ ] Verify examples in docs are accurate
- [ ] Verify screenshots in docs are up-to-date
- [ ] Verify API documentation matches implementation

## Sign-Off

### Tester Information
- **Tester Name:** ___________________________
- **Date:** ___________________________
- **Environment:** ___________________________
- **Browser/Device:** ___________________________

### Test Results
- **Total Tests:** ___________________________
- **Passed:** ___________________________
- **Failed:** ___________________________
- **Blocked:** ___________________________

### Issues Found
1. ___________________________
2. ___________________________
3. ___________________________

### Overall Assessment
- [ ] Ready for production
- [ ] Minor issues (can deploy with known issues)
- [ ] Major issues (requires fixes before deployment)
- [ ] Blocked (cannot proceed)

### Notes
___________________________
___________________________
___________________________
