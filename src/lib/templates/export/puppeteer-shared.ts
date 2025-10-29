import os from 'os'
import path from 'path'
import fs from 'fs'

let sharedBrowser: any = null
let browserPromise: Promise<any> | null = null

// Keep minimal: no persisted WS endpoint; production code launches a single process

export async function getSharedBrowser() {
  if (sharedBrowser) {
    return sharedBrowser
  }

  if (browserPromise) {
    return browserPromise
  }

  // Launch a single shared browser with a unique userDataDir (avoids default profile contention)
  const createAndLaunch = async (): Promise<any> => {
    // Detect Vercel/AWS Lambda style environment
    const isServerless = !!(process.env.VERCEL || process.env.AWS_REGION)

    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'kiro_puppeteer_profile_')
    )

    const launch = async () => {
      if (isServerless) {
        // Use puppeteer-core with @sparticuz/chromium on Vercel
        const chromium = await import('@sparticuz/chromium')
        const puppeteerCore = (await import('puppeteer-core')).default

        const executablePath = await chromium.executablePath()

        return puppeteerCore.launch({
          headless: chromium.headless ?? 'new',
          args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
          executablePath,
          defaultViewport: chromium.defaultViewport ?? {
            width: 1280,
            height: 800
          },
          userDataDir
        })
      }

      // Local/dev: use full puppeteer which downloads Chrome during install
      const puppeteer = (await import('puppeteer')).default
      return puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check'
        ],
        userDataDir
      })
    }

    const maxAttempts = 3
    let attempt = 0
    // Simple linear backoff (200ms, 400ms)
    while (true) {
      try {
        return await launch()
      } catch (err: any) {
        attempt += 1
        const message = err && err.message ? String(err.message) : ''
        if (attempt >= maxAttempts || !message.toLowerCase().includes('browser is already running')) {
          throw err
        }
        await new Promise(r => setTimeout(r, attempt * 200))
      }
    }
  }

  browserPromise = (async () => {
    return await createAndLaunch()
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
  // No persisted state to clean up here; per-testcode cleanup closes pages
}



