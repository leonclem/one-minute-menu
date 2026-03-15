'use client'

import Image from 'next/image'
import Link from 'next/link'
import { UXWrapper } from '@/components/ux'

/** Floated inline image — half-width with text wrapping around it */
function InlineImage({
  src,
  alt,
  float,
}: {
  src: string
  alt: string
  float: 'left' | 'right'
}) {
  const floatClass = float === 'left'
    ? 'float-left mr-6 mb-4'
    : 'float-right ml-6 mb-4'
  return (
    <figure className={`${floatClass} w-1/2 rounded-md overflow-hidden clear-none`}>
      <div className="aspect-[4/3] relative">
        <Image src={src} alt={alt} fill className="object-cover" />
      </div>
    </figure>
  )
}

/** Inline stat callout with subtle blue gradient tint */
function StatCallout({
  stat,
  context,
  href,
}: {
  stat: string
  context: string
  href: string
}) {
  return (
    <aside
      className="my-10 rounded-2xl border-l-4 border-ux-primary px-7 py-6"
      style={{
        background: 'linear-gradient(to right, rgba(1,179,191,0.12), rgba(1,179,191,0.03))',
      }}
    >
      <p className="text-4xl sm:text-5xl font-extrabold text-ux-primary leading-none mb-2">
        {stat}
      </p>
      <p className="text-base text-gray-700 leading-relaxed">
        {context}{' '}
        <a href={href} target="_blank" rel="noreferrer noopener" className="text-ux-primary hover:underline text-sm">
          ↗
        </a>
      </p>
    </aside>
  )
}

/** Superscript citation link */
function Cite({ n, href }: { n: number; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-ux-primary hover:underline text-xs align-super ml-0.5"
      aria-label={`Source ${n}`}
    >
      [{n}]
    </a>
  )
}

const SOURCES = {
  nra: 'https://restaurant.org/research-and-media/research/research-reports/2024-technology-landscape-report/',
  rbQr: 'https://restaurantbusinessonline.com/technology/customers-really-dont-qr-code-menus',
  rbTech: 'https://restaurantbusinessonline.com/technology/when-it-comes-customer-service-tech-can-be-double-edged-sword',
  cna: 'https://www.channelnewsasia.com/commentary/singapore-restaurant-food-beverage-manpower-shortage-raise-salary-cost-4141651',
  today: 'https://www.todayonline.com/big-read/big-read-can-spore-find-right-balance-e-payments-become-norm-2174916',
}

