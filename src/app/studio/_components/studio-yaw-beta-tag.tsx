'use client'

import { useId, useState } from 'react'

export const YAW_BETA_MESSAGE =
  'This is a beta feature and may produce unexpected results.'

export function StudioYawBetaTag() {
  const [open, setOpen] = useState(false)
  const tipId = useId()

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-testid="studio-yaw-beta"
        className="peer inline-flex h-auto min-h-0 min-w-0 items-center rounded px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wider bg-[#f8bc02]/15 text-[#f8bc02] hover:bg-[#f8bc02]/25 focus:outline-none focus:ring-2 focus:ring-[#f8bc02]/40"
        aria-expanded={open}
        aria-describedby={tipId}
        aria-label="About rotate beta"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        onBlur={() => setOpen(false)}
      >
        BETA
      </button>
      <span
        id={tipId}
        role="tooltip"
        data-testid="studio-yaw-beta-tip"
        className={[
          'pointer-events-none absolute left-0 top-full z-30 mt-1 w-44 rounded-[8px] border border-[#f8bc02]/35 bg-[#0c1416] px-2 py-1.5 text-left text-[11px] font-medium normal-case tracking-normal text-white/80 shadow-lg',
          open
            ? 'visible opacity-100'
            : 'invisible opacity-0 [@media(hover:hover)]:peer-hover:visible [@media(hover:hover)]:peer-hover:opacity-100 [@media(hover:hover)]:peer-focus-visible:visible [@media(hover:hover)]:peer-focus-visible:opacity-100',
        ].join(' ')}
      >
        {YAW_BETA_MESSAGE}
      </span>
    </span>
  )
}
