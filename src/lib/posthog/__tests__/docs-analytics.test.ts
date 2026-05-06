/**
 * Smoke test: docs/analytics.md completeness
 *
 * Asserts that docs/analytics.md exists and contains all required subsection
 * headings per Requirement 13.1–13.5 and Requirement 15.5.
 *
 * Implements: 13.1, 13.2, 13.3, 13.4, 13.5, 15.5
 */

import * as fs from 'fs'
import * as path from 'path'

const DOCS_PATH = path.resolve(process.cwd(), 'docs', 'analytics.md')

describe('docs/analytics.md smoke test', () => {
  let content: string

  beforeAll(() => {
    // On case-insensitive filesystems (Windows, macOS) this resolves regardless
    // of the on-disk casing. On Linux we try both casings.
    if (fs.existsSync(DOCS_PATH)) {
      content = fs.readFileSync(DOCS_PATH, 'utf-8')
    } else {
      const upperPath = path.resolve(process.cwd(), 'docs', 'ANALYTICS.md')
      if (fs.existsSync(upperPath)) {
        content = fs.readFileSync(upperPath, 'utf-8')
      } else {
        content = ''
      }
    }
  })

  it('docs/analytics.md exists', () => {
    const exists =
      fs.existsSync(DOCS_PATH) ||
      fs.existsSync(path.resolve(process.cwd(), 'docs', 'ANALYTICS.md'))
    expect(exists).toBe(true)
  })

  // ── Req 13.1: Required subsection headings ──────────────────────────────

  it('contains an environment variables section', () => {
    expect(content.toLowerCase()).toMatch(/environment variable/)
  })

  it('contains a local enable/disable section', () => {
    expect(content.toLowerCase()).toMatch(/local enable|enable.*local|disable.*local/)
  })

  it('contains an admin opt-out section', () => {
    expect(content.toLowerCase()).toMatch(/admin opt.?out/)
  })

  it('contains a session replay / masking section', () => {
    expect(content.toLowerCase()).toMatch(/session replay|masking/)
  })

  it('contains a user identification section', () => {
    expect(content.toLowerCase()).toMatch(/user identification|identification/)
  })

  it('contains a logout / reset section', () => {
    expect(content.toLowerCase()).toMatch(/logout|reset/)
  })

  it('contains a managed reverse proxy section', () => {
    expect(content.toLowerCase()).toMatch(/managed reverse proxy|reverse proxy/)
  })

  // ── Req 13.2: Sensitive_Properties deny-list ────────────────────────────

  it('lists the sensitive properties deny-list', () => {
    // Must mention at least a few of the 13 deny-list keys
    expect(content).toMatch(/email/)
    expect(content).toMatch(/password/)
    expect(content).toMatch(/dish_name|dish_description|menu_text/)
    expect(content).toMatch(/file_name/)
  })

  // ── Req 13.3: TODO subsection ───────────────────────────────────────────

  it('contains a TODO subsection for unimplemented events', () => {
    expect(content.toLowerCase()).toMatch(/todo/)
  })

  // ── Req 13.4: subscription_started scope note ───────────────────────────

  it('states that subscription_started is intentionally NOT auto-wired', () => {
    expect(content.toLowerCase()).toMatch(/subscription_started/)
    expect(content.toLowerCase()).toMatch(/not auto.?wired|intentionally not|not.*wired/)
  })

  // ── Req 13.5: Railway/Docker PDF pipeline scope note ────────────────────

  it('states that the Railway/Docker PDF pipeline is intentionally NOT instrumented', () => {
    expect(content.toLowerCase()).toMatch(/railway|docker/)
    expect(content.toLowerCase()).toMatch(/not instrumented|intentionally not|out of scope/)
  })

  // ── Req 15.5: Managed reverse proxy deployment checklist ────────────────

  it('documents the managed reverse proxy setup steps', () => {
    // Must mention the key deployment steps
    expect(content.toLowerCase()).toMatch(/cname|dns/)
    expect(content.toLowerCase()).toMatch(/ssl|certificate/)
    expect(content).toMatch(/NEXT_PUBLIC_POSTHOG_HOST/)
    expect(content).toMatch(/NEXT_PUBLIC_POSTHOG_UI_HOST/)
  })

  it('documents the NEXT_PUBLIC_POSTHOG_UI_HOST clarification (app URL, not ingest host)', () => {
    // Must clarify that UI_HOST is the PostHog app URL, not an ingest host
    expect(content.toLowerCase()).toMatch(/app url|posthog app|us\.posthog\.com|eu\.posthog\.com/)
    expect(content.toLowerCase()).toMatch(/not.*ingest|not an ingest/)
  })

  // ── All four env vars documented ─────────────────────────────────────────

  it('documents all four PostHog environment variables', () => {
    expect(content).toMatch(/NEXT_PUBLIC_POSTHOG_TOKEN/)
    expect(content).toMatch(/NEXT_PUBLIC_POSTHOG_HOST/)
    expect(content).toMatch(/NEXT_PUBLIC_POSTHOG_UI_HOST/)
    expect(content).toMatch(/NEXT_PUBLIC_ENABLE_ANALYTICS/)
  })
})
