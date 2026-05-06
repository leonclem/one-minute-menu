/**
 * Feature: posthog-integration
 * Validates Requirements: 8.5
 *
 * Smoke test: asserts .env.production.example documents all four PostHog env vars
 * and includes the clarifying note about NEXT_PUBLIC_POSTHOG_UI_HOST.
 */

import * as fs from 'fs';
import * as path from 'path';

const ENV_EXAMPLE_PATH = path.resolve(process.cwd(), '.env.production.example');

describe('.env.production.example PostHog documentation', () => {
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf-8');
  });

  it('contains NEXT_PUBLIC_POSTHOG_TOKEN', () => {
    expect(content).toMatch(/NEXT_PUBLIC_POSTHOG_TOKEN/);
  });

  it('contains NEXT_PUBLIC_POSTHOG_HOST', () => {
    expect(content).toMatch(/NEXT_PUBLIC_POSTHOG_HOST/);
  });

  it('contains NEXT_PUBLIC_POSTHOG_UI_HOST', () => {
    expect(content).toMatch(/NEXT_PUBLIC_POSTHOG_UI_HOST/);
  });

  it('contains NEXT_PUBLIC_ENABLE_ANALYTICS', () => {
    expect(content).toMatch(/NEXT_PUBLIC_ENABLE_ANALYTICS/);
  });

  it('includes a clarifying note that NEXT_PUBLIC_POSTHOG_UI_HOST is the PostHog app URL, not an ingest host', () => {
    // The note must clarify that UI_HOST is the PostHog app URL (us.posthog.com / eu.posthog.com)
    // and NOT an ingest host, and that it is only required when using a managed reverse proxy.
    expect(content).toMatch(/NEXT_PUBLIC_POSTHOG_UI_HOST.*only required|only required.*NEXT_PUBLIC_POSTHOG_UI_HOST/is);
    expect(content).toMatch(/posthog\.com/i);
    expect(content).toMatch(/NOT an ingest host|not an ingest host/i);
  });
});
