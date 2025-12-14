# Text Overflow Solutions for Menu Items

## Problem
Menu items with long names or descriptions get squeezed in the grid layout, making text hard to read.

Example: "TWO SOFT-BOILED EGGS & MOUILLETTES" gets compressed into a narrow column.

## Current Solution: Reduced Grid Gap

**Changed grid gap from 20px to 12px**

This gives more horizontal space to each column while maintaining visual separation.

**Files updated:**
- `src/components/templates/TemplateLayoutRenderer.tsx` (preview)
- `src/lib/templates/export/layout-renderer.tsx` (PDF export)

**Before:** `gap: '20px'` → **After:** `gap: '12px'`

**Impact:**
- ✓ 40% more horizontal space for text
- ✓ Still maintains visual separation between items
- ✓ Consistent across preview and PDF export

## Additional Options for Long Text

### Option 1: Character Limits (Recommended)

Truncate long text with ellipsis at extraction or input stage.

**Implementation:**
```typescript
// In menu item validation/transformation
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

// Apply limits
const menuItem = {
  name: truncateText(item.name, 30),        // Max 30 chars for name
  description: truncateText(item.description, 80) // Max 80 chars for description
}
```

**Recommended limits:**
- **Item name:** 30 characters
- **Description:** 80 characters (for circular layout)
- **Description:** 120 characters (for other layouts)

**Pros:**
- ✓ Prevents layout issues
- ✓ Forces concise, readable text
- ✓ Consistent appearance

**Cons:**
- ✗ May cut off important information
- ✗ Requires user education

### Option 2: Dynamic Font Sizing

Reduce font size for items with long text.

**Implementation:**
```typescript
function getItemNameFontSize(name: string): string {
  if (name.length > 25) return '8px'
  if (name.length > 20) return '9px'
  return '10px' // Default
}

// In component
<h3 style={{ fontSize: getItemNameFontSize(tile.name) }}>
  {tile.name}
</h3>
```

**Pros:**
- ✓ Shows full text
- ✓ Automatic adjustment

**Cons:**
- ✗ Inconsistent appearance
- ✗ Very small text may be hard to read
- ✗ Breaks vertical alignment

### Option 3: Multi-line Text with Fixed Height

Allow text to wrap but maintain fixed height for alignment.

**Implementation:**
```css
.item-name {
  height: 28px;
  line-height: 14px; /* Allow 2 lines */
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
```

**Pros:**
- ✓ Shows more text
- ✓ Maintains alignment
- ✓ Natural wrapping

**Cons:**
- ✗ May still truncate very long text
- ✗ Increases vertical space usage

### Option 4: Wider Grid Columns

Reduce number of columns from 4 to 3.

**Implementation:**
```typescript
// In template definition
const template = {
  layout: {
    baseCols: 3, // Changed from 4
    // ...
  }
}
```

**Pros:**
- ✓ Much more horizontal space
- ✓ Better for text-heavy menus

**Cons:**
- ✗ Fewer items per page
- ✗ May require more pages
- ✗ Changes overall design

### Option 5: Responsive Column Width

Make columns wider for items with long text.

**Implementation:**
```typescript
// In layout engine
function calculateColumnSpan(itemName: string): number {
  if (itemName.length > 30) return 2 // Double width
  return 1 // Normal width
}
```

**Pros:**
- ✓ Flexible layout
- ✓ Optimizes space usage

**Cons:**
- ✗ Complex layout logic
- ✗ May create uneven grid
- ✗ Harder to maintain alignment

### Option 6: Abbreviations and Symbols

Use common abbreviations to shorten text.

**Examples:**
- "Two Soft-Boiled Eggs & Mouillettes" → "2 Soft-Boiled Eggs & Mouillettes"
- "with mixed greens & bread" → "w/ mixed greens & bread"
- "and" → "&"

**Implementation:**
```typescript
function abbreviateText(text: string): string {
  return text
    .replace(/\bTwo\b/gi, '2')
    .replace(/\bThree\b/gi, '3')
    .replace(/\bwith\b/gi, 'w/')
    .replace(/\band\b/gi, '&')
}
```

**Pros:**
- ✓ Maintains meaning
- ✓ Reduces character count
- ✓ Common in menu design

**Cons:**
- ✗ May look informal
- ✗ Requires careful implementation
- ✗ Language-specific

## Recommended Approach

**Combination Strategy:**

1. **Reduce grid gap** (✓ Already implemented)
   - From 20px to 12px
   - Gives 40% more space

2. **Add character limits** (Recommended next step)
   - Item name: 30 characters
   - Description: 80 characters
   - Show warning in UI when limit exceeded

3. **Allow multi-line names** (Optional enhancement)
   - 2 lines max with fixed 28px height
   - Ellipsis if still too long

4. **Smart abbreviations** (Optional)
   - Auto-replace common words
   - User can override

## Implementation Priority

### Phase 1: Quick Wins (Current)
- [x] Reduce grid gap to 12px
- [ ] Add character count indicators in UI
- [ ] Show warning when text is too long

### Phase 2: Validation
- [ ] Add character limits to menu item form
- [ ] Truncate with ellipsis on save
- [ ] Allow user to edit truncated text

### Phase 3: Enhancement
- [ ] Multi-line text support
- [ ] Dynamic font sizing for edge cases
- [ ] Smart abbreviation suggestions

## Testing Checklist

### Visual Tests
- [ ] Test with short names (10-15 chars)
- [ ] Test with medium names (20-25 chars)
- [ ] Test with long names (30-40 chars)
- [ ] Test with very long names (50+ chars)
- [ ] Test with mix of short and long names in same row

### Layout Tests
- [ ] Verify vertical alignment maintained
- [ ] Verify grid spacing looks balanced
- [ ] Verify text doesn't overflow container
- [ ] Verify readability at different zoom levels

### Cross-format Tests
- [ ] Preview page matches PDF export
- [ ] HTML export matches preview
- [ ] All formats handle long text consistently

## Configuration

### Current Grid Gap Setting

**Preview:** `src/components/templates/TemplateLayoutRenderer.tsx`
```typescript
gap: '12px'
```

**PDF Export:** `src/lib/templates/export/layout-renderer.tsx`
```typescript
gap: '12px'
```

### To Adjust Gap Further

**More space (8px):**
```typescript
gap: '8px'  // Even tighter spacing
```

**Less space (16px):**
```typescript
gap: '16px'  // More breathing room
```

**Recommended range:** 8px - 16px

## User Guidelines

### For Menu Creators

**Best Practices:**
1. Keep item names under 30 characters
2. Use abbreviations where appropriate (2 instead of Two)
3. Use & instead of "and"
4. Avoid unnecessary words ("with", "served with")
5. Put details in description, not name

**Good Examples:**
- ✓ "Eggs Benedict" (14 chars)
- ✓ "Parisian Omelette" (17 chars)
- ✓ "2 Soft-Boiled Eggs" (18 chars)

**Bad Examples:**
- ✗ "Two Soft-Boiled Eggs with Mouillettes and Bread Fingers" (56 chars)
- ✗ "Three Organic Free-Range Eggs Cooked Your Way" (46 chars)

### For Descriptions

**Keep under 80 characters for circular layout:**
- ✓ "Ham, swiss, mushroom & spinach with baby greens" (48 chars)
- ✗ "Ham, swiss cheese, sautéed mushrooms, fresh spinach with mixed baby greens and artisan bread" (93 chars)

## Related Documentation
- [Template Style Consistency Guide](./TEMPLATE_STYLE_CONSISTENCY_GUIDE.md)
- [Layout Fixes Summary](./LAYOUT_FIXES_SUMMARY.md)
