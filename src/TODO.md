# Roadmap

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>> NOW >>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

## /pricing
- [x] Review pricing approach
- [ ] Auto-grant new sign-ups 10 credits
- [ ] Allow (paid and beta) users to access NB Pro
- [ ] Stripe packages update and notify Grok
- [ ] Create 100% off Promo Code coupon
- [ ] Test

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>> NEXT >>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

## Social Media and Advertising
- [ ] Social Media "GridMenu is changing"
- [ ] Investigate what's required for name change

## SEO optimisation
- [ ] Product Hunt, Indie Hackers, Betalist, Crunchbase, AlternativeTo, etc.

## UI Review
- Create design system with Pinterest / Claude

## /studio
- [ ] During upload of image - maintain user interest (can be very slow)
- [ ] Allow the user to choose two images for comparison
- [ ] Branching [grid tiles?] structure rather than timeline
- [ ] While generation is in progress, the "variants" ...
- [ ] Click to draw a circle/oval/eraser to remove element
- [ ] Click to draw a circle/oval/eraser to move an element
- [ ] Crop
- [ ] Magic expand
- [ ] Investigate vessel swapping (pro advised to use reference)
- [ ] Investigate rotation
- [ ] "Reconstitute" using extracted JSON (especially if image is terrible, e.g. Hainanese chicken)
- [ ] Flash-Lite option (a 3rd tier) (1K outputs only)

## /onboarding
- [ ] New users get 10 credits by default

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>> LATER >>>>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

## Social Media and Advertising
- [ ] "How to design a restaurant menu" Starter Story Build May 26 "How to Get 1,000 Downloads On Your App in 30 Days (From Scratch)"

## /studio
- [ ] Click to draw a circle/oval/eraser to change an element
- [ ] Add steam, shimmer, etc. (pro advised to use reference)
- [ ] Image downsizing functionality (in-browser)
- [ ] If a user likes a certain mutation combo (e.g. studio lighting + yellow backdrop + white tablecloth) -> allow style save (for application to other dishes, e.g. "apply to all").
- [ ] Brand kit
- [ ] Consider angle manipulation (best with cut-out perhaps, but still potential risks)

## Bugs

## Issues
- [ ] Why is cutout worker still appearing in Vercel logs?

## Deployment
- [x] Upgrade Vercel package
- [ ] Upgrade to Supabase Pro (and enable PITR)
- [ ] Site under maintenance page / impending maintenance notice

## "What's New?" page
- [ ] "What's New?" page
- [ ] Coming soon...
- [ ] Add popup banner to /dashboard

## Security
- [ ] Address Next.js DoS vulnerabilities (see `SECURITY_NEXTJS_VULNERABILITIES.md`)
- [ ] Ensure MFA is set on email accounts
- [ ] Ensure choosing own username during onboarding 

## Tech debt
- [ ] Review code
- [ ] Review SQL
- [ ] Review MD docs
- [ ] QA

### Blogs
- [ ] Grow sales with better images
- [ ] Admin tool to add blogs
- [ ] Use better descriptions to boost sales
- [ ] Comparison page (https://www.upmenu.com/blog/menu-making-apps/)

## /dashboard
- [ ] Consider if needed for item management

## /dashboard/settings
- [ ] Capability to update restaurant name, details, etc. (that are collected at onboarding)
- [ ] Display/update email address

## /extracted
- [ ] Consider if a version of this is needed for studio item management (opportunity to use better path here)

## /pricing
- [ ] Mauricio feedback - billing period (quarterly, bi-annually, annually)
- [ ] Consider image limit

## Workers
- [ ] Switch image generation to use worker (there is an MD doc somewhere that proposes how to do this)

## Home Page
- [ ] Determine content

## Demo Flow
- [ ] Consider if demo flow is needed

## Stripe
- [ ] Verify that webhooks are in place to detect recurring payments, failures, etc. (as per Gemini chat)

## Admin
- [ ] Track payment failures and cancellations
- [ ] Change primary email logins to admin@gridmenu.ai (e.g. Postmark, NameCheap, Railway, Supabase, etc.)
- [ ] Remove LOG_LEVEL="debug" from Railway variables
- [ ] Consolidate documentation so as to be intuitive and useful (for both me and AI dev)
- [ ] Cyber attack protection plan
- [ ] Power user, i.e. "login as user X" (support)
- [ ] Determine and document how to issue refunds (or set up policy for credit top-up only)
- [ ] Talk to JBL about SUTE Tax Exemption

## FAQ
- [ ] Add "I didn't receive my menu?", check junk/spam folders, etc. or contact support for re-issue

## Structural / Architectural
- [ ] Use a different model than Gemini for OCR analysis step (e.g. this from 04/08/2026: https://signals.forwardfuture.com/qwen3-8-benchmarks/). Sometimes still offering "Studio Backdrop" even if only the surface is visible.  Gemini recommends "Monocular Depth Estimation Models"
- [ ] Explore batch requests to Gemini image creation (saves costs)
- [ ] Explore use of ChatGPT Images 2.0 (and other options?) as backup to remove single-dependency image generation
- [ ] Playwright (Patrick Ellis YT video)
- [ ] App

## Social Media and Advertising
- [ ] Understand what is required and potential upside to conduct a cold email campaign

## Unclassified
- [ ] Remove m-dashes across the project
- [ ] Rule in Cursor for no m-dashes 
- [ ] Rule in Kiro for no m-dashes 
- [ ] Mobile UX upgrade (see STUDIO_MOBILE_FOCUS_SWITCHER_PROPOSAL.md)
- [ ] Watermark removal tool
- [ ] Ensure that disclaimers are in place to warn of AI shortcomings and failures
- [ ] Priority Railway queues for subscribers
- [ ] Accessibility (read Reddit pain points analysis)
- [ ] Review logging scope
- [ ] Reminder email for credits expiry
- [ ] Tracking expiry for different credits packs
- [ ] Multi-user access to accounts (Premium tier)
- [ ] Mauricio feedback - menu item suggestion - including ingredients and recipes
- [ ] Mauricio feedback - inventory management
- [ ] Language support

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>> DONE >>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

>> Below this line