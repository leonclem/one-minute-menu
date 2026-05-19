import { redirect } from 'next/navigation'

/**
 * Flyer campaign landing page – sgfnb
 *
 * This route exists solely to be printed on physical flyers distributed at
 * the Springfield / SGF area event. The short path is easy to type and scan.
 *
 * Analytics flow:
 *  1. Vercel Analytics captures the page view for /sgfnb automatically.
 *  2. PostHog captures the page view via the PostHogBootstrap provider in the
 *     root layout before the redirect fires (server-side redirect is instant,
 *     so client-side PostHog capture is handled on the home page via the
 *     `utm_source` query param we append below).
 *  3. The redirect carries UTM params so Google Analytics / PostHog on the
 *     home page can attribute the session to this campaign.
 */
export default function SgfnbPage() {
  redirect('/?utm_source=flyer&utm_medium=print&utm_campaign=sgfnb')
}

export const metadata = {
  // Prevent search engines from indexing this redirect page
  robots: { index: false, follow: false },
}
