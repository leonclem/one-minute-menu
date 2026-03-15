# SEO Guide for GridMenu Blog Posts

A practical reference for writing new blog posts under `src/app/(marketing)/blog/`.

---

## Folder and file structure

Each post lives in its own folder:

```
src/app/(marketing)/blog/your-post-slug/
  page.tsx               ← metadata export + renders the article component
  ArticleYourPost.tsx    ← the article content component
```

The slug becomes the URL: `/blog/your-post-slug`. Use descriptive, hyphenated slugs that include the primary keyword (e.g. `restaurant-menu-design-tips`, not `post-1`).

---

## page.tsx — metadata checklist

Every `page.tsx` must export a `Metadata` object. Use the existing post as a template.

```ts
export const metadata: Metadata = {
  title: 'Your Post Title | GridMenu',
  description: '150–160 character summary. Include the primary keyword naturally.',
  keywords: ['keyword one', 'keyword two', ...],
  openGraph: {
    title: 'Your Post Title | GridMenu',
    description: 'Slightly shorter OG description — shown in social previews.',
    type: 'article',
    url: '/blog/your-post-slug',
    images: [{ url: '/logos/social-1200x630.png', width: 1200, height: 630, alt: '...' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/logos/social-1200x630.png'],
  },
}
```

- `type: 'article'` is important — it tells social platforms this is editorial content
- Keep `title` under 60 characters where possible
- `description` should read naturally, not like a keyword list

---

## Article JSON-LD (structured data)

Every article component should include an `Article` JSON-LD block. This is what enables Google to surface rich results and understand the content type.

```ts
const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Your Post Title',
  description: 'Same as meta description.',
  datePublished: 'YYYY-MM-DD',
  author: {
    '@type': 'Organization',
    name: 'GridMenu',
    url: 'https://gridmenu.ai',
  },
  publisher: {
    '@type': 'Organization',
    name: 'GridMenu',
    url: 'https://gridmenu.ai',
    logo: { '@type': 'ImageObject', url: 'https://gridmenu.ai/logos/social-1200x630.png' },
  },
  image: 'https://gridmenu.ai/logos/social-1200x630.png',
  url: 'https://gridmenu.ai/blog/your-post-slug',
}
```

Render it in the component return, before the main content wrapper:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
  suppressHydrationWarning
/>
```

If the post contains a substantial FAQ section, add a `FAQPage` JSON-LD block alongside the `Article` block — same pattern used on the homepage.

---

## Heading hierarchy

- One `<h1>` per page — the article title in the `<header>`
- Section headings use `<h2>`
- Sub-points within a section use `<h3>`
- Never skip levels (no `<h1>` → `<h3>`)

The primary keyword or a close variant should appear in the `<h1>`.

---

## Images

- Use descriptive, kebab-case filenames: `restaurant-menu-design-tips.jpg`, not `image1.jpg`
- Every `<Image>` needs a meaningful `alt` attribute describing the content in context
- Decorative images use `alt=""` or `aria-hidden="true"`
- Use Next.js `<Image>` with explicit `width`/`height` (or `fill` + a sized container) to avoid layout shift

---

## Internal linking

Link to relevant pages within the post body where it makes sense:

- The GridMenu homepage or feature pages when referencing the product
- Other blog posts on related topics
- `/support` for how-to questions
- `/pricing` where relevant

This distributes page authority and helps crawlers map the site.

---

## Content quality signals

Google rewards content that demonstrates expertise and is genuinely useful:

- Cite external sources with links (as the existing post does) — it signals credibility
- Include real data, statistics, or research where available
- Write for the reader first; keyword placement should feel natural
- Aim for posts that fully answer the question implied by the title — thin content ranks poorly
- Add a publication date and keep it accurate (`datePublished` in JSON-LD + visible in the article header)

---

## What to avoid

- Keyword stuffing in titles, headings, or body copy
- Duplicate meta descriptions across posts
- Generic alt text like `"menu"` or `"image"`
- Missing or placeholder `datePublished` in JSON-LD
- Omitting the `Article` JSON-LD block entirely
