# Roadmap

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>> NOW >>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

## /studio
- [ ] UX tidy up

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>> NEXT >>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

## /studio
- [ ] Overhead shot
- [ ] Investigate rotation/angle manipulation
- [ ] Remove inverse and darken/shade/stripe area to be removed
- [ ] Revisit "re-shoot".  We have the description and the JSON - just send it!
- [ ] Investigate vessel swapping
- [ ] STUDIO_MOBILE_FOCUS_SWITCHER_PROPOSAL.md (check if still valid after redesign)

## /pricing
- [ ] Test production (use 100% off coupon perhaps)

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>> LATER >>>>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

## SEO optimisation
- [x] Check if Betalist updated (submitted changes 16/08/26)

## Social Media and Advertising
- [ ] Investigate what's required for name change
- [ ] "How to design a restaurant menu" Starter Story Build May 26 "How to Get 1,000 Downloads On Your App in 30 Days (From Scratch)"
- [ ] Understand what is required and potential upside to conduct a cold email campaign

## /studio
- [ ] During upload of image - maintain user interest (can be very slow)
- [ ] Allow the user to choose two variants for comparison (slider?)
- [ ] Add steam, shimmer, etc. (pro advised to use reference)
- [ ] See Pinterest "food photography".  Best photos seem to create depth through focus and have some action/drama occurring
- [ ] Branching [grid tiles?] structure rather than timeline
- [ ] Flash-Lite option (a 3rd tier) (1K outputs only)
- [ ] Image downsizing functionality (in-browser)
- [ ] If a user likes a certain mutation combo (e.g. studio lighting + yellow backdrop + white tablecloth) -> allow style save (for application to other dishes, e.g. "apply to all"). (parked — user-saved Quick Looks)
- [ ] Custom background (hex) colour
- [ ] Brand kit
- [ ] Image options like "denoise", "sharpen", "de-yellow", "re-render at 2K/4K".
- [ ] Notice: AI can sometimes get things wrong
- [ ] STUDIO_GENERATION_WORKER_QUEUE_PLAN.md
- [ ] Click to draw a circle/oval/eraser to move an element
- [ ] Feed exports back to workbench as new variants
- [ ] Upscale resolution (via Replicate models)

## Bugs

## Issues
- [ ] Mobile view delete dish button not enough space
- [ ] Scroll bars on image variants observed, possibly when more than n variants
- [ ] Why is cutout worker still appearing in Vercel logs?
- [ ] Historical spike/review data for move/remove features is stored in supabase

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

## Structural / Architectural
- [ ] Use a different model than Gemini for OCR analysis step (e.g. this from 04/08/2026: https://signals.forwardfuture.com/qwen3-8-benchmarks/). Sometimes still offering "Studio Backdrop" even if only the surface is visible.  Gemini recommends "Monocular Depth Estimation Models"
- [ ] Explore batch requests to Gemini image creation (saves costs)
- [ ] Explore use of ChatGPT Images 2.0 (and other options?) as backup to remove single-dependency image generation
- [ ] Playwright (Patrick Ellis YT video)
- [ ] App

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

## /pricing
- [x] Review pricing approach
- [x] Stripe packages update and notify Grok
- [x] Auto-grant new sign-ups 10 credits
- [x] Allow (paid and beta) users to access NB Pro
- [x] Test locally

## Social Media and Advertising
- [x] Post to identified subreddits for feedback
- [x] Social Media "GridMenu is changing"
- [x] Start posting

## /studio
- [x] Zoom in and out on workbench main image
- [x] "Re-shoot" action for photos (parked / not working as intended)
- [x] Expand number of options for each category
- [x] Click to draw a circle/oval/eraser to remove element
- [x] Decorate, e.g. add garnishes, surrounding ingredients, etc.
- [x] Crop
- [x] Degradation pre-notice and warning, e.g. at 3rd-generation variation request
- [x] Magic expand
- [x] Add "cooking" SVG animation(s) instead of boring "Generating..." (but maintain translucency)

## /onboarding
- [x] New users get 10 credits by default

## SEO optimisation
- [x] Update Product Hunt, Betalist, Crunchbase, LinkedIn
- [x] Update Google Search Console
- [x] Update Bing Webmaster Tools
- [x] Keywords still reflect menus

## UI Review
- [x] Create design system with Pinterest / Claude
- [x] Add grid-/tile-inspired images to the home page