# GridMenu brand kit

Source of truth for the Photo Studio look. Colour and radius tokens live in `src/app/brand-tokens.css`. The typeface is loaded in `src/app/layout.tsx`.

Use this for the product, marketing, and anything a customer sees. Admin stays on Inter and light surfaces.

## Logo

The mark is a yellow-and-teal grid, in `public/logos/logo.svg`.

- Yellow cells: `#F8BC02`
- Teal cells: `#01B3BF`

In the header it sits beside the word **GridMenu**, set in Figtree Bold (700), white, with letter-spacing `-0.02em`.

The app also references these icon files from `public/logos/`: `favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `apple-touch-icon.png`, and `social-1200x630.png` (1200×630 Open Graph image).

## Colour

### Teal

| Hex | Use |
| --- | --- |
| `#01B3BF` | Primary. Buttons, focus, brand mark |
| `#018F99` | Hover on teal buttons |
| `#5FD3DA` | Links |
| `#7FDEE4` | Link hover |
| `rgba(1, 179, 191, 0.14)` | Teal tint on selected controls |

Text on a teal button is white.

### Yellow

| Hex | Use |
| --- | --- |
| `#F8BC02` | Accent. Key calls to action, brand mark |
| `#03272A` | Text on yellow |
| `rgba(248, 188, 2, 0.14)` | Yellow tint |

### Dark

The dark ground is a near-black teal, not a pure navy.

| Hex | Use |
| --- | --- |
| `#0C1416` | Page background |
| `#0F1C1F` | Panels, footer |
| `#16292C` | Soft glow at the top of the page |
| `#10181A` / `#161F21` | Checkerboard behind transparent images |

### Neutrals

| Hex | Use |
| --- | --- |
| `#FFFFFF` | Headings |
| `#EEF4F4` | Body text |
| White at 66% | Strong muted text (nav) |
| White at 55% | Muted text |
| White at 40% | Soft muted text (footer) |
| White at 16% | Strong borders |
| White at 10% | Borders |

Destructive actions use `#FF8A80`.

### Light surfaces

A few older screens still use a light grey set. Keep it for those surfaces only.

| Hex | Use |
| --- | --- |
| `#212529` | Text |
| `#6C757D` | Secondary text |
| `#DEE2E6` | Borders |
| `#F8F9FA` | Light background |

## Type

**Figtree** is the brand typeface (Google Fonts). Customer pages and Studio set it through `--font-studio`. Fallback stack: `ui-sans-serif, system-ui, sans-serif`.

| Weight | Use |
| --- | --- |
| 500 Medium | Body copy |
| 700 Bold | Wordmark, navigation, buttons, footer links |
| 800 ExtraBold | Page titles and marketing headlines. Often with letter-spacing `-0.03em` |

**Inter** is the fallback body font on the root layout, and the face used in admin. It is not the customer brand face.

Menu templates use their own faces (Playfair Display, Lato, Nanum Myeongjo, Habibi). Those belong to a menu design, not to GridMenu.

## Shape

| Token | Value |
| --- | --- |
| Buttons | 9px radius |
| Cards | 16px radius |

Primary buttons are teal with white bold type. Ghost buttons are transparent, with a white border at 16% opacity.
