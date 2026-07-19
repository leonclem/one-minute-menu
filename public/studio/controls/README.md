# Studio control preview assets

Place PNG (preferred) preview images here with these basenames.

## Rotation

- `rotate-left45.png`
- `rotate-overhead.png`
- `rotate-right45.png`

## Lighting (seeded style keys → thumbnail_path)

- `light-natural.png` — bright-and-airy
- `light-moody.png` — low-key
- `light-soft-window.png` — soft-natural-window
- `light-delivery.png` — clean-delivery
- `light-warm-restaurant.png` — warm-restaurant
- `light-studio.png` — studio / premium editorial

## Background / surface (seeded style keys → thumbnail_path)

- `bg-clean-white.png` — clean-white-studio
- `bg-warm-beige.png` — warm-beige-ceramic
- `bg-dark-slate.png` — dark-slate
- `bg-rustic-wood.png` — rustic-wood
- `bg-marble.png` — marble-counter
- `bg-neutral-delivery.png` — neutral-delivery
- `bg-premium-dark.png` — premium-dark-restaurant
- `bg-bright-cafe.png` — bright-cafe-table

The Studio UI loads them from `/studio/controls/{name}.png`. If a file is missing, a text placeholder is shown until you add it.

Masters may also be kept under `src/assets/studio/controls/` — copy or export into this `public` folder for the app to serve them.
