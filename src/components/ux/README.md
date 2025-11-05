# UX Implementation Components

This directory contains the components and styling system for the UX Implementation feature, which provides a conversion-optimized user journey for the QR Menu System.

## Design System

### Color Palette
The UX implementation uses a yellow-based color palette optimized for conversion:

- **Primary**: Yellow (#FFC107) - Used for CTAs and primary actions
- **Secondary**: Dark Gray (#212529) - Used for text and secondary elements
- **Background**: White (#FFFFFF) and Light Gray (#F8F9FA)
- **Text**: Dark Gray (#212529) and Medium Gray (#6C757D)

### Components

#### Core Layout Components
- `UXHeader` - Responsive header with navigation
- `UXFooter` - Footer with legal links
- `UXWrapper` - Container component with variants (default, centered, full-width)
- `UXSection` - Section component with optional title and subtitle

#### Interactive Components
- `UXButton` - Button component with variants (primary, secondary, outline) and sizes (sm, md, lg)
- `UXCard` - Card component with hover effects and click handling

### Usage

```tsx
import { UXWrapper, UXSection, UXButton, UXCard } from '@/components/ux'

export default function MyPage() {
  return (
    <UXWrapper variant="centered">
      <UXSection 
        title="Page Title"
        subtitle="Page description"
      >
        <UXCard>
          <UXButton variant="primary" size="lg">
            Call to Action
          </UXButton>
        </UXCard>
      </UXSection>
    </UXWrapper>
  )
}
```

### Styling System

The UX implementation uses CSS custom properties and Tailwind classes:

- CSS custom properties are defined in `globals.css` with the `--ux-*` prefix
- Tailwind classes use the `ux-*` prefix (e.g., `text-ux-primary`, `bg-ux-background`)
- Component classes use the `.btn-ux-*`, `.card-ux`, `.input-ux` pattern

### Responsive Design

All components are built mobile-first and include:
- Touch-friendly sizing (minimum 44px touch targets)
- Responsive breakpoints (xs, sm, md, lg, xl, 2xl)
- Flexible layouts that adapt to different screen sizes
- Accessible focus states and keyboard navigation

### Integration with Existing System

The UX components are designed to wrap existing functionality:

```tsx
// Wrap existing components with UX styling
<UXWrapper>
  <ExistingComponent />
</UXWrapper>
```

This allows reuse of existing backend functionality while providing the new conversion-optimized UI.