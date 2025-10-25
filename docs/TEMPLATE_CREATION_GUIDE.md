## Figma → Template: Creation and Export Guide

This guide walks designers and engineers through adding a new Figma-based menu template to Kiro and exporting menus using it.

### 1) Prepare your Figma file
- Use Auto Layout consistently; avoid absolute positioning inside auto frames.
- Name layers with binding placeholders the parser detects:
  - Required: `{{restaurant.name}}`, `{{category.name}}`, `{{category.items}}`, `{{item.name}}`
  - Optional: `{{item.price}}`, `{{item.description}}`, `{{item.image_icon}}`, `{{item.dietaryTags}}`, `{{item.allergens}}`, `{{item.variants}}`
- Optional decorative layers: `{{decor.sidebar_left}}`, `{{decor.header_rule}}` (mapped to CSS pseudo-elements where possible).
- Keep typography and spacing consistent; these map to generated CSS (flex direction, gaps, paddings, alignments).

### 2) Prepare to export from Figma
- Identify a single root frame the compiler should use. Prefer a named top-level frame such as "A4 Portrait", "US Letter Landscape", or "Template Root"; ensure it is visible.
- Match the frame size/orientation to your intended page format so it aligns with the metadata you will set later (`A4 | US_LETTER | TABLOID | DIGITAL` and `portrait | landscape`).
- Get the Figma file key: File → Copy link, then extract the `<FILE_KEY>` from a URL like `https://www.figma.com/file/<FILE_KEY>/...`.
- Ensure API access: create a Figma personal access token in Account Settings and keep it secret. The CLI/build uses it via the `FIGMA_API_KEY` environment variable.
- Verify permissions: the token’s account must have at least view access to the file (same org/workspace or invited).
- Optional preflight: use the validation CLI in Step 5 to check required bindings before compiling.

- Where it's used: set `metadata.figmaFileKey` in Step 3 and pass it to the CLI in Step 5.

### 3) Decide template metadata
Define in your TypeScript template config at minimum:
- Name, description, author
- Version (e.g., `1.0`)
- Page format and orientation: one of `A4 | US_LETTER | TABLOID | DIGITAL` and `portrait | landscape`
- Tags (search/filtering), `isPremium` flag
- Figma file key (used by compiler/parser during import)

### 4) Create the template config in code
- Add a new config in `src/lib/templates/configs/<your-template>.ts` that exports a `TemplateConfig` object (see `src/types/templates.ts`).
- Define:
  - `metadata`: id, name, description, author, version, figmaFileKey, preview/thumbnail URLs, pageFormat, orientation, tags, isPremium.
  - `bindings`: map Figma layer names to data fields (restaurant, category, item). Include arrays for item lists and any conditional layers.
  - `styling`: fonts, color tokens, spacing scales as needed.
- Follow the structure used by the existing template ("The View") for reference.

### 5) Register and compile the template
- Use a registration helper similar to `src/lib/templates/configs/register-the-view.ts` to validate and upsert the template into `menu_templates`.
- The registration script now invokes the compiler to parse Figma and embed compiled CSS under `config.styles`.
- Validation checks will ensure bindings exist and required placeholders are present.
- Ensure Supabase env vars are set when running registration as a script:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (CLI-only, do not expose in client/frontend)
 - Ensure `FIGMA_API_KEY` is set (CLI/build only; never ship to client).

#### CLI: compile directly from a Figma file key
You can compile and upsert a template directly using the CLI script:

```
npx tsx scripts/compile-template-from-figma.ts <templateId> <version> <figmaFileKey>
```

This will:
- Fetch the Figma file using `FIGMA_API_KEY`
- Parse bindings and generate CSS
- Persist compiled artifacts to `templates-compiled/<id>@<version>/`
- Upsert the template config into `menu_templates` with embedded `config.styles`

#### CLI: validate a Figma file for required bindings
Before compiling, you can validate a Figma file’s bindings:

```
npx tsx scripts/validate-figma-template.ts <figmaFileKey>
```

This reports missing required bindings and lists optional ones found.

### 6) Upload preview assets
- Upload preview and thumbnail images to Supabase Storage, matching the metadata URLs you set (e.g., `/templates/<id>/preview.png`, `/templates/<id>/thumbnail.png`).
- Keep images optimized for fast loading.

### 7) Verify in the UI
- The dashboard templates page lists templates via `templateOperations.listTemplates()`.
- Open your menu in the dashboard and navigate to the Templates view; your template should appear with its preview.

### 8) Render and export
- Rendering (synchronous) uses `/api/templates/render` to generate HTML/CSS for previews.
- Exporting (async) uses `/api/templates/export` to produce PDF/PNG/HTML and uploads to `rendered-menus` with a signed URL for download.
- The export dialog handles job creation and status polling automatically.

### 9) Conventions and validation
- Layer naming must align with `bindings` in your config.
- The linter validates presence of core placeholders and that bindings reference existing layers.
- Customization supported by schema in `src/lib/templates/schemas.ts`:
  - Colors: hex strings for `primary`, `secondary`, `accent`.
  - Fonts: `heading`, `body`.
  - `priceDisplayMode`: `symbol | amount-only`.

### 10) Minimal end-to-end checklist
- Create `TemplateConfig` file.
- Register via a script (service role) or the registry in a server context.
- Upload preview/thumbnail assets.
- Verify it shows in the Templates UI and renders your menu.
- Export to PDF/PNG/HTML and confirm the output matches the preview.

### 11) Production notes
- Figma API usage and compilation happen server-side/build-time only.
- Ensure storage buckets exist: `templates`, `templates-compiled`, `rendered-menus`.
- Never commit or expose the service role key to client code.

### 12) Frame selection rule (v1)
- The compiler prefers a named root frame such as "A4 Portrait" or "Template Root"; if not found, it uses the first top-level visible frame.

### 13) Fonts delivery (v1)
- The compiler collects font family names; runtime uses system fonts or Google Fonts where available. Self-hosting can be added later if needed.


