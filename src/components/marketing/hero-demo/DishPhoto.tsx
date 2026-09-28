'use client'

import Image from 'next/image'
import { HERO_DEMO_DISHES, type HeroDemoImages } from './dishes'

export function DishPhoto({
  slot,
  dishIndex,
  alt,
  sizes,
}: {
  slot: keyof HeroDemoImages
  dishIndex: number
  alt: string
  sizes: string
}) {
  return (
    <>
      {HERO_DEMO_DISHES.map((dish, index) => (
        <Image
          key={`${dish.file}-${slot}`}
          src={dish.images[slot]}
          alt={index === dishIndex ? alt : ''}
          fill
          sizes={sizes}
          priority={index === 0}
          loading={index === 0 ? undefined : 'eager'}
          className={`object-cover transition-opacity duration-500 ${index === dishIndex ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden={index === dishIndex ? undefined : true}
        />
      ))}
    </>
  )
}
