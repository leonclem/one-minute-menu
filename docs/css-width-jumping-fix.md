# CSS Width Jumping Fix

## Problem Description

When using collapsible/expandable content (like accordions, FAQs, or collapsible cards), the container width can jump or change as content expands and collapses. This creates a jarring user experience where the entire layout shifts.

### Visual Symptoms
- Container is narrow when collapsed
- Container widens when content expands
- Container shrinks back when content collapses
- Layout "jumps" or "shifts" horizontally

## Root Cause

The issue occurs when a `<main>` (or similar container) element is:
1. A **flex child** (inside a `flex-col` parent)
2. Uses **`mx-auto`** for centering (via utility classes like `container-ux`)
3. Has **no explicit width** set

### Why This Happens

In CSS flexbox, `margin: auto` on the cross axis disables the default `align-self: stretch` behavior. This causes the element to collapse to fit its content instead of filling the parent container.

When expandable content grows (like an FAQ answer or collapsible section), the longer text widens the content, which grows the container — this is classic **"shrink-to-fit"** behavior.

## Solution

Add `w-full` (i.e., `width: 100%`) to the container element to force it to take full parent width first, then use `max-w-*` to cap it and `mx-auto` to center it.

### Before (Broken)
```tsx
<main className="container-ux py-10 md:py-12 flex-1">
  <div className="max-w-4xl mx-auto space-y-8">
    {/* Collapsible content */}
  </div>
</main>
```

### After (Fixed)
```tsx
<main className="container-ux w-full py-10 md:py-12 flex-1">
  <div className="max-w-4xl mx-auto space-y-8">
    {/* Collapsible content */}
  </div>
</main>
```

## Key Points

1. **Add `w-full`** to the flex child container (usually `<main>`)
2. **Keep `max-w-*`** on inner containers to cap the width
3. **Keep `mx-auto`** for centering
4. **Remove unnecessary** `!w-full`, inline styles, or `block` overrides on inner elements

## Order of Operations

The CSS cascade works like this:
1. `w-full` → Forces container to 100% of parent width
2. `max-w-4xl` (or similar) → Caps the maximum width
3. `mx-auto` → Centers the capped-width container

This ensures the container always has a stable width regardless of content size.

## Common Scenarios

This fix applies to:
- FAQ pages with expandable questions
- Settings pages with collapsible sections
- Accordion components
- Any page with dynamic content that expands/collapses

## Example: Settings Page

```tsx
export default async function SettingsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      {/* Add w-full here to prevent width jumping */}
      <main className="container-ux w-full py-10 md:py-12 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1>Account Settings</h1>
          
          {/* Collapsible cards */}
          <CollapsibleCard title="Menu Currency">
            {/* Content that expands/collapses */}
          </CollapsibleCard>
          
          <CollapsibleCard title="Billing Currency">
            {/* Content that expands/collapses */}
          </CollapsibleCard>
        </div>
      </main>
      
      <Footer />
    </div>
  )
}
```

## Debugging Tips

If you encounter width jumping:

1. **Identify the flex parent** - Look for `flex` or `flex-col` on parent elements
2. **Check for `mx-auto`** - This is often the culprit when combined with flex
3. **Add `w-full`** to the flex child that's jumping
4. **Verify max-width** is set on inner containers, not the flex child
5. **Remove overrides** - Clean up any `!w-full` or inline width styles

## Related CSS Concepts

- **Flexbox cross-axis alignment**: `align-items`, `align-self`
- **Margin auto behavior**: Disables stretch in flex containers
- **Shrink-to-fit**: Default behavior when width is not explicitly set
- **Width cascade**: `width` → `max-width` → `margin: auto`

## References

- [MDN: Flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout)
- [MDN: margin auto](https://developer.mozilla.org/en-US/docs/Web/CSS/margin#auto)
- [Tailwind CSS: Width](https://tailwindcss.com/docs/width)
- [Tailwind CSS: Max-Width](https://tailwindcss.com/docs/max-width)

## History

This issue was encountered and fixed in:
- Support page FAQ section (original discovery)
- Settings page with collapsible currency sections (2024-02-08)

---

**Last Updated**: 2024-02-08  
**Status**: Verified solution
