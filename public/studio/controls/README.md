# Studio control preview assets

Place PNG (preferred) preview images here with these basenames:

- `rotate-left45.png`
- `rotate-overhead.png`
- `rotate-right45.png`
- `light-natural.png`
- `light-moody.png`
- `light-studio.png`

The Studio UI loads them from `/studio/controls/{name}.png`. If a file is missing, a text placeholder is shown until you add it.

Masters may also be kept under `src/assets/studio/controls/` — copy or export into this `public` folder for the app to serve them.
