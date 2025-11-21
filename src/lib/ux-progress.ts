// Lightweight progress preservation helpers for the UX single-page workflow.
// Stores the last visited step per menuId in localStorage using a simple
// XOR-based obfuscation so the raw JSON state is not stored in plain text.
//
// This is intentionally small and self-contained, and is NOT meant to provide
// strong cryptographic guarantees – it is only used to avoid leaving easily
// readable progress JSON in localStorage while preserving UX.

export type UXFlowStep = 'upload' | 'extract' | 'extracted' | 'template' | 'export'

export interface UXProgressState {
  menuId: string
  lastStep: UXFlowStep
  updatedAt: string
  version: 1
}

const STORAGE_PREFIX = 'uxFlowEncrypted:'
const DEFAULT_SECRET = 'ux-progress-fallback-secret'

const SECRET: string = process.env.NEXT_PUBLIC_UX_PROGRESS_SECRET || DEFAULT_SECRET

function getStorageKey(menuId: string): string {
  return `${STORAGE_PREFIX}${menuId}`
}

function getCryptoKeyBytes(): Uint8Array {
  // TextEncoder is available in modern browsers and Node 18+ (used in tests).
  const encoder = new TextEncoder()
  return encoder.encode(SECRET)
}

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i += 1) {
    out[i] = data[i] ^ key[i % key.length]
  }
  return out
}

function encodeBase64(bytes: Uint8Array): string {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i])
      }
      return window.btoa(binary)
    }
    // Fallback for test environments without window.btoa
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Buf: any = (globalThis as any).Buffer
    if (Buf) {
      return Buf.from(bytes).toString('base64')
    }
  } catch {
    // ignore encoding errors and fall through
  }
  return ''
}

function decodeBase64(str: string): Uint8Array | null {
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      const binary = window.atob(str)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes
    }
    // Fallback for test environments without window.atob
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Buf: any = (globalThis as any).Buffer
    if (Buf) {
      return new Uint8Array(Buf.from(str, 'base64'))
    }
  } catch {
    // ignore decoding errors
  }
  return null
}

function encrypt(payload: string): string {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return payload
  }
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const key = getCryptoKeyBytes()
    const xored = xorBytes(data, key)
    const encoded = encodeBase64(xored)
    return encoded || payload
  } catch {
    return payload
  }
}

function decrypt(ciphertext: string): string | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return ciphertext
  }
  try {
    const bytes = decodeBase64(ciphertext)
    if (!bytes) return null
    const key = getCryptoKeyBytes()
    const plainBytes = xorBytes(bytes, key)
    const decoder = new TextDecoder()
    return decoder.decode(plainBytes)
  } catch {
    return null
  }
}

export function saveUXProgress(menuId: string, step: UXFlowStep): void {
  if (typeof window === 'undefined' || !menuId) return
  try {
    const state: UXProgressState = {
      menuId,
      lastStep: step,
      updatedAt: new Date().toISOString(),
      version: 1,
    }
    const json = JSON.stringify(state)
    const encrypted = encrypt(json)
    window.localStorage.setItem(getStorageKey(menuId), encrypted)
  } catch {
    // ignore storage errors – progress persistence should never break UX
  }
}

export function loadUXProgress(menuId: string): UXProgressState | null {
  if (typeof window === 'undefined' || !menuId) return null
  try {
    const raw = window.localStorage.getItem(getStorageKey(menuId))
    if (!raw) return null
    const decrypted = decrypt(raw) ?? raw
    const parsed = JSON.parse(decrypted) as UXProgressState
    if (!parsed || parsed.menuId !== menuId || !parsed.lastStep) return null
    return parsed
  } catch {
    return null
  }
}