export default function ArticleDigitalVsPaper() {
  return (
    <UXWrapper className="py-12 sm:py-16">
      <div className="max-w-3xl mx-auto">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <Link href="/blog" className="text-white/70 hover:text-white text-sm transition-colors">
            ← Blog
          </Link>
        </nav>

        <article className="rounded-2xl bg-white/95 backdrop-blur shadow-lg overflow-hidden">

          <div className="p-8 sm:p-12">

          {/* Header image — inset within the white card to avoid image-on-image clash */}
          <div className="w-full aspect-video relative overflow-hidden rounded-lg mb-10">
            <Image
              src="/backgrounds/restaurant-scene-with-menu.png"
              alt="A restaurant scene with menus on the table"
              fill
              className="object-cover"
              priority
            />
          </div>

            {/* Article header */}
            <header className="mb-10">
              <p className="text-sm font-medium text-ux-primary uppercase tracking-wide mb-3">
                Menu Strategy
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                Paper Menus for Guests, Digital Control for Operators
              </h1>
              <p className="text-lg text-gray-500 leading-relaxed mb-3">
                Printed menus still suit the dining experience many guests want, but digital menu
                workflows help operators update faster, stay accurate, and work more efficiently.
              </p>
              <p className="text-sm text-gray-400">15 March 2026</p>
            </header>

            {/* Body */}
            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">

              <p className="font-bold text-gray-900">
                Restaurants do not really have a &ldquo;paper versus digital&rdquo; problem.
              </p>
              <p>
                They have hospitality challenges, operational challenges, and increasingly, staffing
                challenges. The menu sits right in the middle of all three. Guests still want a
                pleasant, easy dining experience, especially in sit-down restaurants. Operators,
                meanwhile, need menus that are easy to update, easy to share, and easy to keep
                accurate. Current industry research suggests both sides are right: diners often still
                prefer printed menus in full-service settings, while operators see technology as a
                practical advantage when it improves convenience and efficiency.
              </p>
              <p>
                That is why &ldquo;digital or paper?&rdquo; is usually the wrong question. A better
                question is: <strong className="text-gray-900">which parts of the menu experience
                should stay tactile and human, and which parts should become easier to manage
                digitally?</strong> The National Restaurant Association&rsquo;s 2024 technology
                research makes this distinction quite clearly.<Cite n={1} href={SOURCES.nra} /> In
                full-service dining, it describes technology as largely &ldquo;nice-to-have&rdquo;,
                because people still value interaction with staff. In delivery, by contrast,
                technology is much closer to a baseline expectation.
              </p>

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                Why paper menus still matter
              </h2>
              <p>
                It is easy to assume paper menus are old-fashioned. In practice, they still do
                several things very well.
              </p>
              <p>
                A printed menu is immediate. It does not require a phone battery, a camera, a
                signal, a login, or the patience to zoom in and out of a mobile screen. In a
                sit-down setting, it can also feel more natural. The National Restaurant Association
                says that for most customers, engagement with employees is an integral part of the
                full-service experience and that most consumers do not appear interested in replacing
                that high-touch interaction with a completely tech-driven one.<Cite n={1} href={SOURCES.nra} />
              </p>
              <p>
                That broader preference shows up in third-party reporting too. Restaurant Business,
                citing Technomic survey data, found that the vast majority of diners in sit-down
                restaurants still prefer a physical menu over scanning a QR code.<Cite n={2} href={SOURCES.rbQr} /> Even
                if some guests are perfectly comfortable scanning a code, that number is a reminder
                that restaurant technology should not be introduced just because it exists. It still
                has to feel right for the occasion.
              </p>
            </div>

            {/* Stat 1 */}
            <StatCallout
              stat="88%"
              context="of diners preferred paper menus over QR menus in sit-down restaurants. (Technomic via Restaurant Business)"
              href={SOURCES.rbQr}
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed overflow-hidden">
              {/* Body image 1 — floated right */}
              <InlineImage
                src="/backgrounds/restaurant-front-of-house.png"
                alt="Guests browsing printed menus at a restaurant table"
                float="right"
              />
              <p>
                This is especially relevant for restaurants that want to create atmosphere, guide
                attention, or encourage shared browsing around the table. A good printed menu is not
                just a list of items. It is part of the dining experience.
              </p>

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4 clear-right">
                Where digital menus have the edge
              </h2>
              <p>
                At the same time, operators have very real reasons to want more digital control.
              </p>
              <p>
                Menus change. Prices move. Items sell out. Seasonal specials come and go. If every
                update means reworking a print file from scratch, chasing versions, or living with
                inaccuracies until the next reprint, that becomes an admin burden very quickly. The
                National Restaurant Association reports that 76% of operators say technology gives
                them a competitive edge<Cite n={1} href={SOURCES.nra} />, and the report repeatedly
                frames technology as useful when it improves efficiency, customer experience, and
                day-to-day operations.
              </p>
            </div>

            {/* Stat 2 */}
            <StatCallout
              stat="76%"
              context="of operators say technology gives them a competitive edge. (National Restaurant Association, 2024)"
              href={SOURCES.nra}
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <p>
                The nuance is important here. Customers are not rejecting all technology. They are
                being selective about where they want it. In full-service restaurants, the
                Association found that 59% of customers said they would pull up a menu on their
                smartphone using a QR code, but fewer than half were comfortable using it to place
                an order (48%) or pay (46%).<Cite n={1} href={SOURCES.nra} /> That suggests diners
                may accept digital access to information more readily than a fully digitised
                table-service experience.
              </p>
            </div>

            {/* Stat 3 */}
            <StatCallout
              stat="59% → 48% → 46%"
              context="Full-service diners willing to: view a menu via QR → place an order → pay digitally. Comfort drops at each step. (NRA 2024)"
              href={SOURCES.nra}
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed">
              <p>
                In other words: digital works best when it removes friction, not when it replaces
                hospitality.
              </p>

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                The Singapore angle
              </h2>
              <p>
                This balance feels particularly relevant in Singapore.
              </p>
              <p>
                CNA reported in 2024 that some restaurant owners are turning to technology to ease
                chronic manpower shortages, and specifically noted that mobile ordering allows
                restaurants to run with fewer employees per shift because staff can focus more on
                food running than traditional order-taking.<Cite n={3} href={SOURCES.cna} /> That
                does not mean every diner wants a QR-only experience. It does show why operators are
                under pressure to adopt tools that help them run leaner.
              </p>
            </div>

            {/* Stat 4 */}
            <StatCallout
              stat="97%"
              context="of payment methods at Singapore retail points of sale were cashless in 2022 — the highest rate in Southeast Asia. (Statista via TODAY)"
              href={SOURCES.today}
            />

            <div className="space-y-6 text-gray-700 text-[1.0625rem] leading-relaxed overflow-hidden">
              {/* Body image 2 — floated left */}
              <InlineImage
                src="/backgrounds/restaurant-back-office.png"
                alt="Restaurant back-office with digital menu management tools"
                float="left"
              />
              <p>
                Put those two points together and the local picture becomes clearer: in Singapore,
                digital habits are already normal, and labour pressure is real. That makes digital
                menu workflows more attractive operationally, even if plenty of diners still prefer
                a polished printed menu on the table.
              </p>

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4 clear-left">
                The real answer is not &ldquo;paper or digital&rdquo;
              </h2>
              <p>
                For most restaurants, the strongest answer is not to go all-in on one side.
              </p>
              <p>
                Paper still works well for readability, ambience and ease of use in dine-in
                settings. Digital is stronger for speed of updates, version control, and keeping
                menu information current across different channels. The more sensible goal is not to
                force customers into a QR-only experience, nor to keep menu management trapped in a
                fully manual workflow. It is to let the guest experience stay smooth while making
                the operator&rsquo;s job easier behind the scenes. That is broadly consistent with
                the National Restaurant Association&rsquo;s recommendation<Cite n={1} href={SOURCES.nra} /> to
                fit technology to the customer base being served, rather than chasing technology for
                its own sake.
              </p>
              <p>
                A restaurant may still want printed menus in the dining room, but also want the
                ability to update menu content quickly, reuse it elsewhere, and maintain consistency
                between print, web, social posts and promotions. Seen that way, digital is not the
                replacement for paper. It is the operating layer behind it.
              </p>

              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 pt-4">
                Final thought
              </h2>
              <p>
                The restaurants likely to benefit most are not the ones asking whether paper menus
                are dead.
              </p>
              <p>
                They are the ones asking how to keep the guest experience comfortable while reducing
                the effort required to create, update and maintain menu content. Paper and digital
                each solve different problems. The winners will usually be the operators who
                understand that and design accordingly.
              </p>
            </div>

            {/* Sources */}
            <footer className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Sources
              </h3>
              <ol className="space-y-2 text-xs text-gray-500 list-decimal list-inside">
                <li>
                  <a href={SOURCES.nra} target="_blank" rel="noreferrer noopener" className="hover:text-ux-primary transition-colors">
                    National Restaurant Association — 2024 Technology Landscape Report
                  </a>
                </li>
                <li>
                  <a href={SOURCES.rbQr} target="_blank" rel="noreferrer noopener" className="hover:text-ux-primary transition-colors">
                    Restaurant Business — Customers really don&rsquo;t like QR code menus
                  </a>
                </li>
                <li>
                  <a href={SOURCES.cna} target="_blank" rel="noreferrer noopener" className="hover:text-ux-primary transition-colors">
                    CNA — Singapore restaurants turn to technology amid manpower shortages
                  </a>
                </li>
                <li>
                  <a href={SOURCES.today} target="_blank" rel="noreferrer noopener" className="hover:text-ux-primary transition-colors">
                    TODAY — Can Singapore find the right balance as e-payments become the norm?
                  </a>
                </li>
              </ol>
            </footer>

          </div>
        </article>
      </div>
    </UXWrapper>
  )
}
