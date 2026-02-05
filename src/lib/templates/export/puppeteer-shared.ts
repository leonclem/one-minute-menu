import os from 'os'
import path from 'path'
import fs from 'fs'

let sharedBrowser: any = null
let browserPromise: Promise<any> | null = null

// Concurrency management
let activePages = 0
const MAX_CONCURRENT_PAGES = process.env.MAX_CONCURRENT_PAGES 
  ? parseInt(process.env.MAX_CONCURRENT_PAGES) 
  : 3

/**
 * Acquire a page from the shared browser with concurrency limiting
 */
export async function acquirePage() {
  const browser = await getSharedBrowser()
  
  // Wait if we've reached the concurrency limit
  if (activePages >= MAX_CONCURRENT_PAGES) {
    console.info(`[PuppeteerShared] Concurrency limit reached (${activePages}/${MAX_CONCURRENT_PAGES}), waiting for a page...`)
    while (activePages >= MAX_CONCURRENT_PAGES) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  activePages++
  try {
    const page = await browser.newPage()
    
    // Add a wrapper for close to manage the count exactly once
    let closed = false
    const originalClose = page.close.bind(page)
    page.close = async () => {
      if (!closed) {
        closed = true
        activePages--
      }
      return await originalClose()
    }
    
    return page
  } catch (error) {
    activePages--
    throw error
  }
}

export async function getSharedBrowser() {
  if (sharedBrowser) {
    return sharedBrowser
  }

  if (browserPromise) {
    return browserPromise
  }

  // Launch a single shared browser with a unique userDataDir (avoids default profile contention)
  const createAndLaunch = async (): Promise<any> => {
    // Guard against invalid executable paths leaking from container-centric envs.
    // Example: local Windows dev with PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium.
    const configuredExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    if (configuredExecutablePath && !fs.existsSync(configuredExecutablePath)) {
      console.warn(
        `[PuppeteerShared] Ignoring PUPPETEER_EXECUTABLE_PATH (not found): ${configuredExecutablePath}`
      )
      delete process.env.PUPPETEER_EXECUTABLE_PATH
    }

    // Prefer external Browserless endpoint if configured
    const browserlessWSEndpoint =
      process.env.BROWSERLESS_URL ||
      process.env.BROWSERLESS_WS ||
      process.env.BROWSER_WS_ENDPOINT

    // Detect Vercel/AWS Lambda style environment
    const isServerless = !!(process.env.VERCEL || process.env.AWS_REGION)

    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'kiro_puppeteer_profile_')
    )

    const launch = async () => {
      if (browserlessWSEndpoint) {
        const puppeteerCore = (await import('puppeteer-core')).default
        return puppeteerCore.connect({
          browserWSEndpoint: browserlessWSEndpoint,
          defaultViewport: { width: 1280, height: 800 }
        })
      }

      if (isServerless) {
        // Use puppeteer-core with @sparticuz/chromium on Vercel
        const chromium = (await import('@sparticuz/chromium')).default
        const puppeteerCore = (await import('puppeteer-core')).default

        const executablePath = await chromium.executablePath()

        // Ensure dynamic linker can find Chromium's bundled libs (e.g., libnss3.so)
        try {
          const chromiumDir = path.dirname(executablePath)
          const libDir = path.join(chromiumDir, 'lib')
          const currentLdPath = process.env.LD_LIBRARY_PATH || ''
          const newLdPath = [libDir, chromiumDir, currentLdPath]
            .filter(Boolean)
            .join(':')
          process.env.LD_LIBRARY_PATH = newLdPath
        } catch {}

        return puppeteerCore.launch({
          headless: chromium.headless,
          args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
          executablePath,
          defaultViewport: chromium.defaultViewport,
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



