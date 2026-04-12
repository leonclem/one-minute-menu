# Roadmap

## Bugs
- [ ] PDF export doesn't keep strong font
- [ ] PDF export doesn't preserve text centring if centre alignment is checked on the /template page.
- [ ] "Not an acai" renders in PDF as "not An Acai"
- [ ] Extraction from more than one image only extracts the first before page loads
- [ ] Pricing keeps defaulting to USD

## Social Media and Advertising
- [x] Set up first Google ad campaign
- [x] Add Google tag to <head>
- [ ] Openclaw initial setup
- [ ] Understand what is required and potential upside to conduct a cold email campaign

## Production Monitoring
- [ ] Install analytics tooling (Vercel default, PostHog, etc.)

## /template
- [ ] Logo / category headers as special filler tiles
- [ ] Advice for print, e.g. use glossy, silk or satin laminated card for darks/blacks, or gentle transitions, low opacity for subtle Textures/Gradients

## Exports
- [ ] Verify "print ready"

## Allergens / Spice level / etc
- [ ] Extend indicator taxonomy for additional dietary restrictions
- [ ] Add custom allergen management via /extracted page

## Deployment
- [x] Upgrade Vercel package
- [ ] Determine UAT requirements
- [ ] Determine if database backup strategy exists (Supabase / Vercel)

### /extracted
- [ ] Users can no longer upload their own images
- [ ] Enhance this image feature
- [ ] No slate for provided background (and warning for )

### /extracted - cutout images
- [ ] Overhead isn't always directly overhead - can we be more explicit with our prompt?

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>> NEXT >>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

## "What's New?" page
- [ ] "What's New?" page
- [ ] Coming soon...
- [ ] Add popup banner to /dashboard

## Security
- [ ] Address Next.js DoS vulnerabilities (see `SECURITY_NEXTJS_VULNERABILITIES.md`)
- [ ] Ensure MFA is set on email accounts
- [ ] Emsure choosing own username during onboarding 

## Tech debt
- [ ] Review code
- [ ] Review SQL
- [ ] Review MD docs
- [ ] QA

