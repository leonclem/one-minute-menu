import Image from 'next/image'

export const articleAuthorJsonLd = {
  '@type': 'Person',
  name: 'Leon Clements',
  jobTitle: 'Founder',
  email: 'leon@gridmenu.ai',
  url: 'https://www.linkedin.com/in/leonclements101/',
  image: 'https://gridmenu.ai/backgrounds/leon-clements.png',
  worksFor: {
    '@type': 'Organization',
    name: 'GridMenu',
    url: 'https://gridmenu.ai',
  },
}

function Headshot({ size }: { size: 'sm' | 'md' }) {
  const className =
    size === 'sm'
      ? 'h-10 w-10 rounded-full object-cover object-[center_22%]'
      : 'h-16 w-16 rounded-full object-cover object-[center_22%]'
  return (
    <Image
      src="/backgrounds/leon-clements.png"
      alt=""
      width={992}
      height={1071}
      className={className}
    />
  )
}

/** Compact credit under the date, or the contact block at the end of an article. */
export function ArticleAuthor({ variant }: { variant: 'byline' | 'contact' }) {
  if (variant === 'byline') {
    return (
      <p className="mt-4 flex items-center gap-3 text-sm text-gray-600">
        <Headshot size="sm" />
        <span>
          <span className="font-semibold text-gray-900">Leon Clements</span>, founder of GridMenu
        </span>
      </p>
    )
  }

  return (
    <div className="mt-12 flex items-center gap-4">
      <Headshot size="md" />
      <div>
        <p className="font-semibold text-gray-900">
          <a
            href="https://www.linkedin.com/in/leonclements101/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:underline"
          >
            Leon Clements
          </a>
        </p>
        <p className="text-sm text-gray-500">Founder of GridMenu</p>
        <p className="mt-1 text-sm">
          <a href="mailto:leon@gridmenu.ai" className="font-semibold text-ux-primary hover:underline">
            leon@gridmenu.ai
          </a>
        </p>
      </div>
    </div>
  )
}
