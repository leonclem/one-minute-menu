# Roadmap

## General functionality

### Menu editing (/extracted)
- [x] Remove "Bulk tools will use your current selection." from menu items
- [x] Edit category title
- [x] Add category
- [x] Delete category
- [x] Add establishment details to "profile", e.g. establishment name, type, address, etc.

### Menu item Management
- [x] Pencil icon rather than click image
- [x] Delete menu item
- [x] Mark item as out of stock
- [x] Generate another image
- [x] Send Menu item to other category
- [x] Can't view existing photo full size for menu item
- [x] Can't edit title, description, price, etc. for menu item

## Image Generation Test Harness
- [ ] Update from Gemini 2.5 Flash Image Preview to Gemini 2.5 Flash Image
- [x] Reference image
- [x] Test with OMG Donuts
- [x] Reference photo(s) for inclusion in image generation for general users

## Menu templates

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
- [ ] Verify "print ready"

### PDF Improvements
- [x] Resolution (V2 uses points-based system for consistent PDF output)
- [x] Fixed sizes, e.g. A4 (V2 supports A4 portrait/landscape with configurable margins)

### Logo placement
- [x] Needs to be at the top and smaller
- [x] Remove dotted line
- [x] Option for if no logo was provided
- [x] Consistent across template and exports

## SendGrid
- [x] Set up account (add domain gridmenu.ai)
- [x] Get the SMTP credentials provided
- [x] Toggle "Enable Custom SMTP" to ON in Supabase prod and paste SMTP credentials in

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
- [ ] Waitlist (for MVP, email goes to me for confirmation)
- [x] Throttles (review what hourly and daily limits have been set per account level)
- [ ] Understand what new sign-ups have access to (i.e. Generation limits, Admin dashboard, etc.)

## Sign up
- [ ] Capture name and optional profile information

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>> GO TO PILOT >>>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

/upload
- [x] "Enter items manually" button not working.

/extracted
- [ ] Need capability to delete a section
- [ ] Menu Control Panel > Download Menu pages (PNG zip)
- [ ] Menu Control Panel > Download Menu Images (PNG zip)

## Deployment
- [x] Purchase domain
- [ ] Set up gridmenu.ai emails
- [ ] Finalise Aspire bank account setup
- [ ] Implement Stripe payment system
- [ ] Determine UAT requirements
- [ ] Determine if database backup strategy exists (Supabase / Vercel)
- [ ] Upgrade Vercel package

## Railway
- [ ] Implement Railway architecture to offload PDF export from Vercel (this might require sending user back to dashboard after design template selection, then download when available)
- [ ] Review if Railway should also be used for other heavy-lifting tasks, e.g. image export
- [ ] Check Railway billing status
- [ ] Priority rendering queue for subscribers

## Email templates
- [ ] Determine and document all emails sent
- [ ] Decide on style and content
- [ ] Implement changes

### GridMenu V2 Layout Engine Enhancements
- [ ] A4 landscape and A3 page size support
- [ ] Additional template families (two-, three-, four-column)
- [ ] Multi-cell filler tiles / Mosaic layouts (currently 1x1 only), e.g. design-inspiration-5.jpg
- [ ] Flourishes / section dividers (e.g. design-inspiration-7.png)

### Payment QR
- [ ] Add capability to add a payment QR code via the /extracted page (and reflect on pricing page)

### Allergens / Spice level / etc
- [x] Determine list (V2 supports dietary indicators: vegetarian, vegan, halal, kosher, gluten-free)
- [x] Consider design impact (V2 renders indicators within item tiles using INLINE mode)
- [x] Implement (V2 has full ItemIndicatorsV2 support with configurable rendering modes)
- [ ] Extend indicator taxonomy for additional dietary restrictions
- [ ] Add custom allergen management via /extracted page

## Resolve paths
- [ ] Create sitemap.xml (if not generated by Vercel)
- [x] /ux

## Demo
- [x] More clarity on demo input menu as it stands before implementing changes
- [ ] Show menu and image outputs on home page
- [ ] Lloyd feedback: input menu is confusing, looks like output
- [ ] Lloyd feedback: Give an option to email the PDF menu or send to printers (order x amount)
- [x] Include sample logo, address, etc.

## Market awareness
- [ ] Create blog / comparison pages (https://www.upmenu.com/blog/menu-making-apps/)
- [ ] Reddit community posting

## Global Reach
- [ ] Initially geo-lock to Singapore
- [ ] Currency Support
- [ ] Language support

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>> GO TO MARKET >>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

## Tech debt
- [ ] Review code
- [ ] Review SQL
- [ ] Review MD docs
- [ ] QA

## Unclassified
- [ ] Integrate Posthog
- [ ] Crop for large menus text extraction
- [ ] Determine UAT requirements
- [ ] SEO optimisation
- [ ] Documentation
- [ ] Cyber attack protection plan
- [ ] Playwright (Patrick Ellis YT video)
- [ ] Accessibility (read Reddit pain points analysis)
- [ ] Power user, i.e. "login as user X" (support)
- [ ] App
- [ ] Generate descriptions
- [ ] Advanced menu options: Currency selection
- [ ] Advanced menu options: Edit order of categories
- [ ] Logging
- [ ] Admin dashboard enhancements
- [ ] Review "select all" in category on /extracted page
- [x] Remove confidence tag at top of page
- [ ] Watermark images in Creator Pack
- [ ] QA to ensure pricing matches reality
- [ ] Show preview picture of menu (if design template chosen) embedded in Dashboard menus
- [ ] Higher resolution images (up to 4K) for Grid+Premium (and include mention on pricing page)
- [ ] Reminder email for credits expiry
- [ ] Multi-user access to accounts (Premium tier)
- [ ] Display user information (e.g. email address of logged in user)
- [ ] Add option to include opening hours in footer
- [ ] Need a sense of Draft -> Published to allow edits in the case of live menus

>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>> NOTES / REF. >>>>>>>>>>>>>
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

> Re-add QR code generation from:
> http://localhost:3000/dashboard/menus/[menu-id]

> http://localhost:3000/ux/menus/[menu-id]/export
> http://localhost:3000/ux/menus/[menu-id]/extracted
> http://localhost:3000/ux/menus/[menu-id]/template