## Market awareness
- [x] Create Facebook page (https://www.facebook.com/gridmenu/)
- [x] Create X account (https://x.com/gridmenu)
- [x] Create Instagram account (https://www.instagram.com/gridmenu/)
- [x] Add links to footer
- [x] Create Instagram account and add link icon to footer
- [ ] Reddit community posting
- [x] Google "Transform your restaurant menu into a mobile-friendly QR code menu in minutes. Upload your existing menu or try our demo - no credit card required."

### Blogs
- [x] Create blogs section of site
- [x] Digital vs paper menu
- [ ] Grow sales with better images
- [ ] Admin tool to add blogs
- [ ] Use better descriptions to boost sales
- [ ] Menu design tips and tricks
- [ ] Menu engineering
- [ ] Z-read pattern
- [ ] Comparison page (https://www.upmenu.com/blog/menu-making-apps/)

## /dashboard
- [ ] Show preview picture of menu (if design template chosen) embedded in Dashboard menus

## /dashboard/settings
- [x] Capability to update restaurant name, details, etc. (that are collected at onboarding)
- [ ] Display/update email address

## /extract
- [ ] Use existing PDF menu as input (upload)
- [ ] Crop for large menus text extraction

## /extracted
- [ ] Sometimes not enough space for menu item description.  We need to limit the characters for menu item creation.
- [ ] Menu Control Panel > Download Menu pages (PNG zip)
- [ ] Menu Control Panel > Download Menu Images (PNG zip)
- [ ] Rename this page to menu curator
- [ ] Move item up or down
- [ ] Existing menu extract: Message "This may take a few minutes. Leave this page open while the key is being added." and checkbox with "Email me instead".
- [ ] Cartoon/stylised food images
- [ ] Description creator or "stylist"
- [ ] Rate my description
- [ ] Boost my description

## /template
- [ ] Hand tool to navigate preview pane
- [x] Images too dark, perhaps only darken lower half (assuming top half has text)
- [ ] Upload branding colours
- [ ] For "6. Display Options": new options to only show images for feature items
- [ ] Develop presets
- [ ] "Polaroid" / angled effect.  Perhaps with "marker pen" headings?
- [ ] Should still leave a space between categories even if category titles toggled off
- [ ] Drag and drop tiles
- [ ] Image edit applies to banner logo and flagship image
- [ ] Alternating colour tiles (i.e. menu items, not spacers).
- [ ] Design flourishes, e.g. paint splashes, food ingredients, etc. (overlay)

## /pricing
- [ ] Image resolutions - 1k for Creator Pack, 2k for GridMenu, 4k for GridMenu+.
- [ ] Mauricio feedback - billing period (quarterly, bi-annually, annually)

## Payment QR
- [ ] Add capability to add a payment QR code via the /extracted page (and reflect on pricing page)

## Railway
- [ ] Monitoring of workers in the Admin dashboard (particularly keen to understand turnaround times for extraction and export tasks)

## Home Page
- [x] Update text to be less American
- [ ] Show menu and image outputs examples

## Demo Flow
- [x] Replace "breakfast blackboard" photo with MS Word photo version
- [ ] Demo flow - don't allow users to proceed beyond /extracted until all images generated
- [ ] Remove "Extract items" step - not necessary for demo flow (extra click)

## Stripe
- [ ] Verify that webhooks are in place to detect recurring payments, failures, etc. (as per Gemini chat)

## Admin
- [ ] Track payment failures and cancellations
- [ ] Change primary email logins to admin@gridmenu.ai (e.g. SendGrid, NameCheap, Railway, Supabase, etc.)
- [ ] Remove LOG_LEVEL="debug" from Railway variables
- [ ] Integrate Posthog
- [ ] Consolidate documentation so as to be intuitive and useful (for both me and AI dev)
- [ ] Cyber attack protection plan
- [ ] Power user, i.e. "login as user X" (support)
- [ ] Determine and document how to issue refunds
- [ ] Talk to JBL about SUTE Tax Exemption

## FAQ
- [ ] Add "I didn't receive my menu?", check junk/spam folders, etc.

## Structural / Architectural
- [ ] Migrate out of OneDrive on laptop development
- [ ] Explore batch requests to Gemini image creation (saves costs)
- [ ] Playwright (Patrick Ellis YT video)
- [ ] App

## misc
- [ ] Display user information (e.g. email address of logged in user)
- [ ] Create CP, Grid+, and G+P logo for upload to Stripe products config
- [ ] Monochrome GridMenu logo on every menu

## Unclassified
- [ ] Lloyd feedback: Give an option to email the PDF menu or send to printers (order x amount)
- [ ] Grid+Premium option to suggest descriptions, etc.
- [ ] Priority Railway queues for subscribers
- [ ] Accessibility (read Reddit pain points analysis)
- [ ] Review logging scope
- [ ] Reminder email for credits expiry
- [ ] Multi-user access to accounts (Premium tier)
- [ ] Add option to include opening hours in menu header/footer/tile
- [ ] Consider a sense of Draft -> Published to allow edits in the case of live menus
- [ ] Mauricio feedback - menu item suggestion - including ingredients and recipes
- [ ] Mauricio feedback - inventory management
- [ ] If someone subscribes to G+P and they have Creator Packs, refund the CPs
- [ ] Language support

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>> DONE >>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

## /upload
- [x] Add multiple pages with recommendation for number of items per photo
- [x] Capability to "append" new items
- [x] Fail gracefully
- [x] Handle multiple images at once

## /extracted
- [x] Remove "Bulk tools will use your current selection." from menu items
- [x] Edit category title
- [x] Add category
- [x] Delete category
- [x] Add establishment details to "profile", e.g. establishment name, type, address, etc.
- [x] Pencil icon rather than click image
- [x] Delete menu item
- [x] Mark item as out of stock
- [x] Generate another image
- [x] Send Menu item to other category
- [x] Can't view existing photo full size for menu item
- [x] Can't edit title, description, price, etc. for menu item
- [x] Advanced menu options: Edit order of categories
- [x] If the first time a user lands on /extracted, and they have used an image to create items - display a modal that asks them to review all the details.
- [x] Menu Control Panel > Download Menu pages (PDF)
- [x] Renaming a category pushes it to the bottom
- [x] Disable but don't delete images for item or category
- [x] "Select all" in category but not all in menu
- [x] Remove "Add QR / manage items" button from control panel

## Image Generation Test Harness
- [x] Reference image
- [x] Test with OMG Donuts
- [x] Reference photo(s) for inclusion in image generation for general users

## /extracted - Image Generation
- [x] Understand what's required and pricing to switch to NB2
- [x] Determine best practices for prompting
- [x] Investigate how prompting is currently constructed (Admin area should reveal details)
- [x] Overhaul prompting modal interface to simplify for non-technical
- [x] ISSUE: "Request...failed with status 429 Too Many Requests..."
- [x] Need indicator of cutout status per menu item image
- [x] Capability to switch to alternative Replicate providers

## Menu templates

## /template
- [x] Preserve last configuration per menu (save button and "save before exit"?)
- [x] "3. Background texture" too faint in exports
- [x] Centre category headings for "1 column (tall)" setting under "1. Grid Layout"
- [x] Not enough room for many menu item descriptions in some templates
- [x] Redirect user back to Dashboard after export from /template to reduce repeat clicks/requests
- [x] Show/hide category title
- [x] If no/disabled images for category, render as text-only layout
- [x] Drag and zoom individual menu item images in-place
- [x] Introduce A3 variants to create more space for menu items and menu item components
- [x] Banner Image (flagship concept)

### GridMenu V2 Layout Engine
- [x] Complete V2 architecture implementation
- [x] PDF-first rendering with points-based coordinate system
- [x] Region-based page partitioning (header/title/body/footer)
- [x] Streaming pagination algorithm
- [x] YAML-based template DSL with schema validation
- [x] Classic Cards V2 template implementation
- [x] Item indicators support (dietary, allergens, spice levels)
- [x] Filler tiles with safe zones
- [x] Property-based testing with invariant validation
- [x] Layout Lab developer test harness
- [x] Feature flag integration (V1/V2 switching)
- [x] Comprehensive documentation and API reference
- [x] Image placeholder fix for visual parity (items without images now use ITEM_CARD with placeholder)
- [x] Palette selection
- [x] Background textures
- [x] Logo size
- [x] Make menu title optional
- [x] Remove unnecessary background colour fills from grid elements
- [x] Capability to modify category styling
- [x] Prices should be right-justified to avoid clashing with menu item titles
- [x] V2 tech as default for general use

### GridMenu V2 Layout Engine Enhancements
- [x] Additional template families (two-, three-, four-column)
- [x] A4 landscape and A3 page size support
- [x] Amit feedback: "Column-style" pages (e.g. "half-A4, tall")
- [x] Amit feedback: Only selected "specials" have photos
- [x] Flourishes / section dividers (e.g. design-inspiration-7.png)
- [x] Multi-cell filler tiles / Mosaic layouts (currently 1x1 only), e.g. design-inspiration-5.jpg
- [x] Themed menus, e.g. Superbowl, Valentine's, CNY, etc.
- [x] Swap colour palettes
- [x] Additional background colours and textures
- [x] "Full-tile image" variants

## Export
- [x] Resolution (V2 uses points-based system for consistent PDF output)
- [x] Fixed sizes, e.g. A4 (V2 supports A4 portrait/landscape with configurable margins)

### Logo placement
- [x] Needs to be at the top and smaller
- [x] Remove dotted line
- [x] Option for if no logo was provided
- [x] Consistent across template and exports
- [x] Investigate examples of low-res images in PDFs with consideration to file size
- [x] Page number displaying on export and overlaying footer info

## Outbound Email
- [x] Set up SendGrid account (add domain gridmenu.ai)
- [x] Get the SMTP credentials provided
- [x] Toggle "Enable Custom SMTP" to ON in Supabase prod and paste SMTP credentials in
- [x] Set up Admin auth emails via SendGrid and Vercel Env vars
- [x] Upgrade SendGrid plan to Pro to prevent IP address sharing (with potential spammers)
- [x] Create Google Workspace account to enable outgoing @gridmenu.ai email addresses
- [x] Switch provider from SendGrid to Postmark
- [x] Determine and document all emails sent
- [x] Update style and content
- [x] Upgrade to Postmark 10,000 plan ($15)
- [x] Supabase login/register emails still look terrible

## Review Pricing
- [x] Determine pricing tiers
- [x] Clarify "unlock elements" on /export page
- [x] Implement changes in pricing page

## Back office
- [x] Complete bank account application
- [x] Privacy Policy - consider data use (particularly at scale, benchmarking, etc.)
- [x] Terms of Service
- [x] Contact Us

## Site stability
- [x] Waitlist (for MVP, email goes to me for confirmation)
- [x] Throttles (review what hourly and daily limits have been set per account level)
- [x] Understand what new sign-ups have access to (i.e. Generation limits, Admin dashboard, etc.)

## Sign up
- [x] Capture name and optional profile information
- [x] Register email still looks horribly basic

## Demo Flow
- [x] More clarity on demo input menu as it stands before implementing changes
- [x] Lloyd feedback: input menu is confusing, looks like output
- [x] Include sample logo, address, etc.
- [x] Replace "breakfast blackboard" photo with MS Word photo version

## Resolve paths
- [x] Create sitemap.xml (if not generated by Vercel)
- [x] Submit sitemap.xml full URL to Google Search Tools and Bing Webmaster Tools
- [x] /ux

## Deployment
- [x] Purchase domain
- [x] Set up gridmenu.ai emails

## Railway
- [x] Implement Railway architecture to offload PDF export from Vercel
- [x] Plan for utilising Railway for image export
- [x] Utilise workers for Demo exports now that complexity is rising in template options

## Aspire Completion
- [x] Add company name Gorrrf Private Ltd, UEN number, and office address as per ACRA
- [x] Finalise Aspire bank account setup
- [x] Add funds
- [x] Obtain payment mechanism

## Implement Stripe payment system
- [x] Register account
- [x] Set up test transactions
- [x] Integrate with payment page
- [x] Test all scenarios as per STRIPE_CLI_LOCAL_TESTING.md
- [x] Ensure Creator Packs can't be purchased while on Grid+Premium
- [x] Remove /upgrade page (and all paths to it)
- [x] Test in Production
- [x] Currency Support (for appearing on menus)
- [x] Currency Support (for package pricing / Stripe)
- [x] Enable subscription cancellation process

## Allergens / Spice level / etc
- [x] Determine list (V2 supports dietary indicators: vegetarian, vegan, halal, kosher, gluten-free)
- [x] Consider design impact (V2 renders indicators within item tiles using INLINE mode)
- [x] Implement (V2 has full ItemIndicatorsV2 support with configurable rendering modes)

## Misc.
- [x] Updates FAQ with battle card Qs
- [x] Footer should use real social media handles (with icons)
- [x] Advanced menu options: Currency selection
- [x] Free plan is allowing as many images as I like!!!

## SEO optimisation
- [x] Update content keywords "QR menu,digital menu,restaurant menu,mobile menu,QR code menu"
- [x] Review Home page title
- [x] Review page headings and subheadings
- [x] Review slugs (for internal links)
- [x] Ensure image file names are relevant to search
- [x] Ensure image file alt text are relevant to search (be descriptive, and avoid keyword stuffing)
- [x] Use Open Graph (OG) meta tags for social media sharing

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>> NOTES / REF. >>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

> Are these changes reflected in the files @src/lib/templates/v2/README.md, @src/lib/templates/v2/STYLING_GUIDE.md, @src/lib/templates/v2/TEMPLATE_AUTHORING_GUIDE.md, @src/lib/templates/v2/LIMITATIONS.md (if appropriate to do so)?

> Re-add QR code generation from:
> http://localhost:3000/dashboard/menus/[menu-id]

> http://localhost:3000/ux/menus/[menu-id]/export
> http://localhost:3000/ux/menus/[menu-id]/extracted
> http://localhost:3000/ux/menus/[menu-id]/template
