'use client'

import { HERO_DEMO_DISHES } from './dishes'
import { DishPhoto } from './DishPhoto'
import styles from './hero-demo.module.css'

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-[#00b3bf]">
      <path
        d="M12 16V5M8 8.5 12 4.5 16 8.5M5 19h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UploadLayer({
  dishIndex,
  dropped,
  uploaded,
}: {
  dishIndex: number
  dropped: boolean
  uploaded: boolean
}) {
  const dish = HERO_DEMO_DISHES[dishIndex] ?? HERO_DEMO_DISHES[0]

  return (
    <div className={styles.upload}>
      <div className={styles.drop}>
        <div className={`${styles.photo} ${dropped ? styles.photoIn : ''}`}>
          <DishPhoto
            slot="og"
            dishIndex={dishIndex}
            alt={`Original photo of ${dish.dish}`}
            sizes="210px"
          />
        </div>
      </div>
      <div className={styles.uploadRow}>
        <div className={styles.uploadMeta}>
          <UploadIcon />
          <span className={styles.fileName}>{dish.file}</span>
          <span className={uploaded ? styles.statusDone : styles.statusWait}>
            {uploaded ? 'Uploaded ✓' : 'Uploading…'}
          </span>
        </div>
        <div className={styles.barTrack} aria-hidden="true">
          <div className={`${styles.bar} ${dropped ? styles.barOn : ''}`} />
        </div>
      </div>
    </div>
  )
}
