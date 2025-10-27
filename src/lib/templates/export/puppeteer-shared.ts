import puppeteer from 'puppeteer'
import os from 'os'
import path from 'path'
import fs from 'fs'

let sharedBrowser: any = null
let browserPromise: Promise<any> | null = null
let userDataDirPath: string | null = null

export async function getSharedBrowser() {
  if (sharedBrowser) {
    return sharedBrowser
  }

  if (browserPromise) {
    return browserPromise
  }

  // Create a unique temporary userDataDir for this browser instance to avoid
  // Windows profile locking issues when tests run concurrently.
  const createAndLaunch = async (): Promise<any> => {
    const base = path.join(os.tmpdir(), 'puppeteer_profile_')
    const dir = fs.mkdtempSync(base)
    userDataDirPath = dir

    return puppeteer.launch({
      headless: true,
      // Extra flags reduce chrome startup prompts and sandbox issues in CI/Windows
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-default-browser-check'
      ],
      userDataDir: dir
    })
  }

  browserPromise = (async () => {
    try {
      return await createAndLaunch()
    } catch (err: any) {
      // If profile is reported as already running, retry with a fresh directory
      const message = err && err.message ? String(err.message) : ''
      if (message.toLowerCase().includes('browser is already running')) {
        try {
          return await createAndLaunch()
        } catch {
          throw err
        }
      }
      throw err
    }
  })()

  sharedBrowser = await browserPromise
  browserPromise = null

  return sharedBrowser
}

export async function closeSharedBrowser() {
  if (sharedBrowser) {
    try {
      await sharedBrowser.close()
    } catch {}
    sharedBrowser = null
  }
  browserPromise = null
  // Best-effort cleanup of the temporary userDataDir
  if (userDataDirPath) {
    try {
      fs.rmSync(userDataDirPath, { recursive: true, force: true })
    } catch {}
    userDataDirPath = null
  }
}



