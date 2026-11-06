'use client'

import Image from 'next/image'
import { HERO_DEMO_DISHES } from './dishes'

export function PublishLayer({ dishIndex }: { dishIndex: number }) {
  return (
    <div className="relative h-[400px] w-[540px]">
      {HERO_DEMO_DISHES.map((dish, index) => (
        <Image
          key={dish.file}
          src={dish.settingSrc}
          alt={index === dishIndex ? dish.settingAlt : ''}
          fill
          sizes="540px"
          className={`object-contain transition-opacity duration-500 ${
            index === dishIndex ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={index === dishIndex ? undefined : true}
        />
      ))}
    </div>
  )
}
