'use client'

import Link from 'next/link'
import { UXWrapper } from '@/components/ux'

const articles = [
  {
    slug: 'restaurants-cannot-control-inflation',
    category: 'Operations',
    title: 'Restaurants Cannot Control Inflation. They Can Control This',
    excerpt:
      'Restaurants cannot control the wider market. They can control how quickly they adapt to it. That is why menu workflow matters more than it once did.',
  },
  {
    slug: 'digital-vs-paper-menus',
    category: 'Menu Strategy',
    title: 'Paper Menus for Guests, Digital Control for Operators',
    excerpt:
      'Printed menus still suit the dining experience many guests want, but digital menu workflows help operators update faster, stay accurate, and work more efficiently.',
  },
]

export default function BlogPageContent() {
  return (
    <UXWrapper className="py-12 sm:py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white text-soft-shadow mb-4">
          Blog
        </h1>
        <p className="text-lg text-white/80 text-soft-shadow mb-12">
          Tips, insights, and guides for food &amp; beverage businesses.
        </p>

        <div className="space-y-6">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="block rounded-2xl bg-white/95 backdrop-blur shadow-lg p-8 hover:shadow-xl transition-shadow group"
            >
              <p className="text-sm font-medium text-ux-primary uppercase tracking-wide mb-2">
                {article.category}
              </p>
              <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-ux-primary transition-colors">
                {article.title}
              </h2>
              <p className="text-gray-600 leading-relaxed text-sm">{article.excerpt}</p>
              <span className="inline-block mt-4 text-sm font-semibold text-ux-primary">
                Read article →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </UXWrapper>
  )
}
