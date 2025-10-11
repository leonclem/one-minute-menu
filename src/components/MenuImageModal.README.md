# MenuImageModal Component

A modal component for displaying full-size food images in template-rendered menus. This component is used when users click on camera icons (📷) in menus that use the `imageDisplay: 'icon'` template setting.

## Features

- Full-size image display with proper aspect ratio
- Item name displayed as caption
- Close button and click-outside-to-close functionality
- Keyboard navigation (Escape key to close)
- Fully accessible with proper ARIA labels
- WebP image format support with fallback
- Prevents body scroll when modal is open
- Responsive design with max-width constraints

## Usage

```tsx
import { MenuImageModal } from '@/components/MenuImageModal'
import { useState } from 'react'

function MenuItemWithImage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  return (
    <>
      <div className="menu-item">
        <span className="item-name">Delicious Pasta</span>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="camera-icon"
          aria-label="View image of Delicious Pasta"
        >
          📷
        </button>
      </div>

      <MenuImageModal
        imageUrl="https://example.com/pasta.jpg"
        itemName="Delicious Pasta"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `imageUrl` | `string` | Yes | URL of the full-size food image to display |
| `itemName` | `string` | Yes | Name of the menu item (used as caption and alt text) |
| `isOpen` | `boolean` | Yes | Controls whether the modal is visible |
| `onClose` | `() => void` | Yes | Callback function called when the modal should close |

## Accessibility

The component follows WCAG accessibility guidelines:

- Uses semantic HTML with proper `role="dialog"` and `aria-modal="true"`
- Includes `aria-labelledby` and `aria-describedby` for screen readers
- Close button has descriptive `aria-label`
- Supports keyboard navigation (Escape key to close)
- Auto-focuses the close button when modal opens
- Prevents body scroll when modal is open

## Integration with Templates

This component is designed to work with the template system's camera icon feature:

1. When a template has `imageDisplay: 'icon'` in its descriptor
2. Menu items with images get a camera icon (📷) rendered after their name
3. Clicking the camera icon opens this modal with the full-size image
4. The modal displays the image with the item name as a caption

See Task 22 in the implementation plan for camera icon interactivity integration.

## Testing

The component includes comprehensive unit tests covering:

- Rendering when open/closed
- Close button functionality
- Click-outside-to-close behavior
- Keyboard navigation (Escape key)
- Accessibility attributes
- WebP image support
- Preventing clicks on the image from closing the modal

Run tests with:
```bash
npm test MenuImageModal.test.tsx
```

## Requirements Satisfied

This component satisfies the following requirements from the AI-Enhanced Menu Templates spec:

- **Requirement 7.2**: Display full-size food image in modal overlay with item name as caption
- **Requirement 7.1**: Support for camera icon click interaction (integration point)
- Implements close button and click-outside-to-close
- Implements keyboard navigation (Escape to close)
- Ensures accessibility with proper ARIA labels

## Future Enhancements

Potential future improvements (out of scope for MVP):

- Image zoom/pan functionality (similar to PublicMenuImage)
- Swipe between multiple images for items with variations
- Display item description or price in the modal
- Loading states for slow-loading images
- Image download button
- Share functionality
