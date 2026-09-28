'use client'

import { Newsreader } from 'next/font/google'
import { HERO_DEMO_DISHES, HERO_DEMO_SCENARIOS, type HeroDemoDish } from './dishes'
import { DishPhoto } from './DishPhoto'
import styles from './hero-demo.module.css'

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

function Icon({ d, filled }: { d: string; filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={d}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function InstagramPost({ dish, dishIndex }: { dish: HeroDemoDish; dishIndex: number }) {
  return (
    <article className="flex h-[404px] w-[250px] flex-col overflow-hidden rounded-[10px] bg-white text-[11px] text-neutral-900 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
      <header className="flex items-center gap-2 px-2.5 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c2410c] text-[11px] font-bold text-white">
          {dish.initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold leading-tight">{dish.handle}</span>
          <span className="block text-[9px] text-[#737373]">Sponsored</span>
        </span>
        <span className="text-[14px] tracking-widest text-neutral-800" aria-hidden="true">
          ···
        </span>
      </header>
      <div className="relative h-[250px] w-[250px]">
        <DishPhoto slot="insta" dishIndex={dishIndex} alt="" sizes="250px" />
      </div>
      <div className="flex items-center gap-3 px-2.5 py-2 text-neutral-900">
        <span className="text-[#e11d48]">
          <Icon filled d="M12 20s-7-4.4-9.2-8.4C1 8.6 1.6 5.4 4.2 4 6.4 2.8 8.6 3.4 12 7.2 15.4 3.4 17.6 2.8 19.8 4c2.6 1.4 3.2 4.6 1.4 7.6C19 15.6 12 20 12 20z" />
        </span>
        <Icon d="M5 17.5 4 8.5 12 12l8-3.5-1 9-7 2.5-7-2.5z" />
        <Icon d="M4 12h11M12 7l5 5-5 5" />
        <span className="ml-auto">
          <Icon d="M7 5h10a1 1 0 0 1 1 1v14l-6-3-6 3V6a1 1 0 0 1 1-1z" />
        </span>
      </div>
      <p className="px-2.5 pb-1 text-[11px] font-bold">{dish.likes} likes</p>
      <p className="line-clamp-2 min-h-[2.6em] px-2.5 pb-1 text-[11px] leading-snug">
        <strong>{dish.handle}</strong> {dish.caption}
      </p>
      <p className="mt-auto px-2.5 pb-3 text-[11px] text-[#737373]">View all {dish.comments} comments</p>
    </article>
  )
}

function RecipeBlog({ dish, dishIndex }: { dish: HeroDemoDish; dishIndex: number }) {
  return (
    <article className={`flex h-[408px] w-[480px] flex-col overflow-hidden rounded-[10px] bg-[#fbfaf7] text-[#1c1917] ${newsreader.className}`}>
      <div className="flex items-center gap-2 bg-[#e7e5e4] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#fb7185]" />
        <span className="h-2 w-2 rounded-full bg-[#fbbf24]" />
        <span className="h-2 w-2 rounded-full bg-[#4ade80]" />
        <span className="ml-2 truncate rounded-full bg-white/70 px-2 py-0.5 font-sans text-[9px] text-[#78716c]">
          {dish.url}
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-[#e7e5e4] px-5 py-2.5 font-sans">
        <span className="text-[15px] font-semibold">{dish.blog}</span>
        <span className="text-[9px] font-semibold tracking-[0.06em] text-neutral-500">RECIPES · SEASONAL · ABOUT</span>
      </div>
      <div className="flex flex-col gap-2 px-5 pb-[18px] pt-3.5">
        <p className="font-sans text-[9px] font-bold tracking-[0.12em] text-[#c2410c]">{dish.category}</p>
        <h3 className="line-clamp-2 min-h-[48px] text-[24px] font-semibold leading-none">{dish.recipe}</h3>
        <p className="font-sans text-[10px] text-[#78716c]">{dish.meta}</p>
        <div className="relative h-[190px] w-[440px] overflow-hidden rounded-[6px]">
          <DishPhoto slot="blog" dishIndex={dishIndex} alt="" sizes="440px" />
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-neutral-900/80 px-2.5 py-1 font-sans text-[10px] font-semibold text-white">
            Jump to recipe ↓
          </span>
        </div>
      </div>
    </article>
  )
}

function CookbookSpread({ dish, dishIndex }: { dish: HeroDemoDish; dishIndex: number }) {
  return (
    <article className={`relative flex h-[320px] w-[500px] overflow-hidden rounded-[4px] shadow-[0_24px_60px_rgba(0,0,0,0.6)] ${newsreader.className}`}>
      <div className="relative h-[320px] w-[250px]">
        <DishPhoto slot="book" dishIndex={dishIndex} alt="" sizes="250px" />
      </div>
      <div className="flex h-[320px] w-[250px] flex-col gap-2 bg-[#f5efe3] px-6 py-[26px] text-[#292524]">
        <p className="font-sans text-[8px] font-bold tracking-[0.16em] text-[#a16207]">{dish.chapter}</p>
        <h3 className="line-clamp-2 text-[23px] font-semibold leading-tight">{dish.bookTitle}</h3>
        <p className="text-[11px] italic text-[#78716c]">{dish.meta}</p>
        <p className="mt-1 font-sans text-[8px] font-bold tracking-[0.14em]">INGREDIENTS</p>
        <ul className="text-[11px] leading-relaxed">
          {dish.ingredients.map((line) => (
            <li key={line} className="border-b border-[rgba(41,37,36,0.1)] py-1">
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-auto text-right text-[9px] text-[#a8a29e]">{dish.page}</p>
      </div>
      <div
        className="pointer-events-none absolute bottom-0 top-0 w-10"
        style={{ left: 230, background: 'linear-gradient(90deg, transparent, rgba(0,0,0,.22), transparent)' }}
        aria-hidden="true"
      />
    </article>
  )
}

function DeliveryApp({ dish, dishIndex }: { dish: HeroDemoDish; dishIndex: number }) {
  return (
    <article className="h-[390px] w-[212px] rounded-[32px] bg-[#050505] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
      <div className="flex h-full flex-col overflow-hidden rounded-[25px] bg-white text-neutral-900">
        <div className="relative h-[180px]">
          <DishPhoto slot="delivery" dishIndex={dishIndex} alt="" sizes="200px" />
          <span className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[14px] shadow">
            ←
          </span>
        </div>
        <div className="flex flex-1 flex-col px-3.5 py-3">
          <p className="w-fit rounded bg-[#fef3c7] px-1.5 py-0.5 text-[8px] font-bold text-[#92400e]">#1 MOST LIKED</p>
          <h3 className="mt-1.5 text-[15px] font-extrabold leading-tight">{dish.dish}</h3>
          <p className="mt-1 line-clamp-3 text-[9.5px] leading-snug text-[#6b7280]">{dish.desc}</p>
          <p className="mt-2 text-[13px] font-bold">{dish.price}</p>
          <div className="mt-auto rounded-full bg-neutral-950 py-2 text-center text-[11px] font-bold text-white">
            Add to basket · {dish.price}
          </div>
        </div>
      </div>
    </article>
  )
}

const MOCKUPS = [InstagramPost, RecipeBlog, CookbookSpread, DeliveryApp] as const

export function PublishLayer({ dishIndex, scenario }: { dishIndex: number; scenario: number }) {
  const dish = HERO_DEMO_DISHES[dishIndex] ?? HERO_DEMO_DISHES[0]

  return (
    <>
      {HERO_DEMO_SCENARIOS.map((item, index) => {
        const Mockup = MOCKUPS[index]
        return (
          <div key={item.key} className={styles.scenario} data-on={scenario === index ? 'true' : 'false'}>
            <Mockup dish={dish} dishIndex={dishIndex} />
          </div>
        )
      })}
    </>
  )
}
