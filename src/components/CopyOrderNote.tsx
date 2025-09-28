'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import { copyToClipboard } from '@/lib/utils'

interface CopyOrderNoteProps {
  items: Array<{ name: string }>
  className?: string
}

export default function CopyOrderNote({ items, className = '' }: CopyOrderNoteProps) {
  const [copied, setCopied] = useState(false)
  const note = items.map(i => `- ${i.name}`).join('\n')

  const handleCopy = async () => {
    const ok = await copyToClipboard(note)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className={className} aria-label="Copy order note">
      {copied ? 'Copied!' : 'Copy order note'}
    </Button>
  )
}


